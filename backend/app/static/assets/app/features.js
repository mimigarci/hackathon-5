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
  const moveItem = (m) => ctx.moveRow(m);
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
    ["cuentas_nacionales", "Cuentas Nacionales", "Desde la app", "debito_inmediato"],
    ["pago_movil", "Pago Móvil", "Desde tu banco", "pago_movil"],
    ["bdv", "Banco de Venezuela", "Desde la app", "bdv"],
    ["humaniz", "Humaniz", "Desde la app", "humaniz"],
  ];
  shell("deposit", "Depositar fondos");
  S.deposit = {
    enter(p = {}) {
      const pg = page("deposit");
      if (!p.method) {
        fill(pg, h("h2", {}, "¿Cómo deseas recargar tu wallet?"),
          h("div", { class: "rowlist" }, METHODS.map(([ref, name, sub, img]) => h("button", { type: "button", class: "item method", onclick: () => S.deposit.enter({ method: ref, amount_minor: p.amount_minor }) },
            h("span", { class: "ic logo" }, h("img", { src: `/assets/pd/dep/deposit_method_${img}.svg`, alt: "" })), h("span", { class: "tx" }, h("b", {}, name), h("small", {}, sub)), h("span", { html: '<svg class="chev"><use href="#i-chev"/></svg>' }).firstChild))),
          h("p", { class: "hint" }, "Recarga simulada: en esta demo no se mueve dinero real."));
        return;
      }
      const chosen = METHODS.find((m) => m[0] === p.method) ?? METHODS[1];
      const name = chosen[1];
      const go = h("button", { type: "button", class: "btn btn-primary btn-block" }, "Recargar");
      const paint = () => { const a = parseBs($("depAmt").value); go.textContent = a ? `Recargar ${bs(a)}` : "Recargar"; };
      fill(pg, 
        h("div", { class: "picked" }, h("img", { src: `/assets/pd/dep/deposit_method_${chosen[3]}.svg`, alt: "", width: "34", height: "34", style: "object-fit:contain" }), h("span", { class: "tx" }, h("b", {}, name), h("small", {}, "Llega al instante a tu wallet"))),
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
          h("span", { class: "brand", html: '<img src="/assets/pd/cr/credirecto_isotipo.svg" alt="" /><img class="wm" src="/assets/pd/cr/credirecto_wordmark.svg" alt="Credirecto" />' }),
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
            i.type === "vehiculos" ? h("span", { class: "ic logo" }, h("img", { src: "/assets/pd/logos/ccs_rcv.png", alt: "" })) : h("span", { class: "ic" }, icon("i-shield")), h("span", { class: "tx" }, h("b", {}, i.name), h("small", {}, i.detail)), h("span", { class: "amt num" }, `${bs(i.price_minor)}/mes`)))),
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

  // ---------------------------------------------------------------- Servicios (formularios de cada proveedor)
  const DOC_TYPES = ["V", "E", "J", "P", "G"];
  const phone = (prefixes, error) => ({ id: "phone", kind: "prefix", label: "Número de teléfono", hint: "1234567", options: prefixes, min: 7, max: 7, error });
  const AMOUNT = { id: "amount", kind: "amount", label: "Monto a recargar" };
  const contract = (hint = "123456789") => ({ id: "contract", kind: "text", label: "Número de contrato", hint, min: 6, max: 14 });
  const doc = (label = "Número de documento") => ({ id: "document", kind: "document", label, hint: "12345678", min: 6, max: 10 });
  const single = (...fields) => [{ label: "", cta: "query", fields }];
  const SVC_FORMS = {
    digitel: [{ label: "Prepago", cta: "pay", fields: [phone(["0412", "0422"]), AMOUNT] }, { label: "Postpago", cta: "query", fields: [phone(["0412", "0422"], "Ingrese un número de contrato válido")] }],
    movilnet: [{ label: "Prepago", cta: "pay", fields: [phone(["0416", "0426"]), AMOUNT] }, { label: "Postpago", cta: "query", fields: [contract()] }],
    movistar: [{ label: "Prepago", cta: "pay", fields: [phone(["0414", "0424"]), AMOUNT] }, { label: "Postpago", cta: "query", fields: [contract(), { id: "service_type", kind: "select", label: "Tipo de servicio", options: ["Telefonía Celular o Internet Móvil", "Telefonía Fija"] }] }],
    simpletv: single(contract("0000000000")),
    inter: single(doc()),
    cantv: single({ id: "phone", kind: "text", label: "Número de teléfono", hint: "1234567", min: 7, max: 10 }),
    corpoelec: single(doc()),
    thundernet: single(doc()),
    dlm: single({ id: "condo", kind: "select", label: "Condominio", options: ["Residencias Los Samanes", "Conjunto El Parque"] }, { id: "unit", kind: "select", label: "Inmueble", options: ["Apto 4-B", "Apto 7-A", "Local 2"] }),
    globalsystem: single(doc("Número de cédula")),
    starmoviles: single({ id: "document", kind: "text", label: "Documento / Cédula", hint: "12345678", min: 6, max: 10 }),
    fibex: single(doc()),
  };
  const RECHARGE = [100_00, 200_00, 300_00, 500_00, 1_000_00, 2_000_00];
  const svcOf = (ref) => state.services.find((x) => x.service_ref === ref);
  function fieldEl(f, value) {
    const id = `svc-${f.id}`;
    const err = h("span", { class: "err-msg", hidden: true }, f.error ?? `Revisa: ${f.label.toLowerCase()}.`);
    const textIn = () => h("input", { class: "input num", id, inputmode: "numeric", autocomplete: "off", placeholder: f.hint, maxlength: f.max ?? 20 });
    let ctrl, read;
    if (f.kind === "prefix" || f.kind === "document") {
      const sel = h("select", { class: "input", "aria-label": f.kind === "prefix" ? "Prefijo" : "Tipo de documento" }, (f.options ?? DOC_TYPES).map((o) => h("option", {}, o)));
      const inp = textIn();
      ctrl = h("div", { class: "input-row" }, sel, inp);
      read = () => { const v = inp.value.replace(/\D/g, ""); return v.length >= (f.min ?? 1) ? (f.kind === "prefix" ? sel.value + v : `${sel.value}-${v}`) : null; };
      if (value) inp.value = String(value).replace(/\D/g, "").slice(f.kind === "prefix" ? -7 : 0);
    } else if (f.kind === "select" || f.kind === "amount") {
      ctrl = h("select", { class: "input", id }, f.kind === "amount" ? RECHARGE.map((a) => h("option", { value: a }, bs(a))) : f.options.map((o) => h("option", {}, o)));
      read = () => ctrl.value;
    } else {
      ctrl = textIn();
      if (value) ctrl.value = String(value).replace(/\D/g, "");
      read = () => { const v = ctrl.value.replace(/\D/g, ""); return v.length >= (f.min ?? 1) ? v : null; };
    }
    return { f, read, err, el: h("div", { class: "field" }, h("label", { for: id }, f.label), ctrl, err) };
  }
  function rememberService(svc, account) {
    storeJSON.set("pd.directory", [{ service_ref: svc.service_ref, name: svc.name, account }, ...storeJSON.get("pd.directory", []).filter((x) => x.account !== account)].slice(0, 6));
  }
  S.pay = {
    enter(p = {}) {
      const svc = svcOf(p.service_ref) ?? state.services[0];
      if (!svc) return;
      state.payBound = p.intent_id ? { intent_id: p.intent_id } : null;
      const pg = $("payPage");
      const modes = SVC_FORMS[svc.service_ref] ?? single(contract());
      const brand = ctx.logoOf(svc.service_ref) ? h("img", { class: "svc-brand", src: ctx.logoOf(svc.service_ref), alt: svc.name }) : h("h2", { style: "text-align:center" }, svc.name);
      const render = (idx) => {
        const m = modes[idx];
        const account = m.fields.find((f) => f.id !== "amount" && f.kind !== "select");
        const fields = m.fields.map((f) => fieldEl(f, f === account ? p.account_number : null));
        const read = () => {
          let ok = true; const out = {};
          for (const x of fields) { const v = x.read(); x.err.hidden = !!v; if (!v) ok = false; out[x.f.id] = v; }
          if (!ok) return null;
          out.account = Object.entries(out).filter(([k]) => k !== "amount" && k !== "service_type").map(([, v]) => v).join(" · ");
          return out;
        };
        const debtBox = h("div", { hidden: true });
        const pay = async (data, amount, b) => {
          rememberService(svc, data.account);
          if (state.payBound?.intent_id && p.amount_minor === amount) return ctx.confirmOp(state.payBound.intent_id, "ui");
          return runPrepare("prepare_payment", { service_ref: svc.service_ref, account_number: data.account, amount_minor: amount }, b);
        };
        const showDebt = (data, amount) => {
          debtBox.hidden = false;
          fill(debtBox, h("div", { class: "card" }, h("div", { class: "debt" }, h("span", {}, "Deuda pendiente"), h("b", { class: "num" }, bs(amount))), h("p", {}, `${svc.name} · ${data.account}`),
            h("div", { style: "margin-top:14px" }, btn(`Pagar ${bs(amount)}`, (e) => pay(data, amount, e.currentTarget)))));
        };
        const cta = h("button", { type: "button", class: "btn btn-primary btn-block" }, m.cta === "pay" ? "Pagar" : "Consultar");
        cta.onclick = async () => {
          const data = read(); if (!data) return;
          if (m.cta === "pay") return pay(data, Number(data.amount), cta);
          cta.classList.add("loading");
          await ctx.sleep(500);
          cta.classList.remove("loading");
          showDebt(data, p.amount_minor ?? svc.sample_pending_minor);
        };
        fill(pg, brand,
          modes.length > 1 ? h("div", { class: "seg", role: "tablist", "aria-label": "Modalidad" }, modes.map((x, i) => h("button", { type: "button", role: "tab", "aria-selected": String(i === idx), onclick: () => render(i) }, x.label))) : null,
          fields.map((x) => x.el), cta, debtBox, h("p", { class: "hint" }, "Deuda y montos de demostración."));
        if (p.intent_id && p.account_number) { const d = read(); if (d) showDebt({ ...d, account: p.account_number }, p.amount_minor ?? svc.sample_pending_minor); else showDebt({ account: p.account_number }, p.amount_minor ?? svc.sample_pending_minor); }
      };
      render(p.intent_id && modes.length > 1 ? 1 : 0);
    },
  };
  // Directorio / Programar / Historial, abajo en Servicios como en la app
  {
    const nav = h("nav", { class: "subtabs", "aria-label": "Opciones de servicios" });
    for (const [name, label, ic] of [["directory", "Directorio", "i-user"], ["schedule", "Programar", "i-history"], ["svchistory", "Historial", "i-receipt"]])
      nav.append(h("button", { type: "button", onclick: () => push(name) }, icon(ic, 24), label));
    $("s-services").append(nav);
  }
  shell("directory", "Directorio");
  S.directory = {
    enter() {
      const list = storeJSON.get("pd.directory", []);
      fill(page("directory"), list.length ? h("div", { class: "list" }, list.map((x) => h("button", { type: "button", class: "item", onclick: () => push("pay", { service_ref: x.service_ref, account_number: x.account }) },
        ctx.logoOf(x.service_ref) ? h("span", { class: "ic logo" }, h("img", { src: ctx.logoOf(x.service_ref), alt: "" })) : h("span", { class: "ic" }, icon("i-receipt")),
        h("span", { class: "tx" }, h("b", {}, x.name), h("small", {}, x.account))))) : emptyPlain("Directorio vacío", "Los servicios que pagues quedan guardados aquí."));
    },
  };
  shell("schedule", "Programar pago");
  S.schedule = {
    enter() {
      const payable = state.services.filter((x) => x.sample_pending_minor > 0 && x.service_ref !== "condominio");
      const svc = h("select", { class: "input", id: "scSvc" }, payable.map((x) => h("option", { value: x.service_ref }, x.name)));
      const acct = h("input", { class: "input num", id: "scAcct", inputmode: "numeric", maxlength: "14", autocomplete: "off", placeholder: "Teléfono, contrato o documento" });
      const date = h("input", { class: "input", id: "scDate", type: "date", min: new Date().toISOString().slice(0, 10) });
      fill(page("schedule"), h("div", { class: "field" }, h("label", { for: "scSvc" }, "Elige el servicio"), svc),
        h("div", { class: "field" }, h("label", { for: "scAcct" }, "Número"), acct), moneyField("scAmt", 100_00, "Monto"),
        h("div", { class: "field" }, h("label", { for: "scDate" }, "Fecha"), date),
        btn("Programar", () => {
          const a = parseBs($("scAmt").value), s0 = svcOf(svc.value);
          if (!acct.value.trim() || !a || !date.value) return toast("Completa el número, el monto y la fecha");
          storeJSON.set("pd.scheduled", [...storeJSON.get("pd.scheduled", []), { service_ref: s0.service_ref, name: s0.name, account: acct.value.trim(), amount_minor: a, date: date.value }].slice(-6));
          toast("Pago programado"); ctx.pop(); go("pagos"); $("payFilter").querySelector('[data-f="prog"]').click();
        }), h("p", { class: "hint" }, "En esta demo el pago programado se guarda, pero no se ejecuta solo."));
    },
  };
  shell("svchistory", "Historial");
  S.svchistory = {
    async enter() {
      const pg = page("svchistory");
      fill(pg, loading());
      const ms = (await moves()).filter((m) => m.kind === "payment");
      fill(pg, ms.length ? h("div", { class: "list" }, ms.map(moveItem)) : emptyPlain("Sin resultados", "Aquí verás tus pagos de servicios."));
    },
  };

  // ---------------------------------------------------------------- TuGruero
  shell("tugruero", "Servicios", { tabs: [["buy", "Adquirir plan", "i-plus"], ["history", "Historial", "i-history"], ["support", "Soporte", "i-chat"]] });
  const PLAN_IMG = (n) => `/assets/pd/svc/membership_${/gold/i.test(n) ? "gold" : /plus/i.test(n) ? "plus" : /retro/i.test(n) ? "retro" : /moto/i.test(n) ? "moto" : "classic"}.png`;
  const tgNav = (t) => (t === "buy" ? S.tugruero.enter() : t === "history" ? S.tugruero.history() : push("help"));
  S.tugruero = {
    enter(p = {}) {
      setTabs("tugruero", "buy", tgNav);
      const logo = h("img", { class: "svc-brand", src: "/assets/pd/svc/tugruero_logo.png", alt: "TuGruero" });
      if (p.product_ref) return S.tugruero.plans(p.product_ref.startsWith("tg_m") ? "moto" : "vehiculos", p.product_ref.endsWith("_a") ? "a" : "m", p);
      fill(page("tugruero"), stepper(["Servicios", "Gestionar", "Listo"], 1), logo, h("div", { class: "pick-grid" },
        [["vehiculos", "Vehículos", "vehiculo"], ["moto", "Moto", "moto"]].map(([k, l, img]) => h("button", { type: "button", class: "card-pick", onclick: () => S.tugruero.plans(k, "a") }, h("img", { src: `/assets/pd/svc/${img}.png`, alt: "" }), l))));
    },
    async plans(cat, period, p = {}) {
      const pg = page("tugruero");
      fill(pg, loading());
      const all = await catalog("tugruero");
      let sel = p.product_ref ?? null;
      const items = all.filter((i) => i.type === `${cat}_${period}`);
      const render = () => {
        const it = items.find((x) => x.product_ref === sel);
        const buy = h("button", { type: "button", class: "btn btn-primary btn-block", disabled: !it }, it ? `Adquirir ${bs(it.price_minor)}` : "Adquirir");
        buy.onclick = () => (p.intent_id && p.product_ref === sel ? ctx.confirmOp(p.intent_id, "ui") : runPrepare("prepare_purchase", { product_ref: sel, quantity: 1 }, buy));
        fill(pg, stepper(["Servicios", "Gestionar", "Listo"], 1), h("h2", {}, "Planes disponibles"),
          h("div", { class: "seg", role: "tablist", "aria-label": "Periodo" }, [["a", "Anuales"], ["m", "Mensuales"]].map(([k, l]) => h("button", { type: "button", role: "tab", "aria-selected": String(k === period), onclick: () => S.tugruero.plans(cat, k) }, l))),
          h("div", { class: "pick-grid" }, items.map((x) => h("button", { type: "button", class: "card-pick", "aria-pressed": String(x.product_ref === sel), onclick: () => { sel = x.product_ref; render(); } },
            h("img", { src: PLAN_IMG(x.name), alt: "" }), h("span", {}, x.name.split(" ")[0]), h("span", { class: "plan-price" }, "Desde", h("b", { class: "num" }, bs(x.price_minor)))))),
          it ? h("p", { class: "hint" }, it.detail) : null, buy, h("p", { class: "hint" }, "Precios de demostración."));
      };
      render();
    },
    async history() {
      setTabs("tugruero", "history", tgNav);
      const ms = (await moves()).filter((m) => m.kind === "tow_plan");
      fill(page("tugruero"), h("h2", {}, "Historial"), ms.length ? h("div", { class: "list" }, ms.map(moveItem)) : emptyPlain("Sin resultados", "Aquí verás tus planes de TuGruero."));
    },
  };

  // ---------------------------------------------------------------- Jomi
  shell("jomi", "Jomi");
  const JOMI = [["Plomería", "plomeria"], ["Mecánica", "mecanica"], ["Línea blanca", "linea_blanca"], ["Electricidad", "electricidad"], ["Construcción", "construccion"]];
  S.jomi = {
    enter() {
      fill(page("jomi"), h("img", { class: "svc-brand", src: "/assets/pd/svc/jomi_wordmark.png", alt: "Jomi", style: "max-height:44px" }), h("h2", {}, "¿Qué necesitas resolver?"),
        h("div", { class: "pick-grid" }, JOMI.map(([name, img]) => h("button", { type: "button", class: "card-pick", onclick: () => S.jomi.form(name) }, h("img", { src: `/assets/pd/svc/${img}.png`, alt: "", style: "height:56px" }), name))));
    },
    form(cat) {
      const nameIn = h("input", { class: "input", id: "joName", maxlength: "60", autocomplete: "off", value: store.get("pd.joname", "") });
      const phoneIn = h("input", { class: "input num", id: "joPhone", inputmode: "tel", maxlength: "16", autocomplete: "off", placeholder: "0414-1234567" });
      const addr = h("input", { class: "input", id: "joAddr", maxlength: "120", autocomplete: "off" });
      const desc = h("textarea", { class: "input", id: "joDesc", rows: "3", maxlength: "280", placeholder: "Opcional" });
      const go2 = h("button", { type: "button", class: "btn btn-primary btn-block", disabled: true }, "Continuar");
      const check = () => { go2.disabled = !(nameIn.value.trim() && phoneIn.value.trim().length >= 7 && addr.value.trim()); };
      for (const i of [nameIn, phoneIn, addr]) i.addEventListener("input", check);
      go2.onclick = async () => {
        go2.classList.add("loading");
        try {
          await callTool("create_support_case", { category: "general", summary: `Jomi ${cat}: ${desc.value.trim() || "sin descripción"}` });
          store.set("pd.joname", nameIn.value.trim());
          fill(page("jomi"), h("div", { class: "empty-plain" }, h("b", {}, "¡Solicitud enviada!"), `Jomi te contactará para coordinar tu servicio de ${cat.toLowerCase()}.`), btn("Volver", () => ctx.pop(), "btn btn-ghost btn-block"));
        } catch { toast("Sin conexión. Inténtalo de nuevo."); }
        go2.classList.remove("loading");
      };
      fill(page("jomi"), h("h2", {}, `Tus datos · ${cat}`),
        h("div", { class: "field" }, h("label", { for: "joName" }, "Nombre completo*"), nameIn),
        h("div", { class: "field" }, h("label", { for: "joPhone" }, "Teléfono*"), phoneIn),
        h("div", { class: "field" }, h("label", { for: "joAddr" }, "Dirección*"), addr),
        h("div", { class: "field" }, h("label", { for: "joDesc" }, "Descripción del problema"), desc),
        h("p", { class: "hint" }, "Al continuar, Jomi te contactará para coordinar el servicio. Solicitud de demostración."), go2);
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
