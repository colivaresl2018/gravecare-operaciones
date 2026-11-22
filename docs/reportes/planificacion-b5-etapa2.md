# Directriz B5, etapa 2 — Compra de flores y Valores de ramos

**Fecha:** 2026-11-22 · **Rama:** `feat/planificacion-b5-etapa2` (desde `main` con la etapa 1 fusionada) · **Estado:** listo para revisión (PR a `main`). **No desplegado**: el despliegue lo ejecuta el dueño.
**Autorización:** el dueño autorizó la etapa 2 en la conversación el 2026-11-22, una vez publicada la etapa 1 (`ops-planserv-5`). **Referencias:** `docs/directrices/B5-planificacion-pestanas.md` (repo `gravecare`), spec 056 (R5 y R6) y spec 055.

## Qué se hizo
En `public/planificacion-servicios.html`, dos pestañas nuevas (ahora son 7):
- **Compra de flores** (solo lectura). Semana de lunes a domingo con barra Anterior / Hoy / Siguiente. Por cada día y cementerio: cuántos ramos hay que comprar, con precio unitario y subtotal. Reglas (spec 056 R6): **1 ramo del nivel contratado por visita**, más los **ramos adicionales** de la orden (del mismo nivel; **Deluxe no admite adicionales**). Entran las visitas de Planes y los servicios Spot, en su fecha real o tentativa. Tarjetas de resumen (visitas, ramos, total de la semana, detalle por tipo) y avisos.
- **Valores de ramos** (la **única pantalla que escribe**). Formulario con los cinco valores (`standard`, `premium`, `deluxe`, `adicionalStandard`, `adicionalPremium`, en pesos por ramo). Guarda en `valores_ramos/compra` con `actualizadoEn` y `actualizadoPor` (uid de quien guarda), usando `merge`.

## Reglas aplicadas
- **No se inventan precios.** Los precios salen solo de `valores_ramos/compra`; no hay ninguno escrito en el código (una prueba lo impide). Un valor que falta deja esa línea «sin valor» y el total «incompleto» (con el aviso de cuáles faltan). Un `0` guardado sí es un valor.
- **Solo se escribe ese documento**: los 5 valores + quién y cuándo. Ninguna otra colección ni campo (no se tocan `ordenes`, `staff`, etc.). Hay una sola llamada de escritura en todo el código nuevo.
- **Las reglas ya estaban publicadas** (`valores_ramos`: lee y escribe cualquier staff con claim; release `reglas-planificacion-2026-11-22`). No se agregó ninguna regla ni archivo de reglas a este repo.
- Si la lectura de los valores falla, la pantalla sigue (todo «sin valor») y lo avisa. Si guardar falla por permisos o red, se avisa con un texto claro y el botón se vuelve a habilitar.
- Todo dato de Firestore (nombres de cementerio, valores) pasa por `esc()` (AUD-01).
- Sin cambios en el Gantt (`planificacion.html`), en `PERMISOS_PAGINAS`, `titulosModulos`, el menú ni las reglas.

## Decisiones mías (a revisar)
1. **«Órdenes de Compra» (la tercera pestaña de la etapa 2) NO se implementó en este PR.** La directriz la deja ligada a la spec 055, que sigue en **borrador sin aprobar** y con decisiones abiertas del dueño (RUT y dirección de GraveCare para el encabezado, condiciones de pago, IVA, quién anula, retención de datos). Además **no hay reglas publicadas** para `materiales`, `ordenesCompra` ni `contadores`: sin ellas, cualquier lectura o escritura sería rechazada en producción, así que no se habría podido probar ni usar. Una prueba comprueba que el código no toca esas colecciones. Cuando el dueño apruebe la 055 y las reglas estén publicadas, se hace en un PR aparte (maestro de materiales, numeración en transacción, OC inmutables, enmienda 056 §12: los precios de los ramos del maestro salen de `valores_ramos/compra`).
2. **Un campo vacío no se escribe** (no borra un precio ya guardado): solo se puede reemplazar por otro valor. Es más seguro frente a un borrado por descuido. El formulario lo dice.
3. **Formato de los números estricto**: solo dígitos, con punto como miles y coma decimal (`12.000`, `$ 12.000`, `12,5`→13). Algo como `12x` o `12.5` se rechaza y no se guarda nada. (Una prueba nueva detectó que la primera versión aceptaba `12x` como 12.)
4. **Las visitas ya completadas no se compran** (por defecto no entran en la lista); hay un casillero «Incluir visitas ya completadas».
5. **`actualizadoEn`** se guarda como texto ISO (`2026-11-22T15:30:00.000Z`), igual que la versión previa de la rama antigua; la regla no impone un tipo. Si la web espera un `Timestamp`, es un cambio de una línea.
6. **Los textos existentes no se cambiaron**: el subtítulo sigue diciendo «Vista de consulta: las fechas y los operadores se cambian en «Planificación & Gantt»» (sigue siendo cierto: esta etapa no reprograma ni asigna). Queda pendiente decidir ese texto aparte (ver reporte de la etapa 1).

## Archivos
- **Nuevos:** `public/js/compra-ramos.js`, `compra-vistas.js`, `valores-ramos-db.js` y sus `.test.mjs`; este reporte.
- **Modificados:** `public/planificacion-servicios.html` (2 pestañas, 2 paneles, imports de `getDoc`, `doc`, `setDoc`), `tests/planificacion-servicios-paginas.test.mjs` (la prueba de «solo lectura» de la etapa 1 pasa a «solo escribe los valores de ramos»; la de «5 pestañas» acepta las 2 nuevas).
- Las rutas de los módulos nuevos llevan `?v=b5e2` para que el navegador no use copias viejas.

## Pruebas
`node --test tests/ public/js/` → **519 pasan, 0 fallan** (antes, con la etapa 1: 475). 44 pruebas nuevas: reglas de ramos por visita y Deluxe, precios y totales, «sin valor» e incompleto, completadas, semana, Spot, formato de números, lectura y escritura con Firestore simulado (solo los 5 campos + quién/cuándo, `merge`, rechazo de valores inválidos, campos vacíos, falla de permisos), HTML escapado y estructura de la página (7 pestañas, una sola escritura, sin precios en el código, sin `materiales`/`ordenesCompra`/`contadores`).
**Verificado en el navegador con datos ficticios** (Firebase sustituido por un módulo local): la lista suma 24 ramos de 15 visitas con los precios guardados; faltantes → «sin valor» e «incompleto»; al guardar los valores que faltaban, el total pasa a completo sin recargar; un valor inválido (`12x`) no escribe nada; una escritura válida hace exactamente una escritura en `valores_ramos/compra` con `merge`; lectura fallida y permiso denegado se avisan y la pantalla sigue; las otras 5 pestañas siguen funcionando; sin desborde horizontal a 375 px.
**No se probó** con las órdenes, los valores ni los permisos reales de producción, ni con emuladores.

## Despliegue y reversa
- **Despliegue (lo ejecuta el dueño):** clon limpio en el tag nuevo (sugerido `ops-planserv-6`) y `firebase deploy --only hosting:gravecare-ops --project gravecare-2e8d2`. Antes de desplegar, comprobar `git describe --tags` (debe decir el tag nuevo) y que la salida diga **«found 79 files»**: así se evita repetir el caso de la etapa 1, en que se publicó un clon viejo.
- **Después de publicar:** el dueño carga los cinco valores en «Valores de ramos» (nadie los sembró: la spec dice que los carga él). Hasta entonces todas las líneas salen «sin valor».
- **Reversa:** volver a publicar el tag anterior (`ops-planserv-5`) o usar el historial de versiones de Hosting. Los valores guardados en `valores_ramos/compra` no se borran (no hay nada que deshacer de datos).

## Pendiente
- **Órdenes de Compra** (spec 055): decisión 1 de esta lista. Necesita aprobación de la spec, reglas publicadas y las decisiones abiertas del dueño.
- Mismos pendientes de la etapa 1 (texto del subtítulo, carga de `rutas` y `feriados`, retiro del Gantt con paridad aprobada, permisos por rol R7 junto con la etapa que reutilice las escrituras del Gantt).
