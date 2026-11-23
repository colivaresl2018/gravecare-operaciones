# Pantalla «Órdenes de compra» — maestro de materiales y órdenes de compra a proveedores (spec 055)

**Fecha:** 2026-11-22 · **Rama:** `feat/ordenes-compra` (desde `main`, tag `ops-planserv-8`) · **Estado:** listo para revisión (PR a `main`). **No desplegado**: el despliegue lo ejecuta el dueño. **Bloqueo para usarla en producción: las reglas de Firestore todavía no están publicadas** (ver más abajo).
**Autorización:** el dueño autorizó «Órdenes de Compra (spec 055)» en la conversación (2026-11-22). La spec 055 está **aprobada por el dueño desde el 2026-11-22** (corregido el 2026-11-23; antes este reporte la llamaba «borrador»); se implementó con sus propuestas por defecto y la decisión 4 ya resuelta («sí», enmienda 056 §12). Las demás decisiones abiertas quedaron como se anota en «Decisiones mías».

## Para qué sirve
La operación compra insumos y ramos a proveedores y hoy no hay una orden formal. La pantalla permite emitir órdenes de compra numeradas (OC-0001, OC-0002…) con proveedor, fechas, condiciones de pago, líneas y totales con IVA 19 %, mantener un maestro de materiales con código único, e imprimir o guardar como PDF desde el navegador.

## Qué se hizo
Página nueva `public/ordenes-compra.html`, con opción de menú **«Órdenes de compra»** en el portal (para los roles que no son operador, igual que «Rutas y feriados»). Dos pestañas:

- **Órdenes de compra.** Formulario (fecha, fecha de entrega opcional, condiciones de pago, lugar de entrega y proveedor). Las líneas se agregan por **código** y **cantidad**: la descripción, la unidad y el precio se completan solos desde el maestro (CA4). Un código que no existe no se agrega y avisa «no está en el maestro» (CA5); una cantidad 0, negativa o decimal no se agrega (CA6); un material retirado o un ramo sin valor tampoco. Pedir de nuevo el mismo código suma a su línea. Muestra neto, IVA 19 % y total. **Emitir** asigna el número y abre la vista previa con «Imprimir». Debajo, la lista de órdenes emitidas (la más nueva primero) con «Ver / imprimir» y «Anular».
- **Maestro de materiales.** Tabla con los cinco ramos y los materiales. Formulario para crear (código, descripción, tipo, unidad, precio); «Editar», «Retirar» y «Reactivar». Un código repetido se rechaza con «El código ya existe» (CA2).

## Reglas aplicadas
- **Numeración en transacción (R4).** Emitir lee el contador `contadores/ordenesCompra`, toma el siguiente número, guarda la orden y avanza el contador **en la misma transacción**; una orden inválida no consume número y un número anulado no se reutiliza. Una prueba con Firestore simulado y transacciones optimistas lanza seis emisiones simultáneas y comprueba OC-0001…OC-0006 sin saltos ni repetidos (CA8).
- **Totales (R6)**: valor = cantidad × precio; neto = Σ valor; IVA = round(neto × 0,19) con enteros; total = neto + IVA. Se **recalculan al validar**, sin confiar en los números que traiga la pantalla; los precios se copian del maestro al emitir (cambiar el maestro después no cambia una OC emitida, CA10).
- **Inmutable y sin borrar (R7).** La pantalla no tiene ni edita ni borra órdenes: solo **anula** (Emitida → Anulada, con motivo y confirmación). Un material no se borra: se retira con `activo: false`. Una prueba impide `setDoc`, `deleteDoc`, `updateDoc`, `addDoc` y `writeBatch`; las escrituras son solo transacciones en `materiales`, `ordenesCompra` y `contadores`.
- **Los ramos salen de `valores_ramos/compra` (enmienda 056 §12).** `RAM-STD`, `RAM-PRE`, `RAM-DLX`, `RAM-ADS` y `RAM-ADP` aparecen en el catálogo con el precio de «Valores de ramos»; no se editan aquí, sus códigos están reservados y un ramo sin valor queda «Sin valor» y no se puede pedir (no se inventa precio).
- **Impresión (R9).** La vista previa y la hoja impresa muestran GraveCare, número, fechas, proveedor, condiciones, líneas y totales. **Nada interno** (ni uid de quien creó o anuló, ni claims). Al imprimir solo sale la orden (`@media print`). Una orden anulada se imprime con «ORDEN ANULADA» y su motivo.
- **Todo dato escapado (R10 / AUD-01)**, incluida la impresión (verificado con `<b>`, `<i>` y `<script>`).
- **Permisos (R1).** Exige el claim de staff antes de cargar nada (B-13). Cualquier staff crea materiales y emite; **solo el dueño anula** (`staff/{uid}.dueno === true`), como propone la spec (decisión 5). Es comodidad de la interfaz: la barrera real son las reglas de Firestore.
- **Sin Cloud Functions ni cambios en la web (R11, regla 9).** No se tocan `ordenes`, `contratos`, `sepulturas`, `pagos` ni `gastos`.
- Si fallan las lecturas se avisa con «Reintentar» y un texto propio de lectura (sin decir «no se guardó»); si fallan solo los valores de ramos, la pantalla sigue con los ramos «sin valor». Los botones se deshabilitan mientras se guarda.

## ⚠️ Bloqueo: reglas de Firestore sin publicar
Hoy **no hay reglas** para `materiales`, `ordenesCompra` ni `contadores` en el repo de la web: en producción toda lectura o escritura de la pantalla será rechazada y se verá el aviso «tu usuario no tiene permiso, o las reglas de las órdenes de compra todavía no están publicadas». Las reglas **no se publican desde este repo** (regla de oro 5). Se dejó una **propuesta completa** (campos exactos que escribe la pantalla, reglas con validaciones, inmutabilidad y anulación solo por el dueño, y qué probar) en `docs/referencia/reglas-propuestas-055.md`, para que la sesión del repo de la web la revise, la pruebe con emuladores y la publique. **Hasta que se publiquen, conviene no desplegar la pantalla** (o desplegarla sabiendo que mostrará ese aviso): el menú «Órdenes de compra» aparecería sin funcionar.

## Decisiones mías (a revisar)
1. **Página propia, no una pestaña de «Planificación Planes y Spot».** La directriz B5 la lista como pestaña 8, pero esa página prueba que su única escritura es «Valores de ramos»; sumar transacciones ahí rompía esa garantía y la dejaba más grande. Es una opción propia en el menú, junto a «Rutas y feriados». Si el dueño la quiere como pestaña, se mueve el panel.
2. **Spec 055 aprobada con sus propuestas por defecto.** Condiciones de pago: Transferencia, Factura a 30 días, Contado, Otro. IVA 19 % para todo. Anula solo el dueño. Sin PDF archivado (se imprime desde el navegador) y sin envío por correo.
3. **Encabezado «GraveCare» solo con el nombre**, sin RUT ni dirección (la spec los deja como decisión abierta del dueño: no los tengo). **Sin logo**: el logo oficial `public/assets/logo.png` que cita la spec es del repo de la web; en este repo solo hay el ícono de la aplicación (con engranaje), que no corresponde a un documento para proveedores. Se agrega cuando el dueño entregue los datos y el logo.
4. **`anuladaPor`**: campo agregado (uid de quien anuló) además de lo que nombra R5; deja constancia. Si no se quiere, se quita.
5. **Los materiales no tienen RUT de proveedor ni maestro de proveedores**: el proveedor se escribe en cada orden (como la spec). El teléfono y el RUT son texto libre.
6. **Retención de datos del proveedor**: no hay borrado, así que se conservan; queda como decisión del dueño (spec §11, punto 6).

## Archivos
- **Nuevos:** `public/ordenes-compra.html`; `public/js/ordenes-compra.js`, `ordenes-compra-db.js`, `ordenes-compra-vistas.js` y sus `.test.mjs`; `tests/ordenes-compra-pagina.test.mjs`; `docs/referencia/reglas-propuestas-055.md`; este reporte.
- **Modificados:** `public/portal.html` (una opción de menú y su título; el resto del menú no cambia) y `tests/acceso-staff-paginas.test.mjs` (suma la página nueva).

## Pruebas
`node --test tests/ public/js/` → **638 pasan, 0 fallan** (antes 580). 58 pruebas nuevas, vistas primero en rojo: código y material (CA1, CA2), catálogo con ramos desde `valores_ramos` (enmienda 056), líneas (CA4, CA5, CA6), totales e IVA (R6), validación de la orden (R8), numeración con transacciones concurrentes (CA7, CA8), precios congelados (CA10), anulación (CA9 del lado del cliente), impresión sin datos internos (CA11), escape (CA12) y estructura de la página y del portal.
**Verificado en el navegador con Firebase simulado** (módulo local con datos ficticios): lista y maestro (escapados), líneas con todos los avisos, emisión (OC-0003: totales $56.000 + IVA $10.640 = $66.640; el contador avanza a 3 y la orden se escribe en la misma transacción), vista previa con escape, crear/editar/retirar/reactivar un material (solo los campos permitidos), código repetido y reservado, anular (solo campos permitidos; sin motivo no anula), la siguiente emisión toma OC-0004, impresión de una anulada, perfil supervisor (sin «Anular»), permiso denegado al cargar (aviso con «Reintentar»), sin desborde horizontal a 375 px.
**No se probó** con Firestore real, con emuladores, con las reglas (no existen aún) ni la impresión en papel o PDF del navegador; la regla CA13 (regresión) se cubre con la suite completa en verde.

## Despliegue y reversa
- **No desplegar hasta que las reglas estén publicadas** (o hacerlo sabiendo el aviso de arriba). Con tag sugerido `ops-planserv-9`: `git fetch --tags origin`, `git checkout ops-planserv-9`, `git describe --tags`, la salida debe decir **«found 93 files»** (86 + 7 archivos nuevos en `public/`), luego `firebase deploy --only hosting:gravecare-ops --project gravecare-2e8d2`, siempre desde `C:\Despliegue\GravecareOps`.
- **Después de publicar las reglas y la pantalla:** el dueño prueba con datos de prueba: crear un material, emitir una orden de 3 líneas, imprimirla y anularla.
- **Reversa:** republicar `ops-planserv-8`. Lo creado en `materiales`, `ordenesCompra` y `contadores` queda guardado (no hay nada que deshacer de datos); las reglas se restauran desde la copia que guarda el repo de la web.

## Sigue pendiente
Publicación de las reglas (repo de la web), datos del encabezado (RUT, dirección, logo), decisiones abiertas de la spec (retención de datos, PDF archivado, envío por correo), retiro del Gantt con paridad aprobada y permisos por rol R7.
