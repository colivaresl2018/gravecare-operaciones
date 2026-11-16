# Directriz W-CT1 — Quitar la «renovación automática» de todos los contratos

2026-11-16 · Para el dueño y el PM, que la llevan al **repo de la web** (los textos viven en `functions/` y `public/`). Este documento no cambia ningún código. El backoffice no contiene ese texto (búsqueda hecha: sin coincidencias en este repo).

## 1. Decisión del dueño
El párrafo siguiente **no debe aparecer en ningún contrato**:

> «renovable automáticamente hasta que el Cliente la pause o cancele formalmente, a contar de la confirmación electrónica de la orden.»

Lo vio en la cláusula QUINTO («Plazo y vigencia») de `resumen-pago.html`.

## 2. Dónde está en el repo de la web (solo lectura)
| # | Archivo | Línea | Qué dice |
|---|---|---|---|
| 1 | `functions/contrato.js` | 161 | `plazo` de la suscripción: «…, renovable automáticamente hasta que el Cliente la pause o cancele formalmente» |
| 2 | `functions/contrato.js` | 193 | Cláusula QUINTO: `${plazo}, a contar de la confirmación electrónica de la orden.` |
| 3 | `functions/contacto.js` | 83 | Módulo duplicado del contrato: «…, renovable automáticamente hasta que el Cliente la cancele o pause» |
| 4 | `public/js/contratoGravecare.js` | 207 | «vigencia indefinida y renovación automática por períodos iguales, pudiendo el Cliente poner término… con 30 días de anticipación» |
| 5 | `public/contratos.html` | 310 | «vigencia de 12 meses renovables automáticamente por períodos iguales… baja o cancelación… con al menos 15 días de anticipación» |
| — | `legacy/funciones-desplegadas/paquete-B/` | — | Copias antiguas. **No se tocan** (regla de no borrar; son legado) |

Ninguna prueba del repo de la web comprueba esas frases (búsqueda en `tests/`: sin coincidencias), así que el cambio no rompe pruebas existentes. Aun así, hay que agregar una que lo impida.

## 3. Cambio propuesto (solo texto, sin tocar datos)
1. **`functions/contrato.js:161`** — suscripción: `Suscripción con periodicidad "${det.frecuencia}"` (sin «renovable…»).
2. **`functions/contrato.js:193`** — para suscripción, `${plazo}.` (sin «, a contar de la confirmación electrónica de la orden»). Para Spot, el texto actual no cambia («Servicio único (Visita Spot), sin renovación automática», que además dice lo contrario y es correcto).
3. **`functions/contacto.js:83`** — igual que el punto 1. Revisar dónde se usa `plazo` más abajo para no dejar un resto de la frase.
4. **`public/js/contratoGravecare.js:207`** y **`public/contratos.html:310`** — quitar las frases de renovación automática. Ambas hablan además de un **plazo de aviso distinto** (30 días en una, 15 en la otra) y de una vigencia distinta (indefinida / 12 meses). Esa inconsistencia ya existía: el dueño debe fijar **un solo** texto de término del contrato, y conviene que lo revise un abogado antes de publicarlo.
5. **Prueba nueva** (`tests/local/`): ningún texto generado por `contrato.js`, `contacto.js`, `contratoGravecare.js` ni `contratos.html` contiene «renovable automáticamente» ni «renovación automática» (Spot queda exento: «sin renovación automática»).

## 4. Qué decide el dueño (con su contador o abogado)
1. **Los cobros recurrentes.** Si el plan se cobra cada mes con Oneclick, el contrato debe describirlo de otra forma (inscripción de tarjeta, monto, cuándo se cobra, cómo se anula). Quitar la frase no cambia lo que el sitio hace; solo deja de **prometerlo** en el contrato. El documento `docs/entregas/textos-pagos-y-cuotas.md` (T14) ya advertía que el sitio **no implementa** renovación, pausa ni cancelación, y proponía: «Plan con periodicidad "…", según las condiciones de vigencia y término del contrato.» Es una alternativa si se prefiere no dejar la cláusula sin plazo.
2. **El plazo de aviso para terminar el contrato** (30 o 15 días, o ninguno) y la vigencia, para que las páginas de términos y el PDF digan lo mismo.
3. **Contratos ya emitidos.** Los PDF y aceptaciones anteriores conservan el texto de su fecha. Este cambio solo afecta a los contratos nuevos. Confirmar con el abogado si hay que avisar a los clientes actuales.

## 5. Despliegue (lo hace el dueño, desde un clon limpio en un tag)
- **Functions:** identificar las funciones que cargan `contrato.js` y `contacto.js` y desplegar solo esas con `--only functions:<nombre>`, nunca todo `functions` (el contrato de datos advierte de funciones desplegadas sin fuente).
- **Hosting de la web:** `--only hosting` para `contratoGravecare.js` y `contratos.html`.
- **Reversa:** volver al tag anterior y repetir el mismo despliegue. El cambio es solo de texto: no toca colecciones, campos ni reglas.

## 6. Verificación
Con el código piloto y el flujo de prueba entrando por `gravecare-2e8d2.web.app`, abrir `resumen-pago.html` de una orden nueva y comprobar que la cláusula QUINTO muestra solo `Suscripción con periodicidad "…".`, sin «renovable» ni «a contar de la confirmación…». Descargar el PDF del contrato y revisar la misma cláusula.
