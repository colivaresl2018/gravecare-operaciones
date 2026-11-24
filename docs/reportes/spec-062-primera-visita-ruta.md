# Spec 062 · Parte B — primera visita según el día de ruta (backoffice)

**Fecha:** 2026-11-24 · **Rama:** `feat/062-primera-visita-ruta` (desde `origin/main`, commit `8d68264`) · **Estado:** listo para revisión (PR a `main`). **No desplegado**: el despliegue del Hosting `gravecare-ops` lo ejecuta el dueño.
**Directriz aprobada (spec):** `docs/entregas/spec-backoffice-primera-visita.md` del repo web, rama `integracion/cierre-2` (aprobada por el dueño el 2026-11-23). Spec madre: `specs/062-backoffice-primera-visita-segun-ruta/spec.md`; campo documentado en `docs/10-contrato-de-datos.md`, sección «Spec 062».

## Qué se hizo
1. **Lectura de la primera visita.** `public/js/fechas-tentativas.js` lee `ordenes/{id}.primeraVisitaTentativa` con la función nueva `primeraVisitaGuardada`:
   - `fecha: 'AAAA-MM-DD'` → V1 tentativa = esa fecha a mediodía local.
   - `fecha: null` → V1 y todas las siguientes quedan **sin fecha** (la pantalla ya muestra «Sin fecha» cuando no hay fecha).
   - Cualquier otra forma (campo ausente, sin `fecha`, tipo raro, fecha imposible o mal escrita) → se trata como orden **sin** el campo: cálculo de siempre.
2. **Visitas siguientes.** Vn = `sumarMeses(V1, (n − 1) × intervalo)` con el intervalo de hoy (12 → 1 mes, 6 → 2, 4 → 3), sin ajustar a día de ruta ni feriados. Spot no usa el campo. La fecha real (`fechasPorVisita.*`) sigue mandando siempre.
3. **Una sola función.** Órdenes de Servicio, Planificación y Planificación Planes y Spot ya pasaban por `fechaVisitaConOrigen`; no se cambió su lógica. Solo se subió el import a `?v=pv062` en las tres para que el navegador no use una copia vieja en caché y todas muestren la misma fecha.
4. **Región en «Rutas y feriados».** Campo **opcional** `region` (lista cerrada de 16 nombres cortos, copia de `nombreCorto` de `docs/referencias/regiones-comunas-chile.json` del repo web):
   - Rutas: selector «Región (opcional)» en «Asignar eje y día»; «Editar» lo precarga; se guarda con el mismo `merge`, sin tocar `diaSemana`, `eje` ni `cementerio`. Si se deja vacío no se escribe el campo (no pisa la región que ya tenía). La región se ve bajo el nombre del cementerio en la tabla.
   - Feriados: selector de región que **solo aparece** si el alcance es «Regional»; es obligatorio en ese caso. Con «Nacional» no se pide ni se guarda. La lista pegada admite una 4.ª columna con la región (`fecha | nombre | regional | Región Metropolitana`). La tabla muestra «Regional · <región>».
   - Los documentos anteriores sin `region` se leen igual.

## Lo que NO se hizo (a propósito)
Ningún cálculo de días hábiles/rutas/feriados en el navegador; el backoffice **no escribe** `primeraVisitaTentativa`; no se tocó el repo de la web, `firestore.rules`, `storage.rules` ni `firebase.json`; permisos sin cambios (rutas: dueño; feriados: administrador).

## Decisiones mías (a revisar)
1. **Cambio de comportamiento en la lista pegada:** una línea con alcance «regional» **sin región** ahora se rechaza con su número de línea (exigido por CA7). Antes se aceptaba. Se actualizaron 3 pruebas antiguas que usaban regionales sin región.
2. **Región vacía en rutas = «no cambiar»** (el selector dice «Sin cambiar»): así asignar eje/día a muchos cementerios no borra regiones ya cargadas. No hay forma de «quitar» una región desde la pantalla (aditivo, regla 9).
3. **Un feriado que pasa de regional a nacional conserva su `region` guardada** (el documento no se reescribe con campos ausentes; la función solo la lee si es regional).
4. **Hora de V1 = 12:00 y de V2+ = 10:00** (V2+ salen de `sumarMeses`, que ya fijaba las 10:00). Solo cambia la hora, nunca el día mostrado.
5. **Versiones de caché:** `config-planificacion.js` → `cfg5`, `config-planificacion-db.js` → `cfg2`, `config-vistas.js` → `cfg3`, también en los imports internos, para que una copia vieja de un módulo no descarte la región en silencio.

## Archivos
- **Modificados:** `public/js/fechas-tentativas.js`, `public/js/config-planificacion.js`, `config-planificacion-db.js`, `config-vistas.js`, `public/rutas-feriados.html`, `public/ordenes.html` y `public/planificacion.html` (solo la versión del import), `public/js/planificacion-servicios.js` (solo la versión del import).
- **Pruebas:** `tests/fechas-tentativas.test.mjs` (CA1–CA6, CA9), `tests/region-rutas-feriados.test.mjs` (nuevo; CA7, CA8 y región), ajustes en `public/js/config-planificacion.test.mjs`, `config-planificacion-db.test.mjs`, `tests/rutas-feriados-pagina.test.mjs` y `tests/planificacion-servicios-paginas.test.mjs`.
- **Nuevo:** este reporte.

## Criterios de aceptación
| CA | Cubierto por |
|---|---|
| CA1, CA2 | `fechas-tentativas.test.mjs` (Plan 12/6/4 con V1 = 2026-11-25) |
| CA3 | `fecha: null` en los tres planes |
| CA4 | orden sin el campo = cálculo de hoy |
| CA5 | fecha real gana; Spot sin cambios |
| CA6 | las tres pantallas importan la misma función y ninguna lee el campo por su cuenta |
| CA7 | `region-rutas-feriados.test.mjs`: regional exige región; nacional no la pide ni la guarda |
| CA8 | región con `merge` sin tocar `diaSemana`/`eje`/`cementerio`; documentos sin región se leen |
| CA9 | 10 formas inesperadas → cálculo anterior |

## Pruebas
`node --test tests/ public/js/` → **873 pasan, 0 fallan**. Las pruebas nuevas se vieron primero en rojo. El script en línea de `rutas-feriados.html` se verificó con `node --check`.
**No se probó:** la pantalla en un navegador (ni con emuladores ni con datos reales), ni con una orden real que traiga `primeraVisitaTentativa` (la función del servidor aún no está publicada).

## Plan de despliegue (lo ejecuta el dueño)
1. Tag de este PR ya fusionado y despliegue desde un clon limpio (`C:\Despliegue\GravecareOps`): `firebase deploy --project gravecare-2e8d2 --only hosting:gravecare-ops`.
2. Cargar `region` en cada ruta («Rutas y feriados» → «Asignar eje y día») y en cada feriado regional.
3. En el repo web: `scripts/comparar-rutas-catalogo.mjs` hasta «Sin problemas».
4. Publicar `calcularPrimeraVisitaAlPagar` por nombre (`docs/entregas/publicar-funcion-062.md`).
Mientras la función no esté publicada, ninguna orden trae el campo y nada cambia en las fechas.

## Cómo verlo
- **Región:** entrar a «Rutas y feriados» como dueño → «Asignar eje y día»: aparece «Región (opcional)». Como administrador → pestaña «Feriados»: elegir alcance «Regional» muestra «Región del feriado»; con «Nacional» se oculta.
- **Fechas:** con una orden de prueba (solo en emuladores) que tenga `primeraVisitaTentativa: { version: 1, fecha: '2026-11-25', motivo: 'calculada', diaRuta: 3, calculadaEn: '…' }`, V1 debe verse 25/11/2026 y, en un Plan 12, V2 25/12/2026.

## Reversa
Revertir el commit y publicar el Hosting. Los campos `region` ya guardados no estorban (el backoffice anterior los ignora).
