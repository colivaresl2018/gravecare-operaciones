/**
 * proveedores.js — maestro de proveedores de las órdenes de compra (spec 057, partes a y b). Lógica pura: sin DOM ni Firebase.
 *
 * - El RUT se valida con dígito verificador (módulo 11) y se guarda formateado (`rut`) y normalizado (`rutNormalizado`,
 *   sin puntos, que es la clave del documento de bloqueo `proveedoresRut`, spec 057 plan T3).
 * - Solo los proveedores activos aparecen en el desplegable de una OC nueva (R-P4, CA-O2).
 * - Los datos que se rellenan en la OC son una copia: la OC emitida no cambia si el maestro cambia (R-O3).
 */
import { CONDICIONES_PAGO } from './ordenes-compra.js';

const CONDICION_POR_DEFECTO = 'Transferencia';
const MAX_RAZON = 120;
const MAX_CONTACTO = 80;
const MAX_TELEFONO = 30;
const MAX_DIRECCION = 200;

/** Opción del desplegable para escribir un proveedor a mano (decisión 3, spec 057). */
export const OPCION_OTRO = Object.freeze({ id: '', razonSocial: 'Otro proveedor (escribir)' });

const texto = (v) => String(v ?? '').trim();

const conPuntos = (cuerpo) => cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** Dígito verificador del cuerpo de un RUT (pesos 2 a 7, de derecha a izquierda; 11 → 0, 10 → K). */
function digitoVerificador(cuerpo) {
  let suma = 0;
  let factor = 2;
  for (let i = cuerpo.length - 1; i >= 0; i -= 1) {
    suma += Number(cuerpo[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const resto = 11 - (suma % 11);
  if (resto === 11) return '0';
  if (resto === 10) return 'K';
  return String(resto);
}

/**
 * @returns {{ok: true, normalizado: string, formateado: string, errores: []} | {ok: false, errores: string[]}}
 */
export function validarRut(entrada) {
  const limpio = texto(entrada).replace(/\./g, '').replace(/\s/g, '').toUpperCase();
  const m = /^(\d{7,8})-([0-9K])$/.exec(limpio);
  if (!m) return { ok: false, errores: ['El RUT debe tener el formato 12.345.678-5 (con guion y dígito verificador).'] };
  const [, cuerpo, dv] = m;
  if (dv !== digitoVerificador(cuerpo)) return { ok: false, errores: ['El dígito verificador del RUT no coincide: revisa el número.'] };
  return { ok: true, normalizado: `${cuerpo}-${dv}`, formateado: `${conPuntos(cuerpo)}-${dv}`, errores: [] };
}

/**
 * Valida un proveedor antes de guardarlo (R-P1). Razón social y RUT son obligatorios; el resto es opcional, con largos máximos.
 * @returns {{ok: true, datos: object} | {ok: false, errores: string[]}}
 */
export function validarProveedor(entrada) {
  const e = entrada && typeof entrada === 'object' ? entrada : {};
  const errores = [];
  const razonSocial = texto(e.razonSocial);
  const contacto = texto(e.contacto);
  const telefono = texto(e.telefono);
  const direccion = texto(e.direccion);
  const condicionesPago = texto(e.condicionesPago);
  const rut = validarRut(e.rut);

  if (!razonSocial) errores.push('Falta la razón social del proveedor.');
  else if (razonSocial.length > MAX_RAZON) errores.push(`La razón social es demasiado larga (máximo ${MAX_RAZON} letras).`);
  if (!rut.ok) errores.push(...rut.errores);
  if (contacto.length > MAX_CONTACTO) errores.push(`El contacto es demasiado largo (máximo ${MAX_CONTACTO} letras).`);
  if (telefono.length > MAX_TELEFONO) errores.push(`El teléfono es demasiado largo (máximo ${MAX_TELEFONO} caracteres).`);
  else if (telefono && !/^[0-9+()\s-]+$/.test(telefono)) errores.push('El teléfono solo puede tener números, espacios, +, guiones y paréntesis.');
  if (direccion.length > MAX_DIRECCION) errores.push(`La dirección es demasiado larga (máximo ${MAX_DIRECCION} letras).`);
  if (!CONDICIONES_PAGO.includes(condicionesPago)) errores.push('Elige una condición de pago de la lista.');
  if (e.activo !== undefined && typeof e.activo !== 'boolean') errores.push('El estado del proveedor debe ser activo o quitado.');

  if (errores.length) return { ok: false, errores };
  return {
    ok: true,
    datos: {
      razonSocial,
      rut: rut.formateado,
      rutNormalizado: rut.normalizado,
      contacto,
      telefono,
      direccion,
      condicionesPago,
      activo: e.activo !== false,
    },
  };
}

/**
 * Opciones del desplegable de razón social: solo activos, ordenados en español.
 * @param {Array<{id: string, data: object}>} docs
 * @returns {Array<{id: string, razonSocial: string}>}
 */
export function opcionesProveedores(docs) {
  return (Array.isArray(docs) ? docs : [])
    .filter((d) => d && d.data && d.data.activo === true)
    .map((d) => ({ id: d.id, razonSocial: texto(d.data.razonSocial) }))
    .sort((a, b) => a.razonSocial.localeCompare(b.razonSocial, 'es'));
}

/** Los datos del proveedor que se copian a la OC (R-O2, R-O3). */
export function datosDeProveedor(doc) {
  const d = (doc && doc.data) || {};
  return {
    razonSocial: texto(d.razonSocial),
    rut: texto(d.rut),
    contacto: texto(d.contacto),
    telefono: texto(d.telefono),
    direccion: texto(d.direccion),
  };
}

/** Condición de pago por defecto del proveedor, o Transferencia si no tiene una válida. */
export function condicionPorDefecto(doc) {
  const c = texto((doc && doc.data && doc.data.condicionesPago) || '');
  return CONDICIONES_PAGO.includes(c) ? c : CONDICION_POR_DEFECTO;
}
