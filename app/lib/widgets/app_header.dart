import 'package:flutter/material.dart';

import '../data/models.dart';
import '../theme/app_colors.dart';
import 'common.dart';

/// Avatar, username and level, plus streak / notifications / support buttons.
class AppHeader extends StatelessWidget {
  const AppHeader({
    super.key,
    required this.profile,
    this.showNotifications = true,
  });

  final UserProfile profile;
  final bool showNotifications;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => openPlaceholder(context, 'Mi perfil'),
            child: _Avatar(url: profile.avatarUrl),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        '@${profile.username}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    if (profile.verified) ...[
                      const SizedBox(width: 6),
                      const Icon(
                        Icons.verified,
                        size: 20,
                        color: Color(0xFF8E8E96),
                      ),
                    ],
                  ],
                ),
                Text(
                  'Nivel ${profile.level}',
                  style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 14,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          _StreakButton(
            progress: profile.streakProgress,
            onTap: () => openPlaceholder(context, 'Racha'),
          ),
          if (showNotifications) ...[
            const SizedBox(width: 12),
            RoundIconButton(
              icon: Icons.notifications_none_rounded,
              tooltip: 'Notificaciones',
              onTap: () => openPlaceholder(context, 'Notificaciones'),
            ),
          ],
          const SizedBox(width: 12),
          RoundIconButton(
            icon: Icons.headset_mic_outlined,
            tooltip: 'Soporte',
            onTap: () => openPlaceholder(context, 'Soporte'),
          ),
        ],
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({this.url});

  final String? url;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        color: Color(0xFFE2E3E8),
      ),
      child: CircleAvatar(
        radius: 25,
        backgroundColor: const Color(0xFFF7F7F9),
        foregroundImage: url == null ? null : NetworkImage(url!),
        child: const Icon(
          Icons.person_outline_rounded,
          color: Color(0xFF9A9AA2),
          size: 30,
        ),
      ),
    );
  }
}

class _StreakButton extends StatelessWidget {
  const _StreakButton({required this.progress, this.onTap});

  final double progress;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 56,
        height: 56,
        decoration: const BoxDecoration(
          color: AppColors.surface,
          shape: BoxShape.circle,
        ),
        child: Stack(
          alignment: Alignment.center,
          children: [
            SizedBox.square(
              dimension: 46,
              child: CircularProgressIndicator(
                value: progress,
                strokeWidth: 3,
                backgroundColor: const Color(0xFFE6E6EB),
                color: AppColors.primary,
              ),
            ),
            const Icon(
              Icons.local_fire_department_outlined,
              color: AppColors.primary,
              size: 24,
            ),
          ],
        ),
      ),
    );
  }
}
