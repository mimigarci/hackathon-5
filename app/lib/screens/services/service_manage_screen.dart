import 'dart:async';

import 'package:flutter/material.dart';

import '../../data/catalog.dart';
import '../../theme/app_colors.dart';
import '../../utils/format.dart';
import '../../widgets/flow_widgets.dart';
import 'jomi_screen.dart';
import 'services_screen.dart';
import 'tugruero_screen.dart';

/// Opens the Gestionar step for a catalog entry, picking the right flow.
void openServiceEntry(BuildContext context, ServiceCatalogEntry entry) {
  final Widget screen = switch (entry.flow) {
    ServiceFlow.form => ServiceManageScreen(entry: entry),
    ServiceFlow.dlm => DlmScreen(entry: entry),
    ServiceFlow.tugruero => const TuGrueroScreen(),
    ServiceFlow.jomi => const JomiScreen(),
  };
  Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen));
}

/// Opens a provider by id (Home's Mis pagos shortcuts); falls back to the
/// catalog when the id isn't known.
void openServiceById(BuildContext context, String id) {
  final entry = catalogEntry(id);
  if (entry != null) return openServiceEntry(context, entry);
  Navigator.of(context)
      .push(MaterialPageRoute(builder: (_) => const ServicesScreen()));
}

/// Generic Gestionar form driven by [ServiceMode.fields] (F15–F22, F26–F28).
class ServiceManageScreen extends StatefulWidget {
  const ServiceManageScreen({super.key, required this.entry});

  final ServiceCatalogEntry entry;

  @override
  State<ServiceManageScreen> createState() => _ServiceManageScreenState();
}

class _ServiceManageScreenState extends State<ServiceManageScreen> {
  int _mode = 0;
  final _text = <String, TextEditingController>{};
  final _choice = <String, String>{};
  final _errors = <String, String>{};

  ServiceMode get mode => widget.entry.modes[_mode];

  @override
  void dispose() {
    for (final c in _text.values) {
      c.dispose();
    }
    super.dispose();
  }

  TextEditingController _controller(String id) =>
      _text.putIfAbsent(id, TextEditingController.new);

  String _choiceOf(FieldSpec f) {
    return _choice[f.id] ??= switch (f.kind) {
      FieldKind.amount => sampleRechargeAmounts.first.toString(),
      FieldKind.document => documentTypes.first,
      _ => f.options.isEmpty ? '' : f.options.first,
    };
  }

  void _switchMode(int i) => setState(() {
    _mode = i;
    _errors.clear();
  });

  void _submit() {
    final summary = <String, String>{
      'Servicio': [
        widget.entry.name,
        mode.label,
      ].where((s) => s.isNotEmpty).join(' · '),
    };
    _errors.clear();
    for (final f in mode.fields) {
      switch (f.kind) {
        case FieldKind.amount:
          summary[f.label] = formatBs(double.parse(_choiceOf(f)), dotted: true);
        case FieldKind.select:
          summary[f.label] = _choiceOf(f);
        case FieldKind.phoneWithPrefix:
        case FieldKind.phone:
        case FieldKind.identifier:
        case FieldKind.document:
          final value = _controller(f.id).text.trim();
          if (value.isEmpty) {
            _errors[f.id] = f.emptyError ?? 'Completa este campo';
            continue;
          }
          final lead = switch (f.kind) {
            FieldKind.phoneWithPrefix => _choiceOf(f),
            FieldKind.document => '${_choiceOf(f)}-',
            _ => '',
          };
          summary[f.label] = '$lead$value';
      }
    }
    setState(() {});
    if (_errors.isNotEmpty) return;
    showActionReview(
      context,
      action: mode.cta == CtaKind.pay ? 'pagar' : 'consultar',
      summary: summary,
    );
  }

  Widget _field(FieldSpec f) {
    final error = _errors[f.id];
    Widget input = switch (f.kind) {
      FieldKind.amount => FlowDropdown<String>(
        label: f.label,
        items: [for (final a in sampleRechargeAmounts) a.toString()],
        itemLabel: (v) => formatBs(double.parse(v), dotted: true),
        value: _choiceOf(f),
        onChanged: (v) => setState(() => _choice[f.id] = v!),
      ),
      FieldKind.select => FlowDropdown<String>(
        label: f.label,
        items: f.options,
        value: _choiceOf(f),
        onChanged: (v) => setState(() => _choice[f.id] = v!),
      ),
      FieldKind.phoneWithPrefix || FieldKind.document => Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          SizedBox(
            width: f.kind == FieldKind.document ? 80 : 110,
            child: FlowDropdown<String>(
              items: f.kind == FieldKind.document ? documentTypes : f.options,
              value: _choiceOf(f),
              onChanged: (v) => setState(() => _choice[f.id] = v!),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: FlowTextField(
              controller: _controller(f.id),
              label: f.label,
              hint: f.hint,
              numeric: true,
              errorText: error,
            ),
          ),
        ],
      ),
      FieldKind.phone || FieldKind.identifier => FlowTextField(
        controller: _controller(f.id),
        label: f.label,
        hint: f.hint,
        numeric: true,
        errorText: error,
      ),
    };
    if (f.contacts) {
      input = Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(child: input),
          const Padding(
            padding: EdgeInsets.only(bottom: 4),
            child: ContactsButton(),
          ),
        ],
      );
    }
    return Padding(padding: const EdgeInsets.only(bottom: 28), child: input);
  }

  @override
  Widget build(BuildContext context) {
    final modes = widget.entry.modes;
    return FlowScaffold(
      title: 'Servicios',
      body: ListView(
        padding: const EdgeInsets.fromLTRB(28, 0, 20, 20),
        children: [
          const FlowStepper(
            steps: ['Servicios', 'Gestionar', 'Listo'],
            current: 1,
          ),
          const SizedBox(height: 20),
          ServiceWordmark(entry: widget.entry, fontSize: 44),
          const SizedBox(height: 28),
          if (modes.length > 1) ...[
            PillTabs(
              labels: [for (final m in modes) m.label],
              selected: _mode,
              onChanged: _switchMode,
            ),
            const SizedBox(height: 28),
          ],
          for (final f in mode.fields) _field(f),
        ],
      ),
      bottom: PillButton(
        label: mode.ctaLabel,
        color: mode.cta == CtaKind.pay ? kPayGreen : AppColors.primary,
        onPressed: _submit,
      ),
    );
  }
}

/// DLM: Condominio + Inmueble selectors (F25). Consultar stays grey while
/// the catalog loads; afterwards both selectors show a preloaded option.
class DlmScreen extends StatefulWidget {
  const DlmScreen({super.key, required this.entry});

  final ServiceCatalogEntry entry;

  @override
  State<DlmScreen> createState() => _DlmScreenState();
}

class _DlmScreenState extends State<DlmScreen> {
  bool _loading = true;
  String? _condo;
  String? _unit;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer(const Duration(milliseconds: 900), () {
      final condo = dlmProperties.keys.first;
      setState(() {
        _loading = false;
        _condo = condo;
        _unit = dlmProperties[condo]!.first;
      });
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FlowScaffold(
      title: 'Servicios',
      body: ListView(
        padding: const EdgeInsets.fromLTRB(28, 0, 20, 20),
        children: [
          const FlowStepper(
            steps: ['Servicios', 'Gestionar', 'Listo'],
            current: 1,
          ),
          const SizedBox(height: 20),
          ServiceWordmark(entry: widget.entry, fontSize: 44),
          const SizedBox(height: 32),
          if (_loading)
            const Padding(
              padding: EdgeInsets.all(32),
              child: Center(child: CircularProgressIndicator()),
            )
          else ...[
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: FlowDropdown<String>(
                    label: 'Condominio',
                    items: dlmProperties.keys.toList(),
                    value: _condo,
                    onChanged: (v) => setState(() {
                      _condo = v;
                      _unit = dlmProperties[v]!.first;
                    }),
                  ),
                ),
                const ContactsButton(),
              ],
            ),
            const SizedBox(height: 28),
            FlowDropdown<String>(
              label: 'Inmueble',
              items: dlmProperties[_condo]!,
              value: _unit,
              onChanged: (v) => setState(() => _unit = v),
            ),
            const SizedBox(height: 16),
            const Text(
              'Confirma que esta es la propiedad que quieres consultar.',
              style: TextStyle(color: AppColors.textSecondary),
            ),
          ],
        ],
      ),
      bottom: PillButton(
        label: 'Consultar',
        onPressed: _loading
            ? null
            : () => showActionReview(
                context,
                action: 'consultar',
                summary: {
                  'Servicio': 'DLM',
                  'Condominio': _condo!,
                  'Inmueble': _unit!,
                },
              ),
      ),
    );
  }
}
