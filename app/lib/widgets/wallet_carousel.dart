import 'package:flutter/material.dart';

import '../data/models.dart';
import '../theme/app_colors.dart';
import '../utils/format.dart';
import 'common.dart';

class WalletAction {
  const WalletAction(this.icon, this.label, {this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback? onTap;
}

/// Horizontal strip: "Afilia tu cuenta bancaria", balance card, Credirecto.
class WalletCarousel extends StatelessWidget {
  const WalletCarousel({
    super.key,
    required this.wallet,
    required this.actions,
  });

  final Wallet wallet;
  final List<WalletAction> actions;

  static const _cardHeight = 228.0;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: _cardHeight + 24,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        children: [
          _AffiliateBankCard(
            onTap: () => openPlaceholder(context, 'Afilia tu cuenta bancaria'),
          ),
          const SizedBox(width: 14),
          _BalanceCard(wallet: wallet, actions: actions),
          const SizedBox(width: 14),
          const _CredirectoCard(),
        ],
      ),
    );
  }
}

BoxDecoration _framedCard({Gradient? gradient, Color? color}) => BoxDecoration(
  color: color,
  gradient: gradient,
  borderRadius: BorderRadius.circular(26),
  border: Border.all(color: Colors.white, width: 5),
  boxShadow: kCardShadow,
);

class _AffiliateBankCard extends StatelessWidget {
  const _AffiliateBankCard({this.onTap});

  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 84,
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: const Color(0xFFF5D3DD)),
          boxShadow: kCardShadow,
        ),
        child: const Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircleAvatar(
              radius: 21,
              backgroundColor: AppColors.primary,
              child: Icon(Icons.add_rounded, color: Colors.white, size: 26),
            ),
            SizedBox(height: 14),
            Text(
              'Afilia tu\ncuenta\nbancaria',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                height: 1.35,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _BalanceCard extends StatelessWidget {
  const _BalanceCard({required this.wallet, required this.actions});

  final Wallet wallet;
  final List<WalletAction> actions;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 300,
      clipBehavior: Clip.antiAlias,
      decoration: _framedCard(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFFF2185E), Color(0xFFC8155C), Color(0xFF3A1452)],
          stops: [0, 0.55, 1],
        ),
      ),
      child: Stack(
        children: [
          // Decorative rings echoing the brand mark.
          Positioned(
            right: -60,
            top: -70,
            child: _Ring(
              size: 220,
              color: const Color(0xFF1D2A8A).withValues(alpha: 0.65),
            ),
          ),
          Positioned(
            left: -40,
            bottom: -90,
            child: _Ring(
              size: 200,
              color: const Color(0xFF1D2A8A).withValues(alpha: 0.5),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 22, 18, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Text(
                      'pd',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 46,
                        height: 1,
                        fontWeight: FontWeight.w900,
                        letterSpacing: -4,
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        alignment: Alignment.centerLeft,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Saldo disponible',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 16,
                                letterSpacing: 0.4,
                              ),
                            ),
                            Text(
                              formatBs(wallet.balance),
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 26,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
                const Spacer(),
                Row(
                  children: [
                    for (final a in actions)
                      Expanded(child: _ActionButton(action: a)),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Ring extends StatelessWidget {
  const _Ring({required this.size, required this.color});

  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: color, width: 34),
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({required this.action});

  final WalletAction action;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: action.onTap,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.all(4),
        child: Column(
          children: [
            Container(
              width: 50,
              height: 50,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withValues(alpha: 0.28),
              ),
              child: Icon(action.icon, color: Colors.white, size: 24),
            ),
            const SizedBox(height: 6),
            Text(
              action.label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: Colors.white, fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }
}

class _CredirectoCard extends StatelessWidget {
  const _CredirectoCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 300,
      padding: const EdgeInsets.fromLTRB(18, 22, 18, 22),
      decoration: _framedCard(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF1C1C1C), Color(0xFF262B12), AppColors.lime],
          stops: [0, 0.55, 1],
        ),
      ),
      child: const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.link_rounded, color: AppColors.lime, size: 32),
              SizedBox(width: 6),
              Text(
                'Credirecto',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 22,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          Spacer(),
          Text(
            'Credirecto está en camino',
            style: TextStyle(
              color: Colors.white,
              fontSize: 15,
              fontWeight: FontWeight.w700,
            ),
          ),
          SizedBox(height: 4),
          Text(
            'Todavía no está disponible para tu cuenta. Te avisamos apenas lo habilitemos.',
            style: TextStyle(color: Colors.white70, fontSize: 12),
          ),
        ],
      ),
    );
  }
}
