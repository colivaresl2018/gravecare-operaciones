# DIRECTRIZ DEL PM B-3 (proyecto del BACKOFFICE) — Notas de crédito en «Gastos e ingresos» (BORRADOR, pendiente de aprobación)

> **Estado:** decisiones aprobadas por el dueño el 2026-11-09 (preguntas 1 a 3 abajo). Falta que el PM emita la directriz para ejecutarla. Se ejecuta en una sesión abierta en `C:\Proyectos\GravecareOpsPortal`, no desde la web (regla de oro 9).
> **Origen:** instrucción del dueño: «Si hay anulación en el portal de operaciones hay que agregar notas de crédito en Gastos e ingresos».

## Hallazgo (solo lectura, rama `feat/b2-pagadas`, `cce6dd0`)
- El portal **no tiene anulación**: ninguna página cambia el estado de una orden a anulada.
- `public/gastos-ingresos.html` ofrece como tipos de documento: Factura Electrónica Afecta, Factura Exenta, Boleta de Honorarios y Boleta Electrónica de Venta (líneas 259 a 262). **No hay Nota de Crédito.**
- Los ingresos por órdenes se generan solos (`cuentaComoIngreso`, líneas 865 a 880). Una orden anulada, si llegara a tener `pagoConfirmado: true`, seguiría contando como ingreso.
- La anulación real hoy ocurre en el portal de Transbank, fuera de este sistema.

## Decisiones del dueño (2026-11-09)
1. **¿Quién emite la boleta y la nota de crédito ante el SII?** **Respuesta: el dueño las emite.** El portal solo registra el folio de la boleta y de la nota. Ya no hace falta un proveedor de DTE para este cambio. El sistema no emite documentos tributarios: las boletas que aparecen en el portal se registran a mano o se importan.
2. **¿Qué pasa con la orden original?** **Aprobado: mantener la boleta y compensarla con la nota.** 
3. **¿Quién puede anular?** **Aprobado: solo staff con permiso, con motivo obligatorio.** Claim `staffActivo` y motivo obligatorio.

## Alcance aprobado
1. Nuevo tipo de documento **«Nota de Crédito Electrónica»** en el formulario de gastos e ingresos, con campos: folio de la nota, folio y fecha de la boleta de referencia, monto, motivo y fecha.
2. La nota **resta** del débito fiscal (IVA) y del ingreso del mes de su fecha. Las dos filas quedan visibles.
3. Acción **«Registrar nota de crédito»** en la fila de la boleta, que pre-llena la referencia. Sin borrar la boleta (regla de oro 2).
4. El cálculo de ingresos (`cuentaComoIngreso`) descuenta las notas que referencian una orden. Una orden con nota de crédito completa no suma ingreso neto.
5. Las notas no se pueden editar después de guardarlas: solo se anulan con otra nota, para dejar trazabilidad.

## Criterios de aceptación (propuestos)
- Con una boleta de 100 y una nota de crédito de 100 por la misma orden, el ingreso neto del mes es 0 y el débito de IVA baja en 19 %.
- Una nota sin boleta de referencia no se guarda.
- Una nota con monto mayor que la boleta no se guarda.
- Las listas de trabajo no cambian (siguen mostrando la orden con su estado).
- Sin cambios de diseño ni textos fuera de los nuevos, que van en español con los componentes existentes.

## Restricciones
- Contrato de datos con la web: solo lectura de `ordenes` (`pagoConfirmado`, `estado`, `numeroOrden`). No se renombran campos ni colecciones.
- Nueva colección o campo solo de forma aditiva (por ejemplo `notasCredito`), sin tocar `gastos_ingresos` existentes.
- Pruebas con emuladores propios del backoffice; nunca producción.
- Sin despliegue: lo ejecuta el dueño desde un clon limpio con tag, como B-2.

## Lo que queda fuera
- Emitir la nota ante el SII: la hace el dueño fuera del sistema.
- La anulación en Transbank (es un paso manual en su portal).
- Cambios en el flujo de pago de la web.

## Aportes del contador (respuesta recibida el 2026-11-09; falta su firma y confirmar los puntos marcados ⚠)
Respuesta a la carta sobre notas de crédito y término anticipado. Lo que cambia o precisa el alcance de arriba:
1. **Plazo de emisión:** el contador dice que la nota rebaja el débito del **mes en que se emite**, sin importar cuántos meses antes se emitió la boleta, y que no rectifica el F29 anterior. ⚠ **Confirmar por escrito:** el límite de 3 meses desde la boleta para rebajar el débito (art. 57 del D.L. 825) no fue mencionado y es el punto que más afecta a los planes anuales. Los artículos que cita (21 y 22) tampoco están verificados aquí.
2. **Referencia al DTE:** la nota referencia tipo 39 (boleta electrónica), folio y fecha de la boleta. Código 1 anula el documento completo; para una devolución parcial corresponde código 3 (corrige montos). **Agregar al formulario:** campo «Código de referencia» (anula / corrige montos).
3. **Notas parciales:** válidas por el monto bruto devuelto. La **suma de las notas de una boleta no puede superar su monto bruto** (ya está en los criterios; se confirma). No hay límite de cantidad de notas por boleta.
4. **Motivo con detalle:** el texto de la nota debe indicar visitas contratadas, visitas no realizadas y boleta de origen (ejemplo del contador: «Devolución proporcional por 6 visitas no realizadas correspondientes al Plan Anual según boleta electrónica N° X»). **Agregar:** motivo de texto libre más campos opcionales «visitas contratadas» y «visitas ejecutadas» para dejar el cálculo.
5. **Respaldo por cada devolución (legajo):** contrato o términos aceptados, solicitud del cliente con su causal, boleta y nota, cálculo de visitas contratadas vs. prestadas, comprobante de la devolución. Conservación **mínimo 6 años**. El portal solo registra los folios y el cálculo; los documentos los guarda el dueño.
6. **Tratamiento en renta (F22):** el contador asume base de flujo (Pro Pyme 14 D N°3 u 8): el ingreso es el neto percibido, y una devolución posterior se resta en el año en que se paga. Coincide con el diseño: la nota resta del mes de su fecha. ⚠ **Confirmar el régimen real de la empresa.**
7. **Reagendar una visita no realizada** (sin devolver dinero): no se emite nota ni documento; basta el registro en la ficha del cliente y el correo con la nueva fecha. El portal no debe exigir nota en ese caso.
8. **Comisión de Transbank no devuelta:** sigue siendo gasto y su IVA crédito se mantiene. No requiere cambios en el portal.

### Puntos que el contador no cubrió o que hay que contrastar
- **Medio de devolución:** el contador acepta transferencia. Pero una venta pagada con Webpay normalmente se devuelve por la **anulación en Transbank** (a la misma tarjeta). ⚠ Verificar con Transbank qué plazo y qué medio permite, y reflejar en la nota cuál se usó (campo «medio de devolución»: anulación Transbank / transferencia).
- **Cálculo de la devolución:** la respuesta usa «tarifa unitaria o prorrata según contrato». El informe del abogado propone precio ÷ número de visitas. ⚠ Falta que el contrato diga la fórmula (niveles Standard/Premium/Deluxe y ramos adicionales no aparecen en ninguna de las dos).
- **Pruebas en producción:** una compra de prueba con boleta emitida requiere su nota de crédito; no consultado. Registrar la compra de prueba como tal (`modoPago`) y no mezclarla con ventas.
- **Resciliación vs. retracto:** el contador trata solo el término por acuerdo. La devolución por retracto (10 días) quedó en la consulta al abogado.

## Segunda respuesta del contador (2026-11-09): puntos ⚠ y vacíos
Las citas legales de esta respuesta (art. 57 y art. 21 N°2 del D.L. 825, Oficios SII 1.815/2018 y 2.451/2019, art. 126 del Código Tributario, plazos de Transbank) **no están verificadas en este repositorio**; hay que confirmarlas en la fuente o por escrito antes de publicar textos al cliente.
1. **Límite de 3 meses (confirmado por el contador):** si la devolución por término voluntario ocurre **dentro de 3 meses desde la boleta**, la nota rebaja el débito de IVA sin reparo. **Después de 3 meses** no se recupera el IVA vía nota ordinaria: el IVA ya pagado sería costo, o habría que pedir devolución administrativa (art. 126 CT, lento). Esto contradice la respuesta anterior («sin importar los meses»); prevalece esta. Efecto en el portal: la nota de crédito debe **advertir** si su fecha supera 3 meses desde la fecha de la boleta («el IVA podría no ser recuperable»), sin bloquear el guardado.
2. **Régimen:** el contador supone Pro Pyme (14 D N°3 u 8), base de flujo. Lo verifica el dueño en Mi SII > Datos tributarios > Régimen tributario. Pendiente.
3. **Medio de devolución:** opciones `Reversa Transbank (misma tarjeta)` y `Transferencia bancaria directa`. La reversa suele estar disponible solo unos 90 a 120 días según el contador (⚠ verificar con Transbank). Si es transferencia, se registran titular (RUT igual al del contratante), banco, tipo y número de cuenta y el comprobante. **Son datos bancarios de clientes:** guardarlos fuera de las colecciones de lectura amplia, con acceso solo de staff, y revisar con el abogado de datos personales antes de implementarlos (spec aparte).
4. **Fórmula propuesta por el contador:** `devolución = precio pagado − (tarifa de visita base del plan × visitas realizadas + adicionales ya entregados)`. La pantalla de liquidación desglosa: total pagado, menos visitas ejecutadas × valor unitario, menos adicionales ya suministrados, saldo bruto a devolver. Un ramo ya colocado no se reembolsa. Esto **reemplaza** la idea de dividir el precio por el número de visitas y exige que el contrato diga el valor unitario de cada nivel (Standard, Premium, Deluxe) y de los adicionales. La **parte contractual la revisa el abogado.**
5. **Compras de prueba en producción:** la boleta emitida se anula de inmediato con nota **código 1** en el **mismo mes**, para neutralizar el débito en el mismo F29.
6. **Retracto (10 días, art. 3 bis Ley 19.496):** sin visita prestada, nota código 1 por el 100 % y reembolso íntegro; si ya se prestó una visita con consentimiento expreso, se descontaría esa prestación. ⚠ Lo confirma el abogado.

### Riesgo a derivar al abogado (no resolver en el sistema)
El contador propone que, en un término voluntario posterior al mes 3, el contrato **descuente al cliente el IVA no recuperable**. Eso podría chocar con las normas de contratos de adhesión (arts. 16 y 25 de la Ley 19.496) o con el informe del abogado sobre devolución proporcional. No debe quedar en los términos del sitio sin su visto bueno.

### Tercera respuesta del contador (2026-11-09): citas y alternativa contractual
**Todo lo siguiente sigue sin verificar en la fuente.** Sirve como lista de comprobación, no como respaldo.
- **Citas a comprobar en la BCN y en el ACN del SII:** art. 21 N°2 del D.L. 825 (rebaja del débito por servicios resciliados dentro de 3 meses), art. 57 (obligación de emitir nota), art. 126 N°2 del Código Tributario (devolución de impuesto pagado de más, vía lenta). Ojo: la respuesta ubica el plazo de 3 meses unas veces en el art. 57 y otras en el art. 70 inc. 2°; hay que fijar en cuál está realmente. Los oficios del SII citados antes (1.815/2018 y 2.451/2019) no se reiteraron: pedir número y fecha.
- **Alternativa al descuento del IVA** (propuesta del contador, para el abogado): en vez de descontar el IVA no recuperable, el contrato fijaría un precio de lista Spot y un precio de plan con descuento por permanencia; si el cliente termina por su voluntad, las visitas realizadas se recalculan a precio de lista. Es una **interpretación comercial, no una garantía de legalidad**: también puede revisarse como cláusula penal o de terminación bajo los arts. 16 y 25 de la Ley 19.496. Requiere que el sitio publique ambos precios y el abogado la apruebe antes de cambiar los términos. Depende además de la tarifa Spot vigente en `functions/tarifas.js`.
- **Transbank:** el límite de anulación de Webpay Plus (crédito ~90 días; débito, menos) se comprueba en el portal privado de Transbank, módulo Transacciones > Anulaciones, para el código de comercio de producción. Lo hace el dueño.

### CORRECCIÓN VERIFICADA (2026-11-09): el plazo es de 6 meses, no de 3
Se leyó el texto del D.L. 825 en la BCN (`bcn.cl/leychile`, idNorma 6369; la página no indica la fecha de la versión). El art. 21 N°2 dice que se deduce lo restituido por «servicios resciliados» si la resciliación ocurre «dentro del plazo de **seis meses** establecido en el inciso segundo del artículo 70», y el art. 70 repite los seis meses y agrega que la devolución del impuesto «deberá solicitarse dentro de los **treinta días** siguientes» a que la venta quede sin efecto. El art. 57 no fija plazo (solo obliga a documentar con nota). Por lo tanto:
- Las respuestas del contador que hablan de **3 meses** (y de «90 días») **no coinciden con el texto leído**; quedan reemplazadas por **6 meses**. Antes de fijarlo, confirmar con el contador y con el SII que no hay una reforma o criterio posterior a la versión de la BCN.
- La advertencia no bloqueante del portal se configura a **más de 6 meses entre la fecha de la boleta y la fecha de la nota**, con el mismo texto de aviso.
- Nuevo: la nota debe emitirse **dentro de 30 días** desde que el servicio queda sin efecto (art. 70). Mostrar la fecha de término del servicio (opcional) y avisar si la fecha de la nota supera 30 días.
- La alternativa contractual de «tarifa Spot» (arriba) se evalúa de nuevo: con 6 meses, un plan de 12 visitas con término en el mes 4 o 5 **sí** recupera el IVA. El problema de IVA no recuperable solo aparece después del mes 6, lo que reduce el riesgo que motivó esa cláusula.

### Nota de cierre (2026-11-09): alcance de los 30 días y cómputo de los 6 meses
Se releyó el art. 70 en la BCN (idNorma 6369). Su estructura literal: el **inciso primero** dice que si una venta queda sin efecto por «resolución, resciliación, nulidad u otra causa», el SII, **a petición del interesado**, no aplica el tributo o lo devuelve; el **inciso segundo** excluye eso cuando pasaron más de seis meses entre la entrega y la devolución, salvo sentencia judicial; el **inciso tercero** dice que la devolución o no aplicación «deberá solicitarse dentro de los treinta días siguientes» a que la venta quede sin efecto.
1. **Los 30 días:** el texto los pone para la solicitud ante el SII de todos los casos del inciso primero, **resciliación incluida**; no los limita a sentencias judiciales (la explicación contraria que recibió el dueño no coincide con el texto). Qué hace el contribuyente en la práctica cuando basta con la nota del art. 21 N°2 queda a criterio del contador. El aviso del portal se mantiene (no bloqueante) como control de oportunidad.
2. **Los 6 meses:** el art. 70 habla de «entrega y devolución de las especies», pensado en bienes. Que en un servicio prepagado se cuente desde la **fecha de la boleta** es un criterio del contador (que dice sostenerlo el SII y lo liga al art. 9 letra a). **No está en el texto leído.** Se adopta por ser el más conservador y el que ve el SII en la referencia de la nota; el contador debe darlo por escrito con su fuente.
3. Las citas textuales que traía la respuesta del contador para los arts. 70 y 21 no coincidían palabra por palabra con la BCN. Para cualquier texto al cliente o al SII, usar solo la redacción de la BCN.

### Efecto en el alcance del backoffice (adiciones a B-3)
- Campo «Código de referencia» (1 anula / 3 corrige montos), «Medio de devolución», visitas contratadas y ejecutadas, advertencia de más de 6 meses entre boleta y nota (corregido: antes decía 3) y aviso de más de 30 días desde el término del servicio.
- Los datos bancarios y la pantalla de liquidación con desglose quedan **fuera de B-3** (necesitan spec y revisión de datos personales); B-3 solo registra folios, montos, motivo y medio.
