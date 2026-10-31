# Normas del cerebro de Wisi

31 oct 2026 · Andrés · se aplican en `worker/src/brain.ts` y en `ask()` de la webapp.

**La meta:** resolver cada mensaje con el nivel más barato que lo resuelva bien. Ninguna decisión de dinero o de crédito la toma un modelo de lenguaje: el motor de reglas decide y el usuario confirma con su huella.

## 1. Los niveles

| Nivel | Quién resuelve | Costo | Cuándo se usa |
| --- | --- | --- | --- |
| **N0. Reglas** | Expresiones regulares en la webapp y en `brain.ts` | 0 | Comandos claros: saldo, movimientos, escanear un ticket, «mis créditos», «escanea mis créditos», un servicio con número de contrato, un envío con @usuario y monto |
| **N1. Clasificador barato** | OpenRouter, modelo rápido: `mistralai/mistral-nemo`, con respaldo en `meta-llama/llama-3.1-8b-instruct` y `openai/gpt-oss-20b` | Una fracción de centavo por mensaje | Texto escrito que N0 no entendió y que no sigue una conversación abierta con el agente. Devuelve solo JSON con `action` y `params` |
| **N2. Explicador** | OpenRouter, modelo mejor: `anthropic/claude-haiku-5.5` | Unos centavos por mensaje | Solo para `credito_explicar`: explicar en lenguaje simple una decisión que **ya tomó el motor**, o comparar ofertas del escaneo |
| **N3. Agente de voz** | ElevenLabs (el de siempre) | El más caro | La voz, y el texto que N1 marca como `conversar` o que sigue una conversación ya abierta |

Los precios se revisaron en `https://openrouter.ai/api/v1/models` el 31 oct 2026. Los modelos se configuran como variables del Worker (`OPENROUTER_MODEL_FAST` y `OPENROUTER_MODEL_SMART`), así que se cambian sin tocar el código.

## 2. Reglas para gastar lo mínimo

1. **Primero N0, siempre.** Solo se sube de nivel si el de abajo no resolvió con certeza.
2. **Mensajes cortos al modelo.** N1 recibe el texto del usuario (hasta 400 caracteres), la pantalla actual y la lista de acciones, sin historial. Sus límites: `max_tokens` de 120, `temperature` de 0 y `response_format: {type: "json_object"}`.
3. **N2 con contexto mínimo.** Recibe solo la oferta y el motivo que dio el motor, nunca el historial ni datos de la cuenta. Su límite es `max_tokens` de 350.
4. **Caché.** La explicación de N2 se guarda por oferta y por estado en el Durable Object del usuario. La misma pregunta no se paga dos veces.
5. **Tope diario por usuario**, guardado en su Durable Object: 40 llamadas a N1 y 10 a N2. Al llegar al tope, se baja de nivel (N2 → respuesta fija del motor; N1 → N3 o el resolvedor local).
6. **Proveedor más barato.** OpenRouter recibe `provider: {sort: "price"}`, y la lista `models` como respaldo si un modelo falla.
7. **Sin clave, sin gasto.** Si falta `OPENROUTER_API_KEY`, el cerebro funciona solo con N0 y el resolvedor local de la webapp, y el demo sigue andando.
8. **Se mide.** Cada respuesta de N1 y N2 devuelve `model` y `cost_usd` (de `usage.cost`), y el Worker lo escribe en el log sin el texto del usuario.

## 3. Reglas de seguridad

- **El modelo elige, no ejecuta.** La salida de N1 se valida contra la lista de acciones y de parámetros del [contrato](creditos-contrato.md#3-el-cerebro-de-wisi-apibrain). Lo que no está en la lista se descarta. Una acción de dinero solo prepara una intención, y se confirma en la app con la huella.
- **N2 explica, no decide.** Si su texto contradice la decisión del motor, se muestra la del motor.
- **Nada sensible al modelo.** Ni el PIN, ni el token de sesión, ni el `principal`. Antes de enviar el texto, se reemplazan por `[número]` las secuencias de 6 dígitos o más (contratos, teléfonos, cuentas): el número real lo extrae N0 del texto original.
- **La clave vive en el Worker.** `OPENROUTER_API_KEY` se carga con `npx wrangler secret put` y nunca llega al navegador ni al repo.
- **Transparencia.** Wisi se presenta como asistente con IA. Las ofertas de crédito dicen siempre quién presta y que el demo es simulado.

## 4. Qué falta para producción

- Medir cuánto texto resuelve cada nivel y ajustar las reglas de N0 con los casos más comunes de N1.
- Pasar el tope diario a un contador global (Durable Object o la regla de Rate Limiting de Cloudflare).
- Revisión legal de las ofertas de crédito antes de mostrarlas a usuarios reales.
