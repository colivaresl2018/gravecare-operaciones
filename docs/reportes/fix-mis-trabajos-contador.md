REPORTE — Mis Trabajos: visitas ocultas por el contador viejo — 2026-11-11 — rama `fix/mis-trabajos-contador` (base: `main`)

# Estado
Código y pruebas listos en local (233 en verde con `node --test tests/ public/js/`). **Nada empujado ni desplegado.** Pendiente: revisión del dueño, confirmar en Firebase el campo `visitasCompletadas` de la orden `ORD-1794358691756423`, PR, tag y despliegue (dueño).

## Caso
El operador Christian Olivares tiene asignadas dos visitas V1: `ORD-1794318778901977-V1` (Pepito TV Solis) y `ORD-1794358691756423-V1` (Carmelo LU Kuan). «Mis Trabajos» solo mostraba la primera. «Órdenes de Servicio» muestra ambas.

## Causa (código)
`public/mis-trabajos.html` ocultaba las visitas con el contador posicional `visitasCompletadas`:
- línea 285: `visitasCompletadasCount = Number(d.visitasCompletadas)`;
- línea 303: `if (idx < visitasCompletadasCount) continue;`.
Si el contador vale 1, la V1 desaparece, aunque la visita no tenga operador ni evidencia. `ordenes.html` ya no usa el contador y `servicio-terminado.js` solo lo toma como respaldo si la visita tiene operador y evidencia. Por eso las dos páginas no coinciden.

Dato de producción no verificado: no pude leer Firestore. Confirmar en la consola que `ordenes/ORD-1794358691756423.visitasCompletadas` vale 1 o más.

## Cambio
- Quitada la lectura del contador y la línea que ocultaba visitas por posición.
- Se mantiene el filtro por estado propio de la visita: `esEstadoCompletada(estadosPorVisita.V{n})`.
- Prueba nueva `tests/mis-trabajos-contador.test.mjs` (2 casos).

## Efecto y limitación
- Visitas que el contador viejo marcaba como hechas y que no tienen estado propio finalizada vuelven a aparecer como pendientes. Es lo que pide la regla estricta.
- `mis-trabajos.html` no lee informes (permisos), así que no puede exigir la evidencia que sí exige `ordenes.html`. Diferencia residual: una visita con `estadosPorVisita` finalizada, sin evidencia, se oculta aquí y se muestra en Órdenes. Pendiente de decisión del dueño.

## Otras páginas con el contador (fuera de este cambio)
- `todos-los-trabajos.html:255-257` usa `terminadas.size` para calcular fechas, no para ocultar visitas. Revisar.
- `clientes.html:216` escribe `visitasCompletadas` desde `numerosTerminados`; no lo cambié.

## Plan de despliegue y reversa
Solo Hosting `gravecare-ops`, como dueño, desde clon limpio en tag. Archivo: `public/mis-trabajos.html`. Reversa: volver al tag anterior y redesplegar. Sin cambios de datos ni reglas.
