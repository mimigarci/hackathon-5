import 'package:flutter/material.dart';

import '../../data/catalog.dart';
import '../../theme/app_colors.dart';
import '../../widgets/common.dart';
import '../../widgets/flow_widgets.dart';
import 'billing_sheet.dart';
import 'schedule_screen.dart';
import 'service_manage_screen.dart';

/// Servicios: provider catalog (F14, F23). The first visit shows the
/// Selección tutorial (F13.1) and the dismissible billing sheet (F13.2);
/// closing the sheet keeps the catalog usable (F14.1).
class ServicesScreen extends StatefulWidget {
  const ServicesScreen({super.key});

  @override
  State<ServicesScreen> createState() => _ServicesScreenState();
}

class _ServicesScreenState extends State<ServicesScreen> {
  static bool _onboarded = false;

  @override
  void initState() {
    super.initState();
    if (!_onboarded) {
      _onboarded = true;
      WidgetsBinding.instance.addPostFrameCallback((_) => _onboard());
    }
  }

  Future<void> _onboard() async {
    await showFlowTutorial(
      context,
      title: 'Selección',
      body: 'Elige el servicio que quieres pagar o consultar.',
      icon: Icons.touch_app_outlined,
      steps: 3,
    );
    if (mounted && !BillingProfile.instance.isComplete) {
      await showBillingSheet(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    return FlowScaffold(
      title: 'Servicios',
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        children: [
          const FlowStepper(
            steps: ['Servicios', 'Gestionar', 'Listo'],
            current: 0,
          ),
          GridView.count(
            crossAxisCount: 3,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 14,
            crossAxisSpacing: 14,
            childAspectRatio: 1.05,
            children: [
              for (final s in serviceCatalog)
                ServiceCatalogTile(
                  entry: s,
                  onTap: () => openServiceEntry(context, s),
                ),
            ],
          ),
        ],
      ),
      bottom: FlowBottomNav(
        items: [
          FlowNavItem(
            Icons.menu_book_outlined,
            'Directorio',
            () => openPlaceholder(context, 'Directorio'),
          ),
          FlowNavItem(
            Icons.event_repeat_outlined,
            'Programar',
            () => showScheduleSheet(context),
          ),
          FlowNavItem(
            Icons.history_rounded,
            'Historial',
            () => openPlaceholder(context, 'Historial'),
          ),
        ],
      ),
    );
  }
}

class ServiceCatalogTile extends StatelessWidget {
  const ServiceCatalogTile({super.key, required this.entry, this.onTap});

  final ServiceCatalogEntry entry;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(22),
      child: InkWell(
        borderRadius: BorderRadius.circular(22),
        onTap: onTap,
        child: Center(child: ServiceWordmark(entry: entry, fontSize: 18)),
      ),
    );
  }
}

/// Brand-colored wordmark; swap for logo assets when available.
class ServiceWordmark extends StatelessWidget {
  const ServiceWordmark({super.key, required this.entry, this.fontSize = 20});

  final ServiceCatalogEntry entry;
  final double fontSize;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8),
      child: FittedBox(
        fit: BoxFit.scaleDown,
        child: Text(
          entry.name.toUpperCase(),
          textAlign: TextAlign.center,
          style: TextStyle(
            color: entry.color,
            fontSize: fontSize,
            fontWeight: FontWeight.w800,
            letterSpacing: 1,
          ),
        ),
      ),
    );
  }
}
