import 'package:flutter/material.dart';
import 'package:wisi_voz/wisi_voz.dart';

/// Demo del launcher de Wisi sobre una pantalla "Home" simulada.
/// Ejecuta el gateway (backend/) y ajusta [gatewayBaseUrl].
///
/// En el emulador Android, localhost del host es 10.0.2.2.
const gatewayBaseUrl = 'http://10.0.2.2:8000';

void main() => runApp(const DemoApp());

class DemoApp extends StatelessWidget {
  const DemoApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'WisiVoz demo',
      theme: ThemeData(useMaterial3: true),
      home: Scaffold(
        appBar: AppBar(title: const Text('PagoDirecto (demo)')),
        body: const Center(child: Text('Home de la app')),
        floatingActionButton: const WisiLauncher(
          baseUrl: gatewayBaseUrl,
          principal: 'demo-user',
        ),
      ),
    );
  }
}
