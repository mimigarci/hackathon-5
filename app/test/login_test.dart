import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pago_directo/app.dart';

void main() {
  // The mascot animates forever, so pumpAndSettle never returns.
  Future<void> settle(WidgetTester tester) async {
    for (var i = 0; i < 10; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
  }

  testWidgets('without Supabase, Google sign-in enters demo mode and back', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1080, 2340);
    tester.view.devicePixelRatio = 2.625;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(const PagoDirectoApp(useGoogleFonts: false));
    await settle(tester);
    expect(find.text('Bienvenido'), findsOneWidget);
    expect(find.text('Continuar con Google'), findsOneWidget);
    expect(find.text('Modo demo: entrarás con datos de ejemplo.'), findsOneWidget);

    await tester.tap(find.text('Continuar con Google'));
    await settle(tester);
    expect(find.text('Saldo disponible'), findsOneWidget);

    await tester.tap(find.text('Menu'));
    await settle(tester);
    await tester.tap(find.text('Cerrar sesión'));
    await settle(tester);
    expect(find.text('Continuar con Google'), findsOneWidget);

    await tester.pumpWidget(const SizedBox());
  });
}
