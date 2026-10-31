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

from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

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


@app.get("/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "mode": settings.mode}


@app.post("/api/session")
async def create_session(principal: str = "demo-user") -> dict[str, Any]:
    """Emite el token de sesión efímero y los datos de voz del agente.

    En producción, `principal` sale de la sesión autenticada de la app, no de un
    parámetro. Devuelve una `signed_url` de ElevenLabs cuando hay credenciales,
    para que el agent_id nunca se exponga en el cliente.
    """
    signed_url = await _elevenlabs_signed_url()
    return {
        "session_token": issue_session_token(principal),
        "principal": principal,
        "elevenlabs_agent_id": settings.elevenlabs_agent_id or "<set ELEVENLABS_AGENT_ID>",
        "signed_url": signed_url,
        "voice_enabled": bool(signed_url),
    }


async def _elevenlabs_signed_url() -> str | None:
    """Pide a ElevenLabs una URL firmada para la conversación (server-side)."""
    if not (settings.elevenlabs_api_key and settings.elevenlabs_agent_id):
        return None
    import httpx

    url = "https://api.elevenlabs.io/v1/convai/conversation/get-signed-url"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                url,
                params={"agent_id": settings.elevenlabs_agent_id},
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
