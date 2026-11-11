REPORTE — Mis Trabajos: el segundo servicio del administrador no aparecía — 2026-11-11 — rama `fix/mis-trabajos-operador-identidad` (base: `main`)

# Estado
Código y pruebas listos en local (251 en verde con `node --test tests/ public/js/`). **Nada empujado ni desplegado.** Pendiente: revisión del dueño, PR, tag y despliegue (dueño). Diagnóstico por código y datos simulados: no se leyó Firestore, así que la causa exacta en producción (cuál de las dos, o ambas) se confirma con el procedimiento de más abajo.

## Caso
Con `colivaresl@hotmail.com`, «Listado de Asignaciones Pendientes» solo muestra `ORD-1794318778901977-V1` (Pepito TV Solis). Falta `ORD-1794358691756423-V1` (Carmelo LU Kuan), que sí aparece en «Órdenes de Servicio». El arreglo anterior (`fix/mis-trabajos-contador`) quitó el contador `visitasCompletadas`; quedaban otras dos causas.

## Causas (código)
**1. Identidad comparada contra un nombre fijo.** Las tres pantallas que asignan operador (`ordenes.html`, `planificacion.html`, `todos-los-trabajos.html`) guardan lo mismo: `operadoresPorVisita.V{n}` = `staff.nombre` (o el correo si el staff no tiene nombre), tomado del selector de staff. Mis Trabajos, para el admin, usaba el nombre fijo «Christian Olivares» y `nombreGuardado.includes("christian olivares")`. Si en `staff` el nombre es «Christian Gerardo Olivares Lizama», no lo contiene y la visita queda fuera. Además solo leía `operadoresPorVisita`, `operadorAsignadoNombre`, `operadorNombre` y `operadorId`: ignoraba `operador`, `operadorAsignado`, `operadorEmail`, `visitas[n]`, `programacionVisitas.v_n`, `asignacionesVisitas` y `visitasEstado`. Esos campos no los escribe este repo; los lee de forma tolerante por si los guarda la web.

**2. «Completada» espurio que ocultaba visitas.** Mis Trabajos (a) descartaba la orden entera si `estado`/`estadoServicio` decía «completada» (`ordenes.html` ya no hace eso) y (b) ocultaba la visita con `estadosPorVisita.V{n}` finalizada sin pedir operador ni evidencia. Una orden recién comprada con estado erróneo (caso Carmelo) quedaba oculta aunque no tenga informe ni fecha real de ejecución.

## Cambio
- Nuevo `public/js/operador-asignado.js` (solo lectura, sin Firebase):
  - `crearIdentidad`: uid, correo(s) y nombre(s) del usuario (auth, doc `staff` propio y, para el admin, los dos correos `colivaresl@hotmail.com` / `admin@gravecare.cl` y los nombres «Christian Olivares» / «Christian Gerardo Olivares Lizama»).
  - `nombresCoinciden`: sin tildes ni mayúsculas; las palabras del nombre más corto deben estar en el largo. Nombres de una sola palabra solo coinciden si son iguales (no confunde «Juan» con «Juan Pérez»).
  - `visitaAsignadaA`: coincide por uid, correo o nombre en todas las estructuras listadas. Si la visita tiene asignación propia, manda esa; si no, vale la de la orden (antes `operadorId` de la orden coincidía con todas las visitas).
  - `visitaCerradaParaMisTrabajos`: usa la regla única de `servicio-terminado.js` (operador + evidencia + estado propio). El estado de la orden y el contador sin evidencia no ocultan nada.
- `public/mis-trabajos.html`: usa lo anterior, lee `informes` (solo lectura, en try/catch, igual que `ordenes.html`) y quita el descarte por estado global. Sin cambios de HTML visible, estilos ni textos. Sin escrituras.
- Si `informes` no se puede leer: se ocultan solo las visitas con estado propio finalizada y operador (criterio anterior), para no reabrir visitas realmente hechas.
- Pruebas: `public/js/operador-asignado.test.mjs` (13) y `tests/mis-trabajos-operador.test.mjs` (5, con las dos órdenes simuladas y ambos correos del admin). Ajusté dos aserciones antiguas que fijaban «mis-trabajos no lee informes» y la línea exacta del filtro (`tests/servicio-terminado-paginas.test.mjs`, `tests/mis-trabajos-contador.test.mjs`).

## Efecto y límites
- Comportamiento que cambia: visitas con «completada» sin informe ni operador reaparecen como pendientes (lo pide la regla estricta). Dato antiguo con contador + operador + informe real sigue oculto, igual que en Órdenes.
- Decisión pendiente: la coincidencia por nombre es por palabras («Christian Olivares» también coincide con cualquier nombre que contenga esas dos palabras). Si hubiera dos personas con nombre y apellido iguales, usar uid.
- Recomendación (fuera de este cambio, toca ordenes/planificacion/todos-los-trabajos): guardar también `operadoresIdPorVisita.V{n}` = uid junto al nombre, de forma aditiva, para no depender de nombres.
- Si el dato de producción no coincide con la hipótesis: ver en la consola de Firebase `ordenes/ORD-1794358691756423` los campos `operadoresPorVisita`, `estado`, `estadosPorVisita` y si hay `informes/ORD-1794358691756423-V1`, y el doc `staff/{uid del admin}.nombre`.

## Plan de despliegue y reversa
Solo Hosting `gravecare-ops`, lo ejecuta el dueño desde clon limpio en un tag nuevo, con `--project gravecare-2e8d2 --only hosting:gravecare-ops`. Archivos: `public/mis-trabajos.html` y `public/js/operador-asignado.js` (nuevo). Verificación: entrar como administrador y comprobar que aparecen ambos servicios; entrar como otro operador y comprobar que solo ve los suyos. Reversa: volver al tag anterior y redesplegar. Sin cambios de datos ni de reglas.
