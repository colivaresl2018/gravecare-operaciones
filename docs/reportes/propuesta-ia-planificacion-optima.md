# Propuesta — IA que revisa la planificación y la asignación de rutas («lo más óptima posible», solo sugerir)

**Fecha:** 2026-11-27 · **Estado:** PROPUESTA para decisión del dueño. **No se implementó nada y no se hizo ninguna llamada a la IA.**
**Pedido del dueño:** que la IA revise la planificación y la asignación de rutas para que sea lo más óptima posible. Alcance elegido: **solo sugerir**. La IA propone cambios de día, de operador o de orden dentro del eje, y el dueño **aprueba cada uno** antes de guardarlo; nada se escribe por su cuenta.
**Lo que se pidió definir antes de implementar:** cómo medir «óptimo» (qué criterio y qué datos usa).

## 1. Qué significa «óptimo» (propuesta)
«Óptimo» se mide con un **puntaje de problemas** (menos es mejor), calculado **en código** con datos que el backoffice ya tiene. La IA no calcula el puntaje: si lo calculara, nadie podría comprobarlo. Cada propuesta se evalúa en código **antes y después** de aplicarse.

### Reglas que nunca se rompen (la IA no puede proponerlas)
1. Una visita **realizada o en revisión** no se mueve ni se reasigna.
2. La fecha **no puede ser anterior a la fecha del pago** (misma regla que la edición de visitas).
3. **Servicios Spot:** su fecha la elige el cliente y no se mueve (directriz B5 §3); a lo más se les sugiere operador.
4. **Rancagua–Machalí no se mezcla con Santiago** (operador residente en Rancagua, B5 §7).
5. Una visita sin cementerio o sin eje conocido («Sin eje») **no se toca**: no hay base para medirla.

### Criterios que suman al puntaje (cada uno con su peso, que fija el dueño)
| # | Criterio | Cómo se mide | Meta |
|---|---|---|---|
| 1 | **Visita fuera de su día de ruta** | fecha de la visita cae en un día distinto al `diaSemana` del cementerio (`rutas`) | 0 |
| 2 | **Día no hábil** | sábado, domingo o feriado (`feriados`, nacional o de la región) | 0 |
| 3 | **Visita atrasada** | pendiente con fecha anterior a hoy | 0 |
| 4 | **Sin operador** | «Sin asignar» en visitas de la ventana revisada | 0 |
| 5 | **Carga desbalanceada** | visitas por operador y día: máximo y diferencia entre el que más y el que menos tiene; y las que pasan de un tope | bajo el tope |
| 6 | **Dispersión del operador** | cementerios y ejes distintos que visita el mismo operador el mismo día; km estimados entre paradas (coordenadas × 1,3, como en B5) | un solo eje por día |
| 7 | **Estabilidad** | cuántas visitas cambia la propuesta; se prefiere mover las de fecha tentativa (calculada) y evitar mover las ya confirmadas con el cliente | lo mínimo |

Pesos sugeridos para partir (a confirmar): 1, 2 y 3 pesan **mucho**; 4 pesa **medio**; 5 y 6 pesan **poco** (desempatan). Con esto el dueño ve, por ejemplo: «hoy 7 problemas; con estas 4 propuestas quedan 2».

### Datos que usa (todos ya existen; ninguno nuevo)
Órdenes pagadas y sus visitas (`esOrdenPagada`: fecha, operador, estado, si la fecha es tentativa, cementerio), `rutas` (eje y día por cementerio), `feriados`, personal activo (`staff`), coordenadas del catálogo de cementerios y la fecha de hoy. Se revisa la **ventana que el dueño elija** (semana o mes), hasta 200 visitas por revisión (el tope de la función de IA actual).

## 2. Cómo se aprobaría cada cambio
Un panel **solo para el dueño** (junto a «Sugerir rutas con IA»): muestra el puntaje actual y una lista de propuestas, cada una con su motivo y su efecto, por ejemplo «ORD-12 · Visita 2 de 4: pasar del lunes 7/12 al martes 8/12 (día de ruta del Parque X) → −1 fuera de ruta». Cada propuesta tiene **Aprobar** y **Descartar**.
- **Aprobar** usa **el mismo guardado de la edición de visitas (B7)**: confirmación en dos pasos y un solo `updateDoc` con las claves de esa visita. No se agrega ninguna otra escritura.
- Tras cada aprobación se **recalcula** el puntaje y las demás propuestas (dependen unas de otras).
- Sin clic del dueño no se guarda nada. Como en toda la edición, la restricción por rol es de pantalla; las reglas de `ordenes` están en el repo de la web.

## 3. ¿Cuánto debe hacer la IA? Tres opciones
| Opción | Qué hace la IA | Costo y cuota | Riesgo |
|---|---|---|---|
| **A. Solo reglas** (sin IA) | Nada: el código detecta cada problema y propone el arreglo válido (próximo día de ruta, operador con menos carga). | **Cero** consultas y cero Vertex; resultado repetible y explicable. | Menos flexible con casos raros. |
| **B. Reglas + IA (recomendada si se quiere IA)** | El código arma las propuestas válidas; la IA elige entre ellas y redacta el motivo. | 1 consulta por revisión (de las 5 diarias compartidas) y costo en Vertex. | Bajo: todo se vuelve a validar en código. |
| **C. IA propone libremente** | Propone cualquier cambio. | 1 consulta por revisión. | Alto: puede sugerir cambios inválidos; habría que filtrar casi todo en código igual. |

**Recomendación:** empezar por **A** (medir y sugerir sin IA), porque casi todo lo medible es calculable y así el dueño ve el puntaje desde el primer día sin gastar cuota; pasar a **B** solo si el dueño ve que las reglas no bastan. Es el dueño quien decide si quiere IA desde el inicio.

## 4. Restricciones técnicas
- La función de IA que existe (`sugerirRutasIA`, en el repo de la web) **solo recibe ids de visitas, cementerios y operadores**: no conoce días, ejes, feriados ni carga. Reparte por cementerio. **No sirve tal cual** para este pedido.
- Para las opciones B o C hace falta una **función nueva en el repo de la web** (o ampliar la actual). Este repo no modifica el repo de la web (regla 9): requiere una directriz/spec del PM en ese repo y su publicación. **La opción A se hace completa en este repo**, sin tocar la web ni las reglas.
- **Cuota:** 5 consultas por usuario y día, compartidas con el informe, la factura y las rutas. Subir el tope es un cambio de la spec 081 (web).
- **Costo:** no tenemos aún el costo real de una consulta (no se ha hecho la primera prueba real). Una revisión de 100–200 visitas pesa más que un informe: conviene medirlo antes de dar uso diario.
- **Orden dentro del eje:** hoy **no existe un campo de orden de parada** (ni en `rutas` ni en las visitas; el orden de B5 vive solo en la planilla). Propongo que el orden sugerido se **calcule** (vecino más cercano por coordenadas) y se **muestre sin guardarlo**. Guardarlo exigiría un campo nuevo en `rutas` (aditivo), con directriz expresa y revisión del contrato con la web.
- **Coordenadas:** B5 detectó que Parque del Recuerdo Rancagua y Parque Sendero Rancagua tienen la misma coordenada; los km de esos cementerios no son confiables hasta aclararlo.

## 5. Qué necesito que decida el dueño
1. ¿Aprueba los **criterios** de §1 y su **prioridad** (¿cuál pesa más: cumplir el día de ruta, equilibrar la carga o reducir traslados?)?
2. **Tope de visitas por operador y por día** (hoy no existe ese dato) y si el operador de Rancagua se mide aparte.
3. ¿Qué manda para el día de cada cementerio: lo que hoy está cargado en `rutas` o la distribución de la directriz B5 (decisión 1 de B5 §6, aún abierta)? La revisión usará lo que esté en `rutas`; si falta (todo «Sin eje»), no habrá nada que medir.
4. **Spot:** ¿se confirma que solo se les sugiere operador y no fecha?
5. **Planes:** ¿se pueden proponer cambios a visitas con fecha ya confirmada con el cliente, o solo a las tentativas? (Recomendado: solo tentativas por defecto.)
6. **Opción A, B o C** de §3, y si se acepta el trabajo en el repo de la web para B o C.
7. **Orden dentro del eje:** ¿solo informativo (recomendado) o con campo nuevo guardado?
8. **Ventana de revisión:** ¿semana, mes o ambas?
9. ¿Se aclara el tema de las coordenadas de Rancagua (B5)?

## 6. Plan si el dueño aprueba (no empezado)
1. Módulo puro `puntaje-planificacion.js` con los criterios 1–7 y sus pruebas (sin IA, sin Firebase).
2. Panel del dueño que muestra el puntaje y las propuestas por reglas (opción A), con **Aprobar/Descartar** sobre el guardado de B7. Una PR; el dueño aprueba antes de fusionar y de desplegar.
3. Solo si se elige B o C: directriz al repo de la web para la función nueva, y luego la pantalla.

Cada etapa con su reporte, su PR y su tag; despliegue solo por el dueño.
