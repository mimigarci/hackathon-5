import 'package:flutter/material.dart';

import '../../data/catalog.dart';
import '../../theme/app_colors.dart';
import '../../widgets/flow_widgets.dart';

/// Programar sheet: Pago a usuarios / Servicios Básicos (F30.1).
Future<void> showScheduleSheet(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    backgroundColor: AppColors.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
    ),
    builder: (sheet) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Padding(
              padding: EdgeInsets.only(bottom: 16),
              child: Text(
                'Programar',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
              ),
            ),
            for (final (icon, label, screen) in [
              (
                Icons.people_alt_outlined,
                'Pago a usuarios',
                const ScheduleUserScreen() as Widget,
              ),
              (
                Icons.receipt_long_outlined,
                'Servicios Básicos',
                const ScheduleServiceScreen(),
              ),
            ])
              OptionCard(
                title: label,
                leading: TintIcon(icon),
                onTap: () {
                  Navigator.pop(sheet);
                  Navigator.of(context)
                      .push(MaterialPageRoute(builder: (_) => screen));
                },
              ),
          ],
        ),
      ),
    ),
  );
}

/// Domiciliar pagos: wallet origen + destinatario (F30.2). Frequency, date
/// and amount weren't observed, so they aren't asked for here.
class ScheduleUserScreen extends StatefulWidget {
  const ScheduleUserScreen({super.key});

  @override
  State<ScheduleUserScreen> createState() => _ScheduleUserScreenState();
}

class _ScheduleUserScreenState extends State<ScheduleUserScreen> {
  final _query = TextEditingController();

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FlowScaffold(
      title: 'Domiciliar pagos',
      body: ListView(
        padding: const EdgeInsets.fromLTRB(24, 8, 24, 20),
        children: [
          FlowDropdown<String>(
            label: 'Wallet origen',
            items: const ['Wallet Bs.'],
            value: 'Wallet Bs.',
            onChanged: (_) {},
          ),
          const SizedBox(height: 28),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: FlowTextField(
                  controller: _query,
                  label: 'Nombre de usuario / Cédula',
                  onChanged: (_) => setState(() {}),
                ),
              ),
              IconButton(
                tooltip: 'Buscar',
                icon: const Icon(Icons.search_rounded, size: 28),
                onPressed: _query.text.trim().isEmpty
                    ? null
                    : () => showActionReview(
                        context,
                        action: 'buscar al destinatario',
                        summary: {
                          'Wallet origen': 'Wallet Bs.',
                          'Destinatario': _query.text.trim(),
                        },
                      ),
              ),
              IconButton(
                tooltip: 'Escanear QR',
                icon: const Icon(Icons.qr_code_scanner_rounded, size: 28),
                onPressed: () => showActionReview(
                  context,
                  action: 'escanear un QR',
                  summary: const {'Acción': 'Identificar destinatario por QR'},
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Programar pago de servicio: Elige el servicio → identificador y nombre
/// de contacto (F31).
class ScheduleServiceScreen extends StatefulWidget {
  const ScheduleServiceScreen({super.key});

  @override
  State<ScheduleServiceScreen> createState() => _ScheduleServiceScreenState();
}

class _ScheduleServiceScreenState extends State<ScheduleServiceScreen> {
  static final _options = [
    for (final e in serviceCatalog)
      for (final m in e.modes)
        (
          entry: e,
          mode: m,
          label: [e.name, m.label.toLowerCase()].join(' ').trim(),
        ),
  ];

  int? _selected;
  String? _prefix;
  final _id = TextEditingController();
  final _contact = TextEditingController();

  @override
  void dispose() {
    _id.dispose();
    _contact.dispose();
    super.dispose();
  }

  FieldSpec? get _idField {
    if (_selected == null) return null;
    return _options[_selected!].mode.fields.firstWhere(
      (f) => f.kind != FieldKind.amount && f.kind != FieldKind.select,
    );
  }

  @override
  Widget build(BuildContext context) {
    final field = _idField;
    final withPrefix = field?.kind == FieldKind.phoneWithPrefix;
    final ready =
        field != null &&
        _id.text.trim().isNotEmpty &&
        _contact.text.trim().isNotEmpty;
    return FlowScaffold(
      title: 'Programar pago',
      body: ListView(
        padding: const EdgeInsets.fromLTRB(24, 8, 24, 20),
        children: [
          FlowDropdown<int>(
            label: 'Elige el servicio',
            hint: 'Selecciona',
            items: [for (var i = 0; i < _options.length; i++) i],
            itemLabel: (i) => _options[i].label,
            value: _selected,
            onChanged: (i) => setState(() {
              _selected = i;
              _id.clear();
              final f = _idField!;
              _prefix = f.options.isEmpty ? null : f.options.first;
            }),
          ),
          if (field != null) ...[
            const SizedBox(height: 28),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                if (withPrefix) ...[
                  SizedBox(
                    width: 110,
                    child: FlowDropdown<String>(
                      items: field.options,
                      value: _prefix,
                      onChanged: (v) => setState(() => _prefix = v),
                    ),
                  ),
                  const SizedBox(width: 12),
                ],
                Expanded(
                  child: FlowTextField(
                    controller: _id,
                    label: field.label,
                    hint: field.hint,
                    numeric: true,
                    onChanged: (_) => setState(() {}),
                  ),
                ),
                const ContactsButton(),
              ],
            ),
            const SizedBox(height: 28),
            FlowTextField(
              controller: _contact,
              label: 'Nombre de contacto',
              onChanged: (_) => setState(() {}),
            ),
          ],
        ],
      ),
      bottom: PillButton(
        label: 'Continuar',
        onPressed: !ready
            ? null
            : () => showActionReview(
                context,
                action: 'programar',
                summary: {
                  'Servicio': _options[_selected!].label,
                  field.label: '${withPrefix ? _prefix : ''}${_id.text.trim()}',
                  'Contacto': _contact.text.trim(),
                },
              ),
      ),
    );
  }
}
