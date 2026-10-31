// Datos ficticios del modo mock (espejo de backend/app/fixtures.py). Sin PII real.

export const SERVICES = [
  { service_ref: "digitel", name: "Digitel", category: "telefonia", needs_account: true, sample_pending_minor: 450_00 },
  { service_ref: "movistar", name: "Movistar", category: "telefonia", needs_account: true, sample_pending_minor: 320_00 },
  { service_ref: "movilnet", name: "Movilnet", category: "telefonia", needs_account: true, sample_pending_minor: 210_00 },
  { service_ref: "corpoelec", name: "Corpoelec (luz)", category: "electricidad", needs_account: true, sample_pending_minor: 180_00 },
  { service_ref: "cantv", name: "CANTV (internet/teléfono)", category: "internet", needs_account: true, sample_pending_minor: 260_00 },
  { service_ref: "condominio", name: "Condominio", category: "condominio", needs_account: true, sample_pending_minor: 1_200_00 },
];

export const FOUNDATIONS = [
  { foundation_ref: "fundana", name: "Fundana" },
  { foundation_ref: "senosayuda", name: "SenosAyuda" },
  { foundation_ref: "banco_alimentos", name: "Banco de Alimentos de Caracas" },
];

export const INITIAL_WALLET_BALANCE_MINOR = 2_500_00;
