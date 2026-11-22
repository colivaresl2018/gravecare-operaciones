/**
 * config-planificacion-db.js — escritura de `rutas` y `feriados` desde la pantalla «Rutas y feriados».
 *
 * - Las dependencias de Firestore (`guardar` = setDoc y `referencia(id)`) se inyectan: se prueba sin red.
 * - Solo se escribe con `merge`; NUNCA se borra un documento. «Quitar» = `activo: false` (campo aditivo) y se puede reactivar.
 * - Qué se escribe: rutas → `cementerio`, `eje`, `diaSemana`, `activo`; feriados → `nombre`, `alcance`, `activo` (la fecha va en el id).
 *   Siempre con `actualizadoPor` (uid) y `actualizadoEn` (texto ISO). Ningún otro campo ni colección.
 * - Quién puede escribir lo deciden las reglas de Firestore (rutas: dueño; feriados: administrador). Aquí solo se traduce el rechazo.
 */
import { validarRuta, validarFeriado } from './config-planificacion.js';
import { esFechaIso } from './fechas-semana.js';

export const COLECCION_RUTAS = 'rutas';
export const COLECCION_FERIADOS = 'feriados';

function exigirId(id) {
  const limpio = String(id ?? '').trim();
  if (!limpio || limpio.includes('/')) throw new Error('Falta el identificador del documento (id) o no es válido.');
  return limpio;
}

function exigirUsuario(uid) {
  if (!uid) throw new Error('Falta el usuario que guarda los cambios.');
  return uid;
}

const quien = (uid, ahora) => ({ actualizadoPor: uid, actualizadoEn: ahora.toISOString() });

/** Guarda (crea o actualiza) la ruta de un cementerio. Devuelve lo escrito. */
export async function guardarRuta({ guardar, referencia, id, datos, uid, ahora = new Date() }) {
  const idLimpio = exigirId(id);
  exigirUsuario(uid);
  const r = validarRuta(datos);
  if (!r.ok) throw new Error(r.errores.join(' '));
  const escrito = { ...r.datos, activo: true, ...quien(uid, ahora) };
  await guardar(referencia(idLimpio), escrito, { merge: true });
  return escrito;
}

async function enLote(elementos, escribir) {
  const resultados = [];
  for (const el of elementos) {
    try {
      await escribir(el);
      resultados.push({ id: el.id, ok: true });
    } catch (error) {
      resultados.push({ id: el.id, ok: false, error });
    }
  }
  return resultados;
}

/** Guarda varias rutas una por una (sigue aunque alguna falle). @returns {Promise<Array<{id: string, ok: boolean, error?: Error}>>} */
export function guardarRutasEnLote({ guardar, referencia, items, uid, ahora = new Date() }) {
  return enLote(Array.isArray(items) ? items : [], (it) => guardarRuta({ guardar, referencia, id: it.id, datos: it.datos, uid, ahora }));
}

function exigirEstado(activo) {
  if (typeof activo !== 'boolean') throw new Error('El estado (activo) debe ser verdadero o falso.');
  return activo;
}

/** Quitar (`activo: false`) o reactivar (`activo: true`) una ruta. No borra el documento. */
export async function cambiarEstadoRuta({ guardar, referencia, id, activo, uid, ahora = new Date() }) {
  const idLimpio = exigirId(id);
  exigirUsuario(uid);
  const escrito = { activo: exigirEstado(activo), ...quien(uid, ahora) };
  await guardar(referencia(idLimpio), escrito, { merge: true });
  return escrito;
}

/** Guarda un feriado en `feriados/{AAAA-MM-DD}`. Devuelve lo escrito. */
export async function guardarFeriado({ guardar, referencia, datos, uid, ahora = new Date() }) {
  exigirUsuario(uid);
  const r = validarFeriado(datos);
  if (!r.ok) throw new Error(r.errores.join(' '));
  const { fecha, nombre, alcance } = r.datos;
  const escrito = { nombre, alcance, activo: true, ...quien(uid, ahora) };
  await guardar(referencia(fecha), escrito, { merge: true });
  return escrito;
}

/** Guarda varios feriados (una fila por fecha). @returns {Promise<Array<{id: string, ok: boolean, error?: Error}>>} */
export function guardarFeriados({ guardar, referencia, filas, uid, ahora = new Date() }) {
  const elementos = (Array.isArray(filas) ? filas : []).map((f) => ({ id: f && f.fecha, datos: f }));
  return enLote(elementos, (el) => guardarFeriado({ guardar, referencia, datos: el.datos, uid, ahora }));
}

/** Quitar (`activo: false`) o reactivar un feriado. No borra el documento. */
export async function cambiarEstadoFeriado({ guardar, referencia, fecha, activo, uid, ahora = new Date() }) {
  const f = String(fecha ?? '').trim();
  if (!esFechaIso(f)) throw new Error('La fecha no es válida (AAAA-MM-DD).');
  exigirUsuario(uid);
  const escrito = { activo: exigirEstado(activo), ...quien(uid, ahora) };
  await guardar(referencia(f), escrito, { merge: true });
  return escrito;
}

/** Texto claro para el usuario cuando falla un guardado. `tipo`: 'rutas' | 'feriados'. */
export function textoErrorGuardar(error, tipo) {
  const code = error && error.code ? String(error.code) : '';
  if (code === 'permission-denied') {
    return tipo === 'feriados'
      ? 'Tu usuario no tiene permiso para guardar feriados: solo un administrador puede hacerlo.'
      : 'Tu usuario no tiene permiso para guardar rutas: solo el dueño puede hacerlo.';
  }
  if (code === 'unavailable' || code === 'deadline-exceeded') return 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.';
  const mensaje = error && error.message ? String(error.message).trim() : '';
  return mensaje && !code ? mensaje : 'No se pudo guardar. Inténtalo de nuevo.';
}
