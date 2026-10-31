import 'package:flutter/material.dart';

import '../../theme/app_colors.dart';
import '../../widgets/common.dart';
import '../../widgets/flow_widgets.dart';

/// Sample list of supported places until search_supported_locations exists.
const _sampleLocations = [
  ('C.C. Sambil Caracas', 'Chacao, Caracas'),
  ('C.C. Líder', 'La California, Caracas'),
  ('C.C. San Ignacio', 'La Castellana, Caracas'),
];

/// Ubicaciones disponibles: category + Nombre del lugar search (F35).
class LocationsScreen extends StatefulWidget {
  const LocationsScreen({super.key, this.category = 'Estacionamientos'});

  final String category;

  @override
  State<LocationsScreen> createState() => _LocationsScreenState();
}

class _LocationsScreenState extends State<LocationsScreen> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final q = _query.trim().toLowerCase();
    final results = [
      for (final l in _sampleLocations)
        if (q.isEmpty || l.$1.toLowerCase().contains(q)) l,
    ];
    return FlowScaffold(
      title: 'Ubicaciones disponibles',
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: Chip(
              label: Text(widget.category),
              backgroundColor: AppColors.primary,
              labelStyle: const TextStyle(color: Colors.white),
              side: BorderSide.none,
              shape: const StadiumBorder(),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            onChanged: (v) => setState(() => _query = v),
            decoration: InputDecoration(
              hintText: 'Nombre del lugar',
              prefixIcon: const Icon(Icons.search_rounded),
              filled: true,
              fillColor: AppColors.surface,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(30),
                borderSide: BorderSide.none,
              ),
            ),
          ),
          const SizedBox(height: 16),
          if (results.isEmpty)
            const EmptyState()
          else
            for (final (name, area) in results)
              OptionCard(
                title: name,
                subtitle: area,
                leading: const TintIcon(
                  Icons.location_on_outlined,
                  color: AppColors.parking,
                ),
                onTap: () => openPlaceholder(context, name),
              ),
        ],
      ),
    );
  }
}
