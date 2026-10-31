# hackathon-5

## Flujo de trabajo
- Rama de trabajo de David: `david/dev`. `main` es de mimigarci: no hacer push directo a `main`.
- Cambios a `main` solo vía Pull Request desde `david/dev`.
- Commits pequeños y con mensaje descriptivo.
- Secretos solo en `.env` (ignorado por git). Documentar variables nuevas en `.env.example`.

## Entorno local
- Node v18 (antiguo; npm 12 avisa de incompatibilidad). Si el stack es JS, preferir Node 22+ (nvm/fnm).
- Python 3.12 + `uv` disponibles. Docker disponible.
- Stack del proyecto: por definir. Actualizar esta sección al decidirlo (comandos de instalar, ejecutar y testear).
