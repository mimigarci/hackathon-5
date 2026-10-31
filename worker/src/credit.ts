/**
 * Motor de Credirecto (simulado). Funciones puras: sin red, sin almacenamiento y
 * sin imports de `cloudflare:workers`. Wisi y el modelo de lenguaje nunca deciden:
 * solo muestran lo que el motor responde, con su motivo. Ver docs/creditos-contrato.md.
 * Montos en céntimos (enteros). Fechas YYYY-MM-DD.
 */

import { CREDIT_LIMIT_MINOR } from "./fixtures.ts";

export type Level = "Turista" | "Explorador" | "Embajador";
export type OfferStatus = "disponible" | "precalificado" | "por_desbloquear";
export type Piso = 1 | 2 | 3;
export type LineKey = "cotidiano" | "turismo";
export type CreditCode = "credit_rejected" | "credit_over_limit";

export interface CreditState {
  level: Level;
  ontime_payments: number;
  months_active: number;
  overdue: number;
  used: { cotidiano: number; turismo: number };
}

export interface CatalogItem {
  offer_id: string; piso: Piso; vertical: string; partner: string;
  title: string; detail: string; currency: "VES" | "USD"; price_minor: number;
}

export interface Offer {
  offer_id: string; piso: Piso; vertical: string; partner: string; title: string; detail: string;
  currency: "VES" | "USD"; price_minor: number; status: OfferStatus;
  down_payment_pct: number; down_payment_minor: number; financed_minor: number;
  installments_options: number[]; frequency: "semanal" | "quincenal" | "mensual";
  funder: string; reason: string; next_step: "usar" | "precalificar" | "subir_nivel"; action_label: string;
}

export interface Installment { n: number; due_date: string; amount_minor: number }
export interface Plan {
  plan_id: string; offer_id: string; title: string; partner: string; piso: Piso;
  financed_minor: number; installments: (Installment & { paid: boolean })[]; created_at: string;
}

/** Perfil del usuario demo (constante). */
export const DEMO_PROFILE = { level: "Turista" as Level, ontime_payments: 8, months_active: 4, overdue: 0 };
export const demoState = (used: CreditState["used"] = { cotidiano: 0, turismo: 0 }): CreditState => ({ ...DEMO_PROFILE, used: { ...used } });

export const CATALOG: CatalogItem[] = [
  { offer_id: "svc_condominio", piso: 1, vertical: "servicios", partner: "Pago Directo", title: "Condominio de noviembre", detail: "Paga el condominio ahora y reparte el monto en cuotas sin interés.", currency: "VES", price_minor: 120000 },
  { offer_id: "svc_cantv", piso: 1, vertical: "servicios", partner: "Pago Directo", title: "CANTV: internet y teléfono", detail: "Tu factura de CANTV en cuotas sin interés.", currency: "VES", price_minor: 26000 },
  { offer_id: "park_month", piso: 1, vertical: "estacionamiento", partner: "Pago Directo", title: "Tus tickets de estacionamiento del mes", detail: "Todos tus tickets del mes en una sola cuenta, pagada en cuotas.", currency: "VES", price_minor: 30000 },
  { offer_id: "event_ticket", piso: 1, vertical: "boleteria", partner: "Pago Directo", title: "Entrada a un concierto en el Poliedro", detail: "Asegura tu entrada hoy y págala en cuotas.", currency: "VES", price_minor: 90000 },
  { offer_id: "tugruero_plan", piso: 1, vertical: "asistencia_vial", partner: "TuGruero", title: "Plan anual de grúa y asistencia vial", detail: "Asistencia vial todo el año, pagada en cuotas.", currency: "VES", price_minor: 110000 },
  { offer_id: "mercantil_rcv", piso: 1, vertical: "seguros", partner: "Seguros Mercantil", title: "Póliza RCV para tu carro", detail: "Responsabilidad civil de vehículos en cuotas sin interés.", currency: "VES", price_minor: 140000 },
  { offer_id: "saga_roques", piso: 2, vertical: "turismo", partner: "SAGA", title: "Los Roques: 3 días con posada y traslados", detail: "Plan de SAGA con inicial y cuotas quincenales.", currency: "USD", price_minor: 48000 },
  { offer_id: "saga_merida", piso: 2, vertical: "turismo", partner: "SAGA", title: "Mérida: posada y experiencia de montaña", detail: "Plan de SAGA con inicial y cuotas quincenales.", currency: "USD", price_minor: 26000 },
  { offer_id: "saga_margarita", piso: 2, vertical: "turismo", partner: "SAGA", title: "Margarita: 2 noches de hospedaje", detail: "Hospedaje de SAGA con inicial y cuotas quincenales.", currency: "USD", price_minor: 18000 },
  { offer_id: "conduce_corolla", piso: 3, vertical: "vehiculo", partner: "Conduce", title: "Toyota Corolla 2019", detail: "Vehículo de Conduce. Crédito de un banco aliado; Pago Directo solo precalifica.", currency: "USD", price_minor: 1450000 },
  { offer_id: "propiedash_apto", piso: 3, vertical: "inmueble", partner: "Propiedash", title: "Apartamento de 2 habitaciones en Caracas", detail: "Inmueble de Propiedash. Crédito de un banco aliado; Pago Directo solo precalifica.", currency: "USD", price_minor: 4800000 },
];

export const findOffer = (offer_id: string) => CATALOG.find((c) => c.offer_id === offer_id);
export const lineOf = (piso: Piso): LineKey | null => (piso === 1 ? "cotidiano" : piso === 2 ? "turismo" : null);

// La línea cotidiana es la de la wallet (CREDIT_LIMIT_MINOR para Turista); los demás niveles, en proporción.
const COTIDIANO_LIMIT: Record<Level, number> = { Turista: CREDIT_LIMIT_MINOR, Explorador: CREDIT_LIMIT_MINOR * 2, Embajador: CREDIT_LIMIT_MINOR * 4 };
// El contrato fija Turista y Explorador; Embajador es una extrapolación (ver informe).
const TURISMO_RULE: Record<Level, { pct: number; limit: number }> = {
  Turista: { pct: 40, limit: 30000 },
  Explorador: { pct: 20, limit: 60000 },
  Embajador: { pct: 10, limit: 100000 },
};
const TURISMO_MIN_ONTIME = 6;
const PATRIMONIO_MIN_MONTHS = 3;
const BANKS = ["Bancamiga", "Mercantil"];

// ---- formato y fechas ------------------------------------------------------------

function fmt(minor: number, prefix: string): string {
  const [int, dec] = (Math.max(0, Math.round(minor)) / 100).toFixed(2).split(".");
  return `${prefix}${int.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${dec}`;
}
/** 'Bs 1.234,56' */
export const bs = (minor: number) => fmt(minor, "Bs ");
/** 'US$ 14.500,00' */
export const usd = (minor: number) => fmt(minor, "US$ ");

export function addDays(now: Date, days: number): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days));
  return d.toISOString().slice(0, 10);
}

/** Partes iguales en céntimos; el resto va a la última. */
export function splitAmount(total: number, n: number): number[] {
  const base = Math.floor(total / n);
  const out = Array<number>(n).fill(base);
  out[n - 1] = total - base * (n - 1);
  return out;
}

// ---- líneas y evaluación ----------------------------------------------------------

export interface Line { limit_minor: number; used_minor: number; available_minor: number }
export function lines(state: CreditState): Record<LineKey, Line> {
  const mk = (limit: number, used: number): Line => {
    const u = Math.max(0, used);
    return { limit_minor: limit, used_minor: u, available_minor: Math.max(0, limit - u) };
  };
  return {
    cotidiano: mk(COTIDIANO_LIMIT[state.level], state.used.cotidiano),
    turismo: mk(TURISMO_RULE[state.level].limit, state.used.turismo),
  };
}

interface Evaluation {
  status: OfferStatus; eligible: boolean; code: CreditCode | null; reason: string;
  down_pct: number; down: number; financed: number;
}

function evaluate(c: CatalogItem, state: CreditState): Evaluation {
  const ln = lines(state);
  const reject = (reason: string, code: CreditCode, pct: number, down: number, financed: number): Evaluation =>
    ({ status: "por_desbloquear", eligible: false, code, reason, down_pct: pct, down, financed });

  if (c.piso === 1) {
    const avail = ln.cotidiano.available_minor;
    if (state.overdue > 0) return reject("Rechazado: tienes una cuota vencida. Ponte al día para volver a usar Credirecto.", "credit_rejected", 0, 0, c.price_minor);
    if (c.price_minor > avail) return reject(`Rechazado: ${bs(c.price_minor)} supera tu línea disponible de ${bs(avail)}`, "credit_over_limit", 0, 0, c.price_minor);
    return { status: "disponible", eligible: true, code: null, reason: `Aprobado: ${bs(c.price_minor)} cabe en tu línea disponible de ${bs(avail)}`, down_pct: 0, down: 0, financed: c.price_minor };
  }
  if (c.piso === 2) {
    const rule = TURISMO_RULE[state.level];
    const avail = ln.turismo.available_minor;
    const down = Math.round((c.price_minor * rule.pct) / 100);
    const financed = c.price_minor - down;
    if (state.overdue > 0) return reject("Rechazado: tienes una cuota vencida. Ponte al día para volver a usar Credirecto.", "credit_rejected", rule.pct, down, financed);
    if (state.ontime_payments < TURISMO_MIN_ONTIME)
      return reject(`Rechazado: pides ${TURISMO_MIN_ONTIME} pagos a tiempo para financiar turismo y llevas ${state.ontime_payments}`, "credit_rejected", rule.pct, down, financed);
    if (financed > avail)
      return reject(`Rechazado: financiar ${usd(financed)} supera tu línea de turismo disponible de ${usd(avail)}`, "credit_over_limit", rule.pct, down, financed);
    return { status: "disponible", eligible: true, code: null, reason: `Aprobado: financias ${usd(financed)} con una inicial de ${usd(down)} (${rule.pct} %), y cabe en tu línea de turismo disponible de ${usd(avail)}`, down_pct: rule.pct, down, financed };
  }
  const pct = c.vertical === "vehiculo" ? 30 : 20;
  const down = Math.round((c.price_minor * pct) / 100);
  const financed = c.price_minor - down;
  if (state.overdue > 0) return reject("Rechazado: tienes una cuota vencida. Ponte al día para precalificar.", "credit_rejected", pct, down, financed);
  if (state.months_active < PATRIMONIO_MIN_MONTHS)
    return reject(`Rechazado: pides ${PATRIMONIO_MIN_MONTHS} meses de uso para precalificar y llevas ${state.months_active}`, "credit_rejected", pct, down, financed);
  return {
    status: "precalificado", eligible: true, code: null,
    reason: `Precalificado: con una inicial de ${usd(down)} (${pct} %) financiarías ${usd(financed)} con un banco aliado (${BANKS.join(" o ")}). Es referencial: Pago Directo no presta y el banco decide.`,
    down_pct: pct, down, financed,
  };
}

/** Evaluación pública para el chequeo atómico de Wallet.execute. */
export function checkOffer(offer_id: string, state: CreditState) {
  const c = findOffer(offer_id);
  if (!c) return null;
  const e = evaluate(c, state);
  return { eligible: e.eligible, code: e.code, reason: e.reason, down_minor: e.down, financed_minor: e.financed, piso: c.piso };
}

export function installmentOptions(c: CatalogItem): number[] {
  if (c.piso === 1) return [1, 2];
  if (c.piso === 2) return [2, 3, 4];
  return c.vertical === "vehiculo" ? [36, 48, 60] : [120, 180, 240];
}
const frequencyOf = (piso: Piso): Offer["frequency"] => (piso === 1 ? "semanal" : piso === 2 ? "quincenal" : "mensual");
const stepDays = (piso: Piso) => (piso === 1 ? 7 : piso === 2 ? 15 : 30);

function toOffer(c: CatalogItem, state: CreditState): Offer {
  const e = evaluate(c, state);
  const next_step: Offer["next_step"] = e.status === "disponible" ? "usar" : e.status === "precalificado" ? "precalificar" : "subir_nivel";
  const action_label = next_step === "usar" ? "Pagar con Credirecto" : next_step === "precalificar" ? "Precalificar" : "Ver cómo desbloquear";
  return {
    offer_id: c.offer_id, piso: c.piso, vertical: c.vertical, partner: c.partner, title: c.title, detail: c.detail,
    currency: c.currency, price_minor: c.price_minor, status: e.status,
    down_payment_pct: e.down_pct, down_payment_minor: e.down, financed_minor: e.financed,
    installments_options: installmentOptions(c), frequency: frequencyOf(c.piso),
    funder: c.piso === 3 ? BANKS.join(" o ") : "Pago Directo", reason: e.reason, next_step, action_label,
  };
}

export function scanOffers(state: CreditState, _now: Date) {
  const offers = CATALOG.map((c) => toOffer(c, state));
  const summary = { disponible: 0, precalificado: 0, por_desbloquear: 0 };
  for (const o of offers) summary[o.status]++;
  return { offers, summary };
}

/** Lo que ve el usuario: una opción por aliado. El resto del catálogo no se ofrece. */
export const ORDER_OFFERS = ["saga_roques", "conduce_corolla", "propiedash_apto"];
export function scanOrderOffers(state: CreditState, now: Date) {
  const offers = ORDER_OFFERS.map((id) => scanOffers(state, now).offers.find((o) => o.offer_id === id)!);
  const summary = { disponible: 0, precalificado: 0, por_desbloquear: 0 };
  for (const o of offers) summary[o.status]++;
  return { offers, summary };
}

// ---- cotización y plan ----------------------------------------------------------------

export type QuoteError = { ok: false; code: "offer_not_found" | "invalid_installments"; message: string };
export interface QuoteData {
  offer_id: string; eligible: boolean; reason: string; down_payment_minor: number; financed_minor: number;
  installments: Installment[]; total_minor: number; interest_minor: 0; currency: "VES" | "USD";
}
export type QuoteResult = QuoteError | { ok: true; code: CreditCode | null; piso: Piso; data: QuoteData };

function schedule(piso: Piso, financed: number, n: number, now: Date): Installment[] {
  return splitAmount(financed, n).map((amount_minor, i) => ({ n: i + 1, due_date: addDays(now, stepDays(piso) * (i + 1)), amount_minor }));
}
const validInstallments = (c: CatalogItem, n: unknown): n is number =>
  typeof n === "number" && Number.isInteger(n) && installmentOptions(c).includes(n);

export function quote(offer_id: string, installments: unknown, state: CreditState, now: Date): QuoteResult {
  const c = findOffer(offer_id);
  if (!c) return { ok: false, code: "offer_not_found", message: "No encuentro esa oferta." };
  if (!validInstallments(c, installments))
    return { ok: false, code: "invalid_installments", message: `Las cuotas válidas para esta oferta son: ${installmentOptions(c).join(", ")}.` };
  const e = evaluate(c, state);
  return {
    ok: true, code: e.code, piso: c.piso,
    data: {
      offer_id: c.offer_id, eligible: e.eligible, reason: e.reason,
      down_payment_minor: e.down, financed_minor: e.financed,
      installments: schedule(c.piso, e.financed, installments, now),
      total_minor: e.down + e.financed, interest_minor: 0, currency: c.currency,
    },
  };
}

/** Arma el plan (pisos 1 y 2). Devuelve null si la oferta o las cuotas no valen. */
export function planFor(offer_id: string, installments: unknown, state: CreditState, now: Date, plan_id: string): Plan | null {
  const c = findOffer(offer_id);
  if (!c || c.piso === 3 || !validInstallments(c, installments)) return null;
  const e = evaluate(c, state);
  return {
    plan_id, offer_id: c.offer_id, title: c.title, partner: c.partner, piso: c.piso, financed_minor: e.financed,
    installments: schedule(c.piso, e.financed, installments, now).map((i) => ({ ...i, paid: false })),
    created_at: now.toISOString(),
  };
}

export function nextInstallment(plans: Plan[]) {
  let best: { plan_id: string; title: string; due_date: string; amount_minor: number } | null = null;
  for (const p of plans)
    for (const i of p.installments)
      if (!i.paid && (!best || i.due_date < best.due_date))
        best = { plan_id: p.plan_id, title: p.title, due_date: i.due_date, amount_minor: i.amount_minor };
  return best;
}

export function precalifyInfo(offer_id: string, state: CreditState) {
  const c = findOffer(offer_id);
  if (!c) return { ok: false as const, code: "offer_not_found" as const, message: "No encuentro esa oferta." };
  if (c.piso !== 3) return { ok: false as const, code: "offer_not_found" as const, message: "Esta oferta no se precalifica con un banco: se financia directo." };
  const e = evaluate(c, state);
  const docs = ["Cédula de identidad", "RIF", "Constancia de ingresos o recibos de pago", "Estados de cuenta de los últimos 3 meses"];
  docs.push(c.vertical === "vehiculo" ? "Cotización o factura proforma del vehículo" : "Documento de propiedad del inmueble");
  const options = installmentOptions(c);
  return {
    ok: true as const, eligible: e.eligible, code: e.code, reason: e.reason, offer: c,
    bank_options: BANKS, documents: docs,
    estimated: { down_payment_pct: e.down_pct, term_months: options[Math.floor(options.length / 2)] },
    down_minor: e.down, financed_minor: e.financed,
  };
}
