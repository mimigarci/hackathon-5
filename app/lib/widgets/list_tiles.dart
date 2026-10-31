import 'package:flutter/material.dart';

import '../data/models.dart';
import '../theme/app_colors.dart';
import '../utils/format.dart';

class _ListCard extends StatelessWidget {
  const _ListCard({
    required this.leading,
    required this.title,
    required this.subtitle,
    required this.trailing,
  });

  final Widget leading;
  final String title;
  final String subtitle;
  final Widget trailing;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(
        children: [
          leading,
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Text(
                  subtitle,
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          trailing,
        ],
      ),
    );
  }
}

class MovementTile extends StatelessWidget {
  const MovementTile({super.key, required this.movement});

  final Movement movement;

  @override
  Widget build(BuildContext context) {
    final income = movement.type == MovementType.income;
    final color = income ? AppColors.income : AppColors.primary;
    return _ListCard(
      leading: CircleAvatar(
        backgroundColor: color.withValues(alpha: 0.12),
        child: Icon(
          income ? Icons.south_west_rounded : Icons.north_east_rounded,
          color: color,
        ),
      ),
      title: movement.title,
      subtitle: [
        if (movement.subtitle != null) movement.subtitle!,
        formatShortDate(movement.createdAt),
      ].join(' · '),
      trailing: Text(
        formatBs(income ? movement.amount : -movement.amount, signed: true),
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w700,
          fontSize: 15,
        ),
      ),
    );
  }
}

class PaymentTile extends StatelessWidget {
  const PaymentTile({super.key, required this.payment});

  final Payment payment;

  static const _dueLabel = {
    PaymentStatus.pending: 'Vence',
    PaymentStatus.scheduled: 'Se paga',
    PaymentStatus.paid: 'Pagado',
  };

  @override
  Widget build(BuildContext context) {
    final due = payment.dueDate;
    return _ListCard(
      leading: const CircleAvatar(
        backgroundColor: AppColors.background,
        child: Icon(Icons.receipt_long_outlined, color: AppColors.textPrimary),
      ),
      title: payment.serviceName,
      subtitle: due == null
          ? ''
          : '${_dueLabel[payment.status]} ${formatShortDate(due)}',
      trailing: Text(
        formatBs(payment.amount, dotted: true),
        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
      ),
    );
  }
}
