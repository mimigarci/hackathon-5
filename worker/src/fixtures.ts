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

export const INITIAL_WALLET_BALANCE_MINOR = 5_000_00;

// ---- Catálogo de demostración (espejo de fixtures.py; precios ficticios) ------
export interface Product { product_ref: string; name: string; detail: string; price_minor: number; unit: string; type?: string }

export const PARKING_ZONES: Product[] = [
  { product_ref: "pq_centro", name: "Zona Centro", detail: "Calles del casco central", price_minor: 15_00, unit: "hora" },
  { product_ref: "pq_norte", name: "Zona Norte", detail: "Avenidas comerciales", price_minor: 12_00, unit: "hora" },
  { product_ref: "pq_este", name: "Zona Este", detail: "Zona residencial", price_minor: 10_00, unit: "hora" },
];
export const INSURANCE: Product[] = [
  { product_ref: "sg_rcv_auto", name: "RCV Particular", type: "vehiculos", detail: "Responsabilidad civil para tu carro", price_minor: 320_00, unit: "mes" },
  { product_ref: "sg_rcv_moto", name: "RCV Moto", type: "vehiculos", detail: "Responsabilidad civil para tu moto", price_minor: 180_00, unit: "mes" },
  { product_ref: "sg_accidentes", name: "Accidentes personales", type: "personas", detail: "Gastos médicos por accidente", price_minor: 150_00, unit: "mes" },
  { product_ref: "sg_salud", name: "Salud básica", type: "personas", detail: "Consultas y emergencias", price_minor: 450_00, unit: "mes" },
];
export const EVENTS: Product[] = [
  { product_ref: "ev_gaitas", name: "Noche de gaitas", detail: "Sáb 21 nov · 8:00 p. m.", price_minor: 250_00, unit: "boleto" },
  { product_ref: "ev_standup", name: "Stand-up comedy", detail: "Vie 27 nov · 9:00 p. m.", price_minor: 180_00, unit: "boleto" },
  { product_ref: "ev_beisbol", name: "Béisbol: juego de temporada", detail: "Dom 29 nov · 5:00 p. m.", price_minor: 120_00, unit: "boleto" },
];
export const CATALOG: Record<string, Product[]> = { parquimetros: PARKING_ZONES, seguros: INSURANCE, boleteria: EVENTS };
export const CATALOG_KIND: Record<string, string> = { parquimetros: "parking_meter", seguros: "insurance", boleteria: "tickets" };
export const MAX_QUANTITY: Record<string, number> = { parquimetros: 8, seguros: 1, boleteria: 6 };

export const TOPUP_METHODS: Record<string, string> = {
  cuentas_nacionales: "Cuentas Nacionales",
  pago_movil: "Pago Móvil",
  bdv: "Banco de Venezuela",
  humaniz: "Humaniz",
};
export const MAX_TOPUP_MINOR = 10_000_00;

export const CREDIT_LIMIT_MINOR = 2_000_00;
export const CREDIT_INSTALLMENTS = 4;
