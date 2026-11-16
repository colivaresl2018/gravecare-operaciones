# Reporte — Planificación & Gantt: fecha visible y editable por visita

2026-11-16 · Rama `feat/planificacion-fecha-editable` (parte de `ops-17`). Pedido directo del dueño: «aquí le falta la fecha y la posibilidad de cambiarla». No se desplegó nada. Sin secretos, correos ni RUT.

## 1. Qué pasaba
En `public/planificacion.html` la columna del cliente no mostraba la fecha de cada visita (solo «Sin fecha programada» o «Fecha tentativa según el plan»). Cambiarla exigía hacer doble clic en la tarjeta amarilla dentro del cronograma, que solo se ve si cae en los días mostrados. Con la ventana en otros días no había forma de ver ni de cambiar la fecha.

## 2. Qué cambió (único archivo de la página: `public/planificacion.html`)
- La columna del cliente muestra «Fecha: dd-mm-aaaa» cuando la visita tiene fecha (la guardada o la tentativa).
- Un botón «Cambiar fecha» (o «Asignar fecha» si no hay fecha) por visita. Abre el **mismo modal** de reprogramación que ya existía (fecha y operador) y guarda igual que antes: solo la clave de esa visita, con `construirActualizacionFecha`.
- El doble clic en la tarjeta sigue funcionando. Ahora comparte con el botón la función `abrirModalReprogramar`.
- **Cambio visual autorizado por el dueño:** una línea nueva con la fecha y un botón pequeño en la columna del cliente. No se tocó nada más del diseño ni de los textos existentes.

## 3. Pruebas
- Nueva: `tests/planificacion-fecha-visible-editable.test.mjs` (5 pruebas; 4 fallaban antes del cambio).
- `node --test tests/ public/js/`: 339 de 339. Sintaxis del script de la página comprobada con `node --check`.
- **No probado en navegador** contra datos reales: falta abrir Planificación, ver la fecha, pulsar «Cambiar fecha», guardar y comprobar que se refleja en el cronograma y en Órdenes de Servicio.

## 4. Despliegue y reversa
Solo Hosting del backoffice, desde un clon limpio en el tag `ops-18`: `firebase deploy --only hosting:gravecare-ops --project gravecare-2e8d2`. Reversa: volver a `ops-17` y repetir el despliegue. No cambia datos, reglas ni funciones.
