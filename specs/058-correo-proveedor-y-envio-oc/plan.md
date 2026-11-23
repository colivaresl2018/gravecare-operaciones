# Plan — Spec 058 (parte backoffice): correo en «Proveedores» y botón «Enviar por correo»

- **Spec:** `spec.md` — **Aprobada** por el dueño el 2026-11-23 (R1–R14, CA1–CA15; decisiones de §10 según la recomendación).
- **Plan:** borrador, pendiente de aprobación del dueño. Sin código hasta entonces.
- **Rama:** `feat/058-correo-proveedor-envio-oc`, creada desde `feat/057-proveedores-compra-dia` (PR #14, aún sin mezclar): necesita el maestro de proveedores de la 057.
- **Repo:** backoffice (`gravecare-operaciones`). Las reglas de Firestore y la función `enviarOrdenCompraPorCorreo` viven en el repo de la web (regla de oro 9): aquí no se copian ni se tocan.

## Diseño técnico

| # | Decisión | Por qué |
|---|---|---|
| T1 | Lógica pura en módulos sin DOM ni Firebase, probada con `node --test`: validación del correo en `proveedores.js` (existente) y un módulo nuevo `ordenes-compra-envio.js`. | Igual que 055/057: los CA se cubren sin emulador. |
| T2 | **Una sola regex del correo**, la misma de las reglas: `^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+([.][A-Za-z0-9-]+)*[.][A-Za-z]{2,}$`, aplicada tras `trim()` más tope de 120. Se exporta como `validarCorreo(texto)` → `{ok, valor, errores}`. | Si el cliente aceptara algo que la regla rechaza (o al revés), el usuario vería un error de permiso sin explicación. |
| T3 | `correo` entra en `validarProveedor` como campo **opcional**: vacío = válido (`''`); el campo no se elimina nunca. | R2 y la regla publicada (`''` para borrarlo). |
| T4 | **Escritura mínima de `correo`.** Al crear: `correo` va en el documento solo si no está vacío. Al editar: `correo` entra en el `update` solo si **cambió** respecto de `actual.correo ?? ''` (ausente = sin correo). | Así editar un proveedor viejo sin tocar el correo no agrega una clave nueva; compatible con el `affectedKeys().hasOnly` de la regla incluso sin la regla nueva publicada. Hoy `editarProveedor` reescribe todos los campos validados: se respeta eso y solo se filtra `correo`. |
| T5 | `editarProveedor` suma `correo` a `CAMPOS_EDITABLES` y a la `base` leída del documento. | Sin esto, validar con la base fallaría o borraría el correo sin querer. |
| T6 | **No hay «modal de detalle» de proveedor** (el brief lo menciona, pero la pantalla solo tiene tabla + formulario de edición). El correo se muestra en una **columna nueva «Correo» de la tabla** y se rellena en el formulario al editar. No se crea ningún modal nuevo (regla 1, sin cambios de diseño). | Verificado en `ordenes-compra.html` (`htmlFilasProveedores`, `prov-*`). |
| T7 | `ordenes-compra-envio.js` (puro): `estadoEnvio({orden, proveedor})` → `{mostrar, habilitado, motivo, correo}`; `textoConfirmacion(numero, correo)`; `mensajeErrorEnvio(error)`; `textoResultado(respuesta)`; `textoHistorial(envios)`; `enviarOrden({numero, llamar})` (valida `numero` y llama `llamar({ numero })`, **nada más**). Todo texto dinámico sale por `esc()` en las vistas. | R6–R12; el módulo se prueba con `llamar` simulado (CA9). |
| T8 | El botón vive en `#modal-oc`, junto a `#btn-imprimir`, dentro del mismo encabezado. El estado y el mensaje se pintan con un `<div id="aviso-envio">` y una línea de historial dentro del modal (no dentro de `htmlImpresion`, que **no cambia**: lo que se imprime sigue idéntico). | R14, regla 1. |
| T9 | **Qué proveedor se muestra:** se busca en `docsProveedores` (ya cargado) por `orden.proveedorId`; no se hace una lectura extra por orden. Si la lista no se pudo leer, el botón queda deshabilitado con «No se pudo leer el proveedor; recargue la página.». | Menos lecturas y un solo punto de falla ya avisado. El correo mostrado es informativo: el servidor lo relee. |
| T10 | **SDK de Functions** `10.7.0` (gstatic) como `import` aparte en `ordenes-compra.html` solamente: `getFunctions(app, 'us-central1')`, `httpsCallable`. La función se crea de forma perezosa en el primer clic; si el SDK o la llamada fallan, solo el botón avisa (R13). | No se cambia la importación existente de Firestore; las otras páginas no cargan el SDK nuevo. |
| T11 | `mensajeErrorEnvio` usa el sufijo de `error.code` (`functions/<código>` o solo `<código>`) y la tabla de R11; `failed-precondition` muestra el `message` de la función **escapado y recortado a 200 caracteres**; nunca se muestra `error.message` de otros códigos ni `error.details`. | R11 y AUD-01. |
| T12 | Anti doble clic: se desactiva el botón antes del `await` y se rehabilita en `finally`; además un indicador de «envío en curso» en memoria impide una segunda llamada aunque se vuelva a pulsar. | R9; el servidor también tiene su reserva de 60 s, pero la pantalla no depende de ella. |
| T13 | **Emuladores:** se amplía `scripts/local/puertos.mjs` (`functions: 5001` en la base) y `scripts/local/servidor-emuladores.mjs` (nuevo caso `functions` en el envoltorio del SDK, con `connectFunctionsEmulator(f, "127.0.0.1", <5001+GC_OFFSET>)`, y `functions` en la expresión `SDK`). Herramienta de desarrollo, fuera de `public/`; no afecta a Hosting. | El servidor local hoy no conoce Functions (spec §9). Los puertos por defecto del dueño siguen sin tocarse: solo se usa el puerto desplazado. |

## Archivos a crear / modificar (con motivo)

| Archivo | Tipo | Motivo |
|---|---|---|
| `public/js/proveedores.js` | modificado | `validarCorreo`, `correo` opcional en `validarProveedor` y `datosDeProveedor` (T2, T3). |
| `public/js/proveedores.test.mjs` | modificado | CA1: correo válido, vacío, sin `@`, con espacio, con `,` o `;`, de 121 caracteres, ausente. |
| `public/js/proveedores-db.js` | modificado | `correo` en `crearProveedor`/`editarProveedor` con la escritura mínima (T4, T5). |
| `public/js/proveedores-db.test.mjs` | modificado | CA2 y CA3 con el simulador de Firestore (`tests/helpers/firestore-simulado.mjs`): alta sin correo, alta con correo, edición del teléfono, del correo y borrado del correo. |
| `public/js/ordenes-compra-vistas.js` | modificado | Columna «Correo» en `htmlFilasProveedores` (escapado, `colspan` de «sin proveedores» 7→8) y `htmlHistorialEnvios`/`htmlEstadoEnvio` (T6, T8). **`htmlImpresion` no se toca.** |
| `public/js/ordenes-compra-proveedores-vistas.test.mjs` | modificado | CA4 (escape) y las vistas del estado y del historial; ajustar el conteo de columnas. |
| `public/js/ordenes-compra-envio.js` | **nuevo** | Funciones puras de T7. |
| `public/js/ordenes-compra-envio.test.mjs` | **nuevo** | CA5–CA12. |
| `public/ordenes-compra.html` | modificado | Campo `prov-correo` (mismo estilo), columna «Correo», botón «Enviar por correo» + `aviso-envio` en `#modal-oc`, `import` del SDK de Functions, controlador del clic (T8–T12). Cache-busting `?v=058` en los módulos tocados. |
| `tests/ordenes-compra-pagina.test.mjs` | modificado | CA13: carga `firebase-functions.js` 10.7.0, `httpsCallable('enviarOrdenCompraPorCorreo')`, ninguna referencia a `mail`, ninguna escritura nueva a `ordenesCompra`, `htmlImpresion` intacto, direcciones solo en el texto de confirmación. |
| `scripts/local/puertos.mjs`, `scripts/local/servidor-emuladores.mjs` | modificados | T13. |
| `tests/entorno-local.test.mjs` | modificado | El envoltorio de `functions` apunta a un puerto desplazado y nunca a los por defecto del dueño. |
| `docs/reportes/correo-proveedor-envio-oc.md` | **nuevo** | Reporte de la spec (qué se hizo, pruebas, límites). |
| `docs/03-backlog.md` | modificado | Estado de la 058 backoffice (este repo no tiene `docs/08-estado-despliegue.md`). |

No se modifica: `htmlImpresion`, `ordenes-compra-db.js` (emisión/anulación), `entorno.js`, reglas, ni nada fuera de `public/`, `scripts/local/`, `tests/`, `specs/` y `docs/`.

## Cambios de datos y compatibilidad

- **Escribe (aditivo):** `proveedores/{id}.correo` (string, `''` o una dirección ≤ 120). **Lee:** `ordenesCompra/{n}.envios` (array de `{para, cc, enviadoEl, enviadoPor}` escrito solo por el servidor; la pantalla no muestra `enviadoPor`). No renombra ni elimina campos, colecciones ni rutas (regla de oro 9). No escribe `mail`.
- **Hacia atrás:** los proveedores sin `correo` se tratan como «sin correo» (botón deshabilitado con motivo) y se siguen editando igual (T4).
- **Sin las reglas nuevas publicadas:** guardar un proveedor **con** correo se rechaza (`hasOnly`) y la pantalla muestra el aviso de permiso que ya existe en `textoErrorProveedor`; guardar o editar **sin** tocar el correo sigue funcionando. No se agrega un mensaje nuevo que adivine la causa: el texto de permiso actual de `textoErrorProveedor` es suficiente.
- **Sin la función desplegada:** el botón responde con el error `not-found`/`unavailable` del SDK; el mapeo de R11 lo traduce («No se pudo enviar el correo. La orden no cambió; intente de nuevo.»). La OC no cambia.
- **Entorno:** `public/js/entorno.js` manda `localhost` al proyecto `gravecare-qa`, que no tendrá la función; no se cambia. En localhost el envío solo se prueba con el servidor de emuladores (T13).

## Orden de implementación y de despliegue (qué primero para no cortar el flujo)

**Implementación** (una tarea = un commit; prueba primero, verla fallar, implementar):
1. Módulos puros del correo del proveedor: `validarCorreo`, `validarProveedor`, `datosDeProveedor` (T2, T3) + pruebas (CA1).
2. Escrituras: `crearProveedor`/`editarProveedor` (T4, T5) + pruebas (CA2, CA3).
3. Vistas: columna «Correo» y su escape (CA4) y campo `prov-correo` en la página con cache-busting.
4. `ordenes-compra-envio.js` completo con sus pruebas (CA5–CA12).
5. Vistas del botón, del estado y del historial; cableado en `ordenes-compra.html` (SDK de Functions, clic, confirmación, `finally`) y su prueba de página (CA13, CA14).
6. Herramienta local: `functions` en `puertos.mjs` y `servidor-emuladores.mjs` + su prueba.
7. Verificación en navegador contra emuladores con la función de la web (transporte `log`, nunca correo real) y reporte.

**Despliegue** (lo ejecuta el dueño desde `C:\Despliegue\Gravecare*`, en un tag, con `--project gravecare-2e8d2` y `--only`; yo solo preparo el tag y el procedimiento):
1. **Reglas de la web** (spec 058 de GraveCare, `--only firestore:rules`). Sin ellas, un proveedor con correo no se guarda. *Estado (según la sesión de la web, 2026-11-23):* **las reglas con `correo` están publicadas** (309 líneas, huella `2a51b2ab0cc5ee35`, tag `reglas-proveedor-correo-2026-11-23`); la **función sigue sin desplegarse** (falta registrar `SMTP_OC_PASS` y confirmar SPF/DKIM/DMARC). El dueño debe confirmar ambas antes de publicar el backoffice.
2. **Función** `enviarOrdenCompraPorCorreo` (`--only functions:enviarOrdenCompraPorCorreo`, solo por nombre, tras registrar el secreto `SMTP_OC_PASS` y confirmar SPF/DKIM/DMARC). Sin ella, el botón falla con aviso.
3. **Backoffice** (Hosting `gravecare-ops`, `--only hosting:gravecare-ops`), solo cuando el dueño confirme 1 y 2. Antes: respaldo del estado publicado (tag anterior `ops-planserv-10` o el vigente) fuera del repo. Después: comparar por lectura que lo publicado coincide con el tag.
- **Por qué este orden:** cada paso es inofensivo sin el siguiente (reglas solas no cambian nada visible; la función sola no la llama nadie; el backoffice al final encuentra todo listo). Publicar el backoffice antes dejaría un botón que falla y un campo que no se puede guardar.
- **Prueba real (dueño):** un proveedor «Prueba» con el correo del dueño; **la copia sale de verdad a `rravellos@gravecare.cl`**: avisar antes.
- **Dependencia con el PR #14 (057):** esta rama sale de ella; el tag del backoffice incluirá también la 057. Mezclar #14 primero y esta después, o publicar ambas juntas con la hoja de la 057 ya prevista (reglas de proveedores).

## Estrategia de pruebas (unitarias/simulación, reglas, e2e)

- **Unitarias (`node --test tests/ public/js/`):** CA1–CA12, escritas antes y vistas fallar; baseline actual 711 pasan.
- **Simulación de Firestore:** `proveedores-db.test.mjs` con `tests/helpers/firestore-simulado.mjs` verifica qué claves viajan en `set`/`update` (T4) y que el candado de RUT no cambia.
- **Páginas:** `tests/ordenes-compra-pagina.test.mjs` (CA13) inspecciona el HTML: SDK 10.7.0, `httpsCallable`, sin `mail`, sin escrituras nuevas, `htmlImpresion` intacto; el script inline sigue compilando (`new Function`/`node --check` sobre el módulo extraído, como en las demás páginas).
- **Reglas:** **no se prueban aquí** (viven en la web). Se confía en las pruebas de reglas de la web (`proveedores-correo-058.test.js`, CA1–CA4 y CA16–CA17 de su spec) y se verifica por lectura de la regla publicada antes del despliegue.
- **Navegador contra emuladores (CA14 y el recorrido completo):** servidor local con `GC_OFFSET` propio (p. ej. 1500; nunca los puertos por defecto), reglas = las de la web con la 058 (copiadas a una carpeta temporal fuera del repo para el emulador) y el emulador de Functions de la web con la función. Casos: proveedor con correo → emitir OC → «Enviar por correo» → «Enviada a …» y `envios` visible; sin correo → deshabilitado con motivo; «Otro proveedor» → deshabilitado; `Anulada` → sin botón; doble clic → una sola llamada; función detenida → aviso en español y la OC intacta.
- **Seguridad:** `git grep -l` por secretos sin mostrar valores; ningún correo real en pruebas (`@ejemplo.test`); `npm audit` no aplica (sin dependencias nuevas).

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Publicar el backoffice antes que las reglas o la función | Orden de despliegue fijo y confirmación del dueño; el plan no deja tag listo hasta que confirme. |
| La regex del cliente difiere de la de las reglas | Misma expresión copiada del texto aprobado, con una prueba que fija la cadena; el cliente además impone `trim()` y 120. |
| `editarProveedor` agrega una clave nueva sin querer y las reglas viejas la rechazan | T4: `correo` solo viaja si cambió; prueba CA3. |
| Doble envío por doble clic o por repetir la pantalla | Botón desactivado + indicador en memoria + reserva del servidor (60 s) y topes. |
| Mensaje del servidor con HTML o muy largo | `esc()` y recorte a 200; solo en `failed-precondition`. |
| El SDK de Functions falla al cargar y rompe la pantalla de órdenes | `import` aparte y función creada perezosamente dentro de `try/catch`; las demás acciones no dependen de él (CA14). |
| Datos reales en capturas o pruebas | Solo datos ficticios; las capturas de la validación no se suben. |
| Dirección de copia visible en un repo público (D5 de la web) | Aprobado en la web; aquí solo aparece en el texto de confirmación de la copia, no como configuración. |
| Rama apilada sobre la 057 (PR #14 sin mezclar) | Mezclar en orden; si #14 cambia, rebase de esta rama (solo toca archivos distintos salvo `proveedores*` y `ordenes-compra*`). |
| `localhost` apunta a QA y se cree que el envío «anda» | El plan y el reporte dicen que solo el servidor de emuladores prueba el botón; en QA/producción depende del despliegue de la función. |

## Rollback paso a paso

1. **Solo ocultar el envío (sin tocar nada más):** revertir el commit del botón (`git revert <hash>`) y publicar el tag siguiente; `correo` y `envios` ya guardados quedan sin daño (opcionales).
2. **Volver todo el backoffice:** desde `C:\Despliegue\Gravecare*`, `git checkout <tag anterior, ops-planserv-10 o el vigente>` y `firebase deploy --project gravecare-2e8d2 --only hosting:gravecare-ops` (lo ejecuta el dueño); comparar lo publicado con el tag.
3. **La función y las reglas** no se revierten desde este repo: son de la web (`firebase functions:delete enviarOrdenCompraPorCorreo` solo por nombre; reglas: el respaldo previo de su hoja). Si se revierten las reglas, **editar** un proveedor que ya tiene `correo` fallaría hasta volver a publicarlas (su spec lo avisa); la pantalla mostraría el aviso de permiso.
4. **Datos:** sin migración ni borrados; no hay nada que restaurar.
5. **Herramienta local:** revertir el commit de `puertos.mjs`/`servidor-emuladores.mjs` si el servidor local dejara de levantar; no afecta a producción.

## Impacto en `gravecare-operaciones`

- **Pantalla `ordenes-compra.html`:** campo y columna nuevos en Proveedores; botón, aviso e historial en el modal de la OC. El resto (emisión, borradores, impresión, anulación, materiales) no cambia.
- **Otras pantallas:** ninguna (el SDK de Functions solo se carga aquí).
- **Contrato de datos:** solo aditivo; ningún renombre ni borrado. El reporte de fotos y demás módulos del backoffice no leen `correo` ni `envios`.
- **Publicación:** un tag nuevo del backoffice (con la 057 incluida si #14 aún no está mezclada); sin cambios en `firebase.json`.
- **Pendientes del dueño (fuera de este repo):** publicar reglas y función de la web, registrar `SMTP_OC_PASS`, confirmar la casilla `colivaresl@gravecare.cl` y el DNS del correo, y avisar a `rravellos@gravecare.cl` antes de la prueba real.
