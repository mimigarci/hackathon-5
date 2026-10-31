import 'package:flutter/material.dart';

import 'wisi_gateway.dart';
import 'wisi_models.dart';
import 'wisi_voice_session.dart';

/// Hoja de conversación con Wisi: voz + chat, dentro de la app.
///
/// El chat usa directamente el gateway REST (funciona sin credenciales de voz).
/// La voz usa [WisiVoiceSession] con la signed URL de ElevenLabs. En ambos modos,
/// la **confirmación de dinero** pasa por [_confirmFlow]: hoja segura de
/// biometría/PIN -> prueba de aprobación -> POST /api/confirm. El agente nunca
/// ejecuta el pago por su cuenta.
class WisiSheet extends StatefulWidget {
  const WisiSheet({
    super.key,
    required this.gateway,
    required this.principal,
    this.onOpenScreen,
  });

  final WisiGateway gateway;
  final String principal;
  final void Function(String screenKey, Map<String, dynamic> params)? onOpenScreen;

  @override
  State<WisiSheet> createState() => _WisiSheetState();
}

class _WisiSheetState extends State<WisiSheet> {
  final List<WisiMessage> _messages = [];
  final TextEditingController _input = TextEditingController();
  WisiSession? _session;
  WisiVoiceSession? _voice;
  bool _busy = false;
  String _status = 'Conectando…';

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    try {
      final s = await widget.gateway.createSession(principal: widget.principal);
      setState(() {
        _session = s;
        _status = s.voiceEnabled ? 'Listo (voz disponible)' : 'Listo (solo chat)';
      });
      _addAgent(
        '¡Hola! Soy Wisi. Puedo pagarte servicios, tu ticket de estacionamiento, '
        'donar o enviar fondos, aquí mismo. ¿Qué necesitas?',
      );
    } catch (e) {
      setState(() => _status = 'No pude conectar: $e');
    }
  }

  // -- voz -------------------------------------------------------------------

  Future<void> _toggleVoice() async {
    final s = _session;
    if (s == null || s.signedUrl == null) {
      setState(() => _status = 'Voz no disponible (falta configurar ElevenLabs)');
      return;
    }
    if (_voice?.isConnected == true) {
      await _voice?.stop();
      setState(() => _status = 'Voz detenida');
      return;
    }
    final voice = WisiVoiceSession(
      signedUrl: s.signedUrl!,
      principal: s.principal,
      onAgentMessage: _addAgent,
      onUserTranscript: (t) => _addUser(t),
      onConfirmRequested: _confirmFlow,
      onStatus: (st) => setState(() => _status = st),
    );
    _voice = voice;
    await voice.start();
    setState(() => _status = 'Escuchando…');
  }

  // -- chat ------------------------------------------------------------------

  Future<void> _send() async {
    final text = _input.text.trim();
    if (text.isEmpty || _busy) return;
    _input.clear();
    _addUser(text);

    // Si hay sesión de voz activa, el canal transporta el texto; si no,
    // interpretamos intención localmente contra el gateway (demo de chat).
    if (_voice?.isConnected == true) {
      _voice!.sendUserText(text);
      return;
    }
    await _handleChatIntent(text);
  }

  /// Enrutador de intención mínimo para el modo chat sin voz (demo). En
  /// producción esto lo decide el LLM del agente; aquí cubrimos los casos clave.
  Future<void> _handleChatIntent(String text) async {
    setState(() => _busy = true);
    try {
      final t = text.toLowerCase();
      if (t.contains('saldo')) {
        final r = await widget.gateway.balance();
        _addAgent(r.speech ?? 'Consulté tu saldo.');
      } else if (t.contains('servicio') || t.contains('pagar')) {
        final r = await widget.gateway.services();
        _addAgent(r.speech ?? 'Estos son los servicios.');
      } else if (t.contains('dona')) {
        final r = await widget.gateway
            .prepareDonation(foundationRef: 'fundana', amountMinor: 5000);
        await _afterPrepare(r);
      } else if (t.contains('estacionamiento') || t.contains('parking')) {
        final r = await widget.gateway.prepareParking('TICKET-DEMO');
        await _afterPrepare(r);
      } else {
        _addAgent(
          'Puedo: consultar saldo, pagar servicios, pagar estacionamiento, '
          'donar o enviar fondos. ¿Qué hacemos?',
        );
      }
    } catch (e) {
      _addAgent('Ups, algo falló: $e');
    } finally {
      setState(() => _busy = false);
    }
  }

  Future<void> _afterPrepare(ToolResponse r) async {
    _addAgent(r.speech ?? 'Prepárame la confirmación.');
    if (r.needsConfirmation && r.intentId != null) {
      final ok = await _confirmFlow(r.intentId!);
      if (!ok) _addAgent('Operación no confirmada.');
    }
  }

  // -- confirmación segura ----------------------------------------------------

  /// Flujo de confirmación disparado por la app (no por el modelo).
  /// Devuelve true si el usuario aprobó y la operación quedó `settled`.
  Future<bool> _confirmFlow(String intentId) async {
    final approved = await showModalBottomSheet<bool>(
          context: context,
          builder: (_) => const _ConfirmBiometricSheet(),
        ) ??
        false;
    if (!approved) return false;

    try {
      // La prueba la emite el flujo autenticado; aquí la pedimos al gateway.
      final proof = await widget.gateway.approvalProof(intentId);
      final r = await widget.gateway.confirm(intentId: intentId, approvalProof: proof);
      _addAgent(r.speech ?? 'Operación procesada.');
      return r.isOk;
    } catch (e) {
      _addAgent('No se pudo confirmar: $e');
      return false;
    }
  }

  // -- helpers UI ------------------------------------------------------------

  void _addAgent(String t) => setState(() => _messages.add(WisiMessage(fromUser: false, text: t)));
  void _addUser(String t) => setState(() => _messages.add(WisiMessage(fromUser: true, text: t)));

  @override
  void dispose() {
    _voice?.stop();
    _input.dispose();
    widget.gateway.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      maxChildSize: 0.95,
      minChildSize: 0.5,
      builder: (context, scrollController) {
        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(
            children: [
              _header(),
              Expanded(
                child: ListView.builder(
                  controller: scrollController,
                  padding: const EdgeInsets.all(16),
                  itemCount: _messages.length,
                  itemBuilder: (_, i) => _bubble(_messages[i]),
                ),
              ),
              _composer(),
            ],
          ),
        );
      },
    );
  }

  Widget _header() => Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 8, 8),
        child: Row(
          children: [
            const CircleAvatar(
              backgroundColor: Color(0xFFE6005C),
              child: Icon(Icons.record_voice_over, color: Colors.white),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Wisi',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                  Text(_status,
                      style: const TextStyle(fontSize: 12, color: Colors.black54)),
                ],
              ),
            ),
            IconButton(
              tooltip: 'Hablar',
              onPressed: _toggleVoice,
              icon: Icon(
                _voice?.isConnected == true ? Icons.mic : Icons.mic_none,
                color: const Color(0xFFE6005C),
              ),
            ),
            IconButton(
              onPressed: () => Navigator.of(context).pop(),
              icon: const Icon(Icons.close),
            ),
          ],
        ),
      );

  Widget _bubble(WisiMessage m) => Align(
        alignment: m.fromUser ? Alignment.centerRight : Alignment.centerLeft,
        child: Container(
          margin: const EdgeInsets.symmetric(vertical: 4),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          constraints: const BoxConstraints(maxWidth: 280),
          decoration: BoxDecoration(
            color: m.fromUser ? const Color(0xFFE6005C) : const Color(0xFFF1F1F4),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Text(
            m.text,
            style: TextStyle(color: m.fromUser ? Colors.white : Colors.black87),
          ),
        ),
      );

  Widget _composer() => SafeArea(
        top: false,
        child: Padding(
          padding: EdgeInsets.only(
            left: 12,
            right: 12,
            bottom: MediaQuery.of(context).viewInsets.bottom + 8,
            top: 8,
          ),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _input,
                  onSubmitted: (_) => _send(),
                  decoration: InputDecoration(
                    hintText: 'Escribe o pulsa el micrófono…',
                    filled: true,
                    fillColor: const Color(0xFFF1F1F4),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(24),
                      borderSide: BorderSide.none,
                    ),
                    contentPadding:
                        const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  ),
                ),
              ),
              IconButton(
                onPressed: _busy ? null : _send,
                icon: const Icon(Icons.send, color: Color(0xFFE6005C)),
              ),
            ],
          ),
        ),
      );
}

/// Hoja de confirmación segura: representa biometría/PIN. En producción, aquí se
/// invoca el autenticador del dispositivo (local_auth) y el backend emite la
/// prueba vinculada a la intención.
class _ConfirmBiometricSheet extends StatelessWidget {
  const _ConfirmBiometricSheet();

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.fingerprint, size: 56, color: Color(0xFFE6005C)),
            const SizedBox(height: 12),
            const Text(
              'Confirma con tu biometría o PIN',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
            ),
            const SizedBox(height: 4),
            const Text(
              'PagoDirecto necesita tu aprobación para ejecutar esta operación.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.black54, fontSize: 13),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFFE6005C),
                ),
                onPressed: () => Navigator.of(context).pop(true),
                child: const Text('Aprobar'),
              ),
            ),
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Cancelar'),
            ),
          ],
        ),
      ),
    );
  }
}
