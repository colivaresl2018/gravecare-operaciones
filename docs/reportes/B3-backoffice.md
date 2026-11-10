REPORTE B-3 (backoffice) — 2026-11-09 — rama feat/b3-notas-credito (base: tag ops-2 = 657a161)

# REPORTE DE AVANCE
- **Fecha:** 2026-11-09 (Chile)
- **Directriz que atiendes:** B-3 (`docs/directrices/B3-notas-credito-gastos-ingresos.md`, copia de la rama `docs/ventana-cierre-2` del repo web, commit 01d70c7).
- **Rama y commits** (base: `ops-2`, que es `main` tras el PR #2; `feat/b2-pagadas` no tiene nada más):
  - `678fd65` feat(b3): lógica de notas de crédito (validación, avisos de plazo) y liquidación tributaria extraída y probada
  - `a932968` feat(b3): tipo «Nota de Crédito Electrónica» en Gastos e ingresos, acción en la fila de la boleta y avisos de plazo
  - `dd7dca4` test(b3): prueba de navegador con emuladores propios; docs: directriz B-3, regla notasCredito y procedimiento ops-3
- **Estado:** COMPLETA en código y pruebas. **Nada desplegado.** Pendiente: revisión del dueño, PR, merge, regla en el repo de la web, tag `ops-3` y despliegue (dueño).

## 1. Resumen
- Nuevo tipo «Nota de Crédito Electrónica» en `public/gastos-ingresos.html`. El portal **solo registra** folios (la boleta y la nota las emite el dueño ante el SII).
- Campos: folio de la nota, boleta de referencia (elegida de la lista; folio y fecha se muestran de ella), monto, motivo, fecha, **código de referencia** (1 anula / 3 corrige montos), **medio de devolución** (Reversa Transbank / Transferencia bancaria; sin datos bancarios), y opcionales visitas contratadas, visitas ejecutadas y término del servicio.
- La boleta se mantiene y la nota la compensa: dos filas visibles. La nota entra al libro con importes **negativos** en el mes de **su** fecha, así que resta del ingreso neto y del débito de IVA de ese mes.
- Acción «Registrar nota de crédito» en la fila de cada boleta con saldo por compensar; abre el formulario con la referencia, el código (1 si compensa todo, 3 si ya hay notas parciales) y el saldo pre-llenados.
- Las notas no se editan ni se eliminan desde el portal (sin botones; las reglas propuestas también lo impiden). Una boleta manual con notas tampoco se puede eliminar.
- Dos avisos **no bloqueantes** (se muestran en ámbar y se puede guardar igual): más de **6 meses** entre la fecha de la boleta y la de la nota, y más de **30 días** desde el término del servicio (solo si se informa). Plazos como constantes en `public/js/notas-credito.js` (`PLAZO_MESES_BOLETA_NOTA`, `PLAZO_DIAS_TERMINO_SERVICIO`).

## 2. Cambios realizados (+1245/-53 en 11 archivos; 4 en `public/`)
| Archivo | Tipo | Qué cambió |
|---|---|---|
| `public/js/notas-credito.js` | nuevo | Constantes, `validarNotaCredito`, `avisosNotaCredito`, `saldoDeBoleta`, `filaDeNota`, `desglosarBruto`. Lógica pura, sin Firebase |
| `public/js/liquidacion-tributaria.js` | nuevo | `calcularLiquidacion`: el cálculo que ya tenía la página, extraído para probarlo (igual lógica) + la nota como documento afecto |
| `public/gastos-ingresos.html` | mod. | Opción de DTE, bloque de campos de la nota (oculto salvo en modo nota), lectura de `notasCredito`, botón en la fila, validación antes de guardar. Se reemplazó el bucle de totales por `calcularLiquidacion`. Diff fuera de `<script>`: solo la opción y el bloque nuevo |
| `public/js/notas-credito.test.mjs`, `tests/b3-notas-credito-pagina.test.mjs` | nuevos | 21 pruebas unitarias + 9 estáticas |
| `tests/e2e/b3-notas-credito.e2e.mjs`, `package.json` | nuevo/mod. | Navegador contra emuladores; script `test:e2e:b3` |
| `docs/directrices/B3-…`, `docs/entregas/reglas-notasCredito.md`, `docs/entregas/publicar-ops-3.md`, `docs/entorno-local.md` | docs | Copia de la directriz, regla propuesta, procedimiento y entorno |

## 3. Contrato de datos con la web
- **`ordenes`: solo lectura** (`pagoConfirmado`, `estado`, `modoPago`, montos, `numeroOrden`, `fechaPago`). La única escritura a `ordenes` sigue siendo la que ya existía (adjuntar comprobante); una prueba lo fija.
- **`gastos_ingresos`: sin cambios** (ni un documento nuevo de nota ahí).
- **Colección nueva y aditiva `notasCredito`** (documento con monto en positivo): `folio`, `fecha`, `refOrigen`, `refId`, `refFolio`, `refFecha`, `refTotal`, `rut`, `concepto`, `montoBruto`, `neto`, `iva`, `motivo`, `codigoReferencia`, `medioDevolucion`, `visitasContratadas`, `visitasEjecutadas`, `fechaTerminoServicio`, `descripcion`, `archivoUrl`, `archivoNombre`, `registradoPor`, `createdAt`. La web no la lee.
- Campo opcional **`refFolioSii`** (folio SII de la boleta, solo dígitos): se propone con `ordenes.folioBoleta` si la orden lo trae (solo lectura) o con el folio de la boleta manual; se puede escribir o corregir a mano.
- **⚠ REGLA DE FIRESTORE NUEVA (aditiva) que hay que replicar en el repo de la web** (este repo no la publica): `docs/entregas/reglas-notasCredito.md`. Lectura y creación solo con `staffActivo`; actualizar y borrar, nunca. **Sin ella no se pueden guardar notas** (el libro sigue cargando igual: la lectura de `notasCredito` está protegida con `try/catch`). Orden: regla primero, Hosting después.
- `cuentaComoIngreso` no cambia (`estado === 'Confirmado'` y `modoPago !== 'integracion'`).

## 4. Pruebas
| Prueba | Resultado |
|---|---|
| `node --test tests/ public/js/` (suite completa) | **140 / 140** (antes 106; +34) |
| `npm run test:e2e:b3` (emuladores propios, `GC_OFFSET=1300`: sitio 6350, Firestore 9380, Auth 10399, Storage 10499) | **8 / 8** |
| `npm run test:e2e` (B-2, mismos emuladores) | **16 / 16** (sin regresión) |

Criterios de aceptación cubiertos:
- **Boleta de 100.000 + nota de 100.000 ⇒** el ingreso neto y el débito del mes bajan exactamente 84.034 y 15.966 (lo que aportaba la boleta): ingreso neto de esa orden 0 y débito 0. En lógica pura: boleta 100 + nota 100 ⇒ ingreso neto 0 y débito 0; la nota rebaja el mes de su fecha, no el de la boleta.
- **Nota sin boleta de referencia:** no se guarda (alerta; sin fila nueva).
- **Nota mayor que la boleta, o suma acumulada mayor:** no se guarda; parciales permitidas (150.000 + 50.000 sobre 200.000; una de 60.000 sobre un saldo de 50.000 se rechaza).
- **Listas de trabajo:** `ordenes.html` y las demás no cambian (B-2 16/16).
- **Avisos 6 meses y 30 días:** se muestran, y la nota se guarda igual.
- **Sin cambios de diseño:** solo texto nuevo y componentes existentes; ninguna otra página tocada. Ninguna petición salió a servicios reales de Firebase.
- Regla propuesta comprobada en el emulador: staff crea (200), actualizar y borrar 403, sin sesión 403.

## 5. Cómo verlo en localhost
Con los emuladores de la web abiertos (`npm run local` en el repo web; ahí el dueño usa puertos por defecto) cargando además la regla de `reglas-notasCredito.md`:
```powershell
cd C:\Proyectos\GravecareOpsPortal
node scripts/local/sembrar-emulador.mjs
node scripts/local/servidor-emuladores.mjs
```
Abre `http://localhost:5050/login-ops.html`, entra con el staff de prueba, ve a Gastos e ingresos y pulsa «Registrar nota de crédito» en la fila de una boleta. Con `GC_OFFSET` propio, ver `docs/entorno-local.md`.

## 6. Decisiones que tomé y que el dueño/PM puede cambiar
1. **Cómo «descuenta» `cuentaComoIngreso` (alcance d):** la nota es una fila negativa en el mes de su fecha; no cambié la función ni el valor de la fila de la orden (si no, el neto se restaría dos veces y el mes de la boleta quedaría alterado). El efecto pedido (ingreso neto 0 y menos IVA) se logra igual.
2. **Solo se puede referenciar una boleta electrónica de venta** (de orden Webpay o registrada a mano). Notas sobre facturas quedan fuera.
3. **Validaciones extra, no pedidas:** el folio de una nota no se repite; la fecha de la nota no puede ser anterior a la de la boleta; visitas ejecutadas ≤ contratadas (enteros ≥ 0); una boleta con notas no se elimina.
4. **Código 1 con monto parcial no se bloquea** (la directriz no lo pide). Si el contador lo exige, es una línea en `validarNotaCredito`.
5. Se acepta un archivo adjunto opcional al crear la nota (mismo botón «Subir Factura»); después no se puede cambiar.
6. El monto se ingresa con los campos existentes (neto + IVA 19 % = total); al elegir la boleta se propone el saldo.

## 7. Lo que dejo sin hacer / abierto
- **`ordenes.folioBoleta` (cambio del repo de la WEB, no hecho aquí):** la respuesta recibida el 2026-11-09 recomienda que la orden guarde el folio SII de la boleta. Ese campo lo escribe el servidor de la web al emitir, así que lo debe agregar el repo web (aditivo; actualizar `docs/10-contrato-de-datos.md`). Aquí solo se **lee**: si la orden trae `folioBoleta`, el formulario lo propone. Mientras no exista, el dueño puede escribir el folio SII a mano en la nota.
- Fuera de B-3, como se pidió: datos bancarios del cliente y pantalla de liquidación/devolución; emitir ante el SII; anulación en Transbank; flujo de pago de la web; textos del contrato. No escribí textos legales para clientes. Los avisos son internos para el staff y no citan artículos.
- **Tributario sin verificar:** solo el plazo de 6 meses se leyó en la BCN. Que se cuente desde la fecha de la boleta es criterio del contador (pendiente por escrito); régimen (Pro Pyme) y el plazo de 30 días en la práctica quedan a confirmar con el contador. Los plazos son constantes fáciles de cambiar.
- Un pendiente menor de la página (preexistente): la fecha por defecto del formulario usa `toISOString()` (UTC), por lo que de noche puede salir un día adelantado. No se tocó.
- `public/js/notas-credito.test.mjs` queda dentro de `public/js/` igual que las demás pruebas del repo (`*.test.mjs`) y se publicaría con el Hosting; es inofensivo, como las existentes.

## 8. Plan de despliegue y reversa (lo ejecuta el dueño; no desplegué)
Detalle en `docs/entregas/publicar-ops-3.md`.
1. Publicar la regla `notasCredito` desde el repo de la web (`docs/entregas/reglas-notasCredito.md`).
2. PR → merge → tag `ops-3` sobre `main` → clon limpio `C:\Despliegue\GravecareOps` → `firebase deploy --only hosting:gravecare-ops --project gravecare-2e8d2`; verificar con `node scripts/verificar-sitio-publicado.mjs ops-3`.
3. **Reversa:** consola de Firebase → Hosting → `gravecare-ops` → versión anterior (la de `ops-2`) → Revertir. Las notas ya guardadas quedan en `notasCredito` sin afectar nada; la regla se puede dejar o quitar.

## 9. Respuesta recibida el 2026-11-09 (folio SII, garantía de 6 meses, 30 días, régimen) y qué se hizo con ella
- **Hecho:** campo opcional de folio SII en la nota (punto 1 de la respuesta), con lectura de `ordenes.folioBoleta` si existe. Pruebas: 3 unitarias, 1 estática, 1 de navegador.
- **No hecho aquí:** agregar `folioBoleta` a `ordenes` y escribirlo al emitir la boleta (repo de la web; regla de oro 9 y contrato de datos).
- **No cambia el aviso de 6 meses:** el punto 2 de la respuesta habla de la garantía legal de la Ley 19.496 (cuándo reclama el cliente), que es otra cosa que el plazo del D.L. 825 entre boleta y nota. El aviso del portal sigue siendo el tributario leído en la BCN.
- **Los 30 días de la respuesta** (renovación automática, tarjetas rechazadas, F29) no son el plazo del art. 70 desde el término del servicio; el aviso de 30 días del portal queda como está.
- **Régimen:** la respuesta describe las dos opciones Pro Pyme pero no confirma cuál tiene la empresa. Sigue pendiente la consulta en el SII (el dueño o el contador).
- Las citas legales de esa respuesta siguen sin verificar en la fuente. Los datos personales y tributarios que traía no se copiaron a este repo.

## 10. Cierre de la publicación de ops-3 (2026-11-10)
- **Integración:** PR #3 fusionado en `main` (merge `8b4a1e3`, sin force) y tag `ops-3` sobre ese commit.
- **Reglas:** la regla aditiva de `notasCredito` ya estaba publicada desde el repo de la web antes del Hosting (tag `release/cierre-2-reglas-050` del repo web, según lo informado en la sesión de la web).
- **Despliegue del Hosting `gravecare-ops`:** hecho por el dueño desde `tags/ops-3`, con `--only hosting:gravecare-ops --project gravecare-2e8d2`. Según lo informado en la sesión de la web, la revisión de Gastos e ingresos con un staff real no mostró errores de permisos sobre `notasCredito`. Esta sesión no ejecutó ni observó el despliegue.
- **Verificación por lectura hecha en esta sesión (solo GET de archivos públicos):** `node scripts/verificar-sitio-publicado.mjs ops-3` → 39 archivos de `public/` en ops-3, 0 distintos, 0 sin publicar o con error (sitio `https://gravecare-ops.web.app`).
- **Pendiente fuera de este repo:** `ordenes.folioBoleta` (repo web) y las confirmaciones tributarias del apartado 7. Siguen abiertos.
- **Limpieza:** rama `feat/b3-notas-credito` (local y remota) eliminada tras el merge; el contenido queda en `main` y en el tag `ops-3`.
