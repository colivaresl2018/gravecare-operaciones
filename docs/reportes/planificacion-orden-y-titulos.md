# Planificación Planes y Spot — orden de las pestañas y encabezado por pestaña

**Fecha:** 2026-11-22 · **Rama:** `fix/planificacion-orden-y-titulos` (desde `main`, tag `ops-planserv-6`) · **Estado:** listo para revisión (PR a `main`). **No desplegado**: el despliegue lo ejecuta el dueño.
**Autorización:** el dueño autorizó en la conversación (2026-11-22) los puntos 3 y 4 de la comparación con `planificacion-simulacion.html`.

## Qué cambia (solo estos textos y este orden; el diseño no se toca)
1. **Orden de las pestañas** (como en el simulador): Planificación Planes · Planificación Spot · Planes · matriz · Spot · matriz · **Compra de flores · Valores de ramos · Resumen de Ventas**. Antes el Resumen iba antes de Compra y Valores.
2. **Nombres de las dos primeras pestañas:** «Planes» → **«Planificación Planes»** y «Spot» → **«Planificación Spot»** (los contadores siguen).
3. **Encabezado por pestaña** (título y texto bajo el título, igual que el simulador). El título del documento cambia con él.

| Pestaña | Título | Texto |
|---|---|---|
| Planificación Planes y Planes · matriz | Planificación Planes | Visitas de los servicios con plan con pago confirmado. |
| Planificación Spot y Spot · matriz | Planificación Spot | Visitas de los servicios Spot con pago confirmado. |
| Compra de flores | Compra de Flores | (sin texto) |
| Valores de ramos | Valores de los Ramos | (sin texto) |
| Resumen de Ventas | Resumen de Ventas | (sin texto) |

## Efectos que conviene saber
- **Se retira de la pantalla la frase «Vista de consulta: las fechas y los operadores se cambian en «Planificación & Gantt»»**, porque el simulador aprobado no la lleva en las pestañas de Planes y Spot. De paso queda resuelto el pendiente de que apuntaba a una opción oculta del menú (B4).
- **El nombre de la página en el menú del portal no cambia** («Planificación Planes y Spot», `titulosModulos`): sigue siendo el nombre del módulo.
- Las pestañas más largas se acomodan en dos filas gracias al `flex-wrap` que ya tenía la barra.
- No cambian datos, reglas, colecciones ni módulos de lógica; solo `planificacion-servicios.html` y sus pruebas.

## Pruebas
`node --test tests/ public/js/` → **524 pasan, 0 fallan** (antes 519). 5 pruebas nuevas (orden, nombres, encabezado por pestaña con los textos del simulador, encabezado inicial y aplicado al abrir también si la carga falla, nombre del menú intacto) y 2 ajustadas (las que fijaban el orden anterior), vistas primero en rojo.
**Verificado en el navegador** con datos ficticios: el orden y los nombres, y que título, texto y `document.title` cambian en cada una de las 7 pestañas (el texto se oculta donde no corresponde).

## Despliegue y reversa
Lo ejecuta el dueño: clon limpio o `git fetch --tags` + `git checkout` del tag nuevo (sugerido `ops-planserv-7`), `git describe --tags` debe decir ese tag y la salida debe decir **«found 79 files»** (no se agregan archivos), luego `firebase deploy --only hosting:gravecare-ops --project gravecare-2e8d2`. Reversa: republicar `ops-planserv-6`.

## Sigue pendiente
Eje en «Sin eje» hasta cargar la colección `rutas` (no hay pantalla para cargarla), feriados igual, y «Órdenes de Compra» (spec 055).
