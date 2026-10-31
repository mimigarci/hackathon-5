#!/usr/bin/env python3
"""Aprovisiona el agente Wisi en ElevenLabs Conversational AI.

Lee `wisi_agent.json` y `system_prompt.md`, sustituye las variables y crea (o
actualiza) el agente vía API. No guarda secretos: lee todo de variables de entorno.

Uso:
    ELEVENLABS_API_KEY=... GATEWAY_URL=https://tu-gateway \\
    WISIVOZ_TOOL_SECRET=... ELEVENLABS_VOICE_ID=... \\
    python3 agent/provision.py

Requiere: httpx  (uv pip install httpx)
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import httpx

HERE = Path(__file__).parent
API = "https://api.elevenlabs.io/v1/convai/agents/create"


def main() -> int:
    api_key = os.environ.get("ELEVENLABS_API_KEY")
    if not api_key:
        print("Falta ELEVENLABS_API_KEY", file=sys.stderr)
        return 2

    raw = (HERE / "wisi_agent.json").read_text(encoding="utf-8")
    subs = {
        "{{GATEWAY_URL}}": os.environ.get("GATEWAY_URL", "http://localhost:8000"),
        "{{WISIVOZ_TOOL_SECRET}}": os.environ.get("WISIVOZ_TOOL_SECRET", "dev-tool-secret"),
        "{{ELEVENLABS_VOICE_ID}}": os.environ.get("ELEVENLABS_VOICE_ID", ""),
        "{{principal}}": "{{principal}}",  # lo rellena el runtime de ElevenLabs por sesión
    }
    for k, v in subs.items():
        raw = raw.replace(k, v)

    cfg = json.loads(raw)
    cfg["conversation_config"]["agent"]["prompt"]["prompt"] = (
        HERE / "system_prompt.md"
    ).read_text(encoding="utf-8")
    cfg.pop("_comment", None)

    r = httpx.post(
        API,
        headers={"xi-api-key": api_key, "Content-Type": "application/json"},
        json=cfg,
        timeout=30,
    )
    if r.status_code >= 300:
        print(f"Error {r.status_code}: {r.text}", file=sys.stderr)
        return 1
    agent_id = r.json().get("agent_id")
    print(f"Agente creado. ELEVENLABS_AGENT_ID={agent_id}")
    print("Añádelo al .env del gateway para servir la signed URL.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
