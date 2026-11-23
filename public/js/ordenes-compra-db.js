/**
 * ordenes-compra-db.js — escrituras del maestro de materiales y de las órdenes de compra (spec 055).
 *
 * - Las dependencias de Firestore se inyectan (`ejecutarTransaccion` = runTransaction y `refs` con las referencias): se prueba sin red.
 * - Todas las escrituras van en transacción: un código de material no se repite (R2), el número de OC se toma del contador y se
 *   avanza en la MISMA transacción (R4: sin saltos ni repetidos, y un número anulado nunca se reutiliza).
 * - NADA se borra (R7): un material se retira con `activo: false` y una OC solo pasa de Emitida a Anulada, con motivo.
 * - Quién puede escribir lo deciden las reglas de Firestore (docs/referencia/reglas-propuestas-055.md); aquí solo se traduce el rechazo.
 * - Colecciones NUEVAS y aditivas: `materiales`, `ordenesCompra` y `contadores/ordenesCompra`.
 */
import {
  RAMOS_MAESTRO, TIPOS_MATERIAL, validarMaterial, validarOrden, formatearNumeroOC, esNumeroOC, normalizarCodigo, calcularTotales,
} from './ordenes-compra.js';
import { esFechaIso } from './fechas-semana.js';

export const COLECCION_MATERIALES = 'materiales';
export const COLECCION_ORDENES = 'ordenesCompra';
export const COLECCION_CONTADORES = 'contadores';
export const DOC_CONTADOR_ORDENES = 'ordenesCompra';
export const COLECCION_BORRADORES = 'ordenesCompraBorradores';

const ERR_PROVEEDOR_INACTIVO = 'El proveedor ya no está activo; elige otro.';

const exigirUsuario = (uid) => {
  if (!uid) throw new Error('Falta el usuario que guarda los cambios.');
  return uid;
};

const esRamo = (codigo) => RAMOS_MAESTRO.some((r) => r.codigo === codigo);

/** Crea un material nuevo. Si el código ya existe, no escribe nada y avisa «El código ya existe» (R2, CA2). */
export async function crearMaterial({ ejecutarTransaccion, refs, datos, uid, ahora = new Date() }) {
  const r = validarMaterial(datos);
  if (!r.ok) throw new Error(r.errores.join(' '));
  exigirUsuario(uid);
  const material = r.datos;
  await ejecutarTransaccion(async (tx) => {
    const ref = refs.material(material.codigo);
    const snap = await tx.get(ref);
    if (snap.exists()) throw Object.assign(new Error('El código ya existe.'), { code: 'codigo-existe' });
    tx.set(ref, { ...material, creadoEl: ahora.toISOString(), creadoPor: uid });
  });
  return material;
}

const CAMPOS_EDITABLES = ['descripcion', 'tipo', 'unidad', 'precioUnitario', 'activo'];

/** Cambia solo descripción, tipo, unidad, precio o `activo` de un material del maestro. Los ramos no se editan aquí. */
export async function actualizarMaterial({ ejecutarTransaccion, refs, codigo, cambios, uid }) {
  const clave = normalizarCodigo(codigo);
  if (esRamo(clave)) throw new Error('Los ramos se editan en «Valores de ramos»: su precio no se cambia en el maestro (código reservado).');
  exigirUsuario(uid);
  const origen = cambios && typeof cambios === 'object' ? cambios : {};
  const pedidos = CAMPOS_EDITABLES.filter((k) => origen[k] !== undefined);
  if (pedidos.length === 0) throw new Error('No hay ningún cambio para guardar.');
  const relleno = { codigo: 'XX', descripcion: 'x', tipo: TIPOS_MATERIAL[0], unidad: 'UNI', precioUnitario: 0 };
  const r = validarMaterial({ ...relleno, ...Object.fromEntries(pedidos.filter((k) => k !== 'activo').map((k) => [k, origen[k]])) });
  if (!r.ok) throw new Error(r.errores.join(' '));
  const datos = {};
  for (const k of pedidos) {
    if (k === 'activo') {
      if (typeof origen.activo !== 'boolean') throw new Error('El estado del material debe ser activo o retirado.');
      datos.activo = origen.activo;
    } else datos[k] = r.datos[k];
  }
  await ejecutarTransaccion(async (tx) => {
    const ref = refs.material(clave);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error(`El material ${clave} no existe.`);
    tx.update(ref, datos);
  });
  return datos;
}

/**
 * Emite una OC: toma el siguiente número del contador, guarda la orden con sus totales y avanza el contador, todo en una
 * transacción (R4, R5, R6). Una orden inválida no consume número. @returns {{numero: string, orden: object}}
 */
export async function emitirOrden({ ejecutarTransaccion, refs, datos, uid, ahora = new Date(), proveedorId = null }) {
  const r = validarOrden(datos);
  if (!r.ok) throw new Error(r.errores.join(' '));
  exigirUsuario(uid);
  return ejecutarTransaccion((tx) => emitirEnTransaccion(tx, { refs, datos: r.datos, uid, ahora, proveedorId }));
}

/**
 * Núcleo de la emisión (spec 057 T5). Todas las LECTURAS van antes que las escrituras (exigencia de Firestore):
 * proveedor (si viene con id), borrador (si viene), contador y el número libre. Después escribe la OC, avanza el contador y, si
 * viene de un borrador, lo marca con `emitidoComo`. Con proveedor, la OC guarda la copia de sus datos en el maestro (R-O3).
 */
async function emitirEnTransaccion(tx, { refs, datos, uid, ahora, proveedorId = null, borradorId = null }) {
  let proveedor = null;
  if (proveedorId) {
    const snapProveedor = await tx.get(refs.proveedor(proveedorId));
    const p = snapProveedor.exists() ? (snapProveedor.data() || {}) : null;
    if (!p || p.activo !== true) throw Object.assign(new Error(ERR_PROVEEDOR_INACTIVO), { code: 'proveedor-inactivo' });
    proveedor = {
      razonSocial: p.razonSocial ?? '', rut: p.rut ?? '', contacto: p.contacto ?? '', telefono: p.telefono ?? '', direccion: p.direccion ?? '',
    };
  }
  let refBorrador = null;
  if (borradorId) {
    refBorrador = refs.borrador(borradorId);
    const snapBorrador = await tx.get(refBorrador);
    if (!snapBorrador.exists()) throw new Error(`El borrador ${borradorId} no existe.`);
    const emitidoComo = (snapBorrador.data() || {}).emitidoComo;
    if (emitidoComo) throw new Error(`El borrador ya se emitió como ${emitidoComo}.`);
  }
  const refContador = refs.contador();
  const snapContador = await tx.get(refContador);
  const ultimo = snapContador.exists() ? (snapContador.data() || {}).ultimo : 0;
  if (!Number.isInteger(ultimo) || ultimo < 0) throw new Error('El contador de órdenes de compra no es válido: avisa al administrador antes de emitir.');
  const numero = formatearNumeroOC(ultimo + 1);
  const refOrden = refs.orden(numero);
  const snapOrden = await tx.get(refOrden);
  if (snapOrden.exists()) throw new Error(`La orden ${numero} ya existe: el contador está desfasado. Avisa al administrador.`);
  const orden = {
    numero,
    ...datos,
    ...(proveedor ? { proveedor, proveedorId } : {}),
    creadaEl: ahora.toISOString(),
    creadaPor: uid,
  };
  tx.set(refContador, { ultimo: ultimo + 1 });
  tx.set(refOrden, orden);
  if (refBorrador) tx.update(refBorrador, { emitidoComo: numero });
  return { numero, orden };
}

/** Emite la OC a partir de un borrador de día: los datos (fecha, condiciones, proveedor, líneas) los confirma quien emite. */
export async function emitirDesdeBorrador({ ejecutarTransaccion, refs, idBorrador, datos, proveedorId = null, uid, ahora = new Date() }) {
  const r = validarOrden(datos);
  if (!r.ok) throw new Error(r.errores.join(' '));
  exigirUsuario(uid);
  if (!idBorrador) throw new Error('Falta el borrador a emitir.');
  return ejecutarTransaccion((tx) => emitirEnTransaccion(tx, { refs, datos: r.datos, uid, ahora, proveedorId, borradorId: idBorrador }));
}

/**
 * Crea el borrador de OC de un día (spec 057, parte c). Un borrador por día: si ya existe, no escribe y devuelve `existe: true`
 * (CA-B3). No asigna número ni toca el contador (CA-B4). Los totales se recalculan (R6 de la 055).
 */
export async function crearBorradorDia({ ejecutarTransaccion, refs, id, datos, uid, ahora = new Date() }) {
  if (!esFechaIso(id)) throw new Error('La fecha del borrador no es válida (usa AAAA-MM-DD).');
  exigirUsuario(uid);
  const crudas = Array.isArray(datos && datos.lineas) ? datos.lineas : [];
  if (crudas.length === 0) throw new Error('El borrador necesita al menos una línea.');
  const lineas = crudas.map((l, i) => {
    const x = l && typeof l === 'object' ? l : {};
    const cantidad = Number(x.cantidad);
    const precioUnitario = Number(x.precioUnitario);
    if (!Number.isInteger(cantidad) || cantidad < 1 || !Number.isInteger(precioUnitario) || precioUnitario < 0) {
      throw new Error(`La línea ${i + 1} del borrador no es válida: cantidad entera de 1 o más y precio entero.`);
    }
    const valor = cantidad * precioUnitario;
    if (Number(x.valor) !== valor) throw new Error(`La línea ${i + 1} no cuadra: el valor debe ser cantidad por precio.`);
    return {
      codigo: String(x.codigo ?? ''), descripcion: String(x.descripcion ?? ''), unidad: String(x.unidad ?? 'UNI'), cantidad, precioUnitario, valor,
    };
  });
  const totales = calcularTotales(lineas);
  const iso = ahora.toISOString();
  return ejecutarTransaccion(async (tx) => {
    const ref = refs.borrador(id);
    const snap = await tx.get(ref);
    if (snap.exists()) return { existe: true };
    tx.set(ref, { fechaDia: id, lineas, ...totales, estado: 'Borrador', creadoEl: iso, creadoPor: uid });
    return { existe: false };
  });
}

/** Anula una OC emitida con motivo. No borra ni cambia líneas ni montos (R7). */
export async function anularOrden({ ejecutarTransaccion, refs, numero, motivo, uid, ahora = new Date() }) {
  if (!esNumeroOC(numero)) throw new Error('El número de la orden de compra no es válido.');
  const razon = String(motivo ?? '').trim();
  if (!razon) throw new Error('Escribe el motivo de la anulación.');
  exigirUsuario(uid);
  await ejecutarTransaccion(async (tx) => {
    const ref = refs.orden(numero);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error(`La orden ${numero} no existe.`);
    const estado = (snap.data() || {}).estado;
    if (estado === 'Anulada') throw new Error(`La orden ${numero} ya está anulada.`);
    if (estado !== 'Emitida') throw new Error(`La orden ${numero} no se puede anular desde el estado «${estado}».`);
    tx.update(ref, { estado: 'Anulada', anuladaEl: ahora.toISOString(), anuladaPor: uid, motivoAnulacion: razon });
  });
}

/** Texto para el usuario cuando falla una escritura. */
export function textoErrorOC(error) {
  const code = error && error.code;
  if (code === 'permission-denied') {
    return 'Firestore rechazó el guardado: tu usuario no tiene permiso, o las reglas de las órdenes de compra todavía no están publicadas. No se guardó nada.';
  }
  if (code === 'unavailable' || code === 'deadline-exceeded') return 'No hay conexión con el servidor. Revisa tu conexión y vuelve a intentar: no se guardó nada.';
  const mensaje = error && typeof error.message === 'string' ? error.message.trim() : '';
  return mensaje || 'No se pudo guardar. Vuelve a intentar.';
}

/** Texto para el usuario cuando falla una LECTURA al abrir la pantalla (no se intentó guardar nada). */
export function textoErrorCarga(error) {
  const code = error && error.code;
  if (code === 'permission-denied') {
    return 'No se pudieron leer las órdenes de compra: tu usuario no tiene permiso, o las reglas de las órdenes de compra todavía no están publicadas. Avisa al administrador.';
  }
  if (code === 'unavailable' || code === 'deadline-exceeded') return 'No hay conexión con el servidor. Revisa tu conexión y pulsa «Reintentar».';
  return 'No se pudieron cargar las órdenes de compra. Pulsa «Reintentar».';
}
