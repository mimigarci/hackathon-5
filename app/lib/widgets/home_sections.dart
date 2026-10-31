import 'package:flutter/material.dart';

import '../data/models.dart';
import '../theme/app_colors.dart';

// ---------------------------------------------------------------------------
// Club PagoDirecto
// ---------------------------------------------------------------------------

const _clubIcons = <String, IconData>{
  'key': Icons.manage_accounts_outlined,
  'car': Icons.directions_car_outlined,
};

class ClubCarousel extends StatelessWidget {
  const ClubCarousel({
    super.key,
    required this.tasks,
    required this.onComplete,
  });

  final List<ClubTask> tasks;
  final ValueChanged<ClubTask> onComplete;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 136,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        itemCount: tasks.length,
        separatorBuilder: (_, _) => const SizedBox(width: 14),
        itemBuilder: (_, i) => _ClubTaskCard(
          task: tasks[i],
          onComplete: () => onComplete(tasks[i]),
        ),
      ),
    );
  }
}

class _ClubTaskCard extends StatelessWidget {
  const _ClubTaskCard({required this.task, required this.onComplete});

  final ClubTask task;
  final VoidCallback onComplete;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 340,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(26),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 66,
            height: 66,
            decoration: BoxDecoration(
              color: AppColors.background,
              borderRadius: BorderRadius.circular(18),
            ),
            child: Icon(
              _clubIcons[task.icon] ?? Icons.star_border_rounded,
              color: AppColors.primary,
              size: 34,
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        task.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    Text(
                      '+${task.points} pts',
                      style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Expanded(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Expanded(
                        child: Text(
                          task.description,
                          maxLines: 3,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 14,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      task.completed
                          ? const Icon(
                              Icons.check_circle,
                              color: AppColors.income,
                            )
                          : FilledButton(
                              onPressed: onComplete,
                              style: FilledButton.styleFrom(
                                backgroundColor: AppColors.primary,
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 14,
                                ),
                                minimumSize: const Size(0, 38),
                                textStyle: const TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              child: const Text('Completar'),
                            ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Mis pagos (registered services)
// ---------------------------------------------------------------------------

class MyServicesRow extends StatelessWidget {
  const MyServicesRow({
    super.key,
    required this.services,
    required this.onRegister,
    required this.onServiceTap,
  });

  final List<ServiceProvider> services;
  final VoidCallback onRegister;
  final ValueChanged<ServiceProvider> onServiceTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 100,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        children: [
          _ServiceTile(
            onTap: onRegister,
            child: const Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.add_rounded, size: 30),
                SizedBox(height: 4),
                Text(
                  'Registra tu\nservicio',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                ),
              ],
            ),
          ),
          for (final s in services) ...[
            const SizedBox(width: 10),
            _ServiceTile(
              onTap: () => onServiceTap(s),
              child: ServiceLogo(service: s),
            ),
          ],
        ],
      ),
    );
  }
}

class _ServiceTile extends StatelessWidget {
  const _ServiceTile({required this.child, this.onTap});

  final Widget child;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(22),
      child: InkWell(
        borderRadius: BorderRadius.circular(22),
        onTap: onTap,
        child: SizedBox(width: 112, height: 100, child: Center(child: child)),
      ),
    );
  }
}

/// Text wordmark in the provider's brand color. Swap for real logo assets
/// (Image.network on a `logo_url` column) when you have them.
class ServiceLogo extends StatelessWidget {
  const ServiceLogo({super.key, required this.service, this.fontSize = 20});

  final ServiceProvider service;
  final double fontSize;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8),
      child: FittedBox(
        fit: BoxFit.scaleDown,
        child: Text(
          service.name.toUpperCase(),
          style: TextStyle(
            color: service.brandColor,
            fontSize: fontSize,
            fontWeight: FontWeight.w800,
            letterSpacing: 1,
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Funciones
// ---------------------------------------------------------------------------

class AppFunction {
  const AppFunction(this.label, this.icon, this.color);

  final String label;
  final IconData icon;
  final Color color;
}

const appFunctions = [
  AppFunction(
    'Estacionamiento',
    Icons.directions_car_outlined,
    AppColors.parking,
  ),
  AppFunction('Servicios', Icons.receipt_long_outlined, AppColors.services),
  AppFunction('Parquímetros', Icons.local_parking_rounded, AppColors.meters),
  AppFunction('Seguros', Icons.health_and_safety_outlined, AppColors.insurance),
  AppFunction(
    'Boletería',
    Icons.confirmation_number_outlined,
    AppColors.tickets,
  ),
  AppFunction('Donaciones', Icons.favorite_border_rounded, AppColors.donations),
];

class FunctionsGrid extends StatelessWidget {
  const FunctionsGrid({super.key, required this.onTap});

  final ValueChanged<AppFunction> onTap;

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      crossAxisCount: 4,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 20),
      mainAxisSpacing: 12,
      crossAxisSpacing: 8,
      childAspectRatio: 0.78,
      children: [
        for (final f in appFunctions)
          _FunctionTile(function: f, onTap: () => onTap(f)),
      ],
    );
  }
}

class _FunctionTile extends StatelessWidget {
  const _FunctionTile({required this.function, required this.onTap});

  final AppFunction function;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = function.color;
    return GestureDetector(
      onTap: onTap,
      child: Column(
        children: [
          Expanded(
            child: AspectRatio(
              aspectRatio: 1,
              child: Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(22),
                  border: Border.all(color: c, width: 2.5),
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [Colors.white, c.withValues(alpha: 0.12)],
                  ),
                ),
                child: Icon(function.icon, color: c, size: 36),
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            function.label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Sugerencias
// ---------------------------------------------------------------------------

class Suggestion {
  const Suggestion({
    required this.brand,
    required this.headline,
    required this.highlight,
    required this.tags,
    required this.colors,
  });

  final String brand;
  final String headline;
  final String highlight;
  final List<String> tags;
  final List<Color> colors;
}

const suggestions = [
  Suggestion(
    brand: 'Jomi',
    headline: 'Pídelo acá.\nCon Jomi ',
    highlight: 'resuelves.',
    tags: [
      'Línea blanca',
      'Mecánica',
      'Electricidad',
      'Construcción',
      'Plomería',
    ],
    colors: [Color(0xFF6B5A4E), Color(0xFF2A221D)],
  ),
  Suggestion(
    brand: 'Seguros',
    headline: 'Tu moto,\n',
    highlight: 'protegida.',
    tags: ['RCV', 'Cobertura amplia', 'Asistencia vial'],
    colors: [Color(0xFFF2994A), Color(0xFF7A3410)],
  ),
];

class SuggestionsCarousel extends StatelessWidget {
  const SuggestionsCarousel({super.key, required this.onTap});

  final ValueChanged<Suggestion> onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 250,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        itemCount: suggestions.length,
        separatorBuilder: (_, _) => const SizedBox(width: 14),
        itemBuilder: (_, i) => GestureDetector(
          onTap: () => onTap(suggestions[i]),
          child: _SuggestionBanner(s: suggestions[i]),
        ),
      ),
    );
  }
}

class _SuggestionBanner extends StatelessWidget {
  const _SuggestionBanner({required this.s});

  final Suggestion s;

  @override
  Widget build(BuildContext context) {
    const yellow = Color(0xFFFFD233);
    return Container(
      width: 340,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(28),
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: s.colors,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                s.brand,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 26,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(width: 4),
              const Icon(
                Icons.sentiment_satisfied_alt_rounded,
                color: yellow,
                size: 24,
              ),
            ],
          ),
          const Spacer(),
          Text.rich(
            TextSpan(
              text: s.headline,
              children: [
                TextSpan(
                  text: s.highlight,
                  style: const TextStyle(color: yellow),
                ),
              ],
            ),
            style: const TextStyle(
              color: Colors.white,
              fontSize: 26,
              height: 1.15,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final t in s.tags)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    t,
                    style: const TextStyle(color: Colors.white, fontSize: 12),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
