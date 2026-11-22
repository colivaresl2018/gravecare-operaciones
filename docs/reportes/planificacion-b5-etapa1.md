# Directriz B5, etapa 1 — Pestañas de «Planificación Planes y Spot» (solo lectura)

**Fecha:** 2026-11-22 · **Rama:** `feat/planificacion-b5-etapa1` (desde `main`) · **Estado:** listo para revisión (PR a `main`). **No desplegado**: el despliegue lo ejecuta el dueño.
**Directriz:** `docs/directrices/B5-planificacion-pestanas.md` del repo `gravecare` (rama `docs/directriz-b5-planificacion`); spec de referencia `specs/056-planificacion-operativa/spec.md`.

## Qué se hizo (etapa 1, solo lectura)
En `public/planificacion-servicios.html`:
- **Planes · matriz:** una semana, un día por columna (lunes a viernes; sábado y domingo solo si tienen visitas). La cabecera de cada día muestra la fecha, el **eje** que dice la colección `rutas` y «FERIADO · nombre» si está en `feriados`. Cada visita va en la columna de **su fecha real** (o tentativa); si cae en otro día que el de su ruta lleva «Fuera de su día de ruta». Barra de tiempo (semana anterior y siguiente, ±1 mes, Hoy, deslizador) y filtros: búsqueda, cementerio, eje, estado, operador y **Mes** (lleva la matriz a la primera semana de ese mes), más «Solo con visita esta semana / Mostrar todos los planes».
- **Spot · matriz:** un mes, un día por columna, con la «S» en la fecha que eligió el cliente. Sin reglas de ruta; feriados y fines de semana solo se pintan. Filtros: búsqueda, cementerio, estado, operador y Mes.
- **Resumen de Ventas:** tarjetas Día, Semana, Mes, Año y Periodo (desde/hasta) con ventas, planes, Spot, ramos adicionales, monto y ticket promedio; tablas diaria, semanal y mensual; avisos aparte.
- **Lista de Planes:** columnas nuevas **Tipo de servicio**, **Ramos adicionales** y **Eje** (en el orden de la directriz) y filtros nuevos Eje y Mes. La lista de Spot recibe el filtro Mes.
- **Detalle al hacer clic** en una visita (ventana; se cierra con ×, clic fuera o Escape): cliente, ser querido, plan, tipo de servicio, ramos adicionales, N° de orden, cementerio, eje, operador y cronograma de visitas.

## Reglas aplicadas
- **Eje y día de ruta:** se LEEN de `rutas/{idCementerio}` (`cementerio`, `eje`, `diaSemana`). El cementerio se reconoce por su nombre completo (sin tildes ni mayúsculas) o por el id del documento; sin parecidos. Un cementerio que no está → **«Sin eje»**, en su fecha real y sin marca de «fuera de ruta». **No hay ninguna distribución escrita en el código** (una prueba lo impide) y no se carga nada desde código.
- **Feriados:** se leen de `feriados/{AAAA-MM-DD}` y solo se pintan; no bloquean ni mueven visitas.
- **Resumen:** venta = orden pagada (`esOrdenPagada`), contada en `fechaPago` (si falta, la fecha de creación). Monto = `montoTotal` del servidor; **no se recalcula** (no hay tablas de precios en el módulo). Órdenes sin fecha utilizable o sin `montoTotal` no entran en ningún período y se avisan.
- **Solo lectura:** la pantalla no tiene `setDoc`/`updateDoc`/etc. ni botones de reprogramar o asignar operador, así que no hay nada que ocultar al rol `operador` (R7 queda para la etapa de escritura/regla).
- Las lecturas de `rutas` y `feriados` no tumban la pantalla: si fallan se avisa («Todos los cementerios aparecen como «Sin eje»», «No se pudieron leer los feriados»).
- Todo dato de Firestore (incluidos eje y feriado) pasa por `esc()` (AUD-01).

## Decisiones mías (a revisar)
1. **Órdenes PRUEBA (integración de Transbank) no suman como venta** en el resumen: se cuentan aparte y se avisan. Siguen apareciendo en las listas y matrices con su insignia PRUEBA.
2. **Feriados regionales** (`alcance` distinto de `nacional`) **no se pintan**: no aplican a las rutas de Santiago ni de Rancagua. Sin `alcance` se pinta.
3. **«Sin fecha»** en el resumen = sin `fechaPago` ni fecha de creación utilizable (la fecha de creación sí cuenta cuando falta la de pago, como dice R4; se avisa cuántas ventas la usan).
4. **Tablas del resumen:** la diaria muestra los días con ventas del Periodo (si está puesto) o del mes del día de referencia; la semanal, las semanas con ventas del año de referencia (lunes a domingo); la mensual, los 12 meses del año.
5. **«Ramos adicionales»** del resumen suma los ramos adicionales **por visita** de cada orden (mismo criterio con que el servidor cobra: 0 a 10, 0 en Deluxe). No multiplica por el número de visitas.
6. **Mes** en la matriz de Planes lleva a la semana que contiene el día 1 de ese mes.
7. **Visual:** un solo cambio de clases en lo ya existente: la barra de pestañas pasó a `flex-wrap` para que las 5 pestañas no se salgan en pantallas angostas. Los textos existentes no se cambiaron (incluido «las fechas y los operadores se cambian en «Planificación & Gantt»», que ahora apunta a una opción oculta del menú por la directriz B4: conviene decidir su texto aparte).

## Archivos
- **Nuevos:** `public/js/fechas-semana.js`, `rutas-planificacion.js`, `matriz-planificacion.js`, `matriz-vistas.js`, `resumen-ventas.js`, `resumen-vistas.js` y sus `.test.mjs` (más `planificacion-servicios-b5.test.mjs`); este reporte.
- **Modificados:** `public/planificacion-servicios.html`, `public/js/planificacion-servicios.js` (nivel, ramos adicionales, eje, filtros Eje y Mes), `tests/planificacion-servicios-paginas.test.mjs`.
- No se tocaron `portal.html`, `portal-common.js` (`PERMISOS_PAGINAS`, `titulosModulos`), `planificacion.html` (el Gantt sigue en su lugar), reglas ni `firebase.json`. No hay colecciones, campos ni reglas nuevas del lado de este repo (solo lee `rutas` y `feriados`, cuyas reglas ya están publicadas).
- Las rutas de los módulos llevan `?v=b5` para que el navegador no use copias viejas.

## Pruebas
`node --test tests/ public/js/` → **475 pasan, 0 fallan** (antes, en `main`: 392). 83 pruebas nuevas: calendario (semana lunes–domingo, años y bisiestos), ejes y feriados desde las colecciones («Sin eje», nombres parecidos que no se confunden, documentos incompletos), matriz (eje, día de ruta, «Fuera de su día de ruta», «Sin eje», fines de semana, feriados, filtros, semana que cruza de año), resumen (`montoTotal`, fecha de pago o de creación, periodo, tablas, PRUEBA, sin fecha, sin monto), HTML escapado y estructura de la página (pestañas, columnas, solo lectura, sin distribución ni feriados en el código, sin copias de reglas).
**Verificado en el navegador con datos ficticios** (sin Firebase; Firebase sustituido por un módulo local): las 5 pestañas cambian bien; la lista de Planes muestra las 12 columnas con el eje; la matriz muestra el eje de cada día, la visita «fuera de ruta», dos órdenes «Sin eje» y el feriado nacional (el regional no se pinta); el filtro Eje (incluido «Sin eje») y Mes funcionan; el detalle abre y cierra con Escape; el resumen suma, avisa (sin fecha, sin monto, fecha de creación, PRUEBA) y muestra los 12 meses; sin la colección `rutas` (vacía o con error) la pantalla avisa y todo sale «Sin eje»; con error en `ordenes` aparece «Reintentar»; sin desborde horizontal a 375 px.
**No se probó** con las órdenes, `rutas`, `feriados` ni permisos reales de producción, ni con emuladores. «Administrador» y «operador» se probaron solo como cuentas simuladas: esta pantalla no tiene controles distintos por rol.

## Despliegue y reversa
- **Antes de publicar:** las colecciones `rutas` (cinco ejes, lunes a viernes) y `feriados` deben estar cargadas por el dueño/administrador desde su pantalla de configuración; si están vacías la pantalla funciona pero todo sale «Sin eje» y sin feriados.
- **Despliegue (lo ejecuta el dueño):** clon limpio `C:\Despliegue\GravecareOps` en el tag nuevo (sugerido `ops-planserv-5`), `firebase deploy --only hosting:gravecare-ops --project gravecare-2e8d2`.
- **Reversa:** volver a publicar el tag anterior (`ops-planserv-4`) o usar el historial de versiones de Hosting. No hay datos nuevos que deshacer.

## Pendiente / fuera de esta etapa
- **Etapa 2** (Compra de flores, Valores de ramos, Órdenes de Compra): no autorizada, no iniciada. La rama local antigua `feat/planificacion-matrices` contiene una versión previa de las matrices con rutas y feriados escritos en el código y con las pestañas de la etapa 2: queda **reemplazada** por esta etapa y no debe fusionarse.
- Retiro de `planificacion.html` (Gantt): solo con paridad aprobada (anexo B de la spec 056).
- Texto de la cabecera que menciona «Planificación & Gantt» (ver decisión 7).
- Reprogramar y asignar operador por rol (R7): se verá con la etapa que reutilice las escrituras del Gantt; la regla de `ordenes` no lo impone todavía.
