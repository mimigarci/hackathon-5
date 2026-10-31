import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

/// Awake on Home and Mis pagos, bored on Movimientos, asleep after the user
/// has been idle for a while (see MainShell).
enum MascotMood { awake, bored, sleeping }

class Mascot extends StatefulWidget {
  const Mascot({super.key, required this.mood, this.size = 76});

  final MascotMood mood;
  final double size;

  @override
  State<Mascot> createState() => _MascotState();
}

class _MascotState extends State<Mascot> with SingleTickerProviderStateMixin {
  late final _breath = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2400),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _breath.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _breath,
      builder: (context, child) {
        final t = Curves.easeInOut.transform(_breath.value);
        return Transform.translate(offset: Offset(0, -3 * t), child: child);
      },
      child: CustomPaint(
        size: Size.square(widget.size),
        painter: _MascotPainter(widget.mood),
      ),
    );
  }
}

class _MascotPainter extends CustomPainter {
  const _MascotPainter(this.mood);

  final MascotMood mood;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final body = Paint()..color = AppColors.mascot;
    final shade = Paint()..color = AppColors.mascotShade;

    // Soft shadow under the head.
    canvas.drawOval(
      Rect.fromCenter(
        center: Offset(w / 2, h * 0.93),
        width: w * 0.6,
        height: h * 0.12,
      ),
      Paint()
        ..color = Colors.black.withValues(alpha: 0.18)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4),
    );

    // Ears.
    canvas.drawCircle(Offset(w * 0.1, h * 0.55), w * 0.12, shade);
    canvas.drawCircle(Offset(w * 0.9, h * 0.55), w * 0.12, shade);

    // Head + highlight.
    final head = Rect.fromCenter(
      center: Offset(w / 2, h * 0.5),
      width: w * 0.84,
      height: h * 0.86,
    );
    canvas.drawOval(head, body);
    canvas.drawOval(
      Rect.fromCenter(
        center: Offset(w * 0.36, h * 0.2),
        width: w * 0.26,
        height: h * 0.1,
      ),
      Paint()..color = Colors.white.withValues(alpha: 0.2),
    );

    final r = w * 0.15;
    for (final cx in [w * 0.35, w * 0.65]) {
      _paintEye(canvas, Offset(cx, h * 0.52), r, w, shade);
    }
  }

  void _paintEye(Canvas canvas, Offset c, double r, double w, Paint shade) {
    if (mood == MascotMood.sleeping) {
      final lid = Path()
        ..moveTo(c.dx - r * 0.8, c.dy)
        ..quadraticBezierTo(c.dx, c.dy + r * 0.7, c.dx + r * 0.8, c.dy);
      canvas.drawPath(
        lid,
        Paint()
          ..color = AppColors.mascotShade
          ..style = PaintingStyle.stroke
          ..strokeWidth = w * 0.035
          ..strokeCap = StrokeCap.round,
      );
      return;
    }

    final eye = Rect.fromCircle(center: c, radius: r);
    canvas.drawOval(eye, Paint()..color = Colors.white);

    final pupilOffset = mood == MascotMood.bored
        ? Offset(0, r * 0.35)
        : Offset(0, -r * 0.05);
    canvas.drawCircle(
      c + pupilOffset,
      r * 0.45,
      Paint()..color = const Color(0xFF1B1B1F),
    );
    canvas.drawCircle(
      c + pupilOffset + Offset(r * 0.15, -r * 0.15),
      r * 0.12,
      Paint()..color = Colors.white,
    );

    if (mood == MascotMood.bored) {
      // Heavy upper eyelid.
      canvas.save();
      canvas.clipPath(Path()..addOval(eye));
      canvas.drawRect(
        Rect.fromLTRB(eye.left, eye.top, eye.right, c.dy - r * 0.05),
        shade,
      );
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(_MascotPainter old) => old.mood != mood;
}
