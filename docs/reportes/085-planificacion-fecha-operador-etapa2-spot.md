# B7 / spec 085 — Etapa 2: cambiar la fecha y asignar el operador de un servicio Spot

**Fecha:** 2026-11-27 · **Rama:** `feat/085-planificacion-fecha-operador-etapa2-spot` (desde `main`, `518db96`, tag `ops-planserv-20`) · **Estado:** listo para revisión (PR a `main`). **No desplegado**: lo despliega el dueño. **No se escribió nada en Firebase real**: pruebas automáticas y Firebase ficticio en el navegador.
**Autorización:** el dueño pidió esta etapa tras desplegar la etapa 1 (`ops-planserv-20`, verificada en vivo). Mismas reglas aprobadas: solo **dueño y administrador**; avisos que no bloquean (fin de semana, feriado, fuera del día de ruta); fecha no anterior al pago; servicios realizados o aprobados no se editan.

## Qué se agregó (solo aditivo)
En la pestaña **Spot** de `public/planificacion-servicios.html`: columna **«Acciones»** (oculta salvo dueño/administrador) con **Editar** por servicio; «—» si ya está realizado o aprobado. Abre **el mismo modal** de la etapa 1 (fecha y operador, doble paso de confirmación, avisos, error de guardado). El detalle dice «Servicio Spot» (un Spot no tiene «visita n de N»).
- `celdaAcciones(f, lista)` y `abrirEdicion(docId, visita, lista)` ahora saben de qué tabla viene el botón (`data-lista`); un solo manejador de clic para las dos tablas.
- `planificacion-edicion.js`: nueva `textoVisitaEdicion(fila)` («Visita 2 de 4» / «Servicio Spot»). **La escritura (`planificacion-edicion-db.js`) no cambió**: un solo `updateDoc(ordenes/{id})` con las llaves de la visita 1 (`fechasPorVisita.V1` + punteros, u `operadoresPorVisita.V1`).
- De paso, corregí el aviso de éxito de la etapa 1: «Fecha actualizad**a**» (decía «Fecha actualizado») y ahora lleva «orden X · Visita/Servicio …».
- Cache: el import del módulo pasó a `?v=085b` (cambió su contenido; con `?v=085` un navegador con la copia vieja habría fallado al pedir `textoVisitaEdicion`).
- Planes, matrices, compra y valores **no se tocaron**.

## Datos y seguridad
- Mismo contrato que la etapa 1; sin campos nuevos ni renombrados; sin `setDoc/addDoc/deleteDoc/writeBatch`; datos de Firestore solo con `esc()`/`textContent`.
- **Punto a conocer (Spot):** la fecha de un Spot que mostraba la pantalla puede venir de `fechaProgramada`/`fechaServicio` (la que eligió el cliente al comprar). Al cambiarla se escribe `fechasPorVisita.V1` (que manda al leer) **y** los punteros `fechaProgramada` y `proximaVisita`, igual que hace hoy Órdenes de Servicio con el helper de la spec 041. Por tanto **`fechaProgramada` deja de guardar la fecha original que eligió el cliente** (`fechaServicio` queda intacto). Si necesitas conservar la elegida por el cliente, habría que dejar de escribir `fechaProgramada` para Spot: cambio pequeño, pero toca el helper compartido con Órdenes; no lo hice sin tu decisión.
- Igual que en la etapa 1: la restricción por rol es solo de pantalla; las reglas de `ordenes` están en el repo de la web.

## Pruebas
- Nuevas: 3 en `public/js/planificacion-edicion.test.mjs` y 4 en `tests/planificacion-edicion-pagina.test.mjs` (primero en rojo, luego en verde). Dos pruebas fijadas de la etapa 1 actualizadas **a propósito** (no borradas): la de la firma de `celdaAcciones` y la del `?v=085b`; la que exigía que Spot no tuviera «Acciones» se reemplazó por las de esta etapa.
- `node --test tests/ public/js/` → **952 pasan, 0 fallan**.
- **Navegador, con Firebase ficticio** (nada a la red; servidor detenido, pestaña cerrada): cambio de fecha en un Spot con V1 guardado; Spot con solo fecha del cliente (misma fecha → error; anterior al pago → error; sábado → aviso y escribe V1 + punteros); asignar operador escribe solo `operadoresPorVisita.V1`; fallo de guardado (`permission-denied`) deja la fila igual; Escape cierra y el filtro de búsqueda se conserva; cliente con HTML se ve como texto (`window.__xss` sin definir); servicio en revisión muestra «—»; perfiles: dueño y administrador ven columna y botones (8 celdas por fila), **supervisor, operador y sin perfil no ven nada** (7 celdas, 0 botones), en Spot y en Planes.

## Decisiones tomadas (revisar)
1. El aviso de «fuera del día de ruta» también aplica a Spot (se usa el día de ruta del cementerio, como en Planes); solo avisa.
2. Un Spot cuya fecha sale de la que eligió el cliente: confirmar la misma fecha es error («Es la misma fecha…»), como en una visita ya fija de Planes.
3. Sin estado nuevo (`reprogramada`); solo se cambia fecha u operador.

## Despliegue y reversa
Solo Hosting desde `C:\Despliegue\GravecareOps` con el tag que se cree tras fusionar: `firebase deploy --only hosting:gravecare-ops --project gravecare-2e8d2`. Reversa de código: republicar `ops-planserv-20`. Los datos editados no se deshacen con eso: se corrigen editando de nuevo (salvo la fecha original del cliente en `fechaProgramada`, ver arriba). Recomendado: primera prueba real con un Spot de prueba y fecha futura.
