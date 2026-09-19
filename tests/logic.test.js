/**
 * Pruebas de la lógica pura de la caja (sin DOM).
 *
 *   node --test tests/
 *
 * script.js detecta que corre bajo Node y exporta el dominio antes de
 * tocar el DOM, así que el mismo archivo sirve para el navegador y aquí.
 */
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  DENOMS, INITIAL_DRAWER, checkCashRegister, makeChange, splitAmount, drawerTotal,
} = require("../script.js");

/** Convierte { PENNY: 101, ... } a dólares para comparar con freeCodeCamp. */
const toDollars = (change) =>
  DENOMS.filter((d) => change[d.id])
        .map((d) => [d.id, (change[d.id] * d.unit) / 100]);

const stock = (pairs) => {
  const out = {};
  for (const d of DENOMS) out[d.id] = 0;
  return Object.assign(out, pairs);
};

test("el cajón inicial de freeCodeCamp suma $335.41", () => {
  assert.equal(drawerTotal(INITIAL_DRAWER), 33541);
});

test("caso canónico fCC: precio $19.50, pago $20 -> 2 quarters", () => {
  const r = checkCashRegister(1950, 2000, INITIAL_DRAWER);
  assert.equal(r.status, "OPEN");
  assert.deepEqual(toDollars(r.change), [["QUARTER", 0.5]]);
});

test("caso canónico fCC: precio $3.26, pago $100 -> desglose completo", () => {
  const r = checkCashRegister(326, 10000, INITIAL_DRAWER);
  assert.equal(r.status, "OPEN");
  assert.deepEqual(toDollars(r.change), [
    ["TWENTY", 60], ["TEN", 20], ["FIVE", 15], ["ONE", 1],
    ["QUARTER", 0.5], ["DIME", 0.2], ["PENNY", 0.04],
  ]);
});

test("pago exacto: estado OPEN y cambio vacío", () => {
  const r = checkCashRegister(1950, 1950, INITIAL_DRAWER);
  assert.equal(r.status, "OPEN");
  assert.deepEqual(r.change, {});
});

test("el cambio supera el total del cajón -> INSUFFICIENT_FUNDS", () => {
  const r = checkCashRegister(1950, 100000, stock({ PENNY: 1 }));
  assert.equal(r.status, "INSUFFICIENT_FUNDS");
  assert.equal(r.change, null);
});

test("el cambio iguala el total del cajón -> CLOSED y se entrega todo", () => {
  const cid = stock({ PENNY: 50 });                 // $0.50
  const r = checkCashRegister(1950, 2000, cid);      // cambio: $0.50
  assert.equal(r.status, "CLOSED");
  assert.deepEqual(toDollars(r.change), [["PENNY", 0.5]]);
});

test("piezas insuficientes para desglosar -> INSUFFICIENT_FUNDS", () => {
  // Hay $1.00 en el cajón pero solo en monedas de 25¢: no se pueden dar 30¢.
  const r = checkCashRegister(1950, 1980, stock({ QUARTER: 4 }));
  assert.equal(r.status, "INSUFFICIENT_FUNDS");
});

test("el respaldo exhaustivo resuelve lo que el voraz no", () => {
  // Faltan 30¢. El voraz coge el quarter y se queda con 5¢ que no puede dar.
  // Solución real: 3 dimes.
  const cid = stock({ QUARTER: 1, DIME: 3 });
  const change = makeChange(30, cid);
  assert.notEqual(change, null, "debería encontrar 3 dimes");
  assert.deepEqual(toDollars(change), [["DIME", 0.3]]);
});

test("el voraz sigue mandando cuando funciona (desglose de mayor a menor)", () => {
  const change = makeChange(326, INITIAL_DRAWER);
  assert.deepEqual(toDollars(change), [
    ["ONE", 3], ["QUARTER", 0.25], ["PENNY", 0.01],
  ]);
});

test("makeChange devuelve null cuando el importe es inalcanzable", () => {
  // 23¢ con 2 dimes y 1 penny: el máximo posible son 21¢.
  assert.equal(makeChange(23, stock({ DIME: 2, PENNY: 1 })), null);
  // 23¢ con 2 dimes y 3 pennies sí sale, aunque el voraz llegue solo.
  assert.deepEqual(toDollars(makeChange(23, stock({ DIME: 2, PENNY: 3 }))), [
    ["DIME", 0.2], ["PENNY", 0.03],
  ]);
});

test("makeChange nunca gasta más piezas de las que hay en el cajón", () => {
  const cid = stock({ QUARTER: 2, DIME: 1, NICKEL: 1, PENNY: 4 });
  const change = makeChange(69, cid);
  assert.notEqual(change, null);
  for (const d of DENOMS) {
    assert.ok((change[d.id] || 0) <= cid[d.id], `${d.id} sobregirado`);
  }
});

test("splitAmount reparte el pago en billetes y monedas reales", () => {
  // $123.45 = 1×$100 + 1×$20 + 3×$1 + 1×25¢ + 2×10¢
  assert.deepEqual(splitAmount(12345), {
    "ONE HUNDRED": 1, TWENTY: 1, ONE: 3, QUARTER: 1, DIME: 2,
  });
  assert.equal(
    DENOMS.reduce((s, d) => s + (splitAmount(12345)[d.id] || 0) * d.unit, 0),
    12345
  );
});

test("una venta completa cuadra el cajón al centavo", () => {
  const cid = { ...INITIAL_DRAWER };
  const price = 1950;
  const cash = 2000;
  const before = drawerTotal(cid);

  const r = checkCashRegister(price, cash, cid);
  for (const d of DENOMS) if (r.change[d.id]) cid[d.id] -= r.change[d.id];
  for (const [id, n] of Object.entries(splitAmount(cash))) cid[id] += n;

  // El cajón debe crecer exactamente en el precio del artículo.
  assert.equal(drawerTotal(cid), before + price);
  // Y ninguna denominación puede quedar en negativo.
  for (const d of DENOMS) assert.ok(cid[d.id] >= 0, `${d.id} quedó negativo`);
});

test("mil ventas seguidas no desvían el total ni un centavo", () => {
  const cid = { ...INITIAL_DRAWER };
  let sold = 0;
  const start = drawerTotal(cid);

  for (let i = 0; i < 1000; i++) {
    const price = 1 + (i * 37) % 999;     // precios entre $0.01 y $9.99
    const cash = price + (i * 13) % 500;  // a veces exacto, a veces con cambio
    const r = checkCashRegister(price, cash, cid);
    if (r.status === "INSUFFICIENT_FUNDS") continue;
    for (const d of DENOMS) if (r.change[d.id]) cid[d.id] -= r.change[d.id];
    for (const [id, n] of Object.entries(splitAmount(cash))) cid[id] += n;
    sold += price;
    for (const d of DENOMS) assert.ok(cid[d.id] >= 0, `${d.id} negativo en la venta ${i}`);
  }

  assert.equal(drawerTotal(cid), start + sold);
});
