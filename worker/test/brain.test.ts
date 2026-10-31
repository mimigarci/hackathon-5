import test from "node:test";
import assert from "node:assert/strict";
import { sanitize, validateModelOutput, routeN0, think, parseModels, DEFAULT_FAST, parseAmountMinor, contradicts, classifyN1 } from "../src/brain.ts";
import type { Hooks } from "../src/brain.ts";
import { demoState, scanOffers } from "../src/credit.ts";

const hooks = (over: Partial<Hooks> = {}): Hooks => ({
  take: async () => true, cacheGet: async () => null, cachePut: async () => {},
  offers: async () => scanOffers(demoState(), new Date()).offers, ...over,
});
const fakeFetch = (content: string, extra: object = {}) =>
  (async () => new Response(JSON.stringify({ model: "m/x", choices: [{ message: { content } }], usage: { cost: 0.0001 }, ...extra }))) as unknown as typeof fetch;

test("sanitize reemplaza 6+ dígitos y recorta", () => {
  assert.equal(sanitize("paga 04121234567 y 12345"), "paga [número] y 12345");
  assert.equal(sanitize("a".repeat(500)).length, 400);
});

test("lista blanca de acciones y parámetros", () => {
  assert.equal(validateModelOutput({ action: "borrar_todo", params: {} }), null);
  assert.equal(validateModelOutput("hola"), null);
  const v = validateModelOutput({ action: "donar", params: { foundation_ref: "fundana", amount_minor: 5000, evil: "x" } });
  assert.deepEqual(v?.params, { foundation_ref: "fundana", amount_minor: 5000 });
  assert.equal(validateModelOutput({ action: "donar", params: { foundation_ref: "no_existe" } }), null);
  assert.deepEqual(validateModelOutput({ action: "saldo", params: { amount_minor: 5 } })?.params, {});
  assert.equal(validateModelOutput({ action: "abrir_pantalla", params: { screen_key: "admin" } }), null);
  assert.deepEqual(validateModelOutput({ action: "abrir_pantalla", params: { screen_key: "credirecto" } })?.params, { screen_key: "credirecto" });
  assert.equal(validateModelOutput({ action: "enviar", params: { recipient_ref: "@ana", amount_minor: -3 } }), null);
});

test("N0 entiende comandos claros", () => {
  assert.equal(routeN0("¿Cuál es mi saldo?")?.action, "saldo");
  assert.equal(routeN0("muéstrame mis movimientos")?.action, "movimientos");
  assert.equal(routeN0("escanea mis créditos")?.action, "creditos_escanear");
  assert.equal(routeN0("mis créditos")?.action, "credito_ver");
  assert.equal(routeN0("quiero pagar el ticket de estacionamiento")?.action, "estacionamiento");
  assert.deepEqual(routeN0("paga digitel 04121234567 por Bs 450,50")?.params, { service_ref: "digitel", account_number: "04121234567", amount_minor: 45050 });
  assert.deepEqual(routeN0("envía 25 bs a @maria")?.params, { recipient_ref: "@maria", amount_minor: 2500 });
  assert.deepEqual(routeN0("abre credirecto")?.params, { screen_key: "credirecto" });
  assert.equal(routeN0("por qué me rechazaron el crédito")?.action, "credito_explicar");
  assert.equal(routeN0("cuéntame un chiste"), null);
  assert.equal(parseAmountMinor("1.234,56"), 123456);
});

test("sin clave: solo N0 y conversar si no entiende", async () => {
  let called = false;
  const f = (async () => { called = true; return new Response("{}"); }) as unknown as typeof fetch;
  const a = await think({}, "dime algo gracioso", undefined, hooks(), f);
  assert.equal(a.action, "conversar");
  assert.equal(a.tier, "N0");
  const b = await think({}, "saldo", undefined, hooks(), f);
  assert.equal(b.action, "saldo");
  assert.equal(called, false);
});

test("N1: valida la salida y rellena números desde el texto original", async () => {
  const f = fakeFetch(JSON.stringify({ action: "pagar_servicio", params: { service_ref: "cantv", account_number: "999" } }));
  const r = await think({ OPENROUTER_API_KEY: "test" }, "me toca el internet cuenta 02125551234", undefined, hooks(), f);
  assert.equal(r.tier, "N1");
  assert.equal(r.action, "pagar_servicio");
  assert.equal(r.params.service_ref, "cantv");
  assert.equal(r.params.account_number, "02125551234");
  assert.equal(r.model, "m/x");
  assert.equal(r.cost_usd, 0.0001);
});

test("N1: el texto enviado al modelo no lleva números largos y el body es el pedido", async () => {
  let sent: any;
  const f = (async (_u: string, init: RequestInit) => { sent = { init, body: JSON.parse(String(init.body)) }; return new Response(JSON.stringify({ choices: [{ message: { content: '{"action":"conversar","params":{},"reply":"Hola"}' } }] })); }) as unknown as typeof fetch;
  const r = await classifyN1({ OPENROUTER_API_KEY: "k" }, "mi cuenta es 01340000123456", "home", f);
  assert.ok(r);
  assert.ok(!JSON.stringify(sent.body).includes("01340000123456"));
  assert.match(JSON.stringify(sent.body), /\[número\]/);
  assert.equal(sent.body.max_tokens, 120);
  assert.equal(sent.body.temperature, 0);
  assert.deepEqual(sent.body.provider, { sort: "price" });
  assert.deepEqual(sent.body.response_format, { type: "json_object" });
  assert.deepEqual(sent.body.models, parseModels(undefined, DEFAULT_FAST));
  assert.equal(sent.init.headers.Authorization, "Bearer k");
});

test("N1: respuesta inválida o error de red -> conversar", async () => {
  const bad = await think({ OPENROUTER_API_KEY: "k" }, "algo raro", undefined, hooks(), fakeFetch('{"action":"hackear"}'));
  assert.equal(bad.action, "conversar");
  const boom = (async () => { throw new Error("red"); }) as unknown as typeof fetch;
  assert.equal((await think({ OPENROUTER_API_KEY: "k" }, "algo raro", undefined, hooks(), boom)).action, "conversar");
});

test("tope diario: sin cupo no llama al modelo", async () => {
  let called = false;
  const f = (async () => { called = true; return new Response("{}"); }) as unknown as typeof fetch;
  const r = await think({ OPENROUTER_API_KEY: "k" }, "algo raro", undefined, hooks({ take: async () => false }), f);
  assert.equal(r.action, "conversar");
  assert.equal(called, false);
});

test("N2: explica, usa caché y respeta la decisión del motor", async () => {
  const store = new Map<string, string>();
  const h = hooks({ cacheGet: async (k) => store.get(k) ?? null, cachePut: async (k, v) => { store.set(k, v); } });
  let calls = 0;
  const f = (async () => { calls++; return new Response(JSON.stringify({ model: "anthropic/x", choices: [{ message: { content: "Te lo aprobaron porque cabe en tu línea." } }], usage: { cost: 0.002 } })); }) as unknown as typeof fetch;
  const env = { OPENROUTER_API_KEY: "k" };
  const a = await think(env, "explícame mi crédito de condominio", undefined, h, f);
  assert.equal(a.tier, "N2");
  assert.equal(a.cost_usd, 0.002);
  const b = await think(env, "explícame mi crédito de condominio", undefined, h, f);
  assert.equal(b.reply, a.reply);
  assert.equal(calls, 1);
  assert.equal(contradicts("Está rechazado", [{ status: "disponible" }]), true);
  assert.equal(contradicts("Está aprobado", [{ status: "por_desbloquear" }]), true);
});
