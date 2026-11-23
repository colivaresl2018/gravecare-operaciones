# Proveedores y orden de compra por día (spec 057)

**Fecha:** 2026-11-23 · **Rama:** `feat/057-proveedores-compra-dia` (desde `feat/ordenes-compra`) · **Estado:** implementada y probada en local; lista para revisión. **No desplegada, sin PR, sin push**: el despliegue lo ejecuta el dueño. **Depende de reglas de Firestore que se publican en el repo de la web** (ver «Bloqueo»).
**Autorización:** el dueño aprobó la spec 057 («apruebo la specs 057»), el plan y las tareas, el documento candado `proveedoresRut` y ordenó implementar («Sí, empieza»), todo en la conversación del 2026-11-23.

## Para qué sirve
1. **Maestro de proveedores** con RUT único, ligado a las órdenes de compra, con alta, edición y «quitar» (sin borrar).
2. **Desplegable «Razón social»** en la pantalla de Órdenes de compra: al elegir un proveedor se rellenan RUT, contacto, teléfono, dirección y condición de pago; la orden guarda una **copia** de esos datos.
3. **Botón «Crear orden de compra» por día** en **«Compra de flores»** (Planificación Planes y Spot): cuando el día está listo, arma un **borrador** con los ramos de ese día, para revisarlo y emitirlo a mano. «Rutas y feriados» solo muestra el estado de cada día.

## Qué se hizo
- **Proveedores** (`public/js/proveedores.js`, `proveedores-db.js`, pestaña nueva en `ordenes-compra.html`). El RUT se valida con módulo 11 (con o sin puntos, con `K`). La unicidad se garantiza con un documento candado `proveedoresRut/{rut sin puntos}` que se crea en la **misma transacción** que el proveedor; si se cambia el RUT, se reserva el nuevo y se libera el anterior. Un RUT repetido se rechaza con «Ya existe un proveedor con ese RUT.». «Quitar» pone `activo:false` y solo lo ve el dueño; «Reactivar» lo devuelve.
- **Desplegable de razón social.** Muestra solo proveedores activos y «Otro proveedor (escribir)» (sin maestro, como antes). Al emitir se **relee** el proveedor dentro de la transacción: si ya no está activo, la emisión se rechaza con «El proveedor ya no está activo; elige otro.» sin consumir número. Se guardan el snapshot (`proveedor`) y `proveedorId` en la orden. Un cambio posterior en el maestro no altera órdenes ya emitidas.
- **Borradores por día** (`compra-dia.js`, `compra-dia-vistas.js`). «Día listo» = hay visitas, todo cementerio del día tiene eje y día de ruta, y ningún ramo está sin valor; si no está listo, la pantalla dice por qué y deshabilita el botón. El cálculo es el mismo de «Compra de flores» (`construirListaCompra`); no se inventa ningún precio. El borrador vive en `ordenesCompraBorradores/{AAAA-MM-DD}` (**uno por día**), se crea en una transacción idempotente (pulsar dos veces no duplica; si ya existe, se abre), **no lleva número ni toca el contador**; al emitirlo nace `OC-NNNN` y el borrador queda con `emitidoComo`.
- **Compra de flores** (`public/planificacion-servicios.html`). Columna nueva «Orden de compra» en cada día con visitas: botón «Crear orden de compra» (habilitado solo si el día está listo; si no, queda deshabilitado y se ven los mismos motivos), «Abrir borrador» si ya existe o «Emitida como OC-xxxx». La regla de «día listo» sigue siendo una sola (`diaListo` en `compra-dia.js`, aplicada con `estadoDiasCompra` sobre la misma lista que se ve en pantalla, respetando «incluir visitas completadas»); el borrador se arma con el día tal como se muestra. La única escritura nueva de esta pantalla es el borrador (`ordenesCompraBorradores/AAAA-MM-DD`, transacción idempotente). Si no se pueden leer los informes no se ofrece crear (no se sabe qué visitas ya se hicieron); si no se pueden leer los borradores, avisa y la transacción abre el existente en vez de duplicar.
- **Rutas y feriados.** La sección «Días de programación» (al final de la pestaña de rutas) queda **solo como estado**: semana con Anterior/Hoy/Siguiente, visitas, ramos, «Listo»/«No listo» y los motivos, sin botón. Es solo lectura y no escribe nada nuevo; si fallan lecturas, la pantalla sigue y lo avisa.
- **Pantalla de órdenes:** lista de borradores del día (abrir/«Emitida como OC-xxxx») y precarga por `ordenes-compra.html?borrador=AAAA-MM-DD`.

## Pruebas
- **Automáticas:** `node --test tests/ public/js/` → **711 pasan, 0 fallan** (638 de la línea base + 73 nuevas): RUT y validación, transacciones simuladas (incluido RUT repetido simultáneo y emisión concurrente), emisión con proveedor inactivo, borradores idempotentes, snapshot, vistas escapadas (AUD-01), estructura de las páginas (Compra de flores con el botón y Rutas y feriados solo con estado, sin escrituras nuevas) y sintaxis del script inline de `rutas-feriados.html`. Las pruebas de páginas se actualizaron a propósito (tres pestañas en órdenes; `runTransaction` permitido solo en Compra de flores para crear el borrador; colecciones permitidas ampliadas); sin esos cambios fallaban justamente por lo que la spec agrega.
- **En navegador contra emuladores** (`demo-gravecare`, `GC_OFFSET=1500`, reglas de la web **más** la propuesta de `docs/referencia/reglas-propuestas-057.md`, datos ficticios): en **Compra de flores**, martes con 3 visitas Spot (Standard, Premium +1 adicional, Deluxe) → botón habilitado, 4 ramos; miércoles en un cementerio sin ruta → botón deshabilitado con «Sin eje y día de ruta: …»; clic doble en «Crear orden de compra» → **un solo borrador** (neto 62.000, IVA 11.780, total 73.780, sin número, `contadores/ordenesCompra` sin crear); la pantalla de órdenes cargó las 4 líneas; crear proveedor de prueba OK, repetir su RUT → «Ya existe un proveedor con ese RUT.», RUT con dígito malo → rechazo; emitir eligiendo el proveedor → `OC-0001` con `proveedorId` y snapshot, contador en 1, borrador con `emitidoComo: OC-0001`; al volver a Compra de flores el día muestra «Abrir borrador» (y «Emitida como OC-0001» tras emitir); «Rutas y feriados» muestra solo el estado de los días (0 botones); navegación de semanas OK.
- **Pruebas negativas de reglas** (emulador, token real de staff, no el token «owner»): se **rechazan** borrar proveedor, candado o borrador; liberar el candado de otro proveedor; borrador con id inválido o con campo ajeno (número); marcar `emitidoComo` dos veces; proveedor sin reservar su RUT; lectura sin sesión. Las 9 se rechazaron como se esperaba.

## Qué no se probó / límites
- **No se vio en pantalla (captura):** el panel del navegador estaba oculto; el comportamiento se verificó por texto, DOM y base de datos del emulador. Falta una revisión visual del dueño (diseño nuevo solo en la columna «Orden de compra» de Compra de flores, la sección de estado de días, la pestaña de proveedores y el desplegable).
- **Las reglas propuestas no están publicadas ni probadas en `tests/reglas/` de la web**: se verificaron solo en el emulador con las pruebas de arriba. En producción **hoy** los proveedores y borradores se rechazan, y emitir una orden con un proveedor de la lista falla (la regla vigente de `ordenesCompra` no acepta `proveedorId`).
- **`valores_ramos/compra` aún no existe en producción** (verificado en solo lectura al redactar la spec): sin cargar «Valores de los Ramos», ningún día queda listo y el botón se queda deshabilitado con el motivo.
- Las pruebas de `proveedores.js` y `compra-dia.js` base se escribieron junto con el módulo y no se vieron fallar antes; el resto, sí (anotado en `tasks.md`).
- No se probó el aspecto en celular ni con muchos proveedores. No hay vínculo visita-insumo en la base: el borrador trae **solo ramos** (decisión 5a); los insumos se agregan a mano.
- Al terminar de crear el borrador, la pantalla navega dentro del marco del portal; el resaltado del menú lateral puede quedar en «Planificación Planes y Spot» aunque se vea «Órdenes de compra».

## Bloqueo y orden de publicación
1. **Reglas primero (repo de la web, sesión de la web):** publicar `proveedores`, `proveedoresRut`, `ordenesCompraBorradores` y el campo opcional `proveedorId` en `ordenesCompra` (regla de oro 9: cambio de reglas, aditivo). Texto, tabla de campos y pruebas mínimas en `docs/referencia/reglas-propuestas-057.md`; filas del contrato en el mismo documento para `docs/10-contrato-de-datos.md`. Este repo no toca las reglas ni el repo de la web.
2. Después, **Hosting del backoffice**. Si se publica antes que las reglas: la pestaña Proveedores y los borradores muestran el aviso de permiso, y emitir con un proveedor de la lista falla (con «Otro proveedor» sigue como hoy).
3. El dueño carga **Valores de los Ramos** y las **rutas** de los cementerios para que los días queden listos.

## Formato del RUT (contrato con las reglas de la web)
El proveedor guarda `rut` **con puntos, guion y `K` mayúscula** (`12.345.678-5`, `30.000.007-K`), aunque se escriba sin puntos o con `k` minúscula. El id del candado `proveedoresRut/{id}` es ese mismo RUT **sin puntos** (`12345678-5`, `30000007-K`). Lo fijan dos pruebas en `public/js/proveedores-db.test.mjs` (crear y editar el RUT).

## Seguridad (checklist del PR)
- [x] Todo dato mostrado pasa por `esc()` (proveedores, borradores, días, motivos): pruebas con `<b>`.
- [x] RUT de prueba generados (`76.543.210-3`, `12.345.678-5`, `30.000.007-K`); ningún dato personal real en código, pruebas ni emulador.
- [x] Sin secretos ni dependencias nuevas (`package.json` sin cambios; `npm audit` no aplica a este diff).
- [x] Nada se borra: ninguna regla propuesta permite `delete`; quitar = `activo:false`, borrador emitido = `emitidoComo`.
- [x] Escrituras del navegador en `try/catch` con aviso claro; botones bloqueados mientras escriben.
- [x] Cambios aditivos al contrato de datos; sin renombrar nada; no se tocan `ordenes`, `rutas`, `feriados` ni `valores_ramos`.
- [x] Commits por nombre (`git diff --cached --name-only` revisado en cada uno).
- Datos personales de proveedores (muchos son personas naturales) y **retención**: decisión del dueño pendiente (spec §13).

## Decisiones pendientes del dueño
1. **Retención de datos de proveedores** y los datos de GraveCare (RUT y dirección) para el encabezado de la OC.
2. ~~Estado real de la spec 055~~ — resuelto el 2026-11-23: está aprobada desde el 2026-11-22; se corrigió `docs/reportes/ordenes-compra.md`.

## Despliegue y reversa (lo ejecuta el dueño)
- **Requisito previo:** reglas publicadas (arriba). Tag sugerido `ops-planserv-10`, desde `C:\Despliegue\GravecareOps` (clon limpio): `git fetch --tags origin`, `git checkout ops-planserv-10`, `git describe --tags`; `public/` debe tener **102 archivos** (93 de `ops-planserv-9` + 9 nuevos) y la salida de Firebase debe decir **«found 102 files»**. Luego `firebase deploy --only hosting:gravecare-ops --project gravecare-2e8d2`. Nada de Functions.
- **Reversa:** republicar `ops-planserv-9`. Lo creado en `proveedores`, `proveedoresRut`, `ordenesCompraBorradores` y las `ordenesCompra` emitidas queda guardado (nada se deshace en datos). Las reglas se restauran desde la copia que guarda el repo de la web; el campo `proveedorId` de órdenes ya emitidas es inofensivo si se retira la pantalla.
- **Prueba después de publicar (con el dueño):** crear un proveedor de prueba, repetir su RUT (debe rechazar), emitir una OC eligiéndolo, y crear el borrador de un día listo desde «Compra de flores».

## Archivos
- **Nuevos:** `public/js/proveedores.js`, `proveedores-db.js`, `compra-dia.js`, `compra-dia-vistas.js` y sus `.test.mjs` (más `ordenes-compra-proveedor-borrador.test.mjs` y `ordenes-compra-proveedores-vistas.test.mjs`); `tests/helpers/firestore-simulado.mjs`; `specs/057-proveedores-y-compra-por-dia/` (spec, plan, tareas); `docs/referencia/reglas-propuestas-057.md`; este reporte.
- **Modificados:** `public/ordenes-compra.html`, `public/js/ordenes-compra-db.js`, `public/js/ordenes-compra-vistas.js`, `public/rutas-feriados.html`, `tests/ordenes-compra-pagina.test.mjs`, `tests/rutas-feriados-pagina.test.mjs`.
- **Fuera del repo (sesión):** el emulador se levantó con puertos desplazados (+1500) y datos ficticios; se detuvo al terminar. Al primer arranque el concentrador del emulador tomó por un momento los puertos por defecto 4400 y 4500 (estaban libres); se detuvo ese proceso (propio, identificado por su línea de comandos) y se reinició con todos los puertos desplazados. No se tocó ningún proceso del dueño.
