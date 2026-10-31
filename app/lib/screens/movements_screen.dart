import 'package:flutter/material.dart';

import '../data/app_state.dart';
import '../data/models.dart';
import '../theme/app_colors.dart';
import '../widgets/app_header.dart';
import '../widgets/common.dart';
import '../widgets/list_tiles.dart';
import '../widgets/segmented_tabs.dart';
import '../widgets/wallet_carousel.dart';

enum _Period {
  all('Todos', null),
  week('7 días', Duration(days: 7)),
  month('30 días', Duration(days: 30));

  const _Period(this.label, this.window);

  final String label;
  final Duration? window;
}

class MovementsScreen extends StatefulWidget {
  const MovementsScreen({super.key});

  @override
  State<MovementsScreen> createState() => _MovementsScreenState();
}

class _MovementsScreenState extends State<MovementsScreen> {
  int _typeFilter = 0; // 0 = todos, 1 = ingresos, 2 = egresos
  _Period _period = _Period.all;

  List<Movement> _filter(List<Movement> all) {
    final now = DateTime.now();
    return all.where((m) {
      if (_typeFilter == 1 && m.type != MovementType.income) return false;
      if (_typeFilter == 2 && m.type != MovementType.expense) return false;
      final window = _period.window;
      return window == null || now.difference(m.createdAt) <= window;
    }).toList();
  }

  Future<void> _pickPeriod() async {
    final picked = await showModalBottomSheet<_Period>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (final p in _Period.values)
              ListTile(
                title: Text(p.label),
                trailing: p == _period
                    ? const Icon(Icons.check, color: AppColors.primary)
                    : null,
                onTap: () => Navigator.pop(context, p),
              ),
          ],
        ),
      ),
    );
    if (picked != null) setState(() => _period = picked);
  }

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final profile = state.profile;
    if (profile == null) return const LoadingView();

    final movements = _filter(state.movements);

    return SafeArea(
      bottom: false,
      child: Column(
        children: [
          AppHeader(profile: profile, showNotifications: false),
          Expanded(
            child: RefreshIndicator(
              onRefresh: state.load,
              child: ListView(
                padding: const EdgeInsets.only(bottom: kNavBarClearance),
                children: [
                  WalletCarousel(
                    wallet: state.wallet,
                    actions: [
                      WalletAction(
                        Icons.person_outline_rounded,
                        'Extensiones',
                        onTap: () => openPlaceholder(context, 'Extensiones'),
                      ),
                      WalletAction(
                        Icons.receipt_outlined,
                        'Facturas',
                        onTap: () => openPlaceholder(context, 'Facturas'),
                      ),
                      WalletAction(
                        Icons.account_balance_wallet_outlined,
                        'Depositar',
                        onTap: () => openPlaceholder(context, 'Depositar'),
                      ),
                    ],
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 16, 12, 16),
                    child: Row(
                      children: [
                        Expanded(
                          child: SegmentedTabs(
                            labels: const ['Todos', 'Ingresos', 'Egresos'],
                            selected: _typeFilter,
                            onChanged: (i) => setState(() => _typeFilter = i),
                          ),
                        ),
                        TextButton.icon(
                          onPressed: _pickPeriod,
                          icon: const Icon(
                            Icons.sort_rounded,
                            color: AppColors.textSecondary,
                          ),
                          label: Text(
                            _period.label,
                            style: const TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 16,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (movements.isEmpty)
                    const EmptyState()
                  else
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      child: Column(
                        children: [
                          for (final m in movements) MovementTile(movement: m),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
