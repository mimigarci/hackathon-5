"""Gateway WisiVoz — FastAPI.

Expone:
- Endpoints REST limpios para el cliente (Flutter/React): /api/*
- Endpoints de webhook-tool para ElevenLabs Conversational AI: /el/tools/*
- /api/session para emitir el token efímero y la señal de voz del agente.

El principal autenticado se deriva SIEMPRE de un token de sesión firmado
(cabecera Authorization: Bearer ...) o del secreto de webhook, nunca del cuerpo
que envía el modelo.
"""
from __future__ import annotations

import time
from collections import defaultdict, deque
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import tools
from .config import settings
from .models import (
    ConfirmInput,
    ExplainServiceInput,
    ListServicesInput,
    OpenScreenInput,
    OperationStatusInput,
    PrepareDonationInput,
    PrepareParkingInput,
    PreparePaymentInput,
    PrepareTransferInput,
    SupportCaseInput,
    ToolResponse,
)
from .security import (
    issue_session_token,
    make_approval_proof,
    verify_session_token,
    verify_tool_secret,
)

app = FastAPI(title="WisiVoz Gateway", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # demo; restringir en producción
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---- autenticación -----------------------------------------------------------


def current_principal(authorization: str | None = Header(default=None)) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="missing_bearer_token")
    principal = verify_session_token(authorization.split(" ", 1)[1])
    if not principal:
        raise HTTPException(status_code=401, detail="invalid_token")
    return principal


def tool_principal(
    x_wisivoz_tool_secret: str | None = Header(default=None),
    x_wisivoz_principal: str | None = Header(default=None),
) -> str:
    """Para las webhook tools: autentica por secreto compartido y toma el
    principal del contexto de sesión que el servidor pasó a ElevenLabs al crear
    la conversación (no de texto libre del modelo)."""
    if not verify_tool_secret(x_wisivoz_tool_secret):
        raise HTTPException(status_code=401, detail="invalid_tool_secret")
    if not x_wisivoz_principal:
        raise HTTPException(status_code=400, detail="missing_principal")
    return x_wisivoz_principal


# ---- salud / sesión ----------------------------------------------------------


_STATIC = Path(__file__).parent / "static"
app.mount("/assets", StaticFiles(directory=_STATIC / "assets"), name="assets")


@app.get("/", include_in_schema=False)
@app.get("/app", include_in_schema=False)
def webapp() -> FileResponse:
    """Webapp móvil de Wisi (voz + chat + confirmación biométrica simulada)."""
    return FileResponse(_STATIC / "app.html", headers={"Cache-Control": "no-cache"})


@app.get("/demo", include_in_schema=False)
def demo() -> FileResponse:
    """Webapp de demo autónoma (voz + chat) servida por el propio gateway."""
    return FileResponse(_STATIC / "demo.html")


@app.get("/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "mode": settings.mode}


_SIGNED_HITS: dict[str, deque[float]] = defaultdict(deque)


def _client_ip(request: Request) -> str:
    # Detrás de Cloudflare la IP real llega en CF-Connecting-IP.
    return (
        request.headers.get("cf-connecting-ip")
        or request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        or (request.client.host if request.client else "unknown")
    )


def _allow_signed(ip: str) -> bool:
    """Ventana deslizante de 10 min por IP para las sesiones de voz."""
    now, hits = time.monotonic(), _SIGNED_HITS[ip]
    while hits and now - hits[0] > 600:
        hits.popleft()
    if len(hits) >= settings.signed_per_ip_10min:
        return False
    hits.append(now)
    return True


@app.post("/api/session")
async def create_session(
    request: Request,
    principal: str = "demo-user",
    voice: str = "female",
    signed: bool = True,
) -> dict[str, Any]:
    """Emite el token de sesión efímero y los datos de voz del agente.

    `voice` ∈ {female, male} elige el agente (voz venezolana femenina / latino
    masculina). En producción, `principal` sale de la sesión autenticada de la
    app. Devuelve una `signed_url` de ElevenLabs para no exponer el agent_id.
    Con `signed=false` no la pide (arranque rápido; la URL es de un solo uso y
    el cliente la solicita justo antes de abrir el micrófono).
    """
    agent_id = _agent_for_voice(voice)
    if signed and not _allow_signed(_client_ip(request)):
        signed = False
        agent_id = ""  # límite alcanzado: solo chat hasta que pase la ventana
    signed_url = await _elevenlabs_signed_url(agent_id) if signed else None
    return {
        "session_token": issue_session_token(principal),
        "principal": principal,
        "voice": voice,
        "elevenlabs_agent_id": agent_id or "<set ELEVENLABS_AGENT_ID>",
        "signed_url": signed_url,
        "voice_enabled": bool(signed_url) if signed else bool(settings.elevenlabs_api_key and agent_id),
    }


def _agent_for_voice(voice: str) -> str:
    if voice == "male" and settings.elevenlabs_agent_male:
        return settings.elevenlabs_agent_male
    if voice == "female" and settings.elevenlabs_agent_female:
        return settings.elevenlabs_agent_female
    return settings.elevenlabs_agent_id


async def _elevenlabs_signed_url(agent_id: str) -> str | None:
    """Pide a ElevenLabs una URL firmada para la conversación (server-side)."""
    if not (settings.elevenlabs_api_key and agent_id):
        return None
    import httpx

    url = "https://api.elevenlabs.io/v1/convai/conversation/get-signed-url"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                url,
                params={"agent_id": agent_id},
                headers={"xi-api-key": settings.elevenlabs_api_key},
            )
            r.raise_for_status()
            return r.json().get("signed_url")
    except Exception:
        return None


# ---- API REST para clientes (Flutter / React) --------------------------------


@app.get("/api/balance", response_model=ToolResponse)
def api_balance(principal: str = Depends(current_principal)) -> ToolResponse:
    return tools.get_balance(principal)


@app.post("/api/services", response_model=ToolResponse)
def api_services(
    body: ListServicesInput, principal: str = Depends(current_principal)
) -> ToolResponse:
    return tools.list_services(principal, body.category, body.query)


@app.post("/api/payment/prepare", response_model=ToolResponse)
def api_prepare_payment(
    body: PreparePaymentInput, principal: str = Depends(current_principal)
) -> ToolResponse:
    return tools.prepare_payment(
        principal, body.service_ref, body.account_number, body.amount_minor
    )


@app.post("/api/parking/prepare", response_model=ToolResponse)
def api_prepare_parking(
    body: PrepareParkingInput, principal: str = Depends(current_principal)
) -> ToolResponse:
    return tools.prepare_parking(principal, body.ticket_ref)


@app.post("/api/donation/prepare", response_model=ToolResponse)
def api_prepare_donation(
    body: PrepareDonationInput, principal: str = Depends(current_principal)
) -> ToolResponse:
    return tools.prepare_donation(principal, body.foundation_ref, body.amount_minor)


@app.post("/api/transfer/prepare", response_model=ToolResponse)
def api_prepare_transfer(
    body: PrepareTransferInput, principal: str = Depends(current_principal)
) -> ToolResponse:
    return tools.prepare_transfer(
        principal, body.recipient_ref, body.amount_minor, body.kind
    )


@app.post("/api/confirm", response_model=ToolResponse)
def api_confirm(
    body: ConfirmInput, principal: str = Depends(current_principal)
) -> ToolResponse:
    return tools.confirm_and_execute(principal, body.intent_id, body.approval_proof)


@app.post("/api/operation/status", response_model=ToolResponse)
def api_op_status(
    body: OperationStatusInput, principal: str = Depends(current_principal)
) -> ToolResponse:
    return tools.get_operation_status(principal, body.operation_ref)


@app.post("/api/tool/{name}", response_model=ToolResponse)
def api_tool(
    name: str, body: dict[str, Any] | None = None, principal: str = Depends(current_principal)
) -> ToolResponse:
    """Despachador de client tools para la webapp: autentica con el token de
    sesión y ejecuta la tool correspondiente con el principal del servidor.
    NO expone `confirm_and_execute` (el dinero se confirma vía /api/confirm)."""
    b = body or {}
    match name:
        case "get_balance":
            return tools.get_balance(principal)
        case "list_services":
            return tools.list_services(principal, b.get("category"), b.get("query"))
        case "explain_service":
            return tools.explain_service(b.get("service_ref", ""), b.get("question"))
        case "list_foundations":
            return tools.list_foundations(principal)
        case "prepare_payment":
            return tools.prepare_payment(
                principal, b.get("service_ref", ""), b.get("account_number", ""),
                b.get("amount_minor"),
            )
        case "prepare_parking":
            return tools.prepare_parking(principal, b.get("ticket_ref", ""))
        case "prepare_donation":
            return tools.prepare_donation(
                principal, b.get("foundation_ref", ""), int(b.get("amount_minor", 0))
            )
        case "prepare_transfer":
            return tools.prepare_transfer(
                principal, b.get("recipient_ref", ""), int(b.get("amount_minor", 0)),
                b.get("kind", "p2p"),
            )
        case "get_operation_status":
            return tools.get_operation_status(principal, b.get("operation_ref", ""))
        case "list_movements":
            return tools.list_movements(principal, int(b.get("limit", 20)))
        case "create_support_case":
            return tools.create_support_case(
                principal, b.get("category", ""), b.get("summary", ""),
                b.get("related_operation_ref"),
            )
        case "open_app_screen":
            return tools.open_app_screen(principal, b.get("screen_key", ""), b.get("params", {}))
        case _:
            raise HTTPException(status_code=404, detail="unknown_tool")


@app.post("/api/approval-proof")
def api_approval_proof(
    intent_id: str, factor: str = "biometric", principal: str = Depends(current_principal)
) -> dict[str, str]:
    """DEMO: simula la emisión de la prueba de aprobación que, en producción,
    genera el flujo autenticado (biometría/PIN/OTP) y vincula a la intención.
    Nunca la produce el modelo."""
    return {"approval_proof": make_approval_proof(principal, intent_id, factor)}


# ---- Webhook tools para ElevenLabs Conversational AI -------------------------
# Cada endpoint corresponde a una "tool" del agente. Devuelven el mismo
# ToolResponse; ElevenLabs inyecta `speech` como respuesta hablada de Wisi.


@app.post("/el/tools/get_balance", response_model=ToolResponse)
def el_balance(principal: str = Depends(tool_principal)) -> ToolResponse:
    return tools.get_balance(principal)


@app.post("/el/tools/list_services", response_model=ToolResponse)
def el_services(
    body: ListServicesInput, principal: str = Depends(tool_principal)
) -> ToolResponse:
    return tools.list_services(principal, body.category, body.query)


@app.post("/el/tools/explain_service", response_model=ToolResponse)
def el_explain(
    body: ExplainServiceInput, principal: str = Depends(tool_principal)
) -> ToolResponse:
    return tools.explain_service(body.service_ref, body.question)


@app.post("/el/tools/list_foundations", response_model=ToolResponse)
def el_foundations(principal: str = Depends(tool_principal)) -> ToolResponse:
    return tools.list_foundations(principal)


@app.post("/el/tools/prepare_payment", response_model=ToolResponse)
def el_prepare_payment(
    body: PreparePaymentInput, principal: str = Depends(tool_principal)
) -> ToolResponse:
    return tools.prepare_payment(
        principal, body.service_ref, body.account_number, body.amount_minor
    )


@app.post("/el/tools/prepare_parking", response_model=ToolResponse)
def el_prepare_parking(
    body: PrepareParkingInput, principal: str = Depends(tool_principal)
) -> ToolResponse:
    return tools.prepare_parking(principal, body.ticket_ref)


@app.post("/el/tools/prepare_donation", response_model=ToolResponse)
def el_prepare_donation(
    body: PrepareDonationInput, principal: str = Depends(tool_principal)
) -> ToolResponse:
    return tools.prepare_donation(principal, body.foundation_ref, body.amount_minor)


@app.post("/el/tools/prepare_transfer", response_model=ToolResponse)
def el_prepare_transfer(
    body: PrepareTransferInput, principal: str = Depends(tool_principal)
) -> ToolResponse:
    return tools.prepare_transfer(
        principal, body.recipient_ref, body.amount_minor, body.kind
    )


@app.post("/el/tools/get_operation_status", response_model=ToolResponse)
def el_op_status(
    body: OperationStatusInput, principal: str = Depends(tool_principal)
) -> ToolResponse:
    return tools.get_operation_status(principal, body.operation_ref)


@app.post("/el/tools/create_support_case", response_model=ToolResponse)
def el_support(
    body: SupportCaseInput, principal: str = Depends(tool_principal)
) -> ToolResponse:
    return tools.create_support_case(
        principal, body.category, body.summary, body.related_operation_ref
    )


@app.post("/el/tools/open_app_screen", response_model=ToolResponse)
def el_open_screen(
    body: OpenScreenInput, principal: str = Depends(tool_principal)
) -> ToolResponse:
    return tools.open_app_screen(principal, body.screen_key, body.params)


# Nota: NO existe una webhook tool `confirm_and_execute`. La confirmación de
# dinero se dispara exclusivamente desde la UI autenticada (POST /api/confirm),
# con una prueba de aprobación que el modelo nunca ve ni puede fabricar.
