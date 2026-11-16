# Reporte — Planificación & Gantt: fecha bajo el cementerio y menú al marcar la visita

- **Rama:** `feat/planificacion-fecha-y-menu` (parte de `fix/todos-trabajos-import-estado` / `ops-clientes-2`).
- **Archivo:** `public/planificacion.html` (solo `<script>` y un botón nuevo dentro del modal existente). Sin cambios de datos, reglas ni Storage.

## Qué cambia
1. **Fecha de la visita en la celda izquierda del Gantt**, debajo de la línea del cementerio y antes del operador: «Fecha: dd-mm-aaaa» (la misma fecha que muestra la tarjeta; si es tentativa, se mantiene el aviso «Fecha tentativa según el plan»). Sin fecha no se escribe nada (queda «Sin fecha programada»).
2. **Menú al marcar la visita:** un clic en la tarjeta de la visita (Por Realizar / Asignado / Reprogramada…) **o en la celda izquierda de la fila** abre el menú «Detalles de Programación» (el modal que antes solo abría el doble clic) con **fecha** y **operador** de esa visita. Guardar escribe solo esa visita (`fechasPorVisita.V<n>`, `operadoresPorVisita.V<n>`), igual que antes; exige fecha válida.
3. **Mover en el Gantt se conserva:** el menú trae el botón «Mover eligiendo una casilla del Gantt», que deja la visita marcada para elegir el día (el clic antes servía para esto; un segundo clic sobre la misma tarjeta en ese modo lo cancela).
4. Los textos de ayuda (tooltips) de las tarjetas ya no dicen «Doble Clic».

## Pruebas
- `tests/planificacion-menu-visita.test.mjs` (estática; en rojo antes, en verde después).
- `tests/e2e/planificacion-menu-visita.e2e.mjs` (navegador + emuladores `demo-gravecare`, puertos +2300): la fecha va tras el cementerio; el clic abre el menú; guardar cambia fecha y operador y Firestore recibe solo `V1`; el botón «Mover» entra al modo mover.
- `node --test tests/ public/js/` → 349/349 en verde. E2E `b2-pagadas`: 14/16 (los 2 fallos de `clientes.html` son previos, ver `fix-todos-trabajos-carga.md`).

## Despliegue y reversa
Solo Hosting `gravecare-ops`, lo ejecuta el dueño desde un clon limpio en un tag con `--only hosting:gravecare-ops --project gravecare-2e8d2`. Esta rama incluye el arreglo de «Todos los Trabajos» (PR 5) y lo ya publicado en `ops-clientes-2`. Reversa: revertir en el historial de Hosting a la versión anterior (o redesplegar el tag previo); no hay datos que deshacer.
