"""Modelos del contrato de herramientas (gateway v1).

Estos modelos son de NUESTRO producto, no de un proveedor. El mismo contrato
lógico lo consumen el agente (voz/chat), el cliente Flutter y la consola React.
"""
from __future__ import annotations

from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field


class Status(str, Enum):
    ok = "ok"
    pending = "pending"
    requires_confirmation = "requires_confirmation"
    denied = "denied"
    unavailable = "unavailable"
    error = "error"


class ToolResponse(BaseModel):
    """Envoltura común de toda respuesta de herramienta."""

    request_id: str
    status: Status
    data: dict[str, Any] = Field(default_factory=dict)
    error: dict[str, str] | None = None

    # Texto breve, seguro para leer en voz alta al usuario. El agente debe
    # preferir este campo frente a reconstruir el mensaje por su cuenta.
    speech: str | None = None


# ---- Entradas de herramientas (lo que el modelo puede pedir) -----------------


class GetBalanceInput(BaseModel):
    pass  # el principal autenticado lo inyecta el servidor, no el modelo


class ListServicesInput(BaseModel):
    category: str | None = None
    query: str | None = None


class ExplainServiceInput(BaseModel):
    service_ref: str
    question: str | None = None


class PreparePaymentInput(BaseModel):
    service_ref: str
    account_number: str = Field(description="Nº de contrato/cuenta del servicio")
    amount_minor: int | None = Field(
        default=None, description="Monto en céntimos; si falta se cotiza el pendiente"
    )


class PrepareParkingInput(BaseModel):
    ticket_ref: str = Field(description="Código leído del QR del ticket")


class PrepareDonationInput(BaseModel):
    foundation_ref: str
    amount_minor: int


class PrepareTransferInput(BaseModel):
    recipient_ref: str = Field(description="Teléfono, @usuario o cédula del destino")
    amount_minor: int
    kind: Literal["p2p", "p2c"] = "p2p"


class ConfirmInput(BaseModel):
    intent_id: str
    # Prueba de aprobación obtenida por el flujo autenticado de la app
    # (biometría/PIN/OTP). NUNCA un `approved:true` generado por el modelo.
    approval_proof: str


class OperationStatusInput(BaseModel):
    operation_ref: str


class SupportCaseInput(BaseModel):
    category: str
    summary: str
    related_operation_ref: str | None = None


class OpenScreenInput(BaseModel):
    screen_key: str
    params: dict[str, Any] = Field(default_factory=dict)
