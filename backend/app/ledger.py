"""Ledger simulado en memoria.

Representa el "sistema de registro" determinista. Los cálculos monetarios y las
decisiones de autorización viven aquí, nunca en el modelo. En producción esta
clase se sustituye por adaptadores a los microservicios reales (micropd-*),
pero la lógica de intención/confirmación/idempotencia se mantiene.
"""
from __future__ import annotations

import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

from . import fixtures


@dataclass
class Intent:
    intent_id: str
    kind: str  # payment | parking | donation | transfer
    principal: str
    amount_minor: int
    fee_minor: int
    currency: str
    details: dict[str, Any]
    created_at: float
    ttl_seconds: int
    state: str = "quoted"  # quoted -> authorized -> submitted -> settled/failed

    def expires_at(self) -> float:
        return self.created_at + self.ttl_seconds

    def is_expired(self) -> bool:
        return time.time() > self.expires_at()


@dataclass
class Operation:
    operation_ref: str
    intent_id: str
    kind: str
    principal: str
    amount_minor: int
    fee_minor: int
    state: str  # settled | pending | failed
    created_at: float


@dataclass
class Account:
    principal: str
    balance_minor: int
    operations: list[Operation] = field(default_factory=list)


class Ledger:
    """Ledger determinista, thread-safe, por usuario."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._accounts: dict[str, Account] = {}
        self._intents: dict[str, Intent] = {}
        # idempotencia: approval_proof -> operation_ref ya ejecutado
        self._idempotency: dict[str, str] = {}

    # -- cuentas ---------------------------------------------------------------

    def account(self, principal: str) -> Account:
        with self._lock:
            if principal not in self._accounts:
                self._accounts[principal] = Account(
                    principal=principal,
                    balance_minor=fixtures.INITIAL_WALLET_BALANCE_MINOR,
                )
            return self._accounts[principal]

    def balance(self, principal: str) -> int:
        return self.account(principal).balance_minor

    # -- intenciones -----------------------------------------------------------

    def create_intent(
        self,
        *,
        kind: str,
        principal: str,
        amount_minor: int,
        currency: str,
        details: dict[str, Any],
        ttl_seconds: int,
        fee_minor: int = 0,
    ) -> Intent:
        with self._lock:
            intent = Intent(
                intent_id=f"int_{uuid.uuid4().hex[:16]}",
                kind=kind,
                principal=principal,
                amount_minor=amount_minor,
                fee_minor=fee_minor,
                currency=currency,
                details=details,
                created_at=time.time(),
                ttl_seconds=ttl_seconds,
            )
            self._intents[intent.intent_id] = intent
            return intent

    def get_intent(self, intent_id: str) -> Intent | None:
        return self._intents.get(intent_id)

    # -- confirmación / ejecución ---------------------------------------------

    def execute(self, intent_id: str, approval_proof: str) -> tuple[str, Operation]:
        """Ejecuta una intención de forma idempotente.

        Devuelve (resultado, operación) donde resultado ∈
        {executed, replayed, expired, insufficient_funds, not_found}.
        """
        with self._lock:
            # idempotencia: misma prueba -> misma operación, no se duplica
            if approval_proof in self._idempotency:
                op_ref = self._idempotency[approval_proof]
                op = self._find_op(op_ref)
                return "replayed", op  # type: ignore[return-value]

            intent = self._intents.get(intent_id)
            if intent is None:
                return "not_found", None  # type: ignore[return-value]
            if intent.is_expired():
                intent.state = "expired"
                return "expired", None  # type: ignore[return-value]

            total = intent.amount_minor + intent.fee_minor
            acc = self.account(intent.principal)
            if acc.balance_minor < total:
                return "insufficient_funds", None  # type: ignore[return-value]

            # debitar y registrar
            acc.balance_minor -= total
            op = Operation(
                operation_ref=f"op_{uuid.uuid4().hex[:16]}",
                intent_id=intent.intent_id,
                kind=intent.kind,
                principal=intent.principal,
                amount_minor=intent.amount_minor,
                fee_minor=intent.fee_minor,
                state="settled",
                created_at=time.time(),
            )
            acc.operations.append(op)
            intent.state = "submitted"
            self._idempotency[approval_proof] = op.operation_ref
            return "executed", op

    def get_operation(self, operation_ref: str) -> Operation | None:
        return self._find_op(operation_ref)

    def _find_op(self, operation_ref: str) -> Operation | None:
        for acc in self._accounts.values():
            for op in acc.operations:
                if op.operation_ref == operation_ref:
                    return op
        return None


# instancia de proceso (en producción: por request/tenant con backend real)
ledger = Ledger()
