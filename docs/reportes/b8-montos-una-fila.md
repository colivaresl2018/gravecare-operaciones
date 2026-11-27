# B8 — Montos en una sola fila en «Gastos e Ingresos»

**Fecha:** 2026-11-26 · **Rama:** `fix/gastos-montos-una-fila` (desde `main`, tag `ops-planserv-17`) · **Estado:** listo para revisión (PR a `main`). **No desplegado**: lo despliega el dueño.
**Autorización:** directriz B8 del repo de la web (`docs/directrices/B8-backoffice-montos-una-fila.md`), pasada por el dueño en la conversación; el dueño eligió `main` como rama base.

## Problema
En `public/gastos-ingresos.html`, `formatearDinero` devuelve `"$ " + número` con un espacio normal; las celdas Neto, IVA / Ret. y Total no tenían `white-space: nowrap`, y un monto largo (ej. `$ 1.234.567`) quedaba con el «$» en una línea y la cifra en otra.

## Qué se hizo (opción A de la directriz)
`white-space: nowrap` en el `style` de las celdas de monto:
- Tabla de movimientos: **Neto, IVA / Ret., Total**.
- Resumen mensual de IVA: **Débito, Crédito y saldo** (la directriz pedía revisarlas si se veía el mismo salto; se incluyeron porque usan la misma función y la tabla es angosta).
No se tocó `formatearDinero` (se conserva el espacio normal, así el formulario y `desformatearDinero` siguen igual), ni textos, colores, orden de columnas, formato `es-CL` ni datos. Son 6 líneas cambiadas en `public/gastos-ingresos.html`.

## Pruebas
- `tests/gastos-ingresos-montos-una-fila.test.mjs` (4 pruebas, 2 en rojo antes del cambio): celdas de monto con `nowrap`; formato intacto; alineación, color y peso intactos.
- `node --test tests/ public/js/` → **877 pasan, 0 fallan**.
- **Navegador, con Firebase ficticio** (montos de 4, 6 y 7 dígitos, datos inventados), midiendo las líneas que ocupa cada celda: **antes**, a 1366 px, `$ 1.234.567`, `$ 234.568` y `$ 1.469.135` ocupaban 2 líneas; **después**, todas las celdas de movimientos (15) y del resumen mensual (36) ocupan 1 línea, a **1366 px y a 1920 px**, sin desborde horizontal y con alineación a la derecha.

## Despliegue y reversa
Hosting solo, desde `C:\Despliegue\GravecareOps` con el tag que se cree tras fusionar: `firebase deploy --only hosting:gravecare-ops --project gravecare-2e8d2`. Reversa: volver a publicar el tag anterior (`ops-planserv-17`). No hay datos que corregir.
