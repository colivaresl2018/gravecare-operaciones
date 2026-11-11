REPORTE — Mapa de «Mis Trabajos» sin marcadores — 2026-11-10 — rama `fix/mapa-mis-trabajos` (base: `main`)

# Estado
Completa en código y pruebas (225 en verde con `node --test tests/ public/js/`). **Nada desplegado, nada empujado.** Pendiente: revisión del dueño, PR, merge, tag y despliegue (dueño).

## 1. Diagnóstico
Caso de producción: `ORD-1794318778901977-V1` (Pepito TV Solis, «Cementerio El Prado de Puente Alto», Plan 6, 1/6, Asignado). El listado lo mostraba y el mapa no tenía pines.

| Causa | Detalle |
|---|---|
| **Principal: datos/nombre** | `mis-trabajos.html` buscaba el cementerio con `CEMENTERIOS_COORDS[v.cementerio]` (coincidencia exacta, con mayúsculas y tildes) en un diccionario escrito en la página con **5 entradas** («Parque del Recuerdo Padre Hurtado», «…Américo Vespucio», «…Cordillera», «Cementerio General», «Cementerio Metropolitano»). «Cementerio El Prado de Puente Alto» no estaba → sin coordenadas → sin pin. Lo mismo para casi todos los cementerios del catálogo de la web (17). |
| Archivo huérfano | `public/js/cementeriosCoords.js` (19 cementerios) existe pero **ninguna página lo importa** (se perdió al reescribir la página) y tampoco trae El Prado con ese nombre. |
| Formato de coordenadas | La página pasaba `d.ubicacionSepultura.coordenadas \|\| d.coordenadas` tal cual a `google.maps.Marker`. `informe-captura.html` y `mapa.html` leen esas coordenadas como `{latitude, longitude}`; Google solo acepta `{lat, lng}` y falla con `InvalidValueError`, lo que además cortaba el `forEach` (todos los pines siguientes). |
| Filtro de visitas | No es la causa: el mapa usa la misma lista que la tabla (`misVisitasAsignadas`: orden pagada, visita no completada, operador coincide). |
| Sin aviso | Si no había coordenadas el mapa quedaba vacío con el texto fijo «Sin coordenadas registradas», sin explicación. |
| Error JS/Maps | En producción el mapa carga (la captura lo muestra). Si Maps falla (clave rechazada, sin red) no había ningún mensaje. |

Comparación: `mapa.html` tiene otro diccionario de 8 claves en minúsculas y usa `includes` (sí leía `{latitude, longitude}`), y mete un desplazamiento aleatorio en el pin. **No se tocó** (fuera de alcance); queda como mejora aparte usar el mismo módulo.

## 2. Corrección
- **Nuevo módulo puro `public/js/ubicacion-trabajo.js`** (+ `ubicacion-trabajo.test.mjs`): catálogo de los 17 cementerios vigentes con nombre visible y alias (copia de `docs/referencias/cementerios.json` del repo de la web, solo lectura), coincidencia sin tildes ni mayúsculas, gana el nombre más específico, los nombres genéricos («Parque Sendero») no inventan ubicación. Lee coordenadas en `{lat,lng}`, `{latitude,longitude}`, `{_lat,_long}` y textos, en `ubicacionSepultura.coordenadas`, `coordenadas`, `coordenadasGps` o `lat/lng`. Prioridad: sepultura → cementerio (aproximada) → ninguna.
- **`public/mis-trabajos.html`**: usa el módulo; un pin por lugar (agrupa las visitas del mismo lugar); naranjo = ubicación aproximada del cementerio, rojo = sepultura; al tocarlo muestra orden, difunto, cementerio y visitas pendientes. Nuevo aviso en español bajo el mapa (`#aviso-mapa`, mismos colores de la alerta ámbar del modal): explica el pin aproximado, nombra las órdenes sin ubicación y avisa si Google Maps no carga (`onerror` y `gm_authFailure`). El estado de la cabecera ahora dice «N ubicaciones en el mapa».
- Se quitó de la página el diccionario de 5 entradas (reemplazado por el catálogo). `cementeriosCoords.js` se **marcó como obsoleto** con un comentario, sin borrarlo (regla 2).
- Sin cambios de diseño más allá del aviso nuevo; no se tocó ningún dato, regla ni colección.

## 3. Pruebas
- `public/js/ubicacion-trabajo.test.mjs` (12): caso El Prado, alias, tildes, no confundir cementerios parecidos, formatos de coordenadas, agrupación, textos del aviso, HTML escapado.
- `tests/mapa-mis-trabajos-pagina.test.mjs` (6): la página usa el módulo, ya no pasa coordenadas crudas, aviso presente, y el script en línea es JavaScript válido (`node --check`).
- Navegador (emuladores de la web, `GC_OFFSET=1500`, proyecto `demo-gravecare`, nada de producción): con 4 órdenes ficticias (El Prado sin coordenadas, alias antiguo, coordenadas `{latitude,longitude}`, cementerio desconocido) la página dio «3 ubicaciones en el mapa», pines naranjo/rojo/naranjo en las posiciones esperadas, y aviso «Sin ubicación en el mapa: ORD-MAPA-SIN». Limitación: Google Maps rechaza `localhost` con la clave actual (`RefererNotAllowedMapError`), así que no se vieron teselas reales; los pines se comprobaron sustituyendo `google.maps.Marker` por un registro. El aviso «No se pudo cargar Google Maps» se vio funcionando con ese rechazo real.
- Durante la prueba apareció un error propio (un salto de línea dentro de un `join("…")` rompía el script); se corrigió y la prueba de sintaxis lo impide.

## 4. Plan de despliegue y reversa
Solo Hosting `gravecare-ops` (dueño, desde clon limpio en tag, `--project gravecare-2e8d2 --only hosting:gravecare-ops`). Archivos: `public/mis-trabajos.html`, `public/js/ubicacion-trabajo.js`, `public/js/cementeriosCoords.js` (solo comentario). Reversa: volver al tag anterior y redesplegar. Sin cambios de datos ni de reglas.

## 5. Notas para el dueño
- La clave de Google Maps está escrita en `mis-trabajos.html` (y otras páginas) desde antes de este cambio; es una clave de navegador, conviene confirmar que tiene restricción por dominio (hoy rechaza `localhost`, lo que sugiere que sí).
- Si se agrega un cementerio al catálogo de la web, hay que replicarlo en `ubicacion-trabajo.js`.
- Mejora aparte sugerida: que `mapa.html` use el mismo módulo (hoy usa un desplazamiento aleatorio y solo 8 nombres).
