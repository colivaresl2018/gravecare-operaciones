# Planificación Planes y Spot: pestaña nueva con subpestañas «Planes» y «Spot»

**Fecha:** 2026-11-18 · **Rama:** `feat/planificacion-planes-spot` · **Tag:** `ops-planserv-2` (no usar `ops-planserv-1`: ver «Despliegue»)

## Qué se hizo
Una pantalla nueva e independiente, **«Planificación Planes y Spot»**, con dos subpestañas, accesible desde el menú lateral (solo administradores):
- **Planes:** una fila por visita (Plan 4, 6 y 12) con fecha, N° de orden, cliente, Ser Querido, plan, visita «n de N», cementerio, operador y estado. Filtros: búsqueda, cementerio, operador y estado.
- **Spot:** una fila por servicio con la fecha que eligió el cliente, N° de orden, cliente, Ser Querido, cementerio, operador y estado. Filtros: búsqueda y cementerio.
- **Solo lectura.** No escribe nada en Firestore. Los cambios de fecha y operador siguen haciéndose en «Planificación & Gantt», que **no se tocó**.

El código lo desarrolló otra IA y llegó como zip. Se revisó, se encontraron errores de integración y se corrigió aquí (ver «Correcciones respecto del zip»). La especificación entregada a esa IA queda en `docs/directrices/B4-planificacion-planes-spot.md`.

## Archivos
- **Nuevos:** `public/planificacion-servicios.html`, `public/js/planificacion-servicios.js` (lógica pura), `public/js/planificacion-servicios.test.mjs`, `tests/planificacion-servicios-paginas.test.mjs`, `docs/directrices/B4-planificacion-planes-spot.md`.
- **Modificados:** `public/portal.html` (+6 líneas: botón del menú y título del módulo), `tests/acceso-staff-paginas.test.mjs` y `tests/n80-paginas.test.mjs` (la página nueva entra en sus listas).
- Ninguna otra página cambia.

## Reglas que usa (las mismas del resto del backoffice)
- **Órdenes pagadas:** `esOrdenPagada` antes de listar (N80). Las órdenes de integración llevan la insignia **PRUEBA**, como en la Gantt.
- **Planes / Spot:** `tipoServicio === 'SPOT'` primero y, si falta, el nombre del plan contiene «spot» (igual que Órdenes). Sin plan registrado: una fila «Sin plan registrado» y **no** se calcula con un plan por defecto.
- **Fechas:** `fechasPorVisita.V<n>` real → fecha tentativa del plan (`fechas-tentativas.js`, con insignia «Tentativa») → «Sin fecha programada». Spot: `fechasPorVisita.V1` o la fecha del cliente → «Sin fecha del cliente». Nunca se inventa una fecha.
- **Visita terminada y estado:** `servicio-terminado.js` y `estado-visita-unificado.js`, con las etiquetas y colores de la Gantt.
- **Seguridad:** todo dato de Firestore pasa por `esc()` (AUD-01); `exigirStaff` antes de cargar datos; sin manejadores inline con datos.
- **No incluye** las reglas nuevas de la especificación v5.1 (ejes por día, feriados, +30 ±3 días): siguen pendientes de decisión del dueño. Cuando se aprueben se cambian en `fechas-tentativas.js` y esta pantalla las recoge sola.

## Correcciones respecto del zip recibido
1. **Imports a módulos que no existen** (`contratos.js`, `visitas-estado.js`): la pantalla quedaba en «Cargando…». Ahora usan `nombre-cliente.js`, `servicio-terminado.js` y `estado-visita-unificado.js`.
2. **Todas las fechas salían «Sin fecha»:** los módulos de fechas devuelven `Date` y la función las leía como texto. Ahora acepta `Date`, Timestamp y texto.
3. **Nombre del cliente y visitas terminadas fallaban en silencio:** `cargarContratos` recibe una función (no `db`) y `crearIndiceInformes` recibe pares `[id, datos]` (no `snap.docs`).
4. **La insignia «Tentativa» nunca aparecía:** se leía una propiedad inexistente (`origen`); la real es `tentativa`.
5. **Faltaba `portal.html`:** sin botón ni título la pantalla no se podía abrir.
6. **Dependencias de ramas:** necesitaba `fechaSpotDelCliente` (rama `feat/spot-fecha-automatica`) y `html-seguro.js` (rama `fix/escape-html-backoffice`); `main` no tiene ninguno. Esta rama parte de `fix/escape-html-backoffice` e incorpora `feat/spot-fecha-automatica`.
7. **Estados crudos** (`en_ejecucion`): ahora con las etiquetas de la Gantt.
8. **Firebase 10.12.2 y sin `?v=`:** ahora 10.7.0 como el resto, y los módulos compartidos llevan `?v=` (ver «Caché»).
9. **Lecturas auxiliares:** si fallan `informes`, `contratos` o `staff`, la pantalla se degrada en vez de mostrar error total.
10. **Plan guardado solo en `tipoPlan`:** el zip lo trataba como «Sin plan registrado»; ahora se lee igual que en la Gantt.
11. **Aspecto:** tipografía, fondo, encabezado, selector de pestañas, filtros y tablas con las mismas clases de «Planificación & Gantt».
12. **Pruebas:** las del zip simulaban los módulos de fechas y por eso pasaban con el código roto; se reescribieron con los módulos reales.

## Pruebas
`node --test tests/ public/js/` → **392 pasan, 0 fallan** (la base más 40 nuevas de esta pantalla: 21 de lógica con módulos reales y 19 estáticas de integración).

**Verificado en el navegador** con los emuladores de la web (puertos desplazados `GC_OFFSET=2100`, proyecto `demo-gravecare`, datos ficticios; nada contra producción):
- Dentro del portal, como administrador: aparece «Planificación Planes y Spot» en el menú, abre en el marco, el título de la barra cambia y el botón queda activo. Como operador el botón no se ve.
- Planes: 51 filas (Plan 12 → 12 filas, Plan 6 → 6, Plan 4 → 4 por orden, una orden sin plan → 1 fila). La visita 2 con fecha real muestra 20/03/2026 sin insignia; las demás, «Tentativa». La visita 1 con operador y estado «en ejecución» muestra «En ejecución».
- Spot: 4 filas con 05/12/2026 y 17/12/2026 (fecha del cliente en AAAA-MM-DD y en DD/MM/AAAA) y «Sin fecha del cliente».
- Una orden sin pagar no aparece. Un nombre de cliente con `<img onerror=…>` se muestra como texto y no se ejecuta.
- Cambio de subpestaña, búsqueda, filtros y estado vacío funcionan. Sin errores en la consola (solo el aviso habitual de Tailwind por CDN).

**No se probó** contra datos reales de producción (no se apunta a producción). Conviene mirar la pantalla una vez publicada.

## Caché del navegador
Los módulos de esta pantalla llevan `?v=ps1` (`planificacion-servicios.js`, `fechas-visita.js`, `fechas-tentativas.js`) para que ningún navegador use una copia vieja de `fechas-visita.js`, que ya cambió (`fechaSpotDelCliente`). Si se vuelve a cambiar alguno, hay que subir ese número.

## Despliegue y reversa
Solo Hosting de `gravecare-ops`, desde un clon limpio en el tag **`ops-planserv-2`**.

**Por qué no `ops-planserv-1`:** al comparar el sitio en vivo con el tag (archivo por archivo) se vio que el tag 1 no incluía `clientes.html` con la agrupación por RUT que **ya está publicada** (commit `9c6a956`, rama `feat/clientes-agrupar-publicado`); desplegarlo habría vuelto a separar a los clientes. El tag 2 fusiona esa rama.

**Comparación con el sitio en vivo (`gravecare-ops.web.app`), tag 2:** de 46 archivos de `public/` (sin pruebas) 42 son idénticos. Los 4 distintos son los previstos:
- `planificacion-servicios.html` y `js/planificacion-servicios.js`: nuevos (hoy dan 404).
- `portal.html`: +6 líneas (botón y título del módulo).
- `js/fechas-visita.js`: añade `fechaSpotDelCliente` y el respaldo de la fecha del Spot en V1. Hoy en vivo está la versión anterior (`1b7f21e`, tags ops-10…ops-17), o sea que el arreglo de la fecha del Spot en Órdenes y Planificación **no** estaba publicado; con este tag queda publicado.

Los tags `ops-17`…`ops-20` y `ops-clientes-1/2` no son ancestros de este tag, pero su contenido en vivo coincide con lo que este tag publica (comparado por archivo), salvo lo indicado arriba.
```powershell
cd C:DespliegueGravecareOps
git fetch --all --tags
git checkout ops-planserv-2
git status --short                      # vacío
firebase deploy --only hosting:gravecare-ops --project gravecare-2e8d2
```
- **Antes:** anotar la versión vigente de `gravecare-ops` (consola de Hosting) como punto de reversa.
- **Reversa:** historial de versiones de Hosting del sitio `gravecare-ops`.

## Pendiente
- Decisiones del dueño sobre las reglas v5.1 (ejes, feriados, +30 ±3 días) y sobre si el Spot debe moverse al día del eje (hoy no se mueve).
- `main` no tiene aún `html-seguro.js`, `fechaSpotDelCliente` ni la agrupación de Clientes: esta rama los trae fusionados. Conviene integrar todo a `main` para que la próxima rama parta de una base completa.
