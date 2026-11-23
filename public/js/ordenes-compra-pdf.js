/**
 * ordenes-compra-pdf.js — «Imprimir» la orden de compra con el PDF que se archivó al enviarla por correo (spec 060 · spec 061).
 * Lógica pura: sin DOM ni Firebase. La lectura de Storage se inyecta como `obtenerUrl(ruta)` (devuelve la URL de descarga).
 *
 * - Solo se lee: el backoffice nunca escribe en Storage (R2). La regla de lectura es «staff activo» (CA4).
 * - La ruta sale del número de OC, validado con el mismo patrón que el servidor (functions/orden-compra-archivo.js).
 * - Nunca lanza: todo fallo vuelve como estado `error` o `sin-archivo` para que la lista de OC siga funcionando (R4).
 */

const REGEX_NUMERO_OC = /^OC-[0-9]{4,}$/;

/** Aviso de R3: la OC no tiene PDF archivado (anterior a la spec 060, o aún no enviada). */
export const MENSAJE_SIN_PDF = 'Esta orden aún no tiene PDF archivado: se archiva al enviarla por correo. Puede imprimir la vista simple.';

const MSG_ERROR_LECTURA = 'No se pudo abrir el PDF archivado. Revise su conexión e intente de nuevo, o imprima la vista simple.';
const MSG_SIN_PERMISO = 'Su sesión no tiene permiso para ver el PDF archivado. Vuelva a ingresar, o imprima la vista simple.';
const MSG_NUMERO = 'Número de orden no válido.';

/** Ruta de Storage del PDF de una OC (`ordenesCompra/{numero}/{numero}.pdf`). Lanza si el número no tiene el formato OC-NNNN. */
export function rutaPdfOC(numero) {
  if (typeof numero !== 'string' || !REGEX_NUMERO_OC.test(numero)) throw new Error(MSG_NUMERO);
  return `ordenesCompra/${numero}/${numero}.pdf`;
}

/** Códigos de error del SDK de Storage que significan «sin permiso» (regla `staffActivo`). */
const CODIGOS_SIN_PERMISO = new Set(['storage/unauthorized', 'storage/unauthenticated']);

/**
 * Lee la URL del PDF archivado de una OC.
 * @param {{numero: string, obtenerUrl: (ruta: string) => Promise<string>}} entrada
 * @returns {Promise<{estado: 'listo', url: string} | {estado: 'sin-archivo', mensaje: string} | {estado: 'error', mensaje: string}>}
 */
export async function obtenerPdfOC({ numero, obtenerUrl }) {
  let ruta;
  try {
    ruta = rutaPdfOC(numero);
  } catch (e) {
    return { estado: 'error', mensaje: MSG_NUMERO };
  }
  try {
    const url = await obtenerUrl(ruta);
    return { estado: 'listo', url: String(url) };
  } catch (e) {
    const codigo = e && typeof e === 'object' && typeof e.code === 'string' ? e.code : '';
    if (codigo === 'storage/object-not-found') return { estado: 'sin-archivo', mensaje: MENSAJE_SIN_PDF };
    if (CODIGOS_SIN_PERMISO.has(codigo)) return { estado: 'error', mensaje: MSG_SIN_PERMISO };
    return { estado: 'error', mensaje: MSG_ERROR_LECTURA };
  }
}
