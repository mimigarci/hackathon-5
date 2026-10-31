import 'package:flutter/material.dart';

import '../data/catalog.dart';
import '../theme/app_colors.dart';
import '../widgets/common.dart';
import '../widgets/flow_widgets.dart';
import 'services/billing_sheet.dart';

const _steps = ['Tipo', 'Pólizas', 'Coberturas'];

/// Seguros: Tipo → Pólizas → Coberturas (F38). Only the Vehículos →
/// Particular branch was walked through; other branches say so instead of
/// inventing products.
class InsuranceScreen extends StatefulWidget {
  const InsuranceScreen({super.key});

  @override
  State<InsuranceScreen> createState() => _InsuranceScreenState();
}

class _InsuranceScreenState extends State<InsuranceScreen> {
  static bool _onboarded = false;

  @override
  void initState() {
    super.initState();
    if (!_onboarded) {
      _onboarded = true;
      WidgetsBinding.instance.addPostFrameCallback((_) async {
        await showFlowTutorial(
          context,
          title: 'Selección de póliza',
          body:
              'Elige el tipo de seguro, la póliza y la cobertura que '
              'quieres.',
          icon: Icons.health_and_safety_outlined,
          color: AppColors.insurance,
        );
        if (mounted && !BillingProfile.instance.isComplete) {
          await showBillingSheet(context);
        }
      });
    }
  }

  void _push(Widget screen) =>
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen));

  @override
  Widget build(BuildContext context) {
    return FlowScaffold(
      title: 'Seguros',
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        children: [
          const FlowStepper(
            steps: _steps,
            current: 0,
            color: AppColors.insurance,
          ),
          const _Heading('Tipo'),
          OptionCard(
            title: 'Vehículos',
            leading: const TintIcon(
              Icons.directions_car_outlined,
              color: AppColors.insurance,
            ),
            onTap: () => _push(const _PoliciesScreen()),
          ),
          OptionCard(
            title: 'Personas',
            leading: const TintIcon(
              Icons.person_outline_rounded,
              color: AppColors.insurance,
            ),
            onTap: () => openPlaceholder(context, 'Seguros · Personas'),
          ),
        ],
      ),
      bottom: FlowBottomNav(
        items: [
          FlowNavItem(
            Icons.description_outlined,
            'Mis pólizas',
            () => openPlaceholder(context, 'Mis pólizas'),
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

/// Vehículos: Responsabilidad civil vehicular (Seguros Caracas) and its
/// subtypes (F38.2).
class _PoliciesScreen extends StatelessWidget {
  const _PoliciesScreen();

  @override
  Widget build(BuildContext context) {
    final from = particularCoverages.first.premiumUsd;
    return FlowScaffold(
      title: 'Seguros',
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        children: [
          const FlowStepper(
            steps: _steps,
            current: 1,
            color: AppColors.insurance,
          ),
          const _Heading('Pólizas'),
          OptionCard(
            title: 'Responsabilidad civil vehicular',
            subtitle: 'Seguros Caracas · Desde USD ${from.toStringAsFixed(2)}',
            leading: const TintIcon(
              Icons.shield_outlined,
              color: AppColors.insurance,
            ),
            onTap: () => showModalBottomSheet<void>(
              context: context,
              showDragHandle: true,
              backgroundColor: AppColors.surface,
              builder: (sheet) => SafeArea(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    for (final s in insuranceVehicleSubtypes)
                      ListTile(
                        title: Text(s),
                        trailing: const Icon(Icons.chevron_right_rounded),
                        onTap: () {
                          Navigator.pop(sheet);
                          Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => s == 'Particular'
                                  ? const _CoveragesScreen(
                                      subtype: 'Particular',
                                    )
                                  : _CoveragesScreen(
                                      subtype: s,
                                      coverages: const [],
                                    ),
                            ),
                          );
                        },
                      ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Coberturas with prima in USD; Adquirir stays grey until one is picked
/// (F38.3).
class _CoveragesScreen extends StatefulWidget {
  const _CoveragesScreen({
    required this.subtype,
    this.coverages = particularCoverages,
  });

  final String subtype;
  final List<Coverage> coverages;

  @override
  State<_CoveragesScreen> createState() => _CoveragesScreenState();
}

class _CoveragesScreenState extends State<_CoveragesScreen> {
  Coverage? _selected;

  @override
  Widget build(BuildContext context) {
    return FlowScaffold(
      title: 'Seguros',
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        children: [
          const FlowStepper(
            steps: _steps,
            current: 2,
            color: AppColors.insurance,
          ),
          _Heading('Pólizas · ${widget.subtype}'),
          if (widget.coverages.isEmpty)
            const EmptyState(message: 'Coberturas aún no disponibles')
          else
            for (final c in widget.coverages)
              OptionCard(
                title: c.name,
                subtitle: 'USD ${c.premiumUsd.toStringAsFixed(2)} prima',
                leading: const TintIcon(
                  Icons.car_crash_outlined,
                  color: AppColors.insurance,
                ),
                selected: _selected == c,
                accent: AppColors.insurance,
                onTap: () => setState(() => _selected = c),
              ),
        ],
      ),
      bottom: PillButton(
        label: 'Adquirir',
        onPressed: _selected == null
            ? null
            : () => showActionReview(
                context,
                action: 'adquirir',
                summary: {
                  'Póliza': 'Responsabilidad civil vehicular',
                  'Aseguradora': 'Seguros Caracas',
                  'Tipo de vehículo': widget.subtype,
                  'Cobertura': _selected!.name,
                  'Prima':
                      'USD ${_selected!.premiumUsd.toStringAsFixed(2)} (sujeta a cotización)',
                },
              ),
      ),
    );
  }
}

class _Heading extends StatelessWidget {
  const _Heading(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 8, 0, 18),
      child: Text(
        text,
        style: const TextStyle(
          fontSize: 20,
          fontWeight: FontWeight.w600,
          color: Color(0xFFB4B5BD),
        ),
      ),
    );
  }
}
