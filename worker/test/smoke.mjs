// Prueba de humo por HTTP del flujo de Credirecto y del cerebro. Uso: node test/smoke.mjs [urlBase]
// Requiere un Worker en marcha (npx wrangler dev). Imprime OK o FALLA por paso; sale con 1 si algo falla.
const BASE = (process.argv[2] || "http://localhost:8787").replace(/\/+$/, "");
const principal = `smoke-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
let token = "", failed = 0;

const post = async (path, body = {}) => {
  const r = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  let j = null;
  try { j = await r.json(); } catch { /* sin cuerpo JSON */ }
  return { http: r.status, ...(j ?? {}) };
};
const tool = (name, body) => post(`/api/credit/${name}`, body);

async function step(name, fn) {
  try {
    const msg = await fn();
    if (msg) throw new Error(msg);
    console.log(`OK     ${name}`);
  } catch (e) {
    failed++;
    console.log(`FALLA  ${name}: ${e.message}`);
  }
}
const expect = (cond, msg) => (cond ? null : msg);
const first = (...checks) => checks.find((c) => c) ?? null;

async function confirm(intentId) {
  const { approval_proof } = await post(`/api/approval-proof?intent_id=${encodeURIComponent(intentId)}`);
  return { proof: approval_proof, res: await post("/api/confirm", { intent_id: intentId, approval_proof }) };
}

let balance0 = 0, used0 = 0, balance1 = 0, balance2 = 0, down2 = 0, intentCond = "";

await step("sesión", async () => {
  const r = await fetch(`${BASE}/api/session?principal=${encodeURIComponent(principal)}&signed=false`, { method: "POST" });
  const j = await r.json();
  token = j.session_token;
  return expect(r.ok && token, `HTTP ${r.status} sin session_token`);
});
if (!token) { console.log("Sin sesión no se puede seguir."); process.exit(1); }

await step("saldo inicial", async () => {
  const r = await post("/api/balance");
  balance0 = r.data?.balance_minor;
  return expect(r.status === "ok" && Number.isInteger(balance0), `respuesta inesperada: ${JSON.stringify(r)}`);
});

await step("status inicial (lines, plans, next_installment)", async () => {
  const r = await tool("status");
  const c = r.data?.lines?.cotidiano, t = r.data?.lines?.turismo;
  used0 = c?.used_minor;
  return first(
    expect(r.status === "ok", `status=${r.status}`),
    expect(c && t && Number.isInteger(c.limit_minor) && Number.isInteger(c.used_minor) && Number.isInteger(c.available_minor), "lines.cotidiano mal formada"),
    expect(t.limit_minor > 0, "lines.turismo mal formada"),
    expect(Array.isArray(r.data.plans), "plans no es arreglo"),
    expect(r.data.next_installment === null, "next_installment debería ser null sin planes"),
    expect(r.data.level === "Turista", `level=${r.data.level}`),
  );
});

await step("scan (11 ofertas, summary, speech)", async () => {
  const r = await tool("scan");
  const o = r.data?.offers, s = r.data?.summary;
  const cond = o?.find((x) => x.offer_id === "svc_condominio");
  return first(
    expect(r.status === "ok" && Array.isArray(o) && o.length === 11, `ofertas: ${o?.length}`),
    expect(s && Number.isInteger(s.disponible) && Number.isInteger(s.precalificado) && Number.isInteger(s.por_desbloquear), "summary mal formado"),
    expect(s.disponible + s.precalificado + s.por_desbloquear === 11, "summary no suma 11"),
    expect(cond?.status === "disponible" && cond.next_step === "usar", "svc_condominio debería estar disponible"),
    expect(Array.isArray(cond.installments_options) && cond.installments_options.includes(2), "installments_options mal formado"),
    expect(typeof r.speech === "string" && r.speech.length > 0, "sin speech"),
  );
});

await step("quote svc_condominio en 2 cuotas", async () => {
  const r = await tool("quote", { offer_id: "svc_condominio", installments: 2 });
  const d = r.data, ins = d?.installments;
  return first(
    expect(r.status === "ok" && d.eligible === true, `status=${r.status} eligible=${d?.eligible}`),
    expect(Array.isArray(ins) && ins.length === 2, "installments debería ser arreglo de 2"),
    expect(typeof ins[0].due_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(ins[0].due_date), "due_date debería ser YYYY-MM-DD"),
    expect(ins[0].amount_minor + ins[1].amount_minor === 120000 && d.total_minor === 120000, "las cuotas no suman Bs 1.200,00"),
    expect(d.down_payment_minor === 0 && d.financed_minor === 120000 && d.interest_minor === 0 && d.currency === "VES", "inicial, financiado o interés incorrectos"),
  );
});

await step("quote con cuotas inválidas da denied/invalid_installments", async () => {
  const r = await tool("quote", { offer_id: "svc_condominio", installments: 9 });
  return expect(r.status === "denied" && r.error?.code === "invalid_installments", JSON.stringify(r));
});

await step("prepare svc_condominio en 2 cuotas (inicial 0)", async () => {
  const r = await tool("prepare", { offer_id: "svc_condominio", installments: 2 });
  const s = r.data?.summary;
  intentCond = r.data?.intent_id;
  return first(
    expect(r.status === "requires_confirmation" && intentCond, `status=${r.status}`),
    expect(s && s.amount_minor === 0 && s.financed_minor === 120000 && s.installments === 2 && s.total_minor === 120000 && s.piso === 1, `summary: ${JSON.stringify(s)}`),
    expect(Number.isInteger(r.data.ttl_seconds), "sin ttl_seconds"),
  );
});

await step("confirm svc_condominio: saldo igual, plan creado", async () => {
  const { res } = await confirm(intentCond);
  balance1 = res.data?.balance_minor;
  return first(
    expect(res.status === "ok", `status=${res.status} ${res.error?.code ?? ""}`),
    expect(balance1 === balance0, `el saldo cambió: ${balance0} -> ${balance1}`),
    expect(res.data.replayed === false && res.data.operation_ref && res.data.plan_id, "faltan operation_ref o plan_id"),
    expect(/Credirecto aprobado/.test(res.speech || ""), `speech: ${res.speech}`),
  );
});

await step("status: lo usado subió y el saldo bajó solo por la inicial", async () => {
  const r = await tool("status");
  const c = r.data?.lines?.cotidiano;
  const bal = (await post("/api/balance")).data?.balance_minor;
  const plan = r.data?.plans?.[0];
  return first(
    expect(c?.used_minor === used0 + 120000, `used ${used0} -> ${c?.used_minor}`),
    expect(c.available_minor === c.limit_minor - c.used_minor, "available mal calculado"),
    expect(bal === balance0 - 0, `el saldo debería seguir en ${balance0} y es ${bal}`),
    expect(r.data.plans.length === 1 && plan.installments.length === 2 && plan.installments.every((i) => i.paid === false), "plan mal formado"),
    expect(r.data.next_installment?.amount_minor === 60000 && typeof r.data.next_installment.due_date === "string", `next_installment: ${JSON.stringify(r.data.next_installment)}`),
  );
});

await step("prepare saga_roques (inicial del 40 %)", async () => {
  const r = await tool("prepare", { offer_id: "saga_roques", installments: 3 });
  const s = r.data?.summary;
  down2 = s?.amount_minor;
  const c = await confirmIf(r);
  balance2 = c?.res.data?.balance_minor;
  return first(
    expect(r.status === "requires_confirmation", `status=${r.status} ${r.error?.code ?? ""}`),
    expect(down2 === 192000 && s.financed_minor === 288000 && s.piso === 2, `summary: ${JSON.stringify(s)}`),
    expect(c.res.status === "ok", `confirm: ${c.res.status} ${c.res.error?.code ?? ""}`),
    expect(balance2 === balance0 - down2, `saldo ${balance0} -> ${balance2}, esperado ${balance0 - down2}`),
  );
});
async function confirmIf(r) { return r.data?.intent_id ? confirm(r.data.intent_id) : { res: {} }; }

await step("precalify conduce_corolla", async () => {
  const r = await tool("precalify", { offer_id: "conduce_corolla" });
  const d = r.data;
  return first(
    expect(r.status === "ok", `status=${r.status} ${r.error?.code ?? ""}`),
    expect(typeof d.request_ref === "string" && Array.isArray(d.bank_options) && d.bank_options.length >= 1 && Array.isArray(d.documents), "data mal formada"),
    expect(d.estimated?.down_payment_pct === 30 && Number.isInteger(d.estimated.term_months), `estimated: ${JSON.stringify(d.estimated)}`),
    expect(/simulaci/i.test(r.speech || "") && /ning/i.test(r.speech || ""), `speech: ${r.speech}`),
  );
});

await step("prepare conduce_corolla da bank_channel", async () => {
  const r = await tool("prepare", { offer_id: "conduce_corolla", installments: 48 });
  return expect(r.status === "denied" && r.error?.code === "bank_channel", JSON.stringify(r));
});

await step("segunda confirmación con otra prueba: replayed, sin segundo débito", async () => {
  const { approval_proof } = await post(`/api/approval-proof?intent_id=${encodeURIComponent(intentCond)}&factor=pin`);
  const res = await post("/api/confirm", { intent_id: intentCond, approval_proof });
  const bal = (await post("/api/balance")).data?.balance_minor;
  const st = (await tool("status")).data;
  return first(
    expect(res.status === "ok" && res.data?.replayed === true, `status=${res.status} replayed=${res.data?.replayed}`),
    expect(bal === balance2, `el saldo cambió: ${balance2} -> ${bal}`),
    expect(st.lines.cotidiano.used_minor === used0 + 120000 && st.plans.length === 2, "se volvió a usar la línea o a crear un plan"),
  );
});

await step("/api/brain «escanea mis créditos» (N0, creditos_escanear)", async () => {
  const r = await post("/api/brain", { text: "escanea mis créditos", screen: "home" });
  const d = r.data;
  return first(
    expect(r.status === "ok", `status=${r.status}`),
    expect(d?.tier === "N0" && d.action === "creditos_escanear", `tier=${d?.tier} action=${d?.action}`),
    expect(d.params && typeof d.params === "object" && typeof d.reply === "string" && d.reply.length > 0, "params o reply mal formados"),
  );
});

console.log(failed ? `\n${failed} paso(s) con FALLA` : "\nTodo OK");
process.exit(failed ? 1 : 0);
