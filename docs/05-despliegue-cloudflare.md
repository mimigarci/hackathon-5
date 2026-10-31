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

## Notas
- **Créditos de ElevenLabs**: límite de sesiones de voz por IP (`WISIVOZ_SIGNED_PER_IP_10MIN`,
  30 por defecto; best-effort por instancia). Al superarlo, la webapp sigue en modo chat.
- Cada móvil tiene su propio saldo demo (id aleatorio en `localStorage`).
- Registros `api` y `n8n` → 207.180.250.207 (proxied) no los toca este despliegue.
