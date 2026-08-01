const price = 19.50;
 
// [name, unit value, display label]
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
 
const cashInput = document.getElementById("cash");
const cashDisplay = document.getElementById("cash-display");
const changeDisplay = document.getElementById("change-display");
const statusLine = document.getElementById("status-line");
const binsEl = document.getElementById("bins");
const drawerEl = document.getElementById("drawer");
const receiptWrap = document.getElementById("receipt-wrap");
const btn = document.getElementById("purchase-btn");
 
const fmt = n => "$" + n.toFixed(2);
 
function renderBins(givenMap = {}) {
  binsEl.innerHTML = "";
  for (const [name, value] of cid) {
    const div = document.createElement("div");
    div.className = "bin" + (givenMap[name] ? " given" : "");
    div.innerHTML = `<span class="bin-name">${name}</span><span class="bin-amt">${fmt(value)}</span>`;
    binsEl.appendChild(div);
  }
}
renderBins();
 
cashInput.addEventListener("input", () => {
  const v = parseFloat(cashInput.value);
  cashDisplay.textContent = isNaN(v) ? "$0.00" : fmt(v);
  cashDisplay.classList.toggle("dim", isNaN(v) || v === 0);
});
 
btn.addEventListener("click", () => {
  const cash = parseFloat(cashInput.value);
 
  drawerEl.classList.remove("open");
  receiptWrap.classList.remove("show");
 
  if (isNaN(cash)) {
    setStatus("Ingresa una cantidad válida", "status-insufficient");
    return;
  }
  if (cash < price) {
    setStatus("Fondos insuficientes del cliente", "status-insufficient");
    return;
  }
 
  const changeDue = Math.round((cash - price) * 100) / 100;
  changeDisplay.textContent = fmt(changeDue);
 
  if (changeDue === 0) {
    setStatus("Pago exacto — sin cambio", "status-open");
    renderBins();
    openDrawer();
    showReceipt(cash, changeDue, []);
    return;
  }
 
  const totalCid = Math.round(cid.reduce((s, [, v]) => s + v, 0) * 100) / 100;
 
  if (totalCid < changeDue) {
    setStatus("Estado: FONDOS INSUFICIENTES", "status-insufficient");
    renderBins();
    return;
  }
 
  // Greedy change from highest to lowest denomination
  let remaining = changeDue;
  const changeArray = [];
  const drawerAfter = cid.map(([n, v]) => [n, v]);
 
  for (const [name, unitValue] of DENOMS) {
    let available = drawerAfter.find(([n]) => n === name)[1];
    let amount = 0;
    while (remaining >= unitValue - 1e-9 && available >= unitValue - 1e-9) {
      remaining = Math.round((remaining - unitValue) * 100) / 100;
      available = Math.round((available - unitValue) * 100) / 100;
      amount = Math.round((amount + unitValue) * 100) / 100;
    }
    drawerAfter.find(([n]) => n === name)[1] = available;
    if (amount > 0) changeArray.push([name, amount]);
  }
 
  if (remaining > 0) {
    setStatus("Estado: FONDOS INSUFICIENTES", "status-insufficient");
    renderBins();
    return;
  }
 
  cid = drawerAfter;
  const givenMap = Object.fromEntries(changeArray.map(([n]) => [n, true]));
  renderBins(givenMap);
  openDrawer();
 
  if (totalCid === changeDue) {
    setStatus("Estado: CERRADA — caja vacía", "status-closed");
  } else {
    setStatus("Estado: ABIERTA — cambio entregado", "status-open");
  }
 
  showReceipt(cash, changeDue, changeArray);
});
 
function setStatus(text, cls) {
  statusLine.className = "status-line " + cls;
  statusLine.textContent = text;
}
 
function openDrawer() {
  requestAnimationFrame(() => drawerEl.classList.add("open"));
}
 
function showReceipt(cash, changeDue, changeArray) {
  document.getElementById("rc-price").textContent = fmt(price);
  document.getElementById("rc-cash").textContent = fmt(cash);
  document.getElementById("rc-change").innerHTML = "<strong>" + fmt(changeDue) + "</strong>";
  const bd = document.getElementById("rc-breakdown");
  bd.innerHTML = changeArray.length
    ? changeArray.map(([n, v]) => `<div class="receipt-line"><span>${n}</span><span>${fmt(v)}</span></div>`).join("")
    : "";
  requestAnimationFrame(() => receiptWrap.classList.add("show"));
}