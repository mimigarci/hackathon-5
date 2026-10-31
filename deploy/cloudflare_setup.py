"""Configura botflow.lat en Cloudflare para servir la webapp de Wisi.

Idempotente: se puede ejecutar varias veces. Hace lo siguiente:
1. Busca la zona (el dominio ya debe estar añadido a Cloudflare y con los
   nameservers de Cloudflare puestos en Namecheap).
2. Crea (o reutiliza) un Cloudflare Tunnel gestionado de forma remota.
3. Publica botflow.lat y www.botflow.lat -> http://gateway:8000 (contenedor).
4. Crea los CNAME proxied hacia el túnel.
5. Fuerza HTTPS y TLS >= 1.2.
6. Guarda CLOUDFLARE_TUNNEL_TOKEN en backend/.env para docker compose.

Lee CLOUDFLARE_API_TOKEN y CLOUDFLARE_ACCOUNT_ID de backend/.env.

Uso:
    cd backend && uv run python ../deploy/cloudflare_setup.py [--service http://gateway:8000]
"""
from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

import httpx
from dotenv import load_dotenv

ENV = Path(__file__).resolve().parent.parent / "backend" / ".env"
API = "https://api.cloudflare.com/client/v4"
DOMAIN = "botflow.lat"
HOSTS = [DOMAIN, f"www.{DOMAIN}"]
TUNNEL_NAME = "wisi-botflow"


def cf(client: httpx.Client, method: str, path: str, **kw) -> dict | list:
    r = client.request(method, f"{API}{path}", **kw)
    body = r.json()
    if not body.get("success"):
        sys.exit(f"Cloudflare {method} {path} -> {r.status_code}: {body.get('errors')}")
    return body["result"]


def save_env(key: str, value: str) -> None:
    text = ENV.read_text() if ENV.exists() else ""
    line = f"{key}={value}"
    if re.search(rf"^{key}=.*$", text, flags=re.M):
        text = re.sub(rf"^{key}=.*$", line, text, flags=re.M)
    else:
        text = text.rstrip("\n") + f"\n{line}\n"
    ENV.write_text(text)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--service", default="http://gateway:8000",
                    help="Origen al que apunta el túnel (http://localhost:8000 si cloudflared corre fuera de Docker)")
    args = ap.parse_args()

    load_dotenv(ENV)
    token, account = os.getenv("CLOUDFLARE_API_TOKEN"), os.getenv("CLOUDFLARE_ACCOUNT_ID")
    if not (token and account):
        sys.exit("Faltan CLOUDFLARE_API_TOKEN y/o CLOUDFLARE_ACCOUNT_ID en backend/.env")

    with httpx.Client(headers={"Authorization": f"Bearer {token}"}, timeout=20) as c:
        zones = cf(c, "GET", "/zones", params={"name": DOMAIN})
        if not zones:
            sys.exit(f"{DOMAIN} no está en esta cuenta de Cloudflare. Añádelo primero.")
        zone = zones[0]
        print(f"zona {DOMAIN}: {zone['status']} (nameservers: {', '.join(zone.get('name_servers', []))})")
        if zone["status"] != "active":
            print("  ! Aún no activa: pon esos nameservers en Namecheap (Domain > Nameservers > Custom DNS).")

        found = cf(c, "GET", f"/accounts/{account}/cfd_tunnel",
                   params={"name": TUNNEL_NAME, "is_deleted": "false"})
        if found:
            tunnel = found[0]
            print(f"túnel existente: {tunnel['id']}")
        else:
            tunnel = cf(c, "POST", f"/accounts/{account}/cfd_tunnel",
                        json={"name": TUNNEL_NAME, "config_src": "cloudflare"})
            print(f"túnel creado: {tunnel['id']}")
        tid = tunnel["id"]

        ingress = [{"hostname": h, "service": args.service} for h in HOSTS]
        ingress.append({"service": "http_status:404"})
        cf(c, "PUT", f"/accounts/{account}/cfd_tunnel/{tid}/configurations",
           json={"config": {"ingress": ingress}})
        print(f"ingress: {', '.join(HOSTS)} -> {args.service}")

        target = f"{tid}.cfargotunnel.com"
        for host in HOSTS:
            rec = {"type": "CNAME", "name": host, "content": target, "proxied": True,
                   "comment": "Wisi webapp (Cloudflare Tunnel)"}
            existing = cf(c, "GET", f"/zones/{zone['id']}/dns_records", params={"name": host})
            clash = [r for r in existing if r["type"] in ("A", "AAAA", "CNAME")]
            if clash:
                cf(c, "PUT", f"/zones/{zone['id']}/dns_records/{clash[0]['id']}", json=rec)
                print(f"dns {host}: actualizado -> {target}")
            else:
                cf(c, "POST", f"/zones/{zone['id']}/dns_records", json=rec)
                print(f"dns {host}: creado -> {target}")

        for setting, value in (("always_use_https", "on"), ("min_tls_version", "1.2")):
            cf(c, "PATCH", f"/zones/{zone['id']}/settings/{setting}", json={"value": value})
        print("https forzado, TLS >= 1.2")

        tunnel_token = cf(c, "GET", f"/accounts/{account}/cfd_tunnel/{tid}/token")
        save_env("CLOUDFLARE_TUNNEL_TOKEN", tunnel_token)
        print(f"CLOUDFLARE_TUNNEL_TOKEN guardado en {ENV}")

    print("\nSiguiente paso (desde la raíz del repo):")
    print("  docker compose -f deploy/docker-compose.yml --env-file backend/.env up -d --build")


if __name__ == "__main__":
    main()
