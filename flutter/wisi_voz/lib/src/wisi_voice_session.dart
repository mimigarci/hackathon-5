import 'dart:async';
import 'dart:convert';

import 'package:web_socket_channel/web_socket_channel.dart';

/// Sesión de voz con ElevenLabs Conversational AI.
///
/// Gestiona el **canal de control** por WebSocket (transcripciones, respuestas
/// del agente y *client tools*). El streaming de audio (micrófono -> ElevenLabs
/// y TTS de Wisi -> altavoz) se conecta con los paquetes `record` y `just_audio`
/// en [attachAudio]; el canal de control ya es funcional sin audio y es el que
/// transporta el evento crítico `confirm_payment_in_app`.
///
/// La `signedUrl` la entrega el gateway (/api/session) para no exponer el
/// agent_id ni la API key en el cliente.
class WisiVoiceSession {
  WisiVoiceSession({
    required this.signedUrl,
    required this.principal,
    required this.onAgentMessage,
    required this.onUserTranscript,
    required this.onConfirmRequested,
    this.onStatus,
  });

  final String signedUrl;
  final String principal;

  /// Texto que dice Wisi (para mostrar en la transcripción).
  final void Function(String text) onAgentMessage;

  /// Transcripción de lo que dice el usuario.
  final void Function(String text) onUserTranscript;

  /// El agente pidió confirmar un pago (client tool `confirm_payment_in_app`).
  /// Debe devolver true si el usuario aprobó (tras biometría/PIN) y se ejecutó.
  final Future<bool> Function(String intentId) onConfirmRequested;

  final void Function(String status)? onStatus;

  WebSocketChannel? _ch;
  StreamSubscription? _sub;
  bool _connected = false;

  bool get isConnected => _connected;

  Future<void> start() async {
    _ch = WebSocketChannel.connect(Uri.parse(signedUrl));
    _connected = true;
    onStatus?.call('conectado');

    // Inicialización: pasamos el principal como variable dinámica para que las
    // webhook tools lo reciban en la cabecera x-wisivoz-principal.
    _send({
      'type': 'conversation_initiation_client_data',
      'dynamic_variables': {'principal': principal},
    });

    _sub = _ch!.stream.listen(
      _onEvent,
      onDone: () {
        _connected = false;
        onStatus?.call('finalizado');
      },
      onError: (e) {
        _connected = false;
        onStatus?.call('error: $e');
      },
    );
  }

  Future<void> _onEvent(dynamic raw) async {
    final Map<String, dynamic> ev;
    try {
      ev = jsonDecode(raw as String) as Map<String, dynamic>;
    } catch (_) {
      return;
    }
    switch (ev['type']) {
      case 'ping':
        _send({'type': 'pong', 'event_id': ev['ping_event']?['event_id']});
        break;
      case 'user_transcript':
        final t = ev['user_transcription_event']?['user_transcript'];
        if (t is String) onUserTranscript(t);
        break;
      case 'agent_response':
        final t = ev['agent_response_event']?['agent_response'];
        if (t is String) onAgentMessage(t);
        break;
      case 'client_tool_call':
        await _handleClientTool(ev['client_tool_call'] as Map<String, dynamic>);
        break;
      // 'audio' se maneja en attachAudio (reproducción del TTS).
    }
  }

  Future<void> _handleClientTool(Map<String, dynamic> call) async {
    final name = call['tool_name'] as String?;
    final callId = call['tool_call_id'] as String?;
    final params = (call['parameters'] as Map?)?.cast<String, dynamic>() ?? {};

    if (name == 'confirm_payment_in_app') {
      final intentId = params['intent_id'] as String? ?? '';
      bool approved = false;
      try {
        approved = await onConfirmRequested(intentId);
      } catch (_) {
        approved = false;
      }
      _send({
        'type': 'client_tool_result',
        'tool_call_id': callId,
        'result': jsonEncode({
          'status': approved ? 'ok' : 'denied',
          'speech': approved
              ? 'Pago confirmado por el usuario.'
              : 'El usuario no confirmó el pago.',
        }),
        'is_error': false,
      });
    } else {
      // tool desconocida -> devolver error controlado
      _send({
        'type': 'client_tool_result',
        'tool_call_id': callId,
        'result': 'unknown_tool',
        'is_error': true,
      });
    }
  }

  /// Envía texto del usuario por el canal (modo chat dentro de la sesión de voz).
  void sendUserText(String text) {
    _send({'type': 'user_message', 'text': text});
  }

  void _send(Map<String, dynamic> msg) => _ch?.sink.add(jsonEncode(msg));

  Future<void> stop() async {
    await _sub?.cancel();
    await _ch?.sink.close();
    _connected = false;
  }
}
