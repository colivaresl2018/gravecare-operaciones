/**
 * valores-ramos-db.js — lectura y escritura de los valores de compra de ramos (directriz B5 etapa 2; spec 056 R5).
 * Documento `valores_ramos/compra` con `standard`, `premium`, `deluxe`, `adicionalStandard`, `adicionalPremium` (CLP por ramo),
 * `actualizadoEn` y `actualizadoPor`. Es la ÚNICA escritura de las pestañas de planificación.
 *
 * - Las dependencias de Firestore (getDoc, setDoc y la referencia al documento) se inyectan: se prueba sin red.
 * - Un campo vacío NO se escribe: no se puede borrar un precio guardado por descuido (solo cambiarlo por otro valor).
 * - Un valor que no es un número válido ≥ 0 no se guarda y no se escribe nada.
 * - Las reglas (repo de la web) permiten escribir a cualquier staff con claim; aquí solo se registra quién y cuándo.
 */
import { TIPOS_RAMO, normalizarValor, normalizarValores } from './compra-ramos.js?v=b5e2';

/** Colección y documento (aditivo; no existe en el contrato anterior). */
export const RUTA_VALORES = ['valores_ramos', 'compra'];

/**
 * @param {{ obtener: (ref: any) => Promise<{ exists: () => boolean, data: () => object|undefined }>, referencia: () => any }} p
 * @returns {Promise<{ existe: boolean, valores: object, actualizadoEn: string, actualizadoPor: string }>}
 */
export async function leerValoresRamos({ obtener, referencia }) {
  const snap = await obtener(referencia());
  const datos = snap && snap.exists() ? snap.data() || {} : {};
  return {
    existe: Boolean(snap && snap.exists()),
    valores: normalizarValores(datos),
    actualizadoEn: typeof datos.actualizadoEn === 'string' ? datos.actualizadoEn : '',
    actualizadoPor: typeof datos.actualizadoPor === 'string' ? datos.actualizadoPor : '',
  };
}

const estaVacio = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

/**
 * Guarda los valores escritos (solo los no vacíos) con quién y cuándo. Devuelve lo que se escribió.
 * @param {{ guardar: (ref: any, datos: object, opciones: object) => Promise<any>, referencia: () => any, valores: object, uid: string, ahora?: Date }} p
 */
export async function guardarValoresRamos({ guardar, referencia, valores, uid, ahora = new Date() }) {
  if (!uid) throw new Error('Falta el usuario que guarda los valores.');
  const origen = valores && typeof valores === 'object' ? valores : {};
  const datos = {};
  for (const t of TIPOS_RAMO) {
    const bruto = origen[t.clave];
    if (estaVacio(bruto)) continue; // vacío = no cambiar
    const valor = normalizarValor(bruto);
    if (valor === null) throw new Error(`El valor de «${t.singular}» no es un número válido (usa solo números, por ejemplo 12.000).`);
    datos[t.clave] = valor;
  }
  if (Object.keys(datos).length === 0) throw new Error('No hay ningún valor para guardar.');
  datos.actualizadoEn = ahora.toISOString();
  datos.actualizadoPor = uid;
  await guardar(referencia(), datos, { merge: true });
  return datos;
}
