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
import { construirListaCompra } from './compra-ramos.js';

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

/**
 * Los 7 días de una semana con lo necesario para la tabla «Días de programación» de Rutas y feriados.
 * Usa construirListaCompra (el mismo cálculo de «Compra de flores») y diaListo. No lee ni escribe nada.
 * @param {object[]} filas   Filas de visitas (Planes y Spot) de construirFilasPlanificacion.
 * @param {{lunesIso: string, valores?: object, rutaDe?: (cementerio: string) => ({eje?: string, diaSemana?: number|null}|null), borradores?: Array<{id: string, data: object}>}} opciones
 * @returns {Array<{iso: string, nombre: string, display: string, visitas: number, ramos: number, listo: boolean, motivos: string[], borrador: ({id: string, emitidoComo: string}|null), detalle: object}>}
 */
export function diasDeProgramacion(filas, { lunesIso, valores = {}, rutaDe = () => null, borradores = [] } = {}) {
  const lista = construirListaCompra(filas, { lunesIso, valores });
  const tieneRuta = (cementerio) => {
    const r = rutaDe(cementerio);
    return Boolean(r && String(r.eje ?? '').trim() && r.diaSemana);
  };
  const porId = new Map((borradores || []).filter((b) => b && b.id).map((b) => [String(b.id), b.data || {}]));
  return lista.dias.map((d) => {
    const { listo, motivos } = diaListo(d, { tieneRuta });
    const b = porId.get(d.iso);
    return {
      iso: d.iso,
      nombre: d.nombre,
      display: d.display,
      visitas: d.visitas,
      ramos: d.totalRamos ?? 0,
      listo,
      motivos,
      borrador: b ? { id: d.iso, emitidoComo: typeof b.emitidoComo === 'string' ? b.emitidoComo : '' } : null,
      detalle: d,
    };
  });
}

/** Texto claro para el usuario cuando falla la creación del borrador (sin códigos técnicos crudos). */
export function textoErrorBorrador(error) {
  const code = error && error.code;
  if (code === 'permission-denied') {
    return 'Firestore rechazó el borrador: tu usuario no tiene permiso, o las reglas de los borradores todavía no están publicadas. No se creó nada.';
  }
  if (code === 'unavailable' || code === 'deadline-exceeded') return 'No hay conexión con el servidor. Revisa tu conexión y vuelve a intentar: no se creó nada.';
  const mensaje = error && typeof error.message === 'string' ? error.message.trim() : '';
  return mensaje || 'No se pudo crear el borrador. Vuelve a intentar.';
}
