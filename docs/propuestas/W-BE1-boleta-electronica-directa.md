# Propuesta W-BE1 — Boleta electrónica automática, conexión directa con el SII

2026-11-15 · Para el dueño y el PM, que la llevan al **repo de la web** (donde viven Functions, reglas y Authentication). Este documento no cambia ningún código. El backoffice (`gravecare-operaciones`) solo tendría una parte menor (§7).

## 1. Decisiones del dueño
| Tema | Decisión |
|---|---|
| Proveedor externo | **No**: se desarrolla la conexión directa con el SII (evita el costo por documento) |
| Habilitación | La empresa **ya es emisora electrónica** y tiene **certificado digital** |
| Tipo de documento | **Boleta afecta** (tipo 39). Lo confirmó el contador |
| Volumen | ~50 boletas al mes, con posibilidad de crecer |

## 2. Lo que está verificado y lo que falta confirmar
Verificado en el instructivo oficial del SII («Instructivo técnico boleta electrónica», `sii.cl`):
- La boleta tiene **servicios propios de autenticación (semilla y token) y de envío**, distintos de los de la factura. Documentación de los servicios: `https://www4c.sii.cl/bolcoreinternetui/api/`.
- Esquemas XML: `EnvioBOLETA` (y `EnvioDTE`) y el de Resumen de Ventas Diarias.
- **Máximo 500 boletas por envío.**
- **Es obligatorio enviar cada día el Resumen de Ventas Diarias (RVD, ex RCOF).**

Por confirmar en la documentación oficial antes de programar (fuentes secundarias, no oficiales, indican que la semilla y el token van por `apicert` en certificación y `api` en producción, y el envío por `pangal` en certificación y `rahue` en producción):
- Hosts exactos por ambiente, pasos de la firma de la semilla, algoritmo de firma y de timbre (los DTE tradicionales usan SHA1), formato del envío, plazos y reglas del receptor (la regla de las 135 UF no está verificada).
- Proceso y contenido del set de pruebas de certificación.
- Atención: en el SII `maullin` es **certificación** y `palena` es **producción**. Ninguna configuración debe apuntar a producción hasta la fase 3.

## 3. Arquitectura propuesta (repo de la web, `functions/`)
Módulos pequeños y puros, cada uno con pruebas:

| Módulo | Responsabilidad |
|---|---|
| `boleta-dte.js` | Convierte la orden pagada en el XML de la boleta 39: emisor, un ítem por servicio, neto, IVA 19 % y total, con redondeo documentado. El total de la orden es con IVA incluido: neto = total / 1,19, redondeado según la regla del SII |
| `boleta-folios.js` | Reserva el siguiente folio del CAF **dentro de una transacción de Firestore**. Un folio nunca se reutiliza, aunque el envío falle |
| `boleta-firma.js` | Firma XML-DSig con el certificado y genera el timbre (TED) con la llave del CAF |
| `boleta-sii.js` | Pide semilla, la firma, obtiene el token, envía el sobre y consulta el estado por el número de seguimiento. Los hosts vienen de una variable de entorno, con certificación como valor por defecto |
| `boleta-rvd.js` | Función programada que envía cada día el Resumen de Ventas Diarias (con cero boletas también, si el SII lo exige: confirmar) |
| `boleta-pdf.js` | Representación gráfica con el código de barras del timbre |
| `boleta-emitir.js` | Orquesta lo anterior con cola y reintentos (Cloud Tasks o equivalente) |

### Disparador y reglas de negocio
- Se emite **una boleta por cada pago confirmado**, no por orden: los cobros recurrentes (Oneclick) generan una boleta cada uno.
- Solo órdenes pagadas con `estado === 'Confirmado'`, y **nunca** las de `modoPago === 'integracion'` (pruebas). Es el mismo criterio que usa el backoffice (`esOrdenPagada`).
- **Idempotencia:** el documento `boletas/{ordenId}-{pagoId}` se crea con «crear solo si no existe». Un reintento o un doble disparo no consume otro folio.
- Una bandera `BOLETAS_HABILITADO` (como `PAGOS_HABILITADO`) apaga todo. Empieza en «modo sombra» (§6, fase 2).
- Una boleta emitida nunca se borra ni se edita: se corrige con una **nota de crédito electrónica** (tipo 61), que es una fase posterior y se conecta con el módulo de notas de crédito del backoffice (B-3).

### Datos (solo cambios aditivos, contrato de datos)
- Colección **nueva, solo del servidor**: `boletas/{id}` con `ordenId`, `pagoId`, `folio`, `estado` (`pendiente`, `enviada`, `aceptada`, `rechazada`, `error`), `trackId`, `montoTotal`, `fechaEmision`, rutas de Storage del XML y del PDF, huella del XML y los intentos. Sin RUT del cliente en claro más allá de lo que exija el documento.
- Archivos en Storage, ruta **nueva y privada** (`boletas/{año}/{folio}.xml` y `.pdf`): conservar el XML firmado y el PDF **6 años**.
- Reglas (en el repo de la web): `boletas` legible solo por staff con claim `staffActivo`, sin escritura de clientes ni de staff. La función escribe con Admin SDK.
- Campo aditivo opcional en la orden: `boletaFolio` (solo lectura de apoyo para listas), escrito por el servidor.

### Secretos
Certificado `.pfx`, su clave y el CAF (con su llave privada) van en **Secret Manager**, nunca en el repo ni en `.env` (misma disciplina que `SMTP_PASS`). El CAF de certificación y el de producción son distintos.

## 4. Pruebas
- Unitarias por módulo: mapeo de montos (casos de redondeo: 1, 9, 19, 1.000, 259.960 pesos), el XML contra los esquemas oficiales del SII, la firma y el timbre verificables, la reserva de folios con concurrencia, idempotencia y el rechazo de órdenes de prueba o no confirmadas.
- Un SII simulado para reintentos, rechazos y caídas.
- Ninguna prueba automática toca producción ni el SII real. La conexión real se prueba a mano contra certificación.

## 5. Riesgos
| Riesgo | Mitigación |
|---|---|
| Folio quemado por un fallo | Transacción de folios, estados claros y un reporte diario de folios sin usar |
| Rechazo del SII (esquema, firma, monto) | Pruebas con esquema, certificación y estado `rechazada` visible |
| SII caído o lento | Cola con reintentos y espera creciente; la compra del cliente **nunca** depende de la boleta |
| Resumen diario omitido | Función programada con alerta si falla; revisión semanal |
| Clave del certificado o del CAF filtrada | Secret Manager, acceso mínimo, rotación al vencer el certificado |
| Vencimiento del certificado o del CAF | Aviso con 30 días de anticipación |
| Redondeo del IVA distinto al del SII | Una sola función de cálculo, con casos de prueba verificados con el contador |
| Mantención propia ante cambios del SII | Mantener módulos pequeños y revisar los boletines del SII cada trimestre |

## 6. Fases
1. **Fase 0 (dueño y contador):** pedir en el SII los folios de **certificación** para el tipo 39, descargar el CAF, dejar certificado y CAF listos, confirmar giro, código de actividad y sucursal, y decidir qué datos del receptor se incluyen.
2. **Fase 1 (certificación):** módulos de dominio con pruebas y conexión al ambiente de certificación. Se aprueba el set de pruebas del SII.
3. **Fase 2 (producción en «sombra»):** con el CAF de producción y `BOLETAS_HABILITADO` solo para órdenes escogidas por el dueño, se emiten y revisan a mano varias boletas reales.
4. **Fase 3 (producción general):** se activa para todas las órdenes pagadas, con el resumen diario y la alerta de fallos.
5. **Fase 4:** nota de crédito electrónica y las pantallas del backoffice.

Cada fase se despliega con `--only functions:<nombre>` (nunca todo `functions`; el contrato de datos advierte de funciones desplegadas sin fuente), lo hace el dueño y se puede apagar con la bandera.

## 7. Parte del backoffice (directriz B-x aparte, cuando exista la función)
- Mostrar en `ordenes.html` el folio y el enlace al PDF de la boleta de cada pago.
- En `gastos-ingresos.html`, no duplicar el ingreso: la boleta documenta el ingreso ya contado con `esOrdenPagada`.
- Botón «Reintentar» para boletas en `error`, que llama a una función solo para staff.
- Alta de la boleta a la vista de notas de crédito (B-3), en la fase 4.

## 8. Preguntas abiertas para el dueño y el contador
1. ¿Los precios publicados incluyen IVA? (La propuesta supone que sí.)
2. ¿Qué datos del cliente deben aparecer en la boleta (nombre, RUT) y cuáles no?
3. ¿Boleta por cada cobro de los planes recurrentes o una por contrato? (La propuesta: una por cobro.)
4. ¿Quién renueva el certificado y cuándo vence?
5. ¿Hay más de un giro o sucursal que emita?

## 9. Qué no cubre esta propuesta
Facturas, guías de despacho, libros de compra y venta ni la recepción de documentos de terceros. Tampoco el cambio de régimen tributario.
