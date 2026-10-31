/**
 * Cerebro de Wisi (ver docs/wisi-cerebro.md). Sin imports de `cloudflare:workers`.
 * N0 reglas -> N1 clasificador barato (OpenRouter) -> N2 explicador (solo credito_explicar).
 * El modelo elige, no ejecuta: su salida se valida contra una lista blanca.
 */
import { CATALOG } from "./credit.ts";
import type { Offer } from "./credit.ts";
import { FOUNDATIONS, SERVICES } from "./fixtures.ts";

export interface BrainEnv {
  OPENROUTER_API_KEY?: string;
  OPENROUTER_MODEL_FAST?: string;
  OPENROUTER_MODEL_SMART?: string;
}

export const ACTIONS = [
  "saldo", "movimientos", "pagar_servicio", "estacionamiento", "donar", "enviar",
  "creditos_escanear", "credito_ver", "credito_explicar", "abrir_pantalla", "conversar",
] as const;
export type Action = (typeof ACTIONS)[number];
export type Params = Record<string, string | number>;
export interface BrainResult {
  tier: "N0" | "N1" | "N2"; action: Action; params: Params; reply: string; model?: string; cost_usd?: number;
}

export const DEFAULT_FAST = "mistralai/mistral-nemo,meta-llama/llama-3.1-8b-instruct,openai/gpt-oss-20b";
export const DEFAULT_SMART = "anthropic/claude-haiku-5.5";
export const SCREENS = ["home", "wallet", "pagar_servicios", "parking", "donaciones", "enviar_fondos", "movimientos", "recargas", "club", "mis_pagos", "credirecto"];
export const DAILY_CAP = { n1: 40, n2: 10 };

export function parseModels(value: string | undefined, fallback: string): string[] {
  const list = (value || "").split(",").map((s) => s.trim()).filter(Boolean);
  return list.length ? list : fallback.split(",");
}

// ---- saneo y validación ----------------------------------------------------------

/** Reemplaza secuencias de 6 o más dígitos por [número] y recorta a 400 caracteres. */
export function sanitize(text: string): string {
  return String(text ?? "").replace(/\d{6,}/g, "[número]").slice(0, 400);
}

const ACTION_PARAMS: Record<Action, string[]> = {
  saldo: [], movimientos: [], estacionamiento: [], conversar: [],
  pagar_servicio: ["service_ref", "account_number", "amount_minor"],
  donar: ["foundation_ref", "amount_minor"],
  enviar: ["recipient_ref", "amount_minor"],
  creditos_escanear: ["vertical"],
  credito_ver: ["offer_id"],
  credito_explicar: ["offer_id", "vertical"],
  abrir_pantalla: ["screen_key"],
};

const PARAM_CHECK: Record<string, (v: unknown) => string | number | null> = {
  service_ref: (v) => (typeof v === "string" && SERVICES.some((s) => s.service_ref === v) ? v : null),
  foundation_ref: (v) => (typeof v === "string" && FOUNDATIONS.some((f) => f.foundation_ref === v) ? v : null),
  account_number: (v) => (typeof v === "string" && /^\d{4,24}$/.test(v) ? v : typeof v === "number" && Number.isInteger(v) && v > 0 && String(v).length >= 4 ? String(v) : null),
  amount_minor: (v) => (typeof v === "number" && Number.isInteger(v) && v > 0 && v <= 100_000_000_00 ? v : null),
  recipient_ref: (v) => (typeof v === "string" && /^@[\w.]{2,30}$/.test(v) ? v : null),
  offer_id: (v) => (typeof v === "string" && CATALOG.some((c) => c.offer_id === v) ? v : null),
  vertical: (v) => (typeof v === "string" && CATALOG.some((c) => c.vertical === v) ? v : null),
  screen_key: (v) => (typeof v === "string" && SCREENS.includes(v) ? v : null),
};

const REQUIRED: Partial<Record<Action, string[]>> = {
  pagar_servicio: ["service_ref"], donar: ["foundation_ref"], enviar: ["recipient_ref", "amount_minor"], abrir_pantalla: ["screen_key"],
};

/** Valida la salida del modelo contra la lista blanca. Devuelve null si no sirve. */
export function validateModelOutput(raw: unknown): { action: Action; params: Params; reply?: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.action !== "string" || !(ACTIONS as readonly string[]).includes(o.action)) return null;
  const action = o.action as Action;
  const params: Params = {};
  const given = o.params && typeof o.params === "object" ? (o.params as Record<string, unknown>) : {};
  for (const k of ACTION_PARAMS[action]) {
    if (!(k in given)) continue;
    const v = PARAM_CHECK[k](given[k]);
    if (v !== null) params[k] = v;
  }
  for (const k of REQUIRED[action] ?? []) if (!(k in params)) return null;
  const reply = typeof o.reply === "string" && o.reply.trim() ? o.reply.trim().slice(0, 300) : undefined;
  return { action, params, reply };
}

// ---- N0: reglas --------------------------------------------------------------------

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** '1.234,56' | '1234.56' | '50' -> céntimos. */
export function parseAmountMinor(raw: string): number | null {
  let s = raw.trim();
  if (!/^\d[\d.,]*$/.test(s)) return null;
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

/** Extrae número de cuenta/contrato (6+ dígitos) y monto del texto original (nunca va al modelo). */
export function extractNumbers(text: string): { account_number?: string; amount_minor?: number; recipient_ref?: string } {
  const out: { account_number?: string; amount_minor?: number; recipient_ref?: string } = {};
  const acc = text.match(/\d{6,}/);
  if (acc) out.account_number = acc[0];
  const rest = text.replace(/\d{6,}/g, " ");
  const m = rest.match(/(?:bs\.?|bol[ií]vares?)\s*(\d[\d.,]*)/i) || rest.match(/(\d[\d.,]*)\s*(?:bs\b\.?|bol[ií]vares?)/i) || rest.match(/\b(\d[\d.,]*)\b/);
  if (m) {
    const a = parseAmountMinor(m[1].replace(/[.,]+$/, ""));
    if (a) out.amount_minor = a;
  }
  const r = text.match(/@([\w.]{2,30})/);
  if (r) out.recipient_ref = `@${r[1]}`;
  return out;
}

const SERVICE_WORDS: [RegExp, string][] = [
  [/digitel/, "digitel"], [/movistar/, "movistar"], [/movilnet/, "movilnet"],
  [/corpoelec|\bluz\b|electricidad/, "corpoelec"], [/cantv|internet/, "cantv"], [/condominio/, "condominio"],
];
const FOUNDATION_WORDS: [RegExp, string][] = [
  [/fundana/, "fundana"], [/senosayuda|senos ayuda/, "senosayuda"], [/banco de alimentos|alimentos/, "banco_alimentos"],
];
const SCREEN_WORDS: [RegExp, string][] = [
  [/credirecto|creditos/, "credirecto"], [/billetera|wallet/, "wallet"], [/pagar servicios|servicios/, "pagar_servicios"],
  [/parking|estacionamiento/, "parking"], [/donaciones|donar/, "donaciones"], [/enviar fondos|enviar dinero/, "enviar_fondos"],
  [/movimientos|historial/, "movimientos"], [/recargas?/, "recargas"], [/club/, "club"], [/mis pagos/, "mis_pagos"],
  [/\bhome\b|inicio|principal/, "home"],
];

const REPLIES: Record<Action, string> = {
  saldo: "Te muestro tu saldo.", movimientos: "Aquí van tus movimientos.", pagar_servicio: "Preparo el pago del servicio.",
  estacionamiento: "Abro el escáner de tu ticket.", donar: "Preparo la donación.", enviar: "Preparo el envío.",
  creditos_escanear: "Escaneo tus ofertas de Credirecto.", credito_ver: "Te muestro tus créditos.",
  credito_explicar: "Te lo explico.", abrir_pantalla: "Te llevo ahí.", conversar: "",
};
const hit = (action: Action, params: Params = {}): BrainResult => ({ tier: "N0", action, params, reply: REPLIES[action] });

/** N0: expresiones regulares. Devuelve null si no entiende con certeza. */
export function routeN0(text: string): BrainResult | null {
  const t = norm(text);
  if (!t.trim()) return null;
  const nums = extractNumbers(text);
  const credit = /credit|credirecto|financi|cuota|linea de|prestamo/.test(t);

  const open = /\b(abre|abrir|abreme|llevame|lleva me|ir a|ve a|vamos a|muestrame la pantalla)\b/.test(t);
  if (open) {
    const s = SCREEN_WORDS.find(([re]) => re.test(t));
    if (s) return hit("abrir_pantalla", { screen_key: s[1] });
  }
  if (/\b(por que|explica\w*|porque|como funciona)\b/.test(t) && credit) {
    const params: Params = {};
    const o = CATALOG.find((c) => t.includes(norm(c.title).split(":")[0]));
    if (o) params.offer_id = o.offer_id;
    return hit("credito_explicar", params);
  }
  if (/(escane\w*|busca\w*|revisa\w*|ofertas?|disponibles?).*(credit|credirecto)|(credit\w*|credirecto).*(escane\w*|disponibles?|ofertas?)|^credirecto$/.test(t))
    return hit("creditos_escanear");
  if (/mis credit|mi credit|mi linea|mis cuotas|proxima cuota|cuanto debo|mi plan de pago|estado de mi credit/.test(t)) return hit("credito_ver");
  if (/\b(saldo|cuanto (dinero |plata )?tengo|cuanta plata tengo)\b/.test(t) && !credit) return hit("saldo");
  if (/\b(movimientos|historial|ultimos pagos|transacciones)\b/.test(t)) return hit("movimientos");

  const recipient = nums.recipient_ref;
  if (/\b(env\w+|mand\w+|transfier\w+|transfer\w+)\b/.test(t) && recipient && nums.amount_minor && !nums.account_number)
    return hit("enviar", { recipient_ref: recipient, amount_minor: nums.amount_minor });
  if (/\bdon(a\w*|o)\b/.test(t)) {
    const f = FOUNDATION_WORDS.find(([re]) => re.test(t));
    if (f) {
      const params: Params = { foundation_ref: f[1] };
      if (nums.amount_minor && !nums.account_number) params.amount_minor = nums.amount_minor;
      return hit("donar", params);
    }
  }
  const svc = SERVICE_WORDS.find(([re]) => re.test(t));
  if (svc && /\b(pag\w+|cancel\w+|abon\w+)\b/.test(t)) {
    const params: Params = { service_ref: svc[1] };
    if (nums.account_number) params.account_number = nums.account_number;
    if (nums.amount_minor) params.amount_minor = nums.amount_minor;
    return hit("pagar_servicio", params);
  }
  if (/\b(ticket|estacionamiento|parking)\b/.test(t) && /\b(pag\w+|escane\w*|escaner|lee\w*|cobr\w+)\b/.test(t)) return hit("estacionamiento");
  return null;
}

// ---- OpenRouter ----------------------------------------------------------------------

type FetchFn = typeof fetch;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const TIMEOUT_MS = 6000;

export interface ChatOut { content: string; model?: string; cost?: number }

export async function chat(
  apiKey: string, models: string[], system: string, user: string,
  opts: { max_tokens: number; json: boolean }, fetchImpl: FetchFn = fetch,
): Promise<ChatOut | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const body: Record<string, unknown> = {
      model: models[0], models, provider: { sort: "price" },
      max_tokens: opts.max_tokens, temperature: 0,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    };
    if (opts.json) body.response_format = { type: "json_object" };
    const r = await fetchImpl(OPENROUTER_URL, {
      method: "POST", signal: ctl.signal,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { model?: string; choices?: { message?: { content?: string } }[]; usage?: { cost?: number } };
    const content = j.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) return null;
    const cost = typeof j.usage?.cost === "number" ? j.usage.cost : undefined;
    return { content, model: j.model, cost };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const N1_SYSTEM =
  "Eres el clasificador de Wisi, asistente con IA de una billetera. Elige UNA acción para el mensaje del usuario y responde SOLO un JSON " +
  '{"action": string, "params": object, "reply": string}. Acciones: saldo, movimientos, pagar_servicio (params: service_ref de ' +
  SERVICES.map((s) => s.service_ref).join("|") + "), estacionamiento, donar (foundation_ref de " + FOUNDATIONS.map((f) => f.foundation_ref).join("|") +
  "), enviar (recipient_ref @usuario), creditos_escanear (buscar ofertas de crédito), credito_ver (ver mis créditos y cuotas), " +
  "credito_explicar (explicar por qué una oferta se aprobó o rechazó; params opcional offer_id), abrir_pantalla (screen_key de " + SCREENS.join("|") +
  "), conversar (cualquier otra cosa; reply con una frase breve). Los números largos aparecen como [número]; no los inventes. No decides dinero ni crédito.";

/** N1: clasifica con el modelo rápido. Devuelve null ante cualquier error. */
export async function classifyN1(env: BrainEnv, text: string, screen: string | undefined, fetchImpl: FetchFn = fetch) {
  if (!env.OPENROUTER_API_KEY) return null;
  const models = parseModels(env.OPENROUTER_MODEL_FAST, DEFAULT_FAST);
  const user = JSON.stringify({ pantalla: SCREENS.includes(String(screen)) ? screen : "desconocida", mensaje: sanitize(text) });
  const out = await chat(env.OPENROUTER_API_KEY, models, N1_SYSTEM, user, { max_tokens: 120, json: true }, fetchImpl);
  if (!out) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(out.content); } catch { return null; }
  const v = validateModelOutput(parsed);
  if (!v) return null;
  return { ...v, model: out.model ?? models[0], cost: out.cost };
}

// ---- N2: explicador --------------------------------------------------------------------

const N2_SYSTEM =
  "Eres Wisi, asistente con IA de Pago Directo. Explica en español simple, en 2 o 3 frases, la decisión que YA tomó el motor de crédito. " +
  "Usa solo los datos recibidos; no cambies la decisión, no inventes montos ni condiciones. Aclara quién presta y que es un demo simulado.";

const hashKey = (s: string) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

/** Si el texto del modelo contradice la decisión del motor, se muestra la del motor. */
export function contradicts(text: string, offers: Pick<Offer, "status">[]): boolean {
  const t = norm(text);
  const anyApproved = offers.some((o) => o.status !== "por_desbloquear");
  const anyBlocked = offers.some((o) => o.status === "por_desbloquear");
  if (!anyApproved && /\b(aprobad[oa]s?|te lo aprobamos|puedes usar)\b/.test(t) && !/\bno\b/.test(t)) return true;
  if (!anyBlocked && /\b(rechazad[oa]s?|no calificas|no puedes)\b/.test(t)) return true;
  return false;
}

export function fixedExplanation(offers: Offer[]): string {
  if (offers.length === 1) return `${offers[0].title}: ${offers[0].reason}.`.replace(/\.\.$/, ".");
  if (!offers.length) return "No encuentro ofertas de crédito para explicar.";
  const n = (s: string) => offers.filter((o) => o.status === s).length;
  return `De ${offers.length} ofertas, ${n("disponible")} están disponibles, ${n("precalificado")} precalificadas y ${n("por_desbloquear")} por desbloquear. Es un demo simulado.`;
}

export interface Hooks {
  take(tier: "n1" | "n2"): Promise<boolean>;
  cacheGet(key: string): Promise<string | null>;
  cachePut(key: string, value: string): Promise<void>;
  offers(): Promise<Offer[]>;
}

async function explain(env: BrainEnv, params: Params, prior: Pick<BrainResult, "tier" | "model" | "cost_usd">, hooks: Hooks, fetchImpl: FetchFn): Promise<BrainResult> {
  let offers = await hooks.offers();
  if (params.offer_id) offers = offers.filter((o) => o.offer_id === params.offer_id);
  else if (params.vertical) offers = offers.filter((o) => o.vertical === params.vertical);
  const fixed: BrainResult = { ...prior, action: "credito_explicar", params, reply: fixedExplanation(offers) };
  if (!offers.length || !env.OPENROUTER_API_KEY) return fixed;

  const key = `n2:${hashKey(offers.map((o) => `${o.offer_id}|${o.status}|${o.reason}`).join(";"))}`;
  const cached = await hooks.cacheGet(key);
  if (cached) return { ...fixed, tier: "N2", reply: cached };
  if (!(await hooks.take("n2"))) return fixed;

  const ctx = offers.slice(0, 6).map((o) => ({ oferta: o.title, quien_presta: o.funder, estado: o.status, motivo: o.reason }));
  const models = parseModels(env.OPENROUTER_MODEL_SMART, DEFAULT_SMART);
  const out = await chat(env.OPENROUTER_API_KEY, models, N2_SYSTEM, JSON.stringify(ctx), { max_tokens: 350, json: false }, fetchImpl);
  if (!out) return fixed;
  const reply = out.content.trim().slice(0, 700);
  if (contradicts(reply, offers)) return { ...fixed, tier: "N2", model: out.model ?? models[0], cost_usd: out.cost };
  await hooks.cachePut(key, reply);
  return { ...fixed, tier: "N2", reply, model: out.model ?? models[0], cost_usd: out.cost };
}

// ---- orquestador --------------------------------------------------------------------------

const talk = (tier: BrainResult["tier"], reply = ""): BrainResult => ({ tier, action: "conversar", params: {}, reply });

/** Resuelve un mensaje con el nivel más barato que lo entienda. Ante cualquier error, `conversar`. */
export async function think(env: BrainEnv, text: string, screen: string | undefined, hooks: Hooks, fetchImpl: FetchFn = fetch): Promise<BrainResult> {
  try {
    text = String(text ?? "").trim();
    if (!text) return talk("N0");
    const n0 = routeN0(text);
    if (n0) return n0.action === "credito_explicar" ? await explain(env, n0.params, { tier: "N0" }, hooks, fetchImpl) : n0;
    if (!env.OPENROUTER_API_KEY) return talk("N0");
    if (!(await hooks.take("n1"))) return talk("N0");
    const n1 = await classifyN1(env, text, screen, fetchImpl);
    if (!n1) return talk("N1");
    const prior = { tier: "N1" as const, model: n1.model, cost_usd: n1.cost };
    if (n1.action === "conversar") return { ...prior, action: "conversar", params: {}, reply: n1.reply ?? "" };
    // Los números sensibles los extrae N0 del texto original, nunca el modelo.
    const params: Params = { ...n1.params };
    const nums = extractNumbers(text);
    if (n1.action === "pagar_servicio") { delete params.account_number; if (nums.account_number) params.account_number = nums.account_number; }
    if (["pagar_servicio", "donar", "enviar"].includes(n1.action) && nums.amount_minor && !params.amount_minor && !(nums.account_number && n1.action !== "pagar_servicio")) params.amount_minor = nums.amount_minor;
    if (n1.action === "credito_explicar") return await explain(env, params, prior, hooks, fetchImpl);
    return { ...prior, action: n1.action, params, reply: REPLIES[n1.action] };
  } catch {
    return talk("N0");
  }
}
