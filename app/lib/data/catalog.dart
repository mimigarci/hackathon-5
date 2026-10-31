import 'dart:ui';

/// Static catalogs for the Funciones flows, transcribed from the REA
/// walkthrough in docs/rea-home (F12–F38). Labels, hints and the order of
/// fields are what was observed; amounts and prices marked "sample" are
/// placeholders until the provider contracts are connected.

enum FieldKind {
  /// Prefix selector + Número de teléfono.
  phoneWithPrefix,

  /// Número de teléfono without prefix selector (CANTV, F20).
  phone,

  /// Identifier kept as text so leading zeros survive.
  identifier,

  /// Tipo de documento selector + number.
  document,

  /// Plain dropdown with fixed options.
  select,

  /// Monto a recargar catalog.
  amount,
}

class FieldSpec {
  const FieldSpec({
    required this.id,
    required this.kind,
    required this.label,
    this.hint,
    this.emptyError,
    this.options = const [],
    this.contacts = true,
  });

  final String id;
  final FieldKind kind;
  final String label;
  final String? hint;

  /// Error text observed in the reference app when the field is empty.
  final String? emptyError;

  /// Options for [FieldKind.select] and prefixes for
  /// [FieldKind.phoneWithPrefix].
  final List<String> options;

  /// Shows the Contactos button next to the field.
  final bool contacts;
}

enum CtaKind { pay, query }

class ServiceMode {
  const ServiceMode({
    required this.label,
    required this.fields,
    required this.cta,
    this.taskId,
  });

  /// Prepago / Postpago, or empty when the provider has a single form.
  final String label;
  final List<FieldSpec> fields;
  final CtaKind cta;

  /// REA task id (F15.2, F16.2, ...), for traceability.
  final String? taskId;

  String get ctaLabel => cta == CtaKind.pay ? 'Pagar' : 'Consultar';
}

enum ServiceFlow { form, dlm, tugruero, jomi }

class ServiceCatalogEntry {
  const ServiceCatalogEntry({
    required this.id,
    required this.name,
    required this.color,
    this.modes = const [],
    this.flow = ServiceFlow.form,
  });

  final String id;
  final String name;
  final Color color;
  final List<ServiceMode> modes;
  final ServiceFlow flow;
}

const documentTypes = ['V', 'E', 'J', 'P', 'G'];

/// Sample recharge catalog; the real one comes from the provider (F15.2).
const sampleRechargeAmounts = [500.0, 1000.0, 1500.0, 2000.0, 3000.0, 5000.0];

const _phoneHint = '1234567';
const _contractHint = '123456789';
const _documentHint = '12345678';

FieldSpec _prepaidPhone(List<String> prefixes) => FieldSpec(
  id: 'phone',
  kind: FieldKind.phoneWithPrefix,
  label: 'Número de teléfono',
  hint: _phoneHint,
  options: prefixes,
);

const _amount = FieldSpec(
  id: 'amount',
  kind: FieldKind.amount,
  label: 'Monto a recargar',
  contacts: false,
);

const _document = FieldSpec(
  id: 'document',
  kind: FieldKind.document,
  label: 'Número de documento',
  hint: _documentHint,
);

ServiceMode _documentQuery(String taskId) => ServiceMode(
  label: '',
  fields: const [_document],
  cta: CtaKind.query,
  taskId: taskId,
);

final serviceCatalog = <ServiceCatalogEntry>[
  ServiceCatalogEntry(
    id: 'digitel',
    name: 'Digitel',
    color: const Color(0xFFD5003C),
    modes: [
      ServiceMode(
        label: 'Prepago',
        taskId: 'F15.2',
        cta: CtaKind.pay,
        fields: [
          _prepaidPhone(const ['0412', '0422']),
          _amount,
        ],
      ),
      ServiceMode(
        label: 'Postpago',
        taskId: 'F15.3',
        cta: CtaKind.query,
        fields: [
          FieldSpec(
            id: 'phone',
            kind: FieldKind.phoneWithPrefix,
            label: 'Número de teléfono',
            hint: _phoneHint,
            options: const ['0412', '0422'],
            // Exact text observed, even though the field is a phone (F15.3).
            emptyError: 'Ingrese un número de contrato válido',
          ),
        ],
      ),
    ],
  ),
  ServiceCatalogEntry(
    id: 'movilnet',
    name: 'Movilnet',
    color: const Color(0xFFE5332A),
    modes: [
      ServiceMode(
        label: 'Prepago',
        taskId: 'F16.1',
        cta: CtaKind.pay,
        fields: [
          _prepaidPhone(const ['0416', '0426']),
          _amount,
        ],
      ),
      const ServiceMode(
        label: 'Postpago',
        taskId: 'F16.2',
        cta: CtaKind.query,
        fields: [
          FieldSpec(
            id: 'contract',
            kind: FieldKind.identifier,
            label: 'Número de contrato',
            hint: _contractHint,
          ),
        ],
      ),
    ],
  ),
  ServiceCatalogEntry(
    id: 'movistar',
    name: 'Movistar',
    color: const Color(0xFF019DF4),
    modes: [
      ServiceMode(
        label: 'Prepago',
        taskId: 'F17.1',
        cta: CtaKind.pay,
        fields: [
          _prepaidPhone(const ['0414', '0424']),
          _amount,
        ],
      ),
      const ServiceMode(
        label: 'Postpago',
        taskId: 'F17.2',
        cta: CtaKind.query,
        fields: [
          FieldSpec(
            id: 'contract',
            kind: FieldKind.identifier,
            label: 'Número de contrato',
            hint: _contractHint,
          ),
          // Labelled "Número de tarjeta" in the reference app but it holds
          // the service type; never ask for a bank card here (F17.2).
          FieldSpec(
            id: 'service_type',
            kind: FieldKind.select,
            label: 'Número de tarjeta',
            contacts: false,
            options: ['Telefonía Celular o Internet Móvil', 'Telefonía Fija'],
          ),
        ],
      ),
    ],
  ),
  const ServiceCatalogEntry(
    id: 'simpletv',
    name: 'SimpleTV',
    color: Color(0xFF00205B),
    modes: [
      ServiceMode(
        label: '',
        taskId: 'F18.1',
        cta: CtaKind.query,
        fields: [
          FieldSpec(
            id: 'contract',
            kind: FieldKind.identifier,
            label: 'Número de contrato',
            hint: '0000000000',
          ),
        ],
      ),
    ],
  ),
  ServiceCatalogEntry(
    id: 'inter',
    name: 'Inter',
    color: const Color(0xFF0057B8),
    modes: [_documentQuery('F19.1')],
  ),
  const ServiceCatalogEntry(
    id: 'cantv',
    name: 'CANTV',
    color: Color(0xFF0033A0),
    modes: [
      ServiceMode(
        label: '',
        taskId: 'F20.1',
        cta: CtaKind.query,
        fields: [
          FieldSpec(
            id: 'phone',
            kind: FieldKind.phone,
            label: 'Número de teléfono',
            hint: _phoneHint,
          ),
        ],
      ),
    ],
  ),
  ServiceCatalogEntry(
    id: 'corpoelec',
    name: 'Corpoelec',
    color: const Color(0xFF00843D),
    modes: [_documentQuery('F21.1')],
  ),
  ServiceCatalogEntry(
    id: 'thundernet',
    name: 'ThunderNet',
    color: const Color(0xFF6A1B9A),
    modes: [_documentQuery('F22.1')],
  ),
  const ServiceCatalogEntry(
    id: 'tugruero',
    name: 'TuGruero',
    color: Color(0xFFFF6F00),
    flow: ServiceFlow.tugruero,
  ),
  const ServiceCatalogEntry(
    id: 'dlm',
    name: 'DLM',
    color: Color(0xFF2E7D32),
    flow: ServiceFlow.dlm,
  ),
  const ServiceCatalogEntry(
    id: 'globalgps',
    name: 'Global System GPS',
    color: Color(0xFF37474F),
    modes: [
      ServiceMode(
        label: '',
        taskId: 'F26.1',
        cta: CtaKind.query,
        fields: [
          FieldSpec(
            id: 'cedula',
            kind: FieldKind.document,
            label: 'Número de cédula',
            hint: _documentHint,
          ),
        ],
      ),
    ],
  ),
  const ServiceCatalogEntry(
    id: 'starmoviles',
    name: 'StarMoviles Corp.',
    color: Color(0xFFB71C1C),
    modes: [
      ServiceMode(
        label: '',
        taskId: 'F27.1',
        cta: CtaKind.query,
        fields: [
          // No type selector was visible for this provider (F27.1).
          FieldSpec(
            id: 'document',
            kind: FieldKind.identifier,
            label: 'Documento / Cédula',
            hint: _documentHint,
          ),
        ],
      ),
    ],
  ),
  ServiceCatalogEntry(
    id: 'fibex',
    name: 'FIBEX',
    color: const Color(0xFF0091EA),
    modes: [_documentQuery('F28.1')],
  ),
  const ServiceCatalogEntry(
    id: 'jomi',
    name: 'Jomi',
    color: Color(0xFF4E3B30),
    flow: ServiceFlow.jomi,
  ),
];

ServiceCatalogEntry? catalogEntry(String id) {
  for (final e in serviceCatalog) {
    if (e.id == id) return e;
  }
  return null;
}

// ---------------------------------------------------------------------------
// TuGruero (F24)
// ---------------------------------------------------------------------------

class TowPlan {
  const TowPlan(this.name, this.annualFrom, this.monthlyFrom);

  final String name;

  /// Sample "Desde" prices in USD; never a final quote (F24.2).
  final double annualFrom;
  final double monthlyFrom;
}

const towCategories = ['Vehículos', 'Moto'];

const towPlans = [
  TowPlan('Classic', 30, 3),
  TowPlan('Plus', 45, 4.5),
  TowPlan('Gold', 70, 7),
];

// ---------------------------------------------------------------------------
// DLM (F25), sample catalog
// ---------------------------------------------------------------------------

const dlmProperties = <String, List<String>>{
  'Residencias El Parque': ['Apto 1-A', 'Apto 2-B', 'Apto 5-C'],
  'Conjunto Los Samanes': ['Casa 12', 'Casa 14'],
};

// ---------------------------------------------------------------------------
// JOMI (F29)
// ---------------------------------------------------------------------------

const jomiCategories = [
  'Plomería',
  'Mecánica',
  'Línea blanca',
  'Electricidad',
  'Construcción',
];

// ---------------------------------------------------------------------------
// Seguros (F38)
// ---------------------------------------------------------------------------

const insuranceCategories = ['Vehículos', 'Personas'];

const insuranceVehicleSubtypes = ['Particular', 'Pick-up', 'Rústico', 'Motos'];

class Coverage {
  const Coverage(this.name, this.premiumUsd);

  final String name;
  final double premiumUsd;
}

/// Primas visibles en P134 para Particular.
const particularCoverages = [
  Coverage('R.C.V. BÁSICA', 38.28),
  Coverage('R.C.V. COMBINADO', 50.05),
  Coverage('R.C.V. COMBINADO + ASISTENCIA VIAL', 90.05),
];
