# B6 / spec 082 — Etapa 3: «Sugerir rutas con IA» en Planificación (solo dueño)

**Fecha:** 2026-11-27 · **Rama:** `feat/082-ia-rutas-etapa3` (desde `main`, `f54da4a`; último tag `ops-planserv-22`) · **Estado:** listo para revisión (PR a `main`). **No desplegado**: lo despliega el dueño. **No se hizo ninguna llamada real a la IA, a Vertex ni a Firebase**: todo se probó con funciones y Firestore simulados.
**Autorización:** directriz B6 y spec 082 (R15–R16, CA8–CA9); el dueño pidió esta etapa tras desplegar la etapa 2 (`ops-planserv-22`, verificada en vivo). Con esta etapa termina la directriz B6.

## Qué se agregó (solo aditivo)
En `public/planificacion-servicios.html`, sobre las pestañas, un bloque plegable **«Sugerir rutas con IA (solo dueño)»** (cerrado por defecto, **oculto para todos menos el dueño**):
- **Fecha** (por defecto hoy) y **casillas de operadores** (personal activo, todos marcados al inicio).
- Línea de resumen: «5 visitas pendientes ese día en 3 cementerios. 1 sin cementerio conocido no se incluyen.»
- Aviso fijo (R5): «La IA puede equivocarse: revisa antes de usar. No escribas RUT, correo ni teléfono.»
- **«Sugerir rutas»**: llama a `sugerirRutasIA({ fecha, sepulturas, operadores })` y muestra el itinerario **por operador, agrupado por cementerio**, con el resumen «5 visitas · 3 cementerios · 3 operadores».
- **«Ver última sugerencia»**: relee `rutasSugeridas/{fecha}` (solo lectura) y la muestra igual (R16).
- Mientras responde (hasta 120 s) los dos botones quedan deshabilitados y el primero dice «Pidiendo sugerencia…»; un doble clic hace **una sola** llamada (R2).
- El SDK de Functions se carga **solo al pulsar** (import dinámico): si no llega, falla solo la IA y la pantalla sigue (R6).

Archivos: `public/js/ia-rutas.js` (lógica sin SDK ni DOM real, nuevo; reutiliza `mensajeErrorIA` y `MENSAJE_GENERICO` de la etapa 1), su prueba, `public/planificacion-servicios.html` (+ bloque HTML, un `import`, tres variables, funciones del bloque, 1 línea del perfil que ahora guarda el perfil leído, y `prepararRutasIA()` al final de `pintarTodo`) y `tests/planificacion-ia-rutas-pagina.test.mjs`. Edición de visitas (B7), matrices, compra, valores y resumen **no se tocaron**.

## Reglas de la spec cubiertas
- **R15 / CA8:** solo el dueño (`staff/{uid}.dueno === true`, el mismo criterio que aplica la función) ve el bloque; administrador, supervisor, operador y sin perfil **no lo ven ni se llama a la función**. Si alguien la llamara a mano, la función responde «Solo el dueño puede usar esta función.» (y la pantalla lo muestra igual).
- **R15:** fecha real, de 1 a 200 sepulturas y de 1 a 20 operadores; si no cumple, se avisa **sin llamar** (y sin gastar una de las 5 consultas).
- **CA9:** la respuesta se **vuelve a comprobar en la pantalla**: cada sepultura pedida aparece exactamente una vez, bajo su cementerio, con un operador elegido y sin sobrantes. Si no cuadra, no se muestra (mensaje genérico). Con 5 sepulturas y 3 operadores se vieron las 5 una vez cada una.
- **R16:** el resultado es **solo texto**: sin botones ni enlaces que lo apliquen. La pantalla **no escribe en Firestore** (0 escrituras en las pruebas), no toca `rutas/{idCementerio}`, órdenes, agenda ni personal.
- **R3 / CA10 / CA12:** errores de la función tal cual (cuota, permisos); de red o técnicos, el mensaje genérico; el resto de la pantalla sigue.
- **R4 / CA11:** nombres de operador, de cementerio y de cliente con HTML se ven como texto (`textContent`); `window.__xss` quedó sin definir.
- **Privacidad:** a la función viajan **solo ids** (`id` de visita, `cementerioId`, `uid` de operador). Nunca nombres de clientes, difuntos ni personal; los nombres se usan solo para mostrar en la pantalla.

## Pruebas
- `public/js/ia-rutas.test.mjs` (20) y `tests/planificacion-ia-rutas-pagina.test.mjs` (9). Primero en rojo (módulo inexistente y 7 de 9 fallando), luego en verde.
- Una prueba fijada de la spec 058 **actualizada a propósito** (no borrada): «el SDK de Functions se carga solo aquí…» ahora permite una única referencia en `planificacion-servicios.html`, bajo demanda y sin import estático; el resto de pantallas siguen sin cargarlo.
- `node --test tests/ public/js/` → **1010 pasan, 0 fallan** (antes 981).
- **Navegador, con Firebase y funciones ficticios** (nada sale a la red; servidor local detenido, pestaña cerrada): el dueño ve el bloque; fecha con 5 visitas pendientes en 3 cementerios (1 sin cementerio omitida y contada; una en revisión y otra de otro día quedan fuera); doble clic = 1 llamada con solo ids; itinerario correcto; cuota, red y respuesta que no cuadra muestran su mensaje sin resultado; sin operadores o sin visitas no se llama; «Ver última sugerencia» con y sin documento guardado; 0 escrituras; HTML hostil como texto; **administrador, supervisor, operador y sin perfil no ven el bloque**; móvil 375 px sin desborde.

## Decisiones tomadas (revisar)
1. **Dónde va:** un bloque plegable sobre las pestañas (visible desde cualquiera de ellas, porque la sugerencia mezcla Planes y Spot). La spec solo dice «en Planificación».
2. **Qué es una «sepultura pendiente»:** cada **visita** (Planes o Spot) con la fecha elegida que **no esté realizada ni en revisión**; incluye las de fecha tentativa. Su `id` es `<ordenId>-V<n>`. Una visita sin cementerio conocido (o con un id que la función rechazaría) **no se incluye** y la pantalla dice cuántas.
3. **`cementerioId`:** las órdenes no traen id de cementerio, solo su nombre; se usa un identificador derivado del nombre («Parque del Recuerdo» → `parque-del-recuerdo`). Sirve para agrupar y volver a mostrar el nombre; **no se escribe en `rutas/{idCementerio}`**.
4. **Operadores:** se ofrece todo el personal activo, todos marcados; el dueño desmarca a quien no salga ese día (`staff` no distingue de forma fiable operadores de administradores). Hasta 20.
5. **Una sugerencia por día:** la función **reemplaza** `rutasSugeridas/{fecha}` cada vez que se pide; pedir otra para la misma fecha sobrescribe la anterior (comportamiento de la función, no cambió).
6. **Relectura:** los nombres de cementerio y de visita salen de lo cargado hoy; si una visita ya no está (se hizo o se movió), se muestra su identificador.
7. **La sugerencia no se aplica.** Para cambiar un operador o una fecha el dueño usa la edición de la etapa B7, a mano, como hoy.

## Antes de usarla de verdad (del dueño)
- Cada llamada real gasta **1 de las 5 consultas diarias** (compartidas con informe y factura) y tiene costo en Vertex. Primera prueba real: una sola, con datos ficticios o un día de pocas visitas; revisar `ia_operaciones` y el costo.
- La regla `rutasSugeridas` (lectura para personal) ya está publicada según la spec 082; si la relectura da «No se pudo leer la sugerencia guardada», es lo primero que hay que revisar.
- La IA reparte por cementerio; **no usa ejes, días de ruta, feriados ni distancias**. Es una ayuda para revisar, no un plan listo.
- Pendiente de decisión del dueño (spec 082, riesgo 5): `rutasSugeridas` se acumula por fecha; limpiarla o dejarla.

## Despliegue y reversa
Hosting solo, desde `C:\Despliegue\GravecareOps` con el tag que se cree tras fusionar: `firebase deploy --only hosting:gravecare-ops --project gravecare-2e8d2`. Reversa: republicar `ops-planserv-22`; se quita el bloque y los documentos `rutasSugeridas` que haya creado la IA no estorban (el backoffice anterior los ignora).
