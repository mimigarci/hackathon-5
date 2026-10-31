// Funciones de la app real replicadas en la demo (sin login): Depositar,
// Credirecto, Parquímetros, Seguros, Boletería, racha, notificaciones,
// asistencia, perfil, cuentas, vehículos, código QR, facturas y cobros.
// El saldo, los movimientos y lo comprado viven en el servidor; las
// preferencias del usuario (perfil, vehículos, cuentas, puntos) en cookies.

export function installFeatures(ctx) {
  const { $, $$, bs, fmt, parseBs, toast, store, storeJSON, push, go, callTool, runPrepare, loadMovements, state, openWisi, haptic, when, makeThink } = ctx;

  // ---------------------------------------------------------------- utilidades
  function h(tag, attrs = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") e.className = v;
      else if (k === "html") e.innerHTML = v; // solo con plantillas propias, nunca datos del usuario
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? "" : v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) e.append(c instanceof Node ? c : document.createTextNode(String(c)));
    return e;
  }
  // replaceChildren pintaría null como texto; los hijos opcionales se filtran aquí.
  const fill = (el, ...kids) => el.replaceChildren(...kids.flat().filter((c) => c != null && c !== false));
  const icon = (id, size = 22) => h("span", { html: `<svg width="${size}" height="${size}" aria-hidden="true"><use href="#${id}"/></svg>` }).firstChild;
  const btn = (label, onclick, cls = "btn btn-primary btn-block") => h("button", { type: "button", class: cls, onclick }, label);
  const row = (ic, title, sub, onclick, extra) =>
    h(onclick ? "button" : "div", { type: onclick ? "button" : null, class: "item", onclick },
      h("span", { class: "ic" }, icon(ic)), h("span", { class: "tx" }, h("b", {}, title), sub ? h("small", {}, sub) : null),
      extra ?? (onclick ? h("span", { html: '<svg class="chev"><use href="#i-chev"/></svg>' }).firstChild : null));
  const emptyPlain = (title, text) => h("div", { class: "empty-plain" }, h("b", {}, title), text);
  const loading = () => h("div", { class: "empty-plain" }, makeThink("think").el);
  const moneyField = (id, value, label, hint) =>
    h("div", { class: "field" }, h("label", { for: id }, label),
      h("div", { class: "money" }, h("input", { class: "input", id, inputmode: "decimal", autocomplete: "off", value: value ? fmt.format(value / 100) : "" })),
      hint ? h("span", { class: "hint" }, hint) : null);
  const amountChips = (values, inputId, onPick) =>
    h("div", { class: "amounts" }, values.map((v) => h("button", { type: "button", class: "chip", onclick: () => { $(inputId).value = fmt.format(v / 100); haptic(6); onPick?.(); } }, bs(v).replace(",00", ""))));
  const stepper = (labels, k) => h("div", { class: "stepper" }, labels.map((l, i) => h("div", { class: "step" + (i < k ? " done" : i === k ? " on" : "") }, h("i"), l)));
  const KIND_ICON = { payment: "i-receipt", parking: "i-car", donation: "i-heart", transfer: "i-send", topup: "i-bank", credit: "i-bank", credit_offer: "i-credit", credit_payment: "i-bank", parking_meter: "i-meter", insurance: "i-shield", tickets: "i-ticket" };
  const moveItem = (m) => {
    const pos = m.amount_minor > 0;
    return h("div", { class: "item" }, h("span", { class: "ic" }, icon(KIND_ICON[m.kind] || "i-receipt")),
      h("span", { class: "tx" }, h("b", {}, m.title), h("small", {}, when(m.created_at))),
      h("span", { class: "amt num", style: `color:${pos ? "var(--ok)" : "var(--ink)"}` }, (pos ? "+" : "−") + bs(Math.abs(m.amount_minor))));
  };
  async function moves() { try { return await loadMovements(); } catch { return []; } }
  async function catalog(section) {
    state.catalog ??= {};
    if (!state.catalog[section]) state.catalog[section] = (await callTool("list_catalog", { section })).data?.items ?? [];
    return state.catalog[section];
  }

  /** Crea el armazón de una pantalla empujable (navbar + scroll + página). */
  function shell(name, title, { help = true, tabs = null } = {}) {
    if ($("s-" + name)) return $("s-" + name);
    const el = h("section", { class: "screen push", id: "s-" + name, "aria-label": title });
    el.inert = true;
    el.append(
      h("header", { class: "navbar" },
        h("button", { type: "button", class: "circle", "data-back": true, "aria-label": "Volver", html: '<svg><use href="#i-back"/></svg>' }),
        h("h1", {}, title),
        help ? h("button", { type: "button", class: "circle", "data-wisi": true, "aria-label": "Ayuda: hablar con Wisi", html: '<img src="/assets/pd/header_help.svg" alt="" />' }) : h("span")),
      h("div", { class: "scroll" }, h("div", { class: "page" })));
    if (tabs) {
      const nav = h("nav", { class: "subtabs", role: "tablist", "aria-label": title });
      for (const [key, label, ic] of tabs) nav.append(h("button", { type: "button", role: "tab", "aria-selected": "false", "data-tab": key }, icon(ic, 24), label));
      el.append(nav);
    }
    $("stack").append(el);
    return el;
  }
  const page = (name) => $("s-" + name).querySelector(".page");
  function setTabs(name, key, render) {
    const nav = $("s-" + name).querySelector(".subtabs");
    for (const b of nav.querySelectorAll("button")) b.setAttribute("aria-selected", String(b.dataset.tab === key));
    nav.onclick = (e) => { const b = e.target.closest("button"); if (b) render(b.dataset.tab); };
  }

  const S = {}; // pantallas nuevas: name -> { enter, leave }

  // ---------------------------------------------------------------- Depositar
  const METHODS = [
    ["cuentas_nacionales", "Cuentas Nacionales", "Desde la app"],
    ["pago_movil", "Pago Móvil", "Desde tu banco"],
    ["bdv", "Banco de Venezuela", "Desde la app"],
    ["humaniz", "Humaniz", "Desde la app"],
  ];
  shell("deposit", "Depositar fondos");
  S.deposit = {
    enter(p = {}) {
      const pg = page("deposit");
      if (!p.method) {
        fill(pg, h("h2", {}, "¿Cómo deseas recargar tu wallet?"),
          h("div", { class: "rowlist" }, METHODS.map(([ref, name, sub]) => h("button", { type: "button", class: "item method", onclick: () => S.deposit.enter({ method: ref, amount_minor: p.amount_minor }) },
            h("span", { class: "ic" }, icon("i-bank")), h("span", { class: "tx" }, h("b", {}, name), h("small", {}, sub)), h("span", { html: '<svg class="chev"><use href="#i-chev"/></svg>' }).firstChild))),
          h("p", { class: "hint" }, "Recarga simulada: en esta demo no se mueve dinero real."));
        return;
      }
      const name = METHODS.find((m) => m[0] === p.method)?.[1] ?? "Pago Móvil";
      const go = h("button", { type: "button", class: "btn btn-primary btn-block" }, "Recargar");
      const paint = () => { const a = parseBs($("depAmt").value); go.textContent = a ? `Recargar ${bs(a)}` : "Recargar"; };
      fill(pg, 
        h("div", { class: "picked" }, icon("i-bank", 26), h("span", { class: "tx" }, h("b", {}, name), h("small", {}, "Llega al instante a tu wallet"))),
        moneyField("depAmt", p.amount_minor ?? 500_00, "Monto a recargar", "Máximo Bs 10.000 por recarga."),
        amountChips([100_00, 500_00, 1_000_00, 2_000_00], "depAmt", paint),
        go, btn("Cambiar método", () => S.deposit.enter({}), "btn btn-ghost btn-block"));
      $("depAmt").addEventListener("input", paint); paint();
      go.onclick = () => {
        const a = parseBs($("depAmt").value);
        if (!a) return toast("Escribe un monto válido");
        if (p.intent_id && a === p.amount_minor) return ctx.confirmOp(p.intent_id, "ui");
        runPrepare("prepare_topup", { method: p.method, amount_minor: a }, go);
      };
    },
  };

  // ---------------------------------------------------------------- Credirecto
  shell("credit", "Credirecto");
  async function refreshCredit() {
    try { state.credit = (await callTool("get_credit")).data; } catch { return; }
    const c = state.credit, used = c.used_minor;
    for (const el of $$(".js-credi-t")) el.textContent = used ? `Disponible ${bs(c.available_minor)}` : "Tu crédito, al instante";
    for (const el of $$(".js-credi-s")) el.textContent = used ? `Debes ${bs(used)} · ${c.installments} cuotas de ${bs(c.installment_minor)}` : `Hasta ${bs(c.limit_minor).replace(",00", "")} en tu wallet, en ${c.installments} cuotas.`;
    for (const el of $$(".js-credi-m")) el.style.width = `${Math.round((used / c.limit_minor) * 100)}%`;
  }
  ctx.refreshCredit = refreshCredit;
  S.credit = {
    async enter(p = {}) {
      const pg = page("credit");
      fill(pg, loading());
      await refreshCredit();
      const c = state.credit;
      if (!c) return fill(pg, emptyPlain("No pudimos cargar Credirecto", "Revisa tu conexión e inténtalo de nuevo."));
      const req = h("button", { type: "button", class: "btn btn-primary btn-block" }, "Solicitar");
      const paintReq = () => { const a = parseBs($("crAmt").value); req.textContent = a ? `Solicitar ${bs(a)}` : "Solicitar"; req.disabled = !a || a > c.available_minor; };
      fill(pg, 
        h("div", { class: "credi", style: "min-height:170px" },
          h("span", { class: "brand", html: '<i aria-hidden="true"></i>Credirecto' }),
          h("small", { style: "margin-top:auto" }, "Disponible"),
          h("span", { class: "big num" }, bs(c.available_minor)),
          h("span", { class: "meter" }, h("i", { style: `width:${Math.round((c.used_minor / c.limit_minor) * 100)}%` }))),
        h("dl", { class: "kv card" },
          h("div", {}, h("dt", {}, "Línea total"), h("dd", { class: "num" }, bs(c.limit_minor))),
          h("div", {}, h("dt", {}, "Usado"), h("dd", { class: "num" }, bs(c.used_minor))),
          h("div", {}, h("dt", {}, "Cuotas"), h("dd", {}, `${c.installments} quincenales, sin intereses`))),
        c.available_minor > 0 ? h("div", { class: "card" }, h("h3", {}, "Solicita dinero a tu wallet"), h("p", {}, "Llega al instante y lo pagas en cuotas."),
          h("div", { style: "display:grid;gap:12px;margin-top:12px" },
            moneyField("crAmt", p.amount_minor ?? Math.min(500_00, c.available_minor), "Monto", `Máximo ${bs(c.available_minor)}`),
            amountChips([200_00, 500_00, 1_000_00, c.available_minor].filter((v, i, a) => v <= c.available_minor && a.indexOf(v) === i), "crAmt", paintReq),
            req)) : null,
        c.used_minor > 0 ? h("div", { class: "card" }, h("h3", {}, "Abona a tu deuda"), h("p", {}, `Debes ${bs(c.used_minor)}. Cuota sugerida: ${bs(c.installment_minor)}.`),
          h("div", { style: "margin-top:12px" }, btn(`Abonar ${bs(Math.min(c.installment_minor, c.used_minor))}`, (e) => runPrepare("prepare_credit_payment", { amount_minor: Math.min(c.installment_minor, c.used_minor) }, e.currentTarget), "btn btn-ghost btn-block"))) : null,
        h("section", { class: "cr-promo", "aria-labelledby": "crPromoT" },
          h("h3", { id: "crPromoT" }, "Escanea créditos en todo el ecosistema"),
          h("p", {}, "Servicios, TuGruero, Seguros Mercantil, viajes con SAGA y Estei, carros con Conduce y casas con Propiedash"),
          h("button", { type: "button", class: "cr-go", onclick: () => push("crscan") }, "Escanear mis créditos")),
        h("p", { class: "hint" }, "Simulación de demostración: no es una oferta de crédito real."));
      if ($("crAmt")) {
        $("crAmt").addEventListener("input", paintReq); paintReq();
        req.onclick = () => {
          const a = parseBs($("crAmt").value);
          if (p.intent_id && a === p.amount_minor) return ctx.confirmOp(p.intent_id, "ui");
          runPrepare("prepare_credit", { amount_minor: a }, req);
        };
      }
    },
  };

  // ---------------------------------------------------------------- Mis vehículos
  const plates = () => storeJSON.get("pd.plates", []);
  const PLATE = /^[A-Z0-9]{6,7}$/;
  shell("vehicles", "Mis vehículos");
  S.vehicles = {
    enter() {
      const pg = page("vehicles");
      const list = plates();
      const input = h("input", { class: "input", id: "plateIn", maxlength: "7", placeholder: "Ej. AB123CD", autocomplete: "off", autocapitalize: "characters", style: "text-transform:uppercase" });
      fill(pg, 
        list.length ? h("div", { class: "list" }, list.map((pl) => row("i-car", pl, "Vehículo particular", null,
          h("button", { type: "button", class: "btn btn-ghost btn-sm", onclick: () => { storeJSON.set("pd.plates", plates().filter((x) => x !== pl)); S.vehicles.enter(); } }, "Quitar")))) : emptyPlain("Sin vehículos", "Registra tu placa para pagar parquímetros más rápido."),
        h("form", { class: "card", onsubmit: (e) => {
          e.preventDefault();
          const v = input.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
          if (!PLATE.test(v)) return toast("La placa debe tener 6 o 7 letras y números");
          storeJSON.set("pd.plates", [...new Set([v, ...plates()])].slice(0, 5));
          ctx.completeTask("car");
          toast("Vehículo registrado");
          S.vehicles.enter();
        } }, h("h3", {}, "Agregar vehículo"), h("div", { class: "field", style: "margin-top:12px" }, h("label", { for: "plateIn" }, "Placa"), input),
          h("button", { type: "submit", class: "btn btn-primary btn-block", style: "margin-top:12px" }, "Agregar")));
    },
  };

  // ---------------------------------------------------------------- Parquímetros
  shell("meter", "Parquímetros", { tabs: [["park", "Estacionar", "i-meter"], ["vehicles", "Vehículos", "i-car"], ["history", "Historial", "i-history"], ["places", "Ubicaciones", "i-pin"]] });
  let meterTick = 0;
  async function activeMeter() {
    const ms = (await moves()).filter((m) => m.kind === "parking_meter");
    for (const m of ms) {
      const end = (m.created_at + Number(m.details?.quantity ?? 1) * 3600) * 1000;
      if (end > Date.now()) return { ...m, end, start: m.created_at * 1000 };
    }
    return null;
  }
  S.meter = {
    async enter(p = {}) {
      setTabs("meter", "park", (t) => (t === "park" ? S.meter.enter() : t === "vehicles" ? push("vehicles") : t === "places" ? push("locations") : S.meter.history()));
      clearInterval(meterTick);
      const pg = page("meter");
      fill(pg, loading());
      const [zones, act] = await Promise.all([catalog("parquimetros"), activeMeter()]);
      if (act && !p.product_ref) {
        const t = h("b", { class: "num" }, "");
        const bar = h("i", {});
        const paint = () => {
          const left = Math.max(0, act.end - Date.now());
          const s = Math.floor(left / 1000);
          t.textContent = `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
          bar.style.width = `${Math.round((1 - left / (act.end - act.start)) * 100)}%`;
          if (!left) { clearInterval(meterTick); S.meter.enter(); }
        };
        fill(pg, stepper(["Ubicación", "Gestión y pago", "En uso", "Finalizado"], 2),
          h("div", { class: "timer" }, h("small", {}, `${act.details?.product ?? ""} · ${act.details?.plate ?? ""}`), t, h("small", {}, "Tiempo restante"), h("div", { class: "meter" }, bar)),
          btn("Extender 1 hora", (e) => runPrepare("prepare_purchase", { product_ref: act.details?.product_ref, quantity: 1, plate: act.details?.plate }, e.currentTarget)),
          h("p", { class: "hint" }, "El parquímetro se desactiva solo al terminar el tiempo."));
        paint(); meterTick = setInterval(paint, 1000);
        return;
      }
      let zone = p.product_ref ?? zones[0]?.product_ref, hours = p.quantity ?? 1, plate = p.plate ?? plates()[0] ?? "";
      const total = h("span", { class: "num" });
      const pay = h("button", { type: "button", class: "btn btn-primary btn-block" }, "Pagar");
      const out = h("output", {}, "1");
      const minus = h("button", { type: "button", "aria-label": "Menos horas" }, "−"), plus = h("button", { type: "button", "aria-label": "Más horas" }, "+");
      const plateIn = h("input", { class: "input", id: "meterPlate", maxlength: "7", value: plate, placeholder: "Placa", autocapitalize: "characters", style: "text-transform:uppercase" });
      const paint = () => {
        const z = zones.find((x) => x.product_ref === zone);
        out.textContent = String(hours); minus.disabled = hours <= 1; plus.disabled = hours >= 8;
        total.textContent = bs((z?.price_minor ?? 0) * hours);
        pay.textContent = `Pagar ${bs((z?.price_minor ?? 0) * hours)}`;
        for (const o of pg.querySelectorAll(".opt")) o.setAttribute("aria-checked", String(o.dataset.ref === zone));
      };
      minus.onclick = () => { hours = Math.max(1, hours - 1); paint(); };
      plus.onclick = () => { hours = Math.min(8, hours + 1); paint(); };
      fill(pg, stepper(["Ubicación", "Gestión y pago", "En uso", "Finalizado"], 0),
        h("h2", {}, "Elige la zona"),
        h("div", { class: "list", role: "radiogroup", "aria-label": "Zona" }, zones.map((z) => h("button", { type: "button", class: "opt", role: "radio", "data-ref": z.product_ref, onclick: () => { zone = z.product_ref; paint(); } },
          h("span", { class: "dot", "aria-hidden": "true" }), h("span", { class: "tx", style: "flex:1" }, h("b", {}, z.name), h("small", { style: "display:block;color:var(--ink-2)" }, z.detail)), h("span", { class: "num" }, `${bs(z.price_minor)}/h`)))),
        h("div", { class: "card" },
          h("div", { class: "field" }, h("label", { for: "meterPlate" }, "Placa del vehículo"), plateIn),
          plates().length > 1 ? h("div", { class: "amounts", style: "margin-top:8px" }, plates().map((pl) => h("button", { type: "button", class: "chip", onclick: () => { plateIn.value = pl; } }, pl))) : null,
          h("div", { class: "line", style: "margin-top:16px" }, h("b", {}, "Horas"), h("div", { class: "qty" }, minus, out, plus)),
          h("div", { class: "line", style: "margin-top:16px" }, h("span", {}, "Total"), h("b", { style: "font-size:22px" }, total))),
        pay, h("p", { class: "hint" }, "Tarifas de demostración."));
      paint();
      pay.onclick = () => {
        const pl = plateIn.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (!PLATE.test(pl)) { plateIn.focus(); return toast("Escribe una placa válida (6 o 7 letras y números)"); }
        if (!plates().includes(pl)) storeJSON.set("pd.plates", [pl, ...plates()].slice(0, 5));
        if (p.intent_id && p.product_ref === zone && p.quantity === hours && (p.plate ?? "") === pl) return ctx.confirmOp(p.intent_id, "ui");
        runPrepare("prepare_purchase", { product_ref: zone, quantity: hours, plate: pl }, pay);
      };
    },
    async history() {
      setTabs("meter", "history", (t) => (t === "park" ? S.meter.enter() : t === "vehicles" ? push("vehicles") : t === "places" ? push("locations") : S.meter.history()));
      clearInterval(meterTick);
      const ms = (await moves()).filter((m) => m.kind === "parking_meter");
      fill(page("meter"), h("h2", {}, "Historial"), ms.length ? h("div", { class: "list" }, ms.map(moveItem)) : emptyPlain("Sin resultados", "Aquí verás tus parquímetros pagados."));
    },
    leave() { clearInterval(meterTick); },
  };

  // ---------------------------------------------------------------- Seguros
  shell("insurance", "Seguros", { tabs: [["buy", "Contratar", "i-shield"], ["mine", "Mis pólizas", "i-receipt"], ["history", "Historial", "i-history"]] });
  S.insurance = {
    async enter(p = {}) {
      const nav = (t) => (t === "buy" ? S.insurance.enter() : S.insurance.mine(t));
      setTabs("insurance", "buy", nav);
      const pg = page("insurance");
      fill(pg, loading());
      const items = await catalog("seguros");
      let type = p.type ?? (items.find((i) => i.product_ref === p.product_ref)?.type) ?? "vehiculos";
      const render = () => {
        const sel = p.product_ref && items.find((i) => i.product_ref === p.product_ref);
        fill(pg, stepper(["Tipo", "Pólizas", "Coberturas"], sel ? 2 : 1),
          h("div", { class: "seg", role: "tablist", "aria-label": "Tipo de seguro" },
            [["vehiculos", "Vehículos"], ["personas", "Personas"]].map(([k, l]) => h("button", { type: "button", role: "tab", "aria-selected": String(type === k), onclick: () => { type = k; p = {}; render(); } }, l))),
          h("div", { class: "list" }, items.filter((i) => i.type === type).map((i) => h("button", { type: "button", class: "item", onclick: () => { p = { product_ref: i.product_ref }; render(); } },
            h("span", { class: "ic" }, icon("i-shield")), h("span", { class: "tx" }, h("b", {}, i.name), h("small", {}, i.detail)), h("span", { class: "amt num" }, `${bs(i.price_minor)}/mes`)))),
          sel ? h("div", { class: "card" }, h("h3", {}, sel.name), h("p", {}, sel.detail),
            h("dl", { class: "kv" }, h("div", {}, h("dt", {}, "Vigencia"), h("dd", {}, "1 mes")), h("div", {}, h("dt", {}, "Prima"), h("dd", { class: "num" }, bs(sel.price_minor)))),
            h("div", { style: "margin-top:14px" }, btn(`Contratar ${bs(sel.price_minor)}`, (e) => (p.intent_id ? ctx.confirmOp(p.intent_id, "ui") : runPrepare("prepare_purchase", { product_ref: sel.product_ref, quantity: 1 }, e.currentTarget))))) : null,
          h("p", { class: "hint" }, "Pólizas y precios de demostración."));
      };
      render();
    },
    async mine(tab) {
      setTabs("insurance", tab, (t) => (t === "buy" ? S.insurance.enter() : S.insurance.mine(t)));
      const ms = (await moves()).filter((m) => m.kind === "insurance");
      const pg = page("insurance");
      if (tab === "history") return fill(pg, h("h2", {}, "Historial"), ms.length ? h("div", { class: "list" }, ms.map(moveItem)) : emptyPlain("Sin resultados", "Aquí verás los pagos de tus pólizas."));
      const active = ms.filter((m) => Date.now() - m.created_at * 1000 < 30 * 86400_000);
      fill(pg, h("h2", {}, "Mis pólizas"), active.length ? h("div", { class: "list" }, active.map((m) => row("i-shield", m.details?.product ?? m.title, `Activa hasta ${new Date(m.created_at * 1000 + 30 * 86400_000).toLocaleDateString("es-VE", { day: "2-digit", month: "short" })}`, null, h("span", { class: "pill-state ok" }, "Activa")))) : emptyPlain("Sin pólizas", "Contrata una póliza y aparecerá aquí."));
    },
  };

  // ---------------------------------------------------------------- Boletería
  shell("tickets", "Eventos", { tabs: [["avail", "Disponible", "i-ticket"], ["mine", "Mis boletos", "i-qr"], ["history", "Historial", "i-history"]] });
  S.tickets = {
    async enter(p = {}) {
      setTabs("tickets", "avail", (t) => (t === "avail" ? S.tickets.enter() : S.tickets.mine(t)));
      const pg = page("tickets");
      fill(pg, loading());
      const evs = await catalog("boleteria");
      let sel = p.product_ref, qty = p.quantity ?? 1;
      const render = () => {
        const e = evs.find((x) => x.product_ref === sel);
        const out = h("output", {}, String(qty));
        const buy = e ? btn(`Comprar ${bs(e.price_minor * qty)}`, (ev) => (p.intent_id && p.product_ref === sel && p.quantity === qty ? ctx.confirmOp(p.intent_id, "ui") : runPrepare("prepare_purchase", { product_ref: sel, quantity: qty }, ev.currentTarget))) : null;
        fill(pg, h("h2", {}, "Próximos eventos"),
          h("div", { class: "list" }, evs.map((x) => h("button", { type: "button", class: "item", "aria-pressed": String(x.product_ref === sel), style: x.product_ref === sel ? "box-shadow:inset 0 0 0 2px var(--pd),var(--shadow-card)" : null, onclick: () => { sel = x.product_ref; qty = 1; render(); } },
            h("span", { class: "ic" }, icon("i-ticket")), h("span", { class: "tx" }, h("b", {}, x.name), h("small", {}, x.detail)), h("span", { class: "amt num" }, bs(x.price_minor))))),
          e ? h("div", { class: "card" }, h("div", { class: "line" }, h("b", {}, "Boletos"),
            h("div", { class: "qty" }, h("button", { type: "button", "aria-label": "Menos boletos", disabled: qty <= 1, onclick: () => { qty--; render(); } }, "−"), out,
              h("button", { type: "button", "aria-label": "Más boletos", disabled: qty >= 6, onclick: () => { qty++; render(); } }, "+"))),
            h("div", { style: "margin-top:14px" }, buy)) : h("p", { class: "hint" }, "Toca un evento para elegir tus boletos."),
          h("p", { class: "hint" }, "Eventos de demostración."));
      };
      render();
    },
    async mine(tab) {
      setTabs("tickets", tab, (t) => (t === "avail" ? S.tickets.enter() : S.tickets.mine(t)));
      const ms = (await moves()).filter((m) => m.kind === "tickets");
      const pg = page("tickets");
      if (tab === "history") return fill(pg, h("h2", {}, "Historial"), ms.length ? h("div", { class: "list" }, ms.map(moveItem)) : emptyPlain("Sin resultados", "Aquí verás tus compras de boletos."));
      fill(pg, h("h2", {}, "Mis boletos"));
      if (!ms.length) return pg.append(emptyPlain("Sin boletos", "Compra un boleto y aparecerá aquí con su código QR."));
      for (const m of ms) {
        const qr = h("div", { class: "qrbox" });
        pg.append(h("div", { class: "card pass" }, h("div", {}, h("h3", {}, m.details?.product ?? m.title), h("p", {}, `${m.details?.quantity ?? 1} boleto(s) · ref. ${m.operation_ref.slice(-8)}`)), qr));
        drawQR(qr, `PD-BOLETO:${m.operation_ref}`);
      }
    },
  };

  // ---------------------------------------------------------------- código QR
  let qrLib = null;
  const loadQR = () => (qrLib ??= new Promise((ok, ko) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js";
    s.onload = () => (window.qrcode ? ok(window.qrcode) : ko(new Error("qr")));
    s.onerror = () => { qrLib = null; ko(new Error("qr")); };
    document.head.append(s);
  }));
  async function drawQR(el, text) {
    try {
      const qrcode = await loadQR();
      const q = qrcode(0, "M"); q.addData(text); q.make();
      el.innerHTML = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
    } catch { el.textContent = text; }
  }
  shell("qr", "Código QR");
  S.qr = {
    enter() {
      const box = h("div", { class: "qr-big" });
      const user = ctx.user();
      fill(page("qr"), h("div", { style: "text-align:center" }, box, h("h2", { style: "font-size:22px" }, user), h("p", { class: "hint" }, "Muestra este código para recibir pagos en tu wallet.")),
        btn("Compartir", () => share(`Págame por PagoDirecto: ${user}`), "btn btn-ghost btn-block"));
      drawQR(box, `pagodirecto:${user}`);
    },
  };
  async function share(text) {
    const url = location.origin;
    try { if (navigator.share) return await navigator.share({ title: "PagoDirecto", text, url }); } catch { return; }
    try { await navigator.clipboard.writeText(`${text} ${url}`); toast("Copiado al portapapeles"); } catch { toast(url); }
  }
  ctx.share = share;

  // ---------------------------------------------------------------- facturas y cobros
  shell("invoices", "Facturas");
  S.invoices = {
    async enter() {
      const pg = page("invoices");
      fill(pg, loading());
      const ms = (await moves()).filter((m) => m.amount_minor < 0);
      fill(pg, ms.length ? h("div", { class: "list" }, ms.map((m) => { const it = moveItem(m); it.querySelector("small").textContent = `${when(m.created_at)} · ref. ${m.operation_ref.slice(-8)}`; return it; })) : emptyPlain("Sin resultados", "Tus comprobantes aparecerán aquí."));
    },
  };
  shell("charge", "Cobrar por wallet");
  S.charge = {
    enter() {
      const concept = h("input", { class: "input", id: "chConcept", maxlength: "40", placeholder: "Ej. Almuerzo", autocomplete: "off" });
      fill(page("charge"), moneyField("chAmt", 100_00, "Monto a cobrar"),
        h("div", { class: "field" }, h("label", { for: "chConcept" }, "Concepto"), concept),
        btn("Compartir cobro", () => {
          const a = parseBs($("chAmt").value);
          if (!a) return toast("Escribe un monto válido");
          share(`Págame ${bs(a)}${concept.value.trim() ? ` por ${concept.value.trim()}` : ""} a ${ctx.user()} en PagoDirecto`);
        }),
        h("p", { class: "hint" }, "Quien reciba el enlace te paga desde su wallet, sin comisión."));
    },
  };

  // ---------------------------------------------------------------- Mis cuentas
  const BANKS = ["Banco de Venezuela", "Banesco", "Mercantil", "Provincial", "Bancamiga", "BNC"];
  shell("accounts", "Mis cuentas");
  S.accounts = {
    enter() {
      const list = storeJSON.get("pd.accounts", []);
      const bank = h("select", { class: "input", id: "accBank" }, BANKS.map((b) => h("option", {}, b)));
      const last = h("input", { class: "input num", id: "accLast", inputmode: "numeric", maxlength: "4", placeholder: "1234", autocomplete: "off" });
      fill(page("accounts"), 
        h("div", { class: "picked" }, icon("i-bank", 26), h("span", { class: "tx" }, h("b", {}, "Wallet PagoDirecto"), h("small", {}, h("span", { class: "js-bal num" }, bs(state.balance ?? 0))))),
        list.length ? h("div", { class: "list" }, list.map((a, i) => row("i-bank", a.bank, `Cuenta •••• ${a.last}`, null,
          h("button", { type: "button", class: "btn btn-ghost btn-sm", onclick: () => { const l = storeJSON.get("pd.accounts", []); l.splice(i, 1); storeJSON.set("pd.accounts", l); S.accounts.enter(); } }, "Quitar")))) : null,
        h("form", { class: "card", onsubmit: (e) => {
          e.preventDefault();
          if (!/^\d{4}$/.test(last.value)) return toast("Escribe los 4 últimos dígitos");
          storeJSON.set("pd.accounts", [...storeJSON.get("pd.accounts", []), { bank: bank.value, last: last.value }].slice(-4));
          toast("Cuenta afiliada"); S.accounts.enter();
        } }, h("h3", {}, "Afilia tu cuenta bancaria"), h("p", {}, "Solo guardamos el banco y los 4 últimos dígitos, en este navegador."),
          h("div", { class: "field", style: "margin-top:12px" }, h("label", { for: "accBank" }, "Banco"), bank),
          h("div", { class: "field", style: "margin-top:12px" }, h("label", { for: "accLast" }, "Últimos 4 dígitos"), last),
          h("button", { type: "submit", class: "btn btn-primary btn-block", style: "margin-top:14px" }, "Afiliar")));
    },
  };

  // ---------------------------------------------------------------- perfil, premium, ubicaciones
  shell("profile", "Mi perfil", { help: false });
  S.profile = {
    enter() {
      const input = h("input", { class: "input", id: "userIn", value: ctx.user(), maxlength: "21", autocomplete: "off", autocapitalize: "none" });
      fill(page("profile"), 
        h("div", { style: "text-align:center" }, h("img", { src: "/assets/pd/user_home.png", alt: "", width: "88", height: "88", style: "border-radius:50%;margin:6px auto 8px;box-shadow:0 0 0 3px var(--pd)" }), h("h2", { style: "font-size:22px" }, ctx.user()), h("p", { class: "hint" }, `Nivel Turista · ${ctx.points()} pts del Club`)),
        h("form", { class: "card", onsubmit: (e) => {
          e.preventDefault();
          const v = "@" + input.value.replace(/^@/, "").trim();
          if (!/^@[\w.]{3,20}$/.test(v)) return toast("Usa de 3 a 20 letras, números, punto o guion bajo");
          store.set("pd.user", v); ctx.paintUser(); toast("Perfil guardado"); S.profile.enter();
        } }, h("div", { class: "field" }, h("label", { for: "userIn" }, "Nombre de usuario"), input),
          h("button", { type: "submit", class: "btn btn-primary btn-block", style: "margin-top:14px" }, "Guardar")),
        h("p", { class: "hint" }, "Demo sin registro: tu perfil, saldo y movimientos se guardan en este navegador."));
    },
  };
  shell("premium", "Planes premium");
  S.premium = { enter() { fill(page("premium"), emptyPlain("Próximamente", "Los planes premium aún no están disponibles en esta demo.")); } };
  shell("locations", "Ubicaciones disponibles");
  S.locations = {
    async enter() {
      const pg = page("locations");
      fill(pg, loading());
      const zones = await catalog("parquimetros");
      fill(pg, h("h2", {}, "Parquímetros"), h("div", { class: "list" }, zones.map((z) => row("i-meter", z.name, `${z.detail} · ${bs(z.price_minor)}/h`, () => push("meter", { product_ref: z.product_ref })))),
        h("h2", {}, "Estacionamientos"), h("div", { class: "list" }, row("i-car", "Ticket físico", "Escanea el QR del ticket en la taquilla", () => ctx.scanFromUI())));
    },
  };

  // ---------------------------------------------------------------- racha y notificaciones
  shell("streak", "Racha de pagos", { help: false });
  S.streak = {
    async enter() {
      const pg = page("streak");
      fill(pg, loading());
      const ms = (await moves()).filter((m) => m.amount_minor < 0);
      const now = new Date(), monday = new Date(now); monday.setHours(0, 0, 0, 0); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      const week = ms.filter((m) => m.created_at * 1000 >= monday.getTime());
      const days = new Set(week.map((m) => (new Date(m.created_at * 1000).getDay() + 6) % 7));
      const today = (now.getDay() + 6) % 7, n = Math.min(3, week.length);
      fill(pg, 
        h("div", { class: "card" }, h("div", { class: "streak-n" }, h("b", {}, String(n)), h("span", {}, "de 3 pagos")),
          h("div", { class: "week" }, ["L", "M", "M", "J", "V", "S", "D"].map((d, i) => h("span", {}, h("i", { class: (days.has(i) ? "on" : "") + (i === today ? " today" : ""), "aria-label": `${d}: ${days.has(i) ? "con pago" : "sin pago"}` }, days.has(i) ? "✓" : ""), d))),
          h("dl", { class: "kv" }, h("div", {}, h("dt", {}, "Racha de 7 días"), h("dd", {}, `${n} / 3 pagos`)), h("div", {}, h("dt", {}, "Multiplicador"), h("dd", { style: `color:${n >= 3 ? "var(--ok)" : "var(--ink-2)"}` }, n >= 3 ? "×1,5 activo" : "Apagado")))),
        h("h2", {}, n >= 3 ? "¡Racha activa!" : "Paga y entra en racha"),
        h("p", { class: "hint", style: "margin-top:-8px" }, "Cualquiera de estos pagos suma:"),
        h("div", { class: "list" }, state.services.slice(0, 3).map((s) => row("i-receipt", s.name, "Paga tu factura", () => push("pay", { service_ref: s.service_ref }))), row("i-car", "Estacionamiento", "Escanea tu ticket", () => ctx.scanFromUI())));
    },
  };
  shell("notifs", "Notificaciones", { help: false });
  S.notifs = {
    async enter(tab = "push") {
      const pg = page("notifs");
      const tabs = h("div", { class: "seg", role: "tablist", "aria-label": "Tipo de notificación" },
        [["push", "Push"], ["coupons", "Cupones"], ["collection", "Colección"]].map(([k, l]) => h("button", { type: "button", role: "tab", "aria-selected": String(k === tab), onclick: () => S.notifs.enter(k) }, l)));
      fill(pg, tabs, loading());
      if (tab !== "push") return fill(pg, tabs, emptyPlain("Sin resultados", tab === "coupons" ? "No tienes cupones por ahora." : "Aún no tienes coleccionables."));
      const ms = await moves();
      store.set("pd.seen", String(Math.floor(Date.now() / 1000)));
      ctx.paintBell();
      fill(pg, tabs, ms.length ? h("div", { class: "list" }, ms.map((m) => row("i-bell", m.amount_minor > 0 ? `Recibiste ${bs(m.amount_minor)}` : `Pagaste ${bs(-m.amount_minor)}`, `${m.title} · ${when(m.created_at)}`))) : emptyPlain("Sin resultados", "Te avisaremos de cada pago aquí."));
    },
  };

  // ---------------------------------------------------------------- Asistencia
  shell("help", "Asistencia", { help: false });
  S.help = {
    enter() {
      const FAQ = [
        ["¿Es dinero real?", "No. Es una demo con saldo simulado de Bs 5.000. Ningún pago sale a bancos."],
        ["¿Cómo confirma Wisi un pago?", "Wisi solo prepara la operación. El pago se ejecuta cuando tú confirmas con tu huella en la hoja de confirmación."],
        ["¿Dónde se guardan mis datos?", "Sin login: tu identificador, perfil, vehículos, cuentas y puntos viven en cookies de este navegador. Saldo y movimientos, en el servidor, ligados a esa cookie."],
        ["¿Cómo empiezo de cero?", "Menú → Cerrar sesión borra tus cookies y crea una demo nueva con Bs 5.000."],
      ];
      fill(page("help"), 
        h("div", { class: "rowlist" },
          row("i-chat", "Habla con Wisi", "Resuelve y paga por voz o chat", () => openWisi()),
          row("i-mail", "Abrir un caso de soporte", "Te contactamos por la app", async (e) => {
            const b = e.currentTarget; b.disabled = true;
            try { const r = await callTool("create_support_case", { category: "general", summary: "Solicitud desde Asistencia" }); toast(r.speech || "Caso abierto"); } catch { toast("Sin conexión. Inténtalo de nuevo."); }
            b.disabled = false;
          })),
        h("h2", {}, "Preguntas frecuentes"),
        h("div", { class: "faq" }, FAQ.map(([q, a]) => h("details", {}, h("summary", {}, q), h("p", {}, a)))));
    },
  };

  // ---------------------------------------------------------------- Jomi
  shell("jomi", "Jomi");
  S.jomi = {
    enter() {
      const CATS = [["Línea blanca", "Neveras, lavadoras y cocinas"], ["Mecánica", "Tu carro, donde estés"], ["Electricidad", "Instalaciones y averías"], ["Construcción", "Remodelaciones y albañilería"], ["Plomería", "Fugas y destapes"]];
      fill(page("jomi"), h("h2", {}, "Pídelo acá. Con Jomi resuelves."),
        h("div", { class: "rowlist" }, CATS.map(([name, sub]) => row("i-user", name, sub, async (e) => {
          const b = e.currentTarget; b.disabled = true;
          try { await callTool("create_support_case", { category: "general", summary: `Jomi: ${name}` }); toast(`Pedimos un técnico de ${name.toLowerCase()}. Te contactamos pronto.`); }
          catch { toast("Sin conexión. Inténtalo de nuevo."); }
          b.disabled = false;
        }))),
        h("p", { class: "hint" }, "Solicitud de demostración: nadie va a tu casa."));
    },
  };

  // Revisión genérica de lo que preparó Wisi (recarga, crédito, compras).
  shell("review", "Revisa y confirma", { help: false });
  S.review = {
    enter(op) {
      if (!op) return;
      fill(page("review"), 
        h("div", { class: "card" }, h("p", { style: "margin:0" }, "Wisi preparó esta operación"), h("h3", { style: "font-size:20px;margin-top:4px" }, op.k.t(op.s)),
          op.k.sub(op.s) ? h("p", {}, op.k.sub(op.s)) : null,
          h("p", { class: "num", style: "font-size:32px;font-weight:700;color:var(--ink);margin-top:10px" }, bs(op.s.amount_minor ?? 0))),
        btn(`Confirmar ${bs(op.s.amount_minor ?? 0)}`, () => ctx.confirmOp(op.id, "ui")),
        btn("Cancelar", () => { ctx.cancelOp(op.id); ctx.pop(); }, "btn btn-ghost btn-block"));
    },
  };

  return S;
}
