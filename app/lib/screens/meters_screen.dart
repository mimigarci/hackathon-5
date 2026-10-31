import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../widgets/common.dart';
import '../widgets/flow_widgets.dart';
import 'parking/locations_screen.dart';
import 'parking/vehicles_screen.dart';

enum _LocationAccess { unknown, denied, granted }

/// Parquímetros (F36, F37): asks for location, shows the no-location banner
/// when denied, and the map + Ubicación tutorial when granted. Escanear is
/// the alternative to picking a meter on the map.
class MetersScreen extends StatefulWidget {
  const MetersScreen({super.key});

  @override
  State<MetersScreen> createState() => _MetersScreenState();
}

class _MetersScreenState extends State<MetersScreen> {
  _LocationAccess _access = _LocationAccess.unknown;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _askLocation());
  }

  Future<void> _askLocation() async {
    final granted = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        icon: const Icon(Icons.location_on_outlined),
        title: const Text(
          '¿Permitir que PagoDirecto acceda a la ubicación de este '
          'dispositivo?',
        ),
        actionsAlignment: MainAxisAlignment.center,
        actionsOverflowDirection: VerticalDirection.down,
        actions: [
          for (final (label, ok) in [
            ('Mientras usas la app', true),
            ('Solo esta vez', true),
            ('No permitir', false),
          ])
            SizedBox(
              width: double.infinity,
              child: TextButton(
                onPressed: () => Navigator.pop(context, ok),
                child: Text(label),
              ),
            ),
        ],
      ),
    );
    if (!mounted) return;
    setState(() {
      _access = granted == true
          ? _LocationAccess.granted
          : _LocationAccess.denied;
    });
    if (_access == _LocationAccess.granted) {
      await showFlowTutorial(
        context,
        title: 'Ubicación',
        body:
            'Selecciona el parquímetro que deseas usar según tu ubicación o '
            'escanea su código QR.',
        icon: Icons.map_outlined,
        color: AppColors.meters,
      );
    }
  }

  void _push(Widget screen) =>
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen));

  @override
  Widget build(BuildContext context) {
    return FlowScaffold(
      title: 'Parquímetros',
      body: Column(
        children: [
          const FlowStepper(
            steps: ['Ubicación', 'Gestión y pago', 'En uso', 'Finalizado'],
            current: 0,
            color: AppColors.meters,
          ),
          Expanded(
            child: Container(
              margin: const EdgeInsets.symmetric(horizontal: 16),
              decoration: BoxDecoration(
                color: _access == _LocationAccess.granted
                    ? const Color(0xFFE6ECF7)
                    : const Color(0xFFF8F8FA),
                borderRadius: BorderRadius.circular(24),
              ),
              child: _access == _LocationAccess.granted
                  ? const Center(
                      child: Icon(
                        Icons.map_outlined,
                        size: 96,
                        color: AppColors.meters,
                      ),
                    )
                  : null,
            ),
          ),
          if (_access == _LocationAccess.denied)
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
              child: InfoBanner(
                'Permite el acceso a tu ubicación',
                onTap: _askLocation,
              ),
            ),
          PillButton(
            label: 'Escanear',
            onPressed: () => showActionReview(
              context,
              action: 'usar el parquímetro',
              summary: {
                'Identificación': 'Código QR del parquímetro',
                'Ubicación': _access == _LocationAccess.granted
                    ? 'Permitida'
                    : 'No permitida',
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
            Icons.money_off_rounded,
            'Penalizaciones',
            () => openPlaceholder(context, 'Penalizaciones'),
          ),
          FlowNavItem(
            Icons.receipt_long_outlined,
            'Historial',
            () => openPlaceholder(context, 'Historial'),
          ),
          FlowNavItem(
            Icons.location_on_outlined,
            'Ubicaciones',
            () => _push(const LocationsScreen(category: 'Parquímetros')),
          ),
        ],
      ),
    );
  }
}
