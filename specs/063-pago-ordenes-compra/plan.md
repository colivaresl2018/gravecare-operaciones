# Plan técnico — Spec 063 (backoffice): seguimiento de pago de las órdenes de compra

- **Estado:** redactado el 2026-11-23, sobre la spec 063 aprobada ese mismo día. Parte backoffice; las reglas de Firestore son de la web.
- **Base:** `origin/main` (`a546754`). La rama de código sale de la rama de la spec y su PR va contra `main` cuando el PR de la spec esté mezclado.

## 1. Enfoque

La pantalla ya separa tres capas y esta spec las respeta, sin introducir otras:

1. **Lógica pura sin DOM ni Firebase**, probada con `node --test`.
2. **Escrituras** con dependencias inyectadas (`ejecutarTransaccion`, `refs`), probadas con Firestore simulado.
3. **Vistas** que devuelven HTML escapado con `esc()`, y la **página**, que solo conecta eventos.

Una sola escritura por guardado, siempre en **transacción**: lee la orden, comprueba que el estado sigue siendo el que la pantalla creía y escribe únicamente los campos de la transición.

## 2. Piezas

| Pieza | Archivo | Qué hace |
|---|---|---|
| Lógica pura (nuevo) | `public/js/ordenes-compra-pago.js` (+ `.test.mjs`) | `ESTADOS_OC`, `transicionesDisponibles({ estado, puedePago, puedeAnular })`, `validarPago({ facturaNumero, fechaPago, fechaOrden, hoy })`, `validarComentario(texto)`, `textoReversion({ facturaNumero, fechaPago, motivo })` (prefijo «Se quitó: …», tope 500), `esAdministradorOExDueno(perfil)` |
| Escritura | `public/js/ordenes-compra-db.js` | `guardarSeguimientoOrden({ ejecutarTransaccion, refs, numero, estadoVisto, estadoNuevo, facturaNumero, fechaPago, comentario, motivo, perfil, uid, ahora, hoy })`; devuelve los campos escritos. Rechaza antes de escribir si no corresponde |
| Vistas | `public/js/ordenes-compra-vistas.js` | `htmlFilasOrdenes` pasa a 8 columnas (columnas de factura y fecha, insignia Pagada, indicador de comentario, botón «Seguimiento»); `htmlOpcionesEstado(transiciones, actual)` |
| Página | `public/ordenes-compra.html` | Cabecera con 2 columnas nuevas, modal `#modal-seguimiento`, globo `#globo-comentario`, manejadores; nunca `setDoc`, solo la transacción de `guardarSeguimientoOrden` o `anularOrden` |
| Pruebas de página | `tests/ordenes-compra-pagina.test.mjs` | Estructura nueva (ids, `type="date"`, `<select>`, `textContent` en el globo, sin escrituras prohibidas, sin `gastos_ingresos`) |
| Documentación | `docs/reportes/063-pago-ordenes-compra.md`, `specs/063-pago-ordenes-compra/brief-web-reglas.md` | Reporte con despliegue y reversa; el brief detalla las reglas para la web |

## 3. Decisiones de diseño

- **Una escritura atómica por guardado.** La rama «pago» de la regla admite también los campos de comentario (spec §8), así que pago y comentario viajan juntos. La anulación sigue siendo `anularOrden` (su regla no admite más campos): elegir «Anulada» deshabilita el comentario en ese guardado.
- **Quién puede** se decide con el perfil `staff/{uid}` que la pantalla ya lee: `puedeAnular = dueno === true`; `puedePago = dueno === true` o `rol` en `administrador`/`admin` (misma lógica que la función `esAdministrador()` de las reglas). La pantalla solo muestra u oculta; las reglas mandan.
- **Verificación del estado previo.** `estadoVisto` es el estado que tenía la pantalla al abrir el panel; la transacción lo compara con el leído y, si cambió, no escribe y avisa.
- **Reversión.** `facturaNumero` y `fechaPago` vuelven a `''` y el motivo guardado lleva antepuesto lo que se quitó (R9).
- **Fecha.** `<input type="date">` nativo; el valor es texto `AAAA-MM-DD`, igual que `fecha`. `hoy` se inyecta (la página usa `hoyIso()` ya existente) para probar sin reloj.
- **Globo del comentario.** Un solo elemento `#globo-comentario` que se posiciona junto al número; se llena con `textContent`; se abre con `mouseover`/`focusin` y con clic en el ícono (táctil); `Escape` y clic fuera lo cierran. Sin librerías.
- **Caché.** Los módulos que cambian suben su `?v=` en los `import` de la página, y el módulo nuevo entra con el mismo esquema, para que Hosting no sirva JavaScript viejo con una página nueva.
- **Sin cambios** en `htmlImpresion`, el PDF archivado, el correo, la emisión ni la anulación.

## 4. Orden y riesgos

1. Pruebas de lógica en rojo → lógica pura. 2. Pruebas de escritura en rojo → `guardarSeguimientoOrden`. 3. Pruebas de vistas en rojo → vistas. 4. Página y pruebas de página. 5. Verificación en el navegador con Firebase simulado y suite completa.

- **Riesgo: reglas aún no publicadas.** Sin la regla de la web la pantalla funciona pero Firestore rechaza el guardado (mensaje de R15). Se despliega el Hosting solo después de publicar las reglas.
- **Riesgo: tabla ancha.** 8 columnas; se verifica el scroll horizontal a 375 px.
- **Riesgo: el módulo `ordenes-compra-vistas.js` ya tiene pruebas de otras specs;** `htmlFilasOrdenes` cambia de forma (colspan, columnas) y esas pruebas se actualizan, no se eliminan.
