# REA aplicado a Grok Bot (agente autónomo de xAI)

Análisis con **REA** + inspección directa de la instalación local de Grok Bot
(`~/.grok`, `~/.config/Grok Bot`, `/opt/Grok Bot`). Objetivo: entender cómo está
construido un agente autónomo maduro para informar cómo escalamos a Wisi.

> Privacidad: se analizó el **mecanismo** (binario, esquema del historial,
> arquitectura de config/plugins). **No** se volcó el contenido de las sesiones
> privadas de David (proyectos, conversaciones).

## Qué es
Grok Bot es el agente de codificación/automatización de **xAI**, equivalente a
Claude Code: una **CLI/TUI + app de escritorio Electron**. Versión analizada
**1.0.70** (2026-10). Se distribuye como binario único `grok-*-linux-x86_64`
(ELF static-pie, ~187 MB, stripped, con Build ID) que reusa el runtime de Electron
como Node (`ELECTRON_RUN_AS_NODE`). La app de escritorio: `/opt/Grok Bot/grok-bot`,
con handlers de esquema `grokbot://` y `sand://`.

### Herramientas usadas / límites de REA (reproducible)
- `rea inspect-sqlite-database` → requiere **Node 24.15+** (lo instalé con fnm).
  Dio el esquema del historial sin ejecutar el binario.
- `rea inspect-binary-layout` / `inspect-elf-notes` → requieren
  `REA_PWNTOOLS_PYTHON` (pyelftools/pwntools/unicorn). Para un static-pie
  *stripped* aportan poco sin Ghidra/IDA; se complementó con `readelf` y `strings`.
- Node 22 para el resto de REA; `fnm use 24` para SQLite.

## Arquitectura del agente (lo valioso)
De `~/.grok/`:

| Pieza | Qué es | Paralelo para Wisi |
|---|---|---|
| `bundled/agents` | subagentes: explore, general-purpose, plan | tipos de subagente (p.ej. "lector de QR", "resolución de incidencias") |
| `bundled/personas` (TOML) | implementer, researcher, reviewer, security-auditor, test-writer… | **voces/personalidades** de Wisi (Carito/Antonio) como personas |
| `bundled/roles` (TOML) | explore, plan, quick-search, reviewer… | roles de atención (pagador, soporte, cobros) |
| `bundled/skills` | code-review, create-skill, pdf, pptx, imagine, implement, learn, pr-babysit, game-* | **una skill por capacidad**: pagar-servicio, pagar-parking, donar, enviar |
| `bundled/workflows` (`.rhai`) | deep-research, learn-traces (lenguaje Rhai) | flujos multi-paso: preparar→confirmar→verificar |
| `memory-v2/{global,workspaces}` | memoria global + por workspace | memoria por usuario (pagos frecuentes, destinatarios) |
| `sessions/session_search.sqlite` | historial indexado | historial de conversaciones de atención |
| `installed-plugins` + `marketplace` | marketplace oficial `xai-org/plugin-marketplace` | catálogo de integraciones (nuevos servicios/convenios) |
| `hooks` | hooks sobre eventos | hooks antifraude / auditoría por operación |
| `vendor/rg-15` | ripgrep embebido | búsqueda rápida local |

### Historial: búsqueda de texto completo (REA inspect-sqlite-database)
`session_search.sqlite` (SQLite 3.53, UTF-8) implementa el historial como un
índice **FTS5**:
- `session_docs` (6 columnas) — documentos de sesión.
- `session_docs_fts` (tabla virtual FTS5, 4 cols) + tablas sombra
  (`_data`, `_idx`, `_docsize`, `_config`).
- `meta` (2 cols, clave/valor).

➡️ Patrón directo: indexar las conversaciones de Wisi en FTS5 para que el usuario
(y soporte) busquen "¿cuándo pagué la luz?" en lenguaje natural.

### Config y permisos (`config.toml`)
- `permission_mode = "always-approve"` y `yolo` configurable → Grok asume **baja
  fricción**: el humano aprueba por defecto. Coincide con el objetivo de este
  proyecto (aprobar solo lo extremo).
- `fork_secondary_model = "grok-4.5"` → modelo secundario para forks.
- Modo **headless** con permisos finos: solo lectura, denegar shell por patrón
  (`rm*`), bloquear subagentes, denegar edición fuera de `src/`.
- Auth OAuth/device-code con **auto-refresh** de token (5 min antes de expirar).

## Qué nos llevamos para Wisi (accionable)
1. **Personas = voces.** Formalizar Carito (venezolana, cercana) y Antonio
   (latino, formal) como personas TOML; permitir más (ej. "Wisi soporte").
2. **Skills por capacidad.** Migrar cada tool del gateway a una "skill" con su
   prompt y ejemplos → el agente escala a decenas de servicios sin reescribir el prompt.
3. **Workflows deterministas.** El flujo preparar→confirmar→verificar como un
   workflow (equivale a los `.rhai` de Grok), no como lógica dispersa.
4. **Memoria por usuario.** `global + workspace` → recordar pagos frecuentes y
   destinatarios, reduciendo fricción (pedir menos datos cada vez).
5. **Historial FTS5.** Búsqueda de "mis pagos" en lenguaje natural.
6. **Permisos finos + baja fricción.** Nuestro gateway ya exige confirmación solo
   para dinero; el resto fluye. Es exactamente el `always-approve` de Grok aplicado
   a fintech: aprobar solo lo irreversible.
7. **Marketplace.** Un catálogo de integraciones (nuevos convenios/servicios de
   PagoDirecto) como plugins instalables, no hardcodeados.

## Reproducir
```bash
fnm install 24 && fnm use 24
export REA_PWNTOOLS_PYTHON=/ruta/python-con-pyelftools-pwntools-unicorn
rea inspect-sqlite-database ~/.grok/sessions/session_search.sqlite
readelf -hn ~/.grok/downloads/grok-*-linux-x86_64
cat ~/.grok/config.toml ; ls ~/.grok/bundled/{agents,personas,roles,skills,workflows}
```
