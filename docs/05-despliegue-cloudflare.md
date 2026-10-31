# Despliegue de Wisi en botflow.lat (Cloudflare)

Objetivo: `https://botflow.lat` sirve la webapp móvil de Wisi (`backend/app/static/app.html`)
y el gateway WisiVoz, con HTTPS (imprescindible: el micrófono del móvil solo funciona en HTTPS).

## Arquitectura

```
móvil ──HTTPS──> Cloudflare (DNS + proxy + TLS) ──Tunnel──> cloudflared ──> gateway:8000 (FastAPI)
```

- **Cloudflare Tunnel**: el servidor no abre puertos ni necesita IP pública ni certificados.
  Funciona igual en un VPS o en un portátil.
- **docker compose** (`deploy/docker-compose.yml`): contenedor `gateway` + contenedor `tunnel`.
- El registro `api.botflow.lat` existente no se toca.

## Pasos

### 1. Pasar el dominio a Cloudflare (lo hace David, una vez)
1. dash.cloudflare.com → **Add a domain** → `botflow.lat` → plan **Free**.
   Cloudflare importa los registros actuales (incluido `api` → 207.180.250.207).
2. Cloudflare muestra 2 nameservers (`xxx.ns.cloudflare.com`).
3. Namecheap → Domain List → botflow.lat → pestaña **Domain** → **Nameservers** →
   **Custom DNS** → pegar los 2 nameservers → guardar. Propaga en minutos (hasta 24 h).

### 2. Token de API (lo crea David)
dash.cloudflare.com → My Profile → **API Tokens** → Create Token → *Custom token*:

| Tipo | Permiso | Nivel |
|---|---|---|
| Account | Cloudflare Tunnel | Edit |
| Zone | DNS | Edit |
| Zone | Zone Settings | Edit |
| Zone | Zone | Read |

Zone Resources: *Include → Specific zone → botflow.lat*. Copiar el token y el **Account ID**
(barra lateral de la página Overview del dominio) en `backend/.env`:

```
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_ACCOUNT_ID=...
```

### 3. Túnel, DNS y HTTPS (automático)
```bash
cd backend && uv run python ../deploy/cloudflare_setup.py
```
Crea el túnel `wisi-botflow`, apunta `botflow.lat` y `www.botflow.lat` al gateway, fuerza HTTPS
y guarda `CLOUDFLARE_TUNNEL_TOKEN` en `backend/.env`. Es idempotente.

### 4. Arrancar
```bash
docker compose -f deploy/docker-compose.yml --env-file backend/.env up -d --build
```

Sin Docker (p. ej. en el portátil con el gateway ya corriendo en :8000):
```bash
cd backend && uv run python ../deploy/cloudflare_setup.py --service http://localhost:8000
cloudflared tunnel --no-autoupdate run --token "$CLOUDFLARE_TUNNEL_TOKEN"
```

## Notas de producción
- **Créditos de ElevenLabs**: `/api/session` limita las sesiones de voz por IP
  (`WISIVOZ_SIGNED_PER_IP_10MIN`, 30 por defecto). Al superarlo, la webapp sigue en modo chat local.
- **Ledger simulado en memoria**: un solo worker; reiniciar el contenedor resetea saldos.
  Cada móvil tiene su propio saldo demo (id aleatorio en `localStorage`).
- **Secretos**: cambiar `WISIVOZ_SESSION_SECRET` y `WISIVOZ_TOOL_SECRET` antes de publicar.
- Rutas: `/` webapp nueva · `/demo` webapp anterior · `/health` estado.
