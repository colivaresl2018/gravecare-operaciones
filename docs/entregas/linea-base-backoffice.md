# Línea base del backoffice (directriz B-1, paso 1) — 2026-11-08

> Solo lectura, sobre la rama `feat/b2-pagadas` (= `main` `0a560ae` + `fix/cierre-hito1-hito2` + `feat/041` + B-2). Sin correos, RUT ni secretos.

## 1. Estructura
| Carpeta / archivo | Qué es | ¿Se publica? |
|---|---|---|
| `public/` | Páginas HTML estáticas (Tailwind CDN, SDK Firebase 10.7.0 y 10.12.0 desde gstatic) | **Sí** (Hosting `gravecare-ops`) |
| `public/js/` | Módulos: `entorno.js` (config por host), `acceso-staff.js` (claim `staffActivo`), `orden-pagada.js` (B-2), `estados-visita*.js` y `fechas-visita.js` (spec 041), otros heredados | Sí (incluidas las `*.test.mjs` de la 041: ver hallazgo BO-1) |
| `tests/` | Pruebas `node --test` (estáticas y unitarias) + `tests/e2e/` (navegador, Playwright) | No |
| `scripts/local/` | Entorno local contra los emuladores de la web (B-1) | No |
| `scripts/crear-staff-qa.js`, `fix.js`, `generar-archivos.js` | Scripts heredados (no revisados ni ejecutados) | No |
| `legacy/reglas-deprecadas/` | Copias antiguas de `firestore.rules` y `storage.rules` (B-18), con LEEME | No |
| `firebase.json` | **Solo `hosting`** (`site: gravecare-ops`, `public: public`, reescrituras `/` y `/login.html` → `/login-ops.html`) | — |
| `.firebaserc` | `prod` → `gravecare-2e8d2`, `qa` → `gravecare-qa`, **sin `default`**; target `operaciones` → `gravecare-ops` (no se usa: `firebase.json` declara `site`) | — |

## 2. Páginas y colecciones (lectura / escritura)
| Página | Lee | Escribe | Filtro de pago (B-2) |
|---|---|---|---|
| `login-ops.html` | Auth | — | — |
| `portal.html` | — (marco con iframes de los módulos) | — | — |
| `ordenes.html` | `ordenes`, `staff` | `ordenes` (estadosPorVisita, operador) | `esOrdenPagada` + PRUEBA |
| `planificacion.html` | `ordenes`, `informes` (aprobados), `staff` | `ordenes` (fechas/estados por visita) | `esOrdenPagada` + PRUEBA + N192 |
| `todos-los-trabajos.html` | `ordenes` | `ordenes` | `esOrdenPagada` + PRUEBA |
| `mis-trabajos.html` | `ordenes`, `staff` | — | `esOrdenPagada` + PRUEBA (+ N62) |
| `mapa.html` | `ordenes` | — | `esOrdenPagada` + PRUEBA |
| `clientes.html` | `ordenes`, `clientes` | — (borrado retirado, N193) | `esOrdenPagada` (2 recorridos) |
| `gastos-ingresos.html` | `gastos_ingresos`, `ordenes`; Storage `comprobantes_tributarios` | `gastos_ingresos`, Storage | `cuentaComoIngreso` + `fechaDelIngreso` |
| `informe-captura.html` | `ordenes/{id}` | `informes`, `ordenes/{id}` | — (abre una orden por id) |
| `informe-revision.html` | `informes`, `ordenes/{id}` | `informes`, `ordenes/{id}` (programacionVisitas) | — |
| `trabajos-terminados.html` | `ordenes`, `informes`, `staff` | — | **sin filtro** (fuera de B-2; ver BO-3) |
| `admin-usuarios.html` | `staff` | `staff` | — |

Campos de pago que se leen (contrato de datos, solo lectura): `pagoConfirmado`, `estado`, `modoPago`, `fechaPago`. `motivoSinPago` no se muestra todavía (vista «Órdenes sin pago» opcional, no hecha).

## 3. Destino de Hosting
- `firebase.json`: `"site": "gravecare-ops"` → objetivo `hosting:gravecare-ops`.
- **Lo publicado hoy en `https://gravecare-ops.web.app` NO es este repo** (lectura del 2026-11-08 con `scripts/verificar-sitio-publicado.mjs main`): `login-ops.html` e `index.html` son idénticos a los del repo de la **web**, `/` no reescribe a `login-ops.html`, y 21 de 28 archivos de `public/` (portal, órdenes, planificación…) responden 404. Ver BO-6.

## 4. Pruebas que existen
| Comando | Qué cubre | Resultado (2026-11-08) |
|---|---|---|
| `npm test` (`node --test tests/ public/js/`) | Acceso staff (B-13), reglas fuera del despliegue (N83), N80, N62, N192, N193, PRUEBA, entorno local, spec 041 | 105/105 |
| `npm run test:e2e` | Navegador contra emuladores (`docs/entorno-local.md`) | 16/16 |
