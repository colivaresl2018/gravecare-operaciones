/**
 * orden-pagada.js — criterio único de «orden pagada» en el backoffice (N80, directriz B-2).
 *
 * Es el mismo criterio del servidor de la web (functions/sepultura-pago.js:14 del repo gravecare):
 *   pagada = orden.pagoConfirmado === true || orden.estado === 'Confirmado'
 * - confirmarTransaccionWebpay escribe pagoConfirmado: true, estado: 'Confirmado', fechaPago y modoPago.
 * - iniciarOrden crea la orden con pagoConfirmado: false y estado 'iniciada'.
 * - Los retornos sin pago escriben pagoConfirmado: false y motivoSinPago (cancelado, rechazado, vencida…).
 *
 * Solo LEE campos existentes (contrato de datos con la web): pagoConfirmado, estado, modoPago, fechaPago.
 */

/** true si la orden está pagada según el servidor. Un documento vacío o sin esos campos no está pagado. */
export function esOrdenPagada(orden) {
  return Boolean(orden) && (orden.pagoConfirmado === true || orden.estado === 'Confirmado');
}

/** true si la orden se pagó en el ambiente de integración de Transbank (orden de prueba del piloto). */
export function esOrdenDePrueba(orden) {
  return Boolean(orden) && orden.modoPago === 'integracion';
}

/**
 * true si la orden se suma como ingreso tributario (Boleta Venta / Ingreso Bruto del F22).
 * Exige además estado 'Confirmado': Oneclick (hallazgo C2) marca pagoConfirmado al inscribir la tarjeta,
 * sin cobrar. Y excluye las órdenes de prueba (regla de B-1).
 */
export function cuentaComoIngreso(orden) {
  return esOrdenPagada(orden) && orden.estado === 'Confirmado' && !esOrdenDePrueba(orden);
}

/**
 * Insignia «PRUEBA» para las listas de trabajo (respuesta del dueño en B-1): las órdenes de integración se muestran
 * para probar planificación y visitas, marcadas, y no se suman como ingreso. Usa el estilo de insignias existente.
 */
export const INSIGNIA_PRUEBA = ' <span class="inline-block ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 align-middle" title="Orden pagada en el ambiente de integración de Transbank: no se suma como ingreso">PRUEBA</span>';

/** Valor de fecha del ingreso: fechaPago cuando existe; si no, la fecha de creación. */
export function fechaDelIngreso(orden) {
  if (!orden) return null;
  return orden.fechaPago || orden.creadoEl || orden.createdAt || null;
}
