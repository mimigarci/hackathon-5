# Decisión: agente de voz/chat in-app para PagoDirecto

Siguiendo el método del `fintech-agent-decision-kit`. Esta es una decisión
**fundamentada en hechos del proyecto**, no en popularidad.

## Hechos verificados (no supuestos)
- La app es **Flutter** (`pdflutterv2`), v5.3.2. → el cliente debe ser Flutter.
- Wisi ya es un avatar in-app que hoy deriva a WhatsApp. → no hay que crear marca,
  hay que **sustituir el handoff**.
- El backend es de microservicios REST con 2FA (`payment-totp`) y auth propia. →
  encaja un gateway que orqueste tools y confirmaciones server-side.
- Ya hay IA generativa + OCR y chat P2P con sockets. → la organización acepta IA;
  el salto a voz conversacional es incremental, no disruptivo.

## Opción elegida: **A — ElevenLabs Conversational AI + gateway propio**
Compite contra **B — LiveKit gestionado + agente propio** y **C — OpenAI Agents SDK + Realtime**.

| Criterio | A (elegida) | B | C |
|---|---|---|---|
| Tiempo a demo de voz | **Muy bajo** (voz+ASR+LLM+tools gestionados) | Medio (hay que orquestar) | Bajo-medio |
| Calidad de voz es-VE | **Alta** (TTS ElevenLabs) | Depende del TTS que conectes | Buena |
| Integración de tools | **Nativa** (webhook/client tools) | Propia | Nativa |
| Encaje con Flutter | SDK + WS de control (hecho aquí) | SDK LiveKit | SDK/WebRTC |
| Control del dinero | En **nuestro** gateway (igual en las 3) | Igual | Igual |
| Dependencia de proveedor | Media (voz/LLM) | Media (transporte) | Media-alta |

**Por qué gana A en este caso:** maximiza velocidad a un piloto con voz de calidad
en español, que es el objetivo del hackathon, sin ceder el control del dinero (vive
en el gateway, idéntico en las tres rutas). El pedido explícito del proyecto era
usar ElevenLabs, y la arquitectura deja el LLM intercambiable (el gateway no depende
del proveedor de voz).

## Qué podría cambiar la decisión
- Si se exige **portabilidad total del transporte** o telefonía PSTN avanzada → reevaluar **B (LiveKit)**.
- Si el equipo estandariza en **OpenAI** para todo el stack de IA → **C**.
- Si aparecen requisitos de **cumplimiento** que exijan on-prem del ASR/TTS.

Ninguna de estas afecta al gateway ni al contrato de tools: la inversión principal
de este repo es reutilizable en las tres rutas.

## Límites y plan de reversión
- El ledger es simulado: **no hay movimiento de dinero real**. Integrar `micropd-*`
  es trabajo server-side separado y con su propio alcance.
- Reversión: desactivar el `WisiLauncher` restaura el comportamiento actual
  (handoff a WhatsApp) sin tocar el resto de la app.

## Siguiente experimento que resolvería lo pendiente
Piloto acotado: conectar 2 tools reales (saldo + pago de servicio) contra staging
de PagoDirecto con cuentas de prueba, medir latencia de voz, tasa de éxito de la
confirmación y comprensión de es-VE, con 10 escenarios del kit.
