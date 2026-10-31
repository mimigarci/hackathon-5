/**
 * Gateway WisiVoz en Cloudflare Workers.
 *
 * Port de backend/app (FastAPI) con el mismo contrato REST, para que la webapp
 * (/, /demo), la consola React y Flutter funcionen sin cambios. Diferencias:
 * - El ledger simulado vive en un Durable Object por principal (persistente).
 * - La prueba de aprobación se verifica criptográficamente al confirmar.
 * Las webhook tools /el/tools/* no se portan: los agentes usan client tools.
 */
import { DurableObject } from "cloudflare:workers";
import { FOUNDATIONS, INITIAL_WALLET_BALANCE_MINOR, SERVICES } from "./fixtures";
import { checkOffer, demoState, findOffer, lineOf, lines, nextInstallment, planFor, precalifyInfo, quote, scanOffers } from "./credit.ts";
import type { CreditState, Plan } from "./credit.ts";
import { DAILY_CAP, think } from "./brain.ts";

export interface Env {
  ASSETS: Fetcher;
  WALLET: DurableObjectNamespace<Wallet>;
  ELEVENLABS_API_KEY?: string;
  ELEVENLABS_AGENT_ID?: string;
  ELEVENLABS_AGENT_ID_FEMALE?: string;
  ELEVENLABS_AGENT_ID_MALE?: string;
  WISIVOZ_SESSION_SECRET?: string;
  WISIVOZ_INTENT_TTL?: string;
  WISIVOZ_SIGNED_PER_IP_10MIN?: string;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_MODEL_FAST?: string;
  OPENROUTER_MODEL_SMART?: string;
}

type Status = "ok" | "pending" | "requires_confirmation" | "denied" | "unavailable" | "error";
interface ToolResponse {
  request_id: string;
  status: Status;
  data: Record<string, unknown>;
  error: { code: string; message: string } | null;
  speech: string | null;
}

// ---- utilidades ---------------------------------------------------------------

const hex = (buf: ArrayBuffer | Uint8Array) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const rid = () => `req_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
const uid = (prefix: string, n = 16) => `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, n)}`;

/** Formatea céntimos como 'Bs 1.234,56' (es-VE), igual que tools._bs. */
function bs(minor: number): string {
  const [int, dec] = (minor / 100).toFixed(2).split(".");
  return `Bs ${int.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${dec}`;
}

function resp(status: Status, speech: string | null, data: Record<string, unknown> = {}, error: ToolResponse["error"] = null): ToolResponse {
  return { request_id: rid(), status, data, error, speech };
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "*",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS } });
const fail = (status: number, detail: string) => json({ detail }, status);

// ---- seguridad (equivalente a security.py) ------------------------------------

const keyCache = new Map<string, Promise<CryptoKey>>();
function hmacKey(secret: string) {
  let k = keyCache.get(secret);
  if (!k) {
    k = crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    keyCache.set(secret, k);
  }
  return k;
}
async function sign(env: Env, payload: string): Promise<string> {
  const secret = env.WISIVOZ_SESSION_SECRET || "dev-secret-change-me";
  return hex(await crypto.subtle.sign("HMAC", await hmacKey(secret), new TextEncoder().encode(payload)));
}
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
async function issueSessionToken(env: Env, principal: string, ttl = 1800): Promise<string> {
  const raw = JSON.stringify({ exp: Math.floor(Date.now() / 1000) + ttl, sub: principal });
  return `${hex(new TextEncoder().encode(raw))}.${await sign(env, raw)}`;
}
async function verifySessionToken(env: Env, token: string): Promise<string | null> {
  const [rawHex, sig] = token.split(".", 2);
  if (!rawHex || !sig || rawHex.length % 2) return null;
  try {
    const raw = new TextDecoder().decode(new Uint8Array(rawHex.match(/../g)!.map((h) => parseInt(h, 16))));
    if (!safeEqual(sig, await sign(env, raw))) return null;
    const body = JSON.parse(raw);
    if (Number(body.exp ?? 0) < Date.now() / 1000) return null;
    return typeof body.sub === "string" ? body.sub : null;
  } catch {
    return null;
  }
}
const approvalProof = (env: Env, principal: string, intentId: string, factor: string) =>
  sign(env, `${principal}:${intentId}:${factor}`);

async function principalOf(req: Request, env: Env): Promise<string | Response> {
  const auth = req.headers.get("authorization") || "";
  if (!auth.toLowerCase().startsWith("bearer ")) return fail(401, "missing_bearer_token");
  return (await verifySessionToken(env, auth.slice(7))) ?? fail(401, "invalid_token");
}

// ---- monedero: un Durable Object por principal (sustituye a ledger.py) --------

interface Intent {
  intent_id: string; kind: string; amount_minor: number; fee_minor: number;
  details: Record<string, string>; created_at: number; ttl_seconds: number; state: string;
  credit?: { offer_id: string; installments: number }; operation_ref?: string;
}
interface Operation {
  operation_ref: string; intent_id: string; kind: string; amount_minor: number;
  fee_minor: number; state: string; created_at: number; plan_id?: string;
}
type ExecResult = "executed" | "replayed" | "expired" | "insufficient_funds" | "not_found" | "credit_rejected" | "credit_over_limit";
interface ExecOut { result: ExecResult; op?: Operation; balance: number; plan?: Plan; reason?: string }
const today = () => new Date().toISOString().slice(0, 10);

export class Wallet extends DurableObject<Env> {
  private async balanceMinor(): Promise<number> {
    return (await this.ctx.storage.get<number>("balance")) ?? INITIAL_WALLET_BALANCE_MINOR;
  }

  async balance(): Promise<number> {
    return this.balanceMinor();
  }

  async createIntent(kind: string, amount_minor: number, details: Record<string, string>, ttl_seconds: number, credit?: Intent["credit"]): Promise<Intent> {
    const intent: Intent = {
      intent_id: uid("int"), kind, amount_minor, fee_minor: 0, details,
      created_at: Date.now() / 1000, ttl_seconds, state: "quoted",
    };
    if (credit) intent.credit = credit;
    await this.ctx.storage.put(`intent:${intent.intent_id}`, intent);
    return intent;
  }

  /** Ejecuta una intención de forma idempotente (misma prueba -> misma operación). */
  async execute(intent_id: string, proof: string): Promise<ExecOut> {
    // Las llamadas a un Durable Object se serializan: no hace falta lock.
    const s = this.ctx.storage;
    const replay = await s.get<string>(`idem:${proof}`);
    if (replay) return this.replayed(await s.get<Operation>(`op:${replay}`));

    const intent = await s.get<Intent>(`intent:${intent_id}`);
    if (!intent) return { result: "not_found", balance: await this.balanceMinor() };
    // Una intención ya ejecutada no se vuelve a ejecutar, con ninguna prueba.
    if (intent.state === "submitted" && intent.operation_ref) {
      const prev = await s.get<Operation>(`op:${intent.operation_ref}`);
      if (prev) {
        await s.put(`idem:${proof}`, prev.operation_ref);
        return this.replayed(prev);
      }
    }
    if (Date.now() / 1000 > intent.created_at + intent.ttl_seconds) {
      intent.state = "expired";
      await s.put(`intent:${intent_id}`, intent);
      return { result: "expired", balance: await this.balanceMinor() };
    }
    const total = intent.amount_minor + intent.fee_minor;
    const bal = await this.balanceMinor();
    if (bal < total) return { result: "insufficient_funds", balance: bal };

    const op: Operation = {
      operation_ref: uid("op"), intent_id, kind: intent.kind, amount_minor: intent.amount_minor,
      fee_minor: intent.fee_minor, state: "settled", created_at: Date.now() / 1000,
    };
    const writes: Record<string, unknown> = {};
    let plan: Plan | undefined;
    if (intent.kind === "credit") {
      // Se vuelve a comprobar aquí, en el mismo método, que lo financiado cabe en la línea (atómico).
      const st = await this.creditState();
      const c = intent.credit && checkOffer(intent.credit.offer_id, st);
      if (!c || !intent.credit || c.piso === 3) return { result: "credit_rejected", balance: bal, reason: "La oferta de crédito ya no está disponible." };
      if (!c.eligible) return { result: c.code === "credit_over_limit" ? "credit_over_limit" : "credit_rejected", balance: bal, reason: c.reason };
      plan = planFor(intent.credit.offer_id, intent.credit.installments, st, new Date(), uid("plan", 12)) ?? undefined;
      if (!plan) return { result: "credit_rejected", balance: bal, reason: "Las cuotas de la oferta ya no son válidas." };
      const line = lineOf(c.piso)!;
      op.plan_id = plan.plan_id;
      writes["credit:used"] = { ...st.used, [line]: st.used[line] + c.financed_minor };
      writes["credit:plans"] = [...(await s.get<Plan[]>("credit:plans") ?? []), plan];
    }
    intent.state = "submitted";
    intent.operation_ref = op.operation_ref;
    await s.put({
      ...writes,
      balance: bal - total,
      [`intent:${intent_id}`]: intent,
      [`op:${op.operation_ref}`]: op,
      [`idem:${proof}`]: op.operation_ref,
    });
    return { result: "executed", op, balance: bal - total, plan };
  }

  private async replayed(op?: Operation): Promise<ExecOut> {
    const plans = op?.plan_id ? await this.ctx.storage.get<Plan[]>("credit:plans") : undefined;
    return { result: "replayed", op, balance: await this.balanceMinor(), plan: plans?.find((p) => p.plan_id === op?.plan_id) };
  }

  // ---- crédito (Credirecto) y cerebro de Wisi ----

  /** Estado del motor: perfil demo constante + lo usado de cada línea. */
  async creditState(): Promise<CreditState> {
    return demoState((await this.ctx.storage.get<CreditState["used"]>("credit:used")) ?? { cotidiano: 0, turismo: 0 });
  }

  async creditView(): Promise<{ state: CreditState; plans: Plan[] }> {
    return { state: await this.creditState(), plans: (await this.ctx.storage.get<Plan[]>("credit:plans")) ?? [] };
  }

  /** Cuenta una llamada al modelo del día; false si se alcanzó el tope (40 N1 / 10 N2). */
  async brainTake(tier: "n1" | "n2"): Promise<boolean> {
    const key = `brain:${today()}`;
    const c = (await this.ctx.storage.get<{ n1: number; n2: number }>(key)) ?? { n1: 0, n2: 0 };
    if (c[tier] >= DAILY_CAP[tier]) return false;
    c[tier]++;
    await this.ctx.storage.put(key, c);
    return true;
  }

  async brainCacheGet(key: string): Promise<string | null> {
    return (await this.ctx.storage.get<string>(`brain:cache:${key}`)) ?? null;
  }

  async brainCachePut(key: string, value: string): Promise<void> {
    await this.ctx.storage.put(`brain:cache:${key}`, value);
  }

  async getOperation(ref: string): Promise<Operation | undefined> {
    return this.ctx.storage.get<Operation>(`op:${ref}`);
  }
}

const wallet = (env: Env, principal: string) => env.WALLET.get(env.WALLET.idFromName(principal));

// ---- tools (equivalente a tools.py) --------------------------------------------

const ttl = (env: Env) => Number(env.WISIVOZ_INTENT_TTL || 180);

function requiresConfirmation(env: Env, intent_id: string, speech: string, summary: Record<string, unknown>) {
  return resp("requires_confirmation", speech, { intent_id, summary, ttl_seconds: ttl(env) });
}

const tools = {
  async get_balance(env: Env, p: string) {
    const bal = await wallet(env, p).balance();
    return resp("ok", `Tu saldo disponible es ${bs(bal)}.`, { balance_minor: bal, currency: "VES" });
  },
  list_services(category?: string | null, query?: string | null) {
    let items = SERVICES;
    if (category) items = items.filter((s) => s.category === category);
    if (query) {
      const q = query.toLowerCase();
      items = items.filter((s) => s.name.toLowerCase().includes(q) || s.service_ref.includes(q));
    }
    const names = items.map((s) => s.name).join(", ") || "ninguno";
    return resp("ok", `Servicios que puedo pagarte: ${names}.`, { services: items });
  },
  explain_service(service_ref: string) {
    const svc = SERVICES.find((s) => s.service_ref === service_ref);
    if (!svc) return resp("unavailable", "No encuentro ese servicio en el catálogo.", {}, { code: "service_not_found", message: "Servicio no disponible." });
    return resp("ok", `${svc.name} es un servicio de ${svc.category}. Necesito el número de cuenta o contrato para pagarlo.`, { service: svc });
  },
  list_foundations() {
    return resp("ok", `Puedes donar a: ${FOUNDATIONS.map((f) => f.name).join(", ")}.`, { foundations: FOUNDATIONS });
  },
  async prepare_payment(env: Env, p: string, service_ref: string, account_number: string, amount_minor?: number | null) {
    const svc = SERVICES.find((s) => s.service_ref === service_ref);
    if (!svc) return resp("denied", "Ese servicio no está en el catálogo, no puedo prepararlo.", {}, { code: "service_not_found", message: "Servicio no disponible." });
    const amount = amount_minor ?? svc.sample_pending_minor;
    const it = await wallet(env, p).createIntent("payment", amount, { service: svc.name, account_number }, ttl(env));
    return requiresConfirmation(env, it.intent_id,
      `Vas a pagar ${svc.name}, cuenta ${account_number}, por ${bs(amount)}. ¿Confirmo el pago?`,
      { service: svc.name, account_number, amount_minor: amount });
  },
  async prepare_parking(env: Env, p: string, ticket_ref: string) {
    const amount = 50_00; // lo cotiza el sistema de parking (simulado)
    const it = await wallet(env, p).createIntent("parking", amount, { ticket_ref }, ttl(env));
    return requiresConfirmation(env, it.intent_id, `Tu ticket de estacionamiento ${ticket_ref} son ${bs(amount)}. ¿Lo pago?`, { ticket_ref, amount_minor: amount });
  },
  async prepare_donation(env: Env, p: string, foundation_ref: string, amount_minor: number) {
    const f = FOUNDATIONS.find((x) => x.foundation_ref === foundation_ref);
    if (!f) return resp("denied", "No encuentro esa organización para donar.", {}, { code: "foundation_not_found", message: "Fundación no disponible." });
    const it = await wallet(env, p).createIntent("donation", amount_minor, { foundation: f.name }, ttl(env));
    return requiresConfirmation(env, it.intent_id, `Vas a donar ${bs(amount_minor)} a ${f.name}. ¿Confirmo la donación?`, { foundation: f.name, amount_minor });
  },
  async prepare_transfer(env: Env, p: string, recipient_ref: string, amount_minor: number, kind: string) {
    const it = await wallet(env, p).createIntent("transfer", amount_minor, { recipient_ref, transfer_kind: kind }, ttl(env));
    return requiresConfirmation(env, it.intent_id, `Vas a enviar ${bs(amount_minor)} a ${recipient_ref}. ¿Confirmo el envío?`, { recipient_ref, amount_minor, kind });
  },
  async get_credit_status(env: Env, p: string) {
    const { state, plans } = await wallet(env, p).creditView();
    const next = nextInstallment(plans);
    const ln = lines(state);
    const speech = `Tu línea cotidiana disponible es ${bs(ln.cotidiano.available_minor)} y la de turismo ${bs(ln.turismo.available_minor)}.` +
      (next ? ` Tu próxima cuota es de ${bs(next.amount_minor)} el ${next.due_date}.` : " No tienes cuotas pendientes.");
    return resp("ok", speech, {
      level: state.level, ontime_payments: state.ontime_payments, months_active: state.months_active, overdue: state.overdue,
      lines: ln, plans, next_installment: next,
    });
  },
  async scan_credit_offers(env: Env, p: string) {
    const { state } = await wallet(env, p).creditView();
    const { offers, summary } = scanOffers(state, new Date());
    const per = (n: number) => offers.filter((o) => o.piso === n && o.status !== "por_desbloquear").length;
    const speech = `Encontré ${summary.disponible} ofertas disponibles y ${summary.precalificado} precalificadas, con ${summary.por_desbloquear} por desbloquear. ` +
      `Cotidianas: ${per(1)}, turismo: ${per(2)}, patrimonio: ${per(3)}. Todo es una simulación.`;
    return resp("ok", speech, { offers, summary });
  },
  async quote_credit(env: Env, p: string, offer_id: string, installments: unknown) {
    const { state } = await wallet(env, p).creditView();
    const q = quote(offer_id, installments, state, new Date());
    if (!q.ok) return resp("denied", q.message, {}, { code: q.code, message: q.message });
    return resp("ok", q.data.reason, q.data as unknown as Record<string, unknown>);
  },
  async prepare_credit(env: Env, p: string, offer_id: string, installments: unknown) {
    const { state } = await wallet(env, p).creditView();
    // El piso 3 siempre es canal bancario, aunque las cuotas pedidas no sean válidas.
    if (findOffer(offer_id)?.piso === 3)
      return resp("denied", "Los vehículos y los inmuebles los presta un banco aliado: puedo precalificarte, no financiarlo yo.", {}, { code: "bank_channel", message: "Este crédito se tramita con un banco aliado." });
    const q = quote(offer_id, installments, state, new Date());
    if (!q.ok) return resp("denied", q.message, {}, { code: q.code, message: q.message });
    if (!q.data.eligible)
      return resp("denied", q.data.reason, {}, { code: q.code ?? "credit_rejected", message: q.data.reason });
    const c = findOffer(offer_id)!;
    const n = q.data.installments.length;
    const it = await wallet(env, p).createIntent("credit", q.data.down_payment_minor, { title: c.title, partner: c.partner, offer_id }, ttl(env), { offer_id, installments: n });
    const down = q.data.down_payment_minor;
    return requiresConfirmation(env, it.intent_id,
      `Credirecto: ${c.title}. ${down ? `Pagas ${bs(down)} de inicial hoy y ` : "Sin inicial; "}financias ${bs(q.data.financed_minor)} en ${n} ${n === 1 ? "cuota" : "cuotas"}, sin interés. ¿Confirmo?`,
      { title: c.title, partner: c.partner, offer_id, piso: c.piso, amount_minor: down, financed_minor: q.data.financed_minor, installments: n, total_minor: q.data.total_minor });
  },
  async precalify_credit(env: Env, p: string, offer_id: string) {
    const { state } = await wallet(env, p).creditView();
    const r = precalifyInfo(offer_id, state);
    if (!r.ok) return resp("denied", r.message, {}, { code: r.code, message: r.message });
    if (!r.eligible) return resp("denied", r.reason, {}, { code: r.code ?? "credit_rejected", message: r.reason });
    return resp("ok", `${r.reason} Es una simulación: no envié nada a ningún banco.`, {
      request_ref: uid("pre", 10), bank_options: r.bank_options, documents: r.documents, estimated: r.estimated,
    });
  },
  async brain(env: Env, p: string, text: unknown, screen: unknown) {
    const w = wallet(env, p);
    const out = await think(env, typeof text === "string" ? text : "", typeof screen === "string" ? screen : undefined, {
      take: (t) => w.brainTake(t),
      cacheGet: (k) => w.brainCacheGet(k),
      cachePut: (k, v) => w.brainCachePut(k, v),
      offers: async () => scanOffers((await w.creditView()).state, new Date()).offers,
    });
    console.log(JSON.stringify({ brain: out.tier, model: out.model ?? null, cost_usd: out.cost_usd ?? null }));
    return resp("ok", out.reply || null, out as unknown as Record<string, unknown>);
  },
  async confirm_and_execute(env: Env, p: string, intent_id: string, proof: string) {
    // La prueba debe ser la emitida para este principal e intención.
    const valid = await Promise.all(["biometric", "pin", "otp"].map((f) => approvalProof(env, p, intent_id, f)));
    if (!proof || !valid.some((v) => safeEqual(v, proof)))
      return resp("denied", "No puedo confirmar esta operación.", {}, { code: "invalid_approval", message: "Prueba de aprobación inválida." });
    const r = await wallet(env, p).execute(intent_id, proof);
    switch (r.result) {
      case "executed":
      case "replayed":
        if (r.op?.kind === "credit") {
          const ins = r.plan?.installments ?? [];
          const init = r.op.amount_minor ? `inicial de ${bs(r.op.amount_minor)} hoy` : "sin inicial";
          const cuotas = ins.length ? `${ins.length} ${ins.length === 1 ? "cuota" : "cuotas"} de ${bs(ins[0].amount_minor)}` : "tus cuotas";
          return resp("ok", `Listo, Credirecto aprobado: ${init} y ${cuotas}. Tu nuevo saldo es ${bs(r.balance)}.`, {
            operation_ref: r.op.operation_ref, state: r.op.state, balance_minor: r.balance, replayed: r.result === "replayed", plan_id: r.op.plan_id,
          });
        }
        return resp("ok", `Listo, pago confirmado. Tu nuevo saldo es ${bs(r.balance)}.`, {
          operation_ref: r.op?.operation_ref, state: r.op?.state, balance_minor: r.balance, replayed: r.result === "replayed",
        });
      case "credit_rejected":
        return resp("denied", r.reason ?? "El crédito no se aprobó.", {}, { code: "credit_rejected", message: r.reason ?? "Crédito rechazado." });
      case "credit_over_limit":
        return resp("denied", r.reason ?? "Superas tu línea disponible.", {}, { code: "credit_over_limit", message: r.reason ?? "Supera la línea disponible." });
      case "not_found":
        return resp("error", "No encuentro esa operación; vamos a empezarla de nuevo.", {}, { code: "intent_not_found", message: "Intención inexistente." });
      case "expired":
        return resp("denied", "La confirmación caducó por seguridad. ¿La preparo de nuevo?", {}, { code: "intent_expired", message: "La intención expiró." });
      case "insufficient_funds":
        return resp("denied", "No tienes saldo suficiente para esta operación.", {}, { code: "insufficient_funds", message: "Saldo insuficiente." });
    }
  },
  async get_operation_status(env: Env, p: string, operation_ref: string) {
    const op = operation_ref ? await wallet(env, p).getOperation(operation_ref) : undefined;
    if (!op) return resp("unavailable", "No encuentro esa operación.", {}, { code: "op_not_found", message: "Operación no encontrada." });
    return resp("ok", `La operación está en estado ${op.state}.`, { operation_ref: op.operation_ref, state: op.state });
  },
  create_support_case(category: string) {
    const case_ref = uid("case", 10);
    return resp("ok", `Abrí el caso ${case_ref} con Atención al Usuario. Te contactarán pronto.`, { case_ref, category });
  },
  open_app_screen(screen_key: string, params: unknown) {
    const allowed = ["home", "wallet", "pagar_servicios", "parking", "donaciones", "enviar_fondos", "movimientos", "recargas", "club", "mis_pagos", "credirecto"];
    if (!allowed.includes(screen_key)) return resp("denied", null, {}, { code: "screen_not_allowed", message: "Pantalla no permitida." });
    return resp("ok", "Te llevo ahí.", { navigate: { screen_key, params: params ?? {} } });
  },
};

// ---- sesión y voz ---------------------------------------------------------------

// Límite best-effort por isolate (protege créditos de ElevenLabs).
const signedHits = new Map<string, number[]>();
function allowSigned(env: Env, ip: string): boolean {
  const now = Date.now(), max = Number(env.WISIVOZ_SIGNED_PER_IP_10MIN || 30);
  const hits = (signedHits.get(ip) || []).filter((t) => now - t < 600_000);
  if (hits.length >= max) { signedHits.set(ip, hits); return false; }
  hits.push(now); signedHits.set(ip, hits);
  return true;
}
function agentFor(env: Env, voice: string): string {
  if (voice === "male" && env.ELEVENLABS_AGENT_ID_MALE) return env.ELEVENLABS_AGENT_ID_MALE;
  if (voice === "female" && env.ELEVENLABS_AGENT_ID_FEMALE) return env.ELEVENLABS_AGENT_ID_FEMALE;
  return env.ELEVENLABS_AGENT_ID || "";
}
async function signedUrl(env: Env, agentId: string): Promise<string | null> {
  if (!env.ELEVENLABS_API_KEY || !agentId) return null;
  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`, {
      headers: { "xi-api-key": env.ELEVENLABS_API_KEY },
    });
    if (!r.ok) return null;
    return ((await r.json()) as { signed_url?: string }).signed_url ?? null;
  } catch {
    return null;
  }
}
async function createSession(req: Request, env: Env, url: URL) {
  const principal = url.searchParams.get("principal") || "demo-user";
  const voice = url.searchParams.get("voice") || "female";
  let signed = url.searchParams.get("signed") !== "false";
  let agentId = agentFor(env, voice);
  if (signed && !allowSigned(env, req.headers.get("cf-connecting-ip") || "unknown")) {
    signed = false;
    agentId = "";
  }
  const su = signed ? await signedUrl(env, agentId) : null;
  return json({
    session_token: await issueSessionToken(env, principal),
    principal,
    voice,
    elevenlabs_agent_id: agentId || "<set ELEVENLABS_AGENT_ID>",
    signed_url: su,
    voice_enabled: signed ? !!su : !!(env.ELEVENLABS_API_KEY && agentId),
  });
}

// ---- router ----------------------------------------------------------------------

type Body = Record<string, any>;
async function readBody(req: Request): Promise<Body> {
  try { return ((await req.json()) as Body) ?? {}; } catch { return {}; }
}
const int = (v: unknown) => Math.trunc(Number(v ?? 0)) || 0;

async function dispatchTool(env: Env, p: string, name: string, b: Body): Promise<ToolResponse | null> {
  switch (name) {
    case "get_balance": return tools.get_balance(env, p);
    case "list_services": return tools.list_services(b.category, b.query);
    case "explain_service": return tools.explain_service(b.service_ref ?? "");
    case "list_foundations": return tools.list_foundations();
    case "prepare_payment": return tools.prepare_payment(env, p, b.service_ref ?? "", b.account_number ?? "", b.amount_minor == null ? null : int(b.amount_minor));
    case "prepare_parking": return tools.prepare_parking(env, p, b.ticket_ref ?? "");
    case "prepare_donation": return tools.prepare_donation(env, p, b.foundation_ref ?? "", int(b.amount_minor));
    case "prepare_transfer": return tools.prepare_transfer(env, p, b.recipient_ref ?? "", int(b.amount_minor), b.kind ?? "p2p");
    case "get_operation_status": return tools.get_operation_status(env, p, b.operation_ref ?? "");
    case "create_support_case": return tools.create_support_case(b.category ?? "");
    case "open_app_screen": return tools.open_app_screen(b.screen_key ?? "", b.params);
    case "get_credit_status": return tools.get_credit_status(env, p);
    case "scan_credit_offers": return tools.scan_credit_offers(env, p);
    case "quote_credit": return tools.quote_credit(env, p, b.offer_id ?? "", b.installments);
    case "prepare_credit": return tools.prepare_credit(env, p, b.offer_id ?? "", b.installments);
    case "precalify_credit": return tools.precalify_credit(env, p, b.offer_id ?? "");
    default: return null; // confirm_and_execute NO se expone: se confirma vía /api/confirm
  }
}

async function api(req: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname;
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (path === "/health") return json({ status: "ok", mode: "mock", runtime: "cloudflare-workers" });
  if (req.method !== "POST") return fail(405, "method_not_allowed");
  if (path === "/api/session") return createSession(req, env, url);

  const p = await principalOf(req, env);
  if (p instanceof Response) return p;
  const b = await readBody(req);

  if (path.startsWith("/api/tool/")) {
    const r = await dispatchTool(env, p, decodeURIComponent(path.slice(10)), b);
    return r ? json(r) : fail(404, "unknown_tool");
  }
  switch (path) {
    case "/api/balance": return json(await tools.get_balance(env, p));
    case "/api/services": return json(tools.list_services(b.category, b.query));
    case "/api/payment/prepare": return json(await tools.prepare_payment(env, p, b.service_ref ?? "", b.account_number ?? "", b.amount_minor == null ? null : int(b.amount_minor)));
    case "/api/parking/prepare": return json(await tools.prepare_parking(env, p, b.ticket_ref ?? ""));
    case "/api/donation/prepare": return json(await tools.prepare_donation(env, p, b.foundation_ref ?? "", int(b.amount_minor)));
    case "/api/transfer/prepare": return json(await tools.prepare_transfer(env, p, b.recipient_ref ?? "", int(b.amount_minor), b.kind ?? "p2p"));
    case "/api/credit/status": return json(await tools.get_credit_status(env, p));
    case "/api/credit/scan": return json(await tools.scan_credit_offers(env, p));
    case "/api/credit/quote": return json(await tools.quote_credit(env, p, b.offer_id ?? "", b.installments));
    case "/api/credit/prepare": return json(await tools.prepare_credit(env, p, b.offer_id ?? "", b.installments));
    case "/api/credit/precalify": return json(await tools.precalify_credit(env, p, b.offer_id ?? ""));
    case "/api/brain": return json(await tools.brain(env, p, b.text, b.screen));
    case "/api/confirm": return json(await tools.confirm_and_execute(env, p, b.intent_id ?? "", b.approval_proof ?? ""));
    case "/api/operation/status": return json(await tools.get_operation_status(env, p, b.operation_ref ?? ""));
    case "/api/approval-proof": {
      // DEMO: simula la prueba que en producción emite el flujo biométrico/PIN.
      const intentId = url.searchParams.get("intent_id") || "";
      const factor = url.searchParams.get("factor") || "biometric";
      return json({ approval_proof: await approvalProof(env, p, intentId, factor) });
    }
  }
  return fail(404, "not_found");
}

function page(env: Env, req: Request, file: string): Promise<Response> {
  return env.ASSETS.fetch(new Request(new URL(file, req.url), req)).then((r) => {
    const out = new Response(r.body, r);
    out.headers.set("Cache-Control", "no-cache");
    return out;
  });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    // HTTPS obligatorio (el micrófono del móvil no funciona sin él) y sin www.
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if ((url.protocol === "http:" && !local) || url.hostname.startsWith("www.")) {
      url.protocol = local ? url.protocol : "https:";
      url.hostname = url.hostname.replace(/^www\./, "");
      return Response.redirect(url.toString(), 301);
    }
    if (url.pathname === "/" || url.pathname === "/app") return page(env, req, "/app.html");
    if (url.pathname === "/demo") return page(env, req, "/demo.html");
    if (url.pathname.startsWith("/api/") || url.pathname === "/health") return api(req, env, url);
    return env.ASSETS.fetch(req);
  },
} satisfies ExportedHandler<Env>;
