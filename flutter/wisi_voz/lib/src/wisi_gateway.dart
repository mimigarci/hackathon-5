import 'dart:convert';

import 'package:http/http.dart' as http;

import 'wisi_models.dart';

/// Cliente REST del gateway WisiVoz.
///
/// El token de sesión se obtiene con [createSession] y se adjunta en cada
/// llamada. La confirmación de dinero ([confirm]) se dispara SOLO desde la UI
/// autenticada de la app, nunca desde el modelo.
class WisiGateway {
  WisiGateway({required this.baseUrl, http.Client? client})
      : _http = client ?? http.Client();

  final String baseUrl;
  final http.Client _http;
  String? _token;

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (_token != null) 'Authorization': 'Bearer $_token',
      };

  /// Crea la sesión para el usuario autenticado. En producción el `principal`
  /// lo resuelve el backend desde la sesión de la app; aquí se pasa para la demo.
  Future<WisiSession> createSession({String principal = 'demo-user'}) async {
    final r = await _http.post(
      Uri.parse('$baseUrl/api/session?principal=$principal'),
      headers: {'Content-Type': 'application/json'},
    );
    final session = WisiSession.fromJson(_decode(r));
    _token = session.sessionToken;
    return session;
  }

  Future<ToolResponse> balance() =>
      _get('/api/balance');

  Future<ToolResponse> services({String? category, String? query}) =>
      _post('/api/services', {'category': category, 'query': query});

  Future<ToolResponse> preparePayment({
    required String serviceRef,
    required String accountNumber,
    int? amountMinor,
  }) =>
      _post('/api/payment/prepare', {
        'service_ref': serviceRef,
        'account_number': accountNumber,
        'amount_minor': amountMinor,
      });

  Future<ToolResponse> prepareParking(String ticketRef) =>
      _post('/api/parking/prepare', {'ticket_ref': ticketRef});

  Future<ToolResponse> prepareDonation({
    required String foundationRef,
    required int amountMinor,
  }) =>
      _post('/api/donation/prepare', {
        'foundation_ref': foundationRef,
        'amount_minor': amountMinor,
      });

  Future<ToolResponse> prepareTransfer({
    required String recipientRef,
    required int amountMinor,
    String kind = 'p2p',
  }) =>
      _post('/api/transfer/prepare', {
        'recipient_ref': recipientRef,
        'amount_minor': amountMinor,
        'kind': kind,
      });

  /// Confirma y ejecuta una intención. `approvalProof` la emite el flujo
  /// autenticado de la app (biometría/PIN/OTP); nunca el modelo.
  Future<ToolResponse> confirm({
    required String intentId,
    required String approvalProof,
  }) =>
      _post('/api/confirm', {
        'intent_id': intentId,
        'approval_proof': approvalProof,
      });

  /// DEMO: obtiene la prueba de aprobación. En producción la devuelve el
  /// subsistema de autenticación tras verificar biometría/PIN, vinculada a la
  /// intención, y jamás llega al contexto del agente.
  Future<String> approvalProof(String intentId,
      {String factor = 'biometric'}) async {
    final r = await _http.post(
      Uri.parse('$baseUrl/api/approval-proof?intent_id=$intentId&factor=$factor'),
      headers: _headers,
    );
    return _decode(r)['approval_proof'] as String;
  }

  Future<ToolResponse> operationStatus(String operationRef) =>
      _post('/api/operation/status', {'operation_ref': operationRef});

  // -- helpers ---------------------------------------------------------------

  Future<ToolResponse> _get(String path) async {
    final r = await _http.get(Uri.parse('$baseUrl$path'), headers: _headers);
    return ToolResponse.fromJson(_decode(r));
  }

  Future<ToolResponse> _post(String path, Map<String, dynamic> body) async {
    body.removeWhere((_, v) => v == null);
    final r = await _http.post(
      Uri.parse('$baseUrl$path'),
      headers: _headers,
      body: jsonEncode(body),
    );
    return ToolResponse.fromJson(_decode(r));
  }

  Map<String, dynamic> _decode(http.Response r) {
    if (r.statusCode >= 400) {
      throw WisiGatewayException(r.statusCode, r.body);
    }
    return jsonDecode(r.body) as Map<String, dynamic>;
  }

  void dispose() => _http.close();
}

class WisiGatewayException implements Exception {
  WisiGatewayException(this.statusCode, this.body);
  final int statusCode;
  final String body;
  @override
  String toString() => 'WisiGatewayException($statusCode): $body';
}
