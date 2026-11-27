# Corrección: Planificación Planes y Spot no cargaba tras desplegar `ops-planserv-23`

**Fecha:** 2026-11-27 · **Rama:** `fix/ia-rutas-imports-con-version` (desde `main`, `1aae066`) · **Estado:** listo para revisión (PR a `main`). **No desplegado**: lo despliega el dueño.

## Qué pasó
Tras desplegar `ops-planserv-23` (etapa 3 de la IA), la pantalla «Planificación Planes y Spot» quedó en «Cargando planificación...» y la consola mostraba:
`Uncaught SyntaxError: The requested module './planificacion-edicion.js' does not provide an export named 'textoVisitaEdicion' (at ia-rutas.js?v=ia3:13)`.

## Causa
Error mío en la etapa 3. `public/js/ia-rutas.js` importaba `./planificacion-edicion.js` **sin `?v=`**, mientras que la página lo importa como `./js/planificacion-edicion.js?v=085b`. Son dos URL distintas: el navegador pidió la sin versión y usó una copia **vieja guardada** (el hosting las conserva 1 hora, `Cache-Control: max-age=3600`) de antes de que existiera `textoVisitaEdicion` (agregada en `ops-planserv-21`). Un módulo ES que no encuentra un export falla completo, y con él **toda la página** (no solo el bloque de IA). El servidor sí sirve el archivo correcto: se comprobó con `curl` que el archivo en vivo exporta `textoVisitaEdicion`; por eso a quien no tenía la copia vieja le cargaba bien.
Mis pruebas de la etapa 3 no lo detectaron porque probé con una caché limpia y sin simular la copia vieja.

## Corrección
- `ia-rutas.js`: todos sus imports llevan `?v=` y **la misma versión que usa la página**: `fechas-semana.js?v=b5`, `rutas-planificacion.js?v=cfg1`, `planificacion-edicion.js?v=085b`, `ia-informe.js?v=ia3`. Con la misma URL que la página, es el mismo módulo (nunca una copia distinta).
- `planificacion-servicios.html`: importa `ia-rutas.js?v=ia3b` (antes `ia3`), para que ningún navegador reutilice la copia rota de `ia-rutas.js`.
- Prueba nueva en `tests/planificacion-ia-rutas-pagina.test.mjs`: todo import de `ia-rutas.js` debe llevar `?v=` y la misma versión que la página (primero en rojo). Un comentario en el módulo deja escrita la regla.
- `node --test tests/ public/js/` → **1011 pasan, 0 fallan**.
- **Reproducido y comprobado en el navegador**: con un servidor de prueba que entrega la copia vieja de `planificacion-edicion.js` cuando se pide sin `?v=` (igual que la caché), el código de `main` queda en «Cargando planificación...» con el mismo error; con la corrección la pantalla carga (4 filas de Planes), el bloque aparece y la llamada simulada funciona. Servidor detenido y pestaña cerrada.

## Revisión de las demás pantallas de IA
`ia-factura.js` (Órdenes de compra) tiene el mismo patrón sin `?v=` (`fechas-semana.js`, `ia-informe.js`), pero ahí no falla: los dos archivos no han cambiado desde que existe esa pantalla y cualquier copia guardada tiene los exports que usa. No se tocó. Si algún día cambian, hay que versionar esos imports.

## Despliegue y reversa
Hosting solo, desde `C:\Despliegue\GravecareOps` con el tag que se cree tras fusionar: `firebase deploy --only hosting:gravecare-ops --project gravecare-2e8d2`. Mientras tanto, la pantalla vuelve a cargar publicando `ops-planserv-22` (quita solo el bloque de rutas). Tras desplegar la corrección, un Ctrl+F5 basta: la página nueva pide `ia-rutas.js?v=ia3b`, una URL que ningún navegador tiene guardada.
