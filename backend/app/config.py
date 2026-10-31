"""Configuración del gateway WisiVoz.

Todos los valores sensibles se leen de variables de entorno (.env). Nunca se
hardcodean secretos. En modo `WISIVOZ_MODE=mock` (por defecto) el gateway usa un
ledger simulado en memoria y NO contacta con el backend real de PagoDirecto.
"""
from __future__ import annotations

import os
from dataclasses import dataclass

try:
    from dotenv import load_dotenv

    load_dotenv()
except Exception:  # pragma: no cover - dotenv es opcional en producción
    pass


@dataclass(frozen=True)
class Settings:
    # "mock" = ledger simulado en memoria. "proxy" = reenviar al backend real
    # (requiere credenciales server-side; deliberadamente no implementado aquí).
    mode: str = os.getenv("WISIVOZ_MODE", "mock")

    # Secreto HMAC que firma los tokens de sesión efímeros entregados al cliente.
    session_secret: str = os.getenv("WISIVOZ_SESSION_SECRET", "dev-secret-change-me")

    # ElevenLabs Conversational AI (voz de Wisi).
    elevenlabs_api_key: str = os.getenv("ELEVENLABS_API_KEY", "")
    elevenlabs_agent_id: str = os.getenv("ELEVENLABS_AGENT_ID", "")

    # Clave compartida que ElevenLabs envía en cada llamada a las webhook tools.
    tool_webhook_secret: str = os.getenv("WISIVOZ_TOOL_SECRET", "dev-tool-secret")

    # Vigencia de una intención de pago/transferencia, en segundos.
    intent_ttl_seconds: int = int(os.getenv("WISIVOZ_INTENT_TTL", "180"))

    # Base del backend real (solo documental en modo mock).
    pd_api_base: str = os.getenv(
        "PD_API_BASE", "https://elbpd-01-vpce86.pagodirecto.com"
    )


settings = Settings()
