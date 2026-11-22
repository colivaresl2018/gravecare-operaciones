// Resumen de Ventas (directriz B5, R4): lógica pura. Ejecutar: node --test public/js/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { construirResumenVentas, fechaDeVenta, montoDeVenta, formatoPesos } from './resumen-ventas.js';

const o = (id, data) => ({ id, data: { pagoConfirmado: true, estado: 'Confirmado', ...data } });
const plan = (id, fechaPago, montoTotal, extra = {}) => o(id, { tipoPlan: 'Plan 4', fechaPago, montoTotal, ...extra });
const spot = (id, fechaPago, montoTotal, extra = {}) => o(id, { tipoServicio: 'SPOT', fechaPago, montoTotal, ...extra });

const REF = '2026-11-18'; // miércoles; semana 16–22 nov

test('fecha de la venta: fechaPago; si falta, la fecha de creación; si no hay ninguna, null', () => {
  assert.deepEqual(fechaDeVenta({ fechaPago: '2026-11-05', creadoEl: '2026-10-01' }), { iso: '2026-11-05', origen: 'pago' });
  assert.deepEqual(fechaDeVenta({ creadoEl: '2026-10-01' }), { iso: '2026-10-01', origen: 'creacion' });
  assert.deepEqual(fechaDeVenta({ createdAt: { toDate: () => new Date(2026, 9, 2, 10) } }), { iso: '2026-10-02', origen: 'creacion' });
  assert.deepEqual(fechaDeVenta({ fechaPago: 'basura', creadoEl: '2026-10-01' }), { iso: '2026-10-01', origen: 'creacion' });
  assert.equal(fechaDeVenta({}), null);
  assert.equal(fechaDeVenta(null), null);
});

test('monto de la venta: el montoTotal que guardó el servidor; ausente o inválido es null (no se recalcula)', () => {
  assert.equal(montoDeVenta({ montoTotal: 45000 }), 45000);
  assert.equal(montoDeVenta({ montoTotal: '45000' }), 45000);
  assert.equal(montoDeVenta({ montoTotal: 0 }), 0);
  assert.equal(montoDeVenta({}), null);
  assert.equal(montoDeVenta({ montoTotal: null }), null);
  assert.equal(montoDeVenta({ montoTotal: 'mucho' }), null);
  assert.equal(montoDeVenta({ montoTotal: -5 }), null);
  assert.equal(montoDeVenta({ precioNumerico: 99999, total: 1, monto: 2 }), null); // otros campos no sustituyen a montoTotal
});

test('el monto sale de montoTotal aunque el plan y el nivel «valgan» otra cosa en una tabla local', () => {
  const r = construirResumenVentas([plan('a', '2026-11-18', 123456, { nivel: 'Deluxe' })], { referenciaIso: REF });
  assert.equal(r.tarjetas.dia.monto, 123456);
});

test('tarjetas Día / Semana / Mes / Año: cada venta cae en su fecha de pago', () => {
  const ordenes = [
    plan('hoy', '2026-11-18', 10000),
    plan('lunes', '2026-11-16', 20000), // misma semana
    plan('domingo', '2026-11-22', 5000), // misma semana (la semana termina en domingo)
    plan('mes', '2026-11-03', 40000), // mismo mes, otra semana
    plan('anio', '2026-02-10', 80000), // mismo año
    plan('antes', '2025-12-31', 160000), // otro año
  ];
  const t = construirResumenVentas(ordenes, { referenciaIso: REF }).tarjetas;
  assert.deepEqual([t.dia.ventas, t.dia.monto], [1, 10000]);
  assert.deepEqual([t.semana.ventas, t.semana.monto], [3, 35000]);
  assert.deepEqual([t.mes.ventas, t.mes.monto], [4, 75000]);
  assert.deepEqual([t.anio.ventas, t.anio.monto], [5, 155000]);
  assert.equal(t.periodo, null);
});

test('periodo desde/hasta: incluye ambos extremos; si vienen al revés se ordenan; si falta uno no hay periodo', () => {
  const ordenes = [plan('a', '2026-11-01', 1000), plan('b', '2026-11-10', 2000), plan('c', '2026-11-20', 4000), plan('d', '2026-11-21', 8000)];
  const t = (x) => construirResumenVentas(ordenes, { referenciaIso: REF, ...x }).tarjetas.periodo;
  assert.deepEqual([t({ desdeIso: '2026-11-10', hastaIso: '2026-11-20' }).ventas, t({ desdeIso: '2026-11-10', hastaIso: '2026-11-20' }).monto], [2, 6000]);
  assert.equal(t({ desdeIso: '2026-11-20', hastaIso: '2026-11-10' }).monto, 6000);
  assert.equal(t({ desdeIso: '2026-11-10' }), null);
  assert.equal(t({ desdeIso: 'x', hastaIso: '2026-11-20' }), null);
});

test('métricas: ventas, planes, Spot, ramos adicionales, monto y ticket promedio', () => {
  const r = construirResumenVentas([
    plan('p1', '2026-11-18', 30000, { nivel: 'Premium', ramosAdicionales: 2 }),
    plan('p2', '2026-11-18', 10000),
    spot('s1', '2026-11-18', 20000, { ramosAdicionales: 1 }),
  ], { referenciaIso: REF });
  assert.deepEqual(r.tarjetas.dia, { ...r.tarjetas.dia, ventas: 3, planes: 2, spot: 1, ramosAdicionales: 3, monto: 60000, ticket: 20000 });
});

test('ticket promedio sin ventas es 0 (no NaN) y se redondea al peso', () => {
  const vacio = construirResumenVentas([], { referenciaIso: REF }).tarjetas.dia;
  assert.deepEqual([vacio.ventas, vacio.monto, vacio.ticket], [0, 0, 0]);
  const r = construirResumenVentas([plan('a', '2026-11-18', 10000), plan('b', '2026-11-18', 10001), plan('c', '2026-11-18', 10001)], { referenciaIso: REF });
  assert.equal(r.tarjetas.dia.ticket, 10001);
});

test('venta sin fecha de pago ni de creación: se avisa aparte y no entra en ningún período', () => {
  const r = construirResumenVentas([plan('a', '2026-11-18', 10000), o('sin', { tipoPlan: 'Plan 4', montoTotal: 99000 })], { referenciaIso: REF, desdeIso: '2000-01-01', hastaIso: '2100-01-01' });
  assert.equal(r.avisos.sinFecha, 1);
  for (const k of ['dia', 'semana', 'mes', 'anio', 'periodo']) assert.equal(r.tarjetas[k].ventas, 1, k); // solo la que tiene fecha
  assert.equal(r.tarjetas.periodo.monto, 10000);
  assert.equal(r.mensual.reduce((s, m) => s + m.ventas, 0), 1);
});

test('venta sin montoTotal: se avisa aparte y no entra en ningún período (ni suma 0)', () => {
  const r = construirResumenVentas([plan('a', '2026-11-18', 10000), o('sin', { tipoPlan: 'Plan 4', fechaPago: '2026-11-18' })], { referenciaIso: REF });
  assert.equal(r.avisos.sinMonto, 1);
  assert.equal(r.tarjetas.dia.ventas, 1);
  assert.equal(r.tarjetas.anio.ventas, 1);
});

test('una venta que no tiene ni fecha ni monto se cuenta en las dos advertencias, una sola vez como excluida', () => {
  const r = construirResumenVentas([o('x', { tipoPlan: 'Plan 4' })], { referenciaIso: REF });
  assert.deepEqual([r.avisos.sinFecha, r.avisos.sinMonto, r.avisos.excluidas], [1, 1, 1]);
});

test('las ventas que usan la fecha de creación se cuentan para avisar que no tienen fecha de pago', () => {
  const r = construirResumenVentas([plan('a', '2026-11-18', 10000), o('b', { tipoPlan: 'Plan 4', montoTotal: 5000, creadoEl: '2026-11-17' })], { referenciaIso: REF });
  assert.equal(r.avisos.fechaCreacion, 1);
  assert.equal(r.tarjetas.dia.ventas, 1);
  assert.equal(r.tarjetas.semana.ventas, 2);
});

test('las órdenes pagadas en integración de Transbank (PRUEBA) no suman como venta y se cuentan aparte', () => {
  const r = construirResumenVentas([plan('real', '2026-11-18', 10000), plan('prueba', '2026-11-18', 777000, { modoPago: 'integracion' })], { referenciaIso: REF });
  assert.deepEqual([r.tarjetas.dia.ventas, r.tarjetas.dia.monto, r.avisos.pruebas], [1, 10000, 1]);
});

test('una orden sin pago confirmado no es venta aunque llegue en la lista', () => {
  const r = construirResumenVentas([{ id: 'x', data: { pagoConfirmado: false, estado: 'iniciada', tipoPlan: 'Plan 4', fechaPago: '2026-11-18', montoTotal: 9000 } }], { referenciaIso: REF });
  assert.equal(r.tarjetas.dia.ventas, 0);
});

test('tabla diaria: sin periodo son los días del mes de referencia con ventas; con periodo, los días de ese rango', () => {
  const ordenes = [plan('a', '2026-11-03', 1000), plan('b', '2026-11-03', 2000), plan('c', '2026-11-20', 4000), plan('d', '2026-10-31', 8000)];
  const sin = construirResumenVentas(ordenes, { referenciaIso: REF });
  assert.deepEqual(sin.diaria.map((d) => [d.clave, d.ventas, d.monto]), [['2026-11-03', 2, 3000], ['2026-11-20', 1, 4000]]);
  const con = construirResumenVentas(ordenes, { referenciaIso: REF, desdeIso: '2026-10-30', hastaIso: '2026-11-03' });
  assert.deepEqual(con.diaria.map((d) => d.clave), ['2026-10-31', '2026-11-03']);
});

test('tabla semanal: semanas (por su lunes) del año de referencia con ventas; la semana que cruza de año va completa en la suya', () => {
  const ordenes = [plan('a', '2026-11-16', 1000), plan('b', '2026-11-22', 2000), plan('c', '2026-11-23', 4000), plan('d', '2026-01-01', 8000)];
  const r = construirResumenVentas(ordenes, { referenciaIso: REF });
  assert.deepEqual(r.semanal.map((s) => [s.clave, s.ventas, s.monto]), [['2025-12-29', 1, 8000], ['2026-11-16', 2, 3000], ['2026-11-23', 1, 4000]]);
});

test('tabla mensual: los 12 meses del año de referencia, con ceros donde no hubo ventas', () => {
  const r = construirResumenVentas([plan('a', '2026-11-16', 1000), plan('b', '2026-02-02', 5000), plan('c', '2025-12-31', 9000)], { referenciaIso: REF });
  assert.equal(r.mensual.length, 12);
  assert.deepEqual(r.mensual.map((m) => m.clave).slice(0, 2), ['2026-01', '2026-02']);
  assert.deepEqual(r.mensual.map((m) => m.ventas), [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0]);
  assert.equal(r.mensual[1].monto, 5000);
  assert.equal(r.mensual[1].etiqueta, 'Febrero 2026');
});

test('sin referencia válida el resumen usa hoy y no se cae', () => {
  const r = construirResumenVentas([plan('a', '2026-11-18', 1000)], { referenciaIso: 'mañana' });
  assert.equal(r.tarjetas.dia.ventas, 0);
  assert.equal(r.mensual.length, 12);
});

test('formatoPesos: separador de miles chileno', () => {
  assert.equal(formatoPesos(1234567), '$1.234.567');
  assert.equal(formatoPesos(0), '$0');
});
