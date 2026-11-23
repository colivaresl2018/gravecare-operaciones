# Spec 058 (parte backoffice) — Correo en «Proveedores» y botón «Enviar por correo» en la orden de compra

- **Estado:** **Aprobada por el dueño el 2026-11-23** (respuesta «Apruebo, sigue» en la sesión del backoffice; las tres decisiones de §10 según la recomendación). Falta aprobar el plan y las tareas antes de escribir código. La spec 058 de GraveCare (reglas y función) está aprobada y mezclada; esta es la parte de pantalla, que el dueño pidió pasar a este repo.
- **Repo:** `gravecare-operaciones` (backoffice). Rama `feat/058-correo-proveedor-envio-oc`, creada desde `feat/057-proveedores-compra-dia` (PR #14, aún sin mezclar) porque usa el maestro de proveedores de la 057.
- **Autor / fecha:** Claude Code (sesión del backoffice), 2026-11-23.
- **Fuente:** `specs/058-envio-oc-correo-proveedor/spec.md` del repo de la web (R1–R16, CA1–CA20, D0–D7 aprobadas sin cambios) y el brief `brief-backoffice-envio-oc-correo.md` de la carpeta de notas compartida. Este documento **no repite** esa spec: solo fija lo que hace la pantalla.
- **Reglas y función:** viven solo en el repo de la web (regla de oro 9). Este repo **no guarda copia de las reglas** ni toca `mail`.
- **Pedido del dueño (textual):** «necesito que dentro de la pestaña proveedores le agregues el campo de Correo Electrónico, y que desde la orden de compra, mediante un botón, pueda enviarla al proveedor directo por correo usando los correo de; colivaresl@gravecare.cl y con copia a rravellos@gravecare.cl».

## 1. Contexto

- `proveedores/{id}` (spec 057) no tiene correo. La web ya publicó la regla que admite `correo` opcional (≤ 120, una sola dirección, `''` para borrar).
- La OC emitida se ve en un modal con «Imprimir» (`public/ordenes-compra.html`, `#modal-oc`). Es de solo lectura para el navegador.
- La función `enviarOrdenCompraPorCorreo` (callable v2, `gravecare-2e8d2`, `us-central1`) está en `main` de la web pero **no desplegada** (falta la casilla SMTP y el secreto). Recibe solo `{ numero }`; remitente, copia, destinatario, asunto y cuerpo los fija el servidor.
- El backoffice no carga hoy el SDK de Functions.

## 2. Objetivo

1. Campo opcional **«Correo electrónico»** en el alta/edición de proveedor, visible en la tabla y en el detalle.
2. Botón **«Enviar por correo»** en el modal de una OC emitida, junto a «Imprimir», que llama a la función con solo el número de la orden, pide confirmación, evita el doble clic, traduce los errores y muestra el historial de envíos (solo lectura).

## 3. Fuera de alcance

- Reglas de Firestore, la función, el secreto SMTP, la casilla de correo y el despliegue (los hace la web y el dueño).
- Escribir en `mail`, en `ordenesCompra` (`envios` lo escribe solo el servidor) o guardar remitente/copia/contraseñas en el cliente.
- Cambiar `htmlImpresion` ni el diseño existente más allá del campo y del botón. Sin PDF adjunto (decisión D2).
- Enviar OC anuladas o «Otro proveedor (escribir)» (decisión D4); varios correos por proveedor (D7); restringir por rol (D6 aprobada: cualquier staff con claim).

## 4. Requisitos

Proveedores:
- **R1.** Campo de texto opcional «Correo electrónico» con el mismo estilo que `contacto`/`teléfono`.
- **R2.** Validación en el cliente tras `trim()`: vacío es válido (se guarda `''` para borrarlo; el campo no se elimina) o, si trae algo, una sola dirección de ≤ 120 caracteres que cumple `^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+([.][A-Za-z0-9-]+)*[.][A-Za-z]{2,}$` (la misma de las reglas), sin espacios, comas, `;` ni saltos de línea. Un correo mal formado no llega a Firestore; aviso en español junto al campo.
- **R3.** Al crear, `correo` va en el documento solo si no está vacío. Al editar, solo si cambió (`affectedKeys`), y se mantiene `actualizadoEl`/`actualizadoPor`.
- **R4.** Compatibilidad: «ausente» = sin correo; editar un proveedor existente sin tocar el correo sigue funcionando.
- **R5.** El correo se muestra escapado (`esc()`, AUD-01) en la tabla y en el detalle.

Envío:
- **R6.** Módulo nuevo `public/js/ordenes-compra-envio.js` (sin DOM ni Firebase en las funciones puras): estado del botón, texto de confirmación, mapeo de errores, texto del historial, y `enviarOrden({ numero, llamar })` que solo manda `{ numero }`.
- **R7.** El botón aparece solo con `estado === 'Emitida'` (con `Anulada` no se muestra). Queda **deshabilitado**, con su motivo, si: la OC no tiene `proveedorId` («Esta orden no tiene un proveedor del maestro; no se puede enviar por correo»), el proveedor no existe/está inactivo, o no tiene correo («El proveedor no tiene correo registrado: agréguelo en Proveedores»). El correo del proveedor se lee de `proveedores/{proveedorId}` **solo para mostrarlo**; el servidor lo vuelve a leer.
- **R8.** Antes de enviar, confirmación: «¿Enviar la OC-NNNN a <correo> con copia a rravellos@gravecare.cl?». (La copia se nombra porque el dueño la pidió; no es secreta. Pendiente D5 de la web: esa dirección ya queda en el repo público.)
- **R9.** Mientras la llamada está en curso el botón queda desactivado y dice «Enviando…»; siempre se vuelve a habilitar (`finally`).
- **R10.** Éxito `{ ok, numero, para, cc, enviadoEl, totalEnvios, registrado }`: «Enviada a <para> con copia a <cc>» y se recarga la OC; con `registrado === false`: «Se envió, pero no quedó registrado en la orden».
- **R11.** Errores (`error.code` termina en `…/<código>`), sin mostrar el texto crudo del servidor: `unauthenticated`/`permission-denied` → «Su sesión no tiene permiso para enviar correos. Vuelva a ingresar.»; `invalid-argument` → «Número de orden no válido.»; `not-found` → «No se encontró la orden de compra.»; `failed-precondition` → el `message` de la función (ya en español; se muestra escapado y acotado); `already-exists` → «Ya hay un envío en curso para esta orden. Espere un minuto.»; `resource-exhausted` → «Se alcanzó el límite de envíos. Intente más tarde.»; `unavailable` → «No se pudo enviar el correo. La orden no cambió; intente de nuevo.»; otro → «No se pudo enviar. Intente de nuevo.»
- **R12.** Historial: si la OC trae `envios` (`{ para, cc, enviadoEl, enviadoPor }`), el modal dice «Enviada a <para> el <fecha>» (la última) y «(N envíos)» si hay más. Todo con `esc()`; no se muestra `enviadoPor` (uid). La pantalla **nunca escribe** `envios` ni nada en la OC.
- **R13.** SDK de Functions con la misma versión del backoffice (`10.7.0`, gstatic), cargado solo en `ordenes-compra.html`; `httpsCallable(functions, 'enviarOrdenCompraPorCorreo')`. Si el SDK o la llamada fallan, la pantalla de órdenes sigue funcionando (solo el botón avisa).
- **R14.** Ningún cambio en `htmlImpresion` ni en la emisión/anulación de órdenes.

## 5. Criterios de aceptación

| CA | Dado | Cuando | Entonces | Prueba |
|---|---|---|---|---|
| CA1 | formulario de proveedor | se escribe un correo válido / vacío / sin `@` / con espacio / con `,` o `;` / de 121 caracteres | válido y vacío pasan; los demás se rechazan con aviso y no se escribe | `proveedores.test.mjs` |
| CA2 | alta con correo vacío o ausente | se guarda | el documento no trae `correo` (o `''`); lo existente sin cambios | `proveedores-db.test.mjs` |
| CA3 | edición | solo cambia el teléfono / solo cambia el correo / se borra el correo | `affectedKeys` contiene solo lo cambiado (`correo` con `''` al borrar) más `actualizadoEl`/`actualizadoPor` | ídem |
| CA4 | proveedor con correo `<script>` o `"><img onerror=…>` | se pinta la tabla y el detalle | sale como texto escapado | `proveedores*.test.mjs` (vistas) |
| CA5 | OC `Emitida`, proveedor activo con correo | se abre el modal | botón habilitado | `ordenes-compra-envio.test.mjs` |
| CA6 | OC `Anulada` | se abre el modal | no hay botón | ídem |
| CA7 | OC sin `proveedorId`; proveedor inactivo o inexistente; sin correo | se abre el modal | botón deshabilitado con el motivo de R7 | ídem |
| CA8 | clic en el botón | el usuario cancela la confirmación | no se llama a la función | ídem |
| CA9 | clic confirmado | se envía | `llamar` recibe **exactamente** `{ numero }` (sin destinatario, copia, asunto ni cuerpo); durante la llamada el botón está desactivado y al terminar (éxito o error) se rehabilita | ídem |
| CA10 | respuestas `ok` y `ok` con `registrado:false` | se muestra el resultado | textos de R10, escapados | ídem |
| CA11 | cada código de error de R11 y uno desconocido | se mapea | mensaje en español sin texto crudo; `failed-precondition` usa el `message` escapado | ídem |
| CA12 | OC con 0, 1 y 3 `envios`, algunos con `<script>` | se arma el historial | nada / «Enviada a … el …» / «… (3 envíos)»; escapado; sin uid | ídem |
| CA13 | `ordenes-compra.html` | se inspecciona | carga `firebase-functions.js` 10.7.0, usa `httpsCallable('enviarOrdenCompraPorCorreo')`, sin `mail`, sin escrituras a `ordenesCompra` salvo las de 055/057 ya existentes, sin `htmlImpresion` modificado, sin `rravellos`/`colivaresl` como dato de configuración (solo en el texto de confirmación de la copia) | `tests/ordenes-compra-pagina.test.mjs` |
| CA14 | si falla el SDK o la llamada | se usa el botón | aviso en español; el resto de la pantalla sigue | prueba de página + validación manual |
| CA15 | la suite vigente | se corre `node --test tests/ public/js/` | sigue en verde (711 + nuevas) | suite completa |

## 6. Flujos afectados

- Emitir, imprimir y anular órdenes, el desplegable de proveedor y los borradores (055/057): **no cambian**. El envío es posterior y opcional sobre una OC ya emitida; si falla, la OC no cambia.
- Pestaña Proveedores: un campo opcional más; las ediciones que no lo envían siguen igual.
- Los flujos de clientes (F0–F5) no se tocan.

## 7. Seguridad

- **Activos:** identidad de remitente `@gravecare.cl`, contenido de las OC, correo del proveedor (dato personal), inmutabilidad de la OC.
- **El navegador no decide nada:** solo manda `{ numero }`. Sin campo de destinatario, copia, asunto ni cuerpo; sin `mail`; sin contraseñas ni remitente en el cliente.
- **Validación y escape:** misma regex que las reglas (el servidor y las reglas la vuelven a validar); todo dato de Firestore y todo texto de error de la función pasan por `esc()` (AUD-01); `failed-precondition` se muestra acotado en largo.
- **Doble clic / abuso:** botón desactivado en curso y confirmación previa; el servidor tiene reserva de 60 s y topes (5 por OC al día, 30 por usuario y hora).
- **Sin secretos:** ninguno en el repo, el diff, las pruebas ni los registros; los correos de prueba son ficticios (`@ejemplo.test`). Las capturas de la validación no mostrarán datos reales.
- **Datos personales:** el correo del proveedor se muestra solo a staff con sesión (las reglas ya lo restringen); no va en URL, `console` ni mensajes de error.
- **Dependencias:** ninguna nueva (el SDK de Functions 10.7.0 viene de gstatic, como los demás módulos de Firebase).
- **Checklist del PR:** sin secretos; el navegador no decide destinatario/contenido; entradas validadas, salidas escapadas; sin cambios de reglas aquí; contrato de datos solo aditivo (`correo`, `envios` de solo lectura); rollback escrito (§9).

## 8. Datos (contrato, regla de oro 9)

Solo aditivo. Este repo **escribe** `proveedores/{id}.correo` (opcional, `''` o una dirección). **Lee** `ordenesCompra/{n}.envios` (lo escribe solo el servidor). No renombra ni elimina nada. Las reglas que lo permiten están publicadas por la web (huella indicada en su reporte); sin ellas, guardar un proveedor con correo se rechaza y la pantalla lo avisa con el aviso de permiso ya existente.

## 9. Validación y rollback

**Automática:** las pruebas de CA1–CA15 (primero, viéndolas fallar) y `node --test tests/ public/js/`.

**Navegador contra emuladores (puertos desplazados, nunca los del dueño):** el servidor local de este repo (`scripts/local/servidor-emuladores.mjs`) envuelve hoy Firebase `app`, `auth`, `firestore` y `storage`, pero **no `functions`**. Para probar el botón hay que (a) ampliar ese script de desarrollo, de forma aditiva, para que `getFunctions` apunte al emulador de Functions (`connectFunctionsEmulator`, puerto con `GC_OFFSET`), y (b) levantar el emulador de Functions de la web con la función (`transporte log`: no sale correo real). Pasos: crear proveedor con correo → emitir OC eligiéndolo → abrir la OC → «Enviar por correo» → «Enviada a …»; repetir con proveedor sin correo y con «Otro proveedor» (botón deshabilitado); `Anulada` sin botón.

**Hallazgo a confirmar:** `public/js/entorno.js` apunta `localhost` al proyecto `gravecare-qa`, que no tiene la función (solo existirá en `gravecare-2e8d2`). Por eso en localhost el envío solo se prueba con el emulador; en QA/producción hay que esperar al despliegue de la función. No se cambia `entorno.js`.

**Prueba real en producción (la hace el dueño, tras el despliegue):** con un proveedor «Prueba» cuyo correo es el suyo; **la copia sale de verdad a `rravellos@gravecare.cl`** (avisar antes).

**Orden de publicación (lo ejecuta el dueño):** 1) reglas web (ya publicadas); 2) función `enviarOrdenCompraPorCorreo` (`--only functions:enviarOrdenCompraPorCorreo`, tras registrar `SMTP_OC_PASS`); 3) Hosting del backoffice (clon limpio, tag, `--only hosting:gravecare-ops --project gravecare-2e8d2`). **No se despliega el backoffice hasta que el dueño confirme 1 y 2.**

**Rollback:** revertir el commit del backoffice y volver a publicar el tag anterior (`ops-planserv-10`, o el vigente); `correo` y `envios` ya guardados quedan sin daño (opcionales). Para quitar solo el envío: ocultar el botón.

## 10. Decisiones abiertas para el dueño

1. **Aprobar esta spec** (parte backoffice de la 058). Las decisiones D0–D7 de la web ya están aprobadas y aquí no cambian.
2. **Ampliar `scripts/local/servidor-emuladores.mjs`** con `functions` (herramienta de desarrollo, aditiva) para poder validar el botón en emuladores. Recomendado: sí.
3. **Orden de ramas:** esta rama sale de la del PR #14 (057). Recomendado: abrir su PR contra `feat/057-proveedores-compra-dia` (o contra `feat/ordenes-compra`, que la contiene al mezclarse #14), y mezclarlos en ese orden.
