// Spec 041 · persistencia aditiva de estados por visita. Ejecutar: node --test public/js/estados-visita-db.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guardarEstadoVisita } from './estados-visita-db.js';

const AHORA = Date.parse('2026-11-10T12:00:00Z');
const ref = (id) => ({ id });

function fake() {
  const llamadas = [];
  return { llamadas, actualizar: async (r, datos) => { llamadas.push({ r, datos }); } };
}

test('041-db · escribe solo estadosPorVisita.<clave> y ultimaModificacion', async () => {
  const f = fake();
  const r = await guardarEstadoVisita({ actualizar: f.actualizar, referencia: ref, ordenDocId: 'ORD-1', claveVisita: 'V2', estadoAnterior: 'asignado', estadoNuevo: 'en_ejecucion', uidOperador: 'op-1', ahora: AHORA });
  assert.equal(f.llamadas.length, 1);
  assert.deepEqual(f.llamadas[0].r, { id: 'ORD-1' });
  assert.deepEqual(Object.keys(f.llamadas[0].datos).sort(), ['estadosPorVisita.V2', 'ultimaModificacion']);
  assert.equal(f.llamadas[0].datos['estadosPorVisita.V2'], 'en_ejecucion');
  assert.deepEqual(f.llamadas[0].datos.ultimaModificacion, r);
});

test('041-db · no escribe operadoresPorVisita ni otros campos', async () => {
  const f = fake();
  await guardarEstadoVisita({ actualizar: f.actualizar, referencia: ref, ordenDocId: 'ORD-1', claveVisita: 'V1', estadoAnterior: 'pendiente', estadoNuevo: 'asignado', uidOperador: 'op-1', ahora: AHORA });
  for (const k of Object.keys(f.llamadas[0].datos)) {
    assert.equal(k.startsWith('operadoresPorVisita'), false, k);
    assert.equal(['estadosPorVisita', 'ultimaModificacion'].some((p) => k === p || k.startsWith(p + '.')), true, k);
  }
});

test('041-db · transición inválida: lanza y no escribe nada', async () => {
  const f = fake();
  await assert.rejects(guardarEstadoVisita({ actualizar: f.actualizar, referencia: ref, ordenDocId: 'ORD-1', claveVisita: 'V1', estadoAnterior: 'pendiente', estadoNuevo: 'completada', uidOperador: 'op-1', ahora: AHORA }), /no permitida/);
  assert.equal(f.llamadas.length, 0);
});

test('041-db · sin operador: lanza y no escribe nada', async () => {
  const f = fake();
  await assert.rejects(guardarEstadoVisita({ actualizar: f.actualizar, referencia: ref, ordenDocId: 'ORD-1', claveVisita: 'V1', estadoAnterior: 'pendiente', estadoNuevo: 'asignado', uidOperador: '', ahora: AHORA }), /operador/);
  assert.equal(f.llamadas.length, 0);
});

test('041-db · clave de visita fuera de formato no escribe (evita rutas arbitrarias)', async () => {
  for (const c of ['', 'V', 'X1', 'V1.x', 'V1;DROP', 'operadoresPorVisita', undefined]) {
    const f = fake();
    await assert.rejects(guardarEstadoVisita({ actualizar: f.actualizar, referencia: ref, ordenDocId: 'ORD-1', claveVisita: c, estadoAnterior: 'pendiente', estadoNuevo: 'asignado', uidOperador: 'op-1', ahora: AHORA }), /Clave/, String(c));
    assert.equal(f.llamadas.length, 0, String(c));
  }
});

test('041-db · sin orden: lanza y no escribe nada', async () => {
  const f = fake();
  await assert.rejects(guardarEstadoVisita({ actualizar: f.actualizar, referencia: ref, ordenDocId: '', claveVisita: 'V1', estadoAnterior: 'pendiente', estadoNuevo: 'asignado', uidOperador: 'op-1', ahora: AHORA }), /orden/);
  assert.equal(f.llamadas.length, 0);
});
