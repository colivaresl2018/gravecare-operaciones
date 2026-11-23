# Plan técnico — Spec 057 (proveedores y orden de compra desde un día de programación)

- **Spec:** `spec.md` (Aprobada el 2026-11-23).
- **Plan:** aprobado por el dueño el 2026-11-23, incluido el documento de bloqueo `proveedoresRut` (T3). Implementación pendiente de su orden.
- **Rama:** `feat/057-proveedores-compra-dia`, creada desde `feat/ordenes-compra` (no desde `main`: la spec 055 y el código de compra de ramos están ahí).
- **Repo:** backoffice (`gravecare-operaciones`). Las reglas de Firestore se escriben y publican en el repo de la web (regla 9): aquí solo se documentan y se entregan a la sesión de la web.
- **Sin Cloud Functions.** Todo se resuelve con el SDK desde el navegador, igual que la 055 (R11).

## 1. Decisiones técnicas

| # | Decisión | Por qué |
|---|---|---|
| T1 | Lógica pura en módulos sin DOM ni Firebase (`proveedores.js`, `compra-dia.js`), probada con `node --test`. | Así se cumplen los CA sin emulador, igual que `ordenes-compra.js` y `compra-ramos.js`. |
| T2 | Escrituras con `ejecutarTransaccion` y `refs` inyectados (como `ordenes-compra-db.js`). | Permite probar la concurrencia (CA-P3, CA-B3, CA-O4, CA-B5) con un Firestore simulado. |
| T3 | **Unicidad del RUT con un documento de bloqueo** `proveedoresRut/{rutNormalizado}` creado en la misma transacción que el proveedor. | Firestore no admite consultas dentro de una transacción; un documento con id = RUT hace que `create` falle si ya existe. El `id` de `proveedores` sigue siendo generado, como pide R-P1. |
| T4 | Snapshot del proveedor en la OC (`proveedor` = copia; `proveedorId` opcional). | R-O3: cambiar el maestro no toca OC emitidas. |
| T5 | Emisión desde borrador en **una sola transacción**: crea la OC con `emitirOrden` y marca el borrador `emitidoComo`. | CA-B5: el número sale del contador y el borrador queda marcado en el mismo commit. Se extiende `emitirOrden` con un parámetro `extra` (escrituras adicionales) en vez de duplicar la lógica. |
| T6 | El borrador por día tiene **id determinista**: `{AAAA-MM-DD}-{cementerio-o-semana}` (decisión 6 aprobada). | Pulsar dos veces no duplica (CA-B3) sin consultar. |
| T7 | El borrador no toca `contadores/ordenesCompra` (CA-B4). | Solo la emisión consume número. |
| T8 | El botón «día listo» vive en la pestaña **«Rutas por cementerio»** de «Rutas y feriados», como una sección nueva debajo de la tabla. | La spec ubica el botón en «Rutas y feriados»; no se crea pestaña nueva para no cambiar el diseño (regla 1). |
| T9 | Las visitas del día se toman de `construirFilasPlanificacion` (planificacion-servicios.js) con `rutas` y `ordenes`, y los ramos de `construirListaCompra` (compra-ramos.js). | Reutiliza la lógica ya probada de Compra de flores (spec 056 R6). |
| T10 | Insumos: el borrador trae solo ramos (decisión 5, opción a). | No hay vínculo visita-insumo en la base (verificado el 2026-11-23). |
| T11 | Para abrir un borrador desde «Órdenes de compra», la URL lleva solo su id (`?borrador=AAAA-MM-DD-cementerio`). | No hay datos personales en la URL (regla de privacidad). |
| T12 | Escape de todo dato de Firestore con `esc()` (AUD-01), también en desplegable, lista e impresión. | CA-O5. |

## 2. Modelo de datos (aditivo)

| Colección / documento | Campos | Escribe |
|---|---|---|
| `proveedores/{id}` | `razonSocial`, `rut`, `contacto`, `telefono`, `direccion`, `condicionesPago`, `activo`, `creadoEl`, `creadoPor`, `actualizadoEl`, `actualizadoPor` | staff con claim (alta y edición); quitar/reactivar según decisión 1 (dueño) |
| `proveedoresRut/{rutNormalizado}` | `proveedorId`, `liberado` (bool), `actualizadoEl` | transacción de alta o cambio de RUT |
| `ordenesCompraBorradores/{id}` | `fechaDia`, `origenDia` {`fecha`, `cementerio`, `semana`}, `lineas`, `neto`, `iva`, `total`, `estado` = `Borrador`, `creadoEl`, `creadoPor`, `emitidoComo` (opcional) | staff con claim |
| `ordenesCompra/{numero}` | campos de la 055 + `proveedorId` (opcional) | transacción de emisión |

`proveedoresRut` no está en la spec aprobada: es un documento de apoyo para CA-P3. Se incluye en el contrato y se pide su regla a la sesión de la web.

**Regla de RUT duplicado (T3):** en el alta, si `proveedoresRut/{rut}` existe y `liberado` es false, se rechaza («Ya existe un proveedor con ese RUT»). Al cambiar el RUT de un proveedor: se crea el bloqueo del RUT nuevo y se marca `liberado: true` en el anterior (no se borra).

## 3. Módulos

### 3.1 Puros (nuevos)

- **`public/js/proveedores.js`**
  - `validarRut(texto)`: formato `NN.NNN.NNN-D` o `NNNNNNNN-D`, dígito verificador módulo 11, devuelve `{ok, normalizado, errores}`. El normalizado es sin puntos y en mayúsculas (`K`).
  - `validarProveedor(entrada)`: razón social 1–120; RUT válido; contacto ≤ 80; teléfono ≤ 30 con caracteres permitidos; dirección ≤ 200; condición en `CONDICIONES_PAGO`; `activo` booleano.
  - `opcionesProveedores(docs)`: solo `activo === true`, orden por razón social (`localeCompare` en español). Incluye «Otro proveedor (escribir)» según decisión 3.
  - `datosDeProveedor(doc)`: devuelve el objeto `{razonSocial, rut, contacto, telefono, direccion}` que se rellena en el formulario y se copia como snapshot.
  - `condicionPorDefecto(doc)`: `condicionesPago` del proveedor o `Transferencia` si no tiene.

- **`public/js/compra-dia.js`**
  - `diaListo(dia, { valores, rutasPorCementerio })`: devuelve `{listo, motivos[]}`. Motivos: cementerio sin eje o día de ruta (R-R2), ramo «sin valor» (`faltantes` de `construirListaCompra`), día sin visitas.
  - `idBorrador({ fecha, cementerio, semana })`: `AAAA-MM-DD-slug` (slug sin tildes, `[a-z0-9-]`, máx. 60). Si hay varios cementerios, el id usa la semana (`{lunesIso}`) y el día.
  - `borradorDesdeDia(dia, { valores, catalogoRamos })`: líneas en formato OC (`codigo`, `descripcion`, `unidad` = `UNI`, `cantidad`, `precioUnitario`, `valor`) con los códigos de `RAMOS_MAESTRO`, y totales con `calcularTotales` (R6 de la 055). No inventa precios.

### 3.2 Escrituras (nuevos y extendidos)

- **`public/js/proveedores-db.js`** (nuevo, misma forma que `ordenes-compra-db.js`):
  - `crearProveedor({ejecutarTransaccion, refs, datos, uid})`: transacción: lee `proveedoresRut/{rut}`; si existe y no está liberado, lanza `codigo-existe`; si no, crea el proveedor y el bloqueo.
  - `editarProveedor({..., id, cambios, uid})`: si cambia el RUT, bloquea el nuevo (misma regla), libera el anterior y actualiza el proveedor.
  - `cambiarActivoProveedor({..., id, activo, uid})`: solo `activo` y `actualizadoPor/El`.
  - `textoErrorProveedor(error)`.

- **`public/js/ordenes-compra-db.js`** (extendido, sin cambiar los existentes):
  - `emitirOrden` acepta `proveedorId` y `extra(tx)`. Antes de escribir, lee `proveedores/{proveedorId}` si viene; si no está activo lanza «El proveedor ya no está activo; elige otro» (R-O4, CA-O4).
  - `emitirDesdeBorrador({..., idBorrador})`: en una transacción: lee el borrador (debe estar en `Borrador` y sin `emitidoComo`), llama al mismo flujo de `emitirOrden` con `extra` que marca `emitidoComo` (CA-B5).
  - `crearBorradorDia({ejecutarTransaccion, refs, id, datos, uid})`: transacción: si el borrador existe, devuelve `{existe: true}` sin escribir (CA-B3); si no, lo crea con `estado: 'Borrador'` (CA-B4, sin tocar contadores).

### 3.3 Pantallas

- **`public/ordenes-compra.html`**: pestaña nueva «Proveedores» (botón `tab-proveedores` y panel `panel-proveedores`, con el mismo estilo que `tab-materiales`). En el formulario de OC, el campo `oc-razon` pasa a `<select id="oc-razon-select">` con las opciones activas y «Otro proveedor» (el campo de texto `oc-razon` queda como entrada manual). Lista de borradores pendientes debajo de la lista de OC (sección nueva, aditiva).
- **`public/js/ordenes-compra-vistas.js`**: `htmlFilasProveedores(docs, {puedeEditar})`, `htmlOpcionesProveedores(opciones)`, `htmlFilasBorradores(borradores)`. Todo con `esc()`.
- **`public/js/ordenes-compra.js`**: controlador. Al elegir proveedor, rellena `oc-rut`, `oc-direccion`, `oc-contacto`, `oc-telefono` y la condición. Al abrir `?borrador=`, precarga líneas, fecha del día y proveedor vacío.
- **`public/rutas-feriados.html`**: dentro de `panel-rutas`, sección nueva «Días de programación» con una tabla de días de la semana, estado (listo / motivos) y botón «Crear orden de compra». Estado de carga y errores con los textos ya existentes (`aviso-error`, `btn-reintentar`).
- **Lectura nueva en la página:** `ordenes` (ya se lee), `valores_ramos/compra` (con `leerValoresRamos`), `proveedores` no se lee aquí.

## 4. Permisos

- Alta, edición y quitar proveedor: staff con claim (`esStaff()`). Quitar/reactivar solo el dueño si la decisión 1 se confirma así; por ahora la pantalla lo limita a `puedeAnular`-style (dueño) y la regla lo aplicará igual.
- Crear borrador: staff con claim.
- Emitir: staff con claim (como hoy).
- `rutas` sigue escrita solo por el dueño; el botón **no escribe** `rutas` (R-R1).

## 5. Reglas y contrato (repo de la web)

Se entrega a la sesión de la web un documento `docs/referencia/reglas-propuestas-057.md` con:
- `match /proveedores/{id}`: read/create/update para `esStaff()`, validación de campos, `delete: if false`.
- `match /proveedoresRut/{rut}`: create si no existe o `liberado == true`; update solo `liberado`; `delete: if false`.
- `match /ordenesCompraBorradores/{id}`: create/update solo estado `Borrador` y `emitidoComo` al emitir; `delete: if false`.
- `match /ordenesCompra/{numero}`: el `create` acepta `proveedorId` opcional (aditivo) y exige `proveedor.razonSocial`.
- Pruebas en `tests/reglas/` del repo de la web: CA-P5, CA-P6, CA-B4 y las de bloqueo de RUT.
- Filas nuevas en `docs/10-contrato-de-datos.md` (repo de la web).

## 6. Pruebas

- **Puras:** `public/js/proveedores.test.mjs`, `public/js/compra-dia.test.mjs`, `public/js/ordenes-compra-db.test.mjs` (ampliado), `public/js/proveedores-db.test.mjs`.
- **Páginas:** `tests/ordenes-compra-pagina.test.mjs` (pestaña y desplegable), `tests/rutas-feriados-pagina.test.mjs` (sección de días).
- **Escape:** casos con `<b>` en razón social, contacto y dirección (CA-O5).
- **Regresión:** `node --test tests/ public/js/` debe pasar entero (base: 638 pruebas).
- **Navegador:** localhost con emuladores de la web (`GC_OFFSET=700`), usuario de staff de prueba, pasos de spec §9.

## 7. Orden de implementación y entregas

1. Módulos puros con pruebas primero (sin tocar pantallas).
2. Escrituras con transacciones simuladas.
3. Pantalla de proveedores y desplegable.
4. Botón de día listo y borradores.
5. Reglas y contrato (entregados a la web).
6. Regresión, validación en localhost y reporte en `docs/reportes/` (con plan de despliegue y reversa; el despliegue lo ejecuta el dueño desde el clon limpio).

## 8. Riesgos técnicos

- **Concurrencia de borradores:** resuelta con id determinista y transacción (CA-B3).
- **Emisión desde borrador:** si el contador cambia entre lectura y escritura, Firestore reintenta la transacción; la comprobación de existencia de `OC-NNNN` (ya en `emitirOrden`) evita un número repetido.
- **Dependencia de reglas:** sin las reglas de la 055 y de la 057 publicadas, todo lo de escritura falla con el aviso de permiso (como hoy). Las pruebas de UI usan el Firestore simulado.
- **Tamaño de la página `rutas-feriados.html`:** se añade una sección sin tocar la existente; se revisa el diff fuera de `<script>` (regla 1).

## 9. Rollback

- Pantallas: republicar el tag anterior del backoffice (`ops-planserv-8` o el que corresponda).
- Reglas: restaurar la copia previa de `firestore.rules` guardada fuera del repo.
- Datos: no se borra nada. Proveedores y borradores quedan con `activo: false` o `emitidoComo`; las OC emitidas no cambian.
