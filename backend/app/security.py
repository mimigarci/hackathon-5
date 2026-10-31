"""Identidad y autorización: siempre en el backend, nunca en el prompt.

Reglas (del fintech-agent-decision-kit):
- El principal autenticado, roles y permisos los inyecta el servidor a partir de
  un token de sesión firmado. Nunca se toman de texto libre del usuario o del LLM.
- Las webhook tools de ElevenLabs se autentican con un secreto compartido.
- La prueba de aprobación de un pago la genera el flujo autenticado de la app
  (biometría/PIN/OTP), se vincula a la intención y jamás llega al contexto del modelo.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import time

from .config import settings


def _sign(payload: str) -> str:
    return hmac.new(
        settings.session_secret.encode(), payload.encode(), hashlib.sha256
    ).hexdigest()


def issue_session_token(principal: str, ttl_seconds: int = 1800) -> str:
    """Token de sesión efímero y de alcance mínimo para el cliente."""
    body = {"sub": principal, "exp": int(time.time()) + ttl_seconds}
    raw = json.dumps(body, separators=(",", ":"), sort_keys=True)
    return f"{raw.encode().hex()}.{_sign(raw)}"


def verify_session_token(token: str) -> str | None:
    """Devuelve el principal si el token es válido y no ha expirado."""
    try:
        raw_hex, sig = token.split(".", 1)
        raw = bytes.fromhex(raw_hex).decode()
    except (ValueError, UnicodeDecodeError):
        return None
    if not hmac.compare_digest(sig, _sign(raw)):
        return None
    body = json.loads(raw)
    if int(body.get("exp", 0)) < time.time():
        return None
    return body.get("sub")


def verify_tool_secret(provided: str | None) -> bool:
    """Valida el secreto compartido de las webhook tools de ElevenLabs."""
    if not provided:
        return False
    return hmac.compare_digest(provided, settings.tool_webhook_secret)


def make_approval_proof(principal: str, intent_id: str, factor: str) -> str:
    """Simula la prueba que el flujo autenticado de la app vincula a la intención.

    En producción la emite el servidor tras verificar biometría/PIN/OTP; el
    cliente la pasa a confirm_and_execute. Aquí la derivamos de forma
    determinista para poder probar el flujo end-to-end.
    """
    payload = f"{principal}:{intent_id}:{factor}"
    return _sign(payload)
