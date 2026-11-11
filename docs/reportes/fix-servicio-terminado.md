REPORTE — «Servicio Terminado» estricto y nombre del cliente — 2026-11-10 — rama `fix/servicio-terminado-visitas` (base: `main` = `ops-3` + docs)

# Estado
Completa en código y pruebas. **Nada desplegado, nada empujado.** Pendiente: revisión del dueño, PR, merge, tag y despliegue (dueño). Incluye dos encargos: (A) visitas recién compradas como «Completada», ampliado con la regla de tres condiciones; (B) columna Cliente/Titular que mostraba solo «Cliente».

## 1. Diagnóstico exacto (líneas en `main` antes del cambio)

### Bug A — visitas sin ejecutar aparecen como «Completada»
| Dónde | Qué pasaba |
|---|---|
| `public/trabajos-terminados.html:272` | Rama (a): `visitas[].estado` completada/completado/terminada bastaba, sin operador ni informe |
| `…:297-321` | Rama (b): `Number(d.visitasCompletadas) > 0` fabricaba V1..Vn (contador posicional); fecha = `ultimaVisitaCompletadaFecha \|\| fechaCompletado \|\| actualizadoEn \|\| creadoEl` (:319) |
| `…:322-341` | Rama (c): `estado`/`estadoServicio` global completada/finalizada fabricaba «Servicio Completo» (fecha :340 `… \|\| actualizadoEn \|\| creadoEl`) |
| `…:293` | Rama (a): fecha `v.fechaEjecucion \|\| v.fechaCompletado \|\| v.fechaEstimada \|\| d.actualizadoEn \|\| d.creadoEl` → la fecha de compra |
| `…:203` | `formatearFecha` devolvía «10-10-2026» inventado cuando no había fecha |
| `…:496`, `…:509` | «Completada» y «Ver Informe» fijos en la fila, sin mirar evidencia |
| `…` (todo el `forEach` de órdenes) | No filtraba con `esOrdenPagada` (regla 11 del CLAUDE.md) |
| `public/todos-los-trabajos.html:303-306` | `completarVisitaIndividual` escribía `visitasCompletadas: numeroVisita` (posición): completar la V2 arrastraba la V1; `numeroVisita >= total` cerraba la orden aunque faltaran visitas |
| `public/todos-los-trabajos.html:250` y `public/ordenes.html:337` | `idx < visitasCompletadasCount`: ocultaban visitas por posición; `todos-los-trabajos` además ocultaba la orden entera si su `estado` decía completada |
| `public/planificacion.html:518` | `cantRealizadas` desde `visitasCompletadas` y numeración correlativa tras ese conteo |
| `public/ordenes.html:403` | Una visita con `estadosPorVisita` = completada se quitaba de la lista aunque no tuviera operador ni informe (desaparecía de todas las pantallas) |

Casos reportados (`#ORD-1794358691756423-V1/-V2`, `#ORD-1794357459960709-V1`): no pude ver los documentos reales (prohibido leer/escribir producción). Cualquiera de las tres ramas explicaba la fila, y la fecha 10-11-2026 era la de compra/actualización; la regla nueva cubre todas.

### Bug B — «Cliente» en lugar del nombre
| Dónde | Qué pasaba |
|---|---|
| `public/trabajos-terminados.html:257`, `public/todos-los-trabajos.html:196`, `public/ordenes.html:277` | `tit = d.titular \|\| d; nomCliente = tit.nombreCompleto \|\| tit.nombreCliente \|\| d.clienteNombre \|\| d.usuario \|\| "Cliente"`. Con un `titular` que trae `nombre`, o `nombres + apellidoPaterno + apellidoMaterno`, ninguna alternativa existía y salía «Cliente» (si había `titular`, no se miraba la raíz de la orden) |
| `public/planificacion.html:393-404, 499` | `extraerTexto` no cubría `apellidoMaterno` ni `comprador`, y su respaldo era un nombre inventado («Felipe Toledo Toledo») |

## 2. Regla única de «Servicio Terminado» (`public/js/servicio-terminado.js`)
Una visita está terminada solo si cumple **las tres**:
1. **Operador válido:** no vacío ni «Sin asignar». Se toma, en orden, del informe, de la visita (`visitas[n-1]`, `programacionVisitas.v_n`), de `operadoresPorVisita.V{n}` y por último del operador de la orden.
2. **Evidencia real de esa visita:** su informe con contenido (fotos, `informeUrl`, `reporteFotografico`, o `estado` aprobado) o evidencia propia en la visita (`fotos`, `fotosDespues`, `evidencia`, `informeUrl`, `reporteFotografico`, `informeAprobado === true`). Un informe rechazado o vacío no cuenta.
3. **Estado explícito de finalizada de esa visita:** `estadosPorVisita.V{n}`, `visitas[n-1].estado/estadoOperativo` o `programacionVisitas.v_n.estado/estadoOperativo` (completada/completado/terminada/finalizada/aprobado). **Nunca** `orden.estado` («Confirmado», «pagado», «aprobado», «completada») ni `pagoConfirmado`.

**Fecha ejecutada:** solo `fechaEjecucion`, `fechaRealizada`, `fechaTermino`, `fechaInforme` de la visita o del informe, más `fechaCaptura`/`createdAt` del informe (cuándo se capturó: es el único campo de fecha que escribe `informe-captura.html`, por eso se incluyó); si no hay, «—». Nunca `fechaPago`, `creadoEn/creadoEl`, `actualizadoEn` ni `fechaEstimada`.

**Compatibilidad (órdenes antiguas):** el contador `visitasCompletadas` (N) cuenta como estado de las visitas 1..N solo si cada una además cumple operador + evidencia. El **estado global ya no cuenta** (cambio respecto a la primera entrega, por la regla más estricta). Una orden vieja con contador pero sin informes ya no figura como terminada y sus visitas vuelven a pendientes.

**Decisiones de interpretación a validar con el dueño:** (a) el operador de la orden (campo global) vale como respaldo del de la visita; (b) `informeAprobado === true` solo se acepta a nivel de visita (a nivel de orden no se sabe a cuál visita pertenece); (c) el contador histórico se mantiene como estado solo con operador y evidencia.

## 3. Nombre del cliente (`public/js/nombre-cliente.js`)
Orden: `titular.nombreCompleto` → `titular.nombre` (se le suman apellidos aparte si los hay) → `titular.nombres + apellidoPaterno + apellidoMaterno` → misma concatenación en la raíz → `nombreCompleto`, `nombreCliente`, `clienteNombre`, `cliente` (si es texto) → `comprador.nombreCompleto/nombre`. Ignora vacíos, «Cliente», «Cliente Registrado» y correos. Si nada sirve, usa el contrato de la orden (`contratos/CTR-<numeroOrden>`).

**Lo que sí y no puede leer el staff (verificado en `firestore.rules` del repo de la web, solo lectura):** `usuarios/{uid}` lo lee **solo su dueño** → el staff **no puede**; no se lee. `contratos` lo puede leer el staff (`esStaff()`), así que se usa como respaldo, cargado **una vez** por página (sin lecturas por orden). **Sin verificar:** qué campos de nombre trae realmente un documento `contratos/CTR-…` (el contrato de datos dice solo «metadatos del PDF y URL»); el respaldo busca los mismos campos de nombre y, si no están, no aporta nada. Si tras publicar siguen apareciendo «Cliente», significa que ni la orden ni su contrato traen nombre y habría que corregir el dato en origen (la web). No se cambian reglas ni datos.

## 4. Archivos tocados
| Archivo | Cambio |
|---|---|
| `public/js/servicio-terminado.js` (+ `.test.mjs`) | **nuevo.** Regla, índice de informes, operador, evidencia, fecha real y `construirCierreVisita` |
| `public/js/nombre-cliente.js` (+ `.test.mjs`) | **nuevo.** Extractor único y carga única de contratos |
| `public/trabajos-terminados.html` | Regla de tres condiciones en lugar de las tres ramas; filtra pagadas; fecha real o «—»; operador de la regla; «Ver Informe» solo con informe (si no, botón deshabilitado «Sin informe»); nombre con el extractor |
| `public/todos-los-trabajos.html` | Pendientes según la regla; «Completar visita» escribe solo esa visita y **solo se permite con operador y evidencia** (si no, avisa); nombre |
| `public/planificacion.html` | Realizadas/pendientes según la regla; un «completada» guardado sin evidencia no se pinta como completada; titular con el extractor (sin nombres de relleno) |
| `public/ordenes.html` | Pendientes según la regla (ya no oculta por contador ni por un «completada» sin evidencia); nombre |
| `tests/servicio-terminado-paginas.test.mjs`, `tests/n80-paginas.test.mjs` | pruebas de aceptación y estáticas; `trabajos-terminados` entra a la prueba de órdenes pagadas |

`mis-trabajos.html` no se tocó: la usan operadores, sigue ocultando por contador y su nombre sigue con el extractor antiguo (no se sabe si las reglas de `informes`/`contratos` les permiten leer; siguiente paso).

Diseño: sin cambios de estructura, clases ni colores salvo el botón deshabilitado «Sin informe».

## 5. Contrato de datos con la web
Solo cambios aditivos. «Completar visita» escribe, con rutas con punto: `estadosPorVisita.V{n}`, `ultimaModificacion` (con `origen: 'cierre_manual'`), `ultimaVisitaCompletadaFecha` y `actualizadoEn` (solo informativos). **Deja de escribir `visitasCompletadas`** (contador posicional que arrastraba visitas; si se siguiera escribiendo, la regla de compatibilidad lo leería como «1..N»): queda congelado como dato histórico, y `clientes.html` (que lo muestra como avance) ya no avanzará con cierres manuales nuevos — seguimiento pendiente. No escribe fechas de ejecución (salen del informe). Al completar todas las visitas mantiene el cierre histórico (`estado`/`estadoServicio`/`fechaCompletado`). Lecturas nuevas (solo lectura): `informes` completo y `contratos` en las listas de trabajo.

## 6. Pruebas
| Prueba | Resultado |
|---|---|
| `node --test tests/ public/js/` | **191 / 191** (antes 140 en `ops-3`; +51) |
| Navegador contra emuladores propios (`GC_OFFSET=1500`, `demo-gravecare`, reglas publicadas de la web, datos ficticios) | ver abajo |

Criterios: orden «Confirmado» + `pagoConfirmado` sin operador o sin informe nunca sale terminada (con estado de visita incluido); orden recién comprada de 12/6/4 sin terminadas; los tres casos reportados no aparecen; extracción de nombres + apellidos, genéricos ignorados, respaldo de contrato y sin lectura de `usuarios`; `fechaPago`/`creadoEn`/`creadoEl`/`actualizadoEn`/`fechaEstimada` nunca son fecha de ejecución; «Ver Informe» solo con informe; completar V2 no arrastra V1; compatibilidad con órdenes antiguas.

En navegador (emuladores): orden nueva con titular `nombres+apellidos` → «Cleo Cleopatra Ponce» en las 4 pantallas; titular solo con `nombre` → nombre; titular sin nombre → nombre tomado de `contratos/CTR-…`; orden con contador 2 y `visitas[]` completadas, y orden asignada a un operador con estado completada pero sin informe → **no aparecen** en terminadas y conservan todas sus visitas pendientes en `todos-los-trabajos`, `planificacion` y `ordenes`; orden con V1 (operador + informe con fotos + estado) → terminada con fecha del informe y «Ver Informe»; su V2 (operador y estado, sin informe) → sigue pendiente; orden antigua (contador 2 + operador + 2 informes) → V1 y V2 terminadas; «Completar» sin operador queda bloqueado con aviso. **No se reejecutó** `npm run test:e2e` (B-2/B-3): requiere instalar Playwright; la parte estática de B-2 sí corre.

## 7. Cómo validar en localhost
Con emuladores de la web (o los de `docs/entorno-local.md`) y `GC_OFFSET` propio, p. ej. 1500:
```powershell
$env:GC_OFFSET=1500
node scripts/local/sembrar-emulador.mjs
node scripts/local/servidor-emuladores.mjs      # deja esta terminal abierta
```
Entra a `http://localhost:6550/login-ops.html` (usuario de `STAFF_PRUEBA`). Con las 14 órdenes sembradas (sin operador ni ejecución) `trabajos-terminados.html` debe verse **vacía** y las demás listas mostrar todas sus visitas con el nombre del titular.

## 8. Hallazgos fuera de alcance (no tocados)
1. **Riesgo de ingresos (previo, importante):** al completar la última visita se escribe `estado: 'completada'` sobre el `estado: 'Confirmado'` de la web; `cuentaComoIngreso` exige `'Confirmado'`, así que esa orden **deja de contar como ingreso tributario**. Se mantuvo por contrato; el dueño/PM debe decidir si el cierre usa otro campo.
2. `mis-trabajos.html` y `clientes.html` siguen leyendo el contador `visitasCompletadas` (ver §4 y §5).
3. Los respaldos con nombres inventados en `planificacion.html` para el **difunto** («Tulio Santana») y datos por defecto siguen ahí (solo se quitó el del titular).
4. `informe-captura.html` deja `programacionVisitas.v_n.estado = "en revision"` y la aprobación escribe `completada`: con la regla, una visita pasa a terminada recién al aprobar el informe (o al cerrarla a mano con operador y evidencia).

## 9. Plan de despliegue y reversa
- Despliegue (dueño, clon limpio `C:\Despliegue\GravecareOps`, tag nuevo p. ej. `ops-4` tras el merge): `firebase deploy --project gravecare-2e8d2 --only hosting:gravecare-ops`. Solo Hosting; no hay reglas ni datos que migrar.
- Después de publicar: `trabajos-terminados.html` no debe mostrar visitas sin operador/informe; revisar que los nombres aparezcan.
- **Reversa:** volver a publicar el tag anterior (`ops-3`) con el mismo comando. No hay datos que revertir: lo nuevo en Firestore son campos aditivos (`estadosPorVisita`, `ultimaModificacion.origen`) que las versiones anteriores ignoran.

## 10. Ajustes finales (tercera entrega)
1. **Ingreso tributario blindado.** El cierre de la última visita ya **no escribe `estado` ni `estadoServicio`**: marca `estadoOperativo: 'completada'` (campo separado) y `fechaCompletado`. En `public/js/orden-pagada.js`, `cuentaComoIngreso` mantiene el criterio (`estado === 'Confirmado'`) y agrega una excepción para cierres antiguos: `pagoConfirmado === true` + `fechaPago` + `estado` pisado ('completada'/'completado'/'terminada'/'finalizada') sigue contando, para no perder ingresos históricos en `gastos-ingresos.html`. Se exige `fechaPago` (la escribe la confirmación del cobro) para no abrir la puerta a Oneclick inscrito sin cobro; las órdenes de prueba siguen excluidas. **Validar con datos reales:** si alguna orden cerrada antes no tuviera `fechaPago`, quedaría fuera; conviene revisar el libro de gastos e ingresos tras publicar.
2. **Avance en `clientes.html`.** Calcula las visitas realizadas con la regla única (operador + evidencia + estado propio), no con el contador. No se vuelve a escribir `visitasCompletadas` (si se escribiera, la regla de compatibilidad lo leería como «visitas 1..N»); así `servicio-terminado.js` nunca da por terminada una visita por un número.
3. **`mis-trabajos.html`.** Usa el extractor de nombre (con respaldo en contratos; si el operador no tiene permiso de lectura, falla en silencio y queda el nombre de la orden) y además oculta las visitas cerradas con su estado propio (`estadosPorVisita`), porque el cierre ya no escribe el contador. No lee `informes`: sus permisos no cambian. **`ordenes.html`:** se quitó la omisión por `estado` global (una orden con `estado` pisado por un cierre antiguo ya no desaparece de la lista).
4. **`nombre-cliente.js`:** el respaldo desde `contratos/CTR-<numeroOrden>` cubre `titular`, `nombres + apellidos`, `nombreCliente`, `clienteNombre`, `titularNombre`, `contratante` (texto u objeto) y `cliente.nombreCompleto`; la forma real del contrato sigue sin verificarse.
5. **Pruebas:** `node --test tests/ public/js/` → 197/197.
6. **Push y despliegue:** solo se sube la rama de trabajo. No se integró a `main` ni se desplegó (regla 6 del CLAUDE.md: el deploy lo ejecuta el dueño, desde un clon limpio en un tag y con `--only hosting:gravecare-ops`; el comando pedido, `--only hosting` sin sitio, está prohibido por esa misma regla).
