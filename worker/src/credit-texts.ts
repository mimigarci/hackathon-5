/**
 * Respuestas de Wisi sobre crédito. Son textos fijos, instantáneos y sin modelo de
 * lenguaje: los datos salen del motor (credit.ts), nunca se inventan. Devuelven null si
 * la pregunta no es de aquí, y entonces sigue el flujo normal. Ver docs/creditos-textos.md.
 */
import { bs, lines, nextInstallment } from "./credit.ts";
import type { CreditState, Offer, Plan } from "./credit.ts";
import { CREDIT_INSTALLMENTS } from "./fixtures.ts";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const OFFER_WORDS: [RegExp, string][] = [
  [/\bcarro\b|vehiculo|corolla|conduce/, "conduce_corolla"],
  [/apartamento|\bcasa\b|inmueble|hipoteca|propiedash/, "propiedash_apto"],
  [/roques/, "saga_roques"], [/merida/, "saga_merida"], [/margarita|estei/, "estei_margarita"],
  [/condominio/, "svc_condominio"], [/cantv|internet/, "svc_cantv"],
  [/estacionamiento|parking/, "park_month"], [/concierto|poliedro/, "event_ticket"],
  [/tugruero|\bgrua\b/, "tugruero_plan"], [/\bseguros?\b|\brcv\b|\bpoliza\b|mercantil/, "mercantil_rcv"],
];
const CREDIT_WORDS = /credit|credirecto|prestamo|cuota|financ|\blinea\b|\binicial\b|\bintereses?\b/;

/** El motivo del motor sin la etiqueta inicial, que la frase ya dice con otras palabras. */
const motive = (o: Offer) => o.reason.replace(/^(Aprobado|Rechazado|Precalificado):\s*/, "").replace(/^pides /, "pedimos ").replace(/\.?$/, ".");
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

function dateEs(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} de ${["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"][m - 1]}`;
}

function aboutOffer(o: Offer, askedRejected: boolean): string {
  if (o.status === "por_desbloquear") return `${o.title} todavía está por desbloquear. ${cap(motive(o))}`;
  const lead = askedRejected ? "No está rechazado. " : "";
  if (o.status === "precalificado") return `${lead}${o.title} está precalificado: ${motive(o)} El banco aliado decide; nosotros armamos la solicitud.`;
  return `${lead}${o.title} está disponible con Credirecto: ${motive(o)} Pago Directo es quien te presta.`;
}

function rejectedSummary(offers: Offer[]): string {
  const blocked = offers.filter((o) => o.status === "por_desbloquear");
  if (!blocked.length) return `Ahora mismo no tienes ningún crédito rechazado: ${offers.filter((o) => o.status === "disponible").length} ofertas están disponibles y ${offers.filter((o) => o.status === "precalificado").length} precalificadas. ¿Cuál te interesa?`;
  return `Tienes ${blocked.length} por desbloquear: ${blocked.map((o) => `${o.title} (${motive(o).replace(/\.$/, "")})`).join("; ")}.`;
}

interface Faq { intent: string; when: RegExp; credit?: boolean; reply: (state: CreditState, plans: Plan[]) => string }

const FAQ: Faq[] = [
  { intent: "seguridad", when: /\bpin\b|\bclave\b|estafa|me (estan )?llama(n|ndo|ron)/, reply: () =>
    "Nunca te pedimos tu PIN ni tu clave por chat ni por teléfono, y Wisi no te llama. Si alguien te los pide, no se los des: las operaciones solo se confirman con tu huella dentro de la app." },
  { intent: "es_real", when: /\b(es|son) (real|reales|de verdad)\b|dinero real|credito real/, credit: true, reply: () =>
    "Es una simulación: los montos, las ofertas y las aprobaciones son de ejemplo y no se mueve dinero real." },
  { intent: "quien_decide", when: /quien (decide|aprueba|me aprueba)|wisi (decide|aprueba)|como (deciden|aprueban|evaluan)/, reply: () =>
    "Decide un motor de reglas, no Wisi ni la inteligencia artificial: mira tus pagos a tiempo, tus meses de uso, si tienes cuotas vencidas y tu línea disponible. Siempre te mostramos el motivo." },
  { intent: "quien_presta", when: /quien (me )?(presta|financia|pone el dinero)|con que banco|que banco/, reply: () =>
    "Depende de la oferta. En el día a día y en viajes te presta Pago Directo. En carro y casa, Pago Directo no presta: te precalifica y decide un banco aliado, Bancamiga o Mercantil." },
  { intent: "intereses", when: /\bintereses?\b|comision|recargo/, reply: () =>
    "En esta demo, las cuotas del día a día y de viajes van sin intereses ni comisión. En carro y casa, las condiciones las pone el banco aliado." },
  { intent: "inicial", when: /\binicial\b|cuota inicial|cuanto (hay que|tengo que) (dar|poner)/, reply: (s) =>
    `Depende del piso. En el día a día no hay inicial. En viajes, con tu nivel ${s.level}, es del 40 %. En carro es del 30 % y en casa del 20 %. La inicial sale de tu saldo al confirmar.` },
  { intent: "pago_cuota", when: /como (pago|abono|pagar|abonar)|cuando (pago|me toca|vence|tengo que pagar)|proxima cuota|fecha de pago/, reply: (_s, plans) => {
    const next = nextInstallment(plans);
    return next
      ? `Tu próxima cuota es de ${bs(next.amount_minor)}, de ${next.title}, el ${dateEs(next.due_date)}. La pagas desde Credirecto con tu saldo.`
      : "No tienes cuotas pendientes de tus planes. Si pides crédito, verás cada fecha antes de confirmar y pagarás desde Credirecto con tu saldo."; } },
  { intent: "cuotas", when: /cuantas cuotas|en cuantas|cada cuanto|plazos?\b|como son las cuotas/, reply: () =>
    `Depende del crédito. Efectivo a tu wallet: ${CREDIT_INSTALLMENTS} cuotas quincenales. Día a día: 1 o 2 semanales. Viajes: de 2 a 4 quincenales. Carro: de 36 a 60 meses. Casa: de 120 a 240 meses.` },
  { intent: "requisitos", when: /requisito|que (necesito|me piden|piden|debo tener)|documentos|papeles/, reply: () =>
    "Para el día a día basta con tener línea disponible y ninguna cuota vencida. Viajes pide 6 pagos a tiempo. Carro y casa piden 3 meses de uso, y para el banco: cédula, RIF, constancia de ingresos, estados de cuenta de 3 meses y la cotización del carro o el documento del inmueble." },
  { intent: "atraso", when: /(no|si no) (pago|puedo pagar)|me atraso|atrasad|vencid|\bmora\b|me retraso/, reply: () =>
    "Mientras tengas una cuota vencida no podrás usar Credirecto ni precalificar. En cuanto te pongas al día, se vuelve a abrir. En esta demo no se cobra mora." },
  { intent: "subir_nivel", when: /subir (de )?nivel|aumentar? (mi |la |el )?(linea|limite|cupo)|mas (linea|cupo)|\bexplorador\b|\bembajador\b/, reply: (s) => {
    const l = lines(s);
    return `Hoy estás en nivel ${s.level}, con ${bs(l.cotidiano.limit_minor)} para el día a día y ${bs(l.turismo.limit_minor)} para viajes. Con los niveles superiores la línea crece, hasta el doble en Explorador. En esta demo el nivel no cambia.`; } },
  { intent: "cuanto_tengo", when: /cuanto (me )?(prestan|pueden prestar|me dan|puedo pedir|tengo disponible|tengo de credito)|cual es mi (linea|limite|cupo)|mi limite/, reply: (s) => {
    const l = lines(s);
    return `Tienes ${bs(l.cotidiano.available_minor)} disponibles de ${bs(l.cotidiano.limit_minor)} para el día a día, y ${bs(l.turismo.available_minor)} de ${bs(l.turismo.limit_minor)} para viajes. Carro y casa los evalúa un banco aliado.`; } },
  { intent: "que_es", when: /que es (el |la )?(credirecto|credito)|como funciona (el |la )?(credirecto|credito)|para que sirve|^credirecto\?$/, reply: () =>
    "Credirecto es tu crédito dentro de Pago Directo. Puedes pasar efectivo a tu wallet, pagar el día a día en cuotas, financiar viajes y precalificar para carro o casa con un banco aliado. Tú confirmas siempre con tu huella." },
];

export function answerCredit(text: string, state: CreditState, offers: Offer[], plans: Plan[] = []): { intent: string; reply: string } | null {
  const t = norm(String(text ?? "")).trim();
  if (!t) return null;
  const asksRejected = /rechaz|me negaron|negado|por que no|no me (aprobaron|aprueban|dieron|dan|prestan)/.test(t);
  const asksWhy = /por que|porque|explica/.test(t);
  if (asksRejected || asksWhy) {
    const rule = OFFER_WORDS.find(([re]) => re.test(t));
    const offer = rule && offers.find((o) => o.offer_id === rule[1]);
    if (offer) return { intent: "oferta", reply: aboutOffer(offer, asksRejected) };
    if (asksRejected && CREDIT_WORDS.test(t)) return { intent: "rechazos", reply: rejectedSummary(offers) };
  }
  for (const f of FAQ) {
    if (f.intent !== "seguridad" && f.intent !== "que_es" && !CREDIT_WORDS.test(t) && !["quien_presta", "quien_decide", "requisitos"].includes(f.intent)) continue;
    if ((f.intent === "quien_presta" || f.intent === "quien_decide" || f.intent === "requisitos") && !CREDIT_WORDS.test(t) && !OFFER_WORDS.some(([re]) => re.test(t))) continue;
    if (f.when.test(t)) return { intent: f.intent, reply: f.reply(state, plans) };
  }
  return null;
}
