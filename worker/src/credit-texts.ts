/**
 * Respuestas de Wisi sobre crédito. Son textos fijos, instantáneos y sin modelo de
 * lenguaje: los datos salen del motor (credit.ts), nunca se inventan. Devuelven null si
 * la pregunta no es de aquí, y entonces sigue el flujo normal. Ver docs/creditos-textos.md.
 */
import { bs, lines } from "./credit.ts";
import type { CreditState, Offer, Plan } from "./credit.ts";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const OFFER_WORDS: [RegExp, string][] = [[/roques/, "saga_roques"], [/merida/, "saga_merida"], [/margarita/, "saga_margarita"]];
// Lo que antes tenía crédito y ya no: se aclara en vez de inventar.
const OUT_OF_SCOPE = /\bcarro\b|vehiculo|corolla|conduce|apartamento|\bcasa\b|inmueble|hipoteca|propiedash|estei|condominio|cantv|estacionamiento|concierto|tugruero|\bgrua\b|\bseguros?\b|\brcv\b|mercantil|efectivo/;
const ONLY_SAGA = "Por ahora el crédito es solo para los planes de SAGA: Los Roques, Mérida y Margarita. Para eso no armamos órdenes.";
const CREDIT_WORDS = /credit|credirecto|prestamo|cuota|financ|\blinea\b|\binicial\b|\bintereses?\b|\borden(es)?\b|\bsaga\b/;

/** El motivo del motor sin la etiqueta inicial, que la frase ya dice con otras palabras. */
const motive = (o: Offer) => o.reason.replace(/^(Aprobado|Rechazado|Precalificado):\s*/, "").replace(/^pides /, "pedimos ").replace(/\.?$/, ".");
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

function aboutOffer(o: Offer, askedRejected: boolean): string {
  if (o.status === "por_desbloquear") return `${o.title} todavía está por desbloquear. ${cap(motive(o))}`;
  return `${askedRejected ? "No está rechazado. " : ""}${o.title} está disponible: ${motive(o)} Elige tus cuotas y armas la orden con SAGA.`;
}

function rejectedSummary(offers: Offer[]): string {
  const blocked = offers.filter((o) => o.status === "por_desbloquear");
  if (!blocked.length) return `Ahora mismo no tienes ningún crédito rechazado: ${offers.length} planes de SAGA están disponibles. ¿Cuál te interesa?`;
  return `Tienes ${blocked.length} por desbloquear: ${blocked.map((o) => `${o.title} (${motive(o).replace(/\.$/, "")})`).join("; ")}.`;
}

interface Faq { intent: string; when: RegExp; credit?: boolean; reply: (state: CreditState, plans: Plan[]) => string }

const FAQ: Faq[] = [
  { intent: "seguridad", when: /\bpin\b|\bclave\b|estafa|me (estan )?llama(n|ndo|ron)/, reply: () =>
    "Nunca te pedimos tu PIN ni tu clave por chat ni por teléfono, y Wisi no te llama. Si alguien te los pide, no se los des." },
  { intent: "es_real", when: /\b(es|son) (real|reales|de verdad)\b|dinero real|credito real/, reply: () =>
    "Es una simulación: los planes, los montos y las órdenes son de ejemplo y no se mueve dinero real." },
  { intent: "quien_decide", when: /quien (decide|aprueba|me aprueba)|wisi (decide|aprueba)|como (deciden|aprueban|evaluan)/, reply: () =>
    "Decide un motor de reglas, no Wisi ni la inteligencia artificial: mira tus pagos a tiempo, si tienes cuotas vencidas y tu línea disponible. Siempre te mostramos el motivo." },
  { intent: "saga", when: /que es saga|quien es saga|por que saga|quien (me )?(presta|financia|pone el dinero)|con que banco|que banco/, reply: () =>
    "SAGA centraliza tu compra: reúne los planes y tu orden. La línea para viajes es de Pago Directo; en esta demo no interviene ningún banco." },
  { intent: "orden", when: /(que|cual) es (una|la) orden|como (armo|hago|creo|funciona)( una| la| mi)? (orden|credito)|donde (veo|esta|guardan|se guarda)( mi| mis| la)? ordene?s?|se guarda/, reply: () =>
    "Eliges un plan de SAGA y tus cuotas, y armas la orden de compra en el área de Créditos. No se cobra nada y queda guardada en este navegador, también en tus Movimientos. Si borras los datos del navegador, se pierde." },
  { intent: "intereses", when: /\bintereses?\b|comision|recargo/, reply: () =>
    "En esta demo, las cuotas de los planes de SAGA van sin intereses ni comisión." },
  { intent: "inicial", when: /\binicial\b|cuanto (hay que|tengo que) (dar|poner)/, reply: (s) =>
    `Con tu nivel ${s.level}, la inicial es del 40 % del plan. La orden la indica, pero al armarla no se cobra.` },
  { intent: "cuotas", when: /cuantas cuotas|en cuantas|cada cuanto|plazos?\b|como son las cuotas/, reply: () =>
    "Los planes de SAGA van de 2 a 4 cuotas quincenales. Ves cada fecha y monto antes de armar la orden." },
  { intent: "pago_cuota", when: /como (pago|abono|pagar|abonar)|cuando (pago|me toca|vence|tengo que pagar)|proxima cuota|fecha de pago/, reply: () =>
    "En esta demo no se cobran cuotas: la orden muestra sus fechas y montos como referencia." },
  { intent: "requisitos", when: /requisito|que (necesito|me piden|piden|debo tener)|documentos|papeles/, reply: () =>
    "Para los planes de SAGA necesitas 6 pagos a tiempo, ninguna cuota vencida y que lo financiado quepa en tu línea para viajes." },
  { intent: "cuanto_tengo", when: /cuanto (me )?(prestan|pueden prestar|me dan|puedo pedir|tengo disponible|tengo de credito)|cual es mi (linea|limite|cupo)|mi limite/, reply: (s) =>
    `Tu línea para viajes es de ${bs(lines(s).turismo.limit_minor)}. Lo que ya tengas en órdenes lo ves descontado en el área de Créditos.` },
  { intent: "que_es", when: /que es (el |la )?(credirecto|credito)|como funciona (el |la )?(credirecto|credito)|para que sirve/, reply: () =>
    "Credirecto te deja armar una orden de compra a crédito para los planes de SAGA, en cuotas. La encuentras en Funciones, en Créditos." },
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
    if (asksRejected && CREDIT_WORDS.test(t) && !OUT_OF_SCOPE.test(t)) return { intent: "rechazos", reply: rejectedSummary(offers) };
  }
  if (CREDIT_WORDS.test(t) && OUT_OF_SCOPE.test(t) && /\?|por que|rechaz|tienen?|puedo|hay|cuanto|como/.test(t)) return { intent: "solo_saga", reply: ONLY_SAGA };
  for (const f of FAQ) {
    if (f.intent !== "seguridad" && !CREDIT_WORDS.test(t)) continue;
    if (f.when.test(t)) return { intent: f.intent, reply: f.reply(state, plans) };
  }
  return null;
}
