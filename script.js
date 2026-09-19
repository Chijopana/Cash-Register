/* =============================================================
   CAJA REGISTRADORA · v3
   -------------------------------------------------------------
   Proyecto "Cash Register" (freeCodeCamp) ampliado a un pequeño
   TPV: cajón con inventario real por denominación, historial,
   deshacer, recibo imprimible y persistencia local.

   Regla de oro: TODO el dinero vive en CENTAVOS (enteros).
   Nunca se suman ni restan flotantes, así que desaparecen los
   parches de redondeo del tipo Math.round(x * 100) / 100.
   ============================================================= */
(() => {
  "use strict";

  /* ===========================================================
     1 · DOMINIO  (funciones puras, sin DOM: fáciles de probar)
     =========================================================== */

  /** Denominaciones de mayor a menor. `unit` está en centavos. */
  const DENOMS = [
    { id: "ONE HUNDRED", label: "$100", unit: 10000, kind: "bill" },
    { id: "TWENTY",      label: "$20",  unit: 2000,  kind: "bill" },
    { id: "TEN",         label: "$10",  unit: 1000,  kind: "bill" },
    { id: "FIVE",        label: "$5",   unit: 500,   kind: "bill" },
    { id: "ONE",         label: "$1",   unit: 100,   kind: "bill" },
    { id: "QUARTER",     label: "25¢",  unit: 25,    kind: "coin" },
    { id: "DIME",        label: "10¢",  unit: 10,    kind: "coin" },
    { id: "NICKEL",      label: "5¢",   unit: 5,     kind: "coin" },
    { id: "PENNY",       label: "1¢",   unit: 1,     kind: "coin" },
  ];

  /** Cajón inicial de freeCodeCamp, expresado en UNIDADES de cada pieza. */
  const INITIAL_DRAWER = {
    "ONE HUNDRED": 1, TWENTY: 3, TEN: 2, FIVE: 11, ONE: 90,
    QUARTER: 17, DIME: 31, NICKEL: 41, PENNY: 101,
  };

  const DEFAULT_PRICE = 1950;    // $19.50
  const MAX_CASH      = 1000000; // $10 000 · tope de seguridad del buscador

  const drawerTotal = (stock) =>
    DENOMS.reduce((sum, d) => sum + (stock[d.id] || 0) * d.unit, 0);

  /**
   * Reparte un importe en billetes y monedas sin límite de existencias.
   * Modela lo que el cliente saca de la cartera al pagar.
   */
  function splitAmount(cents) {
    const out = {};
    let rest = cents;
    for (const d of DENOMS) {
      const n = Math.floor(rest / d.unit);
      if (n > 0) { out[d.id] = n; rest -= n * d.unit; }
    }
    return out;
  }

  /**
   * Búsqueda exacta para los casos en que el voraz falla aunque SÍ
   * exista combinación. Ej.: faltan 30¢ y el cajón tiene 1 quarter y
   * 3 dimes -> el voraz coge el quarter y se atasca; esto da 3 dimes.
   * Prueba primero la cantidad máxima de cada pieza, memoriza los
   * estados sin salida y lleva un presupuesto de pasos por si acaso.
   */
  function searchChange(amount, stock) {
    const failed = new Set();
    const picks = new Array(DENOMS.length).fill(0);
    let budget = 200000;

    const walk = (i, rest) => {
      if (rest === 0) return true;
      if (i >= DENOMS.length || budget-- <= 0) return false;
      const key = i * 10000000 + rest;
      if (failed.has(key)) return false;

      const d = DENOMS[i];
      const max = Math.min(stock[d.id] || 0, Math.floor(rest / d.unit));
      for (let n = max; n >= 0; n--) {
        picks[i] = n;
        if (walk(i + 1, rest - n * d.unit)) return true;
      }
      picks[i] = 0;
      failed.add(key);
      return false;
    };

    if (!walk(0, amount)) return null;
    const out = {};
    DENOMS.forEach((d, i) => { if (picks[i] > 0) out[d.id] = picks[i]; });
    return out;
  }

  /**
   * Devuelve el desglose del cambio o `null` si es imposible.
   * El voraz va primero porque es el desglose que espera el test de
   * freeCodeCamp; la búsqueda exhaustiva solo actúa como red.
   */
  function makeChange(amount, stock) {
    const greedy = {};
    let rest = amount;
    for (const d of DENOMS) {
      const n = Math.min(stock[d.id] || 0, Math.floor(rest / d.unit));
      if (n > 0) { greedy[d.id] = n; rest -= n * d.unit; }
    }
    if (rest === 0) return greedy;
    return searchChange(amount, stock);
  }

  /**
   * Contrato canónico del ejercicio de freeCodeCamp.
   * El cambio se calcula contra el cajón ANTES de meter lo cobrado:
   * el billete que acaba de entregar el cliente no sirve para darle
   * su propio cambio.
   */
  function checkCashRegister(price, cash, stock) {
    if (cash < price) return { status: "INSUFFICIENT_FUNDS", due: price - cash, change: null };

    const due = cash - price;
    const total = drawerTotal(stock);

    if (due === 0)     return { status: "OPEN",   due, change: {} };
    if (total < due)   return { status: "INSUFFICIENT_FUNDS", due, change: null };
    if (total === due) return { status: "CLOSED", due, change: { ...stock } };

    const change = makeChange(due, stock);
    return change
      ? { status: "OPEN", due, change }
      : { status: "INSUFFICIENT_FUNDS", due, change: null };
  }

  /* Salida para el arnés de pruebas en Node (tests/logic.test.js). */
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { DENOMS, INITIAL_DRAWER, checkCashRegister, makeChange, splitAmount, drawerTotal };
    return;
  }

  /* ===========================================================
     2 · ESTADO + PERSISTENCIA
     =========================================================== */

  const STORE_KEY = "cashRegister:v3";
  const MAX_HISTORY = 40;

  const freshState = () => ({
    price: DEFAULT_PRICE,
    drawer: { ...INITIAL_DRAWER },
    soldCents: 0,
    transactions: [],   // cada una guarda el cajón previo -> deshacer real
    sound: true,
    theme: null,        // null = seguir al sistema
  });

  let state = freshState();

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      state = { ...state, ...saved, drawer: { ...INITIAL_DRAWER, ...(saved.drawer || {}) } };
    } catch {
      /* almacenamiento bloqueado o dato corrupto: seguimos en limpio */
    }
  }

  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* sin espacio */ }
    }, 200);
  }

  /* ===========================================================
     3 · UTILIDADES
     =========================================================== */

  const $ = (sel) => document.querySelector(sel);

  const money = (cents) =>
    (cents < 0 ? "-$" : "$") + (Math.abs(cents) / 100).toFixed(2);

  /** Lee un input aceptando coma o punto decimal. `null` si no es número. */
  function readCents(value) {
    const n = Number.parseFloat(String(value).trim().replace(",", "."));
    return Number.isFinite(n) ? Math.round(n * 100) : null;
  }

  const clock = () =>
    new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---- Sonido: un único AudioContext reutilizado ----
     La versión anterior creaba uno por pitido; los navegadores cortan
     a las pocas decenas de contextos y el sonido se apagaba solo.   */
  const audio = (() => {
    let ctx = null;

    const ensure = () => {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
      }
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    };

    const tone = (freq, ms, when = 0, peak = 0.18) => {
      if (!state.sound) return;
      const c = ensure();
      if (!c) return;
      const t0 = c.currentTime + when;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + ms / 1000);
      osc.connect(gain).connect(c.destination);
      osc.start(t0);
      osc.stop(t0 + ms / 1000 + 0.02);
    };

    return {
      tap:   () => tone(880, 40, 0, 0.07),
      ok:    () => { tone(1046, 90); tone(1568, 160, 0.07); },
      bell:  () => { tone(1318, 120); tone(1760, 220, 0.09, 0.14); },
      error: () => { tone(220, 180, 0, 0.16); tone(165, 240, 0.12, 0.14); },
      /* Vibración reservada a los errores, no a cada pulsación. */
      buzz:  () => { if (state.sound && navigator.vibrate) navigator.vibrate([40, 60, 40]); },
      unlock: () => ensure(),
    };
  })();

  /* ===========================================================
     4 · REFERENCIAS AL DOM
     =========================================================== */

  const el = {
    priceInput:   $("#price-input"),
    cashInput:    $("#cash"),
    totalOut:     $("#total-display"),
    cashOut:      $("#cash-display"),
    changeOut:    $("#change-display"),
    status:       $("#status-line"),
    bins:         $("#bins"),
    drawer:       $("#drawer"),
    drawerTotal:  $("#drawer-total"),
    stats:        $("#stats"),
    history:      $("#history"),
    quick:        $("#quick-buttons"),
    keypad:       $("#keypad"),
    purchase:     $("#purchase-btn"),
    undo:         $("#undo-btn"),
    reset:        $("#reset-btn"),
    theme:        $("#toggle-theme"),
    sound:        $("#toggle-sound"),
    clearHist:    $("#clear-history"),
    receiptWrap:  $("#receipt-wrap"),
    rcPrice:      $("#rc-price"),
    rcCash:       $("#rc-cash"),
    rcChange:     $("#rc-change"),
    rcBreakdown:  $("#rc-breakdown"),
    rcTime:       $("#rc-time"),
    rcStatus:     $("#rc-status"),
    rcMachine:    $("#rc-machine"),
    printBtn:     $("#print-btn"),
    closeReceipt: $("#close-receipt"),
  };

  /* ===========================================================
     5 · RENDER
     =========================================================== */

  function renderScreen() {
    el.totalOut.textContent = money(state.price);

    const cash = readCents(el.cashInput.value);
    const hasCash = cash !== null && cash > 0;
    el.cashOut.textContent = hasCash ? money(cash) : "$0.00";
    el.cashOut.classList.toggle("dim", !hasCash);

    // Adelanto del cambio mientras se teclea: solo informativo.
    const preview = hasCash ? cash - state.price : 0;
    el.changeOut.textContent = money(Math.max(0, preview));
    el.changeOut.classList.toggle("dim", preview <= 0);
    el.purchase.disabled = !hasCash;
  }

  function renderDrawer(given = {}) {
    el.drawerTotal.textContent = money(drawerTotal(state.drawer));
    el.bins.innerHTML = DENOMS.map((d) => {
      const n = state.drawer[d.id] || 0;
      const out = given[d.id] || 0;
      const cls = ["bin", `bin--${d.kind}`];
      if (out) cls.push("is-given");
      if (n === 0) cls.push("is-empty");
      return `
        <div class="${cls.join(" ")}">
          <span class="bin-label">${d.label}</span>
          <span class="bin-count">${n}</span>
          <span class="bin-amt">${money(n * d.unit)}</span>
          ${out ? `<span class="bin-out">−${out}</span>` : ""}
        </div>`;
    }).join("");
  }

  function renderStats() {
    const cards = [
      ["Vendido", money(state.soldCents)],
      ["Ventas", String(state.transactions.length)],
      ["En cajón", money(drawerTotal(state.drawer))],
    ];
    el.stats.innerHTML = cards.map(([label, value]) => `
      <div class="stat-card">
        <span class="stat-label">${label}</span>
        <span class="stat-value">${value}</span>
      </div>`).join("");
  }

  function renderHistory() {
    if (!state.transactions.length) {
      el.history.innerHTML = `<p class="empty-note">Aún no hay ventas registradas.</p>`;
      el.clearHist.hidden = true;
      return;
    }
    el.clearHist.hidden = false;
    el.history.innerHTML = state.transactions
      .slice()
      .reverse()
      .map((t) => `
        <button type="button" class="history-item" data-id="${t.id}">
          <span class="h-time">${t.time}</span>
          <span class="h-paid">${money(t.paid)}</span>
          <span class="h-change${t.change ? "" : " is-exact"}">${t.change ? "−" + money(t.change) : "exacto"}</span>
        </button>`).join("");
  }

  function renderControls() {
    el.undo.disabled = state.transactions.length === 0;
    el.sound.setAttribute("aria-pressed", String(state.sound));
    el.sound.querySelector(".ctrl-label").textContent = state.sound ? "Sonido" : "Silencio";
    el.sound.querySelector(".ctrl-icon").textContent = state.sound ? "🔊" : "🔇";
  }

  function renderAll(given) {
    renderScreen();
    renderDrawer(given);
    renderStats();
    renderHistory();
    renderControls();
  }

  const STATUS_CLASSES = ["is-idle", "is-ok", "is-warn", "is-error"];
  function setStatus(text, kind = "idle") {
    el.status.classList.remove(...STATUS_CLASSES);
    el.status.classList.add(`is-${kind}`);
    el.status.textContent = text;
  }

  /* ===========================================================
     6 · RECIBO
     =========================================================== */

  const STATUS_TEXT = {
    OPEN: "Caja abierta",
    CLOSED: "Caja cerrada · cambio agotado",
    INSUFFICIENT_FUNDS: "Fondos insuficientes",
  };

  function showReceipt(t) {
    el.rcTime.textContent = t.time;
    el.rcPrice.textContent = money(t.price);
    el.rcCash.textContent = money(t.paid);
    el.rcChange.textContent = money(t.change);
    el.rcStatus.textContent = STATUS_TEXT[t.status] || "";
    el.rcStatus.className = "receipt-status " + (t.status === "CLOSED" ? "is-warn" : "is-ok");

    const rows = DENOMS
      .filter((d) => t.breakdown[d.id])
      .map((d) => `<div class="receipt-line"><span>${d.label} ×${t.breakdown[d.id]}</span><span>${money(t.breakdown[d.id] * d.unit)}</span></div>`);
    el.rcBreakdown.innerHTML = rows.length
      ? `<div class="receipt-sub">Desglose del cambio</div>${rows.join("")}`
      : "";

    /* Espejo en inglés para el corrector automático de freeCodeCamp,
       que lee el textContent de #change-due. Oculto visualmente. */
    el.rcMachine.textContent =
      `Status: ${t.status} ` +
      DENOMS.filter((d) => t.breakdown[d.id])
            .map((d) => `${d.id}: $${(t.breakdown[d.id] * d.unit) / 100}`)
            .join(" ");

    el.receiptWrap.hidden = false;
    requestAnimationFrame(() => el.receiptWrap.classList.add("show"));
  }

  function hideReceipt() {
    el.receiptWrap.classList.remove("show");
    el.receiptWrap.hidden = true;
  }

  /* ===========================================================
     7 · COBRO
     =========================================================== */

  function charge() {
    audio.unlock();
    const cash = readCents(el.cashInput.value);

    if (cash === null || cash <= 0) {
      setStatus("Introduce un importe válido", "error");
      audio.error(); audio.buzz();
      el.cashInput.focus();
      return;
    }
    if (cash > MAX_CASH) {
      setStatus(`Importe máximo por venta: ${money(MAX_CASH)}`, "error");
      audio.error();
      return;
    }
    if (cash < state.price) {
      setStatus(`Faltan ${money(state.price - cash)}`, "error");
      audio.error(); audio.buzz();
      return;
    }

    const result = checkCashRegister(state.price, cash, state.drawer);

    if (result.status === "INSUFFICIENT_FUNDS") {
      setStatus(
        drawerTotal(state.drawer) < result.due
          ? "Sin fondos suficientes en el cajón"
          : "No hay piezas para desglosar ese cambio",
        "error"
      );
      audio.error(); audio.buzz();
      return;
    }

    /* --- Aplicar la venta ------------------------------------ */
    const before = { ...state.drawer };
    const change = result.change;

    for (const d of DENOMS) {
      if (change[d.id]) state.drawer[d.id] -= change[d.id];
    }
    for (const [id, n] of Object.entries(splitAmount(cash))) {
      state.drawer[id] = (state.drawer[id] || 0) + n;
    }

    const tx = {
      id: `${Date.now()}-${state.transactions.length}`,
      time: clock(),
      price: state.price,
      paid: cash,
      change: result.due,
      status: result.status,
      breakdown: change,
      before,                       // <- lo que permite deshacer de verdad
      soldBefore: state.soldCents,  // <- y restaurar el acumulado exacto
    };
    state.soldCents += state.price;
    state.transactions.push(tx);
    if (state.transactions.length > MAX_HISTORY) state.transactions.shift();

    renderAll(change);
    kickDrawer();
    showReceipt(tx);

    if (result.status === "CLOSED")   setStatus("Caja cerrada: se entregó todo el cambio", "warn");
    else if (result.due === 0)        setStatus("Pago exacto", "ok");
    else                              setStatus(`Cambio: ${money(result.due)}`, "ok");

    if (result.status === "CLOSED") audio.bell(); else audio.ok();

    el.cashInput.value = "";
    renderScreen();
    el.cashInput.focus();
    save();
  }

  function kickDrawer() {
    if (reducedMotion.matches) return;
    el.drawer.classList.remove("kick");
    void el.drawer.offsetWidth;   // fuerza el reinicio de la animación
    el.drawer.classList.add("kick");
  }

  function undo() {
    const tx = state.transactions.pop();
    if (!tx) return;
    state.drawer = { ...tx.before };
    state.soldCents = tx.soldBefore;
    hideReceipt();
    renderAll();
    setStatus("Venta anulada", "warn");
    audio.tap();
    save();
  }

  function resetAll() {
    if (!confirm("Esto vacía el historial y repone el cajón inicial. ¿Continuar?")) return;
    const { theme, sound } = state;
    state = { ...freshState(), theme, sound };
    el.priceInput.value = (state.price / 100).toFixed(2);
    el.cashInput.value = "";
    hideReceipt();
    renderAll();
    setStatus("Caja reiniciada", "idle");
    audio.tap();
    save();
  }

  /* ===========================================================
     8 · TEMA
     =========================================================== */

  const systemLight = window.matchMedia("(prefers-color-scheme: light)");

  function applyTheme() {
    const theme = state.theme || (systemLight.matches ? "light" : "dark");
    document.documentElement.dataset.theme = theme;
    el.theme.setAttribute("aria-pressed", String(theme === "light"));
    el.theme.querySelector(".ctrl-label").textContent = theme === "light" ? "Claro" : "Oscuro";
    el.theme.querySelector(".ctrl-icon").textContent = theme === "light" ? "☀" : "🌙";
  }

  systemLight.addEventListener("change", () => { if (!state.theme) applyTheme(); });

  /* ===========================================================
     9 · ENTRADA: atajos de billete y teclado numérico
     =========================================================== */

  function buildQuickButtons() {
    const bills = [1, 5, 10, 20, 50, 100];
    el.quick.innerHTML =
      bills.map((b) => `<button type="button" class="quick-btn" data-add="${b * 100}">+$${b}</button>`).join("") +
      `<button type="button" class="quick-btn quick-btn--alt" data-exact="1">Exacto</button>`;
  }

  function buildKeypad() {
    const keys = ["7", "8", "9", "4", "5", "6", "1", "2", "3", ".", "0"];
    el.keypad.innerHTML =
      keys.map((k) => `<button type="button" class="key" data-key="${k}">${k}</button>`).join("") +
      `<button type="button" class="key key--back" data-key="back" aria-label="Borrar último dígito">⌫</button>` +
      `<button type="button" class="key key--clear" data-key="clear" aria-label="Limpiar importe">C</button>`;
  }

  function addCash(cents) {
    const current = readCents(el.cashInput.value) || 0;
    el.cashInput.value = ((current + cents) / 100).toFixed(2);
  }

  function typeKey(k) {
    const v = el.cashInput.value;
    if (k === "clear") {
      el.cashInput.value = "";
    } else if (k === "back") {
      el.cashInput.value = v.slice(0, -1);
    } else if (k === ".") {
      if (v.includes(".")) return;
      el.cashInput.value = v === "" ? "0." : v + ".";
    } else {
      const dot = v.indexOf(".");
      if (dot !== -1 && v.length - dot > 2) return;   // máximo dos decimales
      el.cashInput.value = v + k;
    }
  }

  function commitPrice() {
    const cents = readCents(el.priceInput.value);
    state.price = cents !== null && cents > 0 ? Math.min(cents, MAX_CASH) : DEFAULT_PRICE;
    el.priceInput.value = (state.price / 100).toFixed(2);
    renderScreen();
    save();
  }

  /* ===========================================================
     10 · EVENTOS
     =========================================================== */

  el.priceInput.addEventListener("input", () => {
    const cents = readCents(el.priceInput.value);
    if (cents !== null && cents > 0) { state.price = cents; renderScreen(); }
  });
  el.priceInput.addEventListener("change", commitPrice);
  el.priceInput.addEventListener("blur", commitPrice);

  el.cashInput.addEventListener("input", renderScreen);

  el.purchase.addEventListener("click", charge);
  el.undo.addEventListener("click", undo);
  el.reset.addEventListener("click", resetAll);

  el.theme.addEventListener("click", () => {
    state.theme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    applyTheme();
    audio.tap();
    save();
  });

  el.sound.addEventListener("click", () => {
    state.sound = !state.sound;
    renderControls();
    if (state.sound) { audio.unlock(); audio.ok(); }
    save();
  });

  el.clearHist.addEventListener("click", () => {
    state.transactions = [];
    hideReceipt();
    renderHistory();
    renderControls();
    save();
  });

  el.quick.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    audio.unlock();
    if (btn.dataset.exact) el.cashInput.value = (state.price / 100).toFixed(2);
    else addCash(Number(btn.dataset.add));
    renderScreen();
    audio.tap();
  });

  el.keypad.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    audio.unlock();
    typeKey(btn.dataset.key);
    renderScreen();
    audio.tap();
  });

  el.history.addEventListener("click", (e) => {
    const btn = e.target.closest(".history-item");
    if (!btn) return;
    const tx = state.transactions.find((t) => t.id === btn.dataset.id);
    if (tx) showReceipt(tx);
  });

  el.printBtn.addEventListener("click", () => window.print());
  el.closeReceipt.addEventListener("click", hideReceipt);

  document.addEventListener("keydown", (e) => {
    const onInput = e.target.matches("input");

    if (e.key === "Enter" && !e.target.matches("button")) {
      e.preventDefault();
      if (e.target === el.priceInput) { commitPrice(); el.cashInput.focus(); }
      else charge();
    } else if (e.key === "Escape") {
      el.cashInput.value = "";
      renderScreen();
      hideReceipt();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !onInput) {
      // Solo fuera de un campo: dentro, Ctrl+Z debe seguir deshaciendo el texto.
      e.preventDefault();
      undo();
    } else if (!onInput && !e.target.matches("button") && /^[0-9.]$/.test(e.key)) {
      el.cashInput.focus();   // teclear cifras lleva el foco al importe
    }
  });

  /* ===========================================================
     11 · ARRANQUE
     =========================================================== */

  load();
  applyTheme();
  buildQuickButtons();
  buildKeypad();
  el.priceInput.value = (state.price / 100).toFixed(2);
  renderAll();
  setStatus(state.transactions.length ? "Listo · sesión recuperada" : "Esperando pago", "idle");
})();
