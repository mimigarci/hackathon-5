# Mapa de la app PagoDirecto (ingeniería inversa con REA)

Obtenido con **REA** (`rea-agents` 6.8.0, Node 22) sobre el APK extraído del
emulador por ADB. Análisis **estático** (sin ejecutar ni tocar el backend real).

- Paquete: `com.paytech.pagodirecto` · versión **5.3.2** (build 231) · minSdk 30, targetSdk 36
- **Tecnología: Flutter** (confirmado). Snapshot Dart `97ff04a7…`, engine
  `b9c6ae49…`. Paquete de la app: `pdflutterv2`.
- Comando base usado: `rea identify-flutter-build` + `rea inspect-dart-aot` +
  lectura del pool de strings de `libapp.so`.

## Dependencias clave (lo que la app ya sabe hacer)
| Librería | Para qué |
|---|---|
| `dio`, `http` | Llamadas REST al backend |
| `mobile_scanner` | Escaneo de QR (ticket de estacionamiento, cobros) |
| `firebase_auth`, `passkeys`, `cryptography`, `crypto` | Autenticación y biometría |
| `flutter_bloc` | Gestión de estado (bloc/cubit) |
| `google_maps_flutter` | Mapas (parquímetros, peajes) |
| `amplitude_flutter`, `firebase_analytics` | Analítica |
| `audioplayers` | Audio |

## Wisi ya existe (hoy solo abre WhatsApp)
Hallazgo central: **Wisi es un avatar animado ya presente en la app**, pero su
único trabajo es derivar a WhatsApp.
- Animaciones: `wisi_neutral`, `wisi_pensando`, `wisi_picando_ojo`,
  `wisi_girando_cabeza`, `wisi_tristeza_loop`, `wisi_fuego_duo_brillante`.
- Assets: `new_assets/chat/wisi_avatar.png`, `new_assets/chat/wisi_whatsapp_consent.png`.
- Estado: `WisiAccessCubit` / `WisiAccessState`, `constants/wisi`.

➡️ **Oportunidad del proyecto**: reemplazar el salto a WhatsApp por voz/chat
in-app reutilizando el mismo avatar y animaciones.

## Señales de IA y chat ya en la app
- `Models/generative_ai/vehicle_data_extraction_response` y
  `identification_data_extraction_response` → ya usan IA generativa + OCR
  (`ocr-docs-api`, `init-textract-statemachine`) para leer cédula/vehículo.
- Chat P2P real: `ChatInboxCubit`, `ChatUserDto`, `ChatBankDetailsDto`,
  `ChatBankOrderDto`, `PreorderChargedByChatException`, `sockets.pagodirecto.com`.

## Inventario de funcionalidades (pantallas)
De `package:pdflutterv2/Screens/...`:
- **Home**: wallet, enviar fondos (`enviar_fondos`, P2P/P2C, débito inmediato),
  facturación, solicitar fondos, promociones, sugerencias, credirecto.
- **Menu**: recargas (BDV, Bancamiga, Credicard, débito inmediato, tarjeta
  internacional), peajes/accesos (`tolls_accesses`), comercios, parquímetros.
- **Commerce** (comercios): cobros por QR, inventario, estadísticas de ventas,
  transferencias masivas, validador de tickets, equipo de trabajo.
- **Collectibles** (coleccionables/club), **FAQ**, **Invoices** (facturas),
  **BusquedaScreen** (pagar formulario).
- Seguros (`insurances`): Mercantil, Seguros Caracas, CuidaSalud, Tu Gruero.
- Parquímetros (`parquimetros`): afiliar vehículo (OCR), penalizaciones.

## Backend real descubierto (objetivo de integración, NO se llama en este repo)
Base `elbpd-01-vpce86.pagodirecto.com` (banca en `-vpcpdban`). Microservicios:
`auth-api`, `micropd-01/v1`, `micropd-02/customer` (banca), `micropd-03`,
`micropd-04`, `micropd-loyalty`, `micropd-parking`, `parking-meters-api`,
`toll-api`, `tktfisico-prod`, `micropd-events/v1`, `micropd-metrics`.
Además: `ocr-docs-api`, `app-discovery` (remote config), `sockets.pagodirecto.com`.

Endpoints de pago (customer) relevantes para el agente:
`/customer/p2p`, `/customer/p2c`, `/customer/payments/transfer-user`,
`/customer/service`, `/customer/services/information`, `/customer/recharge/service`,
`/customer/physical-ticket/pay`, `/customer/ticket/pay`, `/customer/tolls/accesses`,
`/customer/buildings/tickets/*`, `/donations/foundations`, `/customer/payment-totp` (2FA),
`/customer/recharges*`, `/customer/insurances/*`.

## Mapa funcionalidad → herramienta del agente
| Funcionalidad de la app | Endpoint real (objetivo) | Tool del agente (gateway) |
|---|---|---|
| Saldo del wallet | `/micropd-*/customer` (balance) | `get_balance` |
| Catálogo de servicios | `/customer/services/information` | `list_services`, `explain_service` |
| Pagar servicio | `/customer/service`, `/customer/recharge/service` | `prepare_payment` + confirmación |
| Ticket estacionamiento (QR) | `/customer/physical-ticket/pay`, `micropd-parking` | `prepare_parking` + confirmación |
| Donar | `/donations/foundations` | `list_foundations`, `prepare_donation` + confirmación |
| Enviar fondos P2P/P2C | `/customer/p2p`, `/customer/p2c`, `payments/transfer-user` | `prepare_transfer` + confirmación |
| Estado de operación | consulta por referencia | `get_operation_status` |
| Soporte / handoff humano | caso de soporte | `create_support_case` |
| Navegar en la app | — (cliente) | `open_app_screen` |
| Confirmar pago (biometría) | `/customer/payment-totp` + flujo auth | `confirm_payment_in_app` (client tool) |

## Reproducir el análisis
```bash
fnm use 22
ADB=~/.local/share/border-quotes/android-sdk/platform-tools/adb
$ADB pull "$($ADB shell pm path com.paytech.pagodirecto | sed -n 's/package://;1p')" base.apk
rea identify-flutter-build split_config.x86_64.apk
rea inspect-dart-aot split_config.x86_64.apk --abi x86_64
strings -n 6 lib/x86_64/libapp.so | grep -ioE 'https?://[a-z0-9./_-]+' | sort -u
```
