// informe-rechazado.js — «¿la visita tiene un informe rechazado que el operador debe corregir?».
// Ejecutar: node --test public/js/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rechazoDeVisita } from './informe-rechazado.js';
import { crearIndiceInformes } from './servicio-terminado.js';

const orden = (extra = {}) => ({ numeroOrden: 'ORD-1', operadoresPorVisita: { V1: 'Ana Pérez' }, ...extra });
const indice = (...pares) => crearIndiceInformes(pares);

test('informe en estado rechazado: la visita se devuelve con su motivo', () => {
  const idx = indice(['ORD-1-V1', { ordenId: 'ORD-1', visitaNumero: 1, estado: 'rechazado', motivoRechazo: 'Fotos borrosas' }]);
  const r = rechazoDeVisita(orden(), 1, { docId: 'ORD-1', indiceInformes: idx });
  assert.deepEqual(r, { rechazada: true, motivo: 'Fotos borrosas' });
});

test('acepta rechazado/rechazada con mayúsculas y espacios', () => {
  for (const e of ['Rechazado', ' rechazada ', 'RECHAZADO']) {
    const idx = indice(['ORD-1-V1', { ordenId: 'ORD-1', visitaNumero: 1, estado: e }]);
    assert.equal(rechazoDeVisita(orden(), 1, { docId: 'ORD-1', indiceInformes: idx }).rechazada, true, e);
  }
});

test('el informe corregido y reenviado (pendiente_revision) ya no figura como rechazado, aunque conserve el motivo viejo', () => {
  const idx = indice(['ORD-1-V1', { ordenId: 'ORD-1', visitaNumero: 1, estado: 'pendiente_revision', motivoRechazo: 'Fotos borrosas' }]);
  const o = orden({ programacionVisitas: { v_1: { estado: 'en revision', motivoRechazo: 'Fotos borrosas' } } });
  assert.equal(rechazoDeVisita(o, 1, { docId: 'ORD-1', indiceInformes: idx }).rechazada, false);
});

test('un informe aprobado no es rechazo', () => {
  const idx = indice(['ORD-1-V1', { ordenId: 'ORD-1', visitaNumero: 1, estado: 'aprobado' }]);
  assert.equal(rechazoDeVisita(orden(), 1, { docId: 'ORD-1', indiceInformes: idx }).rechazada, false);
});

test('sin informe legible, manda el estado de la visita en la orden (programacionVisitas)', () => {
  const o = orden({ programacionVisitas: { v_1: { estado: 'rechazada', motivoRechazo: 'Falta la foto panorámica' } } });
  assert.deepEqual(rechazoDeVisita(o, 1, {}), { rechazada: true, motivo: 'Falta la foto panorámica' });
});

test('si el informe no trae el motivo, se usa el de la visita', () => {
  const idx = indice(['ORD-1-V1', { ordenId: 'ORD-1', visitaNumero: 1, estado: 'rechazado' }]);
  const o = orden({ programacionVisitas: { v_1: { estado: 'rechazada', motivoRechazo: 'Mal encuadre' } } });
  assert.equal(rechazoDeVisita(o, 1, { docId: 'ORD-1', indiceInformes: idx }).motivo, 'Mal encuadre');
});

test('el rechazo de una visita no afecta a las otras', () => {
  const idx = indice(['ORD-1-V1', { ordenId: 'ORD-1', visitaNumero: 1, estado: 'rechazado' }]);
  const o = orden({ programacionVisitas: { v_1: { estado: 'rechazada' } } });
  assert.equal(rechazoDeVisita(o, 2, { docId: 'ORD-1', indiceInformes: idx }).rechazada, false);
});

test('nada que rechazar: visita sin informe ni estado', () => {
  assert.deepEqual(rechazoDeVisita(orden(), 1, {}), { rechazada: false, motivo: '' });
  assert.deepEqual(rechazoDeVisita(null, 1), { rechazada: false, motivo: '' });
});

test('el informe se encuentra también por numeroOrden y por el id antiguo sin sufijo (solo visita 1)', () => {
  const idx = indice(['ORD-1', { estado: 'rechazado', motivoRechazo: 'x' }]);
  assert.equal(rechazoDeVisita(orden(), 1, { docId: 'ORD-1', indiceInformes: idx }).rechazada, true);
  assert.equal(rechazoDeVisita(orden(), 2, { docId: 'ORD-1', indiceInformes: idx }).rechazada, false);
});

// ---- datosParaCorregir: lo que ya cargó el operador, para que corrija sin rehacer el informe ----
import { datosParaCorregir } from './informe-rechazado.js';

test('datosParaCorregir: devuelve las 4 fotos, las labores y las observaciones del informe rechazado', () => {
  const r = datosParaCorregir({
    fotos: { inicial: 'data:A', finalizado: 'data:B', ornamentacion: 'data:C', panoramica: 'data:D' },
    laboresEjecutadas: ['Riego y perfilado de terreno'], observaciones: ' Todo bien ',
  });
  assert.deepEqual(r.fotos, { 1: 'data:A', 2: 'data:B', 3: 'data:C', 4: 'data:D' });
  assert.deepEqual(r.labores, ['Riego y perfilado de terreno']);
  assert.equal(r.observaciones, 'Todo bien');
});

test('datosParaCorregir: usa antes/despues si faltan inicial/finalizado, y deja vacío lo que no hay', () => {
  const r = datosParaCorregir({ fotos: { antes: 'data:A', despues: 'data:B' } });
  assert.deepEqual(r.fotos, { 1: 'data:A', 2: 'data:B', 3: null, 4: null });
  assert.deepEqual(r.labores, []);
  assert.equal(r.observaciones, '');
});

test('datosParaCorregir: ignora valores que no son texto y un informe ausente', () => {
  assert.deepEqual(datosParaCorregir(null), { fotos: { 1: null, 2: null, 3: null, 4: null }, labores: [], observaciones: '' });
  const r = datosParaCorregir({ fotos: { inicial: 5, finalizado: '', ornamentacion: {}, panoramica: 'data:D' }, laboresEjecutadas: 'x' });
  assert.deepEqual(r.fotos, { 1: null, 2: null, 3: null, 4: 'data:D' });
  assert.deepEqual(r.labores, []);
});
