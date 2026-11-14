# C1 · AUD-01: los datos de Firestore se escapan antes de dibujarse en el backoffice

**Fecha:** 2026-11-14 · **Rama:** `fix/escape-html-backoffice` · **Tag:** `ops-11`

## Qué pasaba (AUD-01, crítico)
Las órdenes las crea el navegador de quien compra (campos de texto como nombre del difunto, titular, cementerio, observaciones, etc. solo
tienen límite de largo en `iniciarOrden`). El backoffice dibujaba esos datos con `innerHTML` sin escapar. Un comprador podía guardar
`<img src=x onerror=…>` en un campo y ese código se ejecutaba en la sesión del staff o del operador que abriera la página
(XSS almacenado), con acceso a sus permisos de Firebase.

## Qué cambia
- **Nuevo** `public/js/html-seguro.js`: `esc()` convierte `& < > " ' \`` en entidades. Con pruebas (`public/js/html-seguro.test.mjs`).
- **Todas las páginas que dibujan datos con HTML ahora pasan cada dato por `esc()`:**
  `ordenes`, `todos-los-trabajos`, `trabajos-terminados`, `mis-trabajos`, `mapa`, `clientes`, `planificacion`, `informe-revision`,
  `informe-captura` (ubicación), `admin-usuarios`, `login-ops` (mensaje) y `gastos-ingresos` (datos leídos del PDF de la factura y del libro).
- **Manejadores `onclick` con datos:** escapar HTML no protege dentro de un atributo `onclick` (la entidad se decodifica antes de ejecutar
  el JavaScript). Esos botones ahora llevan el dato en `data-*` y el manejador lo lee con `this.dataset` (`abrirModalAsignar`,
  `cambiarFechaVisita`, `abrirModalInforme`, `mostrarObservacionesCliente`, `abrirDetalleInforme`, `eliminarClienteConClave`,
  `completarVisitaIndividual`). Los argumentos numéricos se pasan con `Number()`.
- **Enlaces de documentos** (`gastos-ingresos`): el enlace «Ver Documento» solo acepta URLs `http(s)`; cualquier otra cosa queda en `#`.
- **Sin cambios visuales:** misma estructura, clases, colores y textos. Solo se escapan los valores y se mueve el dato del `onclick` a `data-*`.
- No cambia ningún campo, colección ni regla de Firestore/Storage. No se borra nada.

## Protección contra regresiones
`tests/escape-html-backoffice.test.mjs` analiza los `<script>` de cada página (plantillas anidadas, comentarios, cadenas y regex) y **falla** si:
1. una plantilla con HTML interpola un dato (`item.campo`, `inf.campo`, `err.message`…) sin `esc()`;
2. un dato va dentro de un manejador inline `on…="…"` (solo se admiten índices numéricos o `Number(...)`);
3. el analizador deja de encontrar las plantillas esperadas (para que no pase «en verde» por quedar ciego).
Se verificó con una mutación (quitar un `esc()` en `ordenes.html`): la prueba falla y nombra la línea.
Excepción documentada: `item.estadoServicioHtml` en `clientes.html` (HTML propio de la página, armado solo con números).

Se actualizaron 5 pruebas estáticas existentes que buscaban el texto exacto del código anterior (misma intención, ahora con `esc()` / `data-*`).

## Pruebas
`node --test tests/ public/js/` → 302 pasan, 0 fallan. Además, los 16 `<script>` en línea de las páginas se revisaron con `node --check` (sin errores de sintaxis).
**No se probó en navegador contra datos reales** (no hay emulador propio): ver «Verificación manual» abajo.

## Fuera de alcance / pendiente
- `public/js/gastosIngresos.js` y `public/gastosIngresos.js` **no los carga ninguna página**; contienen `innerHTML` con categorías sin escapar.
  No se tocaron (código obsoleto); si algún día se reutilizan hay que escaparlos. Candidatos a mover a `legacy/` con su propia directriz.
- La defensa en profundidad (validar en el servidor, `iniciarOrden`, que los textos no traigan `<` `>`; y una Content-Security-Policy en Hosting)
  vive en el repo de la web / `firebase.json` y va en otra tarea (C-siguientes del plan de remediación).
- Datos ya guardados con HTML malicioso: no se modifican; quedan inofensivos porque ahora se muestran como texto.

## Despliegue y reversa
Solo Hosting de `gravecare-ops`, desde `C:\Despliegue\GravecareOps` en el tag `ops-11`:
`firebase deploy --project gravecare-2e8d2 --only hosting:gravecare-ops`. Reversa: volver a desplegar `ops-10`.

## Verificación manual (después de desplegar)
1. Órdenes de Servicio → abrir «Asignar» en una fila y cambiar la fecha de una visita (usan `data-id`).
2. Todos los Trabajos → «Completar visita» en una visita completable.
3. Trabajos Terminados → «Ver Informe».
4. Mis Trabajos con el operador Oscar Ramon → ver «Rechazado», el motivo y **«Corregir informe»** (que precarga fotos/labores), además de «Observaciones del cliente».
5. Revisión de Informes → abrir una tarjeta (usa `data-id`). Planificación → mover una visita y cambiar el operador.
6. Una orden de prueba con `<b>negrita</b>` en el nombre del difunto debe verse literal, no en negrita.
