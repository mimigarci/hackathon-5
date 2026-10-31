# hackathon-5 · Wisi, asistente IA dentro de PagoDirecto

Asistente de IA **dentro de la app PagoDirecto** que atiende al usuario por voz y
chat y ejecuta las funciones de la app (pagar servicios, estacionamiento, donar,
enviar fondos), en lugar del salto actual del avatar **Wisi** a WhatsApp.

**Demo en producción: https://botflow.lat** (réplica navegable de la app con Wisi
integrado, voz real con ElevenLabs).

Principio de seguridad común a todo el repo: **el modelo nunca mueve dinero**. Las
tools solo *preparan* una intención con vigencia; el paso final siempre pasa por
confirmación del usuario (biometría/PIN) y por checks server-side.

---

## Qué hay en el repo

| Carpeta | Qué es | Stack | Estado |
|---|---|---|---|
| `backend/` | Gateway WisiVoz: contrato REST de tools, ledger simulado, flujo intención → confirmación. Sirve la webapp (`backend/app/static`) | Python 3.12 · FastAPI · `uv` | Funciona, con tests |
| `backend/app/static/` | Webapp móvil: réplica de PagoDirecto (Inicio, Movimientos, Mis pagos, Menú, Estacionamiento, Servicios, Donaciones, Enviar) con Wisi integrado | HTML · CSS · JS | En producción (`/`); la versión anterior sigue en `/demo` |
| `worker/` | Port del gateway a Cloudflare Workers (mismo contrato) que sirve la webapp en botflow.lat; monedero persistente por usuario en un Durable Object | TypeScript · Wrangler | En producción |
| `agent/` | Agentes de ElevenLabs Conversational AI (voces es-VE Clari y Miguel), prompt de sistema y aprovisionamiento | JSON · Python | Funciona |
| `app/` | App Flutter de PagoDirecto sobre datos mock: Home, Movimientos, Mis pagos, Menú y las Funciones de Home con sus flujos REA | Flutter · Dart | Funciona; el chat del asistente es un stub |
| `flutter/wisi_voz/` | Paquete Flutter que sustituye el handoff a WhatsApp por la hoja de voz/chat de Wisi | Flutter · Dart | Prototipo ([README](flutter/wisi_voz/README.md)) |
| `web/` | Consola demo del agente con el SDK de ElevenLabs | React · TypeScript · Vite | Demo |
| `supabase/` | Esquema SQL, RLS y seed; migración del login | Postgres | Sin uso hoy (la app usa mock) |
| `deploy/` | Alternativa con Cloudflare Tunnel + Docker Compose | Python · Docker | Alternativa |
| `docs/` | Ingeniería inversa (REA), arquitectura, decisiones, despliegue y diseño | Markdown | — |

---

## Webapp de Wisi + gateway (local)

Requiere `ELEVENLABS_API_KEY` en `backend/.env` (copia de [`.env.example`](.env.example)).
Sin la clave, la webapp funciona en modo chat/tools pero sin voz.

```bash
cd backend
uv venv && uv pip install -e . && uv pip install pytest httpx
uv run pytest -q
uv run uvicorn app.main:app --port 8000
```

- http://localhost:8000/ — webapp móvil (réplica de la app + Wisi por voz y chat)
- http://localhost:8000/demo — webapp anterior
- http://localhost:8000/docs — contrato REST (OpenAPI)

Crear o actualizar los agentes de ElevenLabs (escribe los IDs en `backend/.env`):

```bash
cd backend && uv run python ../agent/provision_client_tools.py
```

```bash
cd backend && uv run python ../agent/provision_client_tools.py --update
```

### Qué hace Wisi

- Consulta saldo y movimientos (saldo demo de Bs 5.000).
- Lista y explica servicios; prepara pagos de servicios, estacionamiento,
  donaciones y envíos de fondos.
- **Controla la app**: abre la pantalla correspondiente ya rellenada, escanea el
  QR del ticket de estacionamiento con la cámara y se minimiza a una isla dinámica
  mientras el usuario revisa.
- Pide el permiso del micrófono al despertar y explica cómo activarlo si está bloqueado.
- La confirmación final es una hoja biométrica/PIN → `POST /api/confirm`, con
  idempotencia y autorización server-side.

### Despliegue en botflow.lat

Cloudflare Workers, plan gratuito. El Worker sirve `backend/app/static` y el mismo
contrato `/api/*`; las claves de ElevenLabs viven como secrets del Worker.

```bash
cd worker && npm install && npx wrangler deploy
```

Detalles, secretos y la alternativa con túnel: [docs/05-despliegue-cloudflare.md](docs/05-despliegue-cloudflare.md).
Un workflow de GitHub ([`uptime.yml`](.github/workflows/uptime.yml)) comprueba
cada 30 min la webapp, la API y la voz.

---

## App Flutter (`app/`)

```bash
cd app
flutter pub get
flutter run
flutter test
```

- **Login**: la pantalla de bienvenida tiene un único botón **Ingresar** que abre la
  app con `MockRepository`; "Cerrar sesión" en el Menú vuelve a ella. No hay inicio
  de sesión real ni conexión a Supabase.
- **Datos**: mock en `lib/data/mock_data.dart`, vacíos por defecto; pon
  `MockData.showSampleData = true` para ver listas con datos.
- **Funciones de Home**: Servicios (14 proveedores con sus formularios),
  Estacionamiento (ticket QR/manual, ubicaciones, vehículos), Parquímetros y Seguros
  siguen los flujos observados en [docs/rea-home](docs/rea-home/README.md). Las
  acciones con efecto muestran una revisión que aclara que el proveedor no está
  conectado; no se cobra nada. Boletería y Donaciones aún no tienen formulario.
- **Asistente**: la mascota abre un chat cuya respuesta es un stub
  (`lib/data/assistant_service.dart`). El diseño previsto (Gemini + Edge Functions,
  "Ver en la app") está en [docs/06-diseno-asistente-app.md](docs/06-diseno-asistente-app.md).
- **Nunca** pongas en la app claves de service_role, Gemini o ElevenLabs.

### Despliegue web (Vercel)

`app/vercel.json` instala Flutter (fijado a 3.47.8) y ejecuta `flutter build web`.
En Vercel: **Add New → Project**, importa el repo con **Root Directory = `app`** y
preset "Other". Alternativa manual:

```bash
cd app && flutter build web --release && npx vercel deploy build/web --prod
```

### Dónde está cada cosa

| Ruta (`app/lib/`) | Qué |
|---|---|
| `screens/main_shell.dart` | Barra inferior + mascota (ánimo por pestaña, duerme en reposo) |
| `screens/home_screen.dart` | Wallets, Club, Mis pagos, Funciones, Sugerencias |
| `screens/functions_router.dart` | Lleva cada tarjeta de Funciones a su flujo |
| `screens/services/`, `screens/parking/` | Flujos de Servicios y Estacionamiento |
| `screens/meters_screen.dart`, `screens/insurance_screen.dart` | Parquímetros y Seguros |
| `screens/movements_screen.dart` | Movimientos con filtros Todos/Ingresos/Egresos y periodo |
| `screens/payments_screen.dart` | Mis pagos: Pendientes / Programados / Pagados |
| `screens/assistant_screen.dart` | Chat abierto desde la mascota |
| `data/catalog.dart` | Catálogo de proveedores y montos de ejemplo |
| `data/repository.dart` | Interfaz de datos + implementación mock |
| `data/supabase_repository.dart` | Implementación Supabase (sin uso hasta que vuelva el login) |

---

## Documentación

| Documento | Contenido |
|---|---|
| [01-mapa-rea-app](docs/01-mapa-rea-app.md) | Mapa de la app PagoDirecto (Flutter, backend, feature → tool) |
| [02-arquitectura](docs/02-arquitectura.md), [03-decision](docs/03-decision.md) | Arquitectura y decisión técnica |
| [04-rea-grok](docs/04-rea-grok.md) | Análisis de Grok Bot (xAI) y patrones reutilizables |
| [05-despliegue-cloudflare](docs/05-despliegue-cloudflare.md) | Despliegue en botflow.lat |
| [06-diseno-asistente-app](docs/06-diseno-asistente-app.md) | Diseño (pendiente) del asistente en la app Flutter |
| [rea-home](docs/rea-home/README.md) | Auditoría de las Funciones de Home: inputs observados y brechas |
| [ecosistema de crédito](docs/pago-directo-ecosistema-credito-wisi.md) | Ecosistema de crédito y hoja de ruta de Wisi |

---

## Flujo de trabajo

- Trabajo en `david/dev`; a `main` solo por Pull Request.
- Secretos solo en `.env` (ignorado por git); variables nuevas documentadas en `.env.example`.
