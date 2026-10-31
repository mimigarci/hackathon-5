import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import 'mascot.dart';

class _NavEntry {
  const _NavEntry(this.icon, this.activeIcon, this.label);

  final IconData icon;
  final IconData activeIcon;
  final String label;
}

const _entries = [
  _NavEntry(Icons.home_outlined, Icons.home_rounded, 'Home'),
  _NavEntry(
    Icons.receipt_long_outlined,
    Icons.receipt_long_rounded,
    'Movimientos',
  ),
  _NavEntry(
    Icons.pending_actions_outlined,
    Icons.pending_actions_rounded,
    'Mis pagos',
  ),
  _NavEntry(Icons.menu_rounded, Icons.menu_rounded, 'Menu'),
];

/// White bar with a notch in the middle where the mascot sits.
class AppBottomNav extends StatelessWidget {
  const AppBottomNav({
    super.key,
    required this.currentIndex,
    required this.onTap,
    required this.mood,
    required this.onMascotTap,
  });

  final int currentIndex;
  final ValueChanged<int> onTap;
  final MascotMood mood;
  final VoidCallback onMascotTap;

  static const barHeight = 74.0;
  static const mascotSize = 80.0;

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.paddingOf(context).bottom;
    Widget item(int i) => Expanded(
      child: _NavItem(
        entry: _entries[i],
        selected: i == currentIndex,
        onTap: () => onTap(i),
      ),
    );

    return SizedBox(
      height: barHeight + bottomInset + mascotSize / 2,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            height: barHeight + bottomInset,
            child: CustomPaint(
              painter: const _NavBarPainter(notchRadius: mascotSize / 2 + 6),
              child: Padding(
                padding: EdgeInsets.only(bottom: bottomInset, top: 6),
                child: Row(
                  children: [
                    item(0),
                    item(1),
                    const SizedBox(width: mascotSize + 12),
                    item(2),
                    item(3),
                  ],
                ),
              ),
            ),
          ),
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: Center(
              child: Semantics(
                button: true,
                label: 'Asistente',
                child: GestureDetector(
                  onTap: onMascotTap,
                  child: Mascot(mood: mood, size: mascotSize),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.entry,
    required this.selected,
    required this.onTap,
  });

  final _NavEntry entry;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = selected ? AppColors.primary : const Color(0xFF8A8A93);
    return InkResponse(
      onTap: onTap,
      radius: 36,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            selected ? entry.activeIcon : entry.icon,
            color: color,
            size: 28,
          ),
          const SizedBox(height: 4),
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              entry.label,
              style: TextStyle(fontSize: 13, color: color),
            ),
          ),
        ],
      ),
    );
  }
}

class _NavBarPainter extends CustomPainter {
  const _NavBarPainter({required this.notchRadius});

  final double notchRadius;

  @override
  void paint(Canvas canvas, Size size) {
    const corner = 30.0;
    const blend = 14.0;
    final cx = size.width / 2;
    final nr = notchRadius;

    final path = Path()
      ..moveTo(0, corner)
      ..quadraticBezierTo(0, 0, corner, 0)
      ..lineTo(cx - nr - blend, 0)
      ..quadraticBezierTo(cx - nr, 0, cx - nr + 2, blend * 0.6)
      ..arcToPoint(
        Offset(cx + nr - 2, blend * 0.6),
        radius: Radius.circular(nr),
        clockwise: false,
      )
      ..quadraticBezierTo(cx + nr, 0, cx + nr + blend, 0)
      ..lineTo(size.width - corner, 0)
      ..quadraticBezierTo(size.width, 0, size.width, corner)
      ..lineTo(size.width, size.height)
      ..lineTo(0, size.height)
      ..close();

    canvas.drawShadow(path, Colors.black.withValues(alpha: 0.25), 10, false);
    canvas.drawPath(path, Paint()..color = AppColors.surface);
  }

  @override
  bool shouldRepaint(_NavBarPainter old) => old.notchRadius != notchRadius;
}
