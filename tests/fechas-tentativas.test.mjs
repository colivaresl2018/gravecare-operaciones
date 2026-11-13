// Fechas tentativas según el plan (public/js/fechas-tentativas.js). Ejecutar: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fechaTentativaVisita, fechaVisitaConOrigen, fechaInicioOrden, sumarMeses, totalVisitasPlan, intervaloMesesPlan } from '../public/js/fechas-tentativas.js';

const ymd = (d) => d && `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

test('planes: visitas y cadencia', () => {
  assert.equal(totalVisitasPlan('Plan 12'), 12);
  assert.equal(intervaloMesesPlan('Plan 12'), 1);
  assert.equal(totalVisitasPlan('Plan 6'), 6);
  assert.equal(intervaloMesesPlan('Plan 6'), 2);
  assert.equal(totalVisitasPlan('Plan 4'), 4);
  assert.equal(intervaloMesesPlan('Plan 4'), 3);
  assert.equal(totalVisitasPlan('Spot'), 1);
  assert.equal(intervaloMesesPlan('Spot'), null);
});

test('plan 4: visita n = inicio + n × 3 meses (mismo criterio que Órdenes y Planificación)', () => {
  const orden = { planNombre: 'Plan 4', fechaContratacion: '2026-11-10' };
  assert.deepEqual([1, 2, 3, 4].map((n) => ymd(fechaTentativaVisita(orden, n))), ['2027-02-10', '2027-05-10', '2027-08-10', '2027-11-10']);
});

test('plan 12: una visita cada mes; la última cae 12 meses después', () => {
  const orden = { planNombre: 'Plan 12', fechaCreacion: '2026-01-15' };
  assert.equal(ymd(fechaTentativaVisita(orden, 1)), '2026-02-15');
  assert.equal(ymd(fechaTentativaVisita(orden, 12)), '2027-01-15');
  assert.equal(fechaTentativaVisita(orden, 13), null, 'fuera del plan');
});

test('sin fecha de inicio no hay tentativa (no se usa fecha por defecto)', () => {
  assert.equal(fechaTentativaVisita({ planNombre: 'Plan 4' }, 1), null);
  assert.equal(fechaInicioOrden({}), null);
});

test('Spot no tiene tentativa: su fecha la elige el cliente', () => {
  assert.equal(fechaTentativaVisita({ planNombre: 'Spot', fechaCreacion: '2026-01-15' }, 1), null);
});

test('la fecha de inicio sale del primer campo válido (Firestore Timestamp o texto)', () => {
  const ts = { toDate: () => new Date(2026, 4, 3, 9, 0) };
  assert.equal(ymd(fechaInicioOrden({ fechaCreacion: ts })), '2026-05-03');
  assert.equal(ymd(fechaInicioOrden({ fechaPago: '2026-07-09' })), '2026-07-09');
});

test('sumar meses no desborda (31 de enero + 1 mes = 28 de febrero)', () => {
  assert.equal(ymd(sumarMeses(new Date(2026, 0, 31), 1)), '2026-02-28');
});

test('una fecha real guardada gana sobre la tentativa', () => {
  const orden = { planNombre: 'Plan 4', fechaContratacion: '2026-11-10', fechasPorVisita: { V1: '2027-03-01T10:00:00.000Z' } };
  const v1 = fechaVisitaConOrigen(orden, 1);
  assert.equal(v1.tentativa, false);
  assert.equal(v1.fecha.toISOString(), '2027-03-01T10:00:00.000Z');
  const v2 = fechaVisitaConOrigen(orden, 2);
  assert.equal(v2.tentativa, true);
  assert.equal(ymd(v2.fecha), '2027-05-10');
});

test('los arreglos antiguos fechasProgramadas no se usan como fecha real', () => {
  const orden = { planNombre: 'Plan 4', fechasProgramadas: ['2027-01-16', '2027-04-16'] };
  assert.equal(fechaVisitaConOrigen(orden, 1), null, 'sin inicio ni fecha real: no hay nada que mostrar');
});
