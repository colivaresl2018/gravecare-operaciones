// Ayudas de calendario (semana lunes-domingo, meses). Ejecutar: node --test public/js/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  esFechaIso, sumarDias, lunesDeLaSemana, diaSemanaIso, esFinDeSemana, diasDeLaSemana, mesDeIso, sumarMeses, nombreMes, fechaDisplay, hoyIso,
} from './fechas-semana.js';

test('lunes de la semana: cualquier día cae en su lunes; el domingo pertenece a la semana que termina', () => {
  assert.equal(lunesDeLaSemana('2026-11-16'), '2026-11-16'); // lunes
  assert.equal(lunesDeLaSemana('2026-11-22'), '2026-11-16'); // domingo
  assert.equal(lunesDeLaSemana('2026-11-23'), '2026-11-23');
  assert.equal(lunesDeLaSemana('2027-01-01'), '2026-12-28'); // cruza de año
  assert.equal(lunesDeLaSemana('basura'), null);
});

test('sumar días cruza meses, años y febrero bisiesto', () => {
  assert.equal(sumarDias('2026-12-31', 1), '2027-01-01');
  assert.equal(sumarDias('2028-02-28', 1), '2028-02-29');
  assert.equal(sumarDias('2027-02-28', 1), '2027-03-01');
  assert.equal(sumarDias('2026-11-16', -7), '2026-11-09');
  assert.equal(sumarDias('2026-02-30', 1), null);
});

test('día de la semana y fin de semana', () => {
  assert.equal(diaSemanaIso('2026-11-16'), 1);
  assert.equal(diaSemanaIso('2026-11-22'), 7);
  assert.equal(esFinDeSemana('2026-11-21'), true);
  assert.equal(esFinDeSemana('2026-11-20'), false);
  assert.equal(esFinDeSemana('x'), false);
});

test('los 7 días de la semana traen nombre y fecha en DD/MM/AAAA', () => {
  const d = diasDeLaSemana('2026-12-28');
  assert.deepEqual(d.map((x) => x.nombre), ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']);
  assert.equal(d[4].iso, '2027-01-01');
  assert.equal(d[4].display, '01/01/2027');
  assert.deepEqual(diasDeLaSemana('no'), []);
});

test('meses: mesDeIso, sumarMeses, nombreMes', () => {
  assert.equal(mesDeIso('2026-11-19'), '2026-11');
  assert.equal(mesDeIso('2026-13-01'), null);
  assert.equal(sumarMeses('2026-12', 1), '2027-01');
  assert.equal(sumarMeses('2026-01', -1), '2025-12');
  assert.equal(sumarMeses('2026-13', 1), null);
  assert.equal(nombreMes('2026-11'), 'Noviembre 2026');
  assert.equal(nombreMes('2026-00'), '');
});

test('fechas válidas y display', () => {
  assert.equal(esFechaIso('2026-02-29'), false);
  assert.equal(esFechaIso('2028-02-29'), true);
  assert.equal(fechaDisplay('2026-11-05'), '05/11/2026');
  assert.equal(fechaDisplay(''), '');
  assert.equal(hoyIso(new Date(2026, 10, 5, 23, 30)), '2026-11-05');
});
