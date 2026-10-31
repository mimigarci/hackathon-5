import 'package:flutter/material.dart';

import '../../data/catalog.dart';
import '../../theme/app_colors.dart';
import '../../widgets/flow_widgets.dart';
import 'billing_sheet.dart';

const _jomiIcons = <String, IconData>{
  'Plomería': Icons.plumbing_rounded,
  'Mecánica': Icons.car_repair_outlined,
  'Línea blanca': Icons.local_laundry_service_outlined,
  'Electricidad': Icons.electrical_services_rounded,
  'Construcción': Icons.construction_rounded,
};

/// JOMI: categoría → ¿Autocompletar? → Tus datos (F29). Only Plomería's
/// form was observed; the same form is used for every category until each
/// one is walked through.
class JomiScreen extends StatelessWidget {
  const JomiScreen({super.key});

  Future<void> _pick(BuildContext context, String category) async {
    final autofill = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('¿Autocompletar formulario?'),
        content: const Text(
          'Usaremos el nombre y teléfono de tu cuenta. Elige Sí solo si '
          'el servicio es para ti.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('No'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Sí'),
          ),
        ],
      ),
    );
    if (autofill == null || !context.mounted) return;
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => _JomiForm(category: category, autofill: autofill),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final color = catalogEntry('jomi')!.color;
    return FlowScaffold(
      title: 'Jomi',
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
        children: [
          const Padding(
            padding: EdgeInsets.only(bottom: 16),
            child: Text(
              '¿Qué necesitas resolver?',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w600),
            ),
          ),
          for (final c in jomiCategories)
            OptionCard(
              title: c,
              leading: TintIcon(_jomiIcons[c]!, color: color),
              onTap: () => _pick(context, c),
            ),
        ],
      ),
    );
  }
}

class _JomiForm extends StatefulWidget {
  const _JomiForm({required this.category, required this.autofill});

  final String category;
  final bool autofill;

  @override
  State<_JomiForm> createState() => _JomiFormState();
}

class _JomiFormState extends State<_JomiForm> {
  late final _name = TextEditingController(
    text: widget.autofill
        ? '${BillingProfile.instance.firstName} ${BillingProfile.instance.lastName}'
              .trim()
        : '',
  );
  late final _phone = TextEditingController(
    text: widget.autofill ? BillingProfile.instance.phone : '',
  );
  final _address = TextEditingController();
  final _description = TextEditingController();

  @override
  void dispose() {
    for (final c in [_name, _phone, _address, _description]) {
      c.dispose();
    }
    super.dispose();
  }

  bool get _ready =>
      [_name, _phone, _address].every((c) => c.text.trim().isNotEmpty);

  @override
  Widget build(BuildContext context) {
    const gap = SizedBox(height: 24);
    void refresh(String _) => setState(() {});
    return FlowScaffold(
      title: widget.category,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(24, 8, 24, 20),
        children: [
          const Text(
            'Tus datos',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w600),
          ),
          gap,
          FlowTextField(
            controller: _name,
            label: 'Nombre completo*',
            onChanged: refresh,
          ),
          gap,
          FlowTextField(
            controller: _phone,
            label: 'Teléfono*',
            numeric: true,
            onChanged: refresh,
          ),
          gap,
          FlowTextField(
            controller: _address,
            label: 'Dirección*',
            onChanged: refresh,
          ),
          gap,
          FlowTextField(
            controller: _description,
            label: 'Descripción del problema (opcional)',
            maxLines: 4,
          ),
          gap,
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Row(
              children: [
                Icon(Icons.chat_outlined, color: Color(0xFF25D366)),
                SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Al continuar, JOMI te contactará para coordinar el '
                    'servicio.',
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      bottom: PillButton(
        label: 'Continuar',
        onPressed: !_ready
            ? null
            : () => showActionReview(
                context,
                action: 'compartir tus datos con JOMI',
                summary: {
                  'Categoría': widget.category,
                  'Nombre': _name.text.trim(),
                  'Teléfono': _phone.text.trim(),
                  'Dirección': _address.text.trim(),
                  if (_description.text.trim().isNotEmpty)
                    'Descripción': _description.text.trim(),
                },
              ),
      ),
    );
  }
}
