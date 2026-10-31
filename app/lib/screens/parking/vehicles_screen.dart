import 'package:flutter/material.dart';

import '../../theme/app_colors.dart';
import '../../widgets/flow_widgets.dart';

/// Mis vehículos with the empty state and +Afiliar vehículo (F32.1).
class VehiclesScreen extends StatelessWidget {
  const VehiclesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return FlowScaffold(
      title: 'Mis vehículos',
      body: const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.directions_car_outlined,
              size: 96,
              color: Color(0xFFB4B5BD),
            ),
            SizedBox(height: 12),
            Text(
              'Afilia tu primer vehículo',
              style: TextStyle(fontSize: 18, color: AppColors.textSecondary),
            ),
          ],
        ),
      ),
      bottom: PillButton(
        label: '+ Afiliar vehículo',
        onPressed: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const AffiliateVehicleScreen()),
        ),
      ),
    );
  }
}

/// Afiliar vehículo, step 1 of 2: Título de propiedad (F32.2). Plate, brand,
/// model and color weren't observed in this step, so they aren't asked.
class AffiliateVehicleScreen extends StatefulWidget {
  const AffiliateVehicleScreen({super.key});

  @override
  State<AffiliateVehicleScreen> createState() => _AffiliateVehicleScreenState();
}

class _AffiliateVehicleScreenState extends State<AffiliateVehicleScreen> {
  String? _document;

  Future<void> _pickDocument() async {
    final source = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      backgroundColor: AppColors.surface,
      builder: (sheet) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: const Text('Tomar foto'),
              onTap: () => Navigator.pop(sheet, 'Foto del título'),
            ),
            ListTile(
              leading: const Icon(Icons.attach_file_rounded),
              title: const Text('Elegir archivo'),
              onTap: () => Navigator.pop(sheet, 'Archivo del título'),
            ),
          ],
        ),
      ),
    );
    if (source != null) setState(() => _document = source);
  }

  @override
  Widget build(BuildContext context) {
    return FlowScaffold(
      title: 'Afiliar vehículo',
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              for (var i = 0; i < 2; i++)
                Container(
                  margin: const EdgeInsets.symmetric(horizontal: 4),
                  width: i == 0 ? 60 : 30,
                  height: 5,
                  decoration: BoxDecoration(
                    color: i == 0 ? AppColors.primary : AppColors.border,
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 40),
          const Icon(
            Icons.directions_car_filled_outlined,
            size: 120,
            color: AppColors.navy,
          ),
          const SizedBox(height: 40),
          const Text(
            'Sube tu título de propiedad',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 17, color: AppColors.textSecondary),
          ),
          const SizedBox(height: 20),
          OptionCard(
            title: 'Título de propiedad',
            subtitle: _document ?? 'Foto o archivo del documento',
            selected: _document != null,
            leading: const TintIcon(
              Icons.badge_outlined,
              color: AppColors.navy,
            ),
            onTap: _pickDocument,
          ),
        ],
      ),
      bottom: PillButton(
        label: 'Continuar',
        onPressed: _document == null
            ? null
            : () => showActionReview(
                context,
                action: 'enviar el documento',
                summary: {'Documento': _document!, 'Paso': '1 de 2'},
              ),
      ),
    );
  }
}
