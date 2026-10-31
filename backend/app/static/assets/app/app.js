// PagoDirecto + Wisi — webapp demo.
// Réplica navegable de la app con saldo simulado y el agente de voz integrado:
// Wisi conduce la app (navega, rellena, escanea QR) y la app confirma el dinero
// con la hoja biométrica. El modelo nunca ejecuta pagos: solo prepara intenciones.

const GW = location.origin;
const $ = (id) => document.getElementById(id);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const app = $("app");

// ============================================================ utilidades
const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};
const fmt = new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const bs = (minor) => "Bs " + fmt.format(Number(minor) / 100);
/** "1.234,56" | "1234.56" | "50" -> céntimos (null si no es válido). */
function parseBs(str) {
  let s = String(str ?? "").replace(/bs\.?|\s/gi, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/\.\d{3}(\.|$)/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const haptic = (p = 10) => { try { if (navigator.userActivation?.hasBeenActive ?? true) navigator.vibrate?.(p); } catch {} };
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const when = (ts) => new Date(ts * 1000).toLocaleString("es-VE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

let toastT;
function toast(text, ms = 3200) {
  const el = $("toast");
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove("show"), ms);
}

// ============================================================ loader «estilo Claude»
// Glifo que respira (· ✢ ✳ ✶ ✻ ✽), verbo con brillo y contador real de segundos.
const GLYPHS = ["·", "✢", "✳", "✶", "✻", "✽", "✻", "✶", "✳", "✢"];
const PHRASES = {
  qr: ["Afinando la cámara", "Buscando el QR", "Enfocando el ticket", "Parqueando píxeles", "Leyendo el código", "Wisificando"],
  lookup: ["Consultando la taquilla", "Contando los minutos", "Calculando la tarifa", "Cuadrando el puesto", "Abriendo la talanquera"],
  think: ["Pensando", "Echando números", "Revisando tu wallet", "Wisificando", "Cuadrando la jugada", "Preparando todo"],
  pay: ["Verificando tu huella", "Firmando la operación", "Moviendo los bolívares", "Asentando el pago"],
  voice: ["Despertando a Wisi", "Calentando la voz", "Afinando el micrófono", "Conectando"],
};
function makeThink(kind, { dark = false, cancellable = false } = {}) {
  const el = document.createElement("span");
  el.className = "think" + (dark ? " on-dark" : "");
  el.innerHTML = '<span class="g" aria-hidden="true">·</span><span class="v"></span><span class="m num"></span>';
  const [g, v, m] = el.children;
  let words = PHRASES[kind] || PHRASES.think, wi = 0, gi = 0, secs = 0;
  const paint = () => { m.textContent = `(${secs}s${cancellable ? " · toca para cancelar" : ""})`; };
  v.textContent = words[0] + "…";
  paint();
  const tg = reduced ? 0 : setInterval(() => { g.textContent = GLYPHS[gi++ % GLYPHS.length]; }, 110);
  const tw = setInterval(() => { wi = (wi + 1) % words.length; v.textContent = words[wi] + "…"; }, reduced ? 2600 : 1700);
  const ts = setInterval(() => { secs++; paint(); }, 1000);
  if (reduced) g.textContent = "✻";
  return {
    el,
    set(k) { words = PHRASES[k] || words; wi = 0; v.textContent = words[0] + "…"; },
    stop() { clearInterval(tg); clearInterval(tw); clearInterval(ts); el.remove(); },
  };
}
const thinkFloat = {
  cur: null,
  show(kind, { onCancel } = {}) {
    this.hide();
    const host = $("thinkFloat");
    const t = makeThink(kind);
    host.replaceChildren(t.el);
    if (onCancel) {
      const b = document.createElement("button");
      b.type = "button"; b.textContent = "Cancelar";
      b.onclick = () => { this.hide(); onCancel(); };
      host.append(b);
    }
    host.classList.add("show");
    this.cur = t;
    return t;
  },
  hide() { this.cur?.stop(); this.cur = null; $("thinkFloat").classList.remove("show"); },
};

// ============================================================ estado
const state = {
  balance: null,
  hidden: store.get("pd.hide", "0") === "1",
  services: [],
  foundations: [],
  localMoves: [],      // respaldo si el gateway no expone list_movements
  movesFromServer: true,
};
const LOGOS = { digitel: "digitel", movistar: "movistar", movilnet: "movilnet", corpoelec: "corpoelec", cantv: "cantv" };
const logoOf = (ref) => (LOGOS[ref] ? `/assets/pd/logos/${LOGOS[ref]}.png` : null);
const CAT = { telefonia: "Telefonía", electricidad: "Electricidad", internet: "Internet y teléfono", condominio: "Condominio" };

function setBalance(minor, flash = false) {
  if (minor == null) return;
  state.balance = minor;
  for (const el of $$(".js-bal")) el.textContent = state.hidden ? "Bs ••••" : bs(minor);
  if (flash && !reduced) for (const el of $$(".wallet .amt, .total .js-bal")) { el.classList.remove("balance-flash"); void el.offsetWidth; el.classList.add("balance-flash"); }
}
function paintEye() {
  for (const b of $$(".js-eye")) {
    b.setAttribute("aria-pressed", String(state.hidden));
    b.setAttribute("aria-label", state.hidden ? "Mostrar saldo" : "Ocultar saldo");
    b.querySelector("use").setAttribute("href", state.hidden ? "#i-eye-off" : "#i-eye");
  }
  setBalance(state.balance);
}

// ============================================================ gateway
let principal = store.get("wisi.pid", null);
function newPrincipal() {
  principal = "web-" + crypto.getRandomValues(new Uint32Array(2)).join("").slice(0, 12);
  store.set("wisi.pid", principal);
}
if (!principal) newPrincipal();
let voice = store.get("wisi.voice", "female");
let token = null, voiceEnabled = false;

async function newSession(signed = true) {
  const r = await fetch(`${GW}/api/session?principal=${encodeURIComponent(principal)}&voice=${voice}&signed=${signed}`, { method: "POST" });
  if (!r.ok) throw new Error("session " + r.status);
  const s = await r.json();
  token = s.session_token;
  voiceEnabled = !!s.voice_enabled;
  return s;
}
async function api(path, { body, method = "POST", retried = false } = {}) {
  if (!token) await newSession(false);
  const r = await fetch(`${GW}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 401 && !retried) { token = null; return api(path, { body, method, retried: true }); }
  if (!r.ok) { const e = new Error(`${path} ${r.status}`); e.status = r.status; throw e; }
  return r.json();
}
async function callTool(name, params = {}) {
  if (!live) playFace("pensando");
  try { return await api(`/api/tool/${name}`, { body: params }); }
  finally { if (!live) playFace("neutral"); }
}
async function refreshBalance(flash = false) {
  const r = await callTool("get_balance");
  setBalance(r.data?.balance_minor, flash);
  return r;
}
async function loadMovements() {
  if (state.movesFromServer) {
    try {
      const r = await callTool("list_movements");
      if (r.data?.balance_minor != null) setBalance(r.data.balance_minor);
      return r.data?.movements ?? [];
    } catch (e) { if (e.status === 404) state.movesFromServer = false; else throw e; }
  }
  return state.localMoves;
}

// ============================================================ router (iOS push)
const TABS = ["home", "movs", "pagos", "menu"];
let tab = "home";
const stack = [];
const screen = (n) => $("s-" + n);
const top = () => (stack.length ? screen(stack.at(-1)) : screen(tab));
const SCREENS = {}; // name -> { enter(params), leave() }

function syncChrome() {
  app.classList.toggle("pushed", stack.length > 0);
  for (const b of $$(".tab-btn")) {
    if (b.dataset.go === tab) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  }
}
function go(name) {
  if (!TABS.includes(name)) return;
  while (stack.length) popNow();
  if (name !== tab) {
    screen(tab).classList.remove("on"); screen(tab).inert = true;
    tab = name;
  }
  const el = screen(tab);
  el.classList.add("on"); el.classList.remove("under"); el.inert = false;
  SCREENS[tab]?.enter?.();
  syncChrome();
}
function push(name, params) {
  const el = screen(name);
  if (!el) return;
  if (stack.at(-1) === name) { SCREENS[name]?.enter?.(params); return; }
  if (stack.includes(name)) { while (stack.at(-1) !== name) popNow(); SCREENS[name]?.enter?.(params); return; }
  const prev = top();
  SCREENS[name]?.enter?.(params);
  el.getBoundingClientRect(); // fuerza el estado inicial antes de animar
  el.classList.add("on"); el.inert = false;
  prev.classList.add("under"); prev.inert = true;
  stack.push(name);
  syncChrome();
  haptic(6);
}
function popNow() {
  const name = stack.pop();
  const el = screen(name);
  el.classList.remove("on", "under"); el.inert = true;
  SCREENS[name]?.leave?.();
  const t = top(); t.classList.remove("under"); t.inert = false;
}
function pop() { if (!stack.length) return; popNow(); syncChrome(); }
/** Sustituye la pantalla superior (p. ej. escáner -> ticket) sin dejarla en el historial. */
function replace(name, params) {
  const old = stack.at(-1);
  push(name, params);
  if (!old || old === name) return;
  const i = stack.lastIndexOf(old);
  if (i >= 0) stack.splice(i, 1);
  const el = screen(old);
  setTimeout(() => { el.classList.add("dragging"); el.classList.remove("on", "under"); el.inert = true; SCREENS[old]?.leave?.(); requestAnimationFrame(() => el.classList.remove("dragging")); }, reduced ? 0 : 480);
}

// Gesto de volver desde el borde izquierdo, como en iOS.
(() => {
  let sx = 0, dx = 0, w = 1, active = false, cur = null, under = null;
  $("stack").addEventListener("pointerdown", (e) => {
    if (!stack.length || e.pointerType === "mouse") return;
    const r = app.getBoundingClientRect();
    if (e.clientX - r.left > 24) return;
    active = true; sx = e.clientX; dx = 0; w = r.width;
    cur = top(); under = stack.length > 1 ? screen(stack.at(-2)) : screen(tab);
    cur.classList.add("dragging"); under.classList.add("dragging");
  });
  addEventListener("pointermove", (e) => {
    if (!active) return;
    dx = Math.max(0, e.clientX - sx);
    cur.style.transform = `translateX(${dx}px)`;
    under.style.transform = `translateX(${-28 + (dx / w) * 28}%)`;
  });
  const end = () => {
    if (!active) return;
    active = false;
    cur.classList.remove("dragging"); under.classList.remove("dragging");
    cur.style.transform = under.style.transform = "";
    if (dx > w * 0.33) pop();
  };
  addEventListener("pointerup", end);
  addEventListener("pointercancel", end);
})();

// ============================================================ pantallas
// --- home: servicios registrados
function paintHomeServices() {
  const row = $("homeSvcs");
  $$(".svc-tile:not(.add)", row).forEach((n) => n.remove());
  for (const s of state.services) {
    const src = logoOf(s.service_ref);
    if (!src) continue;
    const b = document.createElement("button");
    b.type = "button"; b.className = "svc-tile"; b.setAttribute("aria-label", `Pagar ${s.name}`);
    b.innerHTML = `<img src="${src}" alt="" />`;
    b.onclick = () => push("pay", { service_ref: s.service_ref });
    row.append(b);
  }
}

// --- movimientos
const KIND_ICON = { payment: "#i-receipt", parking: "#i-car", donation: "#i-heart", transfer: "#i-send" };
let movFilter = "all";
function moveRow(m) {
  const d = document.createElement("div");
  d.className = "item";
  const neg = m.amount_minor < 0;
  d.innerHTML = `<span class="ic"><svg><use href="${KIND_ICON[m.kind] || "#i-receipt"}"/></svg></span><span class="tx"><b></b><small></small></span><span class="amt num"></span>`;
  d.querySelector("b").textContent = m.title;
  d.querySelector("small").textContent = `${when(m.created_at)} · ${m.state === "settled" ? "Procesado" : m.state}`;
  const a = d.querySelector(".amt");
  a.textContent = (neg ? "−" : "+") + bs(Math.abs(m.amount_minor));
  a.style.color = neg ? "var(--ink)" : "var(--ok)";
  return d;
}
SCREENS.movs = {
  async enter() {
    const list = $("movList");
    list.replaceChildren(makeThink("think").el);
    try {
      const moves = (await loadMovements()).filter((m) => movFilter === "all" || (movFilter === "in" ? m.amount_minor > 0 : m.amount_minor < 0));
      if (!moves.length) {
        list.innerHTML = `<div class="empty"><img src="/assets/wisi_avatar.png" alt="" /><b>${movFilter === "in" ? "Aún no tienes ingresos" : "Aún no tienes movimientos"}</b>Cuando pagues algo con tu saldo de demo aparecerá aquí.</div>`;
        if (movFilter !== "in") {
          const b = document.createElement("button");
          b.type = "button"; b.className = "btn btn-primary btn-sm"; b.textContent = "Escanear un ticket";
          b.onclick = () => push("parking");
          list.querySelector(".empty").append(document.createElement("br"), b);
        }
      } else list.replaceChildren(...moves.map(moveRow));
    } catch {
      list.innerHTML = '<div class="empty"><b>No pudimos cargar tus movimientos</b>Revisa tu conexión.</div>';
      const b = document.createElement("button");
      b.type = "button"; b.className = "btn btn-ghost btn-sm"; b.textContent = "Reintentar";
      b.onclick = () => SCREENS.movs.enter();
      list.querySelector(".empty").append(document.createElement("br"), b);
    }
  },
};
$("movFilter").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  movFilter = b.dataset.f;
  for (const x of $$("button", $("movFilter"))) x.setAttribute("aria-selected", String(x === b));
  SCREENS.movs.enter();
});
$("movsRefresh").addEventListener("click", () => { haptic(); refreshBalance(true).catch(() => {}); SCREENS.movs.enter(); });

// --- mis pagos
let payFilter = "pend";
SCREENS.pagos = {
  async enter() {
    const list = $("payList");
    let moves = [];
    try { moves = await loadMovements(); } catch {}
    const paidNames = new Set(moves.filter((m) => m.kind === "payment").map((m) => m.title.replace(/^Pago /, "")));
    const pending = state.services.filter((s) => !paidNames.has(s.name));
    if (payFilter === "pend") {
      const total = pending.reduce((a, s) => a + (s.sample_pending_minor || 0), 0);
      $("payTotalLbl").textContent = "Total por pagar";
      $("payTotal").textContent = bs(total);
      $("payTotalSub").textContent = pending.length ? `${pending.length} servicio${pending.length > 1 ? "s" : ""} con deuda consultada` : "No tienes pagos pendientes";
      list.replaceChildren(...pending.map((s) => {
        const b = document.createElement("button");
        b.type = "button"; b.className = "item";
        const src = logoOf(s.service_ref);
        b.innerHTML = `<span class="ic ${src ? "logo" : ""}">${src ? `<img src="${src}" alt="" />` : '<svg><use href="#i-receipt"/></svg>'}</span><span class="tx"><b></b><small>Pendiente</small></span><span class="amt num"></span><svg class="chev"><use href="#i-chev"/></svg>`;
        b.querySelector("b").textContent = s.name;
        b.querySelector(".amt").textContent = bs(s.sample_pending_minor);
        b.setAttribute("aria-label", `Pagar ${s.name}, ${bs(s.sample_pending_minor)}`);
        b.onclick = () => push("pay", { service_ref: s.service_ref });
        return b;
      }));
    } else if (payFilter === "prog") {
      $("payTotalLbl").textContent = "Programados";
      $("payTotal").textContent = bs(0);
      $("payTotalSub").textContent = "Sin pagos programados";
      list.innerHTML = '<div class="empty"><b>No tienes pagos programados</b>Los pagos recurrentes llegarán pronto a esta demo.</div>';
    } else {
      const paid = moves.filter((m) => m.kind === "payment");
      $("payTotalLbl").textContent = "Pagado en esta demo";
      $("payTotal").textContent = bs(paid.reduce((a, m) => a - m.amount_minor, 0));
      $("payTotalSub").textContent = paid.length ? `${paid.length} pago${paid.length > 1 ? "s" : ""}` : "Aún no has pagado servicios";
      list.replaceChildren(...paid.map(moveRow));
    }
  },
};
$("payFilter").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  payFilter = b.dataset.f;
  for (const x of $$("button", $("payFilter"))) x.setAttribute("aria-selected", String(x === b));
  SCREENS.pagos.enter();
});

// --- servicios (lista) y pago
function paintServiceGrid() {
  $("svcGrid").replaceChildren(...state.services.map((s) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "logo-card"; b.setAttribute("aria-label", s.name);
    const src = logoOf(s.service_ref);
    b.innerHTML = src ? `<img src="${src}" alt="" />` : `<span style="font-weight:600;font-size:17px">${s.name}</span>`;
    b.onclick = () => push("pay", { service_ref: s.service_ref });
    return b;
  }));
}
let payCtx = null; // { svc, bound: {intent_id, acct, amount} }
SCREENS.pay = {
  enter(p = {}) {
    const svc = state.services.find((s) => s.service_ref === p.service_ref) || state.services[0];
    if (!svc) return;
    payCtx = { svc, bound: p.intent_id ? { intent_id: p.intent_id, acct: p.account_number, amount: p.amount_minor } : null };
    const src = logoOf(svc.service_ref);
    $("payLogo").hidden = !src; if (src) $("payLogo").src = src;
    $("payName").textContent = svc.name;
    $("payCat").textContent = CAT[svc.category] || svc.category;
    $("payAcct").value = p.account_number ?? "";
    $("payAcct").removeAttribute("aria-invalid"); $("payAcctErr").hidden = true;
    $("payAmt").value = fmt.format((p.amount_minor ?? svc.sample_pending_minor) / 100);
    paintPayCta();
  },
};
function paintPayCta() {
  const amt = parseBs($("payAmt").value);
  $("payGo").textContent = amt ? `Pagar ${bs(amt)}` : "Continuar";
}
$("payAmt").addEventListener("input", paintPayCta);
$("payForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const acct = $("payAcct").value.trim();
  const amt = parseBs($("payAmt").value);
  $("payAcctErr").hidden = !!acct;
  $("payAcct").toggleAttribute("aria-invalid", !acct);
  if (!acct) return $("payAcct").focus();
  if (!amt) { toast("Escribe un monto válido"); return $("payAmt").focus(); }
  const b = payCtx.bound;
  if (b && b.acct === acct && b.amount === amt) return confirmOp(b.intent_id, "ui");
  await runPrepare("prepare_payment", { service_ref: payCtx.svc.service_ref, account_number: acct, amount_minor: amt }, $("payGo"));
});

// --- donaciones
let donCtx = { ref: null, bound: null };
function paintFoundations() {
  $("donList").replaceChildren(...state.foundations.map((f, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "opt"; b.setAttribute("role", "radio");
    b.dataset.ref = f.foundation_ref;
    b.innerHTML = '<span class="dot" aria-hidden="true"></span><b></b>';
    b.querySelector("b").textContent = f.name;
    b.setAttribute("aria-checked", String(i === 0));
    b.onclick = () => pickFoundation(f.foundation_ref);
    return b;
  }));
  donCtx.ref ??= state.foundations[0]?.foundation_ref;
}
function pickFoundation(ref) {
  donCtx.ref = ref;
  for (const o of $$(".opt", $("donList"))) o.setAttribute("aria-checked", String(o.dataset.ref === ref));
}
function paintDonCta() {
  const amt = parseBs($("donAmt").value);
  $("donGo").textContent = amt ? `Donar ${bs(amt)}` : "Donar";
  for (const c of $$(".chip", $("donChips"))) c.setAttribute("aria-pressed", String(Number(c.dataset.a) * 100 === amt));
}
SCREENS.donate = {
  enter(p = {}) {
    donCtx.bound = p.intent_id ? { intent_id: p.intent_id, ref: p.foundation_ref, amount: p.amount_minor } : null;
    if (p.foundation_ref) pickFoundation(p.foundation_ref);
    if (p.amount_minor) $("donAmt").value = fmt.format(p.amount_minor / 100);
    paintDonCta();
  },
};
$("donChips").addEventListener("click", (e) => {
  const c = e.target.closest(".chip"); if (!c) return;
  haptic(6);
  $("donAmt").value = fmt.format(Number(c.dataset.a));
  paintDonCta();
});
$("donAmt").addEventListener("input", paintDonCta);
$("donForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const amt = parseBs($("donAmt").value);
  if (!donCtx.ref) return toast("Elige una organización");
  if (!amt) { toast("Escribe un monto válido"); return $("donAmt").focus(); }
  const b = donCtx.bound;
  if (b && b.ref === donCtx.ref && b.amount === amt) return confirmOp(b.intent_id, "ui");
  await runPrepare("prepare_donation", { foundation_ref: donCtx.ref, amount_minor: amt }, $("donGo"));
});

// --- enviar
let sendCtx = { bound: null };
SCREENS.send = {
  enter(p = {}) {
    sendCtx.bound = p.intent_id ? { intent_id: p.intent_id, to: p.recipient_ref, amount: p.amount_minor } : null;
    if (p.recipient_ref) $("sendTo").value = p.recipient_ref;
    if (p.amount_minor) $("sendAmt").value = fmt.format(p.amount_minor / 100);
    $("sendToErr").hidden = true; $("sendTo").removeAttribute("aria-invalid");
    paintSendCta();
  },
};
function paintSendCta() { const a = parseBs($("sendAmt").value); $("sendGo").textContent = a ? `Enviar ${bs(a)}` : "Continuar"; }
$("sendAmt").addEventListener("input", paintSendCta);
$("sendForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const to = $("sendTo").value.trim();
  const amt = parseBs($("sendAmt").value);
  const okTo = /^@[\w.]{2,30}$/.test(to) || /^\+?[\d\s-]{7,16}$/.test(to);
  $("sendToErr").hidden = okTo; $("sendTo").toggleAttribute("aria-invalid", !okTo);
  if (!okTo) return $("sendTo").focus();
  if (!amt) { toast("Escribe un monto válido"); return $("sendAmt").focus(); }
  const b = sendCtx.bound;
  if (b && b.to === to && b.amount === amt) return confirmOp(b.intent_id, "ui");
  await runPrepare("prepare_transfer", { recipient_ref: to, amount_minor: amt, kind: "p2p" }, $("sendGo"));
});

// --- estacionamiento: stepper
function parkStep(k) {
  for (const s of $$(".step", $("s-parking"))) {
    const i = Number(s.dataset.k);
    s.classList.toggle("done", i < k);
    s.classList.toggle("on", i === k);
  }
}

// --- ticket
let tkCtx = null; // { ref, intent_id, amount, entry }
SCREENS.ticket = {
  enter(p) {
    tkCtx = p;
    $("tkRef").textContent = p.ref;
    $("tkAmt").textContent = bs(p.amount);
    const paid = !!p.paid;
    $("tkState").textContent = paid ? "Pagado" : "Pendiente de pago";
    $("tkState").classList.toggle("ok", paid);
    const rowsVisible = !!p.entry;
    $("tkIn").parentElement.hidden = $("tkTime").parentElement.hidden = !rowsVisible;
    if (rowsVisible) {
      const d = new Date(p.entry);
      $("tkIn").textContent = d.toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" });
      const mins = Math.max(1, Math.round((Date.now() - d) / 60000));
      $("tkTime").textContent = `${Math.floor(mins / 60)} h ${mins % 60} min`;
    }
    $("tkPay").disabled = paid;
    $("tkPay").textContent = paid ? "Ticket pagado" : `Pagar ${bs(p.amount)}`;
    parkStep(paid ? 3 : 2);
  },
};
$("tkPay").addEventListener("click", () => tkCtx?.intent_id && confirmOp(tkCtx.intent_id, "ui"));

// --- éxito
const DONE = {
  payment: (s) => ["Pago realizado", `Pago ${s.service ?? "de servicio"}`],
  parking: (s) => ["Ticket pagado", `Estacionamiento · ${s.ticket_ref ?? ""}. Ya puedes salir.`],
  donation: (s) => ["¡Gracias por donar!", `Donación a ${s.foundation ?? ""}`],
  transfer: (s) => ["Envío realizado", `Enviado a ${s.recipient_ref ?? ""}`],
};
function showDone(op, res) {
  const [title, what] = (DONE[op.kind] || (() => ["¡Listo!", ""]))(op.s);
  $("doneTitle").textContent = title;
  $("doneAmt").textContent = op.s.amount_minor != null ? bs(op.s.amount_minor) : "";
  $("doneWhat").textContent = what;
  const rows = [["Referencia", res.data?.operation_ref ?? "—"], ["Fecha", new Date().toLocaleString("es-VE", { dateStyle: "medium", timeStyle: "short" })], ["Comisión", bs(0)], ["Nuevo saldo", bs(res.data?.balance_minor ?? state.balance)]];
  $("doneList").replaceChildren(...rows.map(([a, b]) => { const d = document.createElement("div"); d.innerHTML = "<dt></dt><dd class='num'></dd>"; d.children[0].textContent = a; d.children[1].textContent = b; return d; }));
  if (op.kind === "parking" && tkCtx) { tkCtx.paid = true; parkStep(3); }
  replace("done");
  setTimeout(() => $("doneTitle").focus({ preventScroll: true }), 500);
}
$("doneOk").addEventListener("click", () => go("home"));

// ============================================================ escáner QR
// Cámara real (BarcodeDetector nativo o jsQR) y modo demo si no hay cámara.
let scan = null; // { resolve, stream, timer, done }
function demoTicketGrid() {
  // Patrón decorativo tipo QR, determinista, para el ticket de demostración.
  const n = 21, cells = [];
  const finder = (x, y) => [[0, 0], [n - 7, 0], [0, n - 7]].some(([fx, fy]) => {
    const dx = x - fx, dy = y - fy;
    if (dx < 0 || dy < 0 || dx > 6 || dy > 6) return false;
    return dx === 0 || dy === 0 || dx === 6 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4);
  });
  const inFinderZone = (x, y) => [[0, 0], [n - 7, 0], [0, n - 7]].some(([fx, fy]) => x >= fx - 1 && x <= fx + 7 && y >= fy - 1 && y <= fy + 7);
  let seed = 48213;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const on = inFinderZone(x, y) ? finder(x, y) : seed % 100 < 46;
    cells.push(`<i${on ? ' class="k"' : ""}></i>`);
  }
  $("demoTicket").innerHTML = cells.join("");
}
function ticketFromQR(text) {
  // Nunca abrimos URLs de un QR: solo extraemos un código seguro.
  const raw = String(text || "").slice(0, 200);
  const m = raw.match(/TCK-?[A-Z0-9]{3,12}/i);
  const entry = Number(raw.match(/:(\d{13})$/)?.[1]) || null;
  let ref = m ? m[0].toUpperCase().replace(/^TCK(?!-)/, "TCK-") : raw.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(-12);
  if (!ref) ref = "TCK-" + String(Math.abs([...raw].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7))).slice(0, 5);
  return { ref, entry };
}
function scanMsg(title, sub = "") {
  $("scanMsg").innerHTML = "<b></b><small></small>";
  $("scanMsg").children[0].textContent = title;
  $("scanMsg").children[1].textContent = sub;
}
async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("no-media");
  const ask = navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
  let late = false;
  const stream = await Promise.race([ask, sleep(6000).then(() => { late = true; throw new Error("timeout"); })]);
  // Si el permiso llega tarde, apagamos esa cámara: ya estamos en modo demo.
  ask.then((s) => { if (late) s.getTracks().forEach((t) => t.stop()); }, () => {});
  const v = $("cam");
  v.srcObject = stream;
  await v.play().catch(() => {});
  v.classList.add("on");
  return stream;
}
let jsQRp = null;
const loadJsQR = () => (jsQRp ??= new Promise((ok, ko) => {
  const s = document.createElement("script");
  s.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js";
  s.onload = () => (window.jsQR ? ok(window.jsQR) : ko(new Error("jsqr")));
  s.onerror = () => { jsQRp = null; ko(new Error("jsqr")); };
  document.head.append(s);
}));
async function makeDecoder() {
  if ("BarcodeDetector" in window) {
    try {
      const d = new BarcodeDetector({ formats: ["qr_code"] });
      return async (v) => (await d.detect(v))[0]?.rawValue ?? null;
    } catch {}
  }
  const jsQR = await loadJsQR();
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d", { willReadFrequently: true });
  return async (v) => {
    if (!v.videoWidth) return null;
    const w = 480, h = Math.round((v.videoHeight / v.videoWidth) * w);
    c.width = w; c.height = h;
    ctx.drawImage(v, 0, 0, w, h);
    return jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" })?.data ?? null;
  };
}
function stopScan(result = null) {
  if (!scan) return;
  const s = scan; scan = null;
  s.done = true;
  clearTimeout(s.timer); clearTimeout(s.demoT);
  s.stream?.getTracks().forEach((t) => t.stop());
  $("cam").classList.remove("on"); $("cam").srcObject = null;
  thinkFloat.hide();
  s.resolve(result);
}
SCREENS.scan = {
  enter() {
    $("frame").classList.remove("hit");
    $("demoTicket").classList.remove("in");
    $("useDemo").hidden = true;
    $("manualForm").hidden = true; $("manualBtn").hidden = false;
    scanMsg("Apunta al QR del ticket", "Lo leemos solos, no hace falta tocar nada");
    parkStep(0);
  },
  leave() { stopScan(null); $("cam").classList.remove("on"); $("cam").srcObject = null; },
};
function runDemoScan(s) {
  scanMsg("Modo demo", "Usamos un ticket de prueba");
  $("demoTicket").classList.add("in");
  s.demoT = setTimeout(() => !s.done && onScanHit(s, `PD-PARK:TCK-48213:${Date.now() - 107 * 60000}`), reduced ? 600 : 2600);
}
/** Abre el escáner y resuelve con { ref, entry, prep } o null si se cancela. */
function startScan() {
  if (scan) stopScan(null);
  return new Promise((resolve) => {
    const s = (scan = { resolve, done: false });
    if (!$("s-parking").classList.contains("on")) push("parking");
    push("scan");
    const t = thinkFloat.show("qr", { onCancel: () => { stopScan(null); if (stack.at(-1) === "scan") pop(); } });
    (async () => {
      try {
        s.stream = await startCamera();
        if (s.done) return s.stream.getTracks().forEach((x) => x.stop());
        scanMsg("Apunta al QR del ticket", "Mantén el teléfono quieto un segundo");
        const decode = await makeDecoder();
        const v = $("cam");
        const started = Date.now();
        const loop = async () => {
          if (s.done) return;
          let text = null;
          try { text = await decode(v); } catch {}
          if (text) return onScanHit(s, text);
          if (Date.now() - started > 7000 && $("useDemo").hidden) {
            $("useDemo").hidden = false;
            scanMsg("¿No tienes un ticket a mano?", "Usa el ticket de demo o escribe el código");
            t.set("think");
          }
          s.timer = setTimeout(loop, 220);
        };
        loop();
      } catch {
        if (!s.done) runDemoScan(s);
      }
    })();
  });
}
async function onScanHit(s, text) {
  if (s.done || s.hit) return;
  s.hit = true;
  const { ref, entry } = ticketFromQR(text);
  $("frame").classList.add("hit");
  haptic([12, 40, 12]);
  scanMsg("Ticket leído", ref);
  parkStep(1);
  s.stream?.getTracks().forEach((x) => x.stop());
  thinkFloat.show("lookup");
  try {
    const prep = await callTool("prepare_parking", { ticket_ref: ref });
    if (s.done) return;
    await sleep(reduced ? 0 : 700);
    if (prep.status === "requires_confirmation") {
      const op = registerOp("prepare_parking", prep, { chat: wisiStarted });
      const params = { ref, entry, intent_id: op.id, amount: op.s.amount_minor };
      scan = null; thinkFloat.hide(); clearTimeout(s.timer);
      replace("ticket", params);
      s.resolve({ ref, entry, prep });
    } else {
      thinkFloat.hide();
      scanMsg("No pudimos leer ese ticket", prep.speech || "Inténtalo de nuevo");
      s.hit = false; $("frame").classList.remove("hit");
    }
  } catch {
    thinkFloat.hide();
    scanMsg("Sin conexión con PagoDirecto", "Revisa tu conexión e inténtalo de nuevo");
    s.hit = false; $("frame").classList.remove("hit");
  }
}
$("useDemo").addEventListener("click", () => scan && (s => { $("useDemo").hidden = true; s.stream?.getTracks().forEach((x) => x.stop()); $("cam").classList.remove("on"); runDemoScan(s); })(scan));
$("manualBtn").addEventListener("click", () => { $("manualForm").hidden = false; $("manualBtn").hidden = true; $("manualCode").focus(); });
$("manualForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const v = $("manualCode").value.trim();
  if (!v || !scan) return;
  $("manualCode").blur();
  onScanHit(scan, v);
});
// Abrir el escáner desde la UI (botones) usa el mismo flujo que Wisi.
function scanFromUI() { startScan().then((r) => r && notifyAgent(`El usuario escaneó el ticket ${r.ref} desde la app. Intención ${r.prep.data.intent_id} por ${bs(r.prep.data.summary.amount_minor)} pendiente de confirmar.`)); }

// ============================================================ operaciones (preparar → confirmar)
const ops = new Map();
const KIND = {
  prepare_payment: { kind: "payment", ic: "#i-receipt", t: (s) => `Pago ${s.service ?? "servicio"}`, sub: (s) => (s.account_number ? `Cuenta ${s.account_number}` : "") },
  prepare_parking: { kind: "parking", ic: "#i-car", t: () => "Estacionamiento", sub: (s) => `Ticket ${s.ticket_ref ?? ""}` },
  prepare_donation: { kind: "donation", ic: "#i-heart", t: (s) => `Donación a ${s.foundation ?? ""}`, sub: () => "Aporte solidario" },
  prepare_transfer: { kind: "transfer", ic: "#i-send", t: (s) => `Envío a ${s.recipient_ref ?? ""}`, sub: () => "Wallet a wallet" },
};
function registerOp(tool, res, { chat = true } = {}) {
  const id = res.data?.intent_id;
  if (!id) return null;
  if (ops.has(id)) return ops.get(id);
  const k = KIND[tool] || { kind: "other", ic: "#i-receipt", t: () => "Operación", sub: () => "" };
  const op = { id, s: res.data.summary || {}, k, kind: k.kind, state: "pending", tool, t: Date.now() };
  ops.set(id, op);
  if (chat) {
    const card = document.createElement("div");
    card.className = "op";
    card.innerHTML = `<div class="row"><div class="ic"><svg><use href="${k.ic}"/></svg></div><div style="min-width:0"><div class="t"></div><div class="s"></div></div><div class="amt num"></div></div>
      <div class="acts"><button type="button" class="btn btn-ghost">Cancelar</button><button type="button" class="btn btn-primary">Confirmar</button></div><div class="state" hidden></div>`;
    card.querySelector(".t").textContent = k.t(op.s);
    card.querySelector(".s").textContent = k.sub(op.s);
    card.querySelector(".amt").textContent = op.s.amount_minor != null ? bs(op.s.amount_minor) : "";
    card.querySelector(".btn-primary").onclick = () => confirmOp(id, "card");
    card.querySelector(".btn-ghost").onclick = () => { finishOp(id, "off", "Operación cancelada"); notifyAgent(`El usuario canceló ${k.t(op.s)}.`); };
    op.card = card;
    hideThinking();
    $("chat").append(card);
    scrollChat();
  }
  return op;
}
function finishOp(id, cls, text) {
  const op = ops.get(id); if (!op) return;
  op.state = cls;
  if (!op.card) return;
  op.card.classList.add(cls);
  op.card.querySelector(".acts")?.remove();
  const st = op.card.querySelector(".state"); st.hidden = false; st.textContent = text;
  if (cls === "done") op.card.querySelector(".ic use").setAttribute("href", "#i-check");
}
/** Lleva la UI a la pantalla de la operación que preparó Wisi, ya rellenada. */
function showOpInApp(op) {
  const s = op.s;
  switch (op.kind) {
    case "parking": {
      if (stack.at(-1) === "ticket" && tkCtx?.intent_id === op.id) return;
      if (!stack.includes("parking")) push("parking");
      push("ticket", { ref: s.ticket_ref, intent_id: op.id, amount: s.amount_minor, entry: null });
      break;
    }
    case "payment": {
      const svc = state.services.find((x) => x.name === s.service);
      push("pay", { service_ref: svc?.service_ref, account_number: s.account_number, amount_minor: s.amount_minor, intent_id: op.id });
      break;
    }
    case "donation": {
      const f = state.foundations.find((x) => x.name === s.foundation);
      push("donate", { foundation_ref: f?.foundation_ref, amount_minor: s.amount_minor, intent_id: op.id });
      break;
    }
    case "transfer":
      push("send", { recipient_ref: s.recipient_ref, amount_minor: s.amount_minor, intent_id: op.id });
      break;
  }
}
async function runPrepare(tool, params, btn) {
  btn?.classList.add("loading");
  try {
    const res = await callTool(tool, params);
    if (res.status !== "requires_confirmation") { toast(res.speech || "No se pudo preparar la operación"); return null; }
    const op = registerOp(tool, res, { chat: false });
    return confirmOp(op.id, "ui");
  } catch {
    toast("Sin conexión con PagoDirecto. Inténtalo de nuevo.");
    return null;
  } finally { btn?.classList.remove("loading"); }
}

// --- hoja de confirmación (simula biometría/PIN; el servidor emite la prueba)
function openSheet(id, focusEl) {
  const w = $(id);
  w.classList.add("on");
  w.dataset.ret = document.activeElement?.id || "";
  setTimeout(() => focusEl?.focus({ preventScroll: true }), 320);
}
function closeSheet(id) {
  const w = $(id);
  if (!w.classList.contains("on")) return;
  w.classList.remove("on");
  const ret = w.dataset.ret && $(w.dataset.ret);
  ret?.focus?.({ preventScroll: true });
}
let sheetBusy = false;
function askApproval(op) {
  return new Promise((resolve) => {
    const ok = $("cfOk"), no = $("cfNo"), wrap = $("confirm");
    const amt = op.s.amount_minor;
    $("cfSub").textContent = op.k.t(op.s);
    $("cfAmt").textContent = amt != null ? bs(amt) : "";
    const short = state.balance != null && amt != null && amt > state.balance;
    const rows = [["Concepto", op.k.t(op.s)], ...(op.k.sub(op.s) ? [["Detalle", op.k.sub(op.s)]] : []), ["Comisión", bs(0)], ["Desde", "Wallet PagoDirecto"]];
    if (state.balance != null && amt != null) rows.push([short ? "Saldo disponible" : "Saldo después", bs(short ? state.balance : state.balance - amt)]);
    $("cfList").replaceChildren(...rows.map(([a, b]) => { const d = document.createElement("div"); d.innerHTML = "<dt></dt><dd class='num'></dd>"; d.children[0].textContent = a; d.children[1].textContent = b; return d; }));
    ok.className = "bio"; ok.disabled = short;
    $("cfOkTxt").textContent = short ? "Saldo insuficiente" : "Confirmar con huella";
    openSheet("confirm", short ? no : ok);
    let t = null;
    const close = (v) => {
      t?.stop();
      closeSheet("confirm");
      ok.onclick = no.onclick = wrap.onclick = null;
      document.removeEventListener("keydown", esc, true);
      resolve(v);
    };
    const esc = (e) => { if (e.key === "Escape") { e.stopPropagation(); close(false); } };
    document.addEventListener("keydown", esc, true);
    no.onclick = () => close(false);
    wrap.onclick = (e) => { if (e.target === wrap) close(false); };
    ok.onclick = async () => {
      ok.disabled = true; ok.classList.add("scan"); haptic(20);
      t = makeThink("pay", { dark: true });
      $("cfOkTxt").replaceChildren(t.el);
      t.el.style.color = "#fff";
      t.el.querySelector(".v").style.cssText = "background:none;color:#fff;animation:none";
      t.el.querySelector(".g").style.color = "#fff";
      t.el.querySelector(".m").style.color = "rgba(255,255,255,.8)";
      await sleep(reduced ? 200 : 1100);
      t.stop(); t = null;
      ok.classList.remove("scan"); ok.classList.add("ok");
      $("cfOkTxt").textContent = "Aprobado";
      await sleep(reduced ? 0 : 280);
      close(true);
    };
  });
}
/** Parámetros para volver a cotizar una operación (las intenciones caducan). */
function paramsOf(op) {
  const s = op.s;
  switch (op.kind) {
    case "parking": return { ticket_ref: s.ticket_ref };
    case "payment": return { service_ref: state.services.find((x) => x.name === s.service)?.service_ref, account_number: s.account_number, amount_minor: s.amount_minor };
    case "donation": return { foundation_ref: state.foundations.find((x) => x.name === s.foundation)?.foundation_ref, amount_minor: s.amount_minor };
    case "transfer": return { recipient_ref: s.recipient_ref, amount_minor: s.amount_minor, kind: s.kind || "p2p" };
  }
  return null;
}
const INTENT_TTL_MS = 170_000; // el gateway da 180 s; renovamos con margen
async function freshOp(op) {
  if (Date.now() - op.t < INTENT_TTL_MS) return op;
  const res = await callTool(op.tool, paramsOf(op));
  if (res.status !== "requires_confirmation") throw new Error(res.speech || "requote");
  const fresh = registerOp(op.tool, res, { chat: false });
  fresh.card = op.card; op.state = "off";
  // La UI sigue apuntando a la operación vigente.
  if (tkCtx?.intent_id === op.id) tkCtx.intent_id = fresh.id;
  for (const c of [payCtx?.bound, donCtx.bound, sendCtx.bound]) if (c?.intent_id === op.id) c.intent_id = fresh.id;
  return fresh;
}
async function confirmOp(id, source) {
  let op = ops.get(id);
  if (!op) return { status: "error", speech: "No encuentro esa operación." };
  if (op.state === "done") return op.result;
  if (op.state === "off" && source !== "ui") return { status: "denied", speech: "El usuario canceló la operación." };
  if (sheetBusy) return { status: "denied", speech: "Ya hay una confirmación en curso." };
  sheetBusy = true;
  if (wisiOpen) closeWisi();
  try {
    try { op = await freshOp(op); } catch (e) { toast(/^(requote|\/api)/.test(e.message) ? "No pudimos renovar la cotización. Inténtalo de nuevo." : e.message); return { status: "error", speech: "No pude renovar la cotización." }; }
    id = op.id; op.state = "pending";
    const approved = await askApproval(op);
    if (!approved) {
      if (source === "card") finishOp(id, "off", "Confirmación cancelada");
      if (source !== "agent") notifyAgent(`El usuario canceló la confirmación de ${op.k.t(op.s)}.`);
      return { status: "denied", speech: "El usuario canceló la confirmación." };
    }
    const { approval_proof } = await api(`/api/approval-proof?intent_id=${encodeURIComponent(id)}`);
    const res = await api("/api/confirm", { body: { intent_id: id, approval_proof } });
    if (res.status === "ok") {
      op.result = res;
      finishOp(id, "done", `Aprobado · ref. ${res.data?.operation_ref ?? ""}`);
      setBalance(res.data?.balance_minor, true);
      state.localMoves.unshift({ operation_ref: res.data?.operation_ref, kind: op.kind, title: op.k.t(op.s), amount_minor: -(op.s.amount_minor || 0), state: "settled", created_at: Date.now() / 1000 });
      haptic([10, 40, 10]); wink();
      showDone(op, res);
    } else {
      finishOp(id, "off", res.speech || "No se pudo completar");
      toast(res.speech || "No se pudo completar la operación");
    }
    if (source !== "agent") {
      if (wisiStarted) say(res.speech);
      notifyAgent(`El usuario confirmó en la app. Resultado: ${res.speech}`);
    }
    return res;
  } catch {
    finishOp(id, "off", "Error al confirmar; no se movió dinero");
    toast("Algo falló al confirmar; no se movió dinero.");
    return { status: "error", speech: "Algo falló al confirmar; no se movió dinero." };
  } finally { sheetBusy = false; }
}

// ============================================================ avatar Lottie (mismas animaciones que la app)
const animText = {};
const faces = new Map(); // elemento -> { anim, name }
async function animData(name) {
  animText[name] ??= fetch(`/assets/wisi_${name}.json`).then((r) => { if (!r.ok) throw new Error(); return r.text(); });
  return JSON.parse(await animText[name]);
}
function sweepFaces() {
  for (const [el, f] of faces) if (!el.isConnected) { f.anim?.destroy(); faces.delete(el); }
}
async function setFace(el, name) {
  if (!window.lottie || !el) return;
  sweepFaces();
  const f = faces.get(el) || {};
  if (f.name === name) return;
  f.name = name; faces.set(el, f);
  try {
    const data = await animData(name);
    if (f.name !== name) return;
    f.anim?.destroy();
    el.replaceChildren();
    f.anim = lottie.loadAnimation({ container: el, renderer: "svg", loop: true, autoplay: !reduced, animationData: data });
    if (reduced) f.anim.goToAndStop(0, true);
  } catch { /* se queda la imagen estática */ }
}
const headFace = () => document.querySelector('.js-face[data-size="head"]');
function playFace(name) { setFace(headFace(), name); }
function wink() { playFace("picando_ojo"); setTimeout(() => { if (faces.get(headFace())?.name === "picando_ojo") playFace("neutral"); }, 2600); }

// ============================================================ hoja de Wisi + isla
let wisiOpen = false, wisiStarted = false, islandPinned = false;
function openWisi() {
  if (wisiOpen) return;
  wisiOpen = true;
  const w = $("wisi");
  w.inert = false; w.classList.add("open");
  $("wisiScrim").classList.add("on");
  $("stack").inert = true; document.querySelector(".tabbar").inert = true;
  paintIsland();
  if (!wisiStarted) greet();
  setTimeout(() => $("btnMic").focus({ preventScroll: true }), 360);
  haptic(8);
}
function closeWisi() {
  if (!wisiOpen) return;
  wisiOpen = false;
  const w = $("wisi");
  w.classList.remove("open"); w.style.transform = "";
  $("wisiScrim").classList.remove("on");
  $("stack").inert = false; document.querySelector(".tabbar").inert = false;
  setTimeout(() => { if (!wisiOpen) w.inert = true; }, 520);
  paintIsland();
  $("fab").focus({ preventScroll: true });
}
/** Wisi va a mover la app: minimiza la hoja a la isla para que se vea la acción. */
function driveApp() {
  islandPinned = true;
  if (wisiOpen) closeWisi();
  paintIsland();
}
function paintIsland() {
  const on = !wisiOpen && (live || islandPinned);
  $("island").classList.toggle("show", on);
  app.classList.toggle("island-on", on);
}
function islandCaption(who, text) {
  if (!text) return;
  const cap = $("islandCap");
  cap.innerHTML = "<small></small>";
  cap.firstChild.textContent = who;
  cap.append(text);
}
$("fab").addEventListener("click", openWisi);
$("islandOpen").addEventListener("click", openWisi);
$("islandEnd").addEventListener("click", async () => { islandPinned = false; await endConv(); paintIsland(); });
$("wisiScrim").addEventListener("click", closeWisi);
$("wisiGrab").addEventListener("click", closeWisi);
// Arrastrar la hoja hacia abajo para cerrarla.
(() => {
  const w = $("wisi");
  let sy = 0, dy = 0, t0 = 0, on = false;
  const start = (e) => { if (!wisiOpen || e.button > 0) return; on = true; sy = e.clientY; dy = 0; t0 = performance.now(); w.classList.add("dragging"); };
  for (const h of [$("wisiGrab"), document.querySelector(".wisi-head")]) h.addEventListener("pointerdown", (e) => { if (e.target.closest("button:not(.grab)")) return; start(e); });
  addEventListener("pointermove", (e) => { if (!on) return; dy = Math.max(0, e.clientY - sy); w.style.transform = `translateY(${dy}px)`; });
  const end = () => {
    if (!on) return;
    on = false; w.classList.remove("dragging");
    const v = dy / Math.max(1, performance.now() - t0);
    if (dy > 140 || v > 0.6) closeWisi(); else w.style.transform = "";
  };
  addEventListener("pointerup", end); addEventListener("pointercancel", end);
})();

// --- chat
const chat = $("chat");
function scrollChat() { requestAnimationFrame(() => { chat.scrollTop = chat.scrollHeight; }); }
function add(who, text) {
  if (!text) return null;
  hideThinking();
  if (chat.querySelector(".hello")) { chat.querySelector(".hello").remove(); sweepFaces(); }
  const d = document.createElement("div");
  d.className = "msg " + who;
  d.textContent = text;
  chat.append(d);
  scrollChat();
  if (who === "wisi") islandCaption("Wisi", text);
  if (who === "user") islandCaption("Tú", text);
  return d;
}
const say = (t) => add("wisi", t);
let thinkRow = null, thinkTimer = 0;
function showThinking() {
  if (thinkRow) return;
  thinkRow = makeThink("think");
  const row = document.createElement("div");
  row.className = "msg think-row";
  row.append(thinkRow.el);
  thinkRow.row = row;
  chat.append(row);
  scrollChat();
  clearTimeout(thinkTimer);
  thinkTimer = setTimeout(hideThinking, 20000);
}
function hideThinking() { if (!thinkRow) return; thinkRow.stop(); thinkRow.row.remove(); thinkRow = null; }
function greet() {
  wisiStarted = true;
  chat.replaceChildren();
  const h = document.createElement("div");
  h.className = "hello";
  h.innerHTML = '<div class="big js-hello-face"><img src="/assets/wisi_avatar.png" alt="" style="width:100%;height:100%" /></div><h2>¿Qué hacemos hoy?</h2><p>Escaneo tu ticket, pago tus servicios, dono o envío fondos. Tú confirmas con tu huella.</p>';
  chat.append(h);
  setFace(h.querySelector(".js-hello-face"), "picando_ojo");
}
function setStatus(text, kind = "") { $("status").textContent = text; $("dot").className = "dot " + kind; }

// ============================================================ agente ElevenLabs (voz y texto)
let Conversation = null, conv = null, mode = null, live = false, starting = null, meter = 0, skipGreeting = false, lastTyped = null;
async function loadSDK() {
  if (Conversation) return Conversation;
  for (const url of ["https://esm.sh/@elevenlabs/client@0.7.1", "https://cdn.jsdelivr.net/npm/@elevenlabs/client@0.7.1/+esm"]) {
    try { ({ Conversation } = await import(url)); return Conversation; } catch {}
  }
  throw new Error("No se pudo cargar el motor de voz");
}
const SCREEN_MAP = {
  home: () => go("home"), wallet: () => go("home"), club: () => go("home"), recargas: () => go("home"),
  movimientos: () => go("movs"), mis_pagos: () => go("pagos"), menu: () => go("menu"),
  pagar_servicios: () => { go("home"); push("services"); },
  parking: () => { go("home"); push("parking"); },
  donaciones: () => { go("home"); push("donate"); },
  enviar_fondos: () => { go("home"); push("send"); },
  escaner_qr: () => scanFromUI(),
};
const prep = (name) => async (p) => {
  const res = await callTool(name, p);
  if (res.status === "requires_confirmation") {
    const op = registerOp(name, res);
    driveApp();
    showOpInApp(op);
  }
  return JSON.stringify(res);
};
const clientTools = {
  get_balance: async () => JSON.stringify(await refreshBalance(true)),
  list_services: async (p) => JSON.stringify(await callTool("list_services", p)),
  explain_service: async (p) => JSON.stringify(await callTool("explain_service", p)),
  list_foundations: async () => JSON.stringify(await callTool("list_foundations")),
  prepare_payment: prep("prepare_payment"),
  prepare_parking: prep("prepare_parking"),
  prepare_donation: prep("prepare_donation"),
  prepare_transfer: prep("prepare_transfer"),
  scan_parking_qr: async () => {
    driveApp();
    const r = await startScan();
    if (!r) return JSON.stringify({ status: "denied", speech: "El usuario cerró el escáner sin leer el ticket." });
    return JSON.stringify(r.prep);
  },
  list_movements: async () => {
    driveApp(); go("movs");
    try { return JSON.stringify(await callTool("list_movements")); }
    catch { return JSON.stringify({ status: "ok", data: { movements: state.localMoves }, speech: state.localMoves.length ? `Tienes ${state.localMoves.length} movimientos en esta sesión.` : "Aún no tienes movimientos." }); }
  },
  get_operation_status: async (p) => JSON.stringify(await callTool("get_operation_status", p)),
  create_support_case: async (p) => { const r = await callTool("create_support_case", p); add("sys", `Caso abierto: ${r.data?.case_ref ?? ""}`); return JSON.stringify(r); },
  open_app_screen: async (p) => {
    const key = String(p?.screen_key ?? "");
    const nav = SCREEN_MAP[key];
    if (!nav) return JSON.stringify({ status: "denied", speech: "Esa pantalla no está disponible." });
    driveApp(); nav();
    return JSON.stringify({ status: "ok", data: { navigate: { screen_key: key } }, speech: "Listo, ya estás ahí." });
  },
  confirm_payment_in_app: async (p) => JSON.stringify(await confirmOp(p?.intent_id, "agent")),
};
function notifyAgent(text) { try { conv?.sendContextualUpdate(text); } catch {} }

function setLive(on) {
  live = on;
  app.classList.toggle("live", on);
  $("btnMic").setAttribute("aria-label", on ? "Terminar conversación de voz" : "Hablar con Wisi");
  if (on) { setStatus("Te escucho…", "live"); islandCaption("Wisi", "Te escucho…"); tickMeter(); }
  else {
    cancelAnimationFrame(meter);
    document.querySelector(".wisi-head .av").style.setProperty("--lvl", 1);
    setStatus(voiceEnabled ? "En línea" : "Modo chat", "ok");
    playFace("neutral");
  }
  paintIsland();
}
function tickMeter() {
  if (!live || !conv) return;
  let out = 0, inp = 0;
  try { out = conv.getOutputVolume?.() ?? 0; inp = conv.getInputVolume?.() ?? 0; } catch {}
  const v = Math.min(1, Math.max(out, inp * 0.8));
  document.querySelector(".wisi-head .av").style.setProperty("--lvl", (1 + v * 0.35).toFixed(3));
  $$("#bars i").forEach((b, i) => b.style.setProperty("--h", Math.max(0.15, Math.min(1, v * (0.6 + ((i * 37) % 5) / 6) * 1.6)).toFixed(2)));
  meter = requestAnimationFrame(tickMeter);
}
async function endConv() {
  const c = conv; conv = null; mode = null;
  try { await c?.endSession(); } catch {}
  setLive(false);
}
async function openConv(want) {
  if (conv && mode === want) return conv;
  if (starting) { await starting.catch(() => {}); if (conv && mode === want) return conv; }
  starting = (async () => {
    if (conv) await endConv();
    if (want === "voice" && !navigator.mediaDevices?.getUserMedia)
      throw new Error(location.protocol === "https:" || location.hostname === "localhost" ? "Tu navegador no permite el micrófono" : "El micrófono requiere HTTPS");
    const [SDK, s] = await Promise.all([loadSDK(), newSession(true)]);
    if (!s.signed_url) throw new Error("La voz no está disponible ahora mismo; usa el chat");
    const text = want === "text";
    skipGreeting = text;
    const c = await SDK.startSession({
      signedUrl: s.signed_url,
      clientTools,
      ...(text ? { textOnly: true, overrides: { conversation: { textOnly: true } } } : {}),
      onConnect: () => { if (!text) { setLive(true); haptic(); } },
      onDisconnect: () => { if (conv === c) { conv = null; mode = null; setLive(false); hideThinking(); } },
      onError: (m) => { if (!text) add("err", "Error de voz: " + (m?.message || m)); },
      onModeChange: ({ mode: m }) => {
        if (!live) return;
        setStatus(m === "speaking" ? "Wisi está hablando…" : "Te escucho…", "live");
        playFace(m === "speaking" ? "pensando" : "neutral");
      },
      onMessage: ({ message, source }) => {
        if (source === "user") { if (!text && message !== lastTyped) add("user", message); lastTyped = null; if (!text) showThinking(); return; }
        if (skipGreeting) { skipGreeting = false; return; }
        say(message);
      },
    });
    conv = c; mode = want;
    return c;
  })();
  try { return await starting; } finally { starting = null; }
}
async function startVoice() {
  if (live) return;
  const mic = $("btnMic");
  mic.classList.add("busy");
  setStatus("Conectando voz…");
  if (!wisiStarted) greet();
  showThinking(); thinkRow?.set("voice");
  try { await openConv("voice"); hideThinking(); }
  catch (e) {
    hideThinking();
    const msg = /Permission|NotAllowed|denied/i.test(String(e?.name || e?.message || e)) ? "Permite el acceso al micrófono para hablar con Wisi." : (e?.message || String(e));
    add("err", msg);
    setLive(false);
  } finally { mic.classList.remove("busy"); }
}

// --- enrutador local (sin agente) y atajos deterministas
const SERVICES = { luz: "corpoelec", corpoelec: "corpoelec", electricidad: "corpoelec", digitel: "digitel", movistar: "movistar", movilnet: "movilnet", cantv: "cantv", internet: "cantv", condominio: "condominio" };
const FOUND = { fundana: "fundana", senos: "senosayuda", alimentos: "banco_alimentos" };
const amountOf = (t) => { const m = t.match(/(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:bs|bol)/i) || t.match(/\b(\d+(?:[.,]\d{1,2})?)\b/); return m ? parseBs(m[1]) : null; };
const norm = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const isScan = (t) => /(escane|scan|qr|lee(r)? (el|mi) ticket|camara)/.test(t) && !/tck-?\w{3,}/.test(t);

async function scanFromChat() {
  say("¡Dale! Abro el escáner: apunta al QR de tu ticket.");
  driveApp();
  const r = await startScan();
  if (!r) return say("Cerré el escáner. Cuando quieras lo intentamos de nuevo.");
  say(r.prep.speech);
  notifyAgent(`El usuario escaneó el ticket ${r.ref} en la app. Intención ${r.prep.data.intent_id} por ${bs(r.prep.data.summary.amount_minor)}, pendiente de su confirmación con huella.`);
}
async function prepareLocal(name, params) {
  showThinking();
  const res = await callTool(name, params);
  say(res.speech);
  if (res.status === "requires_confirmation") { const op = registerOp(name, res); driveApp(); showOpInApp(op); }
}
async function handleLocal(text) {
  const t = norm(text);
  if (/saldo|cuanto tengo|balance/.test(t)) { showThinking(); const r = await refreshBalance(true); return say(r.speech); }
  if (/movimiento|historial|que he pagado/.test(t)) { driveApp(); go("movs"); showThinking(); const moves = await loadMovements(); return say(moves.length ? `Tienes ${moves.length} movimiento${moves.length > 1 ? "s" : ""}. El último: ${moves[0].title} por ${bs(Math.abs(moves[0].amount_minor))}.` : "Aún no tienes movimientos. ¿Escaneamos un ticket?"); }
  if (/estacionamiento|parking|ticket/.test(t)) {
    const m = text.match(/(TCK-?[a-z0-9]{3,12})/i);
    if (m) return prepareLocal("prepare_parking", { ticket_ref: ticketFromQR(m[1]).ref });
    return scanFromChat();
  }
  if (/don(a|ar|aci)/.test(t)) {
    const key = Object.keys(FOUND).find((k) => t.includes(k));
    if (!key && !/\d/.test(t)) { driveApp(); push("donate"); showThinking(); return say((await callTool("list_foundations")).speech + " ¿A cuál y cuánto?"); }
    return prepareLocal("prepare_donation", { foundation_ref: FOUND[key] || "fundana", amount_minor: amountOf(t) ?? 5000 });
  }
  if (/envi|transfer|mand/.test(t)) {
    const who = text.match(/@[\w.]+/)?.[0];
    const amt = amountOf(t);
    if (!who || !amt) return say("¿A quién y cuánto quieres enviar? Por ejemplo: «envía 100 Bs a @maria».");
    return prepareLocal("prepare_transfer", { recipient_ref: who, amount_minor: amt, kind: "p2p" });
  }
  const svc = Object.keys(SERVICES).find((k) => t.includes(k));
  if (svc) {
    const acct = text.match(/\b\d{4}[-\s]?\d{3,}\b/)?.[0];
    if (!acct) { driveApp(); push("pay", { service_ref: SERVICES[svc] }); return say("Te abrí el pago. ¿Cuál es el número de contrato o teléfono?"); }
    return prepareLocal("prepare_payment", { service_ref: SERVICES[svc], account_number: acct, amount_minor: /\d+\s*(bs|bol)/i.test(t) ? amountOf(t) : null });
  }
  if (/servicio|pagar|factura/.test(t)) { driveApp(); push("services"); showThinking(); return say((await callTool("list_services")).speech + " ¿Cuál pagamos?"); }
  if (/hola|buen|hey|epa/.test(t)) return say("¡Epa! ¿Qué hacemos hoy? Escaneo tu ticket, pago servicios, dono o envío fondos.");
  say("Puedo escanear tu ticket de estacionamiento, pagar servicios (luz, Digitel, Movistar, CANTV…), donar o enviar fondos. Toca el micrófono para hablar conmigo.");
}
async function ask(text) {
  text = text.trim();
  if (!text) return;
  if (!wisiStarted) greet();
  add("user", text);
  // El escaneo es una acción de la app: lo resolvemos aquí, siempre igual.
  if (isScan(norm(text))) return scanFromChat().catch(() => add("err", "No pude abrir el escáner."));
  if (voiceEnabled) {
    try {
      showThinking();
      const c = await openConv(mode === "voice" ? "voice" : "text");
      lastTyped = text;
      c.sendUserMessage(text);
      return;
    } catch { /* sin agente: resolvemos en local */ }
  }
  try { await handleLocal(text); }
  catch { hideThinking(); add("err", "No pude conectar con PagoDirecto. Revisa tu conexión e inténtalo de nuevo."); }
}

// ============================================================ eventos globales
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-go],[data-push],[data-wisi],[data-soon],[data-ask],[data-voice],[data-more],[data-close],[data-back]");
  if (!t) return;
  const inSheet = t.closest(".sheet-wrap");
  if (inSheet && !t.matches("[data-more]")) closeSheet(inSheet.id);
  if (t.dataset.back !== undefined) return stack.at(-1) === "scan" ? (stopScan(null), pop()) : pop();
  if (t.dataset.go) { if (wisiOpen) closeWisi(); return go(t.dataset.go); }
  if (t.dataset.push) {
    if (wisiOpen) closeWisi();
    if (t.dataset.push === "scan") return scanFromUI();
    return push(t.dataset.push);
  }
  if (t.dataset.wisi !== undefined) return openWisi();
  if (t.dataset.soon) return toast(`${t.dataset.soon} no está en esta demo. Prueba Estacionamiento, Servicios, Donaciones o Enviar.`);
  if (t.dataset.ask) { openWisi(); return ask(t.dataset.ask); }
  if (t.dataset.voice !== undefined) { openWisi(); return startVoice(); }
  if (t.dataset.more !== undefined) return openSheet("more", $("more").querySelector("button"));
});
$("more").addEventListener("click", (e) => { if (e.target === $("more")) closeSheet("more"); });
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if ($("more").classList.contains("on")) return closeSheet("more");
  if (wisiOpen) return closeWisi();
  if (stack.length) { if (stack.at(-1) === "scan") stopScan(null); pop(); }
});
for (const b of $$(".js-eye")) b.addEventListener("click", (e) => { e.stopPropagation(); state.hidden = !state.hidden; store.set("pd.hide", state.hidden ? "1" : "0"); haptic(6); paintEye(); });

function paintVoice() { for (const b of $$("[data-voicesel] button")) b.setAttribute("aria-pressed", String(b.dataset.v === voice)); }
for (const g of $$("[data-voicesel]")) g.addEventListener("click", async (e) => {
  const v = e.target.closest("button")?.dataset.v;
  if (!v || v === voice) return;
  voice = v; store.set("wisi.voice", v); paintVoice(); haptic(6);
  const who = v === "female" ? "Clari" : "Miguel";
  if (live) { await endConv(); add("sys", `Cambiando a la voz de ${who}…`); startVoice(); }
  else { if (conv) await endConv(); toast(`Voz de ${who} seleccionada`); }
});
$("btnMic").addEventListener("click", () => (live ? endConv() : startVoice()));
$("dock").addEventListener("submit", (e) => { e.preventDefault(); const t = $("text").value; $("text").value = ""; $("compose").classList.remove("has"); ask(t); });
$("text").addEventListener("input", () => $("compose").classList.toggle("has", $("text").value.trim().length > 0));
$("chips").addEventListener("click", (e) => { const s = e.target.closest(".chip")?.dataset.say; if (s) { haptic(6); ask(s); } });
$("btnReset").addEventListener("click", async () => { await endConv(); islandPinned = false; ops.clear(); greet(); paintIsland(); });
$("btnResetDemo").addEventListener("click", async () => {
  await endConv();
  newPrincipal(); token = null;
  ops.clear(); state.localMoves = []; islandPinned = false; tkCtx = null;
  greet(); wisiStarted = false; paintIsland(); parkStep(0);
  try { await newSession(false); await refreshBalance(true); toast(`Demo reiniciada: ${bs(state.balance)}`); }
  catch { toast("Sin conexión con PagoDirecto"); }
  go("home");
});
addEventListener("online", () => setStatus(voiceEnabled ? "En línea" : "Modo chat", "ok"));
addEventListener("offline", () => { setStatus("Sin conexión", "err"); toast("Sin conexión a internet"); });
document.addEventListener("visibilitychange", () => { if (document.hidden) { if (live) endConv(); if (scan) { stopScan(null); if (stack.at(-1) === "scan") pop(); } } });

// ============================================================ arranque
paintVoice(); paintEye(); demoTicketGrid();
for (const s of $$(".screen")) if (!s.classList.contains("on")) s.inert = true;
$("wisi").inert = true;
addEventListener("load", () => {
  for (const el of $$(".js-face")) setFace(el, "neutral");
});
(async () => {
  try {
    await newSession(false);
    const [, svc, fnd] = await Promise.all([refreshBalance(), callTool("list_services"), callTool("list_foundations")]);
    state.services = svc.data?.services ?? [];
    state.foundations = fnd.data?.foundations ?? [];
    paintHomeServices(); paintServiceGrid(); paintFoundations();
    setStatus(voiceEnabled ? "En línea" : "Modo chat", "ok");
    loadSDK().catch(() => {});
  } catch {
    setStatus("Sin conexión con PagoDirecto", "err");
    for (const el of $$(".js-bal")) el.textContent = "Sin conexión";
    toast("No pudimos conectar con PagoDirecto. Recarga para reintentar.", 6000);
  }
})();
