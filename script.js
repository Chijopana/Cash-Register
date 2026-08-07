/**
 * CASH REGISTER v2.1 - FIXED (sin bloque duplicado)
 *
 * ✓ Dinero cobrado se suma CORRECTAMENTE al cajón
 * ✓ Cambio se resta CORRECTAMENTE del cajón (una sola vez)
 * ✓ Precio actualiza en tiempo real en pantalla
 * ✓ Lógica de descomposición de dinero correcta
 */
 
const DENOMS = [
  ["ONE HUNDRED", 100, "$100"],
  ["TWENTY", 20, "$20"],
  ["TEN", 10, "$10"],
  ["FIVE", 5, "$5"],
  ["ONE", 1, "$1"],
  ["QUARTER", 0.25, "25¢"],
  ["DIME", 0.10, "10¢"],
  ["NICKEL", 0.05, "5¢"],
  ["PENNY", 0.01, "1¢"]
];
 
let cid = [
  ["PENNY", 1.01],
  ["NICKEL", 2.05],
  ["DIME", 3.10],
  ["QUARTER", 4.25],
  ["ONE", 90],
  ["FIVE", 55],
  ["TEN", 20],
  ["TWENTY", 60],
  ["ONE HUNDRED", 100]
];
 
let price = 19.50;
let transactions = [];
let totalSold = 0;
 
const fmt = n => "$" + parseFloat(n).toFixed(2);
 
const playSound = (freq = 800, dur = 100) => {
  if (!soundEnabled) return;
  if (navigator.vibrate) navigator.vibrate(dur);
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.frequency.value = freq;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.3, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + dur / 1000);
    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + dur / 1000);
  } catch (e) {}
};
 
const DOM = {
  priceInput: document.getElementById("price-input"),
  priceDisplay: document.getElementById("price-display"),
  cashInput: document.getElementById("cash"),
  cashDisplay: document.getElementById("cash-display"),
  changeDisplay: document.getElementById("change-display"),
  statusLine: document.getElementById("status-line"),
  binsEl: document.getElementById("bins"),
  drawerEl: document.getElementById("drawer"),
  receiptWrap: document.getElementById("receipt-wrap"),
  purchaseBtn: document.getElementById("purchase-btn"),
  quickBtnsContainer: document.getElementById("quick-buttons"),
  historyContainer: document.getElementById("history"),
  statsContainer: document.getElementById("stats"),
  undoBtn: document.getElementById("undo-btn"),
  resetBtn: document.getElementById("reset-btn"),
  toggleDarkBtn: document.getElementById("toggle-dark"),
  toggleSoundBtn: document.getElementById("toggle-sound"),
  totalDisplay: document.getElementById("total-display"),
};
 
let soundEnabled = true;
 
/**
 * FUNCIÓN CORRECTA: Descomponer dinero en denominaciones
 * Ejemplo: $50 → [$20, $20, $10]
 */
const decomposeAmount = (amount) => {
  const result = {};
  let remaining = Math.round(amount * 100) / 100;
 
  for (const [name, unitValue] of DENOMS) {
    if (remaining >= unitValue - 1e-9) {
      const count = Math.floor(remaining / unitValue);
      if (count > 0) {
        result[name] = Math.round(count * unitValue * 100) / 100;
        remaining = Math.round((remaining - result[name]) * 100) / 100;
      }
    }
  }
 
  return result;
};
 
const renderBins = (givenMap = {}) => {
  DOM.binsEl.innerHTML = "";
  for (const [name, value] of cid) {
    const div = document.createElement("div");
    div.className = "bin" + (givenMap[name] ? " given" : "");
    div.innerHTML = `<span class="bin-name">${name}</span><span class="bin-amt">${fmt(value)}</span>`;
    DOM.binsEl.appendChild(div);
  }
};
 
const renderStats = () => {
  const totalCid = Math.round(cid.reduce((s, [, v]) => s + v, 0) * 100) / 100;
  DOM.statsContainer.innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Vendido hoy</div>
      <div class="stat-value">${fmt(totalSold)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Transacciones</div>
      <div class="stat-value">${transactions.length}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Cajón</div>
      <div class="stat-value">${fmt(totalCid)}</div>
    </div>
  `;
};
 
const renderHistory = () => {
  if (!transactions.length) {
    DOM.historyContainer.innerHTML = '<p style="text-align:center;color:var(--steel);">Sin transacciones aún</p>';
    return;
  }
  DOM.historyContainer.innerHTML = transactions
    .slice(-5)
    .reverse()
    .map(t => `
      <div class="history-item">
        <span>${t.time}</span>
        <span style="color:var(--brass)">${fmt(t.paid)} → ${fmt(t.change)}</span>
      </div>
    `).join("");
};
 
const renderQuickButtons = () => {
  const amounts = [5, 10, 20, 50, 100];
  DOM.quickBtnsContainer.innerHTML = amounts
    .map(amt => `
      <button class="quick-btn" onclick="quickPay(${amt})">$${amt}</button>
    `).join("");
};
 
const quickPay = (amount) => {
  DOM.cashInput.value = amount.toString();
  DOM.cashInput.dispatchEvent(new Event('input'));
  playSound(1000, 50);
};
 
const setStatus = (text, cls) => {
  DOM.statusLine.className = "status-line " + cls;
  DOM.statusLine.textContent = text;
};
 
const openDrawer = () => {
  requestAnimationFrame(() => DOM.drawerEl.classList.add("open"));
  playSound(700, 300);
};
 
const showReceipt = (cash, changeDue, changeArray) => {
  document.getElementById("rc-price").textContent = fmt(price);
  document.getElementById("rc-cash").textContent = fmt(cash);
  document.getElementById("rc-change").innerHTML = "<strong>" + fmt(changeDue) + "</strong>";
  const bd = document.getElementById("rc-breakdown");
  bd.innerHTML = changeArray.length
    ? changeArray.map(([n, v]) => `<div class="receipt-line"><span>${n}</span><span>${fmt(v)}</span></div>`).join("")
    : "";
  requestAnimationFrame(() => DOM.receiptWrap.classList.add("show"));
};
 
// Actualizar precio en tiempo real
DOM.priceInput.addEventListener("input", () => {
  const v = parseFloat(DOM.priceInput.value);
  if (!isNaN(v) && v > 0) {
    DOM.priceDisplay.textContent = fmt(v);
    DOM.totalDisplay.textContent = fmt(v);
    price = v;
  }
});
 
// Confirmar precio al salir del input
DOM.priceInput.addEventListener("blur", () => {
  const v = parseFloat(DOM.priceInput.value);
  if (isNaN(v) || v <= 0) {
    price = 19.50;
    DOM.priceInput.value = price;
  } else {
    price = Math.max(0.01, v);
    DOM.priceInput.value = price;
  }
  DOM.priceDisplay.textContent = fmt(price);
  DOM.totalDisplay.textContent = fmt(price);
  playSound(600, 100);
});
 
// Actualizar dinero entregado en tiempo real
DOM.cashInput.addEventListener("input", () => {
  const v = parseFloat(DOM.cashInput.value);
  DOM.cashDisplay.textContent = isNaN(v) ? "$0.00" : fmt(v);
  DOM.cashDisplay.classList.toggle("dim", isNaN(v) || v === 0);
});
 
// BOTÓN COBRAR - LÓGICA PRINCIPAL
DOM.purchaseBtn.addEventListener("click", () => {
  const cash = parseFloat(DOM.cashInput.value);
 
  DOM.drawerEl.classList.remove("open");
  DOM.receiptWrap.classList.remove("show");
 
  // Validación 1: ¿Dinero válido?
  if (isNaN(cash) || cash <= 0) {
    setStatus("❌ Ingresa un monto válido", "status-insufficient");
    playSound(400, 200);
    return;
  }
 
  // Validación 2: ¿Suficiente dinero?
  if (cash < price) {
    setStatus("❌ Fondos insuficientes", "status-insufficient");
    playSound(400, 200);
    return;
  }
 
  const changeDue = Math.round((cash - price) * 100) / 100;
  DOM.changeDisplay.textContent = fmt(changeDue);
 
  // CASO 1: PAGO EXACTO
  if (changeDue === 0) {
    const decomposed = decomposeAmount(cash);
    for (const [name, amount] of Object.entries(decomposed)) {
      const idx = cid.findIndex(([n]) => n === name);
      if (idx !== -1) {
        cid[idx][1] = Math.round((cid[idx][1] + amount) * 100) / 100;
      }
    }
 
    setStatus("✓ Pago exacto", "status-open");
    totalSold = Math.round((totalSold + price) * 100) / 100;
    transactions.push({
      time: new Date().toLocaleTimeString('es-ES'),
      paid: cash,
      change: 0
    });
    renderBins();
    renderStats();
    renderHistory();
    openDrawer();
    showReceipt(cash, changeDue, []);
    DOM.cashInput.value = "";
    DOM.cashInput.dispatchEvent(new Event('input'));
    playSound(1200, 150);
    return;
  }
 
  // CASO 2: HAY CAMBIO
  const totalCid = Math.round(cid.reduce((s, [, v]) => s + v, 0) * 100) / 100;
 
  // Validación 3: ¿Suficiente cambio en el cajón?
  if (totalCid < changeDue) {
    setStatus("❌ Cambio insuficiente en caja", "status-insufficient");
    renderBins();
    playSound(400, 300);
    return;
  }
 
  // Calcular cambio (greedy algorithm) - sobre UNA COPIA, no toca cid todavía
  let remaining = changeDue;
  const changeArray = [];
  const drawerForChange = cid.map(([n, v]) => [n, v]);
 
  for (const [name, unitValue] of DENOMS) {
    let available = drawerForChange.find(([n]) => n === name)[1];
    let amount = 0;
    while (remaining >= unitValue - 1e-9 && available >= unitValue - 1e-9) {
      remaining = Math.round((remaining - unitValue) * 100) / 100;
      available = Math.round((available - unitValue) * 100) / 100;
      amount = Math.round((amount + unitValue) * 100) / 100;
    }
    drawerForChange.find(([n]) => n === name)[1] = available;
    if (amount > 0) changeArray.push([name, amount]);
  }
 
  // Validación 4: ¿Se puede desglosar el cambio?
  if (remaining > 0) {
    setStatus("❌ No se puede desglosar el cambio", "status-insufficient");
    renderBins();
    playSound(400, 300);
    return;
  }
 
  // ÚNICO PASO: sumar dinero cobrado y restar cambio a la vez sobre el cid real
  const decomposed = decomposeAmount(cash);
  cid = cid.map(([name, value]) => {
    const incomeForDenom = decomposed[name] || 0;
    const changeForDenom = changeArray.find(ca => ca[0] === name)?.[1] || 0;
    return [name, Math.round((value + incomeForDenom - changeForDenom) * 100) / 100];
  });
 
  // Actualizar stats
  totalSold = Math.round((totalSold + price) * 100) / 100;
  transactions.push({
    time: new Date().toLocaleTimeString('es-ES'),
    paid: cash,
    change: changeDue
  });
 
  const givenMap = Object.fromEntries(changeArray.map(([n]) => [n, true]));
  renderBins(givenMap);
  renderStats();
  renderHistory();
  openDrawer();
 
  const finalCid = Math.round(cid.reduce((s, [, v]) => s + v, 0) * 100) / 100;
  if (finalCid < 0.01) {
    setStatus("⚠ CAJÓN VACÍO", "status-closed");
  } else {
    setStatus("✓ Cambio entregado", "status-open");
  }
 
  showReceipt(cash, changeDue, changeArray);
  DOM.cashInput.value = "";
  DOM.cashInput.dispatchEvent(new Event('input'));
  playSound(1200, 200);
});
 
// Deshacer
DOM.undoBtn?.addEventListener("click", () => {
  if (transactions.length) {
    const lastTransaction = transactions.pop();
    totalSold = Math.round((totalSold - (lastTransaction.paid - lastTransaction.change)) * 100) / 100;
    renderStats();
    renderHistory();
    playSound(800, 100);
  }
});
 
// Reset
DOM.resetBtn?.addEventListener("click", () => {
  if (confirm("¿Resetear todo?")) {
    price = 19.50;
    cid = [
      ["PENNY", 1.01],
      ["NICKEL", 2.05],
      ["DIME", 3.10],
      ["QUARTER", 4.25],
      ["ONE", 90],
      ["FIVE", 55],
      ["TEN", 20],
      ["TWENTY", 60],
      ["ONE HUNDRED", 100]
    ];
    transactions = [];
    totalSold = 0;
    DOM.cashInput.value = "";
    DOM.priceInput.value = price;
    DOM.priceDisplay.textContent = fmt(price);
    DOM.totalDisplay.textContent = fmt(price);
    DOM.drawerEl.classList.remove("open");
    DOM.receiptWrap.classList.remove("show");
    setStatus("Listo para pagar", "status-idle");
    renderBins();
    renderStats();
    renderHistory();
    playSound(600, 200);
  }
});
 
// Dark mode
DOM.toggleDarkBtn?.addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");
  localStorage.setItem("cashRegisterDarkMode", document.body.classList.contains("dark-mode"));
});
 
// Sound toggle
DOM.toggleSoundBtn?.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  DOM.toggleSoundBtn.textContent = soundEnabled ? "🔊 Sonido" : "🔇 Silencio";
  playSound(soundEnabled ? 1000 : 400, 150);
});
 
// Inicializar
if (localStorage.getItem("cashRegisterDarkMode") === "true") {
  document.body.classList.add("dark-mode");
}
 
renderBins();
renderQuickButtons();
renderStats();
renderHistory();
 