import 'package:flutter/material.dart';

import 'wisi_gateway.dart';
import 'wisi_sheet.dart';

/// Botón flotante del avatar Wisi.
///
/// **Sustituye el comportamiento actual**: hoy el avatar rojo abre WhatsApp
/// (`wisi_whatsapp_consent`). Este launcher abre, en su lugar, la conversación
/// in-app por voz y chat.
///
/// Integración en la app PagoDirecto: colocar este widget donde hoy vive el
/// avatar (Home), pasando `baseUrl` del gateway y el `principal` de la sesión
/// autenticada. Opcionalmente, `onOpenScreen` para navegar cuando el agente use
/// la tool `open_app_screen`.
class WisiLauncher extends StatelessWidget {
  const WisiLauncher({
    super.key,
    required this.baseUrl,
    required this.principal,
    this.avatarAsset = 'assets/wisi_neutral.png',
    this.onOpenScreen,
  });

  final String baseUrl;
  final String principal;
  final String avatarAsset;
  final void Function(String screenKey, Map<String, dynamic> params)? onOpenScreen;

  void _open(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => WisiSheet(
        gateway: WisiGateway(baseUrl: baseUrl),
        principal: principal,
        onOpenScreen: onOpenScreen,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => _open(context),
      child: Container(
        width: 64,
        height: 64,
        decoration: const BoxDecoration(
          shape: BoxShape.circle,
          gradient: LinearGradient(
            colors: [Color(0xFFE6005C), Color(0xFFFF2E7E)],
          ),
          boxShadow: [
            BoxShadow(color: Color(0x33000000), blurRadius: 10, offset: Offset(0, 4)),
          ],
        ),
        child: ClipOval(
          child: Image.asset(
            avatarAsset,
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => const Icon(
              Icons.record_voice_over,
              color: Colors.white,
              size: 32,
            ),
          ),
        ),
      ),
    );
  }
}
