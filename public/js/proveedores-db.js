/**
 * proveedores-db.js — escrituras del maestro de proveedores (spec 057, parte a). Todo en transacción, con las dependencias
 * de Firestore inyectadas (`ejecutarTransaccion` y `refs`), igual que ordenes-compra-db.js.
 *
 * - El RUT es único: cada RUT reservado tiene un documento `proveedoresRut/{rutNormalizado}` que se crea o se actualiza en la
 *   MISMA transacción que el proveedor (plan T3). Un RUT liberado (`liberado: true`) puede volver a usarse.
 * - NADA se borra: quitar un proveedor pone `activo: false` y reactivarlo lo devuelve a `true`.
 * - Quién puede escribir lo deciden las reglas de Firestore (repo de la web); aquí solo se traduce el rechazo.
 */
import { validarProveedor, validarRut } from './proveedores.js';

export const COLECCION_PROVEEDORES = 'proveedores';
export const COLECCION_RUT_PROVEEDORES = 'proveedoresRut';

const CAMPOS_EDITABLES = ['razonSocial', 'rut', 'contacto', 'telefono', 'direccion', 'condicionesPago', 'correo'];
const MENSAJE_RUT_REPETIDO = 'Ya existe un proveedor con ese RUT.';

const exigirUsuario = (uid) => {
  if (!uid) throw new Error('Falta el usuario que guarda los cambios.');
  return uid;
};

const errorRutRepetido = () => Object.assign(new Error(MENSAJE_RUT_REPETIDO), { code: 'codigo-existe' });

/**
 * Da de alta un proveedor y reserva su RUT. @returns {Promise<string>} id del proveedor nuevo.
 * Un RUT ya reservado y no liberado se rechaza sin escribir nada (CA-P3).
 */
export async function crearProveedor({ ejecutarTransaccion, refs, datos, uid, ahora = new Date() }) {
  const r = validarProveedor(datos);
  if (!r.ok) throw new Error(r.errores.join(' '));
  exigirUsuario(uid);
  const { rutNormalizado, ...limpio } = r.datos;
  if (limpio.correo === '') delete limpio.correo; // spec 058: al crear, sin correo no hay clave (compatible con proveedores anteriores)
  const iso = ahora.toISOString();
  return ejecutarTransaccion(async (tx) => {
    const refRut = refs.rut(rutNormalizado);
    const snapRut = await tx.get(refRut);
    if (snapRut.exists() && snapRut.data().liberado !== true) throw errorRutRepetido();
    const refProveedor = refs.proveedorNuevo();
    tx.set(refRut, { proveedorId: refProveedor.id, liberado: false, actualizadoEl: iso });
    tx.set(refProveedor, { ...limpio, creadoEl: iso, creadoPor: uid, actualizadoEl: iso, actualizadoPor: uid });
    return refProveedor.id;
  });
}

/**
 * Cambia datos del proveedor (no `activo`: eso va en cambiarActivoProveedor). Si cambia el RUT, reserva el nuevo y libera el
 * anterior en la misma transacción. Un RUT ocupado por otro proveedor se rechaza.
 */
export async function editarProveedor({ ejecutarTransaccion, refs, id, cambios, uid, ahora = new Date() }) {
  exigirUsuario(uid);
  const origen = cambios && typeof cambios === 'object' ? cambios : {};
  const pedidos = CAMPOS_EDITABLES.filter((k) => origen[k] !== undefined);
  if (pedidos.length === 0) throw new Error('No hay ningún cambio para guardar.');
  const iso = ahora.toISOString();
  return ejecutarTransaccion(async (tx) => {
    const refProveedor = refs.proveedor(id);
    const snap = await tx.get(refProveedor);
    if (!snap.exists()) throw new Error('El proveedor no existe.');
    const actual = snap.data() || {};
    const base = {
      razonSocial: actual.razonSocial,
      rut: actual.rut,
      contacto: actual.contacto,
      telefono: actual.telefono,
      direccion: actual.direccion,
      condicionesPago: actual.condicionesPago,
      correo: actual.correo,
      activo: actual.activo,
    };
    const r = validarProveedor({ ...base, ...Object.fromEntries(pedidos.map((k) => [k, origen[k]])) });
    if (!r.ok) throw new Error(r.errores.join(' '));
    const { rutNormalizado, activo: _activo, correo, ...nuevos } = r.datos;
    // spec 058: el correo solo viaja si cambió (ausente = ''), para que editar un proveedor anterior no agregue una clave nueva
    if (correo !== undefined && correo !== String(actual.correo ?? '').trim()) nuevos.correo = correo;
    const rutAnterior = validarRut(actual.rut).normalizado;
    if (rutNormalizado !== rutAnterior) {
      const refNuevo = refs.rut(rutNormalizado);
      const snapNuevo = await tx.get(refNuevo);
      if (snapNuevo.exists() && snapNuevo.data().liberado !== true) throw errorRutRepetido();
      const refAnterior = refs.rut(rutAnterior);
      tx.set(refNuevo, { proveedorId: id, liberado: false, actualizadoEl: iso });
      tx.set(refAnterior, { proveedorId: id, liberado: true, actualizadoEl: iso });
    }
    tx.update(refProveedor, { ...nuevos, actualizadoEl: iso, actualizadoPor: uid });
    return nuevos;
  });
}

/** Quita (`activo: false`) o reactiva (`activo: true`) un proveedor. Nunca borra (R-P4, R-P5). */
export async function cambiarActivoProveedor({ ejecutarTransaccion, refs, id, activo, uid, ahora = new Date() }) {
  exigirUsuario(uid);
  if (typeof activo !== 'boolean') throw new Error('El estado del proveedor debe ser activo o quitado.');
  const iso = ahora.toISOString();
  await ejecutarTransaccion(async (tx) => {
    const refProveedor = refs.proveedor(id);
    const snap = await tx.get(refProveedor);
    if (!snap.exists()) throw new Error('El proveedor no existe.');
    tx.update(refProveedor, { activo, actualizadoEl: iso, actualizadoPor: uid });
  });
}

/** Texto para el usuario cuando falla una escritura del maestro de proveedores. */
export function textoErrorProveedor(error) {
  const code = error && error.code;
  if (code === 'codigo-existe') return MENSAJE_RUT_REPETIDO;
  if (code === 'permission-denied') {
    return 'Firestore rechazó el guardado: tu usuario no tiene permiso, o las reglas de los proveedores todavía no están publicadas. No se guardó nada.';
  }
  if (code === 'unavailable' || code === 'deadline-exceeded') return 'No hay conexión con el servidor. Revisa tu conexión y vuelve a intentar: no se guardó nada.';
  const mensaje = error && typeof error.message === 'string' ? error.message.trim() : '';
  return mensaje || 'No se pudo guardar. Vuelve a intentar.';
}
