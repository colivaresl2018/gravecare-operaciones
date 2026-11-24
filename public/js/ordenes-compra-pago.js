/**
 * ordenes-compra-pago.js — lógica pura del seguimiento de pago de las órdenes de compra (spec 063). Sin DOM ni Firebase.
 *
 * - Tres estados: Emitida, Pagada y Anulada. Los cambios son siempre manuales (R1, R2).
 * - Quién puede registrar el pago lo deciden las reglas de Firestore; aquí solo se decide qué ofrece la pantalla (R4).
 * - Los textos devueltos pueden traer datos del usuario: las vistas los escapan con esc() (AUD-01).
 */

export const ESTADOS_OC = ['Emitida', 'Pagada', 'Anulada'];
export const MAX_COMENTARIO = 500;
const MAX_FACTURA = 20;
const FORMATO_FACTURA = /^[A-Za-z0-9][A-Za-z0-9 ./-]{0,19}$/;
const FORMATO_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Estados a los que se puede llevar una orden desde `estado`, según lo que puede hacer quien la mira (R2, R4, D4). */
export function transicionesDisponibles({ estado, puedePago = false, puedeAnular = false } = {}) {
  if (estado === 'Emitida') {
    if (!puedePago) return ['Emitida'];
    return puedeAnular ? ['Emitida', 'Pagada', 'Anulada'] : ['Emitida', 'Pagada'];
  }
  if (estado === 'Pagada') return puedePago ? ['Pagada', 'Emitida'] : ['Pagada'];
  if (estado === 'Anulada') return ['Anulada'];
  return [];
}

function esFechaReal(texto) {
  const m = typeof texto === 'string' ? FORMATO_FECHA.exec(texto) : null;
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

/**
 * Valida el N° de factura y la fecha de pago para marcar una orden como Pagada (R5).
 * La fecha de pago no puede ser anterior a la de la orden ni posterior a `hoy` (ambas AAAA-MM-DD; se inyectan para probar sin reloj).
 * @returns {{ok: boolean, errores: string[], datos?: {facturaNumero: string, fechaPago: string}}}
 */
export function validarPago({ facturaNumero, fechaPago, fechaOrden, hoy } = {}) {
  const errores = [];
  const factura = typeof facturaNumero === 'string' ? facturaNumero.trim() : '';
  if (!factura) errores.push('Escribe el N° de factura.');
  else if (factura.length > MAX_FACTURA || !FORMATO_FACTURA.test(factura)) {
    errores.push(`El N° de factura puede tener hasta ${MAX_FACTURA} caracteres: letras, números, espacio, punto, barra o guion.`);
  }
  const fecha = typeof fechaPago === 'string' ? fechaPago.trim() : '';
  if (!fecha) errores.push('Elige la fecha de pago.');
  else if (!esFechaReal(fecha)) errores.push('La fecha de pago no es una fecha válida.');
  else {
    if (esFechaReal(fechaOrden) && fecha < fechaOrden) errores.push('La fecha de pago no puede ser anterior a la de la orden.');
    if (esFechaReal(hoy) && fecha > hoy) errores.push('La fecha de pago no puede ser futura.');
  }
  if (errores.length > 0) return { ok: false, errores };
  return { ok: true, errores: [], datos: { facturaNumero: factura, fechaPago: fecha } };
}

/** Valida el comentario de una orden: texto de 0 a 500 caracteres tras `trim()`; vacío significa sin comentario (R6). */
export function validarComentario(texto) {
  if (texto !== undefined && texto !== null && typeof texto !== 'string') return { ok: false, errores: ['El comentario debe ser texto.'], comentario: '' };
  const comentario = typeof texto === 'string' ? texto.trim() : '';
  if (comentario.length > MAX_COMENTARIO) return { ok: false, errores: [`El comentario puede tener hasta ${MAX_COMENTARIO} caracteres.`], comentario };
  return { ok: true, errores: [], comentario };
}

/**
 * Texto que se guarda como motivo de la reversión Pagada → Emitida: antepone lo que se quita para no perderlo (R9).
 * Debe caber en 500 caracteres.
 */
export function textoReversion({ facturaNumero, fechaPago, motivo } = {}) {
  const razon = typeof motivo === 'string' ? motivo.trim() : '';
  if (!razon) return { ok: false, errores: ['Escribe el motivo de la reversión.'], texto: '' };
  const factura = typeof facturaNumero === 'string' ? facturaNumero.trim() : '';
  const fecha = typeof fechaPago === 'string' ? fechaPago.trim() : '';
  const quitado = [factura ? `factura N° ${factura}` : '', fecha ? `fecha de pago ${fecha}` : ''].filter(Boolean).join(' y ');
  const texto = quitado ? `Se quitó: ${quitado}. Motivo: ${razon}` : razon;
  if (texto.length > MAX_COMENTARIO) {
    return { ok: false, errores: [`El motivo es demasiado largo: junto con lo que se quita debe caber en ${MAX_COMENTARIO} caracteres.`], texto };
  }
  return { ok: true, errores: [], texto };
}

/** Registran pagos el dueño y el administrador (R4). Las reglas de Firestore siguen siendo la barrera real. */
export function puedeRegistrarPago(perfil) {
  if (!perfil || typeof perfil !== 'object') return false;
  if (perfil.dueno === true) return true;
  const rol = typeof perfil.rol === 'string' ? perfil.rol.trim().toLowerCase() : '';
  return rol === 'administrador' || rol === 'admin';
}
