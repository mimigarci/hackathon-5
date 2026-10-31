import 'package:flutter/material.dart';

import '../data/app_state.dart';
import '../data/models.dart';
import '../theme/app_colors.dart';
import '../utils/format.dart';
import '../widgets/common.dart';
import '../widgets/list_tiles.dart';
import '../widgets/segmented_tabs.dart';
import 'services/schedule_screen.dart';

class _TabCopy {
  const _TabCopy(this.totalLabel, this.emptyLabel, this.cta);

  final String totalLabel;
  final String emptyLabel;
  final String? cta;
}

const _copy = {
  PaymentStatus.pending: _TabCopy(
    'Total por pagar',
    'No tienes pagos pendientes',
    '+ Afiliar Directorio',
  ),
  PaymentStatus.scheduled: _TabCopy(
    'Total programado',
    'No tienes pagos programados',
    '+ Programar nuevo pago',
  ),
  PaymentStatus.paid: _TabCopy(
    'Total pagado',
    'No tienes pagos realizados',
    null,
  ),
};

class PaymentsScreen extends StatefulWidget {
  const PaymentsScreen({super.key, required this.onBack});

  final VoidCallback onBack;

  @override
  State<PaymentsScreen> createState() => _PaymentsScreenState();
}

class _PaymentsScreenState extends State<PaymentsScreen> {
  PaymentStatus _status = PaymentStatus.pending;

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final payments = state.paymentsWith(_status);
    final total = payments.fold<double>(0, (sum, p) => sum + p.amount);
    final copy = _copy[_status]!;

    return SafeArea(
      bottom: false,
      child: Column(
        children: [
          PageTopBar(
            title: 'Mis pagos',
            onBack: widget.onBack,
            trailing: RoundIconButton(
              icon: Icons.headset_mic_outlined,
              tooltip: 'Soporte',
              onTap: () => openPlaceholder(context, 'Soporte'),
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, kNavBarClearance),
              children: [
                SegmentedTabs(
                  labels: const ['Pendientes', 'Programados', 'Pagados'],
                  selected: _status.index,
                  onChanged: (i) =>
                      setState(() => _status = PaymentStatus.values[i]),
                ),
                const SizedBox(height: 20),
                _TotalCard(
                  label: copy.totalLabel,
                  total: total,
                  caption: payments.isEmpty
                      ? copy.emptyLabel
                      : '${payments.length} ${payments.length == 1 ? 'pago' : 'pagos'}',
                ),
                if (copy.cta != null) ...[
                  const SizedBox(height: 16),
                  SizedBox(
                    height: 62,
                    child: OutlinedButton(
                      onPressed: () => _status == PaymentStatus.scheduled
                          ? showScheduleSheet(context)
                          : openPlaceholder(context, copy.cta!.substring(2)),
                      style: OutlinedButton.styleFrom(
                        backgroundColor: AppColors.surface,
                        foregroundColor: AppColors.textPrimary,
                        side: const BorderSide(color: AppColors.border),
                        shape: const StadiumBorder(),
                        textStyle: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      child: Text(copy.cta!),
                    ),
                  ),
                ],
                const SizedBox(height: 20),
                for (final p in payments) PaymentTile(payment: p),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _TotalCard extends StatelessWidget {
  const _TotalCard({
    required this.label,
    required this.total,
    required this.caption,
  });

  final String label;
  final double total;
  final String caption;

  @override
  Widget build(BuildContext context) {
    const muted = Color(0xFF9A9CB0);
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: AppColors.navy,
        borderRadius: BorderRadius.circular(22),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: muted, fontSize: 16)),
          const SizedBox(height: 4),
          Text(
            formatBs(total, dotted: true),
            style: const TextStyle(
              color: Colors.white,
              fontSize: 34,
              fontWeight: FontWeight.w700,
            ),
          ),
          Text(caption, style: const TextStyle(color: muted, fontSize: 13)),
        ],
      ),
    );
  }
}
