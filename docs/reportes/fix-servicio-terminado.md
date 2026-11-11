REPORTE — corrección «visitas recién compradas aparecen como Completada» — 2026-11-10 — rama `fix/servicio-terminado-visitas` (base: `main` = tag `ops-3` + docs)

# Estado
Completa en código y pruebas. **Nada desplegado, nada empujado.** Pendiente: revisión del dueño, PR, merge, tag y despliegue (dueño).

## 1. Diagnóstico
Caso: `#ORD-1794358691756423-V1` y `-V2` (Plan 6) salían en `trabajos-terminados.html` como «Completada», con la fecha de la compra, «Sin asignar» y «Ver Informe» activo.

Causas (todas en el cliente; no hay escritura nueva de la web involucrada):
1. `cargarOrdenesTerminadas()` daba por terminada una visita por **tres ramas laxas**: `visitas[].estado`, el contador posicional `visitasCompletadas > 0` (generaba V1..Vn) o el `estado` global de la orden (fila «Servicio Completo»). Ninguna exigía evidencia de esa visita.
2. La **fecha de término** caía a `ultimaVisitaCompletadaFecha || fechaCompletado || actualizadoEn || creadoEl` (y `fechaEstimada`): sin fecha real se mostraba la de la compra. `formatearFecha` inventaba además «10-10-2026» si no había fecha.
3. El HTML de la fila escribía «Completada» y «Ver Informe» fijos, sin mirar si existía el informe.
4. Origen del contador: `todos-los-trabajos.html › completarVisitaIndividual` escribía `visitasCompletadas: numeroVisita` (posición, no cantidad) y marcaba `estado: completada` si `numeroVisita >= total`. Completar la V2 arrastraba la V1; completar la V6 antes que otras cerraba toda la orden.
5. `todos-los-trabajos.html` y `planificacion.html` leían ese contador (`idx < visitasCompletadasCount`) para **ocultar** visitas como hechas, y `todos-los-trabajos` ocultaba la orden entera si su estado global decía «completada».
6. `trabajos-terminados.html` no filtraba con `esOrdenPagada` (regla 11 del CLAUDE.md).

No pude ver el documento real de producción (prohibido leer/escribir datos reales); la regla nueva cubre las tres ramas, así que no depende de cuál campo concreto tenía esa orden.

## 2. Regla única de «Servicio Terminado» (`public/js/servicio-terminado.js`)
Una visita está terminada solo si cumple **ambas**:
- **Estado explícito de completada, propio de esa visita:** `estadosPorVisita.V{n}` (spec 041), `visitas[n-1].estado`, o `programacionVisitas.v_{n}.estado` (lo escribe la aprobación del informe en `informe-revision.html`). Valores: completada/completado/terminada/finalizada.
- **Evidencia real de esa visita:** su informe (`informes/{ordenId}-V{n}`, también por `ordenId`+`visitaNumero`; un informe `rechazado` no vale; el informe antiguo sin sufijo vale solo para la V1) **o** una fecha de ejecución propia (`programacionVisitas.v_{n}.fechaEjecucion`, `visitas[n-1].fechaEjecucion/fechaCompletado`).

**Nunca** se infiere de `fechaPago`, `creadoEn/creadoEl/createdAt`, `actualizadoEn/updatedAt`, `fechaEstimada`, ni de `fechaCompletado`/`ultimaVisitaCompletadaFecha` de la orden (lista fijada en `CAMPOS_FECHA_PROHIBIDOS` y en una prueba).

**Fecha mostrada:** `fechaEjecucionReal` = `informe.fechaCaptura` → `informe.createdAt` → `programacionVisitas.v_n.fechaEjecucion` → `visitas[n-1].fechaEjecucion/fechaCompletado`; si no hay ninguna, «—».

**Compatibilidad (órdenes antiguas):** el contador `visitasCompletadas` (N) y el estado global completada/finalizada se aceptan como estado **solo para visitas que además tengan su informe real** (una fecha suelta no basta: el contador no distingue cuál se hizo). Así una orden vieja con informes reales conserva lo terminado; una orden nueva con contador/estado erróneos y sin informes no aparece. Efecto a tener presente: una orden vieja con contador pero **sin** informes ya no figura como terminada y vuelve a mostrar esas visitas como pendientes.

Las visitas nuevas quedan Pendiente / Sin asignar por defecto (no hay estado ni evidencia que las adelante).

## 3. Archivos tocados
| Archivo | Cambio |
|---|---|
| `public/js/servicio-terminado.js` | **nuevo.** Regla, índice de informes, fecha real y `construirCierreVisita` |
| `public/trabajos-terminados.html` | Las tres ramas se reemplazan por la regla; filtra con `esOrdenPagada`; fecha real o «—» (ya no «10-10-2026»); «Ver Informe» solo con informe (si no, botón deshabilitado «Sin informe», mismas clases + `cursor-not-allowed`). Renombrada una variable local (`snapStaff`) |
| `public/todos-los-trabajos.html` | Lista las visitas no terminadas según la regla (sin contador ni estado global); «Completar visita» escribe **solo esa visita** |
| `public/planificacion.html` | Realizadas/pendientes según la regla (lee `informes` completo además de la consulta de aprobados de la spec 041, que no cambia); numeración de pendientes por número real |
| `public/js/servicio-terminado.test.mjs`, `tests/servicio-terminado-paginas.test.mjs` | **nuevos** |
| `tests/n80-paginas.test.mjs` | agrega `trabajos-terminados.html` a las páginas que filtran por orden pagada |

Diseño: sin cambios de estructura, clases ni colores salvo el estado deshabilitado del botón (necesario para el criterio 3).

## 4. Contrato de datos con la web
Solo cambios aditivos. «Completar visita» ahora escribe, con rutas con punto (no reemplaza mapas): `estadosPorVisita.V{n}`, `programacionVisitas.v_{n}.visitaNumero/fechaEjecucion`, `ultimaModificacion` (con `origen: 'cierre_manual'`), y mantiene `visitasCompletadas` (ahora = **cantidad** terminada, antes posición), `ultimaVisitaCompletadaFecha` y `actualizadoEn`. Al terminar todas las visitas mantiene el cierre histórico (`estado`/`estadoServicio`/`fechaCompletado`). No se renombra ni elimina ningún campo. Lectura nueva: colección `informes` completa en `todos-los-trabajos` y `planificacion` (staff ya la lee en `trabajos-terminados`).

## 5. Pruebas
| Prueba | Resultado |
|---|---|
| `node --test tests/ public/js/` | **173 / 173** (antes 140; +33) |
| Navegador contra emuladores propios (`GC_OFFSET=1500`, proyecto `demo-gravecare`, reglas publicadas de la web, datos ficticios) | ver abajo |

Criterios cubiertos: orden recién comprada de 12/6/4 visitas no aparece en terminadas; visita con estado + evidencia sí; completar V2 no arrastra V1 (escritura y lectura); `fechaPago`/`creadoEn`/`actualizadoEn`/`fechaEstimada` nunca son fecha de término; «Ver Informe» solo con informe; fecha «—» sin ejecución; compatibilidad con órdenes antiguas.

Resultado en navegador (emuladores): orden nueva Plan 6 y orden con el caso del error (contador 2 + `visitas[]` completadas + fechas de compra) → **no aparecen** en terminadas y conservan sus 6 visitas pendientes en `todos-los-trabajos` y `planificacion`; orden con V1 (estado+informe) y V2 (estado+fecha propia) → aparecen 2 filas con fecha real y «Ver Informe» solo en la V1 («Sin informe» en la V2); orden antigua con contador 2 y sus 2 informes → V1 y V2 terminadas con sus fechas. Completar la V2 de la orden nueva escribió solo la V2 (contador 1, orden sin cerrar); en terminadas apareció solo la V2 y en planificación quedaron V1 y V3–V6. **No se reejecutó** `npm run test:e2e` (B-2/B-3): requiere instalar Playwright; la parte estática de B-2 (`n80-paginas`) sí corre y pasa.

## 6. Cómo validar en localhost
Con emuladores de la web (o los de `docs/entorno-local.md`) y `GC_OFFSET` propio, p. ej. 1500:
```powershell
$env:GC_OFFSET=1500
node scripts/local/sembrar-emulador.mjs
node scripts/local/servidor-emuladores.mjs      # deja esta terminal abierta
```
Entra a `http://localhost:6550/login-ops.html` (usuario de `STAFF_PRUEBA`). Con las 14 órdenes sembradas (todas sin ejecución) `trabajos-terminados.html` debe verse **vacía** y `todos-los-trabajos.html` mostrar todas sus visitas. Para ver una terminada: «Completar» una visita en `todos-los-trabajos.html` → aparece solo esa en terminadas, con la fecha de hoy y «Sin informe».

## 7. Hallazgos fuera de alcance (no tocados)
1. **Riesgo de ingresos (previo, importante):** al completar la última visita se escribe `estado: 'completada'` sobre el `estado: 'Confirmado'` de la web. `cuentaComoIngreso` exige `estado === 'Confirmado'`, así que esa orden **deja de contar como ingreso tributario** en Gastos e ingresos. Se mantuvo el comportamiento por contrato; conviene que el PM/dueño decida si el cierre debe usar otro campo y no pisar `estado`.
2. `ordenes.html` y `mis-trabajos.html` siguen ocultando visitas con el contador posicional (solo ocultan, no marcan terminadas). Con datos erróneos podrían divergir de `planificacion`. No se tocaron porque `mis-trabajos` lo usan operadores y no se sabe si las reglas de `informes` les permiten leer; queda como siguiente paso.
3. `mapa.html` usa `programacionVisitas.v_n.estado` (explícito) y no el contador: no afectado. `clientes.html` solo muestra `visitasCompletadas` como dato.
4. `informe-captura.html` deja `programacionVisitas.v_n.estado = "en revision"` y la aprobación escribe `completada`: con la regla, una visita pasa a terminada recién al aprobar el informe (o al cerrarla a mano).

## 8. Plan de despliegue y reversa
- Despliegue (dueño, clon limpio `C:\Despliegue\GravecareOps`, tag nuevo p. ej. `ops-4` tras el merge): `firebase deploy --project gravecare-2e8d2 --only hosting:gravecare-ops`. Solo Hosting; no hay reglas ni datos que migrar.
- Después de publicar: abrir `trabajos-terminados.html` y verificar que no aparecen visitas sin ejecución; revisar `todos-los-trabajos`.
- **Reversa:** volver a publicar el tag anterior (`ops-3`) con el mismo comando. No hay datos que revertir: lo único nuevo en Firestore son los campos aditivos que escribe «Completar visita» (`estadosPorVisita`, `programacionVisitas.v_n.*`, `ultimaModificacion.origen`), que las versiones anteriores ignoran.
