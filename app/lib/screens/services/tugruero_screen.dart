import 'package:flutter/material.dart';

import '../../data/catalog.dart';
import '../../theme/app_colors.dart';
import '../../widgets/common.dart';
import '../../widgets/flow_widgets.dart';

/// TuGruero: categoría → Planes disponibles (F24). "Desde" prices are never
/// presented as a final quote.
class TuGrueroScreen extends StatelessWidget {
  const TuGrueroScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final color = catalogEntry('tugruero')!.color;
    return FlowScaffold(
      title: 'TuGruero',
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
        children: [
          const Padding(
            padding: EdgeInsets.only(bottom: 16),
            child: Text(
              'Elige una categoría',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w600),
            ),
          ),
          for (final c in towCategories)
            OptionCard(
              title: c,
              leading: TintIcon(
                c == 'Moto'
                    ? Icons.two_wheeler_rounded
                    : Icons.directions_car_outlined,
                color: color,
              ),
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => _TowPlansScreen(category: c)),
              ),
            ),
        ],
      ),
      bottom: FlowBottomNav(
        items: [
          FlowNavItem(Icons.add_shopping_cart_rounded, 'Adquirir plan', () {}),
          FlowNavItem(
            Icons.history_rounded,
            'Historial',
            () => openPlaceholder(context, 'Historial TuGruero'),
          ),
          FlowNavItem(
            Icons.headset_mic_outlined,
            'Soporte',
            () => openPlaceholder(context, 'Soporte TuGruero'),
          ),
        ],
      ),
    );
  }
}

class _TowPlansScreen extends StatefulWidget {
  const _TowPlansScreen({required this.category});

  final String category;

  @override
  State<_TowPlansScreen> createState() => _TowPlansScreenState();
}

class _TowPlansScreenState extends State<_TowPlansScreen> {
  int _period = 0;
  TowPlan? _selected;
  late final Future<void> _loading = Future.delayed(
    const Duration(milliseconds: 800),
  );

  @override
  Widget build(BuildContext context) {
    final color = catalogEntry('tugruero')!.color;
    final annual = _period == 0;
    return FlowScaffold(
      title: 'Planes disponibles',
      body: FutureBuilder(
        future: _loading,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          return ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
            children: [
              PillTabs(
                labels: const ['Anuales', 'Mensuales'],
                selected: _period,
                onChanged: (i) => setState(() => _period = i),
              ),
              const SizedBox(height: 24),
              for (final p in towPlans)
                OptionCard(
                  title: '${p.name} · ${widget.category}',
                  subtitle:
                      'Desde USD ${(annual ? p.annualFrom : p.monthlyFrom).toStringAsFixed(2)}',
                  leading: TintIcon(
                    Icons.local_shipping_outlined,
                    color: color,
                  ),
                  selected: _selected == p,
                  accent: color,
                  onTap: () => setState(() => _selected = p),
                ),
              const SizedBox(height: 8),
              const Text(
                'El precio final puede variar según las características del '
                'vehículo y se calcula después de revisar la documentación.',
                style: TextStyle(color: AppColors.textSecondary),
              ),
            ],
          );
        },
      ),
      bottom: PillButton(
        label: 'Adquirir',
        onPressed: _selected == null
            ? null
            : () => showActionReview(
                context,
                action: 'adquirir',
                summary: {
                  'Proveedor': 'TuGruero',
                  'Categoría': widget.category,
                  'Plan': _selected!.name,
                  'Periodicidad': annual ? 'Anual' : 'Mensual',
                  'Precio':
                      'Desde USD ${(annual ? _selected!.annualFrom : _selected!.monthlyFrom).toStringAsFixed(2)} (no es cotización final)',
                },
              ),
      ),
    );
  }
}
