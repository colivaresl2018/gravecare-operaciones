# Tareas — Spec 058 (parte backoffice): correo en «Proveedores» y botón «Enviar por correo»

Cada tarea = un commit pequeño, con su test, en el orden **prueba primero → verla fallar → implementar → verla pasar**. Marca con [x] al terminar. Mensajes de commit en español (`feat(spec-058): …`), con los archivos agregados **por nombre** (nunca `git add -A`, `.` ni carpetas) y `git diff --cached --name-only` revisado antes de cada commit.

- **Spec:** `spec.md` (Aprobada 2026-11-23) · **Plan:** `plan.md` (aprobado 2026-11-23).
- **Rama:** `feat/058-correo-proveedor-envio-oc` (desde `feat/057-proveedores-compra-dia`).
- **Antes de cada commit:** (1) `node --test tests/ public/js/` en verde; (2) sintaxis del script inline de las páginas tocadas; (3) `git diff` fuera de `<script>` = 0 líneas, salvo lo autorizado (campo «Correo electrónico», columna «Correo», botón «Enviar por correo» con su aviso y su línea de historial); (4) sin secretos ni datos reales; (5) `htmlImpresion` sin cambios.
- **Nada se despliega.** El dueño ejecuta el despliegue (plan, «Orden de despliegue»).

## Fase 0 — Preparación

- [ ] **T0.1** Confirmar la línea base en la rama (`node --test tests/ public/js/` → 711 pasan, 0 fallan) y que `git status` está limpio.
  - Hecho cuando: queda anotado en el reporte.
- [ ] **T0.2** Anotar el estado de lo publicado por la web (solo lectura): reglas con `correo` publicadas el 2026-11-23 (309 líneas, huella `2a51b2ab0cc5ee35`, tag `reglas-proveedor-correo-2026-11-23`, según la sesión de la web); la función `enviarOrdenCompraPorCorreo` **sigue sin desplegarse**. Actualizar la nota del plan («Estado a confirmar») si cambió.
  - Hecho cuando: el reporte lo dice y el plan no contradice.

## Fase 1 — Correo del proveedor: módulos puros (sin DOM ni Firebase)

- [ ] **T1.1** Prueba `validarCorreo`: válido (`ventas@ejemplo.test`, con `+`, `.`, subdominios), vacío y solo espacios → ok con `''`, sin `@`, con espacio interno, con `,` o `;` (dos direcciones), con salto de línea, de 121 caracteres, no string. Fija la cadena de la regex.
  - Archivo: `public/js/proveedores.test.mjs`. Implementación: `public/js/proveedores.js` (`validarCorreo`, regex exportada).
  - CA1, R2. Se ve fallar antes de implementar.
- [ ] **T1.2** Prueba `validarProveedor` con `correo`: ausente = válido y sin clave `correo` en `datos`; vacío = válido (`''`); malo = error en español junto con los demás; válido = `datos.correo` recortado.
  - Archivo: `public/js/proveedores.test.mjs`. Implementación: `validarProveedor`.
  - CA1, R2, R4.
- [ ] **T1.3** Prueba `datosDeProveedor`: devuelve `correo` (`''` si falta) para rellenar el formulario; el snapshot de la OC **no** lo incluye (la OC no cambia).
  - Archivo: `public/js/proveedores.test.mjs`. Implementación: `datosDeProveedor` (sin tocar el snapshot de la 057).
  - R4, R14.

## Fase 2 — Correo del proveedor: escrituras con transacciones simuladas

- [ ] **T2.1** Prueba `crearProveedor`: sin correo (ausente o vacío) → el documento **no** trae `correo`; con correo válido → lo trae; con correo malo → rechaza sin escribir (ni proveedor ni candado de RUT). El candado de RUT no cambia.
  - Archivo: `public/js/proveedores-db.test.mjs`. Implementación: `public/js/proveedores-db.js`.
  - CA2, R3.
- [ ] **T2.2** Prueba `editarProveedor`: (a) proveedor viejo sin correo, se edita solo el teléfono → el `update` **no** lleva `correo`; (b) se agrega un correo → lo lleva; (c) se cambia el correo; (d) se borra el correo (`''`) → el `update` lleva `correo: ''` y no se elimina el campo; (e) correo malo → rechaza sin escribir; (f) siguen `actualizadoEl`/`actualizadoPor`.
  - Archivo: `public/js/proveedores-db.test.mjs`. Implementación: `editarProveedor` (`CAMPOS_EDITABLES` y `base` con `correo`; solo viaja si cambió respecto de `actual.correo ?? ''`).
  - CA3, R3, R4.

## Fase 3 — Correo del proveedor: tabla y formulario

- [ ] **T3.1** Prueba de vistas: `htmlFilasProveedores` agrega la celda «Correo» escapada (`<script>` y `"><img onerror=…>` salen como texto); sin correo muestra vacío; el `colspan` de «No hay proveedores…» sube de 7 a 8.
  - Archivo: `public/js/ordenes-compra-proveedores-vistas.test.mjs`. Implementación: `public/js/ordenes-compra-vistas.js`.
  - CA4, R5.
- [ ] **T3.2** Prueba de página: `ordenes-compra.html` tiene `prov-correo` (input de texto, `maxlength="120"`, mismo estilo que `prov-contacto`) y la columna «Correo» en la tabla; el controlador lo lee, lo rellena al editar y lo limpia al cancelar; los módulos tocados llevan `?v=058`.
  - Archivo: `tests/ordenes-compra-pagina.test.mjs`. Implementación: `public/ordenes-compra.html`.
  - R1, R5.
- [ ] **T3.3** Implementar el campo y la columna en `ordenes-compra.html` (`prov-correo`, lectura/relleno/limpieza, aviso de la validación junto al campo con los componentes de alerta existentes, `?v=058`). Diff fuera de `<script>`: solo el input y la columna.
  - Hecho cuando: T3.1 y T3.2 en verde y la suite completa en verde.

## Fase 4 — Botón «Enviar por correo»: módulo puro `ordenes-compra-envio.js`

- [ ] **T4.1** Prueba `estadoEnvio({ orden, proveedor })`: `Emitida` con proveedor activo y correo → habilitado y devuelve el correo; `Anulada` → no se muestra; sin `proveedorId` → deshabilitado con «Esta orden no tiene un proveedor del maestro; no se puede enviar por correo»; proveedor inexistente o inactivo → deshabilitado con motivo; sin correo (ausente o `''`) → «El proveedor no tiene correo registrado: agréguelo en Proveedores»; lista de proveedores no leída → «No se pudo leer el proveedor; recargue la página.».
  - Archivo: `public/js/ordenes-compra-envio.test.mjs` (nuevo). Implementación: `public/js/ordenes-compra-envio.js` (nuevo).
  - CA5, CA6, CA7, R7.
- [ ] **T4.2** Prueba `textoConfirmacion(numero, correo)`: «¿Enviar la OC-NNNN a <correo> con copia a rravellos@gravecare.cl?» (el correo del proveedor se recorta y se rechaza si trae saltos de línea).
  - Archivo: `public/js/ordenes-compra-envio.test.mjs`. Implementación: ídem.
  - CA8, R8.
- [ ] **T4.3** Prueba `mensajeErrorEnvio(error)`: cada código de R11 (`functions/unauthenticated`, `permission-denied`, `invalid-argument`, `not-found`, `failed-precondition`, `already-exists`, `resource-exhausted`, `unavailable`) y uno desconocido; con y sin prefijo `functions/`; `failed-precondition` devuelve el `message` de la función recortado a 200 caracteres; para los demás **nunca** aparece el texto crudo del servidor.
  - Archivo: `public/js/ordenes-compra-envio.test.mjs`. Implementación: ídem.
  - CA11, R11.
- [ ] **T4.4** Prueba `textoResultado(respuesta)` y `textoHistorial(envios)`: «Enviada a <para> con copia a <cc>»; `registrado === false` → «Se envió, pero no quedó registrado en la orden»; historial vacío/ausente → nada; 1 envío → «Enviada a <para> el <fecha>»; 3 envíos → «… (3 envíos)» con la última; fecha en formato local chileno; `enviadoPor` nunca aparece; el texto dinámico queda crudo en el módulo y **se escapa en la vista** (T5.1).
  - Archivo: `public/js/ordenes-compra-envio.test.mjs`. Implementación: ídem.
  - CA10, CA12, R10, R12.
- [ ] **T4.5** Prueba `enviarOrden({ numero, llamar })`: `numero` inválido → no llama; válido → `llamar` recibe **exactamente** `{ numero }` (sin otras claves); una segunda llamada mientras la primera sigue en curso no vuelve a llamar (indicador en memoria); tras éxito **y** tras error se puede volver a enviar.
  - Archivo: `public/js/ordenes-compra-envio.test.mjs`. Implementación: ídem.
  - CA9, R9.

## Fase 5 — Botón «Enviar por correo»: vistas y pantalla

- [ ] **T5.1** Prueba de vistas: `htmlEstadoEnvio` y `htmlHistorialEnvios` escapan `para`, `cc` y el mensaje (`<script>`, `"><img onerror=…>`); el motivo del botón deshabilitado se ve; el botón tiene `disabled` y el texto «Enviando…» en curso.
  - Archivo: `public/js/ordenes-compra-proveedores-vistas.test.mjs`. Implementación: `public/js/ordenes-compra-vistas.js` (**`htmlImpresion` sin cambios**: prueba que su salida es idéntica a la de antes).
  - CA10, CA12, R12, R14.
- [ ] **T5.2** Prueba de página (CA13): `ordenes-compra.html` carga `firebase-functions.js` con la versión `10.7.0` y solo ahí; usa `httpsCallable(… 'enviarOrdenCompraPorCorreo')` con `getFunctions(app, 'us-central1')` creada de forma perezosa dentro de `try/catch`; tiene `btn-enviar-correo` en `#modal-oc` junto a `btn-imprimir` y `aviso-envio`; no menciona la colección `mail`; no agrega escrituras a `ordenesCompra`; las direcciones `rravellos@`/`colivaresl@` solo aparecen en el texto de confirmación, no como configuración; `htmlImpresion` no cambió; el script inline compila.
  - Archivo: `tests/ordenes-compra-pagina.test.mjs`. Implementación: `public/ordenes-compra.html`.
  - CA13, CA14, R13, R14.
- [ ] **T5.3** Implementar el cableado en `ordenes-compra.html`: `import` aparte del SDK de Functions; en `abrirOrden` pintar el estado, el botón y el historial (el proveedor se busca en `docsProveedores`); clic → `confirm` → `enviarOrden` con `llamar` real → resultado o `mensajeErrorEnvio` → recarga de la OC (`recargarOrdenes` y reabrir) sin cortar nada si falla la recarga; botón desactivado en curso y rehabilitado en `finally`. Cache-busting `?v=058`.
  - Hecho cuando: T4.x, T5.1 y T5.2 en verde; la suite completa en verde; diff fuera de `<script>` solo el botón, `aviso-envio` y la línea de historial.

## Fase 6 — Herramienta local con Functions

- [ ] **T6.1** Prueba: `puertos()` incluye `functions` (base 5001, desplazado por `GC_OFFSET`); `envoltorio(version, 'functions')` conecta con `connectFunctionsEmulator(f, "127.0.0.1", <puerto desplazado>)`; con `GC_OFFSET=0` es el entorno del dueño, igual que los demás servicios, y con un desplazamiento distinto de 0 el puerto 5001 nunca aparece; la expresión `SDK` incluye `functions`; las páginas servidas siguen igual.
  - Archivo: `tests/entorno-local.test.mjs`. Implementación: `scripts/local/puertos.mjs`, `scripts/local/servidor-emuladores.mjs`.
  - Plan T13.
- [ ] **T6.2** Implementar `functions` en `puertos.mjs` y `servidor-emuladores.mjs` (herramienta de desarrollo, fuera de `public/`).
  - Hecho cuando: T6.1 y las pruebas de entorno local vigentes en verde.

## Fase 7 — Validación, documentos y entrega

- [ ] **T7.1** Validación en navegador contra emuladores, con `GC_OFFSET` propio (p. ej. 1500; nunca los puertos por defecto): reglas de la web con la 058 en una carpeta temporal fuera del repo, emulador de Functions de la web con la función en transporte `log` (sin correo real). Recorrido: crear proveedor con correo (y repetir RUT → rechazo); emitir OC eligiéndolo → abrir → «Enviar por correo» → confirmar → «Enviada a …» con `envios` visible; proveedor sin correo → botón deshabilitado con motivo; «Otro proveedor» → deshabilitado; `Anulada` → sin botón; doble clic → una sola llamada; función detenida → aviso en español y OC intacta; editar un proveedor viejo sin tocar el correo → guarda. Pasos para que el dueño lo vea en `http://localhost:<5050+GC_OFFSET>/`.
  - Hecho cuando: el reporte lo describe, con lo que no se pudo ver (captura visual, si el panel sigue oculto).
- [ ] **T7.2** Documentos: `docs/reportes/correo-proveedor-envio-oc.md` (reporte de la spec), fila de la 058 en `docs/03-backlog.md` (este repo **no tiene** `docs/08-estado-despliegue.md`: se informa en el reporte) y la nota de despliegue del plan al día.
  - Hecho cuando: los documentos reflejan lo implementado, con las pruebas y los límites.
- [ ] **T7.3** Suite completa (`node --test tests/ public/js/`), sintaxis de las páginas, diff fuera de `<script>` revisado, `git grep -l` de secretos sin mostrar valores, rama subida y PR contra la rama del PR #14. Reporte de avance; sin desplegar.
  - Hecho cuando: PR abierto y reporte entregado.

## Qué no se prueba en este repo (y quién lo cubre)
- **Reglas de Firestore** (`correo`, `envios`, `mail` cerrada): pruebas de la web (`proveedores-correo-058.test.js`, CA1–CA4 y CA16–CA17 de su spec).
- **La función** (envío real, topes, reserva de 60 s, SMTP): pruebas de la web (`orden-compra-correo.test.mjs`) y la prueba real del dueño tras el despliegue.
- **Entregabilidad** (SPF/DKIM/DMARC, casilla `colivaresl@gravecare.cl`): el dueño.
