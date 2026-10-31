# hackathon-5 · WisiVoz

Agente de **voz y chat con IA dentro de la app PagoDirecto** que reemplaza el salto
a WhatsApp del avatar rojo **Wisi**. El usuario habla o escribe ("paga la luz",
"cuánto tengo", "paga el estacionamiento", "dona a Fundana") y el agente ejecuta
las funciones de la app mediante herramientas, con confirmación segura por biometría.

> Construido para el hackathon. La app PagoDirecto se analizó con **REA** (ingeniería
> inversa, estática) para mapear sus funcionalidades y su backend. Ver
> [`docs/01-mapa-rea-app.md`](docs/01-mapa-rea-app.md).

## Estructura
| Carpeta | Qué es | Lenguaje |
|---|---|---|
| `backend/` | Gateway WisiVoz: contrato de tools + ledger simulado + flujo seguro | Python (FastAPI) |
| `agent/` | Config del agente de ElevenLabs (voz Wisi) + aprovisionamiento | JSON + Python |
| `flutter/wisi_voz/` | Widget in-app que sustituye el handoff a WhatsApp | Flutter/Dart |
| `web/` | Consola demo (jurado / operador) | React + TypeScript |
| `docs/` | Mapa REA, arquitectura y decisión | — |

## Arranque rápido
### 1) Gateway (Python 3.12 + uv)
```bash
cd backend
uv venv && uv pip install -e . && uv pip install pytest httpx
uv run pytest -q                 # 9 tests del flujo seguro
uv run uvicorn app.main:app --reload --port 8000
```

### 2) Consola web (Node 22)
```bash
cd web
npm install
npm run dev                      # http://localhost:5173
```

### 3) Agente de voz (ElevenLabs)
```bash
export ELEVENLABS_API_KEY=... GATEWAY_URL=https://tu-gateway WISIVOZ_TOOL_SECRET=...
python3 agent/provision.py       # crea el agente y devuelve ELEVENLABS_AGENT_ID
# añade ELEVENLABS_AGENT_ID al .env del gateway para servir la signed URL
```

### 4) App Flutter
Integrar `WisiLauncher` donde hoy vive el avatar (ver `flutter/wisi_voz/README.md`).

## Seguridad (principio central)
El agente **nunca ejecuta dinero**. Las tools `prepare_*` crean una intención con
vigencia; la ejecución se dispara desde la UI autenticada (biometría/PIN →
`POST /api/confirm`), con idempotencia y autorización server-side. El modelo no ve
ni puede fabricar la prueba de aprobación. Detalle en [`docs/02-arquitectura.md`](docs/02-arquitectura.md).

## Decisión técnica
ElevenLabs Conversational AI + gateway propio, con el LLM intercambiable y el control
del dinero fuera del proveedor. Comparación y criterios en [`docs/03-decision.md`](docs/03-decision.md).

## Estado y siguientes pasos
- ✅ Gateway con contrato de tools, ledger simulado y 9 tests verdes.
- ✅ Agente ElevenLabs definido + consola React (build verde) + widget Flutter.
- ▶️ **Siguiente**: piloto con 2 tools reales contra staging de PagoDirecto y
  cuentas de prueba; medir latencia de voz y tasa de confirmación (ver decisión).
- ▶️ Conectar audio (micrófono/TTS) en `WisiVoiceSession` y biometría real (`local_auth`).
