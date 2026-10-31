# Plan de la fase 0: demo del hackatón (Reto 5, Wisi atiende)

31 oct 2026 · versión 2, 12:45 · para mimigarci, David (0xDapa) y Andrés (andres89018-hash)

Este plan junta lo que ya hay en el repo: la app y el diseño del asistente de mimigarci, el gateway, la webapp y la voz de Wisi de David, y el [roadmap de crédito y Wisi](pago-directo-ecosistema-credito-wisi.md) de Andrés. Lo marcado como "recomendada" lo deciden los tres en los primeros 15 minutos.

## Qué cambió desde la versión de las 12:20

- El gateway ya está publicado con HTTPS, pero no es el de Python. David lo pasó a un Worker de Cloudflare en TypeScript (`worker/`), que responde en `https://botflow.lat`. El saldo vive en un Durable Object por usuario y ya no se borra al reiniciar.
- El PR de `david/dev` a `main` se unió a las 12:14. Los dos commits del Worker (12:30 y 12:33) todavía no están en `main`.
- El carril de Andrés pasa de Python a TypeScript: el PIN y el crédito van en `worker/src/`. El gateway de Python queda congelado como respaldo.
- La pregunta de la sección 2 ya no es "¿un cerebro o dos?", sino "¿cómo comparten el mismo monedero la app Flutter y la webapp de Wisi?".
- Sale `POST /api/demo/reset`: para empezar de cero basta con un principal nuevo (sección 8).
- Dos huecos nuevos en la sección 6: el Worker firma con `dev-secret-change-me` si le falta su secreto, y `/api/approval-proof` entrega pruebas de huella, PIN u OTP sin verificar nada.
- Los agentes de voz se vuelven a crear con `provision_client_tools.py` (no con `provision.py`), y su timeout de confirmación sube de 20 a 90 segundos para que alcance a teclear el PIN.
- Revisado por un crítico independiente contra el código: se agregaron el orden entre el secreto y el despliegue del PIN, el bloqueo atómico, el `pid` de reserva y el guion sin salir de la pestaña de Wisi.

## 0. La frase del demo

> Wisi atiende, un motor de reglas decide y el PIN confirma. El modelo de lenguaje nunca ve tu PIN, nunca aprueba crédito y nunca mueve dinero.

Todo lo que se construya hoy tiene que caber en el guion de la sección 8.

## 1. Lo que ya existe (12:45)

| Pieza | De quién | Dónde | Estado |
| --- | --- | --- | --- |
| App Flutter: Home, Movimientos, Mis pagos, Menú, mascota y un chat de prueba | mimigarci | `app/` en `main`, publicada en Vercel | Funciona con datos mock. La pantalla en blanco de Vercel se arregló a las 12:27. No habla con el gateway |
| Diseño del asistente con Gemini, registro de flujos, máquina de estados y "Ver en la app" | mimigarci | README de `main` | Documentado, sin código |
| Gateway en producción: Worker de Cloudflare con el mismo contrato que el de Python, monedero persistente por principal y verificación de la prueba de aprobación al confirmar | David | `worker/` en `david/dev` | Responde en `https://botflow.lat/health` con `runtime: cloudflare-workers`. No tiene pruebas automáticas. Solo David despliega, porque tiene el token de Cloudflare |
| Webapp móvil de Wisi: voz, chat y una hoja de confirmación que simula la huella | David | `backend/app/static/app.html`, servida en `botflow.lat/` por el Worker | Funciona. Cada navegador crea su propio principal (`web-…`) y lo guarda en `localStorage` |
| Gateway de Python (FastAPI) | David | `backend/` en `main` | Respaldo para un túnel (opción B de `docs/05-despliegue-cloudflare.md`). Pasa 9 pruebas. Se congela hoy |
| Paquete Flutter `wisi_voz`: lanzador, hoja de chat y voz, y confirmación | David | `flutter/wisi_voz/` en `main` | Usa el principal `demo-user`. Falta conectar el audio en Flutter |
| Monitor de disponibilidad cada 30 minutos | David | `.github/workflows/uptime.yml` en `david/dev` | Se activa cuando llegue a `main` |
| Auditoría REA de las funciones de Home | David | `docs/rea-home/` en `main` | Documento |
| Roadmap de crédito (Credirecto en tres pisos) y Wisi | Andrés | `docs/` en `main` | Documento |

## 2. La decisión de los primeros 15 minutos: un monedero para las dos caras

El cerebro ya está decidido en la práctica: el Worker de David es la única fuente del dinero. Ahí viven el saldo, las intenciones y los pagos, y ahí van el PIN y el crédito. Falta decidir cómo la app Flutter y la webapp de Wisi muestran el mismo saldo.

El monedero se elige con el **principal**. Si cada cara usa uno distinto, Wisi paga en un monedero y la pantalla de inicio muestra otro: es el problema de los dos saldos de la versión anterior, ahora dentro de un solo gateway.

| Opción | Cómo queda | A favor | En contra |
| --- | --- | --- | --- |
| **1. Un monedero, dos caras (recomendada)** | Las dos caras toman el principal de `?pid=` en la URL. La app Flutter muestra el saldo, los pendientes y los movimientos del Worker, y la mascota abre `https://botflow.lat/?pid=<el mismo>` | La voz ya funciona en la webapp, y la app solo suma lectura. Hay un solo saldo en todo el guion | Wisi se abre en otra pestaña, no dentro de la app. La app tiene que volver a pedir el saldo al recuperar el foco |
| 2. Solo la webapp | Todo el guion pasa en `botflow.lat`. La app Flutter enseña aparte las pantallas de Credirecto y Viajes con datos mock | Casi no hay integración | La app de Pago Directo casi no sale en el demo |
| 3. `wisi_voz` dentro de Flutter | Wisi vive dentro de la app | Es la experiencia final | Falta el audio en Flutter y es lo más lento. Queda para P2 |

**Punto de control:** si a las T+2:00 la app no muestra el saldo del Worker, se pasa a la opción 2.

Del README de `main` se conserva, aunque se pause Gemini: la confirmación con resumen, el botón "Salir" siempre visible y cancelar con una palabra. Se posponen Gemini, las Edge Functions, la sesión anónima y "Ver en la app". La herramienta `open_app_screen` del Worker es el primer paso de "Ver en la app".

## 3. Qué falta para la fase 0 (con la opción 1)

**P0: sin esto no hay demo**

1. Publicar el gateway con HTTPS: **hecho** (`botflow.lat`). Falta unir el Worker a `main`, confirmar que `WISIVOZ_SESSION_SECRET` está cargado y hacer que el Worker no firme sin él fuera de `localhost` (sección 6).
2. Las dos caras comparten el principal con `?pid=`. La app Flutter usa un `GatewayRepository` para el saldo, los pendientes y los movimientos, y la mascota abre la webapp con el mismo `pid`.
3. Wisi se presenta como IA en tres lugares: lo primero que dice el agente de voz (`first_message` en `agent/provision_client_tools.py`, más el prompt), el saludo de la webapp (`greet()` en `app.html`) y el de la app Flutter. El texto: «Hola, soy Wisi, el asistente con IA de Pago Directo. Nunca te pediré tu PIN ni te llamaré».
   - Ojo: los agentes en vivo salen de `provision_client_tools.py`, no de `provision.py` (ese crea un agente con webhooks `/el/tools/*`, que el Worker no sirve). Y los dos scripts **crean agentes nuevos**: escriben los IDs en `backend/.env`, no en el Worker. Después de correrlo hay que cargar los tres `ELEVENLABS_AGENT_ID*` con `npx wrangler secret put` y desplegar, o el Worker sigue usando los agentes viejos.
   - En esa misma pasada: subir `response_timeout_secs` de `confirm_payment_in_app` de 20 a 90 segundos. Con 20, teclear el PIN tarda más que eso, y Wisi dice que falló aunque el pago sí salga.
4. El PIN se verifica en el Worker. Hoy `/api/approval-proof` entrega la prueba sin revisar nada y para cualquier factor, así que la huella de la webapp es decorativa. La hoja de confirmación de `app.html` pasa a pedir el PIN. **Límite:** si a las T+1:45 el PIN no está desplegado, Andrés pasa al crédito y en el pitch se dice que el PIN está simulado.
5. El pago de un servicio de punta a punta, por voz y por chat, con el saldo de la app al día cuando se vuelve a ella.
6. Wisi responde «¿qué tengo pendiente?» con la herramienta `list_pending`, que va en el Worker, en los `clientTools` de `app.html` y en el agente.
7. Plan B: un video grabado del guion y la app en modo mock, que funciona sin internet.

**P1: el crédito del roadmap, lo que diferencia el demo**

8. El motor de Credirecto en el Worker (`worker/src/credit.ts`): reglas escritas por piso y nivel, el motivo de cada decisión y la línea del usuario demo. Un pago a crédito no descuenta el saldo, sino que suma a lo usado de la línea. Como hoy `Wallet.execute` siempre descuenta, hay que tocar el Durable Object para guardar ahí lo usado y las cuotas.
9. Herramientas nuevas: `get_credit_status`, `quote_credit` (simula, no decide) y `prepare_credit_payment` (crea la intención en cuotas, que se confirma con el PIN igual que un pago). Van en el Worker, en los `clientTools` de `app.html` y en el agente.
10. La pantalla Mi Credirecto en la app, con el estado y la guía de pisos.
11. Viajes en Boletería, con 3 vuelos simulados y Credirecto Viajes.
12. La escalada a una persona: `create_support_case` ya existe. Faltan el chip «Hablar con una persona» y la regla de "no fui yo" y "me cobraron mal".

**P2: si sobra tiempo:** el audio dentro de la app Flutter con `wisi_voz` (la opción 3), ánimos nuevos de la mascota y "Ver en la app".

**Orden de corte**, si el tiempo no alcanza: primero se cae Viajes, después la pantalla Mi Credirecto (el crédito queda solo en la conversación con Wisi) y después el chip de humano en la app. Lo último que se corta es el paso 5 del guion.

**Fuera de hoy** (fases 1 a 4 del roadmap): KYC, motor de crédito real, fondeo, cobranza, notificaciones push, aliados por API y revisión legal. Tampoco se llevan el PIN ni el crédito al gateway de Python.

## 4. Carriles: cada quien sigue con lo suyo

La asignación sale de lo que cada quien ya construyó.

| Carril | Dueño | Archivos | P0 | P1 |
| --- | --- | --- | --- | --- |
| App | mimigarci | `app/`, salvo las pantallas nuevas de crédito y viajes | `GatewayRepository` con `?pid=`, la mascota abre la webapp, el saludo con el aviso y el deploy en Vercel | El botón "Pagar" en Mis pagos, el chip de humano, y enlazar Mi Credirecto y Viajes desde Home y Boletería |
| Gateway, webapp y voz | David | `worker/` (salvo `pin.ts` y `credit.ts`), `backend/`, `agent/`, `web/` y `flutter/wisi_voz/` | Unir el Worker a `main`, el secreto obligatorio, `?pid=` en `app.html`, el aviso de IA en `first_message` y en `greet()`, volver a crear los agentes con `list_pending` y el timeout de 90 s (y cargar sus IDs en el Worker), y `/api/pending` y `/api/movements` en un archivo nuevo (`worker/src/reads.ts`). Desplegar después de cada unión a `main` | Registrar las herramientas de crédito en `clientTools` y en el agente |
| PIN y crédito | Andrés | `worker/src/pin.ts` y `worker/src/credit.ts` con sus pruebas (nuevos); los ganchos en `worker/src/index.ts` y el campo de PIN en `app.html`; `app/lib/screens/credit_screen.dart` y `travel_screen.dart` (nuevos) | El PIN de punta a punta en la webapp. Empieza por la lógica pura de `pin.ts`, que no necesita desplegar. El Worker no tiene runner de pruebas: las funciones puras se prueban con `node --test --experimental-strip-types` (Node 22) y el resto con `npx wrangler dev` | El motor, sus herramientas en el Worker y las pantallas |

**Archivos compartidos.** `worker/src/index.ts` y `app.html` los tocan David y Andrés. Para no pisarse: se avisa en el chat antes de empezar, hay un solo PR abierto a la vez por archivo, David revisa los de Andrés y nadie despliega sin pasar por `main`. Para que eso no frene a nadie, lo nuevo va en archivos nuevos y en `index.ts` solo entran las líneas que los conectan.

**Puntos de contacto:**

- PIN (Andrés, PR que revisa David): `/api/approval-proof` pide `{intent_id, pin}` en el cuerpo y emite solo la prueba del factor `pin`. `confirm_and_execute` deja de aceptar `biometric` y `otp`. El `Wallet` guarda los intentos fallidos y el bloqueo. En la hoja de `app.html`, "Confirmar con huella" pasa a ser un campo de PIN.
- David carga el secreto `WISIVOZ_DEMO_PIN` con `npx wrangler secret put` **antes** de unir el PR del PIN (el código viejo lo ignora), y después despliega. Así nunca corre el código nuevo sin su secreto.
- En la webapp, `confirmOp` avisa al agente del resultado también cuando la confirmación la abrió el agente (hoy solo lo hace si la abrió el usuario).
- Crédito (Andrés): las rutas `/api/credit/*`, el tipo de intención `credit_payment` dentro de `confirm_and_execute` y sus casos en `dispatchTool`.
- Cuando entre el PIN, `demo.html`, la consola de `web/` y `wisi_voz` ya no podrán confirmar. Ninguno sale en el guion: se actualizan si sobra tiempo y, mientras tanto, el README lo dice.

El README de la raíz lo ajusta mimigarci, su autora, cuando se decida la sección 2.

## 5. Contratos

**5.1 Lo que ya existe en el Worker.** Todas las respuestas son `ToolResponse` con los campos `request_id`, `status`, `data`, `error` y `speech`. La sesión sale de `POST /api/session?principal=…` y el resto se llama con `Authorization: Bearer <session_token>`. **Todas las rutas de `/api/*` son POST**: el Worker responde 405 a cualquier otro método, y los datos van en el cuerpo JSON. El dinero se confirma solo por `POST /api/confirm`.

**5.2 Nuevo, carril de David**

- `POST /api/pending` devuelve `data.items` con `service_ref`, `name`, `account_number`, `amount_minor` y `due_date`. Trae las cuentas registradas del usuario demo, para que Wisi no tenga que pedir el número de contrato, y deja fuera lo que ya se pagó en ese monedero. Wisi la usa como la herramienta `list_pending`.
- `POST /api/movements` devuelve `data.items` con `operation_ref`, `kind`, `title`, `amount_minor` y `created_at`, a partir de las operaciones guardadas en el monedero.
- `app.html` toma el principal de `?pid=` si viene en la URL, lo guarda y lo quita de la barra de direcciones (`history.replaceState`) para que no se vea en la pantalla del demo. La app Flutter hace lo mismo.

**5.3 Nuevo, carril de Andrés**

- `POST /api/credit/status` devuelve `tier`, `level`, `limit_minor`, `used_minor`, `available_minor` y `next_installment`.
- `POST /api/credit/quote` recibe `amount_minor` y `vertical`, y devuelve `eligible`, `reason`, las cuotas con fecha y monto, y `total_minor`. No guarda nada.
- `POST /api/credit/prepare` recibe `service_ref`, `account_number` e `installments`. Devuelve lo mismo que `prepare_payment`: `requires_confirmation`, el `intent_id` y un resumen con las cuotas. El motor decide al confirmar y guarda el motivo.
- `POST /api/approval-proof` pasa a pedir `{intent_id, pin}` en el cuerpo. Sin un PIN válido no hay prueba.
  - El PIN sale del secreto `WISIVOZ_DEMO_PIN` del Worker, nunca del repo. Tiene 6 dígitos. No hay ningún endpoint para crearlo ni cambiarlo.
  - **Falla cerrado:** si el secreto falta o no tiene 6 dígitos, `pin.ts` rechaza todo, incluso un `pin` vacío. Una prueba lo cubre.
  - **Nunca va en la URL.** El Worker tiene la observabilidad de Cloudflare encendida, que registra las URL de cada petición. El PIN viaja solo en el cuerpo, y nadie escribe el cuerpo con `console.log`.
  - Se compara en tiempo constante, con el `safeEqual` que ya existe.
  - Los intentos se cuentan **por principal** y se guardan en su Durable Object, no por intención: si no, cada intención nueva reinicia el contador. Al tercer error, ese principal queda bloqueado 15 minutos. Revisar el bloqueo, comparar el PIN y sumar el intento pasa en **un solo método** del `Wallet`: si se hace en dos llamadas, varias peticiones a la vez se saltan el límite.
  - Solo se emite la prueba del factor `pin`, y `confirm_and_execute` deja de aceptar `biometric` y `otp`. Si no, cualquiera pide una prueba de "huella" y se salta el PIN.
  - El PIN nunca pasa por el agente ni por ElevenLabs: solo viaja de la hoja de confirmación al Worker. Ninguna herramienta lo recibe.
- La decisión de crédito corre dentro de `confirm_and_execute`. No es una herramienta ni un endpoint, así que nadie la puede llamar directo.

**Errores.** Siguen el formato del gateway: `status` en `denied` o `error`, y un `error.code`. Ya existen `insufficient_funds`, `intent_expired`, `intent_not_found`, `invalid_approval`, `service_not_found` y `foundation_not_found`. Se suman `pin_invalid` (con los intentos que quedan), `pin_locked`, `credit_rejected` (con `error.reason`) y `credit_over_limit`.

Ejemplo de `POST /api/credit/quote` para el condominio:

```json
{
  "request_id": "req_…",
  "status": "ok",
  "data": {
    "eligible": true,
    "reason": "El monto cabe en tu línea de Bs. 1.500,00",
    "installments": [
      { "n": 1, "due_date": "2026-11-07", "amount_minor": 60000 },
      { "n": 2, "due_date": "2026-11-14", "amount_minor": 60000 }
    ],
    "total_minor": 120000
  },
  "speech": "Puedes pagarlo en 2 cuotas de Bs 600,00, el 7 y el 14 de noviembre."
}
```

Y un rechazo:

```json
{
  "request_id": "req_…",
  "status": "denied",
  "error": { "code": "credit_rejected", "reason": "Tienes una cuota vencida" },
  "speech": "Ahora no puedo darte Credirecto porque tienes una cuota vencida. ¿Quieres hablar con una persona?"
}
```

**Reglas del motor para el demo**, escritas para poder explicar cada decisión:

- Nivel Turista: línea de Bs. 1.500,00 en el piso 1, solo para servicios y estacionamiento, con un máximo de 2 cuotas a 7 y 14 días, sin interés en el demo.
- Rechaza si hay una cuota vencida o si el monto pasa lo disponible.
- Cada decisión guarda su motivo en texto, por ejemplo «Aprobado: el monto cabe en tu línea de Bs. 1.500,00».

## 6. Seguridad: lo que hay que cerrar hoy

El repo es público, así que todo lo que diga el código lo puede leer cualquiera.

| Hueco | Dónde | Qué pasa | Arreglo |
| --- | --- | --- | --- |
| El PIN no se verifica, para ningún factor | `/api/approval-proof` en `worker/src/index.ts` | Cualquier cliente con sesión obtiene la prueba y confirma pagos sin PIN | Sección 5.3 (P0, Andrés) |
| El Worker firma con un secreto por defecto si le falta el suyo | `sign()` en `worker/src/index.ts`, que usa `"dev-secret-change-me"` cuando no hay `WISIVOZ_SESSION_SECRET` | Si el secreto no está cargado, cualquiera firma sesiones y pruebas de aprobación | David: confirmar con `npx wrangler secret list`, que muestra los nombres sin los valores, y hacer que `sign()` falle si falta el secreto, salvo en `localhost` |
| Lo mismo en Python | `backend/app/config.py`: `dev-secret-change-me` y `dev-tool-secret` | Solo importa si se publica el gateway de Python (opción B) | No publicarlo sin definir `WISIVOZ_SESSION_SECRET` y `WISIVOZ_TOOL_SECRET` |
| Créditos de ElevenLabs expuestos | `/api/session` da una URL firmada de ElevenLabs a quien la pida | El Worker limita a 30 URL por IP cada 10 minutos en cada instancia: eso frena, pero no cierra | Después del demo, quitar `ELEVENLABS_API_KEY` del Worker (`npx wrangler secret delete`) |
| Sesión a nombre de cualquiera | `/api/session?principal=…` | Cualquiera pide un token para cualquier principal y opera ese monedero | Para el demo final, un `pid` aleatorio que no se publica ni se proyecta (sección 5.2). Ese `pid` es lo que separa el monedero del demo del resto. Decirlo si el jurado pregunta |
| El PIN es el mismo para todos los principales | `WISIVOZ_DEMO_PIN` | Como los principales son gratis, el bloqueo por principal no frena a quien prueba PINs desde muchos | PIN de 6 dígitos y `pid` del demo secreto: aunque alguien adivine el PIN, no tiene sesión en ese monedero |
| El bloqueo puede tumbar el demo | El bloqueo de 15 minutos por principal | Quien vea el `pid` del demo mete 3 PIN errados, sin necesidad de saber el bueno, y el monedero del demo queda bloqueado | Tener un `pid` de reserva listo para las dos caras. Mostrar el bloqueo en otro `pid`, nunca en el del demo |
| Wisi no dice que es IA ni avisa del PIN | `agent/system_prompt.md`, `greet()` en `app.html` y el saludo de la app | Falta lo que pide el roadmap: transparencia (AI Act, art. 50) y aviso antiestafa | Agregarlo en los tres lugares (P0) |
| Supabase: tres permisos abiertos y tablas sin `grant` | `supabase/schema.sql` | Solo importa si se vuelve a Supabase. La app puede marcar pagos como pagados, cambiarse el nivel y completarse retos. Desde el 30 oct 2026, las tablas nuevas sin `grant` no se exponen a la API ([changelog](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)) | Si se vuelve: `payments` y `user_club_tasks` solo de lectura; en `profiles`, `revoke update` y `grant update (username, avatar_url)` a `authenticated`; y un `grant select` por tabla |

## 7. Orden del día (ajustarlo a la hora de entrega)

Ya está hecho: el PR de `david/dev` a `main` (12:14) y el gateway con HTTPS (`botflow.lat`).

| Bloque | Qué | Listo cuando |
| --- | --- | --- |
| T+0:00 a 0:15 | La decisión de la sección 2 y quién lleva cada carril | Los tres están de acuerdo |
| T+0:15 a 0:45 | Unir el Worker a `main`, Node 22 y `wrangler` en la máquina de Andrés, y los contratos 5.2 y 5.3 escritos | Los tres trabajan sobre el mismo `main` |
| T+0:45 a 2:00 | P0 de cada carril. Andrés termina el PIN y sigue con el crédito | La app muestra el saldo del Worker |
| T+2:00 | **Punto de control** de la sección 2 | Se sigue con la opción 1 o se pasa a la opción 2 |
| T+2:00 a 3:30 | Integración: un pago por chat y por voz con el PIN verificado | El guion P0 funciona de punta a punta |
| T+3:30 a 5:00 | P1: el crédito y la escalada | El crédito sale en el guion |
| Última hora | Congelar, ensayar y grabar el plan B | Hay un video del guion y la app publicada |

Cómo sincronizar: cada quien en su rama y PRs pequeños a `main` más o menos cada hora, como pide el `CLAUDE.md` de David. `git pull --rebase` antes de cada push. Quien rompe `main` lo arregla antes de seguir. Solo David despliega el Worker: lo hace después de cada unión a `main` y avisa en el chat.

## 8. Guion del demo (3 minutos)

Los montos salen de `worker/src/fixtures.ts`, espejo de `backend/app/fixtures.py`: saldo de Bs. 2.500,00, Movistar Bs. 320,00 y Condominio Bs. 1.200,00.

El **guion P0** son los pasos 1, 2, 3, 4 y 6, más un «cancelar» y la frase del cierre. Tiene que funcionar a las T+3:30. Los pasos 5 y 7 entran cuando llegue el P1.

Los pasos 3 a 6 se hacen sin salir de la pestaña de Wisi: la webapp corta la voz cuando la pestaña se oculta (`visibilitychange` en `app.html`), y la conversación nueva no recuerda la anterior. Se vuelve a la app solo al final.

1. Se abre la app publicada con el `pid` del demo y se ve el saldo del Worker.
2. Se toca a Wisi, que abre la webapp con el mismo `pid`: «Hola, soy Wisi, el asistente con IA de Pago Directo. Nunca te pediré tu PIN ni te llamaré».
3. Por voz: «¿Qué tengo pendiente?». Wisi lista los servicios con su monto.
4. «Paga el Movistar»: Wisi lee el resumen, sale la hoja de confirmación, se pone el PIN y sale "Listo". El saldo baja a Bs. 2.180,00.
5. «Paga el condominio con Credirecto»: Wisi ofrece 2 cuotas de Bs. 600,00 con sus fechas y el total. Se pone el PIN y el motor aprueba y dice por qué. El saldo no cambia: baja lo disponible de la línea.
6. «Me cobraron mal»: Wisi abre un caso de soporte con su número.
7. Se vuelve a la app, que muestra Bs. 2.180,00. Cierre: la frase de la sección 0, y Viajes como muestra de los pisos 2 y 3 del roadmap (turismo, carro y casa).

Ensayar también lo que el jurado puede probar: un PIN errado, decir "no" en la confirmación, "cancelar" a mitad de un flujo y pedir algo que no existe. El bloqueo al tercer PIN errado se muestra en otro `pid`, no en el del demo.

**Antes de presentar**, abrir las dos caras con un `pid` nuevo y aleatorio, y tener otro igual de reserva por si el primero se bloquea. Ese monedero empieza en Bs. 2.500,00, con los pendientes completos y el PIN sin bloqueo, y los ensayos quedan en sus propios monederos. Por eso ya no hace falta un endpoint de reinicio.

## 9. Riesgos de hoy

| Riesgo | Cómo se ve | Qué hacer |
| --- | --- | --- |
| Node o `wrangler` en la máquina de Andrés | `npx wrangler dev` falla | Node 22, como en la guía de David (`fnm use 22`), y `npm install` dentro de `worker/` |
| Flutter viejo | `flutter pub get` falla porque el pubspec pide Dart ^3.13.7. Pasa en la máquina de Andrés (Flutter 3.41.5) | Ya no frena el P0 de Andrés, que es TypeScript. Para las pantallas de P1: `flutter upgrade` en el canal stable, que instala la 3.47.9 con el mismo Dart 3.13.7 que la 3.47.8 de Vercel |
| Dos gateways que se separan | El de Python y el Worker dejan de coincidir | Hoy solo cuenta el Worker. El de Python se congela, y deja de servir como respaldo cuando entre el PIN: comparte `app.html` con el Worker y espera el `intent_id` en la URL, así que con la hoja nueva no confirma nada. El respaldo real es el video |
| Una sola persona despliega | Solo David tiene el token de Cloudflare | PRs pequeños a `main`, y David despliega después de cada unión |
| Choques en `index.ts` y `app.html` | David y Andrés editan el mismo archivo | Avisar antes y un solo PR abierto por archivo (sección 4) |
| Los ensayos gastan el saldo | El monedero persiste y el demo arranca con menos de Bs. 2.500,00 | Un `pid` nuevo antes de presentar |
| `botflow.lat` no carga en un teléfono | Ese teléfono consultó el dominio antes de que existiera y guardó la respuesta vacía | Usar `https://wisi-botflow.david-a6c.workers.dev` |
| Wi-Fi del lugar o ruido para la voz | La voz no entiende o no carga | El chat de la webapp y el video grabado |
| Fricción en el equipo por pausar Gemini | La discusión se come la tarde | Decidir en 15 minutos con el punto de control. Lo que se pausa queda para la fase 1 |

## 10. Lo que el demo no es

El saldo y el crédito son simulados: no hay dinero real, ni KYC, ni revisión legal. Decirlo en el pitch evita la pregunta incómoda del jurado. El siguiente paso real es la fase 1 del roadmap.
