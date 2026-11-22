/**
 * resumen-ventas.js — lógica pura del «Resumen de Ventas» de Planificación (directriz B5, R4). Solo lectura.
 *
 * - Una venta = orden con pago confirmado (esOrdenPagada), contada en su fecha de pago (`fechaPago`); si falta, en su fecha de creación.
 * - El monto es el `montoTotal` que guarda el servidor. NO se recalcula en el navegador: ni por plan, ni por nivel, ni con tablas locales.
 * - Una orden sin fecha utilizable o sin `montoTotal` NO entra en ningún período: se cuenta aparte para avisar.
 * - Las órdenes pagadas en integración de Transbank (PRUEBA) no son ventas reales: no suman y se cuentan aparte.
 * - Sin DOM ni Firebase: se prueba con `node --test`.
 */
import { esOrdenPagada, esOrdenDePrueba } from './orden-pagada.js';
import { esSpot, normalizarFechaSinDesfase, ramosAdicionalesDeOrden } from './planificacion-servicios.js?v=b5';
import { esFechaIso, lunesDeLaSemana, sumarDias, mesDeIso, nombreMes, hoyIso, fechaDisplay } from './fechas-semana.js';

/** «$1.234.567». */
export function formatoPesos(n) {
  return `$${Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

/**
 * Fecha en que se cuenta la venta: `fechaPago`; si falta (o no es una fecha), la de creación.
 * @returns {{ iso: string, origen: 'pago' | 'creacion' } | null}
 */
export function fechaDeVenta(orden) {
  if (!orden) return null;
  const pago = normalizarFechaSinDesfase(orden.fechaPago);
  if (pago) return { iso: pago.iso, origen: 'pago' };
  for (const candidata of [orden.creadoEl, orden.createdAt]) {
    const f = normalizarFechaSinDesfase(candidata);
    if (f) return { iso: f.iso, origen: 'creacion' };
  }
  return null;
}

/** `montoTotal` que guardó el servidor (número entero >= 0, o dígitos en texto); null si falta o no es válido. */
export function montoDeVenta(orden) {
  const v = orden ? orden.montoTotal : null;
  let n = null;
  if (typeof v === 'number') n = v;
  else if (typeof v === 'string' && /^\d+(\.\d+)?$/.test(v.trim())) n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

const vacias = () => ({ ventas: 0, planes: 0, spot: 0, ramosAdicionales: 0, monto: 0, ticket: 0 });

function sumar(metricas, venta) {
  metricas.ventas += 1;
  if (venta.esSpot) metricas.spot += 1; else metricas.planes += 1;
  metricas.ramosAdicionales += venta.ramosAdicionales;
  metricas.monto += venta.monto;
  metricas.ticket = Math.round(metricas.monto / metricas.ventas);
}

function resumir(ventas, titulo, desde, hasta) {
  const m = { titulo, desde, hasta, ...vacias() };
  for (const v of ventas) if (v.iso >= desde && v.iso <= hasta) sumar(m, v);
  return m;
}

function ultimoDiaDelMes(mesIso) {
  const [y, m] = mesIso.split('-').map(Number);
  return `${mesIso}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
}

/**
 * @param {Array<{id: string, data: object}>} ordenes  Órdenes pagadas (la pantalla ya las filtra con esOrdenPagada; aquí se vuelve a exigir).
 * @param {{ referenciaIso?: string, desdeIso?: string, hastaIso?: string }} [opciones]
 */
export function construirResumenVentas(ordenes, { referenciaIso = '', desdeIso = '', hastaIso = '' } = {}) {
  const referencia = esFechaIso(referenciaIso) ? referenciaIso : hoyIso();
  const avisos = { sinFecha: 0, sinMonto: 0, fechaCreacion: 0, pruebas: 0, excluidas: 0 };
  const ventas = [];

  for (const item of ordenes || []) {
    const orden = (item && item.data) || null;
    if (!esOrdenPagada(orden)) continue;
    if (esOrdenDePrueba(orden)) { avisos.pruebas += 1; continue; }
    const fecha = fechaDeVenta(orden);
    const monto = montoDeVenta(orden);
    if (!fecha) avisos.sinFecha += 1;
    if (monto === null) avisos.sinMonto += 1;
    if (!fecha || monto === null) { avisos.excluidas += 1; continue; }
    if (fecha.origen === 'creacion') avisos.fechaCreacion += 1;
    ventas.push({ iso: fecha.iso, monto, esSpot: esSpot(orden), ramosAdicionales: ramosAdicionalesDeOrden(orden) });
  }

  const lunes = lunesDeLaSemana(referencia);
  const mes = mesDeIso(referencia);
  const anio = referencia.slice(0, 4);
  let periodo = null;
  if (esFechaIso(desdeIso) && esFechaIso(hastaIso)) {
    const [d, h] = desdeIso <= hastaIso ? [desdeIso, hastaIso] : [hastaIso, desdeIso];
    periodo = resumir(ventas, 'Periodo', d, h);
  }

  const tarjetas = {
    dia: resumir(ventas, 'Día', referencia, referencia),
    semana: resumir(ventas, 'Semana', lunes, sumarDias(lunes, 6)),
    mes: resumir(ventas, nombreMes(mes), `${mes}-01`, ultimoDiaDelMes(mes)),
    anio: resumir(ventas, `Año ${anio}`, `${anio}-01-01`, `${anio}-12-31`),
    periodo,
  };

  // Tabla diaria: los días con ventas del filtro activo (el periodo si lo hay; si no, el mes de referencia).
  const desdeDiaria = periodo ? periodo.desde : `${mes}-01`;
  const hastaDiaria = periodo ? periodo.hasta : ultimoDiaDelMes(mes);
  const diasConVentas = [...new Set(ventas.filter((v) => v.iso >= desdeDiaria && v.iso <= hastaDiaria).map((v) => v.iso))].sort();
  const diaria = diasConVentas.map((iso) => ({ clave: iso, etiqueta: fechaDisplay(iso), ...resumir(ventas, '', iso, iso) }));

  // Tabla semanal: semanas (lunes a domingo) del año de referencia con ventas.
  const lunesConVentas = [...new Set(ventas.filter((v) => v.iso.startsWith(anio)).map((v) => lunesDeLaSemana(v.iso)))].sort();
  const semanal = lunesConVentas.map((l) => ({ clave: l, etiqueta: `${fechaDisplay(l)} al ${fechaDisplay(sumarDias(l, 6))}`, ...resumir(ventas, '', l, sumarDias(l, 6)) }));

  // Tabla mensual: los 12 meses del año de referencia.
  const mensual = Array.from({ length: 12 }, (_, i) => {
    const clave = `${anio}-${String(i + 1).padStart(2, '0')}`;
    return { clave, etiqueta: nombreMes(clave), ...resumir(ventas, '', `${clave}-01`, ultimoDiaDelMes(clave)) };
  });

  return { referencia, tarjetas, diaria, semanal, mensual, avisos, periodoActivo: Boolean(periodo) };
}
