/**
 * ordenes-compra-envio.js — envío de la orden de compra al proveedor por correo (spec 058, parte backoffice). Lógica pura: sin DOM ni
 * Firebase. La llamada real a la función `enviarOrdenCompraPorCorreo` (callable de GraveCare) se inyecta como `llamar`.
 *
 * - El navegador SOLO dice «envía la OC-NNNN»: destinatario, copia, remitente, asunto y cuerpo los fija el servidor (R6, CA9).
 * - El correo del proveedor se usa únicamente para mostrarlo; el servidor lo vuelve a leer y a validar.
 * - Todo texto devuelto aquí puede traer datos de Firestore o de la función: las vistas lo escapan con esc() (AUD-01).
 */
import { validarCorreo, correoDeProveedor } from './proveedores.js?v=058';

/** Copia fija del envío. Solo se nombra en el texto de confirmación (la fija el servidor; el dueño la pidió). */
export const CORREO_COPIA = 'rravellos@gravecare.cl';

const REGEX_NUMERO_OC = /^OC-[0-9]{4,}$/;
const MAX_MENSAJE_FUNCION = 200;

const MSG_GENERICO = 'No se pudo enviar. Intente de nuevo.';
const MSG_EN_CURSO = 'Ya hay un envío en curso para esta orden. Espere un minuto.';
const MSG_SIN_PERMISO = 'Su sesión no tiene permiso para enviar correos. Vuelva a ingresar.';

/** Quita saltos de línea y tabulaciones (un texto de una sola línea). */
const unaLinea = (v) => String(v ?? '').replace(/[\r\n\t]+/g, ' ').trim();

const NO_MOSTRAR = Object.freeze({ mostrar: false, habilitado: false, motivo: '', correo: '' });

/**
 * Estado del botón «Enviar por correo» para una orden (R7). Solo se muestra en una OC `Emitida`.
 * @param {{orden: object|null, proveedor: ({id: string, data: object}|null), proveedoresLeidos?: boolean}} entrada
 * @returns {{mostrar: boolean, habilitado: boolean, motivo: string, correo: string}}
 */
export function estadoEnvio({ orden, proveedor, proveedoresLeidos = true } = {}) {
  if (!orden || orden.estado !== 'Emitida') return { ...NO_MOSTRAR };
  const deshabilitado = (motivo, correo = '') => ({ mostrar: true, habilitado: false, motivo, correo });
  if (typeof orden.proveedorId !== 'string' || orden.proveedorId.trim() === '') {
    return deshabilitado('Esta orden no tiene un proveedor del maestro; no se puede enviar por correo');
  }
  if (proveedoresLeidos === false) return deshabilitado('No se pudo leer el proveedor; recargue la página.');
  if (!proveedor || !proveedor.data) return deshabilitado('El proveedor de esta orden no está en el maestro; no se puede enviar por correo');
  if (proveedor.data.activo !== true) return deshabilitado('El proveedor ya no está activo; reactívelo en Proveedores para enviar por correo');
  const correo = correoDeProveedor(proveedor);
  if (correo === '') return deshabilitado('El proveedor no tiene correo registrado: agréguelo en Proveedores');
  if (!validarCorreo(correo).ok) return deshabilitado('El correo del proveedor no es válido: corríjalo en Proveedores', correo);
  return { mostrar: true, habilitado: true, motivo: '', correo };
}

/** Texto de la confirmación previa al envío (R8). */
export function textoConfirmacion(numero, correo) {
  return `¿Enviar la ${unaLinea(numero)} a ${unaLinea(correo)} con copia a ${CORREO_COPIA}?`;
}

/**
 * Mensaje en español para un error de la función (R11). Solo `failed-precondition` usa el texto de la función (ya viene en español),
 * recortado y en una línea; de los demás códigos nunca se muestra el texto crudo del servidor.
 */
export function mensajeErrorEnvio(error) {
  if (!error || typeof error !== 'object') return MSG_GENERICO;
  const codigo = String(error.code ?? '').split('/').pop();
  switch (codigo) {
    case 'unauthenticated':
    case 'permission-denied':
      return MSG_SIN_PERMISO;
    case 'invalid-argument':
      return 'Número de orden no válido.';
    case 'not-found':
      return 'No se encontró la orden de compra.';
    case 'failed-precondition': {
      const m = unaLinea(error.message).slice(0, MAX_MENSAJE_FUNCION).trim();
      return m || 'No se pudo enviar: revise la orden y el proveedor.';
    }
    case 'already-exists':
    case 'envio-en-curso':
      return MSG_EN_CURSO;
    case 'resource-exhausted':
      return 'Se alcanzó el límite de envíos. Intente más tarde.';
    case 'unavailable':
      return 'No se pudo enviar el correo. La orden no cambió; intente de nuevo.';
    default:
      return MSG_GENERICO;
  }
}

/**
 * Texto del resultado de un envío aceptado (R10).
 * @returns {{tipo: 'ok'|'aviso', texto: string}}  `aviso` cuando el correo salió pero no quedó registrado en la orden.
 */
export function textoResultado(respuesta) {
  const r = respuesta && typeof respuesta === 'object' ? respuesta : {};
  const para = unaLinea(r.para);
  const cc = unaLinea(r.cc);
  const base = para ? `Enviada a ${para}${cc ? ` con copia a ${cc}` : ''}` : 'Se envió la orden por correo';
  if (r.registrado === false) return { tipo: 'aviso', texto: `${base}. Se envió, pero no quedó registrado en la orden.` };
  return { tipo: 'ok', texto: para ? base : `${base}.` };
}

const FORMATO_FECHA = new Intl.DateTimeFormat('es-CL', {
  timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

/** `DD-MM-AAAA HH:MM` en hora de Chile, o '' si la fecha no es válida. */
function fechaHora(iso) {
  if (typeof iso !== 'string' || iso.trim() === '') return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = Object.fromEntries(FORMATO_FECHA.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.day}-${p.month}-${p.year} ${p.hour}:${p.minute}`;
}

/**
 * Línea de historial de una orden con `envios` (R12): el último envío y, si hay más, «(N envíos)». No muestra `enviadoPor`.
 * @param {Array<{para?: string, cc?: string, enviadoEl?: string, enviadoPor?: string}>|undefined} envios
 */
export function textoHistorial(envios) {
  if (!Array.isArray(envios)) return '';
  const validos = envios
    .filter((e) => e && typeof e === 'object' && !Array.isArray(e))
    .map((e) => ({ para: unaLinea(e.para), fecha: fechaHora(e.enviadoEl) }))
    .filter((e) => e.para || e.fecha);
  if (validos.length === 0) return '';
  const ultimo = validos[validos.length - 1];
  const texto = `${ultimo.para ? `Enviada a ${ultimo.para}` : 'Enviada'}${ultimo.fecha ? ` el ${ultimo.fecha}` : ''}`;
  return validos.length > 1 ? `${texto} (${validos.length} envíos)` : texto;
}

const enCurso = new Set();

const errorConCodigo = (code, message) => Object.assign(new Error(message), { code });

/**
 * Pide el envío de una orden: valida el número y llama a la función con SOLO `{ numero }` (CA9). Una orden con un envío en curso no se
 * vuelve a enviar desde esta pantalla (R9; el servidor además reserva 60 s). El indicador se libera siempre.
 * @param {{numero: string, llamar: (datos: {numero: string}) => Promise<object>}} entrada  `llamar` devuelve los datos de la respuesta.
 */
export async function enviarOrden({ numero, llamar }) {
  if (typeof numero !== 'string' || !REGEX_NUMERO_OC.test(numero)) throw errorConCodigo('invalid-argument', 'Número de orden no válido.');
  if (enCurso.has(numero)) throw errorConCodigo('envio-en-curso', MSG_EN_CURSO);
  enCurso.add(numero);
  try {
    return await llamar({ numero });
  } finally {
    enCurso.delete(numero);
  }
}
