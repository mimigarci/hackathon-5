import test from "node:test";
import assert from "node:assert/strict";
import { bs, usd, demoState, scanOffers, quote, planFor, checkOffer, lines, splitAmount, addDays, nextInstallment, precalifyInfo } from "../src/credit.ts";

const NOW = new Date("2026-10-31T12:00:00Z");
const find = (id: string, st = demoState()) => scanOffers(st, NOW).offers.find((o) => o.offer_id === id)!;

test("formato de montos", () => {
  assert.equal(bs(123456), "Bs 1.234,56");
  assert.equal(usd(1450000), "US$ 14.500,00");
  assert.equal(bs(0), "Bs 0,00");
});

test("escaneo del perfil demo", () => {
  const { offers, summary } = scanOffers(demoState(), NOW);
  assert.equal(offers.length, 11);
  assert.equal(find("svc_condominio").status, "disponible");
  assert.equal(find("svc_condominio").reason, "Aprobado: Bs 1.200,00 cabe en tu línea disponible de Bs 1.500,00");
  assert.equal(find("mercantil_rcv").status, "disponible"); // 1.400 <= 1.500
  assert.equal(find("saga_roques").down_payment_minor, 192000);
  assert.equal(find("saga_roques").financed_minor, 288000);
  assert.equal(find("conduce_corolla").status, "precalificado");
  assert.equal(find("conduce_corolla").down_payment_pct, 30);
  assert.equal(find("propiedash_apto").down_payment_pct, 20);
  assert.equal(summary.disponible + summary.precalificado + summary.por_desbloquear, 11);
});

test("cuota vencida rechaza todos los pisos", () => {
  const st = { ...demoState(), overdue: 1 };
  for (const o of scanOffers(st, NOW).offers) {
    assert.equal(o.status, "por_desbloquear");
    assert.match(o.reason, /cuota vencida/);
  }
});

test("turismo pide 6 pagos a tiempo; patrimonio, 3 meses", () => {
  assert.equal(find("saga_merida", { ...demoState(), ontime_payments: 5 }).status, "por_desbloquear");
  assert.equal(find("conduce_corolla", { ...demoState(), months_active: 2 }).status, "por_desbloquear");
});

test("lo usado reduce la línea y nunca queda negativo", () => {
  const st = demoState({ cotidiano: 200000, turismo: 0 });
  assert.equal(lines(st).cotidiano.available_minor, 0);
  assert.equal(find("svc_cantv", st).status, "por_desbloquear");
  assert.match(find("svc_cantv", st).reason, /supera tu línea disponible de Bs 0,00/);
});

test("cuotas: partes iguales y el resto a la última", () => {
  assert.deepEqual(splitAmount(100, 3), [33, 33, 34]);
  const q = quote("svc_condominio", 2, demoState(), NOW);
  assert.ok(q.ok);
  if (q.ok) {
    assert.deepEqual(q.data.installments.map((i) => i.due_date), ["2026-11-07", "2026-11-14"]);
    assert.equal(q.data.installments.reduce((a, i) => a + i.amount_minor, 0), 120000);
    assert.equal(q.data.interest_minor, 0);
    assert.equal(q.data.eligible, true);
  }
  const t = quote("saga_roques", 3, demoState(), NOW);
  assert.ok(t.ok && t.data.installments.map((i) => i.due_date).join() === "2026-11-15,2026-11-30,2026-12-15");
  assert.equal(addDays(NOW, 15), "2026-11-15");
});

test("cotización valida oferta y cuotas", () => {
  const a = quote("nope", 1, demoState(), NOW);
  assert.ok(!a.ok && a.code === "offer_not_found");
  for (const bad of [3, 0, 1.5, "2", null]) {
    const b = quote("svc_condominio", bad, demoState(), NOW);
    assert.ok(!b.ok && b.code === "invalid_installments");
  }
  const c = quote("saga_roques", 1, demoState(), NOW);
  assert.ok(!c.ok && c.code === "invalid_installments");
});

test("checkOffer distingue exceso de línea y rechazo", () => {
  assert.equal(checkOffer("svc_condominio", demoState({ cotidiano: 100000, turismo: 0 }))?.code, "credit_over_limit");
  assert.equal(checkOffer("svc_condominio", { ...demoState(), overdue: 2 })?.code, "credit_rejected");
  assert.equal(checkOffer("svc_condominio", demoState())?.eligible, true);
});

test("planFor arma el plan solo en pisos 1 y 2", () => {
  const p = planFor("saga_merida", 4, demoState(), NOW, "plan_x");
  assert.ok(p);
  assert.equal(p!.financed_minor, 156000);
  assert.equal(p!.installments.length, 4);
  assert.ok(p!.installments.every((i) => !i.paid));
  assert.equal(planFor("conduce_corolla", 36, demoState(), NOW, "plan_y"), null);
  assert.equal(nextInstallment([p!])?.due_date, "2026-11-15");
  assert.equal(nextInstallment([]), null);
});

test("precalificación: solo piso 3", () => {
  const r = precalifyInfo("conduce_corolla", demoState());
  assert.ok(r.ok && r.eligible && r.bank_options.length === 2);
  assert.ok(!precalifyInfo("svc_cantv", demoState()).ok);
});
