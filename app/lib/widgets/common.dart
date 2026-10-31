import 'package:flutter/material.dart';

import '../data/app_state.dart';
import '../screens/placeholder_screen.dart';
import '../theme/app_colors.dart';

/// Space the scrollable screens leave at the bottom so content clears the
/// floating nav bar and mascot.
const kNavBarClearance = 130.0;

const kCardShadow = [
  BoxShadow(color: Color(0x0F000000), blurRadius: 16, offset: Offset(0, 4)),
];

void openPlaceholder(BuildContext context, String title) {
  Navigator.of(context)
      .push(MaterialPageRoute(builder: (_) => PlaceholderScreen(title: title)));
}

class RoundIconButton extends StatelessWidget {
  const RoundIconButton({
    super.key,
    required this.icon,
    this.onTap,
    this.size = 52,
    this.tooltip,
  });

  final IconData icon;
  final VoidCallback? onTap;
  final double size;
  final String? tooltip;

  @override
  Widget build(BuildContext context) {
    final button = Material(
      color: AppColors.surface,
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: SizedBox.square(
          dimension: size,
          child: Icon(icon, size: size * 0.46, color: AppColors.textPrimary),
        ),
      ),
    );
    return tooltip == null ? button : Tooltip(message: tooltip, child: button);
  }
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.title, {super.key, this.actionLabel, this.onAction});

  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 14),
      child: Row(
        children: [
          Expanded(
            child: Text(
              title,
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w600),
            ),
          ),
          if (actionLabel != null)
            GestureDetector(
              onTap: onAction,
              child: Text(
                actionLabel!,
                style: const TextStyle(
                  color: AppColors.primary,
                  fontSize: 16,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Top bar for pushed pages and Mis pagos: back button, centered title,
/// optional trailing button.
class PageTopBar extends StatelessWidget {
  const PageTopBar({
    super.key,
    required this.title,
    required this.onBack,
    this.trailing,
  });

  final String title;
  final VoidCallback onBack;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
      child: Row(
        children: [
          RoundIconButton(icon: Icons.chevron_left_rounded, onTap: onBack),
          Expanded(
            child: Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w600,
                color: Color(0xFF6B6B73),
              ),
            ),
          ),
          trailing ?? const SizedBox.square(dimension: 52),
        ],
      ),
    );
  }
}

/// Spinner while the first load runs, error + retry if it failed.
class LoadingView extends StatelessWidget {
  const LoadingView({super.key});

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    if (state.error == null) {
      return const Center(child: CircularProgressIndicator());
    }
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'No pudimos cargar tus datos.\n${state.error}',
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: state.load,
              child: const Text('Reintentar'),
            ),
          ],
        ),
      ),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({super.key, this.message = 'Sin resultados'});

  final String message;

  @override
  Widget build(BuildContext context) {
    const color = Color(0xFFB4B5BD);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 56),
      child: Column(
        children: [
          const SizedBox(
            width: 110,
            height: 120,
            child: Stack(
              children: [
                Icon(Icons.insert_drive_file_outlined, size: 110, color: color),
                Positioned(
                  right: 0,
                  bottom: 4,
                  child: Icon(Icons.close_rounded, size: 52, color: color),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Text(message, style: const TextStyle(fontSize: 18, color: color)),
        ],
      ),
    );
  }
}
