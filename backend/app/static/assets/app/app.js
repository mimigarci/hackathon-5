// PagoDirecto + Wisi — webapp demo.
// Réplica navegable de la app con saldo simulado y el agente de voz integrado:
// Wisi conduce la app (navega, rellena, escanea QR) y la app confirma el dinero
// con la hoja biométrica. El modelo nunca ejecuta pagos: solo prepara intenciones.

import { installFeatures } from "./features.js?v=15";

const GW = location.origin;
const $ = (id) => document.getElementById(id);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const app = $("app");

// ============================================================ utilidades
// Sin login: todo lo del usuario vive en cookies (1 año, compartidas entre
// botflow.lat y www). localStorage queda de respaldo y para migrar datos viejos.
const COOKIE_SCOPE = (/(^|\.)botflow\.lat$/.test(location.hostname) ? "; Domain=.botflow.lat" : "") + (location.protocol === "https:" ? "; Secure" : "");
const store = {
  get(k, d) {
    const m = document.cookie.match(new RegExp("(?:^|; )" + k.replace(/\./g, "\\.") + "=([^;]*)"));
    if (m) { try { return decodeURIComponent(m[1]); } catch {} }
    try { const v = localStorage.getItem(k); if (v != null) { this.set(k, v); return v; } } catch {}
    return d;
  },
  set(k, v) {
    document.cookie = `${k}=${encodeURIComponent(v)}; Max-Age=31536000; Path=/; SameSite=Lax${COOKIE_SCOPE}`;
    try { localStorage.setItem(k, v); } catch {}
  },
  del(k) {
    document.cookie = `${k}=; Max-Age=0; Path=/; SameSite=Lax${COOKIE_SCOPE}`;
    try { localStorage.removeItem(k); } catch {}
  },
};
const storeJSON = {
  get(k, d) { try { return JSON.parse(store.get(k, null)) ?? d; } catch { return d; } },
  set(k, v) { store.set(k, JSON.stringify(v)); },
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
  credit: ["Revisando tu historial", "Consultando aliados", "Cuadrando cuotas", "Midiendo tu línea", "Buscando ofertas para ti"],
  mic: ["Esperando permiso del micrófono"],
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
  credit: null,
  resume: null,        // operación a retomar tras recargar por saldo insuficiente
};
const LOGOS = Object.fromEntries(["digitel", "movistar", "movilnet", "corpoelec", "cantv", "simpletv", "inter", "thundernet", "tugruero", "dlm", "starmoviles", "fibex"].map((r) => [r, `/assets/pd/logos/${r}.png`]));
LOGOS.globalsystem = "/assets/pd/svc/global_gps.png";
LOGOS.jomi = "/assets/pd/svc/jomi_wordmark.png";
const MY_SERVICES = ["digitel", "movilnet", "movistar", "corpoelec", "cantv"]; // «Mis pagos» de la cuenta demo
const myServices = () => state.services.filter((s) => MY_SERVICES.includes(s.service_ref));
const logoOf = (ref) => LOGOS[ref] ?? null;
const openService = (ref) => (ref === "jomi" || ref === "tugruero" ? push(ref) : push("pay", { service_ref: ref }));
const CAT = { telefonia: "Telefonía", electricidad: "Electricidad", internet: "Internet y teléfono", tv: "Televisión", asistencia: "Asistencia", hogar: "Hogar", condominio: "Condominio" };
const LOW_BALANCE_MINOR = 500_00;

function setBalance(minor, flash = false) {
  if (minor == null) return;
  state.balance = minor;
  store.set("pd.bal", String(minor));
  $("lowBal").hidden = minor > LOW_BALANCE_MINOR;
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

async function fetchRetry(url, opts, tries = 3) {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(url, opts);
      if (r.status < 500 || i >= tries - 1) return r;
    } catch (e) { if (i >= tries - 1) throw e; }
    await sleep(500 * 2 ** i);
  }
}
async function newSession(signed = true, webrtc = false) {
  const q = `principal=${encodeURIComponent(principal)}&voice=${voice}&signed=${signed}&webrtc=${webrtc}`;
  const r = await fetchRetry(`${GW}/api/session?${q}`, { method: "POST" });
  if (!r.ok) throw new Error("session " + r.status);
  const s = await r.json();
  token = s.session_token;
  voiceEnabled = !!s.voice_enabled;
  return s;
}
async function api(path, { body, method = "POST", retried = false } = {}) {
  if (!token) await newSession(false);
  const r = await fetchRetry(`${GW}${path}`, {
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
// El servidor es la única fuente de saldo y movimientos: siempre cuadran entre sí.
async function loadMovements() {
  const r = await callTool("list_movements");
  if (r.data?.balance_minor != null) setBalance(r.data.balance_minor);
  return r.data?.movements ?? [];
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
  for (const s of myServices()) {
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
const KIND_ICON = { donation: "#i-heart", credit: "#i-bank", credit_payment: "#i-bank", insurance: "#i-shield", tickets: "#i-ticket", welcome: "#i-bank", tow_plan: "#i-car", credit_offer: "#i-credit" };
const KIND_IMG = { payment: "services_icon", parking: "parking_icon", parking_meter: "parking_meter_icon", transfer: "transfers_icon", topup: "recharge_icon" };
let movFilter = "all";
function moveRow(m) {
  const d = document.createElement("div");
  d.className = "item";
  const neg = m.amount_minor < 0;
  const icon = KIND_IMG[m.kind] ? `<span class="ic mv"><img src="/assets/pd/mov/${KIND_IMG[m.kind]}.png" alt="" /></span>` : `<span class="ic"><svg><use href="${KIND_ICON[m.kind] || "#i-receipt"}"/></svg></span>`;
  d.innerHTML = `${icon}<span class="tx"><b></b><small></small></span><span class="amt num"></span>`;
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
        list.innerHTML = `<div class="empty"><b>${movFilter === "in" ? "Aún no tienes ingresos" : "Aún no tienes movimientos"}</b>Cuando pagues algo con tu saldo de demo aparecerá aquí.</div>`;
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
    const pending = myServices().filter((s) => !paidNames.has(s.name));
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
      const sched = storeJSON.get("pd.scheduled", []);
      $("payTotalLbl").textContent = "Total programado";
      $("payTotal").textContent = bs(sched.reduce((a, x) => a + x.amount_minor, 0));
      $("payTotalSub").textContent = sched.length ? `${sched.length} pago${sched.length > 1 ? "s" : ""} programado${sched.length > 1 ? "s" : ""}` : "Sin pagos programados";
      list.replaceChildren(...sched.map((x, i) => {
        const d = document.createElement("div"); d.className = "item";
        const src = logoOf(x.service_ref);
        d.innerHTML = `<span class="ic ${src ? "logo" : ""}">${src ? `<img src="${src}" alt="" />` : '<svg><use href="#i-receipt"/></svg>'}</span><span class="tx"><b></b><small></small></span><span class="amt num"></span>`;
        d.querySelector("b").textContent = x.name;
        d.querySelector("small").textContent = `${x.date} · ${x.account}`;
        d.querySelector(".amt").textContent = bs(x.amount_minor);
        d.onclick = () => { if (confirm("¿Quitar este pago programado?")) { const l = storeJSON.get("pd.scheduled", []); l.splice(i, 1); storeJSON.set("pd.scheduled", l); SCREENS.pagos.enter(); } };
        return d;
      }));
      const add = document.createElement("button"); add.type = "button"; add.className = "btn btn-ghost btn-block"; add.textContent = "+ Programar nuevo pago"; add.onclick = () => push("schedule");
      list.append(add);
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
  $("svcGrid").replaceChildren(...state.services.filter((s) => s.service_ref !== "condominio").map((s) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "logo-card"; b.setAttribute("aria-label", s.name);
    const src = logoOf(s.service_ref);
    b.innerHTML = src ? `<img src="${src}" alt="" />` : `<span style="font-weight:600;font-size:17px">${s.name}</span>`;
    b.onclick = () => openService(s.service_ref);
    return b;
  }));
}
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

// ============================================================ Credirecto (créditos simulados)
// Contrato del backend: docs/creditos-contrato.md. La app solo muestra lo que decide el
// motor del Worker (con su motivo); el dinero se mueve únicamente con la hoja de huella.
const credit = { status: null, failed: false, offers: [], summary: null, scanning: null, offer: null, n: null, quote: null, quoting: false, bound: null, seq: 0 };
const PISOS = { 1: ["Día a día", "Con Pago Directo"], 2: ["Viajes", "Con inicial y tope"], 3: ["Carro y casa", "Con banco aliado"] };
const PILL = { disponible: ["d", "Disponible"], precalificado: ["p", "Precalificado"], por_desbloquear: ["u", "Por desbloquear"] };
const FREQ = { semanal: "semanales", quincenal: "quincenales", mensual: "mensuales" };
/** Crea un elemento con texto plano (nunca innerHTML con datos de la API). */
const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const money = (minor, cur) => (cur === "USD" ? "US$ " : "Bs ") + fmt.format(Number(minor || 0) / 100);
function crDate(v) {
  let d;
  if (typeof v === "number") d = new Date(v < 1e12 ? v * 1000 : v);
  else { const m = String(v ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/); d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(v); } // sin desfase de zona
  return d && !isNaN(d) ? d.toLocaleDateString("es-VE", { day: "numeric", month: "short" }) : String(v ?? "—");
}
function paintPill(el, st) { const [c, t] = PILL[st] || ["u", st || "—"]; el.className = "cr-pill " + c; el.textContent = t; }
function sumList(rows) {
  const dl = mk("dl", "cr-sum");
  for (const [a, b, c] of rows) { const d = mk("div", c); d.append(mk("dt", null, a), mk("dd", "num", b)); dl.append(d); }
  return dl;
}

// --- estado de la línea y planes
function paintCredit() {
  const s = credit.status, d = s?.lines?.cotidiano, t = s?.lines?.turismo;
  $("crLevel").textContent = s?.level ? `Nivel ${s.level}` : "Nivel —";
  const line = (l, a, b, c) => {
    $(a).textContent = l ? bs(l.available_minor) : "—";
    $(c).textContent = l ? `de ${bs(l.limit_minor)}` : "";
    $(b).style.setProperty("--w", l && l.limit_minor > 0 ? `${Math.max(0, Math.min(100, (l.available_minor / l.limit_minor) * 100))}%` : "0%");
  };
  line(d, "crDaily", "crDailyBar", "crDailyOf"); line(t, "crTrip", "crTripBar", "crTripOf");
  for (const [sel, l] of [[".js-cr-t1", d], [".js-cr-t2", t]]) for (const el of $$(sel)) el.textContent = l ? `${bs(l.available_minor)} disp.` : "—";
  const n = s?.next_installment, box = $("crNext");
  box.replaceChildren();
  if (!s) box.textContent = credit.failed ? "No pudimos consultar tu línea. Revisa tu conexión." : "Consultando tu línea…";
  else if (!n) box.textContent = "No tienes cuotas pendientes.";
  else box.append("Próxima cuota: ", mk("b", null, `${bs(n.amount_minor)} · ${crDate(n.due_date)}`), ` · ${n.title ?? ""}`);
  paintPlans();
}
function paintPlans() {
  const host = $("crPlans"), plans = credit.status?.plans ?? [];
  if (!plans.length) {
    const e = mk("div", "empty");
    e.append(mk("b", null, "Aún no tienes planes activos"), "Cuando uses Credirecto, tus cuotas aparecen aquí.");
    return host.replaceChildren(e);
  }
  host.replaceChildren(...plans.map((p) => {
    const a = mk("article", "cr-plan"), h = mk("header");
    h.append(mk("b", null, p.title), mk("small", null, `${p.partner} · Financiado ${bs(p.financed_minor)}`));
    const ul = mk("ul", "cr-inst");
    ul.setAttribute("aria-label", `Cuotas de ${p.title}`);
    for (const i of p.installments ?? []) {
      const li = mk("li", i.paid ? "paid" : "");
      li.append(mk("span", "n", String(i.n)), mk("span", null, crDate(i.due_date)), mk("span", "num", bs(i.amount_minor)), mk("em", null, i.paid ? "Pagada" : "Pendiente"));
      ul.append(li);
    }
    a.append(h, ul);
    return a;
  }));
}
async function refreshCredit() {
  try {
    const r = await callTool("get_credit_status");
    if (r.status === "ok" && r.data) { credit.status = r.data; credit.failed = false; } else credit.failed = !credit.status;
    paintCredit();
    return r;
  } catch {
    credit.failed = !credit.status; paintCredit();
    return { status: "error", speech: "No pude consultar tu línea de crédito." };
  }
}

// --- escaneo y ofertas
function offerCard(o) {
  const b = mk("button", "cr-offer");
  b.type = "button";
  const top = mk("span", "top"), pill = mk("span", "cr-pill");
  paintPill(pill, o.status);
  top.append(mk("span", "cr-partner", o.partner), pill);
  b.append(top, mk("b", "title", o.title), mk("span", "price num", money(o.price_minor, o.currency)), mk("span", "why", o.reason));
  b.onclick = () => push("croffer", { offer_id: o.offer_id });
  return b;
}
function paintOffers() {
  const host = $("crResults"), offers = credit.offers;
  host.removeAttribute("aria-busy");
  if (!offers.length) {
    const e = mk("div", "empty");
    e.append(mk("b", null, "Escanea para ver tus créditos"), "Revisamos tu historial y a los aliados, y te mostramos qué puedes financiar.");
    return host.replaceChildren(e);
  }
  const sm = credit.summary, parts = [];
  if (sm) parts.push(mk("p", "cr-sum-line", `${sm.disponible ?? 0} disponibles · ${sm.precalificado ?? 0} precalificadas · ${sm.por_desbloquear ?? 0} por desbloquear`));
  for (const piso of [1, 2, 3]) {
    const list = offers.filter((o) => o.piso === piso);
    if (!list.length) continue;
    const g = mk("section", "cr-group"), h = mk("h2", null, PISOS[piso][0]), box = mk("div", "cr-list");
    g.dataset.piso = piso;
    h.append(mk("small", null, PISOS[piso][1]));
    box.append(...list.map(offerCard));
    g.append(h, box);
    parts.push(g);
  }
  host.replaceChildren(...parts);
}
async function fetchOffers({ paint = true } = {}) {
  const res = await callTool("scan_credit_offers");
  if (res.status === "ok" && Array.isArray(res.data?.offers)) {
    credit.offers = res.data.offers; credit.summary = res.data.summary || null;
    if (paint && !credit.scanning) paintOffers();
  }
  return res;
}
const ensureOffers = async () => { if (!credit.offers.length) await fetchOffers(); };
/** Muestra el loader, consulta al motor y pinta las ofertas por piso. Devuelve la respuesta. */
function scanCredit() {
  if (credit.scanning) return credit.scanning;
  const btn = $("crScan"), host = $("crResults");
  btn.classList.add("loading"); btn.setAttribute("aria-busy", "true");
  const t = makeThink("credit", { dark: true });
  const wrap = mk("div", "cr-loading");
  wrap.append(t.el);
  host.replaceChildren(wrap); host.setAttribute("aria-busy", "true");
  credit.scanning = (async () => {
    let res;
    try { [res] = await Promise.all([fetchOffers({ paint: false }), sleep(reduced ? 0 : 1400)]); }
    catch { res = { status: "error", speech: "No pude escanear tus créditos ahora. Inténtalo otra vez." }; }
    t.stop(); credit.scanning = null;
    btn.classList.remove("loading"); btn.removeAttribute("aria-busy");
    paintOffers();
    if (res.status !== "ok") toast(res.speech || "No pudimos escanear tus créditos. Inténtalo otra vez.");
    return res;
  })();
  return credit.scanning;
}
SCREENS.crscan = {
  enter() { paintCredit(); if (!credit.scanning) paintOffers(); refreshCredit(); },
};
$("crScan").addEventListener("click", () => { haptic(10); scanCredit(); });
// «Créditos para ti» del Home: data-crpiso="0" escanea todo; 1, 2 y 3 bajan a su grupo.
document.addEventListener("click", async (e) => {
  const t = e.target.closest("[data-crpiso]");
  if (!t) return;
  haptic(6);
  if (wisiOpen) closeWisi();
  push("crscan");
  if (!credit.offers.length) await scanCredit();
  const g = $("crResults").querySelector(`.cr-group[data-piso="${t.dataset.crpiso}"]`);
  g?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
});

// --- detalle de la oferta: cuotas, cotización y CTA
const optLabel = (o, n) => (o.piso === 3 ? `${n} meses` : `${n} ${n === 1 ? "cuota" : "cuotas"}`);
function paintOpts(o, opts) {
  $("coOpts").replaceChildren(...opts.map((n) => {
    const b = mk("button", "cr-opt", optLabel(o, n));
    b.type = "button"; b.dataset.n = n;
    b.setAttribute("role", "radio"); b.setAttribute("aria-checked", String(n === credit.n));
    b.onclick = () => pickInstallments(n);
    return b;
  }));
  $("coFreq").textContent = FREQ[o.frequency] ? `Cuotas ${FREQ[o.frequency]}` : "";
}
function pickInstallments(n) {
  if (n === credit.n) return;
  credit.n = n; haptic(6);
  for (const b of $$(".cr-opt", $("coOpts"))) b.setAttribute("aria-checked", String(Number(b.dataset.n) === n));
  requote();
}
function paintQuote(q) {
  const cur = q.currency || credit.offer?.currency, parts = [], inst = q.installments ?? [];
  if (q.eligible === false) {
    parts.push(mk("p", "bad", q.reason || "Todavía no cumples los requisitos de esta oferta."));
  } else {
    const rows = [["Inicial hoy", money(q.down_payment_minor, cur)], ["Financiado", money(q.financed_minor, cur)]];
    if (inst.length > 12) rows.push(["Cuota estimada", `${money(inst[0].amount_minor, cur)} al mes`]); // plazos largos: sin tabla
    rows.push(["Intereses", q.interest_minor ? money(q.interest_minor, cur) : "Sin intereses (demo)"], ["Total", money(q.total_minor, cur), "tot"]);
    parts.push(sumList(rows));
    if (inst.length && inst.length <= 12) {
      const tb = mk("table", "cr-table"), cap = mk("caption", null, "Tus cuotas"), hd = mk("thead"), hr = mk("tr"), body = mk("tbody");
      for (const c of ["N.º", "Fecha", "Monto"]) { const th = mk("th", null, c); th.scope = "col"; hr.append(th); }
      hd.append(hr);
      for (const c of inst) { const tr = mk("tr"); tr.append(mk("td", "num", String(c.n)), mk("td", null, crDate(c.due_date)), mk("td", "num", money(c.amount_minor, cur))); body.append(tr); }
      tb.append(cap, hd, body);
      parts.push(tb);
    }
  }
  $("coQuote").replaceChildren(...parts);
}
async function requote() {
  const o = credit.offer, n = credit.n, box = $("coQuote"), my = ++credit.seq;
  credit.quote = null; credit.quoting = true; paintCreditCta();
  box.replaceChildren(mk("p", "wait", "Calculando tus cuotas…"));
  try {
    const r = await callTool("quote_credit", { offer_id: o.offer_id, installments: n });
    if (my !== credit.seq) return;
    if (r.status === "ok" && r.data) { credit.quote = r.data; paintQuote(r.data); }
    else box.replaceChildren(mk("p", "bad", r.speech || r.error?.message || "No pudimos calcular las cuotas."));
  } catch {
    if (my !== credit.seq) return;
    box.replaceChildren(mk("p", "bad", "No pudimos calcular las cuotas. Revisa tu conexión."));
  }
  credit.quoting = false; paintCreditCta();
}
function paintCreditCta() {
  const o = credit.offer, go = $("coGo"), why = $("coWhy");
  if (!o) return;
  go.classList.remove("loading");
  if (o.next_step === "subir_nivel") {
    go.disabled = true; go.textContent = "Aún no disponible";
    why.textContent = o.reason || "Todavía no cumples los requisitos de esta oferta.";
    return;
  }
  const no = credit.quote?.eligible === false;
  go.disabled = no || credit.quoting;
  go.textContent = o.next_step === "precalificar" ? "Precalificar con el banco" : "Usar Credirecto";
  why.textContent = no ? credit.quote.reason || "Todavía no cumples los requisitos." : o.next_step === "precalificar" ? "Pago Directo no presta: arma tu solicitud para el banco aliado." : "Confirmas con tu huella. La inicial, si hay, sale de tu Wallet.";
}
SCREENS.croffer = {
  async enter(p = {}) {
    credit.bound = p.intent_id ? { intent_id: p.intent_id, offer_id: p.offer_id, n: p.installments } : null;
    let o = credit.offers.find((x) => x.offer_id === p.offer_id);
    if (!o) { try { await ensureOffers(); } catch {} o = credit.offers.find((x) => x.offer_id === p.offer_id); }
    if (!o) { toast("No encontré esa oferta."); if (stack.at(-1) === "croffer") pop(); return; }
    credit.offer = o; credit.quote = null; credit.quoting = false; credit.seq++;
    $("coPrecal").hidden = true; $("coPrecal").replaceChildren();
    paintPill($("coPill"), o.status);
    $("coPartner").textContent = o.funder ? `${o.partner} · Presta ${o.funder}` : o.partner;
    $("coTitle").textContent = o.title;
    $("coDetail").textContent = o.detail || "";
    $("coPrice").textContent = money(o.price_minor, o.currency);
    $("coReason").textContent = o.reason || "";
    $("coOptsLbl").textContent = o.piso === 3 ? "¿A cuántos meses?" : "¿En cuántas cuotas?";
    const opts = Array.isArray(o.installments_options) ? o.installments_options : [];
    const canQuote = o.next_step !== "subir_nivel" && opts.length > 0;
    $("coPlanSec").hidden = !canQuote;
    credit.n = opts.includes(p.installments) ? p.installments : opts[0] ?? null;
    paintOpts(o, opts);
    $("coQuote").replaceChildren();
    $("s-croffer").querySelector(".scroll").scrollTop = 0;
    paintCreditCta();
    if (canQuote) requote();
  },
};
function paintPrecal(d) {
  const host = $("coPrecal"), name = (x) => (typeof x === "string" ? x : x?.name ?? x?.bank ?? x?.label ?? "");
  const box = mk("div", "cr-precal"), h = mk("h3", null, "Tu precalificación");
  h.tabIndex = -1;
  const banks = (d.bank_options ?? []).map(name).filter(Boolean), docs = (d.documents ?? []).map(name).filter(Boolean);
  const rows = [];
  if (d.request_ref) rows.push(["Solicitud", d.request_ref]);
  rows.push([banks.length > 1 ? "Bancos aliados" : "Banco aliado", banks.join(" o ") || "—"]);
  if (d.estimated?.down_payment_pct != null) rows.push(["Inicial estimada", `${d.estimated.down_payment_pct} %`]);
  if (d.estimated?.term_months != null) rows.push(["Plazo estimado", `${d.estimated.term_months} meses`]);
  box.append(h, sumList(rows));
  if (docs.length) {
    const ul = mk("ul");
    ul.append(...docs.map((x) => mk("li", null, x)));
    box.append(mk("p", "aviso", "Documentos que te pedirán:"), ul);
  }
  box.append(mk("p", "aviso", "Simulación: no se envió nada a ningún banco. Los montos y plazos son referenciales."));
  host.replaceChildren(box); host.hidden = false;
  h.focus({ preventScroll: true });
  host.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
}
$("coGo").addEventListener("click", async () => {
  const o = credit.offer, btn = $("coGo");
  if (!o || btn.disabled || btn.classList.contains("loading")) return;
  if (o.next_step === "usar") {
    const b = credit.bound;
    if (b && b.offer_id === o.offer_id && b.n === credit.n) return confirmOp(b.intent_id, "ui");
    // prepare_credit_offer -> registerOp -> hoja de huella (runPrepare hace los tres pasos)
    return runPrepare("prepare_credit_offer", { offer_id: o.offer_id, installments: credit.n }, btn);
  }
  if (o.next_step === "precalificar") {
    btn.classList.add("loading");
    try {
      const r = await callTool("precalify_credit", { offer_id: o.offer_id });
      if (r.status === "ok" && r.data) paintPrecal(r.data);
      else toast(r.speech || r.error?.message || "No pudimos precalificarte ahora.");
    } catch { toast("Sin conexión con PagoDirecto. Inténtalo de nuevo."); }
    finally { btn.classList.remove("loading"); }
  }
});
/** Tras confirmar un crédito: las ofertas cambian (usas línea), así que se vuelven a consultar. */
function creditUsed() { credit.offers = []; credit.summary = null; paintOffers(); refreshCredit(); }

// --- éxito
const DONE = {
  payment: (s) => ["Pago realizado", `Pago ${s.service ?? "de servicio"}`],
  parking: (s) => ["Ticket pagado", `Estacionamiento · ${s.ticket_ref ?? ""}. Ya puedes salir.`],
  donation: (s) => ["¡Gracias por donar!", `Donación a ${s.foundation ?? ""}`],
  transfer: (s) => ["Envío realizado", `Enviado a ${s.recipient_ref ?? ""}`],
  topup: (s) => ["Recarga exitosa", `${s.method ?? "Wallet"} · +50 pts del Club`],
  credit_offer: (s) => ["Credirecto activado", `${s.title ?? "Tu crédito"} · ${s.installments ?? ""} ${s.installments === 1 ? "cuota" : "cuotas"}. Inicial hoy: ${bs(s.amount_minor ?? 0)}.`],
  credit: (s) => ["Crédito en tu wallet", `Credirecto · ${s.installments ?? 4} cuotas de ${bs(s.installment_minor ?? 0)}`],
  credit_payment: () => ["Abono realizado", "Credirecto"],
  parking_meter: (s) => ["Parquímetro activo", `${s.product ?? ""} · ${s.quantity ?? 1} h · ${s.plate ?? ""}`],
  insurance: (s) => ["Póliza activa", s.product ?? ""],
  tickets: (s) => ["Boletos comprados", `${s.product ?? ""} × ${s.quantity ?? 1}`],
  tow_plan: (s) => ["Plan activo", `TuGruero · ${s.product ?? ""}`],
};
function showDone(op, res) {
  const [title, what] = (DONE[op.kind] || (() => ["¡Listo!", ""]))(op.s);
  $("doneTitle").textContent = title;
  const big = op.kind === "credit_offer" ? op.s.financed_minor : op.s.amount_minor; // en crédito se destaca lo financiado
  $("doneAmt").textContent = big != null ? bs(big) : "";
  $("doneWhat").textContent = what;
  const rows = [["Referencia", res.data?.operation_ref ?? "—"], ["Fecha", new Date().toLocaleString("es-VE", { dateStyle: "medium", timeStyle: "short" })], ["Comisión", bs(0)], ["Nuevo saldo", bs(res.data?.balance_minor ?? state.balance)]];
  $("doneList").replaceChildren(...rows.map(([a, b]) => { const d = document.createElement("div"); d.innerHTML = "<dt></dt><dd class='num'></dd>"; d.children[0].textContent = a; d.children[1].textContent = b; return d; }));
  if (op.kind === "parking" && tkCtx) { tkCtx.paid = true; parkStep(3); }
  const resume = state.resume && ops.get(state.resume);
  const canResume = resume && (op.kind === "topup" || op.kind === "credit") && resume.state === "pending";
  $("doneOk").textContent = canResume ? `Continuar: ${resume.k.t(resume.s)}` : "Volver al inicio";
  if (!canResume) state.resume = null;
  replace("done");
  setTimeout(() => $("doneTitle").focus({ preventScroll: true }), 500);
}
$("doneOk").addEventListener("click", () => {
  const id = state.resume; state.resume = null;
  if (id && ops.get(id)?.state === "pending") return confirmOp(id, "ui");
  go("home");
});

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
      const op = registerOp("prepare_parking", prep, { ticket_ref: ref });
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
const QTY_LABEL = (s) => (s.section === "tugruero" ? `Plan por ${s.unit ?? "mes"}` : s.unit === "hora" ? `${s.quantity ?? 1} h${s.plate ? ` · ${s.plate}` : ""}` : s.unit === "boleto" ? `${s.quantity ?? 1} boleto(s)` : "1 mes");
const PURCHASE_KIND = { parquimetros: "parking_meter", seguros: "insurance", boleteria: "tickets", tugruero: "tow_plan" };
const PURCHASE_NAME = { parking_meter: "Parquímetro", insurance: "Seguro", tickets: "Boletería", tow_plan: "TuGruero" };
const KIND = {
  prepare_payment: { kind: "payment", t: (s) => `Pago ${s.service ?? "servicio"}`, sub: (s) => (s.account_number ? `Cuenta ${s.account_number}` : "") },
  prepare_parking: { kind: "parking", t: () => "Estacionamiento", sub: (s) => `Ticket ${s.ticket_ref ?? ""}` },
  prepare_donation: { kind: "donation", t: (s) => `Donación a ${s.foundation ?? ""}`, sub: () => "Aporte solidario" },
  prepare_transfer: { kind: "transfer", t: (s) => `Envío a ${s.recipient_ref ?? ""}`, sub: () => "Wallet a wallet" },
  prepare_topup: { kind: "topup", t: (s) => `Recarga · ${s.method ?? "Wallet"}`, sub: () => "Llega al instante a tu wallet" },
  prepare_credit_offer: { kind: "credit_offer", ic: "#i-credit", t: (s) => `Credirecto · ${s.title ?? "crédito"}`, sub: (s) => `Financias ${bs(s.financed_minor)} en ${s.installments ?? "—"} ${s.installments === 1 ? "cuota" : "cuotas"}` },
  prepare_credit: { kind: "credit", t: () => "Credirecto a tu wallet", sub: (s) => `${s.installments ?? 4} cuotas de ${bs(s.installment_minor ?? 0)}` },
  prepare_credit_payment: { kind: "credit_payment", t: () => "Abono a Credirecto", sub: () => "Desde tu wallet" },
  prepare_purchase: { t: (s) => `${PURCHASE_NAME[PURCHASE_KIND[s.section]] ?? "Compra"} · ${s.product ?? ""}`, sub: QTY_LABEL },
};
const SUMS_TO_WALLET = new Set(["topup", "credit"]); // no necesitan saldo
/** Registra lo que Wisi o la UI prepararon. La confirmación vive en la app, no en el chat. */
function registerOp(tool, res, params = null) {
  const id = res.data?.intent_id;
  if (!id) return null;
  if (ops.has(id)) return ops.get(id);
  const k = KIND[tool] || { kind: "other", t: () => "Operación", sub: () => "" };
  const s = res.data.summary || {};
  const op = { id, s, k, kind: k.kind ?? PURCHASE_KIND[s.section] ?? "other", state: "pending", tool, params, t: Date.now() };
  ops.set(id, op);
  hideThinking();
  return op;
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
    case "credit_offer":
      if (!stack.includes("crscan")) push("crscan");
      push("croffer", { offer_id: s.offer_id, installments: s.installments, intent_id: op.id });
      break;
    case "topup":
      push("deposit", { method: op.params?.method ?? "pago_movil", amount_minor: s.amount_minor, intent_id: op.id });
      break;
    case "credit":
      push("credit", { amount_minor: s.amount_minor, intent_id: op.id });
      break;
    case "parking_meter":
      push("meter", { product_ref: s.product_ref, quantity: s.quantity, plate: s.plate, intent_id: op.id });
      break;
    case "insurance":
      push("insurance", { product_ref: s.product_ref, intent_id: op.id });
      break;
    case "tickets":
      push("tickets", { product_ref: s.product_ref, quantity: s.quantity, intent_id: op.id });
      break;
    case "tow_plan":
      push("tugruero", { product_ref: s.product_ref, intent_id: op.id });
      break;
    default:
      push("review", op);
  }
}
async function runPrepare(tool, params, btn) {
  btn?.classList.add("loading");
  try {
    const res = await callTool(tool, params);
    if (res.status !== "requires_confirmation") { toast(res.speech || "No se pudo preparar la operación"); return null; }
    const op = registerOp(tool, res, params);
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
/** Saldo insuficiente: propone recargar lo justo (o Credirecto) y retoma el pago al terminar. */
function paintShort(op, missing, close) {
  const box = $("cfShort");
  box.hidden = !missing;
  if (!missing) return box.replaceChildren();
  const topup = Math.max(100_00, Math.ceil(missing / 100_00) * 100_00);
  const leave = (name, params) => () => { state.resume = op.id; close("away"); push(name, params); };
  const mk = (cls, label, onclick) => { const b = document.createElement("button"); b.type = "button"; b.className = `btn ${cls}`; b.textContent = label; b.onclick = onclick; return b; };
  const title = document.createElement("b"); title.textContent = `Te faltan ${bs(missing)}`;
  const text = document.createElement("p"); text.textContent = "Recarga ahora, gana +50 pts del Club y retomamos este pago.";
  const row = document.createElement("div"); row.className = "row";
  row.append(mk("btn-primary", `Recargar ${bs(topup).replace(",00", "")}`, leave("deposit", { method: "pago_movil", amount_minor: topup })));
  if ((state.credit?.available_minor ?? 0) >= missing) row.append(mk("btn-ghost", "Usar Credirecto", leave("credit", { amount_minor: Math.min(topup, state.credit.available_minor) })));
  box.replaceChildren(title, text, row);
}
function askApproval(op) {
  return new Promise((resolve) => {
    const ok = $("cfOk"), no = $("cfNo"), wrap = $("confirm");
    const amt = op.s.amount_minor;
    $("cfSub").textContent = op.k.t(op.s);
    $("cfAmt").textContent = amt != null ? bs(amt) : "";
    // En crédito, amount_minor es la inicial y puede ser 0: con 0 nunca hay saldo insuficiente.
    const adds = SUMS_TO_WALLET.has(op.kind);
    const short = !adds && state.balance != null && amt > 0 && amt > state.balance;
    const isCredit = op.kind === "credit_offer";
    const rows = isCredit
      ? [["Concepto", op.k.t(op.s)], ["Inicial hoy", bs(amt ?? 0)], ["Financiado", bs(op.s.financed_minor)], ["Cuotas", String(op.s.installments ?? "—")], ["Aliado", op.s.partner ?? "—"], ["Comisión", bs(0)], ...(amt > 0 ? [["Desde", "Wallet PagoDirecto"]] : [])]
      : [["Concepto", op.k.t(op.s)], ...(op.k.sub(op.s) ? [["Detalle", op.k.sub(op.s)]] : []), ["Comisión", bs(0)], [adds ? "Hacia" : "Desde", "Wallet PagoDirecto"]];
    if (state.balance != null && amt != null && (!isCredit || amt > 0)) rows.push([short ? "Saldo disponible" : "Saldo después", bs(short ? state.balance : state.balance + (adds ? amt : -amt))]);
    $("cfList").replaceChildren(...rows.map(([a, b]) => { const d = document.createElement("div"); d.innerHTML = "<dt></dt><dd class='num'></dd>"; d.children[0].textContent = a; d.children[1].textContent = b; return d; }));
    ok.className = "bio"; ok.disabled = short;
    $("cfOkTxt").textContent = short ? "Saldo insuficiente" : "Confirmar con huella";
    ok.hidden = short;
    paintShort(op, short ? amt - state.balance : 0, (v) => close(v));
    openSheet("confirm", short ? $("cfShort").querySelector("button") : ok);
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
  if (op.params) return op.params;
  const s = op.s;
  switch (op.kind) {
    case "parking": return { ticket_ref: s.ticket_ref };
    case "payment": return { service_ref: state.services.find((x) => x.name === s.service)?.service_ref, account_number: s.account_number, amount_minor: s.amount_minor };
    case "donation": return { foundation_ref: state.foundations.find((x) => x.name === s.foundation)?.foundation_ref, amount_minor: s.amount_minor };
    case "transfer": return { recipient_ref: s.recipient_ref, amount_minor: s.amount_minor, kind: s.kind || "p2p" };
    case "credit_offer": return { offer_id: s.offer_id, installments: s.installments };
    case "parking_meter": case "insurance": case "tickets": case "tow_plan": return { product_ref: s.product_ref, quantity: s.quantity, plate: s.plate };
  }
  return null;
}
const INTENT_TTL_MS = 170_000; // el gateway da 180 s; renovamos con margen
async function freshOp(op) {
  if (Date.now() - op.t < INTENT_TTL_MS) return op;
  const res = await callTool(op.tool, paramsOf(op));
  if (res.status !== "requires_confirmation") throw new Error(res.speech || "requote");
  const fresh = registerOp(op.tool, res, op.params);
  op.state = "off";
  if (state.resume === op.id) state.resume = fresh.id;
  // La UI sigue apuntando a la operación vigente.
  if (tkCtx?.intent_id === op.id) tkCtx.intent_id = fresh.id;
  for (const c of [state.payBound, donCtx.bound, sendCtx.bound, credit.bound]) if (c?.intent_id === op.id) c.intent_id = fresh.id;
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
    if (approved === "away") {
      notifyAgent(`El usuario no tiene saldo para ${op.k.t(op.s)} y fue a recargar; la operación se retoma al terminar.`);
      return { status: "denied", speech: "Saldo insuficiente: el usuario está recargando y la operación se retomará sola." };
    }
    if (!approved) {
      if (source !== "agent") notifyAgent(`El usuario canceló la confirmación de ${op.k.t(op.s)}.`);
      return { status: "denied", speech: "El usuario canceló la confirmación." };
    }
    const { approval_proof } = await api(`/api/approval-proof?intent_id=${encodeURIComponent(id)}`);
    const res = await api("/api/confirm", { body: { intent_id: id, approval_proof } });
    if (res.status === "ok") {
      op.result = res; op.state = "done";
      setBalance(res.data?.balance_minor, true);
      if (op.kind === "topup") addPoints(50);
      if (op.kind === "credit_offer" || op.kind === "credit" || op.kind === "credit_payment") creditUsed(); // el escáner vuelve a cotizar con la línea nueva
      haptic([10, 40, 10]); wink();
      showDone(op, res);
      ctx.refreshCredit?.();
      loadMovements().then(paintBell).catch(() => {});
    } else {
      toast(res.speech || "No se pudo completar la operación");
    }
    if (source !== "agent") {
      if (wisiStarted) say(res.speech);
      // En voz, Wisi lo dice en alto; sin voz basta con avisarle para que tenga contexto.
      if (mode === "voice") { lastTyped = `(La app confirma: ${res.speech})`; try { conv.sendUserMessage(lastTyped); } catch {} }
      else notifyAgent(`El usuario confirmó en la app. Resultado: ${res.speech}`);
    }
    return res;
  } catch {
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
  chat.querySelector(".hello")?.remove();
  const d = document.createElement("div");
  // «bot» y no «wisi»: .wisi es la hoja entera y sacaba la burbuja de la vista.
  d.className = "msg " + (who === "wisi" ? "bot" : who);
  d.textContent = text;
  chat.append(d);
  $("wisi").classList.toggle("tall", chat.querySelectorAll(".msg").length > 5);
  paintChips(who === "wisi" && /\?\s*$/.test(text));
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
// Botones prearmados: siempre a mano y, si Wisi pregunta, primero Sí y No.
const QUICK = [
  ["Mi saldo", "¿Cuál es mi saldo?"], ["Escanear ticket", "Escanea el QR de mi ticket de estacionamiento"], ["Pagar la luz", "Quiero pagar la luz de Corpoelec"],
  ["Recargar", "Quiero recargar mi wallet"], ["Credirecto", "¿Cuánto tengo disponible en Credirecto?"], ["Mis créditos", "Escanea mis créditos"], ["Movimientos", "Muéstrame mis movimientos"],
  ["Parquímetro", "Quiero pagar un parquímetro"], ["Seguros", "Quiero ver los seguros"], ["TuGruero", "Quiero un plan de TuGruero"], ["Enviar", "Quiero enviar dinero"], ["Donar", "Quiero hacer una donación"],
];
function paintChips(asked = false) {
  const items = [...(asked ? [["Sí", "Sí"], ["No", "No"]] : []), ...QUICK];
  $("chips").replaceChildren(...items.map(([label, say]) => {
    const b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.dataset.say = say; b.textContent = label;
    return b;
  }));
  $("chips").scrollLeft = 0;
}
function greet() {
  wisiStarted = true;
  chat.replaceChildren();
  paintChips();
  $("wisi").classList.remove("tall");
  const h = document.createElement("div");
  h.className = "hello";
  h.innerHTML = "<h2>¿Qué hacemos hoy?</h2><p>Pídemelo hablando o escribiendo. Tú confirmas con tu huella.</p>";
  chat.append(h);
}
function setStatus(text, kind = "") { $("status").textContent = text; $("dot").className = "dot " + kind; }

// ============================================================ agente ElevenLabs (voz y texto)
let Conversation = null, conv = null, mode = null, live = false, starting = null, meter = 0, lastTyped = null;
let voiceWanted = false, voiceRetries = 0, voiceSince = 0, replyTimer = 0, awaitingReply = null;
const GREETING = /^¡Epa! Soy Wisi/;
/** El agente dio señales de vida: cancela la respuesta de respaldo. */
function agentAlive() { clearTimeout(replyTimer); clearTimeout(toolTimer); awaitingReply = null; }
const peers = new Set();
// Colchón de audio en WebRTC: 150 ms de margen evitan los cortes cuando la red tiembla.
if (window.RTCPeerConnection) {
  const Native = window.RTCPeerConnection;
  window.RTCPeerConnection = class extends Native {
    constructor(...args) {
      super(...args);
      peers.add(this);
      this.addEventListener("connectionstatechange", () => { if (this.connectionState === "closed") peers.delete(this); });
      this.addEventListener("track", (e) => {
        if (e.track.kind !== "audio") return;
        try { e.receiver.jitterBufferTarget = 150; e.receiver.playoutDelayHint = 0.15; } catch {}
      });
    }
  };
}
async function loadSDK() {
  if (Conversation) return Conversation;
  // Copia propia primero: la voz no depende de que un CDN externo esté arriba.
  for (const url of ["/assets/app/vendor/elevenlabs-client-0.7.1.js", "https://esm.sh/@elevenlabs/client@0.7.1", "https://cdn.jsdelivr.net/npm/@elevenlabs/client@0.7.1/+esm"]) {
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
  depositar: () => { go("home"); push("deposit"); },
  credirecto: () => { go("home"); push("credit"); },
  parquimetros: () => { go("home"); push("meter"); },
  seguros: () => { go("home"); push("insurance"); },
  boleteria: () => { go("home"); push("tickets"); },
  notificaciones: () => { go("home"); push("notifs"); },
  racha: () => { go("home"); push("streak"); },
  mis_vehiculos: () => { go("home"); push("vehicles"); },
  mis_cuentas: () => { go("home"); push("accounts"); },
  asistencia: () => { go("home"); push("help"); },
  tugruero: () => { go("home"); push("tugruero"); },
  jomi: () => { go("home"); push("jomi"); },
  escanear_creditos: () => { go("home"); push("crscan"); },
};
const CATALOG_SCREEN = { parquimetros: "meter", seguros: "insurance", boleteria: "tickets", tugruero: "tugruero" };
const prep = (name) => async (p) => {
  const res = await callTool(name, p);
  if (res.status === "requires_confirmation") {
    const op = registerOp(name, res, p);
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
  prepare_purchase: prep("prepare_purchase"),
  prepare_topup: prep("prepare_topup"),
  prepare_credit: prep("prepare_credit"),
  prepare_credit_payment: prep("prepare_credit_payment"),
  list_catalog: async (p) => {
    const res = await callTool("list_catalog", p);
    const name = CATALOG_SCREEN[p?.section];
    if (name && res.status === "ok") { driveApp(); go("home"); push(name, p?.type ? { type: p.type } : undefined); }
    return JSON.stringify(res);
  },
  get_credit: async () => {
    const res = await callTool("get_credit");
    driveApp(); go("home"); push("credit");
    return JSON.stringify(res);
  },
  // Credirecto: el motor del Worker decide; la app solo muestra y pide la huella.
  get_credit_status: async () => JSON.stringify(await refreshCredit()),
  scan_credit_offers: async () => { driveApp(); push("crscan"); return JSON.stringify(await scanCredit()); },
  quote_credit: async (p) => JSON.stringify(await callTool("quote_credit", p)),
  prepare_credit_offer: prep("prepare_credit_offer"),
  precalify_credit: async (p) => {
    const res = await callTool("precalify_credit", p);
    if (res.status === "ok" && res.data) {
      driveApp(); if (!stack.includes("crscan")) push("crscan");
      push("croffer", { offer_id: p?.offer_id });
      for (let i = 0; i < 12 && credit.offer?.offer_id !== p?.offer_id; i++) await sleep(250); // enter() puede esperar al escaneo
      if (credit.offer?.offer_id === p?.offer_id) paintPrecal(res.data);
    }
    return JSON.stringify(res);
  },
  scan_parking_qr: async () => {
    driveApp();
    const r = await startScan();
    if (!r) return JSON.stringify({ status: "denied", speech: "El usuario cerró el escáner sin leer el ticket." });
    return JSON.stringify(r.prep);
  },
  list_movements: async () => {
    driveApp(); go("movs");
    return JSON.stringify(await callTool("list_movements"));
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
// Una tool nunca deja al agente sin respuesta: si la red falla, lo dice con calma.
const safeTools = Object.fromEntries(Object.entries(clientTools).map(([name, fn]) => [name, async (p) => {
  agentAlive();
  try { return await fn(p); }
  catch { return JSON.stringify({ status: "error", speech: "Hubo un problema de conexión y no se movió dinero. ¿Lo intentamos de nuevo?" }); }
  finally { expectAfterTool(); }
}]));
// A veces el modelo recibe el resultado de la tool y se queda callado: se lo recordamos.
let toolTimer = 0;
function expectAfterTool() {
  clearTimeout(toolTimer);
  toolTimer = setTimeout(() => {
    if (!conv) return;
    console.warn("wisi: agente callado tras tool");
    lastTyped = "(Continúa: dile al usuario el resultado en una frase.)";
    try { conv.sendUserMessage(lastTyped); } catch {}
  }, 2500);
}
function notifyAgent(text) { try { conv?.sendContextualUpdate(text); } catch {} }

function setLive(on) {
  live = on;
  app.classList.toggle("live", on);
  $("btnMic").setAttribute("aria-label", on ? "Terminar conversación de voz" : "Hablar con Wisi");
  if (on) { setStatus("Te escucho…", "live"); islandCaption("Wisi", "Te escucho…"); pauseFaces(true); tickMeter(); }
  else {
    clearTimeout(meter); clearTimeout(micTimer); clearTimeout(modeTimer);
    micOff = false; agentSpoke = false; app.classList.remove("mic-off");
    pauseFaces(false);
    document.querySelector(".wisi-head .av").style.setProperty("--lvl", 1);
    setStatus(voiceEnabled ? "En línea" : "Modo chat", "ok");
  }
  paintIsland();
}
// Las animaciones del avatar compiten con el audio en móviles: en llamada se detienen.
function pauseFaces(on) {
  for (const f of faces.values()) { try { on ? f.anim?.pause() : (!reduced && f.anim?.play()); } catch {} }
}
// Micrófono de la llamada: apagarlo cierra tu turno y Wisi contesta; al terminar de
// hablar se vuelve a abrir solo, como en una llamada.
let micOff = false, agentSpoke = false, micTimer = 0, modeTimer = 0;
function setMic(off) {
  micOff = off;
  app.classList.toggle("mic-off", off);
  $("btnMic").setAttribute("aria-label", off ? "Encender micrófono" : "Apagar micrófono y esperar la respuesta");
  // En WebRTC se manda silencio (el servidor ve que dejaste de hablar y cierra tu
  // turno); dejar de publicar el audio lo deja esperando.
  const senders = [...peers].flatMap((pc) => pc.getSenders()).filter((x) => x.track?.kind === "audio");
  if (senders.length) for (const x of senders) x.track.enabled = !off;
  else { try { conv?.setMicMuted(off); } catch {} }
  clearTimeout(micTimer);
  if (off) {
    agentSpoke = false;
    setStatus("Wisi va a responder…", "live");
    // Si no había nada que responder, no te quedas esperando a oscuras.
    micTimer = setTimeout(() => { if (micOff && !agentSpoke) setStatus("Micrófono apagado", "ok"); }, 5000);
  } else setStatus("Te escucho…", "live");
}
function tickMeter() {
  if (!live || !conv) return;
  let out = 0, inp = 0;
  try { out = conv.getOutputVolume?.() ?? 0; inp = conv.getInputVolume?.() ?? 0; } catch {}
  const v = Math.min(1, Math.max(out, inp * 0.8));
  document.querySelector(".wisi-head .av").style.setProperty("--lvl", (1 + v * 0.35).toFixed(3));
  $$("#bars i").forEach((b, i) => b.style.setProperty("--h", Math.max(0.15, Math.min(1, v * (0.6 + ((i * 37) % 5) / 6) * 1.6)).toFixed(2)));
  meter = setTimeout(tickMeter, 90); // suficiente para la vista; no roba hilo principal al audio
}
async function endConv() {
  const c = conv; conv = null; mode = null;
  voiceWanted = false;
  try { await c?.endSession(); } catch {}
  setLive(false);
}
const withTimeout = (promise, ms, onLate) => {
  let timer, expired = false;
  promise.then((v) => { if (expired) onLate?.(v); }, () => {});
  return Promise.race([promise, new Promise((_, ko) => { timer = setTimeout(() => { expired = true; ko(new Error("timeout")); }, ms); })]).finally(() => clearTimeout(timer));
};
async function openConv(want) {
  if (conv && mode === want) return conv;
  if (starting) { await starting.catch(() => {}); if (conv && mode === want) return conv; }
  starting = (async () => {
    if (conv) { const keep = voiceWanted; await endConv(); voiceWanted = keep; }
    const text = want === "text";
    const [SDK, s] = await Promise.all([loadSDK(), newSession(true, !text)]);
    if (!s.signed_url && !s.conversation_token) throw new Error("La voz no está disponible ahora mismo; usa el chat");
    let c = null;
    const callbacks = {
      clientTools: safeTools,
      onConnect: () => { if (!text) { voiceSince = Date.now(); setLive(true); haptic(); } },
      onDisconnect: (info) => {
        if (c && conv !== c) return;
        conv = null; mode = null; setLive(false); hideThinking();
        if (!text) voiceDropped(info);
      },
      onError: (m) => { console.warn("wisi:", m); },
      onModeChange: ({ mode: m }) => {
        if (!live) return;
        // El modo parpadea entre frases: solo cuenta como «terminó» si dura un momento.
        clearTimeout(modeTimer);
        if (m === "speaking") { agentSpoke = true; clearTimeout(micTimer); clearTimeout(toolTimer); hideThinking(); return setStatus("Hablando…", "live"); }
        modeTimer = setTimeout(() => {
          if (!live) return;
          if (micOff && agentSpoke) return setMic(false);
          if (!micOff) setStatus("Te escucho…", "live");
        }, 700);
      },
      onMessage: ({ message, source }) => {
        if (source === "user") {
          if (!text && message !== lastTyped) { add("user", message); showThinking(); }
          lastTyped = null;
          return;
        }
        agentAlive();
        if (text && GREETING.test(message)) return; // en chat no repetimos el saludo hablado
        say(message);
      },
    };
    const late = (x) => x?.endSession?.().catch?.(() => {});
    if (text) {
      c = await withTimeout(SDK.startSession({ signedUrl: s.signed_url, textOnly: true, overrides: { conversation: { textOnly: true } }, ...callbacks }), 10000, late);
    } else {
      // WebRTC da mejor audio y cancelación de eco; si la red lo bloquea, WebSocket.
      try {
        if (!s.conversation_token) throw new Error("sin token");
        c = await withTimeout(SDK.startSession({ conversationToken: s.conversation_token, connectionType: "webrtc", ...callbacks }), 9000, late);
      } catch (e) {
        if (/Permission|NotAllowed|denied/i.test(String(e?.name || e?.message))) throw e;
        if (!s.signed_url) throw e;
        c = await withTimeout(SDK.startSession({ signedUrl: s.signed_url, connectionType: "websocket", ...callbacks }), 10000, late);
      }
    }
    conv = c; mode = want;
    return c;
  })();
  try { return await starting; } finally { starting = null; }
}
/** Se cortó la voz sin que el usuario la terminara: reconecta sola, sin otro toque. */
function voiceDropped(info) {
  if (!voiceWanted) return;
  if (info?.reason === "agent") { voiceWanted = false; return setStatus("Wisi cerró la llamada; toca el micrófono para seguir", "ok"); }
  if (Date.now() - voiceSince > 20000) voiceRetries = 0;
  if (voiceRetries >= 2) { voiceWanted = false; return add("err", "Se cortó la voz. Toca el micrófono para seguir o escríbeme."); }
  voiceRetries++;
  setStatus("Reconectando voz…");
  setTimeout(() => { if (voiceWanted && !conv) startVoice(true); }, 700);
}
let micBusy = false;
async function startVoice(reconnecting = false) {
  if (live || micBusy) return;
  micBusy = true;
  const mic = $("btnMic");
  mic.classList.add("busy");
  setStatus("Conectando voz…");
  if (!wisiStarted) greet();
  voiceWanted = true;
  if (!reconnecting) voiceRetries = 0;
  showThinking(); thinkRow?.set("voice");
  // Pedimos el micrófono dentro del toque: es lo que iOS y Android exigen para
  // no volver a preguntar ni arrancar el audio en silencio.
  let preflight = null;
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error(location.protocol === "https:" || location.hostname === "localhost" ? "Tu navegador no permite el micrófono" : "El micrófono requiere HTTPS");
    const ask = navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    // Si el navegador va a mostrar su aviso, explicamos por qué antes de conectar.
    let asked = false;
    if (!reconnecting) navigator.permissions?.query({ name: "microphone" }).then((p) => {
      if (p.state !== "prompt" || preflight) return;
      asked = true;
      thinkRow?.set("mic");
      toast("Wisi necesita tu micrófono: acepta el permiso del navegador", 6000);
    }).catch(() => {});
    preflight = await ask;
    if (asked) { toast("Micrófono listo"); thinkRow?.set("voice"); }
    await openConv("voice");
    hideThinking();
    completeTask("wisi");
  } catch (e) {
    hideThinking();
    voiceWanted = false;
    const raw = String(e?.name || "") + " " + String(e?.message || e);
    const msg = /Permission|NotAllowed|denied/i.test(raw) ? "Necesito permiso de micrófono: actívalo en el candado de la barra de direcciones y vuelve a tocar."
      : /NotFound|DevicesNotFound/i.test(raw) ? "No encuentro un micrófono en este dispositivo. Puedes escribirme."
      : /timeout|session|fetch|network/i.test(raw) ? "No pude conectar la voz. Revisa tu conexión o escríbeme: el chat funciona igual."
      : (e?.message || raw);
    add("err", msg);
    setLive(false);
  } finally {
    preflight?.getTracks().forEach((t) => t.stop());
    micBusy = false;
    mic.classList.remove("busy");
  }
}

// --- enrutador local (sin agente) y atajos deterministas
const SERVICES = { luz: "corpoelec", corpoelec: "corpoelec", electricidad: "corpoelec", digitel: "digitel", movistar: "movistar", movilnet: "movilnet", cantv: "cantv", internet: "cantv", simpletv: "simpletv", "simple tv": "simpletv", inter: "inter", thundernet: "thundernet", tugruero: "tugruero", grua: "tugruero", dlm: "dlm", "global system": "globalsystem", starmoviles: "starmoviles", fibex: "fibex", condominio: "condominio" };
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
  if (res.status === "requires_confirmation") { const op = registerOp(name, res, params); driveApp(); showOpInApp(op); }
}
async function handleLocal(text) {
  const t = norm(text);
  if (/saldo|cuanto tengo|balance/.test(t)) { showThinking(); const r = await refreshBalance(true); return say(r.speech); }
  if (/movimiento|historial|que he pagado/.test(t)) { driveApp(); go("movs"); showThinking(); const moves = await loadMovements(); return say(moves.length ? `Tienes ${moves.length} movimiento${moves.length > 1 ? "s" : ""}. El último: ${moves[0].title} por ${bs(Math.abs(moves[0].amount_minor))}.` : "Aún no tienes movimientos. ¿Escaneamos un ticket?"); }
  const open = (screen, text) => { driveApp(); go("home"); push(screen); say(text); };
  if (/credi|prestamo/.test(t)) {
    const a = amountOf(t);
    if (a && /pid|solicit|quiero|dame|presta|deposit/.test(t)) return prepareLocal("prepare_credit", { amount_minor: a });
    showThinking();
    const r = await callTool("get_credit");
    return open("credit", r.speech);
  }
  if (/recarg|deposit|agrega.*saldo/.test(t)) {
    const a = amountOf(t);
    if (a) return prepareLocal("prepare_topup", { method: /banco de venezuela|bdv/.test(t) ? "bdv" : /humaniz/.test(t) ? "humaniz" : /nacional/.test(t) ? "cuentas_nacionales" : "pago_movil", amount_minor: a });
    return open("deposit", "¿Cómo quieres recargar? Elige el método y el monto.");
  }
  if (/gruero|grua/.test(t)) return open("tugruero", "Elige si es para tu vehículo o tu moto.");
  if (/jomi|plomer|tecnico/.test(t)) return open("jomi", "¿Qué necesitas resolver?");
  if (/parquimetro/.test(t)) return open("meter", "Elige la zona, tu placa y las horas.");
  if (/seguro|poliza|rcv/.test(t)) return open("insurance", "Estas son las pólizas disponibles.");
  if (/boleto|boleteria|evento|entrada/.test(t)) return open("tickets", "Estos son los próximos eventos.");
  if (/notificaci/.test(t)) return open("notifs", "Aquí están tus notificaciones.");
  if (/racha/.test(t)) return open("streak", "Esta es tu racha de pagos.");
  if (/vehiculo|placa/.test(t)) return open("vehicles", "Aquí gestionas tus vehículos.");
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
  if (/^(si|sí|no)\b/.test(t)) return say("Revisa la pantalla: ahí confirmas con tu huella o cancelas.");
  if (/hola|buen|hey|epa/.test(t)) return say("¡Epa! ¿Qué hacemos hoy? Escaneo tu ticket, pago servicios, dono o envío fondos.");
  say("Puedo pagar tu estacionamiento, parquímetro y servicios, recargar tu wallet, pedir Credirecto, comprar seguros y boletos, donar o enviar fondos. ¿Qué necesitas?");
}
// ============================================================ cerebro de Wisi por niveles
// Normas completas en docs/wisi-cerebro.md: resolver con el nivel más barato que acierte.
//   N0 reglas locales (aquí, 0 costo) -> N1/N2 /api/brain (Worker, OpenRouter) -> N3 agente de voz.
// Ningún modelo decide dinero ni crédito: solo elige la acción; el usuario confirma con su huella.
const CREDIT_STRONG = /credit|credirecto|cuota|financ|prestamo|hipoteca/;
const CREDIT_WEAK = /\bcarro\b|vehiculo|viaje|roques|margarita|merida|\bsaga\b|estei|conduce|propiedash|tugruero|mercantil|\bseguros?\b/;
// «Escanea mis créditos» y los nombres de aliados van al escáner; «mi Credirecto» o «cuánto debo», a la línea de la wallet.
const CREDIT_SCAN = /escane|escaneo|revisa|busca|ofertas|que (puedo|credito)|cuanto (puedo|me)/;
const CREDIT_WALLET = /cuanto debo|deuda|mi credirecto|mi linea|abonar|abono/;
const OTHER_FLOW = /estacionamiento|parking|ticket|saldo|movimiento|historial|don(a|ar|aci)|envi|transfer|corpoelec|digitel|movistar|movilnet|cantv|\bluz\b/;
const CREDIT_OFFERS = [
  [/roques/, "saga_roques"], [/merida/, "saga_merida"], [/margarita|estei/, "estei_margarita"],
  [/propiedash|hipoteca|apartamento|\bcasa\b|inmueble/, "propiedash_apto"], [/tugruero|\bgrua\b/, "tugruero_plan"],
  [/\bseguros?\b|\brcv\b|mercantil/, "mercantil_rcv"], [/conduce|vehiculo|\bcarro\b|corolla/, "conduce_corolla"],
  [/condominio/, "svc_condominio"], [/cantv|internet/, "svc_cantv"], [/estacionamiento|parking/, "park_month"], [/concierto|poliedro|entrada/, "event_ticket"],
];
const NEXT_HINT = { usar: "Toca «Usar Credirecto» y confirma con tu huella.", precalificar: "Toca «Precalificar» para armar tu solicitud.", subir_nivel: "Todavía no la tienes disponible." };

/** Abre la oferta pedida (por id o por vertical) y la explica con el motivo del motor. */
async function openCreditOffer({ offer_id, vertical } = {}, reply) {
  showThinking();
  try { await ensureOffers(); } catch { hideThinking(); return say("Credirecto no responde ahora mismo. Inténtalo en un momento."); }
  const o = credit.offers.find((x) => (offer_id ? x.offer_id === offer_id : x.vertical === vertical));
  if (!o) { driveApp(); push("crscan"); return say(reply || "No encontré esa oferta. Escanea tus créditos y te muestro lo que tienes disponible."); }
  driveApp();
  if (!stack.includes("crscan")) push("crscan");
  push("croffer", { offer_id: o.offer_id });
  say(reply || `${o.title}: ${o.reason} ${NEXT_HINT[o.next_step] ?? ""}`.trim());
}
/** Abre Credirecto; con scanIt además escanea y resume lo que encontró. */
async function openCreditHome(scanIt, reply) {
  driveApp(); push("crscan");
  if (scanIt) {
    const res = await scanCredit();
    return say(reply || (res.status === "ok" ? res.speech : null) || "No pude escanear tus créditos ahora. Inténtalo otra vez.");
  }
  const r = await refreshCredit(), d = credit.status?.lines?.cotidiano;
  say(reply || (r.status === "ok" && d ? `Tu línea del día a día tiene ${bs(d.available_minor)} disponibles. Toca «Escanear mis créditos» y te muestro ofertas.` : "Abrí Credirecto. Toca «Escanear mis créditos» para ver ofertas."));
}
/** «Mi Credirecto»: la línea de efectivo de la wallet (la pantalla de David), no el escáner. */
async function openWalletCredit() {
  showThinking();
  const r = await callTool("get_credit");
  driveApp(); go("home"); push("credit");
  say(r.speech);
}
/** N0: crédito por reglas. Devuelve true si lo resolvió (sin modelo). */
async function creditN0(text) {
  const t = norm(text);
  const strong = CREDIT_STRONG.test(t);
  // «seguro» como adjetivo («es seguro») no cuenta; las palabras débiles ceden ante los flujos que ya existen.
  const weak = CREDIT_WEAK.test(t.replace(/\b(es|esta|estoy|estas|ser|muy|mas|no|tan) seguro\b/g, "")) && !OTHER_FLOW.test(t);
  const wallet = CREDIT_WALLET.test(t) && !CREDIT_SCAN.test(t);
  if (!strong && !weak && !wallet) return false;
  try {
    const rule = CREDIT_OFFERS.find(([re]) => re.test(t));
    if (rule) await openCreditOffer({ offer_id: rule[1] });
    else if (CREDIT_SCAN.test(t) || (weak && !wallet)) await openCreditHome(CREDIT_SCAN.test(t));
    else await openWalletCredit();
  } catch { hideThinking(); add("err", "No pude abrir Credirecto. Inténtalo de nuevo."); }
  return true;
}
let brainOff = false; // si /api/brain responde 404 (backend sin desplegar), no se vuelve a intentar
/** N1/N2: pregunta al Worker qué acción corresponde. false = seguir con el agente y el resolvedor local. */
async function brainRoute(text) {
  if (conv || brainOff) return false;
  let data;
  try {
    showThinking();
    const res = await api("/api/brain", { body: { text, screen: stack.at(-1) || tab } });
    data = res?.status === "ok" || res?.status == null ? res?.data : null;
  } catch (e) { if (e.status === 404) brainOff = true; return false; }
  if (!data?.action || data.action === "conversar") return false;
  const p = data.params || {};
  try {
    hideThinking();
    // Una sola respuesta: el dato real o la operación preparada hablan por sí mismos.
    const reply = () => { if (data.reply) say(data.reply); };
    switch (data.action) {
      case "saldo": { const r = await refreshBalance(true); say(r.speech); break; }
      case "movimientos": await handleLocal("movimientos"); break;
      case "pagar_servicio":
        if (p.service_ref && p.account_number) await prepareLocal("prepare_payment", { service_ref: p.service_ref, account_number: p.account_number, amount_minor: p.amount_minor ?? null });
        else if (p.service_ref) { reply(); driveApp(); push("pay", { service_ref: p.service_ref }); }
        else { reply(); driveApp(); push("services"); }
        break;
      case "estacionamiento": await scanFromChat(); break;
      case "donar":
        if (p.foundation_ref || p.amount_minor) await prepareLocal("prepare_donation", { foundation_ref: p.foundation_ref || "fundana", amount_minor: p.amount_minor ?? 5000 });
        else { reply(); driveApp(); push("donate"); }
        break;
      case "enviar":
        if (p.recipient_ref && p.amount_minor) await prepareLocal("prepare_transfer", { recipient_ref: p.recipient_ref, amount_minor: p.amount_minor, kind: "p2p" });
        else { reply(); driveApp(); push("send", { recipient_ref: p.recipient_ref, amount_minor: p.amount_minor }); }
        break;
      case "creditos_escanear": await openCreditHome(true, data.reply); break;
      case "credito_ver":
      case "credito_explicar":
        if (p.offer_id || p.vertical) await openCreditOffer({ offer_id: p.offer_id, vertical: p.vertical }, data.reply);
        else await openCreditHome(false, data.reply);
        break;
      case "abrir_pantalla": { const nav = SCREEN_MAP[String(p.screen_key ?? "")]; if (!nav) return false; reply(); driveApp(); nav(); break; }
      default: return false;
    }
  } catch { hideThinking(); add("err", "No pude completar eso. Inténtalo de nuevo."); }
  return true;
}
async function ask(text) {
  text = text.trim();
  if (!text) return;
  if (!wisiStarted) greet();
  add("user", text);
  // Explicar una decisión de crédito lo resuelve el cerebro (credito_explicar), no el N0 local.
  const tn = norm(text);
  if (CREDIT_STRONG.test(tn) && /\b(por que|porque|explica\w*|como funciona)\b/.test(tn) && await brainRoute(text)) return;
  // N0: crédito por reglas (va antes que «escanea», que si no abriría el escáner QR).
  if (await creditN0(text)) return;
  // El escaneo es una acción de la app: lo resolvemos aquí, siempre igual.
  if (isScan(norm(text))) return scanFromChat().catch(() => add("err", "No pude abrir el escáner."));
  completeTask("wisi");
  // N1/N2: cerebro del Worker, solo si no hay una conversación abierta con el agente.
  if (await brainRoute(text)) return;
  const local = async () => {
    try { await handleLocal(text); }
    catch { hideThinking(); add("err", "No pude conectar con PagoDirecto. Revisa tu conexión e inténtalo de nuevo."); }
  };
  if (!voiceEnabled) return local();
  showThinking();
  try {
    const c = await openConv(mode === "voice" ? "voice" : "text");
    lastTyped = text;
    // Si el agente se queda mudo, la app responde: Wisi nunca deja a nadie en visto.
    awaitingReply = text;
    clearTimeout(replyTimer);
    replyTimer = setTimeout(() => { if (awaitingReply === text) { awaitingReply = null; local(); } }, 14000);
    c.sendUserMessage(text);
  } catch { agentAlive(); return local(); }
}

// ============================================================ eventos globales
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-go],[data-push],[data-wisi],[data-soon],[data-ask],[data-voice],[data-more],[data-close],[data-back],[data-task-go],[data-svc]");
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
  if (t.dataset.svc) return openService(t.dataset.svc);
  if (t.dataset.taskGo === "key") { haptic(20); toast("Llave de acceso activada"); return completeTask("key"); }
  if (t.dataset.taskGo === "car") return push("vehicles");
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
  // Sin avisos ni esperas: el botón ya muestra el cambio. La sesión vieja se cierra por detrás.
  const old = conv, wasLive = live;
  conv = null; mode = null;
  if (wasLive) setLive(false);
  old?.endSession().catch(() => {});
  if (wasLive) startVoice();
});
// Un toque basta: mientras conecta, otro toque no cancela ni reinicia nada.
$("btnMic").addEventListener("click", () => { if (micBusy) return; haptic(8); live ? setMic(!micOff) : startVoice(); });
$("btnHang").addEventListener("click", () => { haptic(12); endConv(); });
$("dock").addEventListener("submit", (e) => { e.preventDefault(); const t = $("text").value; $("text").value = ""; $("compose").classList.remove("has"); ask(t); });
$("text").addEventListener("input", () => $("compose").classList.toggle("has", $("text").value.trim().length > 0));
$("chips").addEventListener("click", (e) => { const s = e.target.closest(".chip")?.dataset.say; if (s) { haptic(6); ask(s); } });
$("btnReset").addEventListener("click", async () => { await endConv(); agentAlive(); islandPinned = false; ops.clear(); state.resume = null; greet(); paintIsland(); });
$("btnResetDemo").addEventListener("click", async () => {
  await endConv();
  newPrincipal(); token = null;
  for (const k of ["pd.bal", "pd.user", "pd.points", "pd.tasks", "pd.plates", "pd.accounts", "pd.seen", "pd.scheduled", "pd.directory", "pd.billing"]) store.del(k);
  ops.clear(); state.resume = null; state.credit = null; state.catalog = null; islandPinned = false; tkCtx = null;
  Object.assign(credit, { status: null, failed: false, offers: [], summary: null, offer: null, quote: null, bound: null }); paintCredit(); paintOffers();
  greet(); wisiStarted = false; paintIsland(); parkStep(0); paintUser(); paintClub();
  try { await newSession(false); await refreshBalance(true); await ctx.refreshCredit(); refreshCredit(); paintBell([]); toast(`Demo reiniciada: ${bs(state.balance)}`); }
  catch { toast("Sin conexión con PagoDirecto"); }
  go("home");
});
$("btnShare").addEventListener("click", () => ctx.share("Paga todo hablando con Wisi en PagoDirecto."));
addEventListener("online", () => setStatus(voiceEnabled ? "En línea" : "Modo chat", "ok"));
addEventListener("offline", () => { setStatus("Sin conexión", "err"); toast("Sin conexión a internet"); });
// Cambiar de app un momento no corta la llamada; solo si pasa más de un minuto.
let hiddenT = 0;
document.addEventListener("visibilitychange", () => {
  clearTimeout(hiddenT);
  if (!document.hidden) return;
  if (live) hiddenT = setTimeout(() => { if (document.hidden && live) endConv(); }, 60000);
  if (scan) { stopScan(null); if (stack.at(-1) === "scan") pop(); }
});
// Ningún error suelto deja la app colgada.
addEventListener("unhandledrejection", (e) => { console.warn("wisi:", e.reason); hideThinking(); thinkFloat.hide(); });

// ============================================================ Club, usuario y campana
const TASK_PTS = { key: 250, car: 250, wisi: 100 };
const user = () => store.get("pd.user", "@wisidemo");
const points = () => Number(store.get("pd.points", "0")) || 0;
function paintUser() { for (const el of $$(".js-user")) el.textContent = user(); }
function addPoints(n) { store.set("pd.points", String(points() + n)); paintClub(); }
function paintClub() {
  for (const el of $$(".js-points")) el.textContent = `${points().toLocaleString("es-VE")} pts`;
  const done = storeJSON.get("pd.tasks", []);
  for (const card of $$("[data-task]")) {
    const on = done.includes(card.dataset.task);
    card.classList.toggle("done", on);
    const b = card.querySelector("[data-task-go]");
    if (b) { b.disabled = on; b.textContent = on ? "Completado" : "Completar"; }
  }
}
function completeTask(k) {
  const done = storeJSON.get("pd.tasks", []);
  if (done.includes(k)) return;
  storeJSON.set("pd.tasks", [...done, k]);
  addPoints(TASK_PTS[k] ?? 0);
  if (k !== "wisi") toast(`¡Ganaste ${TASK_PTS[k]} pts del Club!`);
}
function paintBell(moves) {
  const seen = Number(store.get("pd.seen", "0")) || 0;
  $("bell").classList.toggle("dot", (moves ?? []).some((m) => m.kind !== "welcome" && m.created_at > seen));
}

const ctx = {
  $, $$, bs, fmt, parseBs, toast, store, storeJSON, push, pop, go, callTool, runPrepare, loadMovements, state, openWisi, haptic, when, makeThink,
  confirmOp, scanFromUI, completeTask, user, points, paintUser, logoOf, moveRow, sleep,
  cancelOp(id) { const op = ops.get(id); if (op) { op.state = "off"; notifyAgent(`El usuario canceló ${op.k.t(op.s)}.`); } },
  paintBell: () => paintBell([]),
};
Object.assign(SCREENS, installFeatures(ctx));

// ============================================================ arranque
const cachedBal = Number(store.get("pd.bal", ""));
if (store.get("pd.bal", "") !== "" && Number.isFinite(cachedBal)) setBalance(cachedBal);
paintVoice(); paintEye(); demoTicketGrid(); paintUser(); paintClub();
for (const s of $$(".screen")) if (!s.classList.contains("on")) s.inert = true;
$("wisi").inert = true;
addEventListener("load", () => {
  for (const el of $$(".js-face")) setFace(el, "neutral");
});
async function boot(attempt = 0) {
  try {
    await newSession(false);
    const [, svc, fnd, moves] = await Promise.all([refreshBalance(), callTool("list_services"), callTool("list_foundations"), loadMovements(), ctx.refreshCredit(), refreshCredit()]);
    state.services = svc.data?.services ?? [];
    state.foundations = fnd.data?.foundations ?? [];
    paintHomeServices(); paintServiceGrid(); paintFoundations(); paintBell(moves);
    setStatus(voiceEnabled ? "En línea" : "Modo chat", "ok");
    loadSDK().catch(() => {});
  } catch {
    setStatus("Reconectando…", "err");
    if (state.balance == null) for (const el of $$(".js-bal")) el.textContent = "Bs ···";
    if (attempt === 2) toast("La conexión está lenta. Seguimos intentando…", 5000);
    setTimeout(() => boot(attempt + 1), Math.min(15000, 1500 * 2 ** attempt));
  }
}
boot();
