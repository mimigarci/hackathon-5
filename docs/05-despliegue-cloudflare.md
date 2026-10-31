# Despliegue de Wisi en botflow.lat (Cloudflare)

**En producción:** https://botflow.lat (también https://wisi-botflow.david-a6c.workers.dev).
Plan gratuito de Cloudflare, sin servidores.

## Arquitectura (opción A, la desplegada)

```
móvil ──HTTPS──> Cloudflare Worker "wisi-botflow" (worker/)
                   ├─ archivos estáticos: backend/app/static (app.html en /, demo.html en /demo, Lottie)
                   ├─ API /api/*: port en TypeScript del gateway FastAPI (mismo contrato)
                   ├─ Durable Object "Wallet": un monedero demo persistente por usuario
                   └─ ElevenLabs: URL firmada server-side (la API key nunca llega al móvil)
```

- HTTPS obligatorio: `http://` y `www.` redirigen (301) a `https://botflow.lat`.
- Mismo contrato REST que `backend/` → la webapp, `/demo`, la consola React y Flutter funcionan igual.
- Diferencias con FastAPI: el saldo persiste (Durable Object) y `/api/confirm` verifica la prueba
  de aprobación (HMAC del principal + intención). No incluye las webhook tools `/el/tools/*`
  (los agentes usan client tools).
- Coste: 0 € dentro del plan gratuito (100.000 peticiones/día).

## Desplegar cambios

```bash
cd worker && fnm use 22 && npm install
set -a; . ../backend/.env; set +a      # CLOUDFLARE_API_TOKEN y CLOUDFLARE_ACCOUNT_ID
npx wrangler deploy
```

Los cambios en `backend/app/static/` (la webapp) se publican con el mismo comando.

Desarrollo local: `npx wrangler dev` (usa `worker/.dev.vars`, ignorado por git, con los
mismos nombres que los secretos).

### Secretos del Worker (no van al repo)
`ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, `ELEVENLABS_AGENT_ID_FEMALE`,
`ELEVENLABS_AGENT_ID_MALE`, `WISIVOZ_SESSION_SECRET`. Se cargan con
`npx wrangler secret bulk secretos.json` (borra el JSON después).

### Token de API
Token de cuenta con acceso a Workers (scripts, rutas y dominios propios) sobre la zona
`botflow.lat`, guardado en `backend/.env`. No tiene permiso de DNS ni de Zone Settings (no hacen
falta: el dominio propio del Worker crea su DNS y el Worker fuerza HTTPS).

## Opción B: túnel a un servidor propio

Para correr el gateway FastAPI (p. ej. en el VPS) en lugar del Worker:
`deploy/docker-compose.yml` (gateway + `cloudflared`) y `deploy/cloudflare_setup.py`
(crea el túnel y el DNS; requiere permisos Cloudflare Tunnel: Edit y DNS: Edit). Antes, quitar
los dominios propios del Worker para liberar `botflow.lat`.

## Monitorización
`.github/workflows/uptime.yml` comprueba cada 30 min desde GitHub: DNS IPv4, `/health`, la webapp,
un asset Lottie, la redirección a HTTPS, la API y que la voz (ElevenLabs) esté disponible. Si falla,
GitHub envía un email. Los workflows programados solo corren desde `main` (se activa al fusionar el PR);
también se puede lanzar a mano (*Run workflow*).

## Si "no carga" en un dispositivo concreto
Si un dispositivo consultó `botflow.lat` antes de que existiera el registro, su DNS guarda la
respuesta negativa hasta 30 min (TTL mínimo del SOA). Se arregla solo; para forzarlo, vaciar la
caché DNS (en un equipo con Tailscale: `sudo systemctl restart tailscaled`) o activar y desactivar el
modo avión en el móvil. Comprobación: `dig +short A botflow.lat @1.1.1.1`.

## Notas
- **Créditos de ElevenLabs**: límite de sesiones de voz por IP (`WISIVOZ_SIGNED_PER_IP_10MIN`,
  30 por defecto; best-effort por instancia). Al superarlo, la webapp sigue en modo chat.
- Cada móvil tiene su propio saldo demo (id aleatorio en `localStorage`).
- Registros `api` y `n8n` → 207.180.250.207 (proxied) no los toca este despliegue.

## Supabase

El Worker replica cuentas y movimientos en Supabase (`SUPABASE_URL` y
`SUPABASE_PUBLISHABLE_KEY` en `wrangler.jsonc`; la clave publicable no es secreta). El saldo
sigue moviéndose en el Durable Object: Supabase es una copia para consultar, y si falla
no afecta a los pagos.

1. Ejecuta `supabase/migrations/002_wisi_web.sql` en Supabase > SQL Editor.
2. Comprueba: `curl https://botflow.lat/health?deep=1` debe decir `"supabase":"conectada"`.

`wisi_sync` no pide clave: quien tenga la publicable puede añadir filas falsas a esta
copia, aunque no leerlas ni tocar el saldo. Si los datos pasan a importar, usar una clave
de servidor.

