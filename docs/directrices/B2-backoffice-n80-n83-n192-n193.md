# DIRECTRIZ DEL PM B-2 (proyecto del BACKOFFICE) — Ingresos y listas solo con órdenes pagadas, reglas fuera del despliegue y dos arreglos menores

> **Aprobada por el PM el 2026-11-08** sobre `docs/entregas/n80-n83-revision-backoffice.md` (repo `gravecare`, rama `docs/ventana-cierre-2`). La guardó el ejecutor de la web (regla 14 de su CLAUDE.md).
>
> **Dónde se ejecuta:** en una sesión de Claude Code abierta en `C:\Proyectos\GravecareOpsPortal`, **no** en la sesión de la web. El CLAUDE.md de la web prohíbe modificar el repo del backoffice desde allí (regla de oro 9), y B-1 ya estableció esta práctica. Si el repo del backoffice aún no tiene `CLAUDE.md`, se crea primero con el resumen de B-1.

## Antes de empezar (solo lectura; reportarlo al inicio)
1. **Hay dos ramas locales sin subir que tocan lo mismo:**
   - `fix/cierre-hito1-hito2` (worktree `C:\Proyectos\GravecareOps-cierre`, `98632e7`, 2026-11-07) ya tiene B-18 y B-20, que **resuelven casi todo N83**:
     - reglas movidas a `legacy/reglas-deprecadas/`;
     - `firebase.json` solo con `hosting`;
     - `.firebaserc` sin proyecto por defecto (`prod` y `qa`).
     Tiene además B-13, el claim en 6 páginas.
   - `feat/041-estados-y-filtros-operaciones` (`6730620`) toca `ordenes.html` y `planificacion.html`.
   - Proponer al dueño el orden de integración. El recomendado es: `fix/cierre-hito1-hito2` primero, después `feat/041`, y sobre eso una rama nueva `feat/b2-pagadas` para esta directriz.
   - **No integrar sin su aprobación.**
2. La rama local `wip/operaciones-2026-11-06` (`51ee1aa`) tiene un `storage.rules` peligroso: abre `comprobantes_tributarios`, sin sesión, y trae una lista de correos. **No subirla ni integrarla**; si se necesita algo de ella, se rescata por archivo.
3. Confirmar que `.firebaserc` sin confirmar en `C:\Proyectos\GravecareOpsPortal` es el mismo cambio de `98632e7`. Si lo es, se descarta en el árbol solo con aprobación del dueño, porque ya está versionado en la rama.

## Hacer
1. **N83 (prioridad 1):**
   - Partir de lo que ya hace `fix/cierre-hito1-hito2`.
   - Agregar una prueba (`tests/firebase-json-sin-reglas.test.mjs`, con `node --test`) que falle si `firebase.json` contiene `firestore`, `storage` o `database`, o si en la raíz aparece un `firestore.rules` o `storage.rules`.
   - Ejecutar la prueba en el CI del repo si existe; si no, documentar el comando.
   - El despliegue del backoffice es **solo** de Hosting del sitio `gravecare-ops` (ver «Despliegue»).
2. **N80 (bloqueante comercial):**
   - Crear el módulo `public/js/orden-pagada.js` con `esOrdenPagada(orden)` = `orden.pagoConfirmado === true || orden.estado === 'Confirmado'` (el mismo criterio del servidor: `functions/sepultura-pago.js:14` de la web), con pruebas unitarias.
   - Aplicarlo antes de contar o listar en las 7 páginas: `gastos-ingresos`, `ordenes`, `mis-trabajos`, `todos-los-trabajos`, `mapa`, `planificacion` y `clientes`.
   - **Ingreso tributario** (`gastos-ingresos.html`):
     - Exigir además `estado === 'Confirmado'`, por la salvedad Oneclick C2: `confirmarInscripcionOneclick` marca `pagoConfirmado` sin cobrar.
     - Mantener la regla de B-1 de no sumar órdenes de prueba (`modoPago === 'integracion'`).
     - Fecha desde `fechaPago` cuando exista.
3. **N192:** `planificacion.html:567`, sin el monto por defecto `259960`; si no hay monto, mostrar «—».
4. **N193:** `clientes.html:486-500`, retirar la clave fija del front. Como el borrado de `clientes/{id}` hoy está bloqueado por las reglas publicadas, ocultar la acción o dejarla con un aviso claro con los componentes de alerta existentes. Un borrado real necesita su propia spec con regla para staff con claim.

## Criterios de aceptación
- Con datos como los de producción al 2026-11-08 (7 órdenes: 5 `Confirmado` con `pagoConfirmado: true` y 2 `iniciada` con monto), el ingreso suma solo las 5 y ninguna lista de trabajo muestra las 2 `iniciada`.
- Una orden `cancelado`, `rechazado`, `vencida` o `monto_inconsistente` no aparece como ingreso ni como trabajo.
- Una orden Oneclick con `pagoConfirmado: true` y sin `estado: 'Confirmado'` no se suma como ingreso.
- `planificacion` no muestra `259960` cuando falta el monto, y `clientes.html` no contiene una clave en el código.
- La prueba de `firebase.json` pasa. `firebase deploy --only firestore:rules` o `--only storage` desde este repo falla porque no hay configuración.

## Restricciones
- Contrato de datos con la web: solo **lectura** de campos existentes (`pagoConfirmado`, `estado`, `motivoSinPago`, `fechaPago`, `modoPago`). No se renombra ni se escribe nada nuevo y no se tocan reglas.
- No cambiar diseño, textos ni colores existentes. Los textos nuevos van en español, con los componentes existentes.
- No tocar los datos de `staff`, `gastos_ingresos` ni `comprobantes_tributarios`.
- Commits por nombre. Push solo de la rama de trabajo; nunca `main` ni `--force`.
- Pruebas en local con los emuladores de la web (puertos desplazados), nunca producción.

## Despliegue (lo ejecuta el dueño, después de integrar y crear el tag `ops-2`)
Hoy **no existe** un clon de despliegue del backoffice en `C:\Despliegue`, y el repo no tiene tags. El primer despliegue crea el clon:
```powershell
git clone https://github.com/colivaresl2018/gravecare-operaciones.git C:\Despliegue\GravecareOps
cd C:\Despliegue\GravecareOps
git checkout ops-2
git status --short                      # vacío
firebase hosting:sites:list --project gravecare-2e8d2   # debe existir gravecare-ops
firebase deploy --only hosting:gravecare-ops --project gravecare-2e8d2
```
`firebase.json` (en `fix/cierre-hito1-hito2`) declara `"site": "gravecare-ops"`, por eso el objetivo es `hosting:gravecare-ops`. El target `operaciones` de `.firebaserc` solo sirve si `firebase.json` usa `"target"`; la sesión del backoffice debe confirmarlo antes de entregar el comando final.
- **Antes:** anotar la versión publicada vigente de `gravecare-ops` (consola de Hosting) como punto de reversa.
- **Después:** verificar por lectura que las páginas publicadas coinciden con el tag.
- **Reversa:** historial de versiones de Hosting del sitio `gravecare-ops`.

## Reporte
`docs/reportes/B2-backoffice.md` en el repo del backoffice, con el formato del protocolo de la web. Copiar el resumen al reporte de la web para cerrar N80, N83, N192 y N193.
