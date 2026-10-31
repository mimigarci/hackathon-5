# Arquitectura WisiVoz

```
┌─────────────────────────┐        voz (WebRTC/WS)      ┌───────────────────────┐
│  App PagoDirecto (Flutter)│ ◄──────────────────────────►│ ElevenLabs Conv. AI    │
│  paquete wisi_voz         │     signed URL + audio      │ (voz de Wisi, es-VE)   │
│  - WisiLauncher (avatar)  │                             │  LLM + ASR + TTS       │
│  - WisiSheet (chat+voz)   │                             └──────────┬────────────┘
│  - WisiVoiceSession       │                                        │ webhook tools
│  - confirmación biométrica│                                        ▼
└───────────┬──────────────┘                             ┌───────────────────────┐
            │ REST (/api/*)   token efímero              │ Gateway WisiVoz (FastAPI)│
            └────────────────────────────────────────────►│  - contrato de tools    │
                                                          │  - intención→confirmación│
                                                          │  - idempotencia, TTL     │
                                                          │  - identidad server-side │
                                                          └──────────┬────────────┘
                                                                     │ (producción)
                                                                     ▼
                                                   Microservicios reales micropd-* / auth-api
                                                   (en este repo: ledger SIMULADO en memoria)
```

## Piezas
- **`flutter/wisi_voz`** — cliente real (la app es Flutter). Reemplaza el salto a
  WhatsApp por la hoja de Wisi (voz + chat). Maneja la confirmación biométrica.
- **`backend`** — gateway FastAPI. Es el **cerebro determinista**: valida identidad,
  cotiza, crea intenciones, ejecuta con idempotencia. Sirve las webhook tools de
  ElevenLabs y la API REST del cliente. En este repo usa un **ledger simulado**;
  en producción se enchufan los microservicios `micropd-*`.
- **`agent`** — definición del agente de ElevenLabs (voz, prompt, tools) y script
  de aprovisionamiento.
- **`web`** — consola demo React/TS para el jurado y como panel de operador.

## Decisiones de diseño
1. **La voz y el LLM no tocan dinero.** Las tools `prepare_*` solo crean una
   intención con vigencia. La ejecución se dispara desde la UI autenticada
   (`confirm_payment_in_app` → biometría/PIN → `POST /api/confirm`).
2. **Identidad en el servidor.** El `principal` se deriva de un token de sesión
   firmado o del secreto de webhook, nunca del texto del usuario o del modelo.
3. **Idempotencia y TTL.** Misma prueba de aprobación ⇒ misma operación. Las
   intenciones expiran (`WISIVOZ_INTENT_TTL`).
4. **Contrato propio v1.** El mismo contrato lógico lo consumen Flutter, React y
   el agente; los endpoints reales se mapean detrás del gateway.
5. **Degradación elegante.** Sin credenciales de ElevenLabs, el chat sigue
   funcionando contra el gateway (modo demo).

## Flujo de un pago por voz
1. Usuario: "Wisi, paga la luz, contrato 0001-2345".
2. Agente llama `prepare_payment` → gateway devuelve `requires_confirmation` + resumen.
3. Agente lee el resumen y llama al client tool `confirm_payment_in_app(intent_id)`.
4. La app muestra la hoja de biometría/PIN; si el usuario aprueba, obtiene la
   prueba y llama `POST /api/confirm`.
5. El gateway ejecuta (idempotente) y devuelve `settled`; el agente lo anuncia.
