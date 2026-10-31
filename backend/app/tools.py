"""Implementación de las herramientas del agente.

Cada función recibe el `principal` ya autenticado (inyectado por el servidor) y
devuelve un `ToolResponse`. Las de pago NUNCA ejecutan dinero: solo preparan una
intención con vigencia. La ejecución pasa por `confirm_and_execute`, que exige una
prueba de aprobación emitida por el flujo autenticado de la app.
"""
from __future__ import annotations

import uuid

from . import fixtures
from .config import settings
from .ledger import ledger
from .models import Status, ToolResponse


def _rid() -> str:
    return f"req_{uuid.uuid4().hex[:12]}"


def _bs(minor: int) -> str:
    """Formatea céntimos como 'Bs 1.234,56' (es-VE)."""
    s = f"{minor / 100:,.2f}"
    s = s.replace(",", "X").replace(".", ",").replace("X", ".")
    return f"Bs {s}"


# ---- consultas ---------------------------------------------------------------


def get_balance(principal: str) -> ToolResponse:
    bal = ledger.balance(principal)
    return ToolResponse(
        request_id=_rid(),
        status=Status.ok,
        data={"balance_minor": bal, "currency": "VES"},
        speech=f"Tu saldo disponible es {_bs(bal)}.",
    )


def list_services(principal: str, category: str | None, query: str | None) -> ToolResponse:
    items = fixtures.SERVICES
    if category:
        items = [s for s in items if s["category"] == category]
    if query:
        q = query.lower()
        items = [s for s in items if q in s["name"].lower() or q in s["service_ref"]]
    names = ", ".join(s["name"] for s in items) or "ninguno"
    return ToolResponse(
        request_id=_rid(),
        status=Status.ok,
        data={"services": items},
        speech=f"Servicios que puedo pagarte: {names}.",
    )


def explain_service(service_ref: str, question: str | None) -> ToolResponse:
    svc = next((s for s in fixtures.SERVICES if s["service_ref"] == service_ref), None)
    if not svc:
        return ToolResponse(
            request_id=_rid(),
            status=Status.unavailable,
            error={"code": "service_not_found", "message": "Servicio no disponible."},
            speech="No encuentro ese servicio en el catálogo.",
        )
    return ToolResponse(
        request_id=_rid(),
        status=Status.ok,
        data={"service": svc},
        speech=(
            f"{svc['name']} es un servicio de {svc['category']}. "
            "Necesito el número de cuenta o contrato para pagarlo."
        ),
    )


def list_foundations(principal: str) -> ToolResponse:
    names = ", ".join(f["name"] for f in fixtures.FOUNDATIONS)
    return ToolResponse(
        request_id=_rid(),
        status=Status.ok,
        data={"foundations": fixtures.FOUNDATIONS},
        speech=f"Puedes donar a: {names}.",
    )


# ---- preparación de intenciones (NO ejecutan dinero) -------------------------


def prepare_payment(
    principal: str, service_ref: str, account_number: str, amount_minor: int | None
) -> ToolResponse:
    svc = next((s for s in fixtures.SERVICES if s["service_ref"] == service_ref), None)
    if not svc:
        return ToolResponse(
            request_id=_rid(),
            status=Status.denied,
            error={"code": "service_not_found", "message": "Servicio no disponible."},
            speech="Ese servicio no está en el catálogo, no puedo prepararlo.",
        )
    amount = amount_minor if amount_minor is not None else svc["sample_pending_minor"]
    intent = ledger.create_intent(
        kind="payment",
        principal=principal,
        amount_minor=amount,
        currency="VES",
        details={"service": svc["name"], "account_number": account_number},
        ttl_seconds=settings.intent_ttl_seconds,
    )
    return _requires_confirmation(
        intent.intent_id,
        f"Vas a pagar {svc['name']}, cuenta {account_number}, por {_bs(amount)}. "
        "¿Confirmo el pago?",
        {"service": svc["name"], "account_number": account_number, "amount_minor": amount},
    )


def prepare_parking(principal: str, ticket_ref: str) -> ToolResponse:
    # El monto del ticket lo cotiza el sistema de parking (aquí, simulado).
    amount = 50_00
    intent = ledger.create_intent(
        kind="parking",
        principal=principal,
        amount_minor=amount,
        currency="VES",
        details={"ticket_ref": ticket_ref},
        ttl_seconds=settings.intent_ttl_seconds,
    )
    return _requires_confirmation(
        intent.intent_id,
        f"Tu ticket de estacionamiento {ticket_ref} son {_bs(amount)}. ¿Lo pago?",
        {"ticket_ref": ticket_ref, "amount_minor": amount},
    )


def prepare_donation(principal: str, foundation_ref: str, amount_minor: int) -> ToolResponse:
    found = next(
        (f for f in fixtures.FOUNDATIONS if f["foundation_ref"] == foundation_ref), None
    )
    if not found:
        return ToolResponse(
            request_id=_rid(),
            status=Status.denied,
            error={"code": "foundation_not_found", "message": "Fundación no disponible."},
            speech="No encuentro esa organización para donar.",
        )
    intent = ledger.create_intent(
        kind="donation",
        principal=principal,
        amount_minor=amount_minor,
        currency="VES",
        details={"foundation": found["name"]},
        ttl_seconds=settings.intent_ttl_seconds,
    )
    return _requires_confirmation(
        intent.intent_id,
        f"Vas a donar {_bs(amount_minor)} a {found['name']}. ¿Confirmo la donación?",
        {"foundation": found["name"], "amount_minor": amount_minor},
    )


def prepare_transfer(
    principal: str, recipient_ref: str, amount_minor: int, kind: str
) -> ToolResponse:
    intent = ledger.create_intent(
        kind="transfer",
        principal=principal,
        amount_minor=amount_minor,
        currency="VES",
        details={"recipient_ref": recipient_ref, "transfer_kind": kind},
        ttl_seconds=settings.intent_ttl_seconds,
    )
    return _requires_confirmation(
        intent.intent_id,
        f"Vas a enviar {_bs(amount_minor)} a {recipient_ref}. ¿Confirmo el envío?",
        {"recipient_ref": recipient_ref, "amount_minor": amount_minor, "kind": kind},
    )


def _requires_confirmation(intent_id: str, speech: str, summary: dict) -> ToolResponse:
    return ToolResponse(
        request_id=_rid(),
        status=Status.requires_confirmation,
        data={
            "intent_id": intent_id,
            "summary": summary,
            "ttl_seconds": settings.intent_ttl_seconds,
        },
        speech=speech,
    )


# ---- confirmación / estado ---------------------------------------------------


def confirm_and_execute(principal: str, intent_id: str, approval_proof: str) -> ToolResponse:
    intent = ledger.get_intent(intent_id)
    if intent is None:
        return ToolResponse(
            request_id=_rid(),
            status=Status.error,
            error={"code": "intent_not_found", "message": "Intención inexistente."},
            speech="No encuentro esa operación; vamos a empezarla de nuevo.",
        )
    # autorización por objeto: la intención debe ser del principal autenticado
    if intent.principal != principal:
        return ToolResponse(
            request_id=_rid(),
            status=Status.denied,
            error={"code": "forbidden", "message": "No autorizado."},
            speech="No puedo confirmar esta operación.",
        )

    result, op = ledger.execute(intent_id, approval_proof)
    if result in ("executed", "replayed"):
        return ToolResponse(
            request_id=_rid(),
            status=Status.ok,
            data={
                "operation_ref": op.operation_ref,
                "state": op.state,
                "balance_minor": ledger.balance(principal),
                "replayed": result == "replayed",
            },
            speech=f"Listo, pago confirmado. Tu nuevo saldo es {_bs(ledger.balance(principal))}.",
        )
    if result == "expired":
        return ToolResponse(
            request_id=_rid(),
            status=Status.denied,
            error={"code": "intent_expired", "message": "La intención expiró."},
            speech="La confirmación caducó por seguridad. ¿La preparo de nuevo?",
        )
    if result == "insufficient_funds":
        return ToolResponse(
            request_id=_rid(),
            status=Status.denied,
            error={"code": "insufficient_funds", "message": "Saldo insuficiente."},
            speech="No tienes saldo suficiente para esta operación.",
        )
    return ToolResponse(
        request_id=_rid(),
        status=Status.error,
        error={"code": "execute_failed", "message": "No se pudo ejecutar."},
        speech="Algo falló al confirmar; no se movió dinero.",
    )


def get_operation_status(principal: str, operation_ref: str) -> ToolResponse:
    op = ledger.get_operation(operation_ref)
    if op is None or op.principal != principal:
        return ToolResponse(
            request_id=_rid(),
            status=Status.unavailable,
            error={"code": "op_not_found", "message": "Operación no encontrada."},
            speech="No encuentro esa operación.",
        )
    return ToolResponse(
        request_id=_rid(),
        status=Status.ok,
        data={"operation_ref": op.operation_ref, "state": op.state},
        speech=f"La operación está en estado {op.state}.",
    )


def create_support_case(
    principal: str, category: str, summary: str, related_operation_ref: str | None
) -> ToolResponse:
    case_ref = f"case_{uuid.uuid4().hex[:10]}"
    return ToolResponse(
        request_id=_rid(),
        status=Status.ok,
        data={"case_ref": case_ref, "category": category},
        speech=f"Abrí el caso {case_ref} con Atención al Usuario. Te contactarán pronto.",
    )


def open_app_screen(principal: str, screen_key: str, params: dict) -> ToolResponse:
    # Lista blanca de pantallas navegables (sin permisos financieros propios).
    allowed = {
        "home", "wallet", "pagar_servicios", "parking", "donaciones",
        "enviar_fondos", "movimientos", "recargas", "club", "mis_pagos",
    }
    if screen_key not in allowed:
        return ToolResponse(
            request_id=_rid(),
            status=Status.denied,
            error={"code": "screen_not_allowed", "message": "Pantalla no permitida."},
        )
    return ToolResponse(
        request_id=_rid(),
        status=Status.ok,
        data={"navigate": {"screen_key": screen_key, "params": params}},
        speech="Te llevo ahí.",
    )
