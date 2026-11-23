# Correo del proveedor y botón «Enviar por correo» en la orden de compra (spec 058, parte del backoffice)

**Fecha:** 2026-11-23 · **Rama:** `feat/058-correo-proveedor-envio-oc` (sale de `feat/057-proveedores-compra-dia`, PR #14) · **Estado:** listo para revisión. **No desplegado**: el despliegue lo ejecuta el dueño y **no debe hacerse todavía** (ver «Orden de despliegue»).
**Autorización:** el dueño aprobó la spec, el plan y el inicio de la implementación en la conversación del 2026-11-23.

## Para qué sirve
1. Cada proveedor puede tener un **correo electrónico opcional** («Correo electrónico» en el formulario y columna «Correo» en la tabla de Proveedores).
2. En una **orden de compra emitida**, un botón **«Enviar por correo»** envía la OC al correo del proveedor, con copia fija a `rravellos@gravecare.cl`. El envío lo hace la función `enviarOrdenCompraPorCorreo` (repo de la web); el navegador solo manda `{ numero }`. Remitente, destinatario, copia y contenido los decide el servidor.

## Qué se hizo
- **Proveedores** (`proveedores.js`, `proveedores-db.js`, `ordenes-compra.html`): campo opcional `correo` validado con **la misma expresión regular que las reglas de Firestore** (una sola dirección, sin espacios, comas ni punto y coma; máximo 120 caracteres). Vacío = sin correo. Se escribe solo si viene o cambió: un proveedor antiguo que se edita sin tocar el correo **no recibe** la clave; borrar el correo guarda `''` (el campo nunca se elimina). El snapshot del proveedor dentro de la OC no cambia.
- **Módulo puro `ordenes-compra-envio.js`** (nuevo): `estadoEnvio` (cuándo se muestra y cuándo se habilita el botón, con el motivo en español), `textoConfirmacion`, `mensajeErrorEnvio` (por código de la función; solo `failed-precondition` muestra el mensaje del servidor, recortado a 200), `textoResultado`, `textoHistorial` y `enviarOrden` (manda exactamente `{ numero }` y bloquea el doble clic con un indicador en memoria).
- **Modal de la OC** (`ordenes-compra.html`, `ordenes-compra-vistas.js`): botón junto a «Imprimir» (solo en OC *Emitida*), línea informativa (a quién se enviaría o por qué está deshabilitado), historial del último envío con «(N envíos)» y aviso de resultado. Confirmación previa: «¿Enviar la OC-NNNN a <correo> con copia a rravellos@gravecare.cl?». Tras enviar se recarga la OC para ver `envios`; si la recarga falla no se corta nada. El SDK de Functions (10.7.0) se carga con `import()` dinámico solo al pulsar: si no llega, falla únicamente el envío. Todo dato mostrado pasa por `esc()` (AUD-01). `htmlImpresion` no cambió.
- **Herramienta local** (`scripts/local/puertos.mjs`, `servidor-emuladores.mjs`): el servidor de desarrollo también conecta Functions al emulador con el puerto desplazado (`GC_OFFSET`), nunca al 5001 del dueño. Sirvió para probar el botón; no forma parte de `public/`.
- Cache-busting `?v=058` en los módulos tocados.

## Reglas aplicadas
- **Contrato de datos (regla 9):** solo cambios **aditivos**; `proveedores.correo` es un campo nuevo y opcional. No se copiaron reglas (viven en la web), no se escribe la colección `mail`, no se escribe nada en `ordenesCompra` desde el navegador (`envios` lo agrega la función).
- **Sin secretos ni correos reales** en código o pruebas (solo `@ejemplo.test`); las direcciones `rravellos@`/`colivaresl@` aparecen únicamente en el texto de confirmación y en la línea informativa.
- Una orden sin proveedor del maestro («Otro proveedor»), con proveedor inactivo, sin correo, anulada o con la lista de proveedores sin leer **no se envía**; el botón se deshabilita con el motivo o no se muestra (Anulada).

## Decisiones mías (a revisar)
1. El brief mencionaba un «modal de detalle» del proveedor que no existe: el correo se agregó como **columna de la tabla** y como **campo del formulario** de alta/edición.
2. `datosDeProveedor` quedó **sin cambios** (es el snapshot de la OC); se agregó `correoDeProveedor` para rellenar el formulario.
3. Los motivos de botón deshabilitado y los avisos de error son textos nuevos en español, con los componentes de alerta existentes.
4. Un proveedor inactivo no permite enviar (el servidor también lo comprueba); el motivo indica reactivarlo en Proveedores.

## Pruebas
`node --test tests/ public/js/` → **760 pasan, 0 fallan** (antes 711). Pruebas nuevas escritas primero en rojo: validación del correo (límites, formatos), escrituras sin/ con/ vacío/ cambiado, vistas escapadas, estado del botón por caso, mapeo de errores sin filtrar texto crudo, `{ numero }` exacto y anti doble clic, estructura de la página (SDK solo con import dinámico, sin `mail`, sin escrituras a la OC, `htmlImpresion` intacto) y el envoltorio local de Functions.
**Verificado en el navegador contra emuladores** (Firestore, Auth, Storage y Functions con puertos desplazados `GC_OFFSET=1700`; reglas y función de la web en una copia temporal, transporte de correo en `log`, **sin correo real**): crear proveedor con correo, correo inválido rechazado con su aviso, editar un proveedor antiguo sin tocar el correo (no escribe `correo`), borrar el correo (`''`), emitir y enviar una OC (aviso «Enviada a … con copia a …» y `envios` visible), proveedor sin correo / inactivo / «Otro proveedor» (botón deshabilitado con motivo), OC anulada (sin botón), doble clic (una sola llamada) y función detenida (aviso en español, OC intacta). Los procesos de prueba se detuvieron al terminar; solo se tocaron los puertos desplazados.
**No se hizo** una revisión visual con capturas (el panel del navegador estaba oculto) ni se probó contra producción.

## Orden de despliegue (el dueño; nada se ha desplegado)
1. **Reglas de la web con `correo`:** según la sesión de la web ya están publicadas (2026-11-23, 309 líneas, huella `2a51b2ab0cc5ee35`, tag `reglas-proveedor-correo-2026-11-23`).
2. **Función** `enviarOrdenCompraPorCorreo` (`--only functions:enviarOrdenCompraPorCorreo`, solo por nombre): **pendiente**; antes registrar el secreto `SMTP_OC_PASS` y confirmar SPF/DKIM/DMARC y el buzón `colivaresl@gravecare.cl`.
3. **Backoffice** (`--only hosting:gravecare-ops`, `--project gravecare-2e8d2`, desde `C:\Despliegue\...` en un tag): **solo cuando el dueño confirme 1 y 2**. Publicarlo antes dejaría un botón que falla.
- **Prueba real:** un proveedor «Prueba» con el correo del dueño. **La copia sale de verdad a `rravellos@gravecare.cl`**: avisar a esa persona antes.
- **Dependencia:** la rama sale del PR #14 (spec 057); el tag incluirá también la 057 (con su hoja de reglas de proveedores).

## Rollback
Antes de publicar: cerrar el PR. Después: publicar de nuevo el tag anterior del backoffice (los datos no se tocan: `correo` queda como campo inerte y la función puede quedar desplegada sin que nadie la llame).

## Archivos
- **Nuevos:** `public/js/ordenes-compra-envio.js` y su `.test.mjs`; `specs/058-correo-proveedor-y-envio-oc/` (spec, plan, tareas); este reporte.
- **Modificados:** `public/js/proveedores.js`, `proveedores-db.js`, `ordenes-compra-vistas.js` y sus pruebas; `public/ordenes-compra.html`; `scripts/local/puertos.mjs`, `scripts/local/servidor-emuladores.mjs`; `tests/entorno-local.test.mjs`, `tests/ordenes-compra-pagina.test.mjs`; `docs/03-backlog.md` (N218).
