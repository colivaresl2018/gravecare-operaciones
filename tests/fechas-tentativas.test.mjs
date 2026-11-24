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

// ---- Spec 062 · Parte B: primera visita guardada al pagar (ordenes/{id}.primeraVisitaTentativa) ----
const conPrimera = (plan, fecha, extra = {}) => ({ planNombre: plan, fechaContratacion: '2026-11-10', primeraVisitaTentativa: { version: 1, fecha, motivo: 'calculada', diaRuta: 3, calculadaEn: '2026-11-23T10:00:00.000Z' }, ...extra });
const serie = (orden, n) => Array.from({ length: n }, (_, i) => { const r = fechaVisitaConOrigen(orden, i + 1); return r && ymd(r.fecha); });

test('CA1: Plan 12 con V1 = 2026-11-25 → V2 = 25-12-2026, V3 = 25-01-2027 (todas tentativas)', () => {
  const o = conPrimera('Plan 12', '2026-11-25');
  assert.deepEqual(serie(o, 3), ['2026-11-25', '2026-12-25', '2027-01-25']);
  assert.equal(fechaVisitaConOrigen(o, 1).tentativa, true);
  assert.equal(fechaVisitaConOrigen(o, 1).fecha.getHours(), 12, 'mediodía local');
});

test('CA2: Plan 6 y Plan 4 con la misma V1 → V2 = 25-01-2027 y 25-02-2027', () => {
  assert.equal(serie(conPrimera('Plan 6', '2026-11-25'), 2)[1], '2027-01-25');
  assert.equal(serie(conPrimera('Plan 4', '2026-11-25'), 2)[1], '2027-02-25');
  assert.deepEqual(serie(conPrimera('Plan 4', '2026-11-25'), 4), ['2026-11-25', '2027-02-25', '2027-05-25', '2027-08-25']);
});

test('R2: las siguientes usan sumarMeses desde V1 (ajuste de fin de mes) y no pasan del total del plan', () => {
  const o = conPrimera('Plan 12', '2026-12-31');
  assert.equal(serie(o, 3)[1], '2027-01-31');
  assert.equal(serie(o, 3)[2], '2027-02-28');
  assert.equal(fechaVisitaConOrigen(o, 13), null);
});

test('CA3: fecha null → V1 y todas las siguientes sin fecha (aunque haya fecha de contratación)', () => {
  for (const plan of ['Plan 12', 'Plan 6', 'Plan 4']) {
    const o = conPrimera(plan, null);
    assert.deepEqual(serie(o, totalVisitasPlan(plan)), Array(totalVisitasPlan(plan)).fill(null));
  }
});

test('CA4: sin el campo, exactamente el cálculo de hoy', () => {
  const base = { planNombre: 'Plan 4', fechaContratacion: '2026-11-10' };
  assert.deepEqual(serie(base, 4), ['2027-02-10', '2027-05-10', '2027-08-10', '2027-11-10']);
});

test('CA5: la fecha real manda sobre la primera visita guardada; Spot sigue igual', () => {
  const o = conPrimera('Plan 12', '2026-11-25', { fechasPorVisita: { V1: '2027-03-01T10:00:00.000Z' } });
  const v1 = fechaVisitaConOrigen(o, 1);
  assert.equal(v1.tentativa, false);
  assert.equal(v1.fecha.toISOString(), '2027-03-01T10:00:00.000Z');
  assert.equal(ymd(fechaVisitaConOrigen(o, 2).fecha), '2026-12-25');
  const spot = conPrimera('Spot', '2026-11-25', { fechaCreacion: '2026-01-15' });
  assert.equal(fechaVisitaConOrigen(spot, 1), null, 'Spot no usa primeraVisitaTentativa');
});

test('CA9: forma inesperada → se trata como orden sin el campo y no se rompe', () => {
  const base = { planNombre: 'Plan 4', fechaContratacion: '2026-11-10' };
  const hoy = serie(base, 4);
  for (const raro of [{}, { version: 1 }, { fecha: 20261125 }, { fecha: '25/11/2026' }, { fecha: '2026-02-30' }, { fecha: {} }, 'texto', 7, [], undefined]) {
    assert.deepEqual(serie({ ...base, primeraVisitaTentativa: raro }, 4), hoy, JSON.stringify(raro));
  }
});

test('CA6: ordenes.html, planificacion.html y planificacion-servicios.js usan la misma función', async () => {
  const { readFileSync } = await import('node:fs');
  for (const f of ['public/ordenes.html', 'public/planificacion.html', 'public/js/planificacion-servicios.js']) {
    const s = readFileSync(f, 'utf8');
    assert.match(s, /fechaVisitaConOrigen/, f);
    assert.doesNotMatch(s, /primeraVisitaTentativa/, `${f} no debe leer el campo por su cuenta`);
  }
});
