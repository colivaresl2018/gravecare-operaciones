# Directriz W-CT1 — Renovación automática solo en contratos con Oneclick; sin plazo de aviso

2026-11-16 · Para el dueño y el PM, que la llevan al **repo de la web** (los textos viven en `functions/` y `public/`). Este documento no cambia ningún código. El backoffice no contiene ese texto (búsqueda hecha: sin coincidencias en este repo).

## 1. Decisiones del dueño (2026-11-16)
1. La frase «renovable automáticamente hasta que el Cliente la pause o cancele formalmente, a contar de la confirmación electrónica de la orden» **solo puede aparecer en contratos de planes pagados con Oneclick** (cobro mensual recurrente). En los demás contratos **no debe aparecer**.
2. **Se elimina el plazo de aviso** para terminar el contrato (los «30 días» y los «15 días»). No se reemplaza por otro.
3. **Los contratos ya emitidos no importan:** son de prueba, todavía no hay contratos reales. No hay que avisar a nadie ni migrar nada.

## 2. Dónde está en el repo de la web (solo lectura)
| # | Archivo | Línea | Qué dice hoy |
|---|---|---|---|
| 1 | `functions/contrato.js` | 161 | `plazo` de la suscripción: «…, renovable automáticamente hasta que el Cliente la pause o cancele formalmente» |
| 2 | `functions/contrato.js` | 193 | Cláusula QUINTO: `${plazo}, a contar de la confirmación electrónica de la orden.` |
| 3 | `functions/contacto.js` | 83 | Módulo duplicado del contrato: «…, renovable automáticamente hasta que el Cliente la cancele o pause» |
| 4 | `public/js/contratoGravecare.js` | 207 | «vigencia indefinida y renovación automática por períodos iguales, pudiendo el Cliente poner término… con **30 días** de anticipación» |
| 5 | `public/js/contratoGravecare.js` | 225 | «Cualquier ajuste en tarifas periódicas será notificado… con un mínimo de **30 días** de antelación» (otro aviso: ver §4, punto 3) |
| 6 | `public/contratos.html` | 310 | «vigencia de 12 meses renovables automáticamente… baja o cancelación… con al menos **15 días** de anticipación» |
| — | `legacy/funciones-desplegadas/paquete-B/` | — | Copias antiguas. **No se tocan** (regla de no borrar; son legado) |

Ninguna prueba del repo de la web comprueba esas frases (búsqueda en `tests/`: sin coincidencias), así que el cambio no rompe pruebas existentes.

## 3. Cambio propuesto (solo texto, sin tocar datos)
**Cómo saber si el plan es Oneclick.** La única función que marca el método de pago es `functions/oneclick.js:157`, que escribe `metodoPago: 'Oneclick'` en la orden (junto con `oneclickInscripcion`) cuando la inscripción se confirma. Los pagos Webpay no escriben ese campo. Regla: **es Oneclick si `orden.metodoPago === 'Oneclick'`**. La función que genera el PDF (`generarContratoAlPagar`, `contrato.js:427`) corre cuando la orden se escribe, así que ya ve ese campo.

1. **`functions/contrato.js:161`** — `plazo` de suscripción:
   - Oneclick: `Suscripción con periodicidad "${det.frecuencia}", renovable automáticamente hasta que el Cliente la pause o cancele formalmente`.
   - Otro método: `Suscripción con periodicidad "${det.frecuencia}"`.
   - Spot: sin cambios («Servicio único (Visita Spot), sin renovación automática»).
2. **`functions/contrato.js:193`** — la frase «, a contar de la confirmación electrónica de la orden» se conserva **solo** para Oneclick y Spot. Para el resto: `${plazo}.`.
3. **`functions/contacto.js:83`** — misma regla que el punto 1 (revisar dónde se usa `plazo` más abajo).
4. **Vista previa antes de pagar.** El cliente ve el contrato en `resumen-pago.html` **antes** de elegir cómo pagar, cuando aún no existe `metodoPago`. Quien implemente debe comprobar de dónde sale ese texto y mostrar allí la versión **sin** renovación (la de los métodos no Oneclick) o, si el cliente ya eligió Oneclick, la versión con ella. Debe decidirlo el dueño si prefiere mostrar ambas variantes.
5. **`public/js/contratoGravecare.js:207` y `public/contratos.html:310`** — son términos generales, sin saber el método de pago. Quitar de ahí el plazo de aviso (30 y 15 días) y dejar la renovación solo como «en los planes pagados con Oneclick, el cobro se repite cada mes hasta que el Cliente anule su inscripción». Texto exacto por confirmar con el dueño.
6. **Prueba nueva** (`tests/local/`): (a) con `metodoPago: 'Oneclick'` el contrato de suscripción contiene «renovable automáticamente»; (b) sin él, no contiene «renovable» ni «renovación automática»; (c) ningún texto de contrato contiene «días de anticipación» ni «días de antelación» referidos a terminar el contrato; (d) Spot conserva «sin renovación automática».

## 4. Aún por decidir (dueño)
1. **Qué dice el contrato Oneclick sobre cómo anular.** Si la renovación existe, el cliente debe poder anular la inscripción; el sitio hoy no lo implementa (T14 en `docs/entregas/textos-pagos-y-cuotas.md`). Sin plazo de aviso, conviene que el texto diga solo que se puede anular la inscripción en cualquier momento, sin inventar un mecanismo que no existe.
2. **Texto exacto del punto 5** de §3.
3. **El aviso de 30 días por ajuste de tarifas** (`contratoGravecare.js:225`) es otro concepto (avisar de un cambio de precio) y la decisión de eliminar el plazo de aviso se refería a terminar el contrato. Se deja **sin cambios** salvo que el dueño diga lo contrario.
4. Conviene que un abogado revise el texto final antes de que haya contratos reales.

## 5. Despliegue (lo hace el dueño, desde un clon limpio en un tag)
- **Functions:** identificar las funciones que cargan `contrato.js` y `contacto.js` y desplegar solo esas con `--only functions:<nombre>`, nunca todo `functions` (el contrato de datos advierte de funciones desplegadas sin fuente).
- **Hosting de la web:** `--only hosting` para `contratoGravecare.js` y `contratos.html`.
- **Reversa:** volver al tag anterior y repetir el mismo despliegue. Es solo texto: no toca colecciones, campos ni reglas.

## 6. Verificación
Con el código de piloto, entrando por `gravecare-2e8d2.web.app`: comprar un plan con Webpay y comprobar que la cláusula QUINTO muestra solo `Suscripción con periodicidad "…".`; comprar con Oneclick y comprobar que sí aparece la renovación. Revisar también el PDF y las páginas de términos: sin «30 días» ni «15 días» de aviso para terminar.
