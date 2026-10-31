import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../widgets/flow_widgets.dart';
import '../widgets/home_sections.dart';
import 'insurance_screen.dart';
import 'meters_screen.dart';
import 'parking/parking_screen.dart';
import 'services/services_screen.dart';

/// Routes each Funciones tile to its flow.
void openFunction(BuildContext context, AppFunction f) {
  final Widget screen = switch (f.id) {
    FunctionId.parking => const ParkingScreen(),
    FunctionId.services => const ServicesScreen(),
    FunctionId.meters => const MetersScreen(),
    FunctionId.insurance => const InsuranceScreen(),
    FunctionId.tickets ||
    FunctionId.donations => UnmappedFunctionScreen(function: f),
  };
  Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen));
}

/// Boletería and Donaciones: only the Home entry was observed, so no form
/// is shown until their flows are walked through (docs/rea-home).
class UnmappedFunctionScreen extends StatelessWidget {
  const UnmappedFunctionScreen({super.key, required this.function});

  final AppFunction function;

  @override
  Widget build(BuildContext context) {
    return FlowScaffold(
      title: function.label,
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(function.icon, size: 72, color: function.color),
              const SizedBox(height: 16),
              Text(
                '${function.label} llegará pronto',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Estamos preparando esta función. Mientras tanto puedes '
                'pagar servicios, estacionamientos, parquímetros y seguros.',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.textSecondary),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
