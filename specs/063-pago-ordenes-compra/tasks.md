# Tareas — Spec 063 (backoffice)

Cada tarea empieza por la prueba, que debe verse fallar antes de escribir el código. Cierre de cada una: `node --test tests/ public/js/` en verde. Un commit por tarea, en español, agregando archivos por nombre.

## T1. Lógica pura (`public/js/ordenes-compra-pago.js` + test)
- [ ] T1.1 Prueba y función `transicionesDisponibles` (CA16, R2, R4): Emitida → [Emitida, Pagada, +Anulada si puedeAnular]; Pagada → [Pagada, Emitida]; Anulada → [Anulada]; sin `puedePago` solo se ofrece el estado actual.
- [ ] T1.2 Prueba y función `validarPago` (CA2, CA3, R5): factura vacía / 21 caracteres / caracteres no permitidos; fecha inválida (`2026-02-30`), anterior a la de la orden, futura; casos válidos.
- [ ] T1.3 Prueba y función `validarComentario` (CA10, R6): 0, 1, 500 y 501 caracteres, con `trim()`.
- [ ] T1.4 Prueba y función `textoReversion` (CA5, R9): prefijo «Se quitó: factura N° … y fecha de pago …. Motivo: …», dentro de 500, sin motivo → error.
- [ ] T1.5 Prueba y función `puedeRegistrarPago(perfil)`: dueño y `rol` `administrador`/`admin` (mayúsculas indiferentes); supervisor, operador y perfil nulo no.

## T2. Escritura (`ordenes-compra-db.js` + `ordenes-compra-db.test.mjs`)
- [ ] T2.1 Prueba y función `guardarSeguimientoOrden`: Emitida → Pagada escribe solo `estado`, `facturaNumero`, `fechaPago`, `pagoRegistradoEl/Por` (CA1, CA9).
- [ ] T2.2 Corrección en Pagada (CA4) y comentario junto al pago en una sola escritura, con `comentarioActualizadoEl/Por` (CA10).
- [ ] T2.3 Reversión (CA5, CA6): `''` en factura y fecha, `pagoRevertidoEl/Por`, motivo con prefijo; sin motivo rechaza.
- [ ] T2.4 Rechazos antes de escribir (CA7, CA8): Pagada → Anulada, cualquier cambio sobre Anulada, perfil sin permiso de pago, comentario inválido, formato de factura/fecha.
- [ ] T2.5 Perfil que solo puede comentar: la escritura trae solo campos de comentario aunque lleguen otros (CA12).
- [ ] T2.6 Estado cambiado por otra persona (CA11): no escribe y avisa; orden inexistente avisa.
- [ ] T2.7 Prueba de contrato (CA9, R10): ninguna escritura incluye `lineas`, `neto`, `iva`, `total`, `proveedor`, `proveedorId`, `envios`, `anulada*`, `creada*`, `numero`, `fecha`.

## T3. Vistas (`ordenes-compra-vistas.js` + `ordenes-compra-vistas.test.mjs`)
- [ ] T3.1 Prueba y cambio de `htmlFilasOrdenes` (CA13, CA20, R11, R16): 8 columnas, `—` sin dato, factura y fecha escapadas, estado real (Emitida/Pagada/Anulada, valor desconocido escapado), `colspan="8"` en la fila vacía; se actualizan las pruebas anteriores de esta función sin borrarlas.
- [ ] T3.2 Indicador de comentario y botón «Seguimiento» según el perfil (CA12, CA14, CA15): con comentario aparece el indicador accesible (`aria-label`, `tabindex`) con el texto en un atributo `data-` escapado; sin comentario no hay indicador.
- [ ] T3.3 Prueba y `htmlOpcionesEstado` (CA16): solo las transiciones válidas; Anulada deshabilitada en una orden anulada.

## T4. Página (`public/ordenes-compra.html` + `tests/ordenes-compra-pagina.test.mjs`)
- [ ] T4.1 Pruebas estáticas en rojo (CA17, CA19, R13, R18): ids `modal-seguimiento`, `seg-estado` (`<select>`), `seg-factura`, `seg-fecha` (`type="date"`), `seg-comentario`, `seg-motivo`, `btn-guardar-seguimiento`, `globo-comentario`; globo con `textContent`; sin `setDoc`/`deleteDoc`/`addDoc`/`writeBatch`; sin `gastos_ingresos`/`comprobantes_tributarios`; imports con `?v=` nuevo.
- [ ] T4.2 Cabecera de 8 columnas, modal de seguimiento, globo y manejadores (abrir, cambiar estado → mostrar/ocultar campos, guardar con `confirm`, `finally`, avisos de R15); `puedeRegistrarPago` desde el perfil leído; Anulada reutiliza `anularOrden`.
- [ ] T4.3 Globo: `mouseover`/`focusin`, clic del ícono en táctil, `Escape` y clic fuera.
- [ ] T4.4 `textoErrorOC` cubre el rechazo de reglas del seguimiento (mismo texto de permiso; ajustar solo si hace falta).

## T5. Verificación y entrega
- [ ] T5.1 Navegador con Firebase simulado (módulo local, datos ficticios): Emitida/Pagada/Anulada, panel por cada perfil, registrar, corregir, revertir, comentario con globo (ratón, teclado, toque) y con HTML hostil, errores de permiso y conexión, 375 px.
- [ ] T5.2 Suite completa `node --test tests/ public/js/` en verde.
- [ ] T5.3 `docs/reportes/063-pago-ordenes-compra.md`: qué se hizo, pruebas, decisiones, despliegue (orden: reglas web primero, luego Hosting con tag; número de archivos esperado), reversa.
- [ ] T5.4 PR de implementación; tag y procedimiento de despliegue solo después de que el dueño confirme que las reglas están publicadas. **No se despliega.**

## Tareas fuera de este repo (las hace la web y el dueño)
- Spec espejo y reglas de Firestore (`brief-web-reglas.md`), pruebas de emulador con puertos desplazados, publicación solo de reglas por el dueño.
