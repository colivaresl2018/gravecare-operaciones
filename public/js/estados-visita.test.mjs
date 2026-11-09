// Spec 041 · lógica de estados, auditoría y clasificación de visitas. Ejecutar: node --test public/js/estados-visita.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ESTADOS, TOLERANCIA_ATRASO_DIAS, VENTANA_PROXIMA_DIAS,
  transicionValida, construirUltimaModificacion, clasificarVisita, cumpleFiltro,
} from './estados-visita.js';

const DIA = 24 * 60 * 60 * 1000;
const AHORA = Date.parse('2026-11-10T12:00:00Z');
const hace = (d) => new Date(AHORA - d * DIA).toISOString();
const dentro = (d) => new Date(AHORA + d * DIA).toISOString();

test('041 · los cinco estados están definidos', () => {
  assert.deepEqual([...ESTADOS], ['pendiente', 'asignado', 'en_ejecucion', 'completada', 'reprogramada']);
});

test('041 · transiciones válidas del flujo normal', () => {
  assert.equal(transicionValida('pendiente', 'asignado'), true);
  assert.equal(transicionValida('asignado', 'en_ejecucion'), true);
  assert.equal(transicionValida('en_ejecucion', 'completada'), true);
});

test('041 · reprogramada puede venir de cualquier estado abierto y vuelve a pendiente o asignado', () => {
  for (const d of ['pendiente', 'asignado', 'en_ejecucion']) assert.equal(transicionValida(d, 'reprogramada'), true, d);
  assert.equal(transicionValida('reprogramada', 'pendiente'), true);
  assert.equal(transicionValida('reprogramada', 'asignado'), true);
});

test('041 · completada es final: no sale a ningún estado', () => {
  for (const h of ESTADOS) assert.equal(transicionValida('completada', h), false, h);
});

test('041 · transiciones inválidas se rechazan (saltos y repeticiones)', () => {
  assert.equal(transicionValida('pendiente', 'completada'), false);
  assert.equal(transicionValida('pendiente', 'en_ejecucion'), false);
  assert.equal(transicionValida('asignado', 'asignado'), false);
  assert.equal(transicionValida('pendiente', 'estado_inventado'), false);
});

test('041 · auditoría: registra operador, fecha ISO y estados', () => {
  const r = construirUltimaModificacion({ uidOperador: 'op-1', estadoAnterior: 'asignado', estadoNuevo: 'en_ejecucion', ahora: AHORA });
  assert.deepEqual(r, { uidOperador: 'op-1', timestamp: '2026-11-10T12:00:00.000Z', estadoAnterior: 'asignado', estadoNuevo: 'en_ejecucion' });
});

test('041 · auditoría: sin operador o con transición inválida no se genera nada', () => {
  assert.throws(() => construirUltimaModificacion({ uidOperador: '', estadoAnterior: 'pendiente', estadoNuevo: 'asignado' }), /operador/);
  assert.throws(() => construirUltimaModificacion({ uidOperador: 'op-1', estadoAnterior: 'pendiente', estadoNuevo: 'completada' }), /no permitida/);
});

test('041 · atrasada: visita programada hace más de 3 días y sin iniciar', () => {
  const e = clasificarVisita({ estado: 'asignado', fechaProgramada: hace(TOLERANCIA_ATRASO_DIAS + 1), operador: 'Ana', ahora: AHORA });
  assert.equal(e.has('atrasada'), true);
});

test('041 · no es atrasada a los 3 días exactos ni si ya está en ejecución o completada', () => {
  assert.equal(clasificarVisita({ estado: 'asignado', fechaProgramada: hace(3), operador: 'Ana', ahora: AHORA }).has('atrasada'), false);
  assert.equal(clasificarVisita({ estado: 'en_ejecucion', fechaProgramada: hace(10), operador: 'Ana', ahora: AHORA }).has('atrasada'), false);
  assert.equal(clasificarVisita({ estado: 'completada', fechaProgramada: hace(10), operador: 'Ana', ahora: AHORA }).has('atrasada'), false);
});

test('041 · sin operador: se marca aunque la fecha sea futura', () => {
  assert.equal(clasificarVisita({ estado: 'pendiente', fechaProgramada: dentro(20), operador: 'Sin asignar', ahora: AHORA }).has('sinOperador'), true);
  assert.equal(clasificarVisita({ estado: 'pendiente', fechaProgramada: dentro(20), operador: undefined, ahora: AHORA }).has('sinOperador'), true);
});

test('041 · próxima a vencer: dentro de la ventana y no completada', () => {
  assert.equal(clasificarVisita({ estado: 'asignado', fechaProgramada: dentro(VENTANA_PROXIMA_DIAS - 1), operador: 'Ana', ahora: AHORA }).has('proximaVencer'), true);
  assert.equal(clasificarVisita({ estado: 'completada', fechaProgramada: dentro(2), operador: 'Ana', ahora: AHORA }).has('proximaVencer'), false);
  assert.equal(clasificarVisita({ estado: 'asignado', fechaProgramada: dentro(VENTANA_PROXIMA_DIAS + 5), operador: 'Ana', ahora: AHORA }).has('proximaVencer'), false);
});

test('041 · histórico sin fecha se aparta y no se marca atrasada ni próxima', () => {
  for (const f of [null, undefined, '', 'no es fecha']) {
    const e = clasificarVisita({ estado: 'pendiente', fechaProgramada: f, operador: 'Sin asignar', ahora: AHORA });
    assert.equal(e.has('sinFecha'), true, String(f));
    assert.equal(e.has('atrasada'), false);
    assert.equal(e.has('proximaVencer'), false);
  }
});

test('041 · acepta fechas como Date, ISO o milisegundos', () => {
  assert.equal(clasificarVisita({ estado: 'asignado', fechaProgramada: new Date(AHORA - 5 * DIA), operador: 'Ana', ahora: AHORA }).has('atrasada'), true);
  assert.equal(clasificarVisita({ estado: 'asignado', fechaProgramada: AHORA - 5 * DIA, operador: 'Ana', ahora: AHORA }).has('atrasada'), true);
});

test('041 · filtros: sin filtro deja pasar todo; con filtro, solo las que lo tienen', () => {
  const e = new Set(['atrasada']);
  assert.equal(cumpleFiltro(e, ''), true);
  assert.equal(cumpleFiltro(e, 'atrasada'), true);
  assert.equal(cumpleFiltro(e, 'sinOperador'), false);
});
