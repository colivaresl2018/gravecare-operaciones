/**
 * nombre-cliente.js — extractor único del nombre del cliente/titular de una orden.
 *
 * Problema: varias páginas leían solo `titular.nombreCompleto || titular.nombreCliente || clienteNombre || usuario`,
 * y las órdenes cuyo titular trae `nombre`, o `nombres + apellidoPaterno + apellidoMaterno`, terminaban mostrando
 * el genérico «Cliente».
 *
 * Orden de búsqueda (el primer nombre real gana):
 *   1. titular.nombreCompleto
 *   2. titular.nombre (si el titular trae apellidos aparte, se le agregan)
 *   3. titular.nombres + apellidoPaterno + apellidoMaterno
 *   4. la misma concatenación en la raíz de la orden
 *   5. nombreCompleto, nombreCliente, clienteNombre, cliente (si es texto) de la orden
 *   6. comprador.nombreCompleto / comprador.nombre
 *   7. respaldo: el contrato de la orden (contratos/CTR-<numeroOrden>), si el staff puede leerlo; se le aplican las
 *      mismas variantes, más titularNombre, contratante y cliente.nombreCompleto
 * Se ignoran los genéricos («Cliente», «Cliente Registrado», vacío) y los correos.
 *
 * NO se lee `usuarios/{uid}`: según firestore.rules solo lo lee su dueño, así que el staff no puede (se verificó
 * contra las reglas publicadas del repo de la web). Sin lectura de Firebase aquí: se prueba con node --test.
 */

const GENERICOS = ['cliente', 'cliente registrado', 'sin información', 'sin informacion', 'sin nombre', 'sin datos',
  'titular', 'usuario', 'n/a', 'na', '-', '—', 'undefined', 'null', '[object object]'];

const t = (v) => (typeof v === 'string' || typeof v === 'number' ? String(v).replace(/\s+/g, ' ').trim() : '');

/** ¿El texto es vacío, un genérico («Cliente», «Cliente Registrado»…) o un correo? */
export function esNombreGenerico(valor) {
  const s = t(valor);
  if (!s) return true;
  if (s.includes('@')) return true;
  return GENERICOS.includes(s.toLowerCase());
}

/** Une partes de un nombre sin repetir las que ya están contenidas. */
function unir(partes) {
  let salida = '';
  for (const p of partes.map(t).filter(Boolean)) {
    if (!salida) salida = p;
    else if (!salida.toLowerCase().includes(p.toLowerCase())) salida += ` ${p}`;
  }
  return salida;
}

/** Nombre a partir de un objeto con los campos habituales (titular, raíz de la orden, comprador, contrato). */
export function nombreDesdeObjeto(obj) {
  if (!obj || typeof obj !== 'object') return '';
  const completo = t(obj.nombreCompleto);
  if (completo && !esNombreGenerico(completo)) return completo;
  const base = t(obj.nombres) || t(obj.nombre);
  const apellidos = [obj.apellidoPaterno, obj.apellidoMaterno];
  const unido = unir([base, ...apellidos]);
  if (unido && !esNombreGenerico(unido)) return unido;
  const conApellidos = t(obj.apellidos);
  const alt = unir([base, conApellidos]);
  return alt && !esNombreGenerico(alt) ? alt : '';
}

/**
 * Nombre del cliente de la orden, o '' si ninguna variante sirve.
 * @param {object} orden
 * @param {object[]} [respaldos]  documentos que también pueden traer el nombre (p. ej. el contrato de la orden)
 */
export function nombreClienteDeOrden(orden, respaldos = []) {
  const o = orden || {};
  const tit = o.titular;
  const candidatos = [];
  if (typeof tit === 'string') candidatos.push(tit);
  else if (tit && typeof tit === 'object') candidatos.push(nombreDesdeObjeto(tit));
  // Raíz de la orden: solo la concatenación nombres + apellidos y nombreCompleto (un `nombre` suelto en la raíz podría ser otra cosa).
  candidatos.push(t(o.nombres) ? unir([o.nombres, o.apellidoPaterno, o.apellidoMaterno]) : '');
  candidatos.push(o.nombreCompleto, o.nombreCliente, o.clienteNombre, o.titularNombre);
  if (typeof o.cliente === 'string') candidatos.push(o.cliente);
  else candidatos.push(nombreDesdeObjeto(o.cliente));
  if (typeof o.contratante === 'string') candidatos.push(o.contratante);
  else candidatos.push(nombreDesdeObjeto(o.contratante));
  candidatos.push(nombreDesdeObjeto(o.comprador));
  for (const c of candidatos) {
    const s = t(c);
    if (s && !esNombreGenerico(s)) return s;
  }
  // Respaldos (p. ej. el contrato): mismas variantes (titular, nombres + apellidos, nombreCliente, titularNombre,
  // contratante, cliente.nombreCompleto…). Una sola pasada por cada uno, sin volver a recorrer respaldos.
  for (const r of respaldos || []) {
    const s = r && typeof r === 'object' ? (nombreClienteDeOrden(r) || nombreDesdeObjeto(r)) : '';
    if (s && !esNombreGenerico(s)) return s;
  }
  return '';
}

/** Nombre para mostrar: el de la orden (o del respaldo) o el genérico «Cliente» si nada sirve. */
export function nombreClienteParaMostrar(orden, respaldos = []) {
  return nombreClienteDeOrden(orden, respaldos) || 'Cliente';
}

/** Ids con que un contrato puede estar guardado para esa orden (`CTR-<numeroOrden>` según el contrato de datos). */
export function idsContratoDeOrden(orden, docId) {
  const o = orden || {};
  return [...new Set([o.numeroOrden, o.ordenId, docId].filter(Boolean).map((x) => `CTR-${x}`))];
}

/**
 * Lee los contratos UNA vez (el staff puede listarlos) y devuelve un Map id→datos para buscar sin más lecturas.
 * `leerColeccion` devuelve una promesa con una lista de [id, datos]. Si falla (reglas, red) devuelve un Map vacío:
 * el nombre queda como esté en la orden y la página no se rompe.
 */
export async function cargarContratos(leerColeccion) {
  const mapa = new Map();
  try {
    for (const [id, data] of await leerColeccion()) if (id && data) mapa.set(String(id), data);
  } catch {
    // sin permiso o sin red: no hay respaldo
  }
  return mapa;
}

/** Contratos de la orden presentes en el Map de cargarContratos. */
export function contratosDeOrden(mapaContratos, orden, docId) {
  if (!mapaContratos) return [];
  return idsContratoDeOrden(orden, docId).map((id) => mapaContratos.get(id)).filter(Boolean);
}
