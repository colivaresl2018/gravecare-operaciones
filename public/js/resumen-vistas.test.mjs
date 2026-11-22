// HTML del Resumen de Ventas: montos con formato chileno, avisos y todo dato escapado. Ejecutar: node --test public/js/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { construirResumenVentas } from './resumen-ventas.js';
import { htmlTarjetasResumen, htmlFilasResumen, textosAvisosResumen } from './resumen-vistas.js';

const o = (id, data) => ({ id, data: { pagoConfirmado: true, estado: 'Confirmado', ...data } });
const REF = '2026-11-18';
const resumen = (ordenes, extra = {}) => construirResumenVentas(ordenes, { referenciaIso: REF, ...extra });

test('tarjetas: Día, Semana, Mes y Año con ventas, planes, Spot, ramos adicionales, monto con puntos y ticket', () => {
  const r = resumen([
    o('a', { tipoPlan: 'Plan 4', fechaPago: '2026-11-18', montoTotal: 1200000, ramosAdicionales: 2 }),
    o('b', { tipoServicio: 'SPOT', fechaPago: '2026-11-18', montoTotal: 300000 }),
  ]);
  const h = htmlTarjetasResumen(r);
  for (const t of ['Día', 'Semana', 'Noviembre 2026', 'Año 2026', '$1.500.000', '$750.000', 'Planes', 'Spot', 'Ramos adicionales', 'Ticket promedio']) {
    assert.ok(h.includes(t), t);
  }
  assert.ok(!h.includes('Periodo')); // sin desde/hasta no hay tarjeta de periodo
});

test('tarjeta de Periodo: aparece con desde y hasta, con las fechas en DD/MM/AAAA', () => {
  const h = htmlTarjetasResumen(resumen([o('a', { tipoPlan: 'Plan 4', fechaPago: '2026-11-18', montoTotal: 1000 })], { desdeIso: '2026-11-01', hastaIso: '2026-11-30' }));
  assert.ok(h.includes('Periodo') && h.includes('01/11/2026') && h.includes('30/11/2026'));
});

test('filas de tabla: etiqueta, métricas y monto; mensaje cuando no hay ventas', () => {
  const r = resumen([o('a', { tipoPlan: 'Plan 4', fechaPago: '2026-11-03', montoTotal: 45000 })]);
  const h = htmlFilasResumen(r.diaria);
  assert.ok(h.includes('03/11/2026') && h.includes('$45.000'));
  assert.ok(htmlFilasResumen([]).includes('No hay ventas'));
  assert.ok(htmlFilasResumen(r.mensual).includes('Noviembre 2026'));
});

test('avisos: sin fecha, sin monto, fecha de creación y pruebas se cuentan en español claro; sin nada, lista vacía', () => {
  const r = resumen([
    o('a', { tipoPlan: 'Plan 4', fechaPago: '2026-11-18', montoTotal: 1000 }),
    o('sinf', { tipoPlan: 'Plan 4', montoTotal: 1000 }),
    o('sinm', { tipoPlan: 'Plan 4', fechaPago: '2026-11-18' }),
    o('cre', { tipoPlan: 'Plan 4', creadoEl: '2026-11-17', montoTotal: 1000 }),
    o('pru', { tipoPlan: 'Plan 4', fechaPago: '2026-11-18', montoTotal: 1000, modoPago: 'integracion' }),
  ]);
  const textos = textosAvisosResumen(r.avisos).join(' | ');
  assert.ok(/1 orden sin fecha de pago ni de creación/.test(textos), textos);
  assert.ok(/1 orden sin monto total/.test(textos), textos);
  assert.ok(/1 orden sin fecha de pago se cuenta en su fecha de creación/.test(textos), textos);
  assert.ok(/1 orden de prueba/.test(textos), textos);
  assert.deepEqual(textosAvisosResumen(resumen([]).avisos), []);
});

test('escape: una etiqueta con HTML no se ejecuta', () => {
  const malo = '<img src=x onerror=alert(1)>';
  const h = htmlFilasResumen([{ clave: 'x', etiqueta: malo, ventas: 1, planes: 1, spot: 0, ramosAdicionales: 0, monto: 1000, ticket: 1000 }]);
  assert.ok(!h.includes('<img') && h.includes('&lt;img'));
});
