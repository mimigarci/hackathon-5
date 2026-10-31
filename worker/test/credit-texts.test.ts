import test from "node:test";
import assert from "node:assert/strict";
import { answerCredit } from "../src/credit-texts.ts";
import { demoState, scanOffers } from "../src/credit.ts";
import type { Plan } from "../src/credit.ts";

const state = demoState();
const offers = scanOffers(state, new Date()).offers;
const ask = (q: string, s = state, o = offers, plans: Plan[] = []) => answerCredit(q, s, o, plans);

test("corrige la premisa: el carro no está rechazado, está precalificado", () => {
  const r = ask("por qué me rechazaron el crédito del carro")!;
  assert.equal(r.intent, "oferta");
  assert.match(r.reply, /^No está rechazado\. Toyota Corolla 2019 está precalificado/);
  assert.match(r.reply, /banco aliado decide/);
});

test("una oferta bloqueada da el motivo real del motor", () => {
  const overdue = { ...demoState(), overdue: 1 };
  const r = ask("por qué me rechazaron Los Roques", overdue, scanOffers(overdue, new Date()).offers)!;
  assert.match(r.reply, /por desbloquear.*cuota vencida/);
});

test("rechazos sin nombrar oferta: resume lo que hay", () => {
  assert.match(ask("por qué me rechazaron el crédito")!.reply, /no tienes ningún crédito rechazado/);
});

test("cada pregunta frecuente va a su respuesta", () => {
  const cases: [string, string][] = [
    ["qué es Credirecto", "que_es"], ["¿quién presta el crédito?", "quien_presta"], ["quién aprueba mi crédito", "quien_decide"],
    ["los créditos tienen intereses?", "intereses"], ["de cuánto es la inicial", "inicial"], ["cuántas cuotas tiene el crédito", "cuotas"],
    ["qué requisitos pide el crédito", "requisitos"], ["qué pasa si no pago una cuota", "atraso"], ["cómo pago mi cuota", "pago_cuota"],
    ["cómo subo de nivel para más línea de crédito", "subir_nivel"], ["cuánto me prestan de crédito", "cuanto_tengo"],
    ["me piden el PIN del crédito", "seguridad"], ["este crédito es real?", "es_real"],
  ];
  for (const [q, intent] of cases) assert.equal(ask(q)?.intent, intent, q);
});

test("los montos salen del motor, no de texto fijo", () => {
  const used = { ...demoState(), used: { cotidiano: 500_00, turismo: 0 } };
  assert.match(ask("cuánto me prestan de crédito", used)!.reply, /Bs 1\.500,00 disponibles de Bs 2\.000,00/);
});

test("la próxima cuota usa el plan real", () => {
  const plan: Plan = { plan_id: "p", offer_id: "x", title: "CANTV", partner: "Pago Directo", piso: 1, financed_minor: 100_00, created_at: "", installments: [{ n: 1, due_date: "2026-11-07", amount_minor: 100_00, paid: false }] };
  assert.match(ask("cuándo me toca pagar la cuota", state, offers, [plan])!.reply, /Bs 100,00, de CANTV, el 7 de noviembre/);
});

test("no intercepta órdenes ni otros temas", () => {
  for (const q of ["quiero usar Credirecto", "mi credirecto", "escanea mis créditos", "cuál es mi saldo", "paga el condominio", "pídeme 500 de crédito", "qué es esto", "cuéntame un chiste"])
    assert.equal(ask(q), null, q);
});
