import test from "node:test";
import assert from "node:assert/strict";
import { answerCredit } from "../src/credit-texts.ts";
import { demoState, scanSaga } from "../src/credit.ts";

const state = demoState();
const offers = scanSaga(state, new Date()).offers;
const ask = (q: string, s = state, o = offers) => answerCredit(q, s, o);

test("solo se ofrece SAGA", () => {
  assert.deepEqual(offers.map((o) => o.offer_id).sort(), ["saga_margarita", "saga_merida", "saga_roques"]);
  assert.ok(offers.every((o) => o.partner === "SAGA"));
});

test("lo que ya no tiene crédito se aclara", () => {
  assert.equal(ask("por qué me rechazaron el crédito del carro")?.intent, "solo_saga");
  assert.match(ask("hay crédito para el condominio?")!.reply, /solo para los planes de SAGA/);
});

test("corrige la premisa de un rechazo que no existe", () => {
  assert.match(ask("por qué me rechazaron Los Roques")!.reply, /^No está rechazado\. Los Roques/);
  assert.match(ask("por qué me rechazaron el crédito")!.reply, /no tienes ningún crédito rechazado/);
});

test("una oferta bloqueada da el motivo real del motor", () => {
  const overdue = { ...demoState(), overdue: 1 };
  assert.match(ask("por qué me rechazaron Mérida", overdue, scanSaga(overdue, new Date()).offers)!.reply, /por desbloquear.*cuota vencida/);
});

test("cada pregunta frecuente va a su respuesta", () => {
  const cases: [string, string][] = [
    ["qué es Credirecto", "que_es"], ["qué es SAGA en el crédito", "saga"], ["quién aprueba mi crédito", "quien_decide"],
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
