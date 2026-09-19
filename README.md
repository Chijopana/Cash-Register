# Caja Registradora

Proyecto *Cash Register* de freeCodeCamp ampliado a un pequeño punto de venta.
HTML, CSS y JavaScript sin dependencias: se abre haciendo doble clic en `index.html`.

## Qué hace

- Calcula el cambio exacto y lo desglosa en billetes y monedas.
- Lleva el **inventario real del cajón** por denominación (unidades, no importes),
  así que avisa cuando no puede desglosar un cambio aunque haya dinero suficiente.
- Historial de ventas con recibo reimprimible, deshacer y reinicio.
- Teclado numérico, atajos de billete y tema claro/oscuro.
- Guarda la sesión en `localStorage`.

## Atajos de teclado

| Tecla | Acción |
| --- | --- |
| `Enter` | Cobrar |
| `Esc` | Limpiar el importe y cerrar el recibo |
| `Ctrl` + `Z` | Anular la última venta |
| `0`–`9`, `.` | Llevan el foco al campo de efectivo |

## Decisiones de diseño

**Todo el dinero se maneja en centavos enteros.** Los flotantes no representan
`0.1` exactamente, así que sumar importes en dólares obliga a redondear en cada
paso y termina descuadrando el cajón. Con enteros el problema desaparece.

**El cambio se calcula contra el cajón anterior al cobro.** El billete que acaba
de entregar el cliente no sirve para darle su propio cambio, que es también lo
que exige el enunciado de freeCodeCamp.

**El algoritmo voraz tiene una red de seguridad.** Coger siempre la pieza más
grande falla cuando las existencias son limitadas: para devolver 30 ¢ con
1 moneda de 25 ¢ y 3 de 10 ¢, el voraz coge la de 25 ¢ y se queda atascado con
5 ¢ que no puede dar, aunque 3 monedas de 10 ¢ resuelven el caso. Cuando el voraz
falla entra una búsqueda exhaustiva con memoria de estados sin salida.

**El campo de efectivo es `type="text"` con `inputmode="decimal"`.** Un
`type="number"` sanea los valores intermedios: al escribir `12.` el navegador
deja el campo vacío, y el punto decimal del teclado numérico sería inservible.

## Pruebas

La lógica de dominio vive en la primera mitad de `script.js` y no toca el DOM,
por lo que se puede probar directamente en Node sin instalar nada:

```bash
node --test tests/logic.test.js
```

Cubre los dos casos canónicos de freeCodeCamp, los estados `OPEN` / `CLOSED` /
`INSUFFICIENT_FUNDS`, el respaldo del voraz y una simulación de 1000 ventas que
comprueba que el cajón cuadra al centavo y que ninguna denominación queda en
negativo.

## Compatibilidad con el corrector de freeCodeCamp

El recibo es el elemento `#change-due` y contiene un `<span>` oculto con la
cadena canónica en inglés (`Status: OPEN QUARTER: $0.5 …`) que leen los tests
automáticos, sin que eso afecte a la interfaz en español.
