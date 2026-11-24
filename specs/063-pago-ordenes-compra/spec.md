# Spec 063 — Seguimiento de pago de las órdenes de compra: estado «Pagada», N° de factura, fecha de pago y comentario

- **Estado:** **Borrador, pendiente de aprobación del dueño.** Este documento solo describe; no hay código ni cambios de reglas todavía.
- **Backlog:** por asignar (el dueño o el PM le dan el número N…).
- **Repo:** `gravecare-operaciones` (backoffice), parte de pantalla. Las **reglas de Firestore** viven solo en el repo de la web (regla de oro 5): la web necesita una spec espejo con las reglas del §8, sus pruebas de emulador y la publicación del dueño. Este repo **no guarda copia de las reglas**.
- **Autor / fecha:** Claude Code (sesión del backoffice), 2026-11-23.
- **Aprobada por / fecha:** —
- **Parte de:** extiende la spec 055 (órdenes de compra; el R7 de la 055 se mantiene salvo la ampliación que fija esta spec). No toca la 057 (proveedores), la 058 (correo) ni la 061 (PDF).
- **Pedido del dueño (resumen fiel):** en la pestaña «Órdenes de compra», que existan tres estados (**Emitida, Pagada, Anulada**); junto a «Estado», una columna **«Pagado con factura N°»** y otra **«Fecha de pago»**; poder agregar **comentarios**, que aparezcan **al pasar el cursor sobre la orden de compra**; el cambio de estado y el ingreso de la fecha son **manuales** (menú desplegable para el estado y calendario para la fecha) y ambos se **guardan en Firebase**. *(El dueño corrigió que son 3 estados, no 4.)*

## 1. Contexto y problema

- La lista de órdenes (`public/ordenes-compra.html`, `htmlFilasOrdenes`) muestra Número, Fecha, Proveedor, Total y Estado. Hoy una orden solo puede ser **Emitida** o **Anulada**.
- La regla publicada de `ordenesCompra` (spec 055) hace la orden **inmutable** después de emitirla: el único `update` permitido es Emitida → Anulada, solo por el dueño y solo con `estado`, `anuladaEl`, `anuladaPor` y `motivoAnulacion`. Cualquier otro campo se rechaza.
- No hay forma de dejar constancia de que una orden se pagó, con qué factura ni cuándo, ni de anotar una observación. Hoy ese seguimiento se hace fuera del sistema.
- Consecuencia técnica: **esto no se puede hacer solo con pantalla**. Sin una regla nueva, Firestore rechazaría el guardado.
- Cosas que ya existen y no deben romperse: el envío por correo (058) escribe `envios` desde el servidor; el PDF archivado (060/061) se genera al emitir; `htmlFilasOrdenes` pinta «Emitida» para cualquier estado que no sea «Anulada» (hay que corregirlo).

## 2. Objetivo

1. Tres estados de orden: **Emitida**, **Pagada** y **Anulada**, con transiciones definidas (R2) y siempre manuales.
2. Dos columnas nuevas junto a «Estado»: **«Pagado con factura N°»** y **«Fecha de pago»**.
3. Un **comentario** por orden, visible al pasar el cursor sobre la orden y editable.
4. El estado, la factura, la fecha y el comentario se guardan en `ordenesCompra/{numero}` con regla de Firestore que mantiene intacto lo comercial (líneas, montos, proveedor).

## 3. Fuera de alcance

- **Pagos parciales o varias facturas por orden.** Esta spec supone **un** N° de factura y **una** fecha de pago por orden (decisión D3). Si más adelante se necesitan, va en una spec aparte con un historial de pagos.
- **Escribir en `gastos_ingresos` o `comprobantes_tributarios`**, generar un gasto por el pago o validar la factura contra algún registro tributario (regla de oro 4: sin directriz expresa no se tocan). El N° de factura es un dato de seguimiento.
- Notificaciones, recordatorios de pago, filtros o reportes por estado, adjuntar la factura en archivo.
- Cambiar `htmlImpresion`, el PDF archivado, el correo al proveedor o la emisión/anulación existentes. Los datos de pago y el comentario **no** salen en el PDF ni en el correo.
- Cambiar la numeración, el maestro de materiales, los proveedores o los borradores.
- Borrar nada. No hay borrado de órdenes ni de campos de seguimiento más allá de lo que fija R9 (reversión).

## 4. Requisitos

**Estados y transiciones**
- **R1.** `estado` admite exactamente tres valores: `Emitida`, `Pagada`, `Anulada`. («Borrador» pertenece a la pestaña de borradores por día y no cambia.)
- **R2.** Transiciones permitidas, todas **manuales** (nada cambia el estado solo: ni el paso del tiempo, ni la fecha de pago, ni el envío por correo):
  - **Emitida → Pagada**: pide N° de factura y fecha de pago (R5).
  - **Pagada → Emitida** (reversión para corregir un error): pide motivo y deja constancia (R9).
  - **Emitida → Anulada**: como hoy (spec 055): solo el dueño, con motivo y confirmación.
  - **Pagada → Anulada: no permitida** (decisión D4): una orden pagada se corrige con una nota de crédito, no se anula.
  - **Anulada** es definitiva: no sale de ahí.
- **R3.** Editar el N° de factura, la fecha de pago o el comentario **sin cambiar el estado** es válido mientras la orden esté Emitida o Pagada (corregir una errata).

**Quién puede**
- **R4.** Registrar el pago, corregir factura o fecha y revertir: **dueño o administrador** (decisión D2). Anular: solo el dueño, como hoy. El **comentario** lo puede escribir cualquier staff mientras la orden no esté Anulada. La pantalla muestra u oculta los controles según el perfil, pero **la barrera real son las reglas** de Firestore.

**Datos del pago y comentario**
- **R5.** Al pasar a `Pagada` son obligatorios:
  - `facturaNumero`: texto, tras `trim()` de 1 a 20 caracteres, solo letras, números, espacio, `.`, `/` y `-`, empezando por letra o número (`^[A-Za-z0-9][A-Za-z0-9 ./-]{0,19}$`).
  - `fechaPago`: texto `AAAA-MM-DD` que sea una fecha real, **no anterior a la fecha de la orden** (`fecha`) y **no futura** (la pantalla compara con el día de hoy; las reglas solo exigen el formato y que no sea anterior a `fecha`). Un pago futuro no es un pago hecho (decisión D6).
- **R6.** `comentario`: texto libre, tras `trim()` de 0 a 500 caracteres; `''` significa sin comentario. Campo ausente = sin comentario. Se muestra siempre escapado (R12).
- **R7.** Constancia: al registrar o corregir el pago se guardan `pagoRegistradoEl` (ISO) y `pagoRegistradoPor` (uid); al escribir o cambiar el comentario, `comentarioActualizadoEl` y `comentarioActualizadoPor` (uid). Los uid no se muestran en pantalla, PDF ni correo.
- **R8.** Compatibilidad hacia atrás: una orden sin estos campos es una orden sin pago y sin comentario; las Emitidas y Anuladas existentes siguen igual y no se migran.
- **R9.** Reversión **Pagada → Emitida**: pide `motivoReversionPago` (obligatorio, hasta 500 caracteres). Se guardan `pagoRevertidoEl`, `pagoRevertidoPor` y `motivoReversionPago`, y `facturaNumero` y `fechaPago` vuelven a `''`. Para no perder lo que estaba anotado, la pantalla antepone al motivo el texto «Se quitó: factura N° … y fecha de pago …. Motivo: …» (dentro del tope de 500). Si se vuelve a pagar, esos datos nuevos reemplazan a los anteriores.
- **R10.** **Inmutabilidad comercial** (R7 de la 055, intacto): ninguna escritura de esta spec toca `numero`, `fecha`, `fechaEntrega`, `proveedor`, `proveedorId`, `condicionesPago`, `lugarEntrega`, `lineas`, `neto`, `iva`, `total`, `creadaEl`, `creadaPor`, `envios` ni los campos de anulación. Las reglas lo imponen con una lista cerrada de campos modificables (§8).

**Pantalla**
- **R11.** La tabla de órdenes pasa de 6 a 8 columnas: Número, Fecha, Proveedor, Total, **Estado**, **Pagado con factura N°**, **Fecha de pago**, acciones. Las dos columnas nuevas muestran `—` cuando no hay dato (orden Emitida o Anulada). La fila vacía y los mensajes de error usan el `colspan` nuevo. La insignia de estado reutiliza el patrón de las actuales (Emitida verde, Anulada gris) y suma `Pagada` con otro color del mismo estilo; **no cambia el resto del diseño**.
- **R12.** **Comentario al pasar el cursor.** Cuando la orden tiene comentario, la celda del Número muestra un pequeño indicador (ícono de comentario) y, al pasar el cursor por el número (o al enfocarlo con el teclado), aparece un globo con el texto. Para pantallas táctiles, tocar el ícono abre y cierra el mismo globo; `Escape` lo cierra. El texto del globo se asigna con `textContent` (nunca `innerHTML`) o pasa por `esc()`, conserva los saltos de línea y se acota en alto. Sin comentario no hay indicador ni globo. El comentario también se ve y se edita en el panel de seguimiento (R13).
- **R13.** **Panel de seguimiento** (modal, mismo estilo que `#modal-oc`), abierto desde un botón **«Seguimiento»** nuevo en la fila, junto a «Ver / imprimir» y «Anular». Contiene:
  - **Estado:** menú desplegable (`<select>`) que ofrece solo las transiciones válidas del estado actual: desde Emitida → Emitida, Pagada y, solo para el dueño, Anulada; desde Pagada → Pagada y Emitida; desde Anulada, fijo y deshabilitado. Elegir Anulada exige el motivo y reutiliza `anularOrden`; el botón «Anular» existente se mantiene.
  - **N° de factura** (texto) y **Fecha de pago** (`<input type="date">` nativo, calendario del navegador), visibles y obligatorios cuando el estado elegido es Pagada.
  - **Motivo** (solo al revertir o anular).
  - **Comentario** (área de texto con contador de 500 caracteres).
  - **Guardar** y **Cancelar**. Guardar pide confirmación cuando cambia el estado («¿Marcar la OC-NNNN como Pagada con la factura N° … el AAAA-MM-DD?»). **No se guarda al cambiar el menú**: el cambio de estado es una acción deliberada.
  - Quien no puede cambiar el pago (R4) ve el panel con los datos del pago de solo lectura y solo puede editar el comentario.
- **R14.** Escritura en **transacción**: lee la orden, confirma que sigue en el estado que la pantalla creía (si otra persona la cambió mientras tanto, avisa y no escribe), y escribe **solo** los campos de la transición. El número de la orden, la lista y el contador no se tocan. Los botones se deshabilitan mientras se guarda y se rehabilitan siempre (`finally`).
- **R15.** Si falla el guardado: `permission-denied` → «Firestore rechazó el guardado: tu usuario no tiene permiso, o las reglas del seguimiento de pago todavía no están publicadas. No se guardó nada.»; sin conexión → el texto ya existente; otro → el mensaje del error. Tras guardar bien, la lista se recarga.
- **R16.** `htmlFilasOrdenes` y el recuadro de detalle pintan el estado según su valor real (Emitida, Pagada, Anulada); un valor desconocido se muestra escapado como está, sin llamarlo «Emitida».
- **R17.** **Otras funciones, sin cambio:** «Enviar por correo» sigue disponible solo para órdenes Emitidas (spec 058 R7), así que una orden Pagada no muestra el botón; «Imprimir» sigue abriendo el PDF archivado; `htmlImpresion` no cambia y no incluye pago ni comentario; la anulación sigue como en la 055.
- **R18.** Sin datos escritos en el código (ni facturas ni comentarios de ejemplo); todo dato de Firestore pasa por `esc()` (AUD-01) en filas, panel, globo y mensajes.

## 5. Criterios de aceptación

| CA | Dado | Cuando | Entonces | Prueba |
|---|---|---|---|---|
| CA1 | orden Emitida | se registra pago con factura `F-1234` y fecha válida | pasa a `Pagada`; se escriben `estado`, `facturaNumero`, `fechaPago`, `pagoRegistradoEl/Por` y nada más | `ordenes-compra-db.test.mjs` |
| CA2 | orden Emitida | se intenta Pagada sin factura, con factura de 21 caracteres o con caracteres no permitidos | se rechaza antes de escribir | ídem |
| CA3 | orden Emitida | fecha de pago inválida (`2026-02-30`), anterior a la fecha de la orden o futura | se rechaza antes de escribir | ídem |
| CA4 | orden Pagada | se corrige la factura o la fecha | sigue `Pagada`; solo cambian esos campos y `pagoRegistradoEl/Por` | ídem |
| CA5 | orden Pagada | se revierte con motivo | pasa a `Emitida`; `facturaNumero` y `fechaPago` quedan `''`; se guardan `pagoRevertidoEl/Por` y el motivo con el prefijo «Se quitó: …» | ídem |
| CA6 | orden Pagada | se revierte sin motivo | se rechaza | ídem |
| CA7 | orden Pagada | se intenta Anulada | se rechaza («no se puede anular desde el estado Pagada») | ídem |
| CA8 | orden Anulada | se intenta cualquier cambio de pago, estado o comentario | se rechaza | ídem |
| CA9 | cualquier transición | se arma la escritura | los campos escritos son **solo** los permitidos (lista cerrada de R10); `lineas`, `neto`, `iva`, `total`, `proveedor`, `envios` y anulación nunca van | ídem |
| CA10 | comentario de 0, 1 y 500 caracteres, y de 501 | se guarda | `''`, 1 y 500 pasan; 501 se rechaza; `comentarioActualizadoEl/Por` se guardan | ídem |
| CA11 | otra persona cambió el estado de la orden mientras se editaba | se guarda | la transacción detecta el cambio, avisa y no escribe | ídem |
| CA12 | perfil dueño / administrador / supervisor (el operador no ve este menú) | se abre el panel | dueño y administrador ven el cambio de estado y de pago; el dueño además Anulada; el supervisor solo edita el comentario | `ordenes-compra-vistas.test.mjs` |
| CA13 | lista de órdenes (Emitida, Pagada, Anulada, sin campos nuevos) | se pinta la tabla | 8 columnas; `—` donde no hay dato; Pagada muestra factura y fecha; el estado se lee del dato real | ídem |
| CA14 | orden con comentario `<script>…` o `"><img onerror=…>` | se pinta la fila, el panel y el globo | sale como texto escapado, sin ejecutar nada | ídem |
| CA15 | orden con y sin comentario | cursor o foco sobre el número / toque en pantalla táctil | con comentario aparece y se oculta el globo; sin comentario no hay indicador | prueba de página + validación manual |
| CA16 | menú de estado en cada estado actual | se abre | solo ofrece las transiciones válidas de R2 y R4 | `ordenes-compra-vistas.test.mjs` |
| CA17 | cambio de estado sin confirmar | se cancela la confirmación | no se escribe nada | prueba de página |
| CA18 | falla `permission-denied` | se intenta guardar | se muestra el texto de R15 y la pantalla sigue usable | prueba de página + validación manual |
| CA19 | `ordenes-compra.html` | se inspecciona | sin `setDoc`/`deleteDoc`/`addDoc`/`writeBatch`; solo transacciones; sin escrituras a `gastos_ingresos` ni `comprobantes_tributarios`; `htmlImpresion` sin cambios | `tests/ordenes-compra-pagina.test.mjs` |
| CA20 | órdenes anteriores (sin campos nuevos) | se abre la lista y el detalle | se ven igual que hoy, con `—` en las columnas nuevas | ídem |
| CA21 | la suite vigente | se corre `node --test tests/ public/js/` | sigue en verde, más las pruebas nuevas | suite completa |

## 6. Flujos afectados

- **Emitir, borradores, proveedores, imprimir/PDF y enviar por correo (055, 057, 058, 060, 061): no cambian.** El seguimiento ocurre después de emitir y no altera lo ya emitido.
- **Anular:** sigue igual (solo dueño, solo desde Emitida, con motivo). Cambia solo que una orden Pagada ya no se puede anular.
- La lista de órdenes gana dos columnas, un botón y un globo; la pestaña Maestro de materiales y las demás no se tocan.
- Los flujos de clientes de la web (F0–F5) y las colecciones `ordenes`, `contratos`, `sepulturas`, `pagos`, `gastos` no se tocan.

## 7. Seguridad (obligatoria)

- **Activos:** integridad de la orden emitida (montos, líneas, proveedor), el registro de pago, la identidad de quien lo registra, los comentarios internos.
- **Amenazas y abuso:**
  - Un staff sin permiso marca una orden como pagada: las reglas permiten el pago solo a dueño o administrador; la pantalla es solo comodidad.
  - Alteración de montos o líneas aprovechando el nuevo `update`: la regla acepta una **lista cerrada** de campos (§8) y exige que los campos comerciales no cambien.
  - Marcar como pagada una orden anulada o anular una pagada: la regla compara el estado anterior con el nuevo y solo acepta las transiciones de R2.
  - Doble clic o dos personas a la vez: transacción con verificación del estado previo, botones deshabilitados y confirmación al cambiar de estado.
  - Inyección en el comentario o en la factura (HTML, `<script>`): `esc()` en las vistas, `textContent` en el globo, validación de formato y largo en cliente **y** en reglas.
  - Comentarios demasiado largos o datos basura: tope de 500 y formato de factura/fecha en reglas.
  - Fecha o factura falsas para ocultar un pago: no se puede prevenir con reglas (es dato manual); se mitiga con la constancia de quién y cuándo (R7) y la reversión con motivo (R9).
- **Datos personales:** no se agrega ninguno nuevo. El comentario es interno: no va en el PDF, ni en el correo, ni en la URL, ni en `console`. Los uid de constancia no se muestran.
- **Reglas y secretos afectados:** una regla nueva en `firestore.rules` (solo web). Ningún secreto, ninguna dependencia nueva, sin cambios en Storage ni en Functions.
- **Checklist del PR:** sin secretos; el cliente no decide permisos (los decide la regla); entradas validadas y salidas escapadas; contrato de datos solo aditivo; el repo no guarda copia de las reglas; rollback escrito (§10).

## 8. Datos

**Campos nuevos en `ordenesCompra/{numero}`** (todos opcionales; la ausencia significa «sin pago» o «sin comentario»; no se renombra ni elimina nada existente):

| Campo | Tipo | Cuándo |
|---|---|---|
| `estado` | texto `Emitida` \| `Pagada` \| `Anulada` | ya existe; ahora admite `Pagada` |
| `facturaNumero` | texto, ≤ 20, formato de R5 (`''` si no hay) | al pagar o corregir; `''` al revertir |
| `fechaPago` | texto `AAAA-MM-DD` (`''` si no hay) | al pagar o corregir; `''` al revertir |
| `pagoRegistradoEl` / `pagoRegistradoPor` | texto ISO / uid | al pagar o corregir |
| `pagoRevertidoEl` / `pagoRevertidoPor` / `motivoReversionPago` | texto ISO / uid / texto ≤ 500 | al revertir |
| `comentario` | texto ≤ 500 (`''` = sin comentario) | al escribir o cambiar |
| `comentarioActualizadoEl` / `comentarioActualizadoPor` | texto ISO / uid | al escribir o cambiar el comentario |

**Regla propuesta para la web (referencia, no es código a pegar; la web la escribe, la prueba con emuladores y la publica el dueño).** `allow update` pasa a ser la unión de tres ramas, cada una con su lista cerrada de `affectedKeys`:

1. **Anular** (sin cambios, spec 055): `esDueno()`, de `Emitida` a `Anulada`, solo `estado`, `anuladaEl`, `anuladaPor`, `motivoAnulacion`.
2. **Pago** (nueva): `esDueno() || esAdministrador()`; el estado anterior y el nuevo están en `Emitida`/`Pagada` y la transición es una de R2; solo pueden cambiar `estado`, `facturaNumero`, `fechaPago`, `pagoRegistradoEl`, `pagoRegistradoPor`, `pagoRevertidoEl`, `pagoRevertidoPor`, `motivoReversionPago`; si el nuevo estado es `Pagada`: `facturaNumero` cumple el formato, `fechaPago` cumple `AAAA-MM-DD` y es `>= resource.data.fecha`, `pagoRegistradoPor == request.auth.uid`; si es una reversión: motivo no vacío de ≤ 500, `facturaNumero == ''`, `fechaPago == ''`, `pagoRevertidoPor == request.auth.uid`.
3. **Comentario** (nueva): `esStaff()`; el estado anterior no es `Anulada` y **no cambia**; solo pueden cambiar `comentario`, `comentarioActualizadoEl`, `comentarioActualizadoPor`; `comentario` es texto de ≤ 500 y `comentarioActualizadoPor == request.auth.uid`.

`create` y `delete` no cambian (`delete` sigue en `false`). Las pruebas de emulador de la web deben cubrir cada CA de reglas: cada rol en cada transición permitida y prohibida, campos comerciales intocables, `Anulada` inmutable, `Pagada → Anulada` rechazada, formatos y tope de 500.

**Compatibilidad:** aditiva. La web (`gravecare`) no lee `ordenesCompra`. El envío por correo escribe `envios` con permisos de servidor y no se ve afectado. Una pantalla vieja que lea una orden `Pagada` la mostrará como «Emitida» y su botón «Anular» fallaría por la regla: por eso se publican **primero** las reglas y **después** el Hosting.

## 9. Validación

**Automática** (primero en rojo): las pruebas de CA1–CA21 y `node --test tests/ public/js/`, con Firestore simulado y transacciones como en la spec 055.

**Navegador con Firebase simulado** (módulo local con datos ficticios, como en la 055): lista con Emitida, Pagada y Anulada; panel y menú por cada perfil (dueño, administrador, supervisor); registrar pago, corregir, revertir; comentario con globo (ratón, teclado y toque) y con HTML hostil; error de permiso y de conexión; ancho de 375 px con scroll horizontal de la tabla.

**Reglas (en la web):** pruebas de emulador con puertos desplazados, nunca los del dueño ni producción.

**Prueba real en producción (la hace el dueño, tras publicar reglas y Hosting):** con una orden de prueba: marcarla Pagada con una factura de prueba y una fecha, ver las columnas, escribir y ver un comentario, corregir la factura, revertirla y volver a pagarla. La orden de prueba y su número no se borran.

**Orden de publicación (lo ejecuta el dueño):** 1) reglas de la web; 2) Hosting del backoffice desde el clon limpio, con tag, `--only hosting:gravecare-ops --project gravecare-2e8d2`. No se despliega el backoffice hasta confirmar que las reglas están publicadas.

## 10. Rollback

- Revertir el commit del backoffice y volver a publicar el tag anterior: las columnas, el botón y el panel desaparecen. Los campos ya guardados en `ordenesCompra` quedan sin daño (opcionales).
- Para quitar solo la capacidad de registrar pagos: la web restaura la copia de las reglas anteriores (la regla de la 055). Las órdenes ya marcadas `Pagada` siguen legibles; con las reglas viejas no se podrían volver a cambiar.
- No hay migración de datos que deshacer.

## 11. Riesgos y decisiones abiertas para el dueño

Cada una trae mi recomendación; si no dices nada, escribo la spec con ellas.

1. **D1. Aprobar esta spec** y que la web escriba su spec espejo con las reglas (§8).
2. **D2. Quién registra el pago.** Recomendado: **dueño y administrador** (es información de dinero, como «Anular»); el **comentario** lo puede escribir cualquier staff. Alternativa: todo solo dueño/administrador, o todo cualquier staff.
3. **D3. Una factura y un pago por orden** (recomendado: simple y suficiente hoy). Si una orden puede pagarse en partes o con varias facturas, hay que hacer otra spec con un historial de pagos.
4. **D4. Una orden Pagada no se puede anular** (recomendado; se corrige con nota de crédito). Alternativa: permitirlo solo al dueño y con motivo.
5. **D5. Reversión Pagada → Emitida con motivo**, que vacía factura y fecha y deja constancia en el motivo (recomendado). Alternativa: no permitir revertir.
6. **D6. Fecha de pago:** no anterior a la fecha de la orden y no futura (recomendado).
7. **D7. N° de factura:** alfanumérico libre de hasta 20 caracteres, con `.`, `/`, `-` y espacio (recomendado, por si los folios traen letras o guiones). Alternativa: solo dígitos.
8. **D8. Globo del comentario:** al pasar el cursor por el número, más un ícono tocable para celulares y tabletas (recomendado). Alternativa: solo al pasar el cursor.
9. **D9. Sin relación con gastos e ingresos** en esta spec (el pago de una orden no genera registros en `gastos_ingresos`). Si lo quieres, es otra spec con su directriz.
- **Riesgo:** la tabla pasa a 8 columnas y en pantallas angostas depende del scroll horizontal; se verifica en 375 px.
- **Riesgo:** el seguimiento es manual y puede equivocarse; se mitiga con la confirmación, la corrección permitida y la reversión con motivo.

## 12. Código de referencia existente

- `public/ordenes-compra.html` (tabla `#tbody-ordenes`, modal `#modal-oc`, transacciones de `anularOrden`, `puedeAnular`).
- `public/js/ordenes-compra-db.js` (`anularOrden`, `textoErrorOC`), `public/js/ordenes-compra-vistas.js` (`htmlFilasOrdenes`, `htmlImpresion`), `public/js/ordenes-compra-envio.js` (botón solo con `Emitida`).
- `tests/ordenes-compra-pagina.test.mjs`, `public/js/ordenes-compra-*.test.mjs`.
- Reglas vigentes: `firestore.rules` del repo de la web, bloque «Spec 055» (`match /ordenesCompra/{numero}`), tag `reglas-ordenes-compra-2026-11-22`; spec 055 R5 y R7.
