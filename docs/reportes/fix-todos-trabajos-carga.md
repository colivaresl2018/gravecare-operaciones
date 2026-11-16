# Reporte — «Todos los Trabajos» quedaba en «Cargando…» para siempre

- **Rama:** `fix/todos-trabajos-import-estado` (base: `adf088c` = tag `ops-clientes-2`, lo que hoy está publicado).
- **Archivo corregido:** `public/todos-los-trabajos.html` (solo `<script>` y mensajes de error; sin cambios de diseño).
- **Datos / reglas / Storage:** sin cambios. No se escribió nada en Firebase.

## 1. Síntoma
En `https://gravecare-ops.web.app/portal.html` → «Todos los Trabajos», sesión de administrador: arriba «Cargando tareas operativas…» y en la tabla el spinner «Cargando cronograma operativo de visitas…», sin terminar.

## 2. Causa raíz (confirmada)
La página publicada **usa `estadoUnificadoVisita()` pero ya no la importa**. Al cargar la primera orden, la línea 286 lanza `ReferenceError: estadoUnificadoVisita is not defined`; el error cae en el `catch` de `cargarTrabajosActivos()`, que solo hacía `console.error(...)`, y la tabla se queda con el spinner inicial.

Cómo llegó ahí (historial de git):
- `d3499b6` y `a4f253c` (12-13 nov, ya en `ops-14`/`ops-15`) agregaron la importación `estadoUnificadoVisita` desde `./js/estado-visita-unificado.js?v=ops13` y el `?v=ops13` en las otras dos importaciones.
- `16030a0` (AUD-01, escape de HTML) se hizo desde una base anterior y reescribió ese bloque de imports.
- El merge `10f9109` («Merge origin/main (ops-15) en fix/escape-html-backoffice») resolvió el conflicto de ese bloque dejando el lado de AUD-01: **quedó el import de `html-seguro.js` pero se perdió el de `estado-visita-unificado.js` y los `?v=ops13`**, mientras el uso en la línea 286 (que venía de `main`) se conservó.
- Ese merge es el tag **`ops-16`**; el defecto pasó a `ops-clientes-1` y `ops-clientes-2` (el publicado hoy: el HTML de producción es idéntico, byte a byte, al de `adf088c`; los `.js` publicados también son idénticos al repo).
- `ops-14` y `ops-15` **no** tienen el defecto. `mis-trabajos.html` y `planificacion.html` conservaron su import (verificado en producción y en el repo).

**No** fue un problema de datos: no hay `await` colgado, ni permisos/índices, ni tipos cambiados. Revisé el recorrido de datos de la página (`titular`, `difunto`, `ubicacionSepultura`, `fechasProgramadas`, `programacionVisitas`, contratos): el titular solo pasa por `nombreClienteParaMostrar`, que ignora campos extra, así que `titular.pais` (nuevo, aditivo) o un titular sin región/comuna **no** rompen la vista. Las lecturas de `informes` y `contratos` ya estaban protegidas con `try/catch`; solo `ordenes` puede hacer fallar la carga (p. ej. permisos), y ahora eso también se avisa.

## 3. Reproducción local (emuladores, nunca producción)
Emuladores de Auth/Firestore/Storage con proyecto `demo-gravecare` y puertos desplazados (`GC_OFFSET=2300`: Firestore 10380, Auth 11399, Storage 11499, sitio 7350), reglas copiadas del repo de la web (solo lectura), 14 órdenes ficticias del sembrador. Con el código publicado (`adf088c`), prueba de navegador (Playwright) con sesión de staff de prueba:

```
error: Error al cargar trabajos: ReferenceError: estadoUnificadoVisita is not defined
    at http://localhost:7350/todos-los-trabajos.html:286:34
```
y la pantalla permanece en «Cargando cronograma operativo de visitas…» (la prueba falla a los 15 s).

## 4. Corrección (pequeña, con prueba primero)
1. Se restaura `import { estadoUnificadoVisita } from "./js/estado-visita-unificado.js?v=ops13"` y el `?v=ops13` de `servicio-terminado.js` y `nombre-cliente.js` (igual que en `ops-15`), **conservando** el import de `html-seguro.js` (AUD-01).
2. Nuevo `mostrarErrorCarga()`: si la carga falla (cualquier causa) la tabla muestra «No se pudieron cargar los trabajos.» con botón **Reintentar** y el contador pasa a «Error al cargar». Mismo patrón y estilos que ya usa `planificacion.html`. Si la consulta vuelve vacía, la página ya mostraba «No hay visitas pendientes por ejecutar en este momento.» (sin cambio).

## 5. Pruebas
- Nueva `tests/todos-trabajos-carga.test.mjs` (en rojo antes del cambio, en verde después):
  - **Guardia general:** ninguna página de `public/` puede llamar a una función exportada por `public/js/*.js` sin importarla (hoy solo detectaba `todos-los-trabajos.html`; las demás páginas están bien).
  - `todos-los-trabajos.html` importa `estadoUnificadoVisita` con `?v=ops13`, conserva `html-seguro.js`.
  - Aviso con «Reintentar» y contador «Error al cargar» cuando falla la carga.
- Nueva `tests/e2e/todos-trabajos-carga.e2e.mjs` (navegador + emuladores): la página termina de cargar y lista visitas. Falla con el código publicado; pasa con la corrección.
- `node --test tests/ public/js/` → **343 de 343 en verde**.
- E2E existente `b2-pagadas`: 14 de 16 en verde; fallan 2 de **`clientes.html`** (agrupación «un cliente por RUT» de `adf088c`: las 14 órdenes ficticias comparten el mismo RUT de prueba y se agrupan). Es previo a esta corrección (no toqué `clientes.html`) y queda como seguimiento.

## 6. Plan de despliegue (lo ejecuta el dueño)
Alcance: solo Hosting `gravecare-ops`. Este cambio parte de `ops-clientes-2`, así que conserva todo lo publicado hoy (AUD-01, clientes por RUT) y solo repara esta página.
1. Revisar y mergear la rama (PR de `fix/todos-trabajos-import-estado`; `npm test` en verde).
2. Punto de reversa: consola de Firebase → Hosting → sitio `gravecare-ops` → historial → anotar la versión vigente (ops-clientes-2) con fecha e ID.
3. Crear el tag sobre el commit integrado (nombre sugerido `ops-clientes-3`; lo decide el dueño) y desplegar desde clon limpio:
   ```powershell
   cd C:\Despliegue\GravecareOps
   git fetch --tags
   git checkout ops-clientes-3
   git status --short            # vacío
   npm test                      # opcional
   firebase deploy --only hosting:gravecare-ops --project gravecare-2e8d2
   ```
4. Verificación (administrador): `portal.html` → «Todos los Trabajos» muestra las visitas pendientes (o el mensaje de «no hay visitas pendientes») y el contador dice «Mostrando N visita(s) pendiente(s)». Los `.js` se sirven con `Cache-Control: max-age=3600`; el HTML corregido pide los módulos con `?v=ops13`, así que no depende de la caché. Recargar con Ctrl+F5 si hace falta.

## 7. Plan de reversa
- **Inmediata:** consola de Hosting → historial → «Revertir» a la versión anotada (ops-clientes-2). Ojo: esa versión **vuelve a tener el defecto** de «Todos los Trabajos».
- **Alternativa limpia:** redesplegar `ops-15` (última versión sin el defecto, pero **sin** AUD-01: vuelve a haber riesgo de XSS almacenado y sin la agrupación de clientes). Solo si hubiera un problema nuevo que justifique perder ambas cosas.
- El cambio es solo de código de una página estática: revertirlo no deja datos ni reglas por deshacer.

## 8. Seguimiento (no incluido aquí)
- `ops-16`, `ops-clientes-1` y `ops-clientes-2` tienen el defecto; si se vuelve a fusionar `main` en ramas de trabajo, revisar los bloques de `import`. La guardia nueva lo detecta en `npm test`.
- Las 2 pruebas e2e de `clientes.html` (siembra con RUT repetido) necesitan datos de prueba con RUT distintos o actualizar la expectativa.
- `planificacion.html` y `todos-los-trabajos.html` siguen usando fechas/valores por defecto en algunos casos (p. ej. inicio `2026-10-06` cuando una orden no trae fecha de inicio); no se tocó.
