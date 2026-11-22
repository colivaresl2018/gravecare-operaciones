# Pantalla «Rutas y feriados» — cargar ejes, días de ruta y feriados desde el portal

**Fecha:** 2026-11-22 · **Rama:** `feat/rutas-feriados-admin` (desde `main`, tag `ops-planserv-7`) · **Estado:** listo para revisión (PR a `main`). **No desplegado**: el despliegue lo ejecuta el dueño.
**Autorización:** el dueño pidió construir estas pantallas en la conversación (2026-11-22, «construye las pantallas propuestas»).

## Para qué sirve
Hoy las colecciones `rutas` y `feriados` están vacías y no había ninguna pantalla para cargarlas: en las matrices de Planificación el **Eje sale «Sin eje»** en todas partes y no se pintan feriados. Esta pantalla permite cargar esos datos sin entrar a la consola de Firebase.

## Qué se hizo
Página nueva `public/rutas-feriados.html`, con opción de menú **«Rutas y feriados»** en el portal (para todos los roles que no son operador, igual que «Planificación Planes y Spot»).

- **Pestaña «Rutas por cementerio».** Tabla con todos los cementerios que aparecen en las órdenes más los que ya tienen ruta: eje, día de ruta (lunes a viernes) y estado (**Activa**, **Quitada** o **Sin ruta**), con un resumen arriba. Para cargar: marcar uno o varios cementerios, escribir el eje, elegir el día y pulsar «Asignar»; sirve para asignar el mismo eje y día a varios a la vez. «Editar» precarga el formulario con esa fila. Si un cementerio no aparece en la tabla (todavía no tiene órdenes) se escribe en «Otro cementerio».
- **Pestaña «Feriados».** Tabla con fecha (dd/mm/aaaa), día de la semana, nombre, alcance (nacional o regional) y estado. Se puede agregar **uno** (fecha, nombre, alcance) o **pegar una lista** con una línea por feriado: `fecha | nombre | alcance` (alcance opcional, por defecto nacional; vale `|`, `;` o tabulación; la fecha puede ir como `AAAA-MM-DD` o `dd/mm/aaaa`; se saltan las líneas vacías o que empiezan con `#`).
- **Quitar no borra.** «Quitar» marca el documento con `activo: false` y «Reactivar» lo devuelve a `activo: true`. Las matrices de Planificación ignoran lo quitado (un cementerio quitado vuelve a «Sin eje»; un feriado quitado no se pinta). Pide confirmación al quitar.

## Reglas aplicadas
- **Permisos como las reglas ya publicadas** (release `reglas-planificacion-2026-11-22` del repo de la web): `rutas` solo las escribe el **dueño** (`staff/{uid}.dueno === true`) y `feriados` solo un **administrador** (`rol` administrador o admin). La pantalla lee el perfil del usuario y **solo muestra formulario y botones a quien puede**; los demás ven las tablas y un aviso. Esto es solo comodidad de la interfaz: la barrera real son las reglas de Firestore (una prueba en el navegador con permiso denegado confirma que se avisa con un texto claro).
- **Las únicas escrituras** son `setDoc` con `merge` en `rutas/{id}` y `feriados/{AAAA-MM-DD}`. Campos de rutas: `cementerio`, `eje`, `diaSemana`, `activo`, `actualizadoPor`, `actualizadoEn`. Campos de feriados: `nombre`, `alcance`, `activo`, `actualizadoPor`, `actualizadoEn` (la fecha va en el id). **`activo`, `actualizadoPor` y `actualizadoEn` son campos nuevos y aditivos**: no se renombra ni elimina nada del contrato con la web; la web no lee estas colecciones. Una prueba impide `deleteDoc`, `updateDoc`, `addDoc`, `writeBatch` y otras colecciones.
- **Nada escrito en el código**: ni ejes, ni días por cementerio, ni feriados (una prueba lo revisa). Los carga el dueño o el administrador; los feriados de 2027 siguen sin verificar y los debe cargar quien los conozca.
- **Un cementerio ya cargado conserva su documento**: si el cementerio ya tiene un documento en `rutas` (por nombre o por id) se actualiza ese mismo; si no, nace uno con id = nombre sin tildes ni símbolos y con guiones (`parque-canaan-de-pudahuel`). El lector de las matrices reconoce el cementerio por su nombre o por el id, así que sirve con cualquiera de los dos.
- Todo dato de Firestore (cementerios, ejes, nombres) pasa por `esc()` (AUD-01; verificado con un nombre con etiquetas HTML).
- Si fallan las lecturas se avisa con «Reintentar» (sin dejar un panel vacío); si falla solo la lista de cementerios de las órdenes, la pantalla sigue con los que ya tienen ruta y lo avisa. Los botones se deshabilitan mientras se guarda (un doble clic no duplica el guardado) y siempre se vuelven a habilitar.
- Exige el claim de staff antes de cargar nada (`exigirStaff`, B-13) y se agregó a la prueba que revisa todas las páginas.

## Decisiones mías (a revisar)
1. **«Quitar» = `activo: false`**, no borrar. Las reglas permiten borrar (`write` incluye `delete`), pero la regla de oro es no borrar; así queda historial y se puede reactivar.
2. **Cementerios listados desde las órdenes**: el catálogo de la web no está disponible para este repo y `cementeriosCoords.js` es una copia antigua; la lista sale de lo que aparece en `ordenes` (leídas solo para sacar el nombre) más lo que ya está en `rutas`. Un cementerio sin órdenes se agrega con «Otro cementerio».
3. **La carga de una lista de feriados es todo o nada**: si una línea tiene un problema no se guarda ninguna y se muestran las líneas con su número. Guardar de nuevo una fecha existente solo actualiza su nombre y alcance (y la reactiva), así que repetir la carga corregida es seguro.
4. **Eje en texto libre** (hasta 40 letras): no hay lista de ejes en el código; la elige el dueño.
5. **`actualizadoEn` como texto ISO**, igual que en «Valores de ramos».
6. **Cambio colateral pequeño:** `rutas-planificacion.js` ahora ignora los documentos con `activo === false` (con pruebas) y `planificacion-servicios.html` pasó su import a `?v=cfg1` para que el navegador no use la copia anterior; la prueba antigua de importaciones acepta esa versión. Nada más cambia en esa página.

## Archivos
- **Nuevos:** `public/rutas-feriados.html`; `public/js/config-planificacion.js`, `config-planificacion-db.js`, `config-vistas.js` y sus `.test.mjs`; `tests/rutas-feriados-pagina.test.mjs`; este reporte.
- **Modificados:** `public/portal.html` (una opción de menú y su título; el resto del menú no cambia), `public/js/rutas-planificacion.js` y su prueba (ignora `activo: false`), `public/planificacion-servicios.html` (solo la versión del import), `tests/acceso-staff-paginas.test.mjs` (suma la página nueva) y `tests/planificacion-servicios-paginas.test.mjs` (acepta la versión nueva del import).

## Pruebas
`node --test tests/ public/js/` → **580 pasan, 0 fallan** (antes 524). 56 pruebas nuevas, vistas primero en rojo: ids de rutas, validación y carga en lote, feriados (validación y lista pegada con líneas con problemas), permisos por rol, activo/inactivo, filas de la tabla, escrituras con Firestore simulado (solo los campos indicados, `merge`, rechazo de datos inválidos, lote que sigue aunque una falle, quitar/reactivar sin borrar), HTML escapado y estructura de la página y del portal.
**Verificado en el navegador con datos ficticios** (Firebase sustituido por un módulo local): carga, asignar a varios (ids nuevos y reutilizados al editar), quitar y reactivar (solo `activo` y quién/cuándo), «Otro cementerio», feriado suelto, lista con errores (no guarda nada) y lista correcta (con `;`, `dd/mm/aaaa` y comentarios), quitar un feriado; perfiles dueño, administrador, supervisor y sin perfil (cada uno ve solo lo que puede); permiso denegado al guardar; lectura de órdenes o de rutas fallida; doble clic; sin desborde horizontal a 375 px.
**No se probó** con las colecciones, las órdenes ni los permisos reales de producción, ni con emuladores.

## Despliegue y reversa
- **Despliegue (lo ejecuta el dueño):** `git fetch --tags origin`, `git checkout` del tag nuevo (sugerido `ops-planserv-8`), `git describe --tags` debe decir ese tag y la salida debe decir **«found 86 files»** (79 + 7 archivos nuevos en `public/`), luego `firebase deploy --only hosting:gravecare-ops --project gravecare-2e8d2`.
- **Después de publicar:** el dueño abre «Rutas y feriados», carga los ejes y días de cada cementerio, y un administrador carga los feriados. Hasta entonces todo sigue como hoy («Sin eje»).
- **Reversa:** republicar `ops-planserv-7`. Lo que se haya cargado en `rutas` y `feriados` queda guardado (no hay nada que deshacer de datos; las matrices anteriores simplemente no usan el campo `activo`).

## Sigue pendiente
«Órdenes de Compra» (spec 055, necesita aprobación y reglas publicadas), la carga real de `rutas` y `feriados` por parte del dueño y del administrador (feriados 2027 sin verificar), retiro del Gantt con paridad aprobada y permisos por rol R7.
