import 'package:flutter/material.dart';

import '../../theme/app_colors.dart';
import '../../widgets/common.dart';
import '../../widgets/flow_widgets.dart';
import 'locations_screen.dart';
import 'ticket_screen.dart';
import 'vehicles_screen.dart';

/// Estacionamiento: Entrada screen (F33). Entrar would lift a physical
/// barrier over BLE, which isn't connected, so it only opens the review.
class ParkingScreen extends StatefulWidget {
  const ParkingScreen({super.key});

  @override
  State<ParkingScreen> createState() => _ParkingScreenState();
}

class _ParkingScreenState extends State<ParkingScreen> {
  static bool _tutorialShown = false;

  @override
  void initState() {
    super.initState();
    if (!_tutorialShown) {
      _tutorialShown = true;
      WidgetsBinding.instance.addPostFrameCallback(
        (_) => showFlowTutorial(
          context,
          title: 'Entrada',
          body: 'Enciende el Bluetooth y toca Entrar para levantar la barrera.',
          icon: Icons.bluetooth_rounded,
          color: AppColors.parking,
        ),
      );
    }
  }

  void _push(Widget screen) =>
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen));

  @override
  Widget build(BuildContext context) {
    return FlowScaffold(
      title: 'Estacionamientos',
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        children: [
          const FlowStepper(
            steps: ['Entrada', 'Sin conexión', 'Pendiente', 'Pagado'],
            current: 0,
          ),
          const SizedBox(height: 24),
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(28),
            ),
            child: Column(
              children: [
                const Icon(
                  Icons.bluetooth_searching_rounded,
                  size: 64,
                  color: AppColors.parking,
                ),
                const SizedBox(height: 12),
                const Text(
                  'Acércate a la entrada',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Con el Bluetooth encendido, toca Entrar para levantar la '
                  'barrera.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppColors.textSecondary),
                ),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    TextButton.icon(
                      onPressed: () => setState(() {}),
                      icon: const Icon(Icons.refresh_rounded),
                      label: const Text('Actualizar'),
                    ),
                    TextButton.icon(
                      onPressed: () => openPlaceholder(context, 'Asistencia'),
                      icon: const Icon(Icons.support_agent_rounded),
                      label: const Text('Asistencia'),
                    ),
                  ],
                ),
              ],
            ),
          ),
          PillButton(
            label: 'Entrar',
            onPressed: () => showActionReview(
              context,
              action: 'entrar',
              summary: const {
                'Acción': 'Levantar barrera de entrada',
                'Conexión': 'Bluetooth no verificado',
              },
            ),
          ),
        ],
      ),
      bottom: FlowBottomNav(
        items: [
          FlowNavItem(
            Icons.directions_car_outlined,
            'Vehículos',
            () => _push(const VehiclesScreen()),
          ),
          FlowNavItem(
            Icons.qr_code_scanner_rounded,
            'Pagar Ticket Físico',
            () => _push(const TicketScanScreen()),
          ),
          FlowNavItem(
            Icons.receipt_long_outlined,
            'Historial',
            () => openPlaceholder(context, 'Historial'),
          ),
          FlowNavItem(
            Icons.location_on_outlined,
            'Ubicaciones',
            () => _push(const LocationsScreen()),
          ),
        ],
      ),
    );
  }
}
