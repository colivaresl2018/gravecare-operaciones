/**
 * ordenes-compra.js — lógica pura de las órdenes de compra a proveedores y del maestro de materiales (spec 055).
 * Sin Firestore ni DOM: se prueba con `node --test`.
 *
 * - Maestro: `materiales/{codigo}` (código en mayúsculas, [A-Z0-9-], 2 a 20). Un material no se borra: se retira con `activo: false` (R3).
 * - Enmienda 056 §12: los 5 ramos (RAM-STD, RAM-PRE, RAM-DLX, RAM-ADS, RAM-ADP) forman parte del catálogo, pero su precio sale
 *   SIEMPRE de `valores_ramos/compra` y no se edita en el maestro. Sus códigos están reservados. Un ramo sin valor queda sin precio:
 *   no se inventa ni se puede pedir.
 * - Totales (R6): valor = cantidad × precio; neto = Σ valor; IVA = round(neto × 0,19); total = neto + IVA. Se recalculan aquí al
 *   validar la orden, sin confiar en los números que traiga la pantalla.
 * - Una OC emitida es inmutable (R7): lo hace cumplir la regla de Firestore; aquí solo se arma y valida lo que se emite.
 */
import { esFechaIso } from './fechas-semana.js?v=b5';
import { normalizarValor, normalizarValores } from './compra-ramos.js?v=b5e2';

export const TIPOS_MATERIAL = ['Insumo', 'Arreglo floral', 'Servicio'];
export const CONDICIONES_PAGO = ['Transferencia', 'Factura a 30 días', 'Contado', 'Otro'];
export const TASA_IVA = 0.19;
const UNIDAD_POR_DEFECTO = 'UNI';
const MAX_UNIDAD = 10;
const MAX_DESCRIPCION = 120;
const MAX_TEXTO = 120;

/** Los ramos del maestro: el código es fijo y el precio sale de la clave de `valores_ramos/compra`. */
export const RAMOS_MAESTRO = [
  { codigo: 'RAM-STD', clave: 'standard', descripcion: 'Ramo Standard' },
  { codigo: 'RAM-PRE', clave: 'premium', descripcion: 'Ramo Premium' },
  { codigo: 'RAM-DLX', clave: 'deluxe', descripcion: 'Ramo Deluxe' },
  { codigo: 'RAM-ADS', clave: 'adicionalStandard', descripcion: 'Ramo Adicional Standard' },
  { codigo: 'RAM-ADP', clave: 'adicionalPremium', descripcion: 'Ramo Adicional Premium' },
];

const texto = (v) => String(v ?? '').trim();
const esCodigoDeRamo = (codigo) => RAMOS_MAESTRO.some((r) => r.codigo === codigo);

export function normalizarCodigo(valor) {
  return texto(valor).toUpperCase();
}

export function esCodigoValido(codigo) {
  return typeof codigo === 'string' && /^[A-Z0-9-]{2,20}$/.test(codigo);
}

/** Entero en pesos ≥ 0, con formato chileno aceptado («12.500»). Un decimal («12,5») no vale: el precio es en pesos enteros. */
function precioEntero(valor) {
  const n = normalizarValor(valor);
  if (n === null) return null;
  if (typeof valor !== 'number' && /,/.test(String(valor))) return null;
  return Number.isInteger(n) ? n : null;
}

/** @returns {{ok: true, datos: object} | {ok: false, errores: string[]}} */
export function validarMaterial(entrada) {
  const e = entrada && typeof entrada === 'object' ? entrada : {};
  const errores = [];
  const codigo = normalizarCodigo(e.codigo);
  const descripcion = texto(e.descripcion);
  const tipo = texto(e.tipo);
  const unidad = texto(e.unidad) || UNIDAD_POR_DEFECTO;
  const precio = precioEntero(e.precioUnitario);

  if (!esCodigoValido(codigo)) errores.push('El código debe tener de 2 a 20 caracteres: letras mayúsculas, números o guion (por ejemplo INS-010).');
  else if (esCodigoDeRamo(codigo)) errores.push('Ese código está reservado para los ramos: su precio sale de «Valores de ramos» y no se crea a mano.');
  if (!descripcion) errores.push('Falta la descripción.');
  else if (descripcion.length > MAX_DESCRIPCION) errores.push(`La descripción es demasiado larga (máximo ${MAX_DESCRIPCION} letras).`);
  if (!TIPOS_MATERIAL.includes(tipo)) errores.push('Elige el tipo: Insumo, Arreglo floral o Servicio.');
  if (unidad.length > MAX_UNIDAD) errores.push(`La unidad es demasiado larga (máximo ${MAX_UNIDAD} letras).`);
  if (precio === null) errores.push('El precio debe ser un número entero de pesos, 0 o más (por ejemplo 12.500).');

  return errores.length
    ? { ok: false, errores }
    : { ok: true, datos: { codigo, descripcion, tipo, unidad, precioUnitario: precio, activo: true } };
}

/**
 * Catálogo para armar órdenes: los 5 ramos (precio de valores_ramos) y el maestro. Un documento del maestro con el código de un
 * ramo se ignora (el ramo manda). Precio `null` = sin valor.
 * @param {Array<{id: string, data: object}>} docsMateriales
 * @param {object} valoresRamos contenido de `valores_ramos/compra`
 */
export function catalogoMateriales(docsMateriales, valoresRamos) {
  const valores = normalizarValores(valoresRamos);
  const ramos = RAMOS_MAESTRO.map((r) => ({
    codigo: r.codigo, descripcion: r.descripcion, tipo: 'Arreglo floral', unidad: UNIDAD_POR_DEFECTO,
    precioUnitario: valores[r.clave], activo: true, origen: 'ramo', editable: false,
  }));
  const vistos = new Set();
  const maestro = [];
  for (const item of Array.isArray(docsMateriales) ? docsMateriales : []) {
    if (!item || !item.id) continue;
    const d = item.data && typeof item.data === 'object' ? item.data : {};
    const codigo = normalizarCodigo(d.codigo || item.id);
    if (!codigo || esCodigoDeRamo(codigo) || vistos.has(codigo)) continue;
    vistos.add(codigo);
    const precio = Number.isInteger(d.precioUnitario) && d.precioUnitario >= 0 ? d.precioUnitario : null;
    maestro.push({
      codigo, descripcion: texto(d.descripcion), tipo: texto(d.tipo) || 'Insumo', unidad: texto(d.unidad) || UNIDAD_POR_DEFECTO,
      precioUnitario: precio, activo: d.activo !== false, origen: 'maestro', editable: true,
    });
  }
  maestro.sort((a, b) => a.codigo.localeCompare(b.codigo, 'es'));
  return [...ramos, ...maestro];
}

export function buscarMaterial(catalogo, codigoEscrito) {
  const codigo = normalizarCodigo(codigoEscrito);
  if (!codigo) return null;
  return (Array.isArray(catalogo) ? catalogo : []).find((m) => m.codigo === codigo) || null;
}

/** Cantidad entera ≥ 1 (número o texto de solo dígitos); todo lo demás es inválido. */
function cantidadEntera(valor) {
  const n = typeof valor === 'number' ? valor : /^\d+$/.test(texto(valor)) ? Number(texto(valor)) : NaN;
  return Number.isInteger(n) && n >= 1 ? n : null;
}

/** Arma una línea de OC desde el catálogo (CA4–CA6). @returns {{ok: true, linea: object} | {ok: false, error: string}} */
export function validarLinea(entrada, catalogo) {
  const e = entrada && typeof entrada === 'object' ? entrada : {};
  const material = buscarMaterial(catalogo, e.codigo);
  if (!material) return { ok: false, error: `El código «${normalizarCodigo(e.codigo)}» no está en el maestro de materiales.` };
  if (!material.activo) return { ok: false, error: `El material ${material.codigo} está retirado y no se puede pedir.` };
  const cantidad = cantidadEntera(e.cantidad);
  if (cantidad === null) return { ok: false, error: 'La cantidad debe ser un número entero de 1 o más.' };
  if (material.precioUnitario === null) {
    return { ok: false, error: `${material.codigo} está sin valor: ${material.origen === 'ramo' ? 'cárgalo en «Valores de ramos»' : 'edita su precio en el maestro'} antes de pedirlo.` };
  }
  return {
    ok: true,
    linea: {
      codigo: material.codigo, descripcion: material.descripcion, unidad: material.unidad, cantidad,
      precioUnitario: material.precioUnitario, valor: cantidad * material.precioUnitario,
    },
  };
}

/** Neto, IVA y total (R6). El IVA se calcula con enteros para evitar errores de redondeo binario. */
export function calcularTotales(lineas) {
  const neto = (Array.isArray(lineas) ? lineas : []).reduce((suma, l) => suma + (Number(l && l.valor) || 0), 0);
  const iva = Math.round((neto * Math.round(TASA_IVA * 100)) / 100);
  return { neto, iva, total: neto + iva };
}

/**
 * Valida y completa una OC antes de emitirla (R5, R6, R8). Devuelve solo los campos de R5 que arma el cliente (el número, quién y
 * cuándo los agrega la emisión). Recalcula valor y totales.
 * @returns {{ok: true, datos: object} | {ok: false, errores: string[]}}
 */
export function validarOrden(entrada) {
  const e = entrada && typeof entrada === 'object' ? entrada : {};
  const p = e.proveedor && typeof e.proveedor === 'object' ? e.proveedor : {};
  const errores = [];
  const fecha = texto(e.fecha);
  const fechaEntrega = texto(e.fechaEntrega);
  const condicionesPago = texto(e.condicionesPago);
  const proveedor = {
    razonSocial: texto(p.razonSocial), rut: texto(p.rut), contacto: texto(p.contacto), telefono: texto(p.telefono), direccion: texto(p.direccion),
  };
  const lugarEntrega = texto(e.lugarEntrega);

  if (!esFechaIso(fecha)) errores.push('La fecha de la orden no es válida (usa AAAA-MM-DD).');
  if (fechaEntrega) {
    if (!esFechaIso(fechaEntrega)) errores.push('La fecha de entrega no es válida (usa AAAA-MM-DD).');
    else if (esFechaIso(fecha) && fechaEntrega < fecha) errores.push('La fecha de entrega no puede ser anterior a la fecha de la orden.');
  }
  if (!proveedor.razonSocial) errores.push('Falta la razón social del proveedor.');
  for (const [campo, valor] of Object.entries({ ...proveedor, lugarEntrega })) {
    if (valor.length > MAX_TEXTO) errores.push(`El texto de «${campo}» es demasiado largo (máximo ${MAX_TEXTO} letras).`);
  }
  if (!CONDICIONES_PAGO.includes(condicionesPago)) errores.push('Elige una condición de pago de la lista.');

  const crudas = Array.isArray(e.lineas) ? e.lineas : [];
  if (crudas.length === 0) errores.push('La orden necesita al menos una línea.');
  const lineas = [];
  crudas.forEach((l, i) => {
    const x = l && typeof l === 'object' ? l : {};
    const codigo = normalizarCodigo(x.codigo);
    const cantidad = cantidadEntera(x.cantidad);
    const precio = precioEntero(x.precioUnitario);
    if (!esCodigoValido(codigo) || !texto(x.descripcion) || cantidad === null || precio === null) {
      errores.push(`La línea ${i + 1} no es válida: revisa código, descripción, cantidad (entera, 1 o más) y precio.`);
      return;
    }
    lineas.push({ codigo, descripcion: texto(x.descripcion), unidad: texto(x.unidad) || UNIDAD_POR_DEFECTO, cantidad, precioUnitario: precio, valor: cantidad * precio });
  });

  if (errores.length) return { ok: false, errores };
  const totales = calcularTotales(lineas);
  return {
    ok: true,
    datos: { fecha, fechaEntrega, proveedor, condicionesPago, lugarEntrega, lineas, ...totales, estado: 'Emitida' },
  };
}

/** `OC-0001` (cuatro dígitos como mínimo; pasado 9999 sigue creciendo). */
export function formatearNumeroOC(n) {
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 1) throw new Error('El número de la orden de compra debe ser un entero de 1 o más.');
  return `OC-${String(n).padStart(4, '0')}`;
}

export function esNumeroOC(valor) {
  return typeof valor === 'string' && /^OC-\d{4,}$/.test(valor);
}
