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
from .ledger import CREDIT_KINDS, ledger
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


def _bad_amount(amount_minor: int | None) -> ToolResponse | None:
    """Rechaza montos no positivos antes de crear la intención."""
    if amount_minor is not None and amount_minor <= 0:
        return ToolResponse(
            request_id=_rid(),
            status=Status.denied,
            error={"code": "invalid_amount", "message": "El monto debe ser mayor que cero."},
            speech="El monto tiene que ser mayor que cero. ¿Cuánto quieres usar?",
        )
    return None


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
    if bad := _bad_amount(amount_minor):
        return bad
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
    if bad := _bad_amount(amount_minor):
        return bad
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
    if bad := _bad_amount(amount_minor):
        return bad
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
            speech=f"{_DONE.get(intent.kind, 'Listo, operación confirmada')}. Tu nuevo saldo es {_bs(ledger.balance(principal))}.",
        )
    if result == "expired":
        return ToolResponse(
            request_id=_rid(),
            status=Status.denied,
            error={"code": "intent_expired", "message": "La intención expiró."},
            speech="La confirmación caducó por seguridad. ¿La preparo de nuevo?",
        )
    if result == "credit_limit":
        return ToolResponse(
            request_id=_rid(),
            status=Status.denied,
            error={"code": "credit_limit", "message": "Supera el crédito disponible."},
            speech="Ese monto supera tu crédito disponible de Credirecto.",
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


_DONE = {
    "tow_plan": "Listo, tu plan de TuGruero está activo",
    "payment": "Listo, pago confirmado",
    "parking": "Listo, ticket pagado: ya puedes salir",
    "donation": "Listo, donación enviada. ¡Gracias por ayudar",
    "transfer": "Listo, envío realizado",
    "topup": "Listo, recargaste tu wallet",
    "credit": "Listo, el crédito ya está en tu wallet",
    "credit_payment": "Listo, abonaste a tu Credirecto",
    "parking_meter": "Listo, tu parquímetro está activo",
    "insurance": "Listo, tu póliza quedó activa",
    "tickets": "Listo, tus boletos están en Mis boletos",
}


def _describe(kind: str, details: dict) -> str:
    match kind:
        case "payment":
            return f"Pago {details.get('service', 'de servicio')}"
        case "parking":
            return f"Estacionamiento · {details.get('ticket_ref', '')}".rstrip(" ·")
        case "donation":
            return f"Donación a {details.get('foundation', '')}".strip()
        case "transfer":
            return f"Envío a {details.get('recipient_ref', '')}".strip()
        case "topup":
            return f"Recarga · {details.get('method', 'Wallet')}"
        case "credit":
            return "Credirecto · desembolso"
        case "credit_payment":
            return "Credirecto · abono"
        case "tow_plan":
            return f"TuGruero · {details.get('product', '')}"
        case "parking_meter" | "insurance" | "tickets":
            qty = int(details.get("quantity", 1))
            label = {"parking_meter": "Parquímetro", "insurance": "Seguro", "tickets": "Boletería"}[kind]
            extra = f" ×{qty}" if kind == "tickets" and qty > 1 else ""
            return f"{label} · {details.get('product', '')}{extra}"
    return "Operación"


def list_movements(principal: str, limit: int = 20) -> ToolResponse:
    ops = ledger.operations(principal)[: max(1, min(limit, 50))]
    items = [
        {
            "operation_ref": op.operation_ref,
            "kind": op.kind,
            "title": _describe(op.kind, op.details),
            "amount_minor": (1 if op.kind in CREDIT_KINDS else -1) * (op.amount_minor + op.fee_minor),
            "details": op.details,
            "state": op.state,
            "created_at": op.created_at,
        }
        for op in ops
    ]
    if not items:
        speech = "Aún no tienes movimientos en esta sesión."
    else:
        last = items[0]
        speech = (
            f"Tienes {len(items)} movimiento{'s' if len(items) != 1 else ''}. "
            f"El último: {last['title']} por {_bs(abs(last['amount_minor']))}."
        )
    # El saldo inicial se lista para que la cuenta siempre cuadre con el saldo.
    opening = {
        "operation_ref": "op_saldo_inicial",
        "kind": "welcome",
        "title": "Saldo inicial de la demo",
        "amount_minor": fixtures.INITIAL_WALLET_BALANCE_MINOR,
        "details": {},
        "state": "settled",
        "created_at": ledger.account(principal).opened_at,
    }
    return ToolResponse(
        request_id=_rid(),
        status=Status.ok,
        data={"movements": [*items, opening], "balance_minor": ledger.balance(principal)},
        speech=speech,
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
        "escaner_qr", "menu", "credirecto", "depositar", "parquimetros", "seguros",
        "boleteria", "notificaciones", "racha", "asistencia", "mis_vehiculos", "mis_cuentas",
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


# ---- catálogo, recargas y Credirecto (demo) ---------------------------------


def list_catalog(section: str, type_: str | None = None) -> ToolResponse:
    items = fixtures.CATALOG.get(section)
    if items is None:
        return ToolResponse(
            request_id=_rid(),
            status=Status.unavailable,
            error={"code": "section_not_found", "message": "Sección no disponible."},
            speech="Esa sección no está disponible.",
        )
    if type_:
        items = [i for i in items if i.get("type") == type_]
    names = ", ".join(f"{i['name']} ({_bs(i['price_minor'])} por {i['unit']})" for i in items)
    return ToolResponse(
        request_id=_rid(),
        status=Status.ok,
        data={"section": section, "items": items},
        speech=f"Opciones: {names}." if items else "No hay opciones disponibles.",
    )


def prepare_purchase(
    principal: str, product_ref: str, quantity: int = 1, plate: str | None = None
) -> ToolResponse:
    section, item = next(
        ((sec, i) for sec, items in fixtures.CATALOG.items() for i in items if i["product_ref"] == product_ref),
        (None, None),
    )
    if item is None:
        return ToolResponse(
            request_id=_rid(),
            status=Status.denied,
            error={"code": "product_not_found", "message": "Producto no disponible."},
            speech="No encuentro esa opción en el catálogo.",
        )
    qty = max(1, min(int(quantity or 1), fixtures.MAX_QUANTITY[section]))
    amount = item["price_minor"] * qty
    kind = fixtures.CATALOG_KIND[section]
    details = {"product": item["name"], "product_ref": product_ref, "quantity": qty, "section": section}
    if plate:
        details["plate"] = plate.upper()[:10]
    intent = ledger.create_intent(
        kind=kind, principal=principal, amount_minor=amount, currency="VES",
        details=details, ttl_seconds=settings.intent_ttl_seconds,
    )
    unit = f"{qty} {item['unit']}{'s' if qty > 1 and not item['unit'].endswith('s') else ''}"
    return _requires_confirmation(
        intent.intent_id,
        f"{item['name']}, {unit}: son {_bs(amount)}. ¿Lo confirmo?",
        {**details, "amount_minor": amount, "unit": item["unit"]},
    )


def prepare_topup(principal: str, method: str, amount_minor: int) -> ToolResponse:
    label = fixtures.TOPUP_METHODS.get(method)
    if not label:
        return ToolResponse(
            request_id=_rid(),
            status=Status.denied,
            error={"code": "method_not_found", "message": "Método no disponible."},
            speech="Ese método de recarga no está disponible.",
        )
    if bad := _bad_amount(amount_minor):
        return bad
    if amount_minor > fixtures.MAX_TOPUP_MINOR:
        return ToolResponse(
            request_id=_rid(),
            status=Status.denied,
            error={"code": "amount_too_high", "message": "Supera el máximo por recarga."},
            speech=f"El máximo por recarga es {_bs(fixtures.MAX_TOPUP_MINOR)}.",
        )
    intent = ledger.create_intent(
        kind="topup", principal=principal, amount_minor=amount_minor, currency="VES",
        details={"method": label, "method_ref": method}, ttl_seconds=settings.intent_ttl_seconds,
    )
    return _requires_confirmation(
        intent.intent_id,
        f"Vas a recargar {_bs(amount_minor)} con {label}. ¿Confirmo la recarga?",
        {"method": label, "amount_minor": amount_minor},
    )


def get_credit(principal: str) -> ToolResponse:
    used = ledger.account(principal).credit_used_minor
    limit = fixtures.CREDIT_LIMIT_MINOR
    n = fixtures.CREDIT_INSTALLMENTS
    data = {
        "limit_minor": limit, "used_minor": used, "available_minor": limit - used,
        "installments": n, "installment_minor": -(-used // n) if used else 0,
    }
    speech = f"Tu Credirecto tiene {_bs(limit - used)} disponibles de {_bs(limit)}."
    if used:
        speech += f" Debes {_bs(used)}, en {n} cuotas de {_bs(data['installment_minor'])}."
    return ToolResponse(request_id=_rid(), status=Status.ok, data=data, speech=speech)


def prepare_credit(principal: str, amount_minor: int) -> ToolResponse:
    if bad := _bad_amount(amount_minor):
        return bad
    available = fixtures.CREDIT_LIMIT_MINOR - ledger.account(principal).credit_used_minor
    if amount_minor > available:
        return ToolResponse(
            request_id=_rid(),
            status=Status.denied,
            error={"code": "credit_limit", "message": "Supera el crédito disponible."},
            speech=f"Tu crédito disponible es {_bs(available)}.",
        )
    n = fixtures.CREDIT_INSTALLMENTS
    intent = ledger.create_intent(
        kind="credit", principal=principal, amount_minor=amount_minor, currency="VES",
        details={"installments": n}, ttl_seconds=settings.intent_ttl_seconds,
    )
    return _requires_confirmation(
        intent.intent_id,
        f"Te deposito {_bs(amount_minor)} de Credirecto, en {n} cuotas de {_bs(-(-amount_minor // n))}. ¿Lo confirmo?",
        {"amount_minor": amount_minor, "installments": n, "installment_minor": -(-amount_minor // n)},
    )


def prepare_credit_payment(principal: str, amount_minor: int) -> ToolResponse:
    if bad := _bad_amount(amount_minor):
        return bad
    used = ledger.account(principal).credit_used_minor
    if not used:
        return ToolResponse(
            request_id=_rid(), status=Status.denied,
            error={"code": "no_debt", "message": "Sin deuda."},
            speech="No tienes deuda con Credirecto.",
        )
    amount = min(amount_minor, used)
    intent = ledger.create_intent(
        kind="credit_payment", principal=principal, amount_minor=amount, currency="VES",
        details={}, ttl_seconds=settings.intent_ttl_seconds,
    )
    return _requires_confirmation(
        intent.intent_id, f"Vas a abonar {_bs(amount)} a tu Credirecto. ¿Confirmo?",
        {"amount_minor": amount},
    )
