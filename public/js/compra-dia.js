/**
 * compra-dia.js — un día de programación listo para una orden de compra (spec 057, parte c). Lógica pura: sin DOM ni Firebase.
 *
 * - «Día listo» (R-B1): hay visitas, cada cementerio del día tiene eje y día de ruta, y ningún ramo está «sin valor».
 *   Si no está listo, se devuelven los motivos para mostrarlos junto al botón deshabilitado.
 * - El borrador trae solo los ramos del día (decisión 5, opción a): no hay vínculo entre visitas e insumos en la base.
 * - Los precios vienen de `valores_ramos/compra` a través de construirListaCompra; nunca se inventa un precio (R6 de la 056).
 * - Un borrador por día (decisión 6, aprobada): su id es la fecha AAAA-MM-DD, así pulsar dos veces no duplica.
 */
import { RAMOS_MAESTRO, calcularTotales } from './ordenes-compra.js';
import { esFechaIso } from './fechas-semana.js';

/**
 * @param {object} dia        Un día de construirListaCompra (con cementerios, visitas, lineas e incompleto).
 * @param {{tieneRuta?: (cementerio: string) => boolean}} opciones  Dice si el cementerio tiene eje y día de ruta.
 * @returns {{listo: boolean, motivos: string[]}}
 */
export function diaListo(dia, { tieneRuta = () => true } = {}) {
  const motivos = [];
  if (!dia || !dia.visitas) motivos.push('No hay visitas programadas este día.');
  for (const c of (dia && dia.cementerios) || []) {
    if (!tieneRuta(c.cementerio)) motivos.push(`Sin eje y día de ruta: ${c.cementerio}.`);
  }
  for (const l of (dia && dia.lineas) || []) {
    if (l.valorUnitario === null || l.valorUnitario === undefined) motivos.push(`Falta el valor de «${l.texto}» en Valores de ramos.`);
  }
  return { listo: motivos.length === 0, motivos };
}

/** Id del borrador de un día: su fecha AAAA-MM-DD. null si la fecha no es válida. */
export function idBorrador({ fecha } = {}) {
  const f = String(fecha ?? '').trim();
  return esFechaIso(f) ? f : null;
}

/**
 * Líneas de una OC con los ramos del día. Si algún ramo no tiene precio, no arma el borrador (no se inventa un precio).
 * @returns {{ok: true, datos: {lineas: object[], neto: number, iva: number, total: number}} | {ok: false, errores: string[]}}
 */
export function borradorDesdeDia(dia) {
  const lineas = [];
  const errores = [];
  for (const l of (dia && dia.lineas) || []) {
    if (l.cantidad <= 0) continue;
    const ramo = RAMOS_MAESTRO.find((r) => r.clave === l.clave);
    if (!ramo) continue;
    if (l.valorUnitario === null || l.valorUnitario === undefined) {
      errores.push(`«${l.texto}» está sin valor en Valores de ramos.`);
      continue;
    }
    lineas.push({
      codigo: ramo.codigo,
      descripcion: ramo.descripcion,
      unidad: 'UNI',
      cantidad: l.cantidad,
      precioUnitario: l.valorUnitario,
      valor: l.cantidad * l.valorUnitario,
    });
  }
  if (errores.length) return { ok: false, errores };
  if (lineas.length === 0) return { ok: false, errores: ['El día no tiene ramos que comprar.'] };
  return { ok: true, datos: { lineas, ...calcularTotales(lineas) } };
}
