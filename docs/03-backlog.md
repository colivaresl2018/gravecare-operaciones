# Backlog del backoffice (gravecare-operaciones)

> Los IDs `N-xx` son los del backlog de la web (`docs/03-backlog.md` del repo `gravecare`), que es el registro único de IDs. Los hallazgos nuevos de este repo llevan un ID provisional `BO-n` hasta que la web les asigne un `N-xx`.

## Estado al 2026-11-08 (rama `feat/b2-pagadas`, sin publicar)
| ID | Tema | Estado | Dónde / evidencia |
|---|---|---|---|
| N9 | `firebase.json` del backoffice podía publicar reglas | **Hecho** (en `main` desde `c35319e`) + prueba | `tests/firebase-json-sin-reglas.test.mjs` |
| N83 | Reglas del backoffice distintas de las publicadas | **Hecho**: reglas en `legacy/reglas-deprecadas/` (B-18), `.firebaserc` sin `default` (B-20), prueba que impide volver a agregarlas | `tests/firebase-json-sin-reglas.test.mjs` |
| N80 | Ingresos y listas contaban órdenes sin pago | **Hecho**: `public/js/orden-pagada.js` en 7 páginas; ingreso con `estado === 'Confirmado'`, sin `integracion`, fecha de `fechaPago` | `tests/orden-pagada.test.mjs`, `tests/n80-paginas.test.mjs`, `tests/e2e/b2-pagadas.e2e.mjs` |
| N62 | «Reportar» de `mis-trabajos` apuntaba a una página inexistente | **Hecho** | `tests/n62-enlaces.test.mjs` |
| N192 | `planificacion` mostraba 259960 como monto pagado por defecto | **Hecho** («—» si falta) | `tests/n192-n193-prueba.test.mjs` |
| N193 | Clave fija en `clientes.html` para borrar clientes | **Hecho**: clave retirada; «Borrar» muestra un aviso. Un borrado real necesita spec propia con regla para staff con claim | `tests/n192-n193-prueba.test.mjs` |
| B-1 PRUEBA | Insignia «PRUEBA» en las listas para `modoPago === 'integracion'` | **Hecho** | `tests/n192-n193-prueba.test.mjs`, e2e |
| N57 | Lista fija de administradores por correo | **Pendiente** (no se toca aquí, por B-1) | — |

## Hallazgos nuevos (provisionales)
| ID | Hallazgo | Severidad | Propuesta |
|---|---|---|---|
| BO-1 | Las pruebas `public/js/*.test.mjs` (spec 041) se publican en Hosting: `firebase.json` no las excluye | Baja | Agregar `"**/*.test.mjs"` a `hosting.ignore` o moverlas a `tests/` (spec pequeña) |
| BO-2 | `public/gastosIngresos.js` y `public/js/gastosIngresos.js` no los usa ninguna página y repiten el cálculo de ingresos **sin** filtro de pago | Baja | Mover a `legacy/` con aviso |
| BO-3 | `trabajos-terminados.html` lee todas las órdenes sin filtro de pago (fuera de las 7 páginas de B-2) | Baja | Aplicar `esOrdenPagada` en una directriz corta |
| BO-4 | `planificacion.html` rellena datos ausentes con nombres y cementerio inventados («Felipe Toledo Toledo», «Tulio Santana», «Parque del Recuerdo Padre Hurtado») | Media | Mostrar «—» como en N192 |
| BO-5 | Versiones mezcladas del SDK de Firebase (10.7.0 y 10.12.0) según la página | Baja | Unificar en una spec |
| BO-6 | **`https://gravecare-ops.web.app` hoy sirve una copia del `public/` de la web**, no este repo: `login-ops.html` e `index.html` idénticos a la web y 21 de 28 páginas en 404 | Media | El primer despliegue `ops-2` reemplaza ese contenido; confirmar antes dónde opera hoy el staff y anotar la versión vigente como punto de reversa |
| BO-7 | La clave fija retirada en N193 sigue en el historial de git (no era una credencial real: las reglas ya bloqueaban el borrado) | Info | Si esa clave se usó en otro lugar, cambiarla |
