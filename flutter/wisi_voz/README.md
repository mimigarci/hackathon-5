# wisi_voz (Flutter)

Widget in-app que **reemplaza el salto a WhatsApp** del avatar rojo Wisi por una
conversación de **voz y chat** dentro de la app PagoDirecto.

La app PagoDirecto es Flutter (confirmado por análisis del APK: paquete
`pdflutterv2`), por eso el cliente real es este paquete.

## Qué incluye
- `WisiLauncher`: el botón del avatar. Donde hoy se abre WhatsApp, abre la hoja de Wisi.
- `WisiSheet`: UI de voz + chat con el flujo de confirmación segura (biometría/PIN).
- `WisiGateway`: cliente REST del gateway WisiVoz (`backend/`).
- `WisiVoiceSession`: canal de control de ElevenLabs Conversational AI por WebSocket.

## Seguridad (clave)
El agente **nunca ejecuta dinero**. Las tools `prepare_*` devuelven una intención;
la ejecución pasa por `_confirmFlow` (hoja de biometría/PIN → prueba de aprobación
→ `POST /api/confirm`). El evento `confirm_payment_in_app` llega como *client tool*
por el canal de voz y dispara esa misma hoja.

## Integrar en la app real
1. Sustituir el `onTap` del avatar que hoy llama a `WisiAccessCubit`/WhatsApp por
   `WisiLauncher(baseUrl: ..., principal: sesión.userId, onOpenScreen: router)`.
2. Servir el gateway (`backend/`) y configurar `ELEVENLABS_AGENT_ID`/`API_KEY`.
3. Para biometría real, cambiar `_ConfirmBiometricSheet` por `local_auth` y que el
   backend emita la prueba de aprobación tras verificar el factor.
4. Audio de voz: conectar `record` (micrófono) y `just_audio` (TTS) en
   `WisiVoiceSession.attachAudio` usando la signed URL.

## Ejecutar la demo
```bash
cd example && flutter run   # ajusta gatewayBaseUrl (10.0.2.2 en emulador)
```
