# B7 / spec 085 — Etapa 1: cambiar la fecha y asignar el operador de una visita (Planificación Planes)

**Fecha:** 2026-11-27 · **Rama:** `feat/085-planificacion-fecha-operador-etapa1` (desde `main`, tag `ops-planserv-19`) · **Estado:** listo para revisión (PR a `main`). **No desplegado**: lo despliega el dueño. **No se escribió nada en Firebase real**: todo se probó con pruebas automáticas y un Firebase ficticio en el navegador.
**Autorización:** directriz B7 y spec 085 (pasadas por el dueño). El dueño aprobó: solo **dueño y administrador** editan; dos etapas (Planes primero, Spot después), un PR cada una; avisar (no bloquear) fin de semana, feriado y día fuera de ruta; la fecha no puede ser anterior al pago; visitas realizadas o aprobadas no se editan; cambiar la visita 1 no mueve las demás; se escribe solo la llave de esa visita con `updateDoc`. **Etapa 2 (Spot) sin empezar**: espera la aprobación de esta.

## Qué se agregó (solo aditivo)
En la pestaña **Planes** de `public/planificacion-servicios.html`:
- Columna **«Acciones»** (oculta salvo para dueño/administrador) con un botón **Editar** por visita editable; en visitas cerradas aparece «—».
- **Modal de edición** con dos acciones separadas: **«Cambiar fecha»** (calendario) y **«Asignar operador»** (lista de personal activo + «Sin asignar»).
- **Doble paso:** primero se elige, luego aparece «anterior → nuevo» con **Confirmar / Volver**. Los **avisos** (fin de semana, feriado, fuera del día de la ruta) se muestran sin bloquear; los **errores** (sin cambio, anterior al pago, formato) sí bloquean.
- Si el guardado **falla**: el modal sigue abierto, la fila no cambia y se lee «No se pudo guardar el cambio. La visita queda como estaba. (código)». Si sale bien: la fila se refresca **sin recargar la página** y se conservan los filtros; aparece un aviso de éxito.
- Se cierra con ×, clic fuera o Escape (no mientras se guarda).

Archivos nuevos: `public/js/planificacion-edicion.js` (reglas puras, sin Firebase ni DOM), `public/js/planificacion-edicion-db.js` (única escritura, con `updateDoc` inyectado) y sus pruebas. Modificados: `planificacion-servicios.html`, `planificacion-servicios.js` (cada fila trae `estadoClave`, sin cambiar lo que pinta) y dos archivos de pruebas (ver abajo). La tabla de Spot, el diseño y las pestañas existentes **no se tocaron**.

## Datos y seguridad
- Cada guardado hace **un solo** `updateDoc(ordenes/{id}, …)` con solo las llaves de esa visita: `fechasPorVisita.V<n>` (más los punteros `fechaProgramada` y `proximaVisita`, tal como ya lo hace el helper existente `fechas-visita.js`) o `operadoresPorVisita.V<n>`. No se renombra ni elimina ningún campo; la web sigue leyendo lo mismo. La fecha se guarda a las 10:00 locales (igual que el resto del portal).
- La página no contiene nombres de campos ni escribe con `setDoc`/`addDoc`/`deleteDoc`/`writeBatch`; las pruebas lo verifican.
- Datos de Firestore (nombres de operadores, etc.) se pintan solo con `esc()` o `textContent` (AUD-01). Probado con un nombre de operador `<b>Mal</b>`: se ve como texto.
- **Riesgo a conocer:** las reglas de Firestore (repo de la web) permiten escribir `ordenes` a cualquier personal; la restricción a dueño/administrador está **solo en la pantalla**. Endurecerlo es un cambio en las reglas del repo de la web, fuera de este repo.

## Pruebas
- `public/js/planificacion-edicion.test.mjs` (23) y `tests/planificacion-edicion-pagina.test.mjs` (10) + 1 prueba nueva en `planificacion-servicios.test.mjs` (`estadoClave`). Primero en rojo, luego en verde.
- Pruebas fijadas existentes **actualizadas a propósito** (no borradas) en `tests/planificacion-servicios-paginas.test.mjs`: la lista de operadores también llena `docsStaff`; la prueba de «solo escribe…» ahora prohíbe `addDoc/deleteDoc/writeBatch` y exige exactamente un `updateDoc` inyectado; el encabezado de Planes pasa de 12 a 13 columnas (la nueva está oculta por defecto) y el `colspan` de la fila vacía depende de `puedeEditar`.
- `node --test tests/ public/js/` → **945 pasan, 0 fallan**.
- **Navegador, con Firebase ficticio** (nada sale a la red; servidor local detenido, pestaña cerrada): cambio de fecha escribe solo `fechasPorVisita.V2`, `fechaProgramada`, `proximaVisita`; cambio de operador escribe solo `operadoresPorVisita.V3`; «La visita ya tiene ese operador.» cuando no hay cambio; la visita 1 no se toca; fallo de guardado (`permission-denied`) deja la fila igual y los botones activos, y el reintento funciona; Escape y clic fuera cierran; nombre hostil como texto (`window.__xss` sin definir); perfiles: dueño y administrador ven columna y botones, **supervisor, operador y sin perfil no ven nada** (12 columnas visibles, 0 botones); móvil 375 px sin desborde de página ni del modal.

## Decisiones tomadas (revisar)
1. **Estados cerrados:** visita no editable si está completada, en revisión (aprobación pendiente) o marcada como terminada.
2. **Lista de operadores:** todo el personal activo (`nombre` o, si falta, `email`), ordenado, sin duplicados, más «Sin asignar»; si la visita tiene un operador que ya no está en la lista, se conserva como opción.
3. **Fecha tentativa:** se permite confirmar la misma fecha (la deja fija); en una visita ya fija, la misma fecha es error.
4. **Punteros** `fechaProgramada`/`proximaVisita`: se escriben junto con cualquier visita, como ya hace el helper existente (se respeta su comportamiento actual).
5. **Sin estado `reprogramada`**: no se escribe ningún estado nuevo; solo la fecha.
6. **Sin fecha de pago** en la orden: no se bloquea (no hay con qué comparar).
7. **Doble paso** de confirmación para ambas acciones.

## Despliegue y reversa
Solo Hosting, desde `C:\Despliegue\GravecareOps` con el tag que se cree tras fusionar: `firebase deploy --only hosting:gravecare-ops --project gravecare-2e8d2`. Reversa: volver a publicar `ops-planserv-19`. **Los datos sí cambian cuando se use** (la fecha/operador de una visita): la reversa de código no deshace ediciones ya hechas; se corrigen editando de nuevo la visita. Recomendado: primera prueba real del dueño con una orden de prueba, en una visita futura.
