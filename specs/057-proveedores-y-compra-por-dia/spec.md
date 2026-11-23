# Spec 057 — Maestro de proveedores y orden de compra desde un día de programación

- **Estado:** Aprobada por el dueño el 2026-11-23 (ver sección 13: decisiones 1 a 6, 8 y 9 según la recomendación; 7 y 10 siguen abiertas y no bloquean la implementación). Antes de implementar: plan y tareas, y las reglas de la web revisadas (sección 15).
- **Repo:** `gravecare-operaciones` (backoffice), rama de trabajo `feat/ordenes-compra`.
- **Autor / fecha:** Claude Code (sesión del backoffice), 2026-11-23.
- **Relacionada con:** spec 055 (órdenes de compra y maestro de materiales; enmendada por la 056 §12) y spec 056 (planificación operativa: rutas por cementerio y `valores_ramos/compra`).
- **Reglas compartidas:** las reglas de Firestore se escriben y publican en el repo de la web (`C:\Proyectos\Gravecare`, regla de oro 9). Este documento solo **propone** las reglas; la sesión de la web las revisa y publica.

## 1. Contexto y problema

La spec 055 guarda el proveedor **dentro de cada orden** (`proveedor` {`razonSocial`, `rut`, `contacto`, `telefono`, `direccion`}) y deja como decisión abierta un maestro de proveedores. Hoy, para emitir una OC, el personal tiene que volver a escribir razón social, RUT, contacto, dirección y condiciones de pago cada vez: es lento y permite errores de RUT o de dirección entre una orden y otra.

Además, la compra de flores y de insumos de un día de programación (pestaña «Compra de flores» de la spec 056, R6) ya calcula qué ramos hay que comprar; hoy esa lista no pasa a una orden de compra y hay que copiarla a mano.

Esta spec pide tres cosas:
- **(a)** un maestro de proveedores vinculado a las órdenes de compra, con agregar y quitar;
- **(b)** en «Órdenes de compra», un desplegable de razón social que, al elegir un proveedor, rellene todos sus datos;
- **(c)** en «Rutas y feriados», un botón que, cuando un día de programación está listo, rellene una **orden de compra en borrador** con los insumos y ramos de ese día.

## 2. Estado verificado (solo lectura, 2026-11-23)

Verificado sin modificar nada y sin mostrar datos personales (solo nombres de colecciones, ids y existencia de documentos):

| Dato | Resultado | Consecuencia |
|---|---|---|
| Colecciones de nivel superior del proyecto `gravecare-2e8d2` | `activaciones`, `contratos`, `feriados`, `gastos_ingresos`, `limites_verificacion`, `ordenes`, `rut_lookup`, `rutas`, `staff`, `usuarios`, `webpay_retornos` | **No existen** `materiales`, `ordenesCompra`, `contadores` ni `proveedores`. La spec 055 no tiene datos reales todavía. |
| `contadores/ordenesCompra` | no existe | La primera emisión creará el contador (regla de creación con `ultimo = 1`, spec 055). |
| `valores_ramos/compra` | **no existe** | Los cinco ramos (`RAM-STD`, `RAM-PRE`, `RAM-DLX`, `RAM-ADS`, `RAM-ADP`) saldrán «Sin valor» y **no se pueden pedir** hasta que el dueño cargue los valores en «Valores de ramos». Esto bloquea el botón de la parte (c) en producción. |
| `rutas` | 9 documentos (ids = nombre del cementerio en minúsculas y con guiones) | La pestaña «Rutas por cementerio» ya tiene datos cargados por el dueño. |
| `feriados` | 35 documentos (2026-12-08 a 2028-12-25) | Carga de feriados ya hecha; no afecta esta spec. |
| Reglas de `materiales`, `ordenesCompra`, `contadores` | sin publicar (`docs/reportes/ordenes-compra.md`, «Bloqueo») | Sin reglas, la pantalla de la spec 055 no lee ni escribe en producción. Esta spec **depende** de que se publiquen. |
| Pestaña «Rutas y feriados» | ya existe en el branch (`public/rutas-feriados.html`, `config-planificacion*.js`) con la pestaña «Rutas por cementerio» | La parte (c) agrega el botón; no rehace la pestaña. |

**Hallazgo de documentación:** la cabecera de la spec 055 en el repo de la web (`specs/055-ordenes-compra-proveedores/spec.md`) dice «Aprobada por el dueño el 2026-11-22», mientras que `docs/reportes/ordenes-compra.md` la describe como «borrador». Hay que corregir una de las dos antes de cerrar la 055.

## 3. Objetivo

1. Mantener un **maestro de proveedores** (`proveedores/{id}`) que las órdenes de compra usan como fuente de datos.
2. Al emitir o editar un borrador de OC, elegir el proveedor desde un desplegable que rellena **todos** sus datos; la orden guarda una **copia** de esos datos (snapshot).
3. Desde un día de programación listo, generar un **borrador de OC** con los ramos y los insumos de ese día, para revisarlo y emitirlo a mano.

## 4. Fuera de alcance

- Pagos a proveedores, cuentas por pagar, conciliación bancaria, DTE y libros de compras (igual que la 055).
- Envío de la OC por correo y archivo del PDF en Storage (siguen como decisiones abiertas de la 055).
- Cambios en `ordenes/`, `contratos/`, `sepulturas/`, `pagos/`, `gastos_ingresos/` o en la web pública.
- Integración de proveedores con `gastos_ingresos` (los gastos de la web siguen igual).
- Edición o borrado de órdenes emitidas (R7 de la 055 sigue vigente).
- Un flujo de aprobación de compras con varios roles (ver decisiones abiertas).

## 5. Requisitos (verificables)

### Parte (a): maestro de proveedores

- **R-P1.** Colección nueva `proveedores/{id}`. El `id` es un identificador generado (no el RUT), para que un cambio de RUT no rompa referencias. Campos: `razonSocial` (texto, 1 a 120 caracteres), `rut` (texto con formato `NN.NNN.NNN-D` o `NNNNNNNN-D`, dígito verificador módulo 11 válido), `contacto` (texto, hasta 80), `telefono` (texto, hasta 30, solo dígitos, espacios, `+`, guiones y paréntesis), `direccion` (texto, hasta 200), `condicionesPago` (`Transferencia` | `Factura a 30 días` | `Contado` | `Otro`; ver decisión 2), `activo` (booleano), `creadoEl` y `actualizadoEl` (texto ISO), `creadoPor` y `actualizadoPor` (uid).
- **R-P2.** **Agregar:** una pantalla de maestro de proveedores (pestaña nueva «Proveedores» dentro de «Órdenes de compra», con el mismo estilo de «Maestro de materiales») con formulario de alta. El RUT repetido se rechaza con «Ya existe un proveedor con ese RUT» (verificación en la transacción de alta, no solo en pantalla).
- **R-P3.** **Editar:** se pueden cambiar todos los campos excepto `creadoEl`, `creadoPor` y el `id`. Un cambio de RUT a uno ya usado por otro proveedor se rechaza.
- **R-P4.** **Quitar:** no se borra. «Quitar» pone `activo: false`; «Reactivar» lo devuelve a `true`. Pide confirmación. Un proveedor quitado **no aparece** en el desplegable de una OC nueva, pero sigue visible en las OC emitidas que lo usaron.
- **R-P5.** Ninguna escritura de proveedores borra documentos. La regla lo impide (`allow delete: if false`).

### Parte (b): desplegable en «Órdenes de compra»

- **R-O1.** En el formulario de la OC, el campo «Razón social» es un desplegable con los proveedores **activos**, ordenados por razón social, más la opción «Otro proveedor (escribir)» para el caso excepcional (decisión 3).
- **R-O2.** Al elegir un proveedor se rellenan en el formulario, en el mismo gesto y sin guardar nada: `rut`, `direccion`, `contacto`, `telefono` y la condición de pago por defecto. Todos los campos siguen siendo editables en la OC.
- **R-O3.** Al **emitir** la OC, `proveedor` se guarda como **copia** (snapshot) de los datos del momento: `razonSocial`, `rut`, `contacto`, `telefono`, `direccion`. Cambiar el proveedor después **no** cambia una OC emitida (igual que los precios de la 055, R6). Se guarda también `proveedorId` (referencia para trazabilidad; no se usa para mostrar).
- **R-O4.** Si el proveedor de la OC fue quitado entre que se abrió el formulario y se emitió, la emisión se rechaza con «El proveedor ya no está activo; elige otro» y no consume número.
- **R-O5.** La OC emitida y su impresión muestran los datos del snapshot, no los del maestro (la prueba cambia el proveedor y compara).

### Parte (c): botón de orden de compra desde un día de programación

- **R-B1.** Definición de **«día listo»** (propuesta, decisión 4): un día de programación (lunes a viernes de una semana) está listo cuando (i) todas sus visitas tienen cementerio con eje y día de ruta, (ii) todos los ramos que el día necesita tienen valor en `valores_ramos/compra`, y (iii) no hay ramos ni insumos «sin valor» en la lista del día. Si no está listo, el botón aparece deshabilitado con el motivo escrito en la pantalla («Faltan valores de ramos: Standard, Premium», etc.).
- **R-B2.** Los **ramos** salen de `construirListaCompra` (spec 056 R6): 1 ramo del nivel contratado por visita más los adicionales de la orden; Deluxe no admite adicionales. Los **precios** salen de `valores_ramos/compra`, nunca de un valor fijo en el código.
- **R-B3.** Los **insumos** del día: hoy no existe en la base un vínculo entre una visita y un insumo. La parte (c) **no inventa** insumos: el día aporta solo los ramos, y los insumos se agregan a mano en el borrador o se define un vínculo (decisión 5).
- **R-B4.** El botón crea un **borrador** de OC: **no asigna número** (el número se da solo al emitir, R4 de la 055) y **no se emite** sola. Quien la usa revisa proveedor, condiciones, fechas y líneas, y emite a mano.
- **R-B5.** Un día tiene **un solo borrador vinculado**. Pulsar otra vez no crea otro: si ya hay un borrador de ese día, el botón lo abre. Se guarda `origenDia` (fecha ISO del día y cementerio/semana de referencia) en el borrador.
- **R-B6.** El borrador vive en `ordenesCompraBorradores/{id}` (decisión 6). Al emitirlo, la emisión crea `ordenesCompra/{numero}` con sus líneas y el borrador queda marcado con `emitidoComo: 'OC-0007'`. El borrador **no se borra** (regla de oro 2).
- **R-B7.** Los totales se recalculan con R6 de la 055 (valor = cantidad × precio; neto; IVA 19 % redondeado; total) antes de guardar el borrador.

### Pestaña «Rutas por cementerio» (ya existe)

- **R-R1.** La pestaña «Rutas por cementerio» no cambia de comportamiento. El botón de la parte (c) **lee** `rutas` para saber el eje y el día de ruta de cada visita; no escribe en `rutas`.
- **R-R2.** Un cementerio sin ruta o con `activo: false` deja su día como **no listo** (R-B1, punto i) y se explica en pantalla.

## 6. Criterios de aceptación

| CA | Dado | Cuando | Entonces | Prueba |
|---|---|---|---|---|
| CA-P1 | un miembro de staff con claim | da de alta un proveedor con RUT válido | queda guardado con todos sus campos | regla + prueba de UI (emulador) |
| CA-P2 | un RUT con dígito verificador inválido | se intenta guardar | se rechaza con texto claro y no se escribe nada | prueba de UI |
| CA-P3 | un RUT ya usado por otro proveedor | se da de alta o se cambia a él | se rechaza con «Ya existe un proveedor con ese RUT» | prueba con emulador (transacción) |
| CA-P4 | un proveedor activo | se pulsa «Quitar» y se confirma | queda `activo: false`, sigue en la lista de proveedores y no en el desplegable | prueba de UI |
| CA-P5 | un cliente autenticado | intenta leer o escribir `proveedores` | se deniega | `tests/reglas/proveedores.test.js` |
| CA-P6 | cualquier intento de borrar un proveedor | se ejecuta | la regla lo rechaza | `tests/reglas/proveedores.test.js` |
| CA-O1 | dos proveedores activos | se elige uno en el desplegable de una OC nueva | `rut`, `direccion`, `contacto`, `telefono` y condición por defecto se rellenan | prueba de UI |
| CA-O2 | un proveedor quitado | se abre el desplegable de una OC nueva | no aparece; sí aparece en una OC emitida que lo usó | prueba de UI |
| CA-O3 | una OC emitida con proveedor X | se cambian los datos de X en el maestro | la OC y su impresión siguen mostrando los datos originales | prueba de simulación con emulador |
| CA-O4 | el proveedor se quita después de abrir el formulario | se intenta emitir | se rechaza, no consume número y pide elegir otro | prueba con emulador |
| CA-O5 | un proveedor con `<b>` en la razón social | se muestra en desplegable, OC o impresión | se ve literal (escape, AUD-01) | prueba de UI |
| CA-B1 | un día con un ramo sin valor en `valores_ramos/compra` | se abre «Rutas y feriados» | el botón está deshabilitado y dice qué falta | prueba de UI |
| CA-B2 | un día listo con 3 visitas (Standard, Premium y Spot con adicional) | se pulsa el botón | se crea un borrador con las cantidades de `construirListaCompra`, precios del maestro de ramos y total con R6 | prueba de simulación |
| CA-B3 | un día ya con borrador | se pulsa el botón dos veces | no se crea un segundo borrador; se abre el existente | prueba con emulador |
| CA-B4 | un borrador | se crea | no tiene número ni estado `Emitida`; `contadores/ordenesCompra` no cambia | prueba con emulador |
| CA-B5 | un borrador emitido | se emite | nace `OC-NNNN` con el siguiente número del contador y el borrador queda con `emitidoComo` | prueba con emulador |
| CA-B6 | un cementerio sin ruta | se calcula si el día está listo | el día no está listo y el motivo lo nombra | prueba de simulación |
| CA-R1 | la pestaña «Rutas por cementerio» | se usa como hoy (asignar, quitar, reactivar) | se comporta igual; `rutas` no cambia por el botón | regresión: `node --test tests/ public/js/` |
| CA-X1 | el backoffice completo | se despliega esta spec | las pantallas existentes (órdenes, planificación, pagos, gastos, rutas y feriados) siguen igual | regresión: suite completa del backoffice |

## 7. Seguridad (obligatoria)

- **Activos:** RUT, razón social, contacto, teléfono y dirección de proveedores (muchos son personas naturales), precios de compra, borradores y registro de compras.
- **Amenazas y controles:**
  - **Cliente lee o escribe proveedores, materiales u OC:** lo impide la regla por defecto (`allow read, write: if false`) y `esStaff()` (claim `staffActivo`).
  - **Borrado de proveedores u OC:** `allow delete: if false` (R-P5). Quitar = `activo: false`.
  - **Cambio de datos de un proveedor que altera una OC emitida:** lo impide el snapshot (R-O3), y la regla de inmutabilidad de la 055 (R7).
  - **Duplicados de RUT o de proveedor:** verificación en la transacción de alta (CA-P3); no solo en la pantalla.
  - **RUT inválido:** validación de dígito verificador en pantalla **y** en la regla (`matches` de formato); la regla no confía en la pantalla.
  - **Doble emisión o doble borrador:** el borrador por día tiene id determinista (decisión 6) y se crea en transacción (CA-B3).
  - **XSS con razón social, contacto o dirección:** todo dato se escapa (AUD-01), también en desplegable, lista e impresión (CA-O5).
  - **Datos personales:** el RUT y el contacto pueden ser personas naturales. Se guardan solo lo necesario para la OC. No se exportan a servicios externos. No se muestran en logs ni en reportes. Retención: decisión 7.
  - **Permisos de escritura del maestro:** cualquier staff puede dar de alta y editar (decisión 1); solo el dueño puede quitar o reactivar si el dueño lo decide (decisión 1).
- **Reglas afectadas (repo de la web):** se agregan `match` para `proveedores` y `ordenesCompraBorradores`. Ningún `match` existente cambia. La regla de `ordenesCompra` cambia en un punto: el `create` acepta `proveedorId` opcional y el `proveedor` debe ser un mapa con `razonSocial` no vacío (aditivo). Se avisa en el reporte (regla 9).
- **Secretos:** no hay claves ni dependencias nuevas. No se toca `functions/`.
- **Checklist del PR:** pruebas de reglas en verde (`tests/reglas/`), escape de todo dato mostrado, sin RUT reales en el repo ni en pruebas (usar RUT de prueba generados), `npm audit` sin altas nuevas.

## 8. Datos

| Colección / documento | ID | Campos | Quién escribe | Cambio de contrato |
|---|---|---|---|---|
| `proveedores/{id}` | generado | R-P1 | staff con claim (alta, edición, quitar) | **Nueva**, aditiva |
| `ordenesCompraBorradores/{id}` | `{AAAA-MM-DD}-{cementerio o semana}` (decisión 6) | `fechaDia`, `origenDia`, `lineas` (igual que OC), `proveedor` (opcional), `neto`, `iva`, `total`, `estado` = `Borrador`, `creadoEl`, `creadoPor`, `emitidoComo` (opcional) | staff con claim | **Nueva**, aditiva |
| `ordenesCompra/{numero}` | `OC-NNNN` | campos de la 055 + `proveedorId` (opcional) | staff, en la transacción de emisión | **Aditiva** (un campo opcional) |
| `materiales`, `contadores/ordenesCompra` | — | sin cambio | — | — |
| `valores_ramos/compra` | — | sin cambio; **se lee** y no se escribe desde esta spec | dueño/staff desde «Valores de ramos» | — |
| `rutas/{id}` | — | sin cambio; **se lee** | solo el dueño | — |

**Contrato:** se agregan en `docs/10-contrato-de-datos.md` del repo de la web las filas de `proveedores`, `ordenesCompraBorradores` y `proveedorId`, y la nota de que `valores_ramos/compra` y `rutas` son **lectura** para el backoffice.

**Datos de ejemplo:** ninguno en el repo. El maestro de proveedores empieza vacío; lo carga el staff. En pruebas se usan proveedores ficticios y RUT de prueba generados por una función de prueba.

## 9. Validación en localhost

- **Reglas:** `npm run test:rules` con los emuladores del repo de la web (`GC_OFFSET=700`), incluidos CA-P5, CA-P6 y CA-B4.
- **Pantallas:** backoffice en `localhost` contra emuladores de Firestore y Auth con un usuario de staff de prueba (seed local). Pasos para el dueño:
  1. Entrar como staff, abrir «Órdenes de compra» → «Proveedores» y dar de alta un proveedor de prueba. Repetir el RUT: debe rechazarse.
  2. Quitar el proveedor y comprobar que sale del desplegable pero no de la lista.
  3. En «Órdenes de compra», elegir un proveedor activo: se rellenan RUT, dirección, contacto y teléfono. Emitir y comprobar la impresión.
  4. Cambiar el proveedor en el maestro y comprobar que la OC emitida no cambia.
  5. En «Rutas y feriados», con un día listo de prueba, pulsar el botón y comprobar el borrador (ramos, precios, total). Pulsar otra vez: no se crea otro. Emitir: nace OC-NNNN.
- **Automáticas:** pruebas de UI (CA-P2, CA-P4, CA-O1, CA-O2, CA-O5, CA-B1); simulación de transacción (CA-P3, CA-O3, CA-O4, CA-B2, CA-B3, CA-B5); regresión de «Rutas por cementerio» (CA-R1).
- **Precondición real:** para probar el botón con datos reales hace falta que el dueño cargue `valores_ramos/compra` y que las reglas de la 055 estén publicadas. Sin eso, el botón queda deshabilitado (CA-B1), que es el comportamiento esperado.

## 10. Rollback

1. **Pantallas:** volver a publicar el tag anterior del backoffice (Hosting, por lectura).
2. **Reglas:** restaurar la copia previa de `firestore.rules` guardada fuera del repo antes del despliegue. Las colecciones nuevas quedan sin uso.
3. **Datos:** no se borra nada. Proveedores y borradores quedan en Firestore con `activo: false` o `emitidoComo` si se retira la función. Las OC emitidas no cambian.

## 11. Dependencias

- **Spec 055 publicada** (reglas de `materiales`, `ordenesCompra`, `contadores`) y **spec 056 R5/R6** (`valores_ramos/compra` con valores cargados por el dueño). Sin ellas, la parte (c) queda deshabilitada y la parte (b) no emite.
- **Reglas de la web** revisadas y publicadas por la sesión de la web (regla 9): `proveedores`, `ordenesCompraBorradores` y el campo opcional `proveedorId`.

## 12. Riesgos

- **«Día listo» mal definido** → el botón genera borradores incompletos. Mitigación: R-B1 con motivos en pantalla y la decisión 4 aprobada antes de implementar.
- **Insumos sin fuente de datos** → el botón solo trae ramos. Mitigación: decisión 5.
- **Dos fuentes de datos del proveedor** (maestro y OC) → mitigado con el snapshot (R-O3).
- **Carga de RUT y datos personales** → validación en regla y pantalla; retención pendiente (decisión 7).
- **Cambio de regla en `ordenesCompra`** (campo `proveedorId` opcional) → aditivo, pero toca un archivo de reglas compartido; se coordina con la sesión de la web.

## 13. Decisiones (para el dueño)

**Resueltas al aprobar (2026-11-23):** se adoptan las recomendaciones de las decisiones 1 a 6, 8 y 9:
- 1: cualquier staff da de alta y edita; solo el dueño quita y reactiva.
- 2: condiciones de la 055 (Transferencia, Factura a 30 días, Contado, Otro), con una condición por defecto en cada proveedor.
- 3: «Otro proveedor» escrito a mano solo como excepción.
- 4: «día listo» = visitas con cementerio, eje y día de ruta; ramos con valor en `valores_ramos/compra`; ninguna línea «sin valor». Sin cierre manual por ahora.
- 5: el borrador trae solo ramos; los insumos se agregan a mano. Un catálogo de insumos por tipo de servicio queda como etapa siguiente.
- 6: id del borrador `AAAA-MM-DD` + cementerio o semana.
- 8: campo `proveedorId` opcional en `ordenesCompra` (cambio aditivo, coordinado con la sesión de la web).
- 9: pestaña «Proveedores» dentro de «Órdenes de compra», junto al maestro de materiales.

**Siguen abiertas (no bloquean la implementación):**

1. **Retención de datos de proveedores** (personas naturales) y **RUT y dirección de GraveCare** para el encabezado (sigue pendiente de la 055).
2. **Estado de la spec 055:** la cabecera del repo de la web dice «Aprobada» y el reporte del backoffice dice «borrador». ¿Cuál es el correcto?

## 14. Código de referencia

- `public/ordenes-compra.html`, `public/js/ordenes-compra.js`, `ordenes-compra-db.js`, `ordenes-compra-vistas.js` (spec 055).
- `public/rutas-feriados.html`, `public/js/config-planificacion.js`, `config-planificacion-db.js`, `config-vistas.js` (pestaña «Rutas por cementerio»).
- `public/js/compra-ramos.js` (`ramosDeVisita`, `construirListaCompra`, `normalizarValores`; spec 056 R6).
- `public/js/valores-ramos-db.js` (lectura de `valores_ramos/compra`).
- Repo de la web: `specs/055-ordenes-compra-proveedores/spec.md`, `firestore.rules` (`esStaff()`, regla por defecto), `docs/10-contrato-de-datos.md` (sección «Spec 055»).

## 15. Pasos siguientes (después de aprobar)

1. Cerrar las decisiones 1 a 10 con el dueño.
2. Pedir a la sesión de la web la redacción de reglas para `proveedores` y `ordenesCompraBorradores`, con pruebas con emuladores (`tests/reglas/`).
3. Plan técnico y tareas (`plan.md`, `tasks.md`) con pruebas primero.
4. Implementación en `feat/057-proveedores-compra-dia` (rama nueva desde `feat/ordenes-compra` o desde `main` tras su PR), reporte en `docs/reportes/` y plan de despliegue que ejecuta el dueño.
