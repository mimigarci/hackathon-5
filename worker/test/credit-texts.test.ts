import test from "node:test";
import assert from "node:assert/strict";
import { answerCredit } from "../src/credit-texts.ts";
import { demoState, scanOrderOffers } from "../src/credit.ts";

const state = demoState();
const offers = scanOrderOffers(state, new Date()).offers;
const ask = (q: string, s = state, o = offers) => answerCredit(q, s, o);

test("una opción por aliado", () => {
  assert.deepEqual(offers.map((o) => o.partner), ["SAGA", "Conduce", "Propiedash"]);
  assert.ok(offers.every((o) => o.currency === "USD"));
  assert.equal(offers[0].price_minor, 48000);
});

test("lo que no tiene crédito se aclara", () => {
  assert.equal(ask("por qué me rechazaron el crédito de Mérida")?.intent, "fuera_de_catalogo");
  assert.match(ask("hay crédito para el condominio?")!.reply, /tres opciones/);
});

test("corrige la premisa de un rechazo que no existe", () => {
  assert.match(ask("por qué me rechazaron Los Roques")!.reply, /^No está rechazado\. Los Roques/);
  assert.match(ask("por qué me rechazaron el crédito del carro")!.reply, /^No está rechazado\. Toyota Corolla 2019 está precalificado/);
  assert.match(ask("por qué me rechazaron el crédito")!.reply, /no tienes ningún crédito rechazado/);
});

test("una oferta bloqueada da el motivo real del motor", () => {
  const overdue = { ...demoState(), overdue: 1 };
  assert.match(ask("por qué me rechazaron Los Roques", overdue, scanOrderOffers(overdue, new Date()).offers)!.reply, /por desbloquear.*cuota vencida/);
});

test("cada pregunta frecuente va a su respuesta", () => {
  const cases: [string, string][] = [
    ["qué es Credirecto", "que_es"], ["quién presta el crédito", "quien_presta"], ["quién aprueba mi crédito", "quien_decide"],
    ["los créditos tienen intereses?", "intereses"], ["de cuánto es la inicial", "inicial"], ["cuántas cuotas tiene el crédito", "cuotas"],
    ["qué requisitos pide el crédito", "requisitos"], ["cómo armo una orden", "orden"], ["dónde veo mis órdenes", "orden"], ["cómo pago mi cuota", "pago_cuota"],
    ["cuánto me prestan de crédito", "cuanto_tengo"], ["me piden el PIN", "seguridad"], ["este crédito es real?", "es_real"],
  ];
  for (const [q, intent] of cases) assert.equal(ask(q)?.intent, intent, q);
});

test("no intercepta órdenes de voz ni otros temas", () => {
  for (const q of ["quiero usar Credirecto", "mi credirecto", "cuál es mi saldo", "cuéntame un chiste", "qué es esto"])
    assert.equal(ask(q), null, q);
});
