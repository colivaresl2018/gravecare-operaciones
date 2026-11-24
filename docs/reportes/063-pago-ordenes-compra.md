# Seguimiento de pago de las órdenes de compra (spec 063)

**Fecha:** 2026-11-23 · **Rama:** `feat/063-pago-oc` (desde `main`, tag `ops-planserv-15`) · **Estado:** listo para revisión. **No desplegado**: el despliegue lo ejecuta el dueño y **solo después de que las reglas de Firestore estén publicadas** (ver «Despliegue»).
**Autorización:** el dueño pidió la función el 2026-11-23 y aprobó la spec con mis recomendaciones D2–D9 («Apruebo, sigue»). Spec: `specs/063-pago-ordenes-compra/spec.md`.

## Qué pidió el dueño
En «Órdenes de compra»: tres estados (**Emitida, Pagada, Anulada**); junto a Estado, las columnas **«Pagado con factura N°»** y **«Fecha de pago»**; la posibilidad de agregar **comentarios** que aparezcan al pasar el cursor sobre la orden; estado con **menú desplegable** y fecha con **calendario**, ambos manuales y **guardados en Firestore**.

## Qué se hizo
- **Tabla de órdenes emitidas con 8 columnas:** Número, Fecha, Proveedor, Total, Estado, **Pagado con factura N°**, **Fecha de pago** y acciones. El estado «Pagada» tiene su insignia (celeste); Emitida y Anulada conservan las suyas. Una orden sin pago muestra «—» en las dos columnas nuevas.
- **Botón «Seguimiento»** (órdenes Emitida o Pagada) que abre un panel con: estado (desplegable), N° de factura, fecha de pago (calendario con mínimo = fecha de la orden y máximo = hoy), motivo (solo al revertir o anular) y comentario (hasta 500 caracteres, con contador).
- **Comentario en un globo:** si la orden tiene comentario, aparece un ícono junto al número; el globo se abre al pasar el cursor, al enfocar el ícono con el teclado o al tocarlo (celular), y se cierra con Escape, al salir o al tocar fuera. El texto se pone con `textContent`: un comentario con HTML se ve literal (AUD-01). El comentario no viaja en el HTML de las filas.
- **Transiciones:** Emitida→Pagada (exige factura y fecha), Pagada→Emitida (reversión: exige motivo y limpia factura/fecha, dejando lo que se quitó escrito en el motivo), Emitida→Anulada (solo el dueño, con la opción ya existente). **No se permite** Pagada→Anulada ni salir de Anulada.
- **Quién puede qué:** dueño o administrador registran, corrigen y revierten pagos; **cualquier miembro del staff** puede dejar comentarios (salvo en órdenes anuladas); anular sigue siendo solo del dueño. Quien no puede cambiar el pago ve el panel con una nota y solo el comentario editable.
- **Un solo guardado atómico:** estado, factura, fecha y comentario se escriben en una sola transacción que verifica que el estado no haya cambiado desde que se abrió el panel (si cambió, avisa y no escribe). Pide confirmación al marcar Pagada, revertir o anular; el botón se deshabilita mientras guarda.

## Datos (solo aditivos, en `ordenesCompra/{numero}`)
`estado` (suma el valor `Pagada`), `facturaNumero`, `fechaPago`, `pagoRegistradoEl/Por`, `pagoRevertidoEl/Por`, `motivoReversionPago`, `comentario`, `comentarioActualizadoEl/Por`. Todos opcionales; las órdenes existentes siguen siendo válidas sin ellos. **No se renombra ni elimina nada** del contrato con la web (la web no lee `ordenesCompra`). Factura: hasta 20 caracteres (`^[A-Za-z0-9][A-Za-z0-9 ./-]{0,19}$`); fecha `AAAA-MM-DD`, no anterior a la fecha de la orden ni futura. Cada escritura toca solo campos de una lista cerrada (verificado con Firestore simulado).

## Reglas de Firestore (NO se publican desde este repo)
La spec necesita que la regla de `update` de `ordenesCompra` admita tres ramas (anular, pago con comentario opcional, comentario de staff). La fuente única es el repo de la web: el encargo está en `specs/063-pago-ordenes-compra/brief-web-reglas.md` y lo escribe, prueba y publica la sesión de la web con aprobación del dueño. **Hasta que esas reglas estén publicadas, el panel mostrará «Firestore rechazó el guardado…» y no se guardará nada** (comprobado en el navegador con permiso denegado).

## Decisiones mías (a revisar)
1. **Guardar explícito** (botón «Guardar»), no al cambiar el desplegable: evita guardados accidentales y permite validar factura y fecha juntas.
2. **Comentario junto con el pago en una sola escritura** (la rama de pago de la regla también admite los campos de comentario) para no hacer dos escrituras que puedan quedar a medias.
3. **Al elegir «Anulada» el comentario se deshabilita:** la regla de anulación no admite otros campos; si se quiere dejar comentario, se guarda antes.
4. **Reversión conserva rastro:** al volver a Emitida se vacían factura y fecha pero se guardan en `motivoReversionPago` («Se quitó: factura N° … y fecha de pago …. Motivo: …»), `pagoRevertidoEl/Por`.
5. **El comentario es interno:** no sale en la orden impresa, en el PDF ni en el correo al proveedor (el panel lo dice).
6. **Versiones de caché `?v=063`** en `ordenes-compra-db.js`, `ordenes-compra-vistas.js` y el módulo nuevo; las pruebas antiguas que fijaban `?v=057/058` se actualizaron (no se borraron).

## Archivos
- **Nuevos:** `public/js/ordenes-compra-pago.js` y `ordenes-compra-pago.test.mjs`; `specs/063-pago-ordenes-compra/` (spec, plan, tareas, brief de reglas); este reporte.
- **Modificados:** `public/ordenes-compra.html` (columnas, panel de seguimiento, globo, imports), `public/js/ordenes-compra-db.js` (+ `guardarSeguimientoOrden`), `public/js/ordenes-compra-vistas.js` (+ columnas, insignia, `htmlOpcionesEstado`), sus pruebas y `tests/ordenes-compra-pagina.test.mjs`. `anularOrden` no cambió.

## Pruebas
`node --test tests/ public/js/` → **853 pasan, 0 fallan** (57 pruebas nuevas, escritas primero en rojo: lógica pura de estados/factura/fecha/comentario/reversión; escritura atómica con Firestore simulado y transacciones optimistas; filas y opciones; estructura de la página).
**Verificado en el navegador con Firebase ficticio** (módulo local, datos inventados): perfil dueño (registrar pago, validaciones sin escrituras, reversión con motivo, anulación desde el panel), administrador (sin «Anular»; Emitida/Pagada), supervisor (solo comentario, nota de solo lectura), globo con ratón/teclado/toque/Escape/clic fuera y con HTML hostil (texto literal, sin ejecutar), permiso denegado al guardar (panel abierto, nada guardado, texto claro) y 375 px sin desborde horizontal.
**No se probó** con las reglas, las órdenes ni los permisos reales de producción, ni con emuladores. La prueba real queda para después de publicar las reglas.

## Despliegue (lo ejecuta el dueño; yo no despliego)
1. **Primero las reglas** (repo de la web; las publica el dueño con el tag que indique la sesión de la web). Sin ellas, el panel rechaza guardados.
2. **Luego Hosting**, desde el clon limpio `C:\Despliegue\GravecareOps`, con el tag que yo cree **solo cuando el dueño confirme que las reglas están publicadas** (propuesto: `ops-planserv-16`):
```
cd C:\Despliegue\GravecareOps
git fetch --tags origin
git checkout ops-planserv-16
git describe --tags
firebase deploy --only hosting:gravecare-ops --project gravecare-2e8d2
```
`git describe --tags` debe mostrar exactamente `ops-planserv-16`. Archivos esperados en `public/`: **108** (los 106 de `main` más `ordenes-compra-pago.js` y su prueba); si el despliegue dice otro número, no continuar.
3. **Prueba en producción sugerida:** como dueño, abrir una orden Emitida → Seguimiento → Pagada con factura y fecha → ver columnas; pasar el cursor sobre una orden con comentario; revertir con motivo; como un usuario no dueño/administrador, comprobar que solo puede comentar.

## Reversa
- **Hosting:** volver a publicar el tag anterior (`ops-planserv-15`) con el mismo comando. Las órdenes ya marcadas «Pagada» seguirían guardadas, pero la página anterior no conoce ese estado (no se probó cómo lo muestra): conviene no marcar pagos reales hasta estar seguros de mantener esta versión.
- **Reglas:** las publica la web; su reversa es publicar la versión anterior del tag de reglas (la actual: `reglas-ordenes-compra-2026-11-22`).
- **Datos:** los campos nuevos son aditivos y opcionales; no hay migración que deshacer.
