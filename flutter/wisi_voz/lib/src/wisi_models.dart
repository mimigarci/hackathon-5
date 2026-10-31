/// Modelos compartidos con el contrato del gateway (ToolResponse v1).

/// Estado de una respuesta de herramienta.
enum WisiStatus {
  ok,
  pending,
  requiresConfirmation,
  denied,
  unavailable,
  error;

  static WisiStatus parse(String raw) {
    switch (raw) {
      case 'ok':
        return WisiStatus.ok;
      case 'pending':
        return WisiStatus.pending;
      case 'requires_confirmation':
        return WisiStatus.requiresConfirmation;
      case 'denied':
        return WisiStatus.denied;
      case 'unavailable':
        return WisiStatus.unavailable;
      default:
        return WisiStatus.error;
    }
  }
}

/// Envoltura común de toda respuesta del gateway.
class ToolResponse {
  ToolResponse({
    required this.requestId,
    required this.status,
    required this.data,
    this.error,
    this.speech,
  });

  final String requestId;
  final WisiStatus status;
  final Map<String, dynamic> data;
  final Map<String, dynamic>? error;
  final String? speech;

  bool get isOk => status == WisiStatus.ok;
  bool get needsConfirmation => status == WisiStatus.requiresConfirmation;

  /// Presente cuando el gateway devolvió una intención a confirmar.
  String? get intentId => data['intent_id'] as String?;
  Map<String, dynamic>? get summary =>
      (data['summary'] as Map?)?.cast<String, dynamic>();

  factory ToolResponse.fromJson(Map<String, dynamic> j) => ToolResponse(
        requestId: j['request_id'] as String? ?? '',
        status: WisiStatus.parse(j['status'] as String? ?? 'error'),
        data: (j['data'] as Map?)?.cast<String, dynamic>() ?? {},
        error: (j['error'] as Map?)?.cast<String, dynamic>(),
        speech: j['speech'] as String?,
      );
}

/// Sesión emitida por el gateway: token efímero + datos de voz.
class WisiSession {
  WisiSession({
    required this.sessionToken,
    required this.principal,
    required this.agentId,
    required this.signedUrl,
    required this.voiceEnabled,
  });

  final String sessionToken;
  final String principal;
  final String agentId;
  final String? signedUrl;
  final bool voiceEnabled;

  factory WisiSession.fromJson(Map<String, dynamic> j) => WisiSession(
        sessionToken: j['session_token'] as String,
        principal: j['principal'] as String,
        agentId: j['elevenlabs_agent_id'] as String? ?? '',
        signedUrl: j['signed_url'] as String?,
        voiceEnabled: j['voice_enabled'] as bool? ?? false,
      );
}

/// Un turno visible en la conversación (chat o transcripción de voz).
class WisiMessage {
  WisiMessage({required this.fromUser, required this.text});
  final bool fromUser;
  final String text;
}
