import 'package:flutter/material.dart';

import '../../data/catalog.dart';
import '../../theme/app_colors.dart';
import '../../widgets/flow_widgets.dart';

/// Datos de facturación kept for this session only (F13.2). Document, phone
/// and email arrive prefilled; name, last name and address start empty.
class BillingProfile {
  BillingProfile._();

  static final instance = BillingProfile._();

  String firstName = '';
  String lastName = '';
  String documentType = 'V';
  String document = '12345678';
  String countryPrefix = '+58';
  String phone = '4121234567';
  String email = 'usuario@correo.com';
  String address = '';

  bool get isComplete => [
    firstName,
    lastName,
    document,
    phone,
    email,
    address,
  ].every((v) => v.trim().isNotEmpty);
}

/// Bottom sheet with the billing form. Closing it without saving is allowed
/// and must not block the catalog (F13.3, F14.1).
Future<void> showBillingSheet(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    backgroundColor: AppColors.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
    ),
    builder: (_) => const _BillingForm(),
  );
}

class _BillingForm extends StatefulWidget {
  const _BillingForm();

  @override
  State<_BillingForm> createState() => _BillingFormState();
}

class _BillingFormState extends State<_BillingForm> {
  final _p = BillingProfile.instance;
  late final _first = TextEditingController(text: _p.firstName);
  late final _last = TextEditingController(text: _p.lastName);
  late final _doc = TextEditingController(text: _p.document);
  late final _phone = TextEditingController(text: _p.phone);
  late final _email = TextEditingController(text: _p.email);
  late final _address = TextEditingController(text: _p.address);
  late String _docType = _p.documentType;
  late String _prefix = _p.countryPrefix;
  bool _submitted = false;

  @override
  void dispose() {
    for (final c in [_first, _last, _doc, _phone, _email, _address]) {
      c.dispose();
    }
    super.dispose();
  }

  String? _required(TextEditingController c) =>
      _submitted && c.text.trim().isEmpty ? 'Campo obligatorio' : null;

  void _save() {
    setState(() => _submitted = true);
    final fields = [_first, _last, _doc, _phone, _email, _address];
    if (fields.any((c) => c.text.trim().isEmpty)) return;
    _p
      ..firstName = _first.text.trim()
      ..lastName = _last.text.trim()
      ..documentType = _docType
      ..document = _doc.text.trim()
      ..countryPrefix = _prefix
      ..phone = _phone.text.trim()
      ..email = _email.text.trim()
      ..address = _address.text.trim();
    Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    const gap = SizedBox(height: 16);
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 0, 24, 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  IconButton(
                    tooltip: 'Atrás',
                    icon: const Icon(Icons.chevron_left_rounded),
                    onPressed: () => Navigator.pop(context),
                  ),
                  const Expanded(
                    child: Text(
                      'Datos de facturación',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
              const Text(
                'Puedes completarlos ahora o seguir consultando servicios.',
                style: TextStyle(color: AppColors.textSecondary),
              ),
              gap,
              FlowTextField(
                controller: _first,
                label: 'Nombre*',
                errorText: _required(_first),
              ),
              gap,
              FlowTextField(
                controller: _last,
                label: 'Apellido*',
                errorText: _required(_last),
              ),
              gap,
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 110,
                    child: FlowDropdown<String>(
                      label: 'Tipo de documento',
                      items: documentTypes,
                      value: _docType,
                      onChanged: (v) => setState(() => _docType = v!),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FlowTextField(
                      controller: _doc,
                      label: 'Número de documento*',
                      numeric: true,
                      errorText: _required(_doc),
                    ),
                  ),
                ],
              ),
              gap,
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 110,
                    child: FlowDropdown<String>(
                      label: 'País',
                      items: const ['+58', '+57', '+1', '+34'],
                      value: _prefix,
                      onChanged: (v) => setState(() => _prefix = v!),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FlowTextField(
                      controller: _phone,
                      label: 'Número de teléfono*',
                      numeric: true,
                      errorText: _required(_phone),
                    ),
                  ),
                ],
              ),
              gap,
              FlowTextField(
                controller: _email,
                label: 'Correo electrónico*',
                errorText: _required(_email),
              ),
              gap,
              FlowTextField(
                controller: _address,
                label: 'Dirección corta*',
                errorText: _required(_address),
              ),
              PillButton(label: 'Guardar', onPressed: _save),
            ],
          ),
        ),
      ),
    );
  }
}
