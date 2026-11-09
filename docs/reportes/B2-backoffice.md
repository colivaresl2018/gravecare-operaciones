REPORTE B-2 (backoffice) — 2026-11-08 22:25 — HEAD 1751551 — rama feat/b2-pagadas

# REPORTE DE AVANCE
- **Fecha/hora:** 2026-11-08 22:25 (Chile)
- **Directriz del PM que atiendes:** B-2 (`docs/directrices/B2-backoffice-n80-n83-n192-n193.md`) y, por aprobación del dueño/PM del 2026-11-08, el resto de B-1 (`docs/directrices/B1-backoffice-piloto.md`).
- **Spec / ID de backlog:** N80 · N83 (+N9) · N192 · N193 · N62 · insignia PRUEBA (B-1)
- **Rama y commits:** `feat/b2-pagadas` (local, **sin subir**; nada desplegado). Sobre `main` `0a560ae`:
  - `d961170` merge: integra `feat/041` sobre `fix/cierre-hito1-hito2` (orden aprobado por el dueño)
  - `8fb1c07` docs(b2): CLAUDE.md del backoffice y copias de B-1 y B-2
  - `5ad728f` test(n83): firebase.json sin reglas y sin reglas en la raíz
  - `32e62be` feat(n80): ingresos y listas solo con órdenes pagadas
  - `6cc353d` fix(n192,n193): sin monto por defecto, sin clave fija, insignia PRUEBA
  - `dd95662` fix(n62): «Reportar» abre informe-captura.html con `v`
  - `769f8da` fix(n80): clientes.html filtra también el recorrido de respaldo
  - `d29dfcf` feat(b1): entorno local con emuladores y prueba de navegador
  - `1751551` docs(b1,b2): línea base, backlog, entorno local, ops-2 y verificación del sitio
- **Estado:** COMPLETA en código y pruebas. Queda pendiente la revisión del dueño, después el push de `feat/b2-pagadas`, el PR, el merge, el tag `ops-2` y el despliegue (lo hace el dueño).

## 1. Resumen
- Las 7 páginas listan y cuentan solo órdenes pagadas, con el criterio del servidor: `pagoConfirmado === true || estado === 'Confirmado'`.
- El ingreso tributario exige además `estado === 'Confirmado'`, excluye `modoPago === 'integracion'` y toma la fecha de `fechaPago`.
- `firebase.json` solo puede publicar Hosting, y una prueba lo garantiza. `planificacion` ya no inventa montos. `clientes` ya no tiene la clave fija. «Reportar» funciona y las órdenes de integración llevan la insignia «PRUEBA».
- Entorno local contra los emuladores de la web y prueba de navegador: 16/16.
- **Hallazgo importante (BO-6):** `gravecare-ops.web.app` hoy sirve una copia de la web, no este repo.

## 2. Cambios realizados (B-2/B-1, sobre la integración `d961170`)
| Archivo | Tipo | Qué cambió | +/- |
|---|---|---|---|
| `public/js/orden-pagada.js` | nuevo | `esOrdenPagada`, `esOrdenDePrueba`, `cuentaComoIngreso`, `fechaDelIngreso`, `INSIGNIA_PRUEBA` | +42 |
| `public/gastos-ingresos.html` | mod. | Ingreso solo con `cuentaComoIngreso(ord)`; fecha de `fechaDelIngreso(ord)` | +4/-2 |
| `public/ordenes.html`, `todos-los-trabajos.html`, `mis-trabajos.html`, `mapa.html` | mod. | Filtro `esOrdenPagada` antes de listar; `esPrueba` + insignia | ~+4/-1 c/u |
| `public/planificacion.html` | mod. | Filtro + insignia; N192: `montoPagado` sin 259960 y «—» si falta | +5/-4 |
| `public/clientes.html` | mod. | Filtro en los 2 recorridos de órdenes; N193: se retira la clave y «Borrar» solo muestra un aviso | +6/-23 |
| `public/mis-trabajos.html` | mod. | N62: `informe-captura.html?ordenId=…&v=…` | +1/-1 |
| `tests/*.test.mjs` (6 archivos) | nuevos | N83, N80 (unitarias y estáticas), N62, N192/N193/PRUEBA, entorno local | +309 |
| `tests/e2e/b2-pagadas.e2e.mjs` | nuevo | Navegador (Playwright) contra emuladores | +108 |
| `scripts/local/*.mjs` | nuevos | Servidor local con envoltorios del SDK y siembra de datos ficticios | +245 |
| `scripts/verificar-sitio-publicado.mjs` | nuevo | Compara `public/` de un tag con lo publicado (solo GET) | +33 |
| `package.json`, `package-lock.json` | nuevos | Scripts `test`, `test:e2e`, `local:*`; Playwright como dependencia de desarrollo | +57 |
| `CLAUDE.md`, `docs/…` | nuevos | Kit del repo, directrices, línea base, backlog, entorno local, `publicar-ops-2.md`, este reporte | — |

Diff completo de `public/` en la carpeta de notas de la sesión (`B2-diff-public.diff`, con la clave antigua redactada).

## 3. Evidencia
- `npm test` (`node --test tests/ public/js/`) → **105 pasan / 0 fallan**. Incluye las 13 de B-13/B-18 y las 44 de la spec 041 que traían las ramas integradas.
- `GC_OFFSET=800 npm run test:e2e` → **16 pasan / 0 fallan**:
  - Las 6 listas no muestran las órdenes sin pago (2 `iniciada`, `cancelado`, `rechazado`, `vencida`, `monto_inconsistente`).
  - El ingreso suma solo las 5 `Confirmado` de producción. No suma el Oneclick inscrito, la de integración ni la orden sin monto.
  - La insignia PRUEBA aparece solo en la orden de integración.
  - N192 muestra «—»; N193 muestra solo un aviso, sin `prompt`; N62 genera un `href` correcto.
  - Ninguna petición salió a servicios reales de Firebase.
- **Pruebas negativas:**
  - La prueba de N83, sobre una copia con `storage` en `firebase.json` y un `firestore.rules` en la raíz, falla 3 de 5 casos (lo esperado).
  - La prueba estática de N80 falla sin el arreglo de `769f8da`.
- La prueba de navegador **encontró un fallo real**: `clientes.html` tenía un segundo recorrido de órdenes sin filtro, que se usa cuando la colección `clientes` está vacía. Quedó corregido en `769f8da`.
- Sintaxis: 16 scripts inline de `public/*.html` revisados con `node --check`, sin errores.
- **Diff visual:** 0 cambios fuera de `<script>`. Los textos visibles nuevos son la insignia «PRUEBA» (B-1), «—» (N192) y el aviso de borrado deshabilitado (N193), todos dentro de plantillas JS y autorizados por las directrices.
- Seguridad:
  - `gitleaks git --redact` sobre los 8 commits de B-2: sin filtraciones.
  - Sin archivos sensibles por nombre en el rango.
  - `npm audit`: 0 vulnerabilidades.

## 4. Validación en localhost
- Emuladores Auth/Firestore/Storage (`demo-gravecare`, +800) con **copias de las reglas publicadas** (`docs/ventana-cierre-2` de la web), siembra de 14 órdenes ficticias y servidor del backoffice en `http://localhost:5850/login-ops.html`. Usuario de prueba: `STAFF_PRUEBA` en `scripts/local/sembrar-emulador.mjs`, que solo existe en el emulador.
- Para el dueño con sus propios emuladores (`npm run local` de la web, sin desplazamiento): ver `docs/entorno-local.md` y abrir `http://localhost:5050/login-ops.html`.
- **Sin probar:**
  - El despliegue real.
  - Las páginas fuera de B-2: `informe-*`, `admin-usuarios`, `trabajos-terminados`.
  - La subida de comprobantes a Storage.
  - `npm run local` de la carpeta de trabajo de la web: se niega a arrancar porque ahí existe `functions/.env` (N67/N120; se revisó solo el nombre, no se leyó). Por eso se usaron emuladores sin funciones desde una carpeta temporal.

## 5. Instalaciones realizadas
| Paquete | Versión | Motivo | Dev o producción |
|---|---|---|---|
| `playwright` | 1.64.1 (la misma de la web) | Prueba de navegador `tests/e2e/` | Desarrollo (no se publica: `public/` no lo usa) |

## 6. Riesgos y cómo revertir
- **Riesgos:**
  - Una orden pagada con un estado distinto de `Confirmado` y sin `pagoConfirmado` dejaría de verse. En producción las 7 órdenes son del flujo actual, así que hoy no aplica.
  - Una orden Oneclick inscrita sin cobro se ve como trabajo y no como ingreso (decisión de B-2).
- **Rollback del código:** `git revert` de los commits de B-2, o no integrar el PR.
- **Rollback del sitio:** historial de Hosting de `gravecare-ops` (`docs/entregas/publicar-ops-2.md` §3). No afecta datos ni reglas.

## 7. Hallazgos nuevos (ID provisional; la web asigna `N-xx`)
| ID | Hallazgo | Severidad | Evidencia |
|---|---|---|---|
| BO-6 | `https://gravecare-ops.web.app` sirve una copia del `public/` de la **web**: `login-ops.html` e `index.html` idénticos por huella a la web; `/` no reescribe; 21 de 28 páginas del backoffice dan 404. El primer `ops-2` reemplazará ese contenido | Media | `node scripts/verificar-sitio-publicado.mjs main` |
| BO-1 | Las pruebas `public/js/*.test.mjs` de la spec 041 se publican en Hosting | Baja | `firebase.json` `hosting.ignore` |
| BO-2 | `public/gastosIngresos.js` y `public/js/gastosIngresos.js` no se usan y calculan ingresos sin filtro de pago | Baja | Ninguna página los importa |
| BO-3 | `trabajos-terminados.html` lee órdenes sin filtro de pago (fuera de las 7 de B-2) | Baja | `:247` |
| BO-4 | `planificacion.html` rellena datos ausentes con nombres y un cementerio inventados | Media | `extraerTexto(…, "Felipe Toledo Toledo")` |
| BO-5 | Versiones mezcladas del SDK de Firebase (10.7.0 y 10.12.0) | Baja | `grep gstatic` |
| BO-7 | La clave fija retirada (N193) sigue en el historial de git. No era una credencial real | Info | — |
| (web) | `C:\Proyectos\Gravecare\functions\.env` existe en la carpeta de trabajo de la web (N120). Se detectó solo por nombre, mediante el lanzador | — | Mensaje de `npm run local` |

## 8. Decisiones que necesito del dueño/PM
1. Revisar los commits y el diff, y autorizar el **push de `feat/b2-pagadas`** y el PR a `main`. Ojo: el push sube también los commits de `fix/cierre-hito1-hito2` y `feat/041`, que vienen en la historia.
2. **BO-6:** confirmar dónde opera hoy el staff antes de publicar `ops-2`, porque reemplaza lo que sirve `gravecare-ops`.
3. `.firebaserc` sin confirmar del árbol: para poder cambiar de rama se respaldó fuera del repo y se descartó del árbol. Era idéntico (mismo blob) al de `98632e7`, que ya está en la rama: no se perdió nada.

## 9. Estado del backlog
- N80, N83 (con N9), N192, N193 y N62 pasan a **Hecho en rama** (`feat/b2-pagadas`); pasan a **Cerrado** al publicar `ops-2` y verificar.
- N57 sigue **Pendiente**.
- B-1 queda completa:
  - línea base;
  - N9/N83;
  - N62;
  - N80 con PRUEBA;
  - entorno local y pruebas;
  - backlog;
  - release: `ops-1` queda reemplazado por `ops-2`.

## 10. Siguiente paso propuesto
Revisión del dueño → push de `feat/b2-pagadas` y PR → merge → tag `ops-2` → despliegue desde `C:\Despliegue\GravecareOps` según `docs/entregas/publicar-ops-2.md` → `verificar-sitio-publicado.mjs ops-2`.

---
### Resumen para pegar en el reporte de la web (cierre de N80, N83, N192 y N193)
> **Backoffice B-2** (`gravecare-operaciones`, rama `feat/b2-pagadas`, HEAD `1751551`, sin subir ni publicar):
> - **N80:** `public/js/orden-pagada.js` (criterio de `functions/sepultura-pago.js:14`) aplicado en ordenes, mis-trabajos, todos-los-trabajos, mapa, planificacion y clientes (2 recorridos). El ingreso de gastos-ingresos exige `estado === 'Confirmado'`, excluye `modoPago === 'integracion'` y usa `fechaPago`.
> - **N83:** `firebase.json` solo tiene `hosting` (`site: gravecare-ops`), las reglas están en `legacy/` y `.firebaserc` no tiene `default`. `tests/firebase-json-sin-reglas.test.mjs` falla si vuelven.
> - **N192:** sin 259960; muestra «—».
> - **N193:** la clave fija salió del front y «Borrar» solo avisa.
> - **Extras B-1:** N62 y la insignia PRUEBA.
> - **Pruebas:** `npm test` 105/105. E2E contra emuladores (`demo-gravecare`, reglas publicadas) 16/16, con el escenario de producción: 5 `Confirmado` suman y 2 `iniciada` no aparecen.
> - **Para cerrar:** pasan a *Hecho en rama*; se cierran al publicar `ops-2` (Hosting `gravecare-ops`, lo hace el dueño).
> - **Hallazgo BO-6:** `gravecare-ops.web.app` hoy sirve una copia del `public/` de la web.
