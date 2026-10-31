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
import {
  CATALOG, CATALOG_KIND, CREDIT_INSTALLMENTS, CREDIT_LIMIT_MINOR, FOUNDATIONS, INITIAL_WALLET_BALANCE_MINOR,
  MAX_QUANTITY, MAX_TOPUP_MINOR, SERVICES, TOPUP_METHODS,
} from "./fixtures";

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

type Details = Record<string, string | number>;
interface Intent {
  intent_id: string; kind: string; amount_minor: number; fee_minor: number;
  details: Details; created_at: number; ttl_seconds: number; state: string;
}
interface Operation {
  operation_ref: string; intent_id: string; kind: string; amount_minor: number;
  fee_minor: number; state: string; created_at: number; details?: Details;
}
type ExecResult = "executed" | "replayed" | "expired" | "insufficient_funds" | "credit_limit" | "not_found";
/** Operaciones que suman al saldo (recarga simulada y desembolso de crédito). */
const CREDIT_KINDS = new Set(["topup", "credit"]);

export class Wallet extends DurableObject<Env> {
  private async balanceMinor(): Promise<number> {
    return (await this.ctx.storage.get<number>("balance")) ?? INITIAL_WALLET_BALANCE_MINOR;
  }

  async balance(): Promise<number> {
    return this.balanceMinor();
  }

  async creditUsed(): Promise<number> {
    return (await this.ctx.storage.get<number>("credit_used")) ?? 0;
  }

  /** Operaciones del monedero, la más reciente primero. */
  async operations(limit = 20): Promise<Operation[]> {
    const ops = [...(await this.ctx.storage.list<Operation>({ prefix: "op:" })).values()];
    return ops.sort((a, b) => b.created_at - a.created_at).slice(0, limit);
  }

  async createIntent(kind: string, amount_minor: number, details: Details, ttl_seconds: number): Promise<Intent> {
    const intent: Intent = {
      intent_id: uid("int"), kind, amount_minor, fee_minor: 0, details,
      created_at: Date.now() / 1000, ttl_seconds, state: "quoted",
    };
    await this.ctx.storage.put(`intent:${intent.intent_id}`, intent);
    return intent;
  }

  /** Ejecuta una intención de forma idempotente (misma prueba -> misma operación). */
  async execute(intent_id: string, proof: string): Promise<{ result: ExecResult; op?: Operation; balance: number }> {
    // Las llamadas a un Durable Object se serializan: no hace falta lock.
    const s = this.ctx.storage;
    const replay = await s.get<string>(`idem:${proof}`);
    if (replay) return { result: "replayed", op: await s.get<Operation>(`op:${replay}`), balance: await this.balanceMinor() };

    const intent = await s.get<Intent>(`intent:${intent_id}`);
    if (!intent) return { result: "not_found", balance: await this.balanceMinor() };
    if (Date.now() / 1000 > intent.created_at + intent.ttl_seconds) {
      intent.state = "expired";
      await s.put(`intent:${intent_id}`, intent);
      return { result: "expired", balance: await this.balanceMinor() };
    }
    const total = intent.amount_minor + intent.fee_minor;
    const bal = await this.balanceMinor();
    let used = await this.creditUsed();
    if (intent.kind === "credit") {
      if (used + total > CREDIT_LIMIT_MINOR) return { result: "credit_limit", balance: bal };
      used += total;
    } else if (bal < total) return { result: "insufficient_funds", balance: bal };
    if (intent.kind === "credit_payment") used = Math.max(0, used - total);
    const next = CREDIT_KINDS.has(intent.kind) ? bal + total : bal - total;

    const op: Operation = {
      operation_ref: uid("op"), intent_id, kind: intent.kind, amount_minor: intent.amount_minor,
      fee_minor: intent.fee_minor, state: "settled", created_at: Date.now() / 1000, details: intent.details,
    };
    intent.state = "submitted";
    await s.put({
      balance: next,
      credit_used: used,
      [`intent:${intent_id}`]: intent,
      [`op:${op.operation_ref}`]: op,
      [`idem:${proof}`]: op.operation_ref,
    });
    return { result: "executed", op, balance: next };
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

const badAmount = (amount: number | null | undefined) =>
  amount != null && amount <= 0
    ? resp("denied", "El monto tiene que ser mayor que cero. ¿Cuánto quieres usar?", {}, { code: "invalid_amount", message: "El monto debe ser mayor que cero." })
    : null;

const DONE: Record<string, string> = {
  payment: "Listo, pago confirmado",
  parking: "Listo, ticket pagado: ya puedes salir",
  donation: "Listo, donación enviada. ¡Gracias por ayudar",
  transfer: "Listo, envío realizado",
  topup: "Listo, recargaste tu wallet",
  credit: "Listo, el crédito ya está en tu wallet",
  credit_payment: "Listo, abonaste a tu Credirecto",
  parking_meter: "Listo, tu parquímetro está activo",
  insurance: "Listo, tu póliza quedó activa",
  tickets: "Listo, tus boletos están en Mis boletos",
};

function describe(kind: string, d: Details = {}): string {
  switch (kind) {
    case "payment": return `Pago ${d.service ?? "de servicio"}`;
    case "parking": return d.ticket_ref ? `Estacionamiento · ${d.ticket_ref}` : "Estacionamiento";
    case "donation": return `Donación a ${d.foundation ?? ""}`.trim();
    case "transfer": return `Envío a ${d.recipient_ref ?? ""}`.trim();
    case "topup": return `Recarga · ${d.method ?? "Wallet"}`;
    case "credit": return "Credirecto · desembolso";
    case "credit_payment": return "Credirecto · abono";
    case "parking_meter": case "insurance": case "tickets": {
      const label = { parking_meter: "Parquímetro", insurance: "Seguro", tickets: "Boletería" }[kind];
      const qty = Number(d.quantity ?? 1);
      return `${label} · ${d.product ?? ""}${kind === "tickets" && qty > 1 ? ` ×${qty}` : ""}`;
    }
  }
  return "Operación";
}
const ceilDiv = (a: number, b: number) => Math.ceil(a / b);

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
    const bad = badAmount(amount_minor); if (bad) return bad;
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
    const bad = badAmount(amount_minor); if (bad) return bad;
    const it = await wallet(env, p).createIntent("donation", amount_minor, { foundation: f.name }, ttl(env));
    return requiresConfirmation(env, it.intent_id, `Vas a donar ${bs(amount_minor)} a ${f.name}. ¿Confirmo la donación?`, { foundation: f.name, amount_minor });
  },
  async prepare_transfer(env: Env, p: string, recipient_ref: string, amount_minor: number, kind: string) {
    const bad = badAmount(amount_minor); if (bad) return bad;
    const it = await wallet(env, p).createIntent("transfer", amount_minor, { recipient_ref, transfer_kind: kind }, ttl(env));
    return requiresConfirmation(env, it.intent_id, `Vas a enviar ${bs(amount_minor)} a ${recipient_ref}. ¿Confirmo el envío?`, { recipient_ref, amount_minor, kind });
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
        return resp("ok", `${DONE[r.op?.kind ?? ""] ?? "Listo, operación confirmada"}. Tu nuevo saldo es ${bs(r.balance)}.`, {
          operation_ref: r.op?.operation_ref, state: r.op?.state, balance_minor: r.balance, replayed: r.result === "replayed",
        });
      case "not_found":
        return resp("error", "No encuentro esa operación; vamos a empezarla de nuevo.", {}, { code: "intent_not_found", message: "Intención inexistente." });
      case "expired":
        return resp("denied", "La confirmación caducó por seguridad. ¿La preparo de nuevo?", {}, { code: "intent_expired", message: "La intención expiró." });
      case "insufficient_funds":
        return resp("denied", "No tienes saldo suficiente para esta operación.", {}, { code: "insufficient_funds", message: "Saldo insuficiente." });
      case "credit_limit":
        return resp("denied", "Ese monto supera tu crédito disponible de Credirecto.", {}, { code: "credit_limit", message: "Supera el crédito disponible." });
    }
  },
  async list_movements(env: Env, p: string, limit = 20) {
    const w = wallet(env, p);
    const [ops, bal] = await Promise.all([w.operations(Math.max(1, Math.min(limit, 50))), w.balance()]);
    const movements = ops.map((op) => ({
      operation_ref: op.operation_ref, kind: op.kind, title: describe(op.kind, op.details),
      amount_minor: (CREDIT_KINDS.has(op.kind) ? 1 : -1) * (op.amount_minor + op.fee_minor),
      state: op.state, created_at: op.created_at, details: op.details ?? {},
    }));
    const last = movements[0];
    const speech = last
      ? `Tienes ${movements.length} movimiento${movements.length !== 1 ? "s" : ""}. El último: ${last.title} por ${bs(Math.abs(last.amount_minor))}.`
      : "Aún no tienes movimientos en esta sesión.";
    return resp("ok", speech, { movements, balance_minor: bal });
  },
  list_catalog(section: string, type?: string | null) {
    let items = CATALOG[section];
    if (!items) return resp("unavailable", "Esa sección no está disponible.", {}, { code: "section_not_found", message: "Sección no disponible." });
    if (type) items = items.filter((i) => i.type === type);
    const names = items.map((i) => `${i.name} (${bs(i.price_minor)} por ${i.unit})`).join(", ");
    return resp("ok", items.length ? `Opciones: ${names}.` : "No hay opciones disponibles.", { section, items });
  },
  async prepare_purchase(env: Env, p: string, product_ref: string, quantity: number, plate?: string | null) {
    const section = Object.keys(CATALOG).find((k) => CATALOG[k].some((i) => i.product_ref === product_ref));
    const item = section ? CATALOG[section].find((i) => i.product_ref === product_ref) : undefined;
    if (!section || !item) return resp("denied", "No encuentro esa opción en el catálogo.", {}, { code: "product_not_found", message: "Producto no disponible." });
    const qty = Math.max(1, Math.min(quantity || 1, MAX_QUANTITY[section]));
    const amount = item.price_minor * qty;
    const details: Details = { product: item.name, product_ref, quantity: qty, section };
    if (plate) details.plate = String(plate).toUpperCase().slice(0, 10);
    const it = await wallet(env, p).createIntent(CATALOG_KIND[section], amount, details, ttl(env));
    const unit = `${qty} ${item.unit}${qty > 1 && !item.unit.endsWith("s") ? "s" : ""}`;
    return requiresConfirmation(env, it.intent_id, `${item.name}, ${unit}: son ${bs(amount)}. ¿Lo confirmo?`, { ...details, amount_minor: amount, unit: item.unit });
  },
  async prepare_topup(env: Env, p: string, method: string, amount_minor: number) {
    const label = TOPUP_METHODS[method];
    if (!label) return resp("denied", "Ese método de recarga no está disponible.", {}, { code: "method_not_found", message: "Método no disponible." });
    const bad = badAmount(amount_minor); if (bad) return bad;
    if (amount_minor > MAX_TOPUP_MINOR) return resp("denied", `El máximo por recarga es ${bs(MAX_TOPUP_MINOR)}.`, {}, { code: "amount_too_high", message: "Supera el máximo por recarga." });
    const it = await wallet(env, p).createIntent("topup", amount_minor, { method: label, method_ref: method }, ttl(env));
    return requiresConfirmation(env, it.intent_id, `Vas a recargar ${bs(amount_minor)} con ${label}. ¿Confirmo la recarga?`, { method: label, amount_minor });
  },
  async get_credit(env: Env, p: string) {
    const used = await wallet(env, p).creditUsed();
    const inst = used ? ceilDiv(used, CREDIT_INSTALLMENTS) : 0;
    let speech = `Tu Credirecto tiene ${bs(CREDIT_LIMIT_MINOR - used)} disponibles de ${bs(CREDIT_LIMIT_MINOR)}.`;
    if (used) speech += ` Debes ${bs(used)}, en ${CREDIT_INSTALLMENTS} cuotas de ${bs(inst)}.`;
    return resp("ok", speech, { limit_minor: CREDIT_LIMIT_MINOR, used_minor: used, available_minor: CREDIT_LIMIT_MINOR - used, installments: CREDIT_INSTALLMENTS, installment_minor: inst });
  },
  async prepare_credit(env: Env, p: string, amount_minor: number) {
    const bad = badAmount(amount_minor); if (bad) return bad;
    const available = CREDIT_LIMIT_MINOR - (await wallet(env, p).creditUsed());
    if (amount_minor > available) return resp("denied", `Tu crédito disponible es ${bs(available)}.`, {}, { code: "credit_limit", message: "Supera el crédito disponible." });
    const inst = ceilDiv(amount_minor, CREDIT_INSTALLMENTS);
    const it = await wallet(env, p).createIntent("credit", amount_minor, { installments: CREDIT_INSTALLMENTS }, ttl(env));
    return requiresConfirmation(env, it.intent_id, `Te deposito ${bs(amount_minor)} de Credirecto, en ${CREDIT_INSTALLMENTS} cuotas de ${bs(inst)}. ¿Lo confirmo?`, { amount_minor, installments: CREDIT_INSTALLMENTS, installment_minor: inst });
  },
  async prepare_credit_payment(env: Env, p: string, amount_minor: number) {
    const bad = badAmount(amount_minor); if (bad) return bad;
    const used = await wallet(env, p).creditUsed();
    if (!used) return resp("denied", "No tienes deuda con Credirecto.", {}, { code: "no_debt", message: "Sin deuda." });
    const amount = Math.min(amount_minor, used);
    const it = await wallet(env, p).createIntent("credit_payment", amount, {}, ttl(env));
    return requiresConfirmation(env, it.intent_id, `Vas a abonar ${bs(amount)} a tu Credirecto. ¿Confirmo?`, { amount_minor: amount });
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
    const allowed = ["home", "wallet", "pagar_servicios", "parking", "donaciones", "enviar_fondos", "movimientos", "recargas", "club", "mis_pagos",
      "escaner_qr", "menu", "credirecto", "depositar", "parquimetros", "seguros", "boleteria", "notificaciones", "racha", "asistencia", "mis_vehiculos", "mis_cuentas"];
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
async function conversationToken(env: Env, agentId: string): Promise<string | null> {
  if (!env.ELEVENLABS_API_KEY || !agentId) return null;
  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${encodeURIComponent(agentId)}`, {
      headers: { "xi-api-key": env.ELEVENLABS_API_KEY },
    });
    if (!r.ok) return null;
    return ((await r.json()) as { token?: string }).token ?? null;
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
  const webrtc = url.searchParams.get("webrtc") === "true";
  // WebRTC (mejor audio y cancelación de eco) usa un token de conversación.
  const [su, token] = await Promise.all([
    signed ? signedUrl(env, agentId) : null,
    signed && webrtc ? conversationToken(env, agentId) : null,
  ]);
  return json({
    session_token: await issueSessionToken(env, principal),
    principal,
    voice,
    elevenlabs_agent_id: agentId || "<set ELEVENLABS_AGENT_ID>",
    signed_url: su,
    conversation_token: token,
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
    case "list_movements": return tools.list_movements(env, p, int(b.limit) || 20);
    case "list_catalog": return tools.list_catalog(b.section ?? "", b.type);
    case "prepare_purchase": return tools.prepare_purchase(env, p, b.product_ref ?? "", int(b.quantity) || 1, b.plate);
    case "prepare_topup": return tools.prepare_topup(env, p, b.method ?? "", int(b.amount_minor));
    case "get_credit": return tools.get_credit(env, p);
    case "prepare_credit": return tools.prepare_credit(env, p, int(b.amount_minor));
    case "prepare_credit_payment": return tools.prepare_credit_payment(env, p, int(b.amount_minor));
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
