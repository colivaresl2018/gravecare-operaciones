# B6 / spec 082 — Etapa 2: «Crear borrador desde una factura (IA)» en Órdenes de compra

**Fecha:** 2026-11-27 · **Rama:** `feat/082-ia-factura-etapa2` (desde `main`, `fc912c1`; último tag `ops-planserv-21`) · **Estado:** listo para revisión (PR a `main`). **No desplegado**: lo despliega el dueño. **No se hizo ninguna llamada real a la IA, a Vertex ni a Storage**: todo se probó con funciones y Storage simulados.
**Autorización:** directriz B6 y spec 082 (R11–R14, CA5–CA7); el dueño pidió esta etapa tras desplegar la etapa 1 (`ops-planserv-19`). La etapa 3 (rutas sugeridas, solo dueño) queda **sin empezar**, con su PR y su aprobación.

## Qué se agregó (solo aditivo)
En la pestaña «Órdenes de compra» de `public/ordenes-compra.html`, entre «Órdenes emitidas» y «Borradores de orden por día», un bloque **«Crear borrador desde una factura (IA)»**:
- **Elegir el PDF** (solo `application/pdf`, hasta 5 MB) y la **fecha de emisión** (por defecto hoy).
- Aviso fijo (R5): «La IA puede equivocarse: revisa antes de usar. No escribas RUT, correo ni teléfono.»
- **Botón «Crear borrador con IA»**: genera un nombre aleatorio de 24 caracteres `[A-Za-z0-9_-]` (nunca el nombre del archivo elegido), **sube** el PDF a `Ordenes_Compra/<fecha>/<nombre>.pdf` con `contentType: 'application/pdf'` y llama a `procesarFacturaIA({ ruta })` (solo la ruta).
- **Resultado:** «Borrador creado» con **total, número de líneas y advertencias**, y un botón **«Abrir borrador»** que carga el borrador en el formulario con el flujo de siempre (eliges proveedor, revisas líneas, emites).
- Mientras responde (hasta 120 s) el botón queda deshabilitado y dice «Creando borrador…»; un doble clic hace **una sola** subida y una sola llamada.
- Los SDK de **Functions y Storage se cargan solo al pulsar** (import dinámico): si no llegan, falla solo la IA y el resto de la pantalla sigue (R6).

Archivos: `public/js/ia-factura.js` (lógica sin SDK ni DOM real, nuevo; reutiliza `AVISO_IA`, `mensajeErrorIA` y `MENSAJE_GENERICO` de la etapa 1), su prueba, `public/ordenes-compra.html` (+ bloque HTML, un `import`, un manejador y la fecha por defecto) y `tests/ordenes-compra-ia-factura-pagina.test.mjs`. Emitir, anular, proveedores, materiales, seguimiento y control de acceso **no se tocaron**.

## Reglas de la spec cubiertas
- **R11 / CA7:** archivo que no es PDF, vacío o de más de 5 MB, y fecha inválida: se rechazan **antes** de subir o llamar.
- **R13 / CA6:** si el borrador de ese día ya está en la lista cargada, se informa «Ya existe un borrador de orden de compra para esa fecha. No se guardó nada.» **sin subir ni llamar** (no se ofrece reintentar con la misma fecha). Si otra persona lo creó un instante antes, la función responde «ya existe» (antes de gastar una de las 5 consultas, spec 084): se muestra tal cual y se refresca la lista.
- **R12:** total, líneas y advertencias, y enlace al borrador.
- **R14:** la pantalla **no emite** la OC, no toca `contadores/ordenesCompra`, no envía correo y **no escribe en Firestore** (0 escrituras en las pruebas). Lo único que escribe es el PDF en Storage; el borrador lo crea el servidor.
- **R3:** errores de la función tal cual (cuota, permisos, «no pudimos leer la factura…»); si es de red o técnico, el mensaje genérico. Si la **subida** falla, no se llama a la función y se avisa «No se pudo subir el archivo. No se guardó nada…» sin detalles técnicos.
- **R4:** el texto de la factura (advertencias) se pinta solo con `textContent`: una advertencia con `<img onerror>` o `<script>` se ve como texto y `window.__xss` queda sin definir.

## Pruebas
- `public/js/ia-factura.test.mjs` (15) y `tests/ordenes-compra-ia-factura-pagina.test.mjs` (9). Primero en rojo (`ERR_MODULE_NOT_FOUND` y 8 de 9 fallando), luego en verde.
- Dos pruebas fijadas de pantallas anteriores **actualizadas a propósito** (no borradas): «solo lectura de Storage» (`ordenes-compra-imprimir-pdf.test.mjs`) ahora exige que **Imprimir** siga siendo de solo lectura y que la **única subida de la página** sea la de la factura; y «SDK de Functions» (`ordenes-compra-pagina.test.mjs`) pasa de una a **dos** referencias, ambas con import dinámico (correo y factura).
- `node --test tests/ public/js/` → **981 pasan, 0 fallan**.
- **Navegador, con Firebase y Storage ficticios** (nada sale a la red; servidor local detenido, pestaña cerrada): sin archivo, no PDF, 5 MB + 1 y sin fecha → rechazo sin subir ni llamar; fecha con borrador ya existente → aviso sin subir ni llamar; camino feliz (ruta `Ordenes_Compra/2026-12-01/<24 caracteres>.pdf`, `contentType` PDF, llamada solo con `{ ruta }`, doble clic = 1 subida y 1 llamada, resultado «Total: $13.090 · 2 líneas», lista de borradores pasa de 1 a 2, «Abrir borrador» carga las 2 líneas); cuota, red caída, respuesta mal formada, subida fallida (sin llamada) y «ya existe» del servidor; advertencias hostiles como texto; 0 escrituras en Firestore; móvil 375 px sin desborde.

## Decisiones tomadas (revisar)
1. **Dónde va:** en la pestaña «Órdenes de compra», justo antes de «Borradores de orden por día» (la spec solo dice «en Órdenes de compra»).
2. **Una subida por intento:** si la función falla después de subir (cuota, factura ilegible), el PDF **queda en Storage** (esta pantalla no borra nada y las reglas no lo permiten); un reintento sube otro con otro nombre. El dueño puede limpiarlos desde la consola.
3. **Fecha de emisión por defecto = hoy**; es la fecha del borrador (un borrador por día), no necesariamente la que trae el PDF: si no coinciden, la función lo avisa en las advertencias.
4. **Aviso de «ya existe» sin gastar consulta:** se revisa primero la lista local; si está desactualizada, lo detecta la función (spec 084) antes de gastar una de las 5 consultas.

## Antes de usarla de verdad (del dueño)
- **Prueba real de la spec 084** (lectura real del PDF y que la segunda llamada del mismo día no gaste consulta): procedimiento en `docs/entregas/prueba-real-borrador-oc-084.md` del repo de la web. Esta pantalla **no ejecuta llamadas reales** en las pruebas; cada llamada real gasta 1 de las 5 consultas diarias y tiene costo en Vertex.
- **Reglas de Storage de `Ordenes_Compra/` (spec 083) publicadas** en producción (están en el repo de la web). Sin ellas la subida da `storage/unauthorized` y la pantalla muestra «No se pudo subir el archivo».
- **Líneas del borrador:** las líneas que lee la IA traen descripción, cantidad y precio, **sin código de material ni unidad**. Al abrir el borrador, esas líneas se cargan como están; para emitir la orden hay que completarlas o reemplazarlas como hoy (la validación de emisión no cambió). Esta etapa no las convierte automáticamente al maestro de materiales.

## Despliegue y reversa
Hosting solo, desde `C:\Despliegue\GravecareOps` con el tag que se cree tras fusionar: `firebase deploy --only hosting:gravecare-ops --project gravecare-2e8d2`. Reversa: volver a publicar el tag anterior (`ops-planserv-21`): se quita el bloque; los borradores que haya creado la IA no estorban (son borradores normales del día) y los PDF de prueba se pueden borrar desde la consola.
