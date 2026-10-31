import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pago_directo/app.dart';
import 'package:pago_directo/data/repository.dart';

void main() {
  Future<void> pumpApp(WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2340);
    tester.view.devicePixelRatio = 2.625;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      PagoDirectoApp(repository: MockRepository(), useGoogleFonts: false),
    );
    await tester.pump();
  }

  // Disposes the shell so its idle timer doesn't outlive the test.
  Future<void> unmount(WidgetTester tester) =>
      tester.pumpWidget(const SizedBox());

  testWidgets('home renders all sections', (tester) async {
    await pumpApp(tester);
    expect(find.text('@mimigarcia'), findsOneWidget);
    expect(find.text('Saldo disponible'), findsOneWidget);
    expect(find.text('Club PagoDirecto'), findsOneWidget);
    expect(find.text('Funciones'), findsOneWidget);
    await unmount(tester);
  });

  testWidgets('bottom nav switches tabs and Mis pagos sub-tabs', (
    tester,
  ) async {
    await pumpApp(tester);

    await tester.tap(find.text('Movimientos'));
    await tester.pump();
    expect(find.text('Sin resultados'), findsOneWidget);

    await tester.tap(find.text('Mis pagos').last);
    await tester.pump();
    expect(find.text('Total por pagar'), findsOneWidget);

    await tester.tap(find.text('Programados'));
    await tester.pump();
    expect(find.text('No tienes pagos programados'), findsOneWidget);
    await unmount(tester);
  });
}
