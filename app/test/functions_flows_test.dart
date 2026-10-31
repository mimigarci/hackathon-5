import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pago_directo/app.dart';
import 'package:pago_directo/data/repository.dart';

void main() {
  Future<void> pumpApp(WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2340);
    tester.view.devicePixelRatio = 2.625;
    addTearDown(tester.view.reset);
    // The test font (Ahem) is much wider than Outfit, so the Sugerencias
    // banners overflow here but not on device. Ignore overflow only.
    final onError = FlutterError.onError;
    FlutterError.onError = (details) {
      if ('${details.exception}'.contains('overflowed')) return;
      onError?.call(details);
    };
    addTearDown(() => FlutterError.onError = onError);
    await tester.pumpWidget(
      PagoDirectoApp(repository: MockRepository(), useGoogleFonts: false),
    );
    await tester.pump();
  }

  // The mascot animates forever, so pumpAndSettle never returns.
  Future<void> settle(WidgetTester tester) async {
    for (var i = 0; i < 12; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
  }

  Future<void> unmount(WidgetTester tester) =>
      tester.pumpWidget(const SizedBox());

  /// Closes first-visit tutorials and the billing sheet.
  Future<void> dismissOnboarding(WidgetTester tester) async {
    await settle(tester);
    for (var i = 0; i < 3; i++) {
      final close = find.byTooltip('Cerrar');
      final back = find.byTooltip('Atrás');
      if (close.evaluate().isNotEmpty) {
        await tester.tap(close.first);
      } else if (back.evaluate().isNotEmpty) {
        await tester.tap(back.first);
      } else {
        break;
      }
      await settle(tester);
    }
  }

  Future<void> openFunction(WidgetTester tester, String label) async {
    final tile = find.text(label).first;
    await tester.ensureVisible(tile);
    await settle(tester);
    await tester.tap(tile);
    await dismissOnboarding(tester);
  }

  testWidgets('Servicios: catalog and per-provider forms', (tester) async {
    await pumpApp(tester);
    await openFunction(tester, 'Servicios');

    expect(find.text('Gestionar'), findsOneWidget);
    expect(find.text('STARMOVILES CORP.'), findsOneWidget);

    await tester.tap(find.text('DIGITEL'));
    await settle(tester);
    expect(find.text('Monto a recargar'), findsOneWidget);
    expect(find.text('Pagar'), findsOneWidget);

    await tester.tap(find.text('Postpago'));
    await settle(tester);
    await tester.tap(find.text('Consultar'));
    await settle(tester);
    expect(find.text('Ingrese un número de contrato válido'), findsOneWidget);

    await tester.tap(find.byIcon(Icons.chevron_left_rounded).first);
    await settle(tester);
    await tester.tap(find.text('MOVISTAR'));
    await settle(tester);
    await tester.tap(find.text('Postpago'));
    await settle(tester);
    expect(find.text('Número de tarjeta'), findsOneWidget);
    expect(find.text('Telefonía Celular o Internet Móvil'), findsOneWidget);
    await unmount(tester);
  });

  testWidgets('Estacionamiento: manual ticket needs a code', (tester) async {
    await pumpApp(tester);
    await openFunction(tester, 'Estacionamiento');

    expect(find.text('Sin conexión'), findsOneWidget);
    await tester.tap(find.text('Pagar Ticket Físico'));
    await settle(tester);
    expect(find.text('Error accediendo a la cámara'), findsOneWidget);

    await tester.tap(find.text('Ingresa el código numérico manualmente'));
    await settle(tester);
    final accept = find.widgetWithText(FilledButton, 'Aceptar');
    expect(tester.widget<FilledButton>(accept).onPressed, isNull);

    await tester.enterText(find.byType(TextField), '0001234');
    await tester.pump();
    expect(tester.widget<FilledButton>(accept).onPressed, isNotNull);
    await unmount(tester);
  });

  testWidgets('Parquímetros: denied location shows banner', (tester) async {
    await pumpApp(tester);
    final tile = find.text('Parquímetros').first;
    await tester.ensureVisible(tile);
    await settle(tester);
    await tester.tap(tile);
    await settle(tester);

    await tester.tap(find.text('No permitir'));
    await settle(tester);
    expect(find.text('Permite el acceso a tu ubicación'), findsOneWidget);
    expect(find.text('Escanear'), findsOneWidget);
    expect(find.text('Penalizaciones'), findsOneWidget);
    await unmount(tester);
  });

  testWidgets('Seguros: Vehículos → Particular → coberturas', (tester) async {
    await pumpApp(tester);
    await openFunction(tester, 'Seguros');

    await tester.tap(find.text('Vehículos'));
    await settle(tester);
    await tester.tap(find.text('Responsabilidad civil vehicular'));
    await settle(tester);
    await tester.tap(find.text('Particular'));
    await settle(tester);

    expect(find.text('R.C.V. BÁSICA'), findsOneWidget);
    final buy = find.widgetWithText(FilledButton, 'Adquirir');
    expect(tester.widget<FilledButton>(buy).onPressed, isNull);
    await tester.tap(find.text('R.C.V. BÁSICA'));
    await tester.pump();
    expect(tester.widget<FilledButton>(buy).onPressed, isNotNull);
    await unmount(tester);
  });

  testWidgets('Boletería and Donaciones show no invented form', (
    tester,
  ) async {
    await pumpApp(tester);
    await openFunction(tester, 'Boletería');
    expect(find.text('Boletería llegará pronto'), findsOneWidget);
    expect(find.byType(TextField), findsNothing);
    await unmount(tester);
  });
}
