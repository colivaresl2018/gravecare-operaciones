// Spec 041 · fechas por visita: escritura aislada y lectura preferencial. Ejecutar: node --test public/js/fechas-visita.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fechaGuardadaVisita, construirActualizacionFecha, verificarPayloadSinArreglo, guardarFechaVisitaEnOrden,
} from './fechas-visita.js';

const F = new Date('2027-03-10T10:00:00Z');

test('041-fechas · escritura: solo la clave de la visita y los punteros de orden', () => {
  const p = construirActualizacionFecha({ clave: 'V2', fecha: F });
  assert.deepEqual(Object.keys(p).sort(), ['fechaProgramada', 'fechasPorVisita.V2', 'proximaVisita']);
  assert.equal(p['fechasPorVisita.V2'], F.toISOString());
  assert.equal(p.fechaProgramada, F.toISOString());
  assert.equal(p.proximaVisita, F.toISOString());
});

test('041-fechas · nunca incluye el arreglo fechasProgramadas', () => {
  const p = construirActualizacionFecha({ clave: 'V1', fecha: F });
  assert.equal(Object.keys(p).some((k) => k === 'fechasProgramadas' || k.startsWith('fechasProgramadas.')), false);
});

test('041-fechas · bloquea el arreglo completo si alguien lo intenta escribir', () => {
  assert.throws(() => verificarPayloadSinArreglo({ fechasProgramadas: [] }), /bloqueó/);
  assert.throws(() => verificarPayloadSinArreglo({ 'fechasProgramadas.0': F }), /bloqueó/);
  assert.doesNotThrow(() => verificarPayloadSinArreglo({ 'fechasPorVisita.V1': 'x' }));
});

test('041-fechas · claves de visita inválidas no escriben nada', () => {
  for (const c of ['', 'V', 'X1', 'V1.x', 'fechasProgramadas', undefined]) {
    assert.throws(() => construirActualizacionFecha({ clave: c, fecha: F }), /Clave/, String(c));
  }
});

test('041-fechas · fechas inválidas no escriben nada', () => {
  assert.throws(() => construirActualizacionFecha({ clave: 'V1', fecha: new Date('no es fecha') }), /Fecha/);
  assert.throws(() => construirActualizacionFecha({ clave: 'V1', fecha: '2027-03-10' }), /Fecha/);
});

test('041-fechas · guardar: una sola llamada, con la clave de la visita afectada', async () => {
  const llamadas = [];
  const actualizar = async (r, datos) => { llamadas.push({ r, datos }); };
  await guardarFechaVisitaEnOrden({ actualizar, referencia: (id) => ({ id }), ordenDocId: 'ORD-1', claveVisita: 'V3', fecha: F });
  assert.equal(llamadas.length, 1);
  assert.deepEqual(llamadas[0].r, { id: 'ORD-1' });
  assert.equal(Object.keys(llamadas[0].datos).some((k) => k.includes('fechasProgramadas')), false);
  assert.ok('fechasPorVisita.V3' in llamadas[0].datos);
});

test('041-fechas · guardar: una orden vacía o un extra con el arreglo completo se rechaza sin escribir', async () => {
  const llamadas = [];
  const actualizar = async () => { llamadas.push(1); };
  await assert.rejects(guardarFechaVisitaEnOrden({ actualizar, referencia: (id) => id, ordenDocId: '', claveVisita: 'V1', fecha: F }), /orden/);
  await assert.rejects(guardarFechaVisitaEnOrden({ actualizar, referencia: (id) => id, ordenDocId: 'ORD-1', claveVisita: 'V1', fecha: F, extra: { fechasProgramadas: [] } }), /bloqueó/);
  assert.equal(llamadas.length, 0);
});

test('041-fechas · lectura: prefiere fechasPorVisita sobre cualquier respaldo', () => {
  const ord = { fechasPorVisita: { V2: '2027-03-10T10:00:00.000Z' } };
  assert.equal(fechaGuardadaVisita(ord, 'V2').toISOString(), '2027-03-10T10:00:00.000Z');
});

test('041-fechas · lectura: sin fechasPorVisita devuelve null (la página usa su respaldo)', () => {
  assert.equal(fechaGuardadaVisita({}, 'V2'), null);
  assert.equal(fechaGuardadaVisita({ fechasPorVisita: {} }, 'V2'), null);
  assert.equal(fechaGuardadaVisita(null, 'V2'), null);
});

test('041-fechas · lectura: acepta Timestamp (toDate), Date, texto y número; descarta valores inválidos', () => {
  assert.equal(fechaGuardadaVisita({ fechasPorVisita: { V1: { toDate: () => F } } }, 'V1').getTime(), F.getTime());
  assert.equal(fechaGuardadaVisita({ fechasPorVisita: { V1: F } }, 'V1').getTime(), F.getTime());
  assert.equal(fechaGuardadaVisita({ fechasPorVisita: { V1: F.getTime() } }, 'V1').getTime(), F.getTime());
  assert.equal(fechaGuardadaVisita({ fechasPorVisita: { V1: 'basura' } }, 'V1'), null);
  assert.equal(fechaGuardadaVisita({ fechasPorVisita: { V1: null } }, 'V1'), null);
});

test('041-fechas · lectura: una clave fuera de formato nunca se consulta', () => {
  assert.equal(fechaGuardadaVisita({ fechasPorVisita: { 'V1.x': F } }, 'V1.x'), null);
  assert.equal(fechaGuardadaVisita({ fechasPorVisita: { V1: F } }, undefined), null);
});
