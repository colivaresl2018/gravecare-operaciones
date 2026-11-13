// Estado unificado por visita (programacionVisitas + estadosPorVisita) y etiquetas estandarizadas.
// Ejecutar: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoUnificadoVisita, etiquetaEstadoVisita, normalizarEstadoVisita } from '../public/js/estado-visita-unificado.js';

test('etiquetas estandarizadas de los cuatro estados', () => {
  assert.equal(etiquetaEstadoVisita('en revision'), 'Pendiente Revisión');
  assert.equal(etiquetaEstadoVisita('en_revision'), 'Pendiente Revisión');
  assert.equal(etiquetaEstadoVisita('rechazada'), 'Rechazada');
  assert.equal(etiquetaEstadoVisita('asignado'), 'Asignado');
  assert.equal(etiquetaEstadoVisita('asignada'), 'Asignado');
  assert.equal(etiquetaEstadoVisita('completada'), 'Completada');
  assert.equal(etiquetaEstadoVisita('finalizada'), 'Completada');
  assert.equal(etiquetaEstadoVisita('en_ejecucion'), null, 'los demás estados los decide cada página');
});

test('normalización de sinónimos', () => {
  assert.equal(normalizarEstadoVisita('Finalizada'), 'completada');
  assert.equal(normalizarEstadoVisita('rechazado'), 'rechazada');
  assert.equal(normalizarEstadoVisita('algo raro'), '');
  assert.equal(normalizarEstadoVisita(null), '');
});

test('toma el estado más avanzado entre programacionVisitas y estadosPorVisita', () => {
  // Informe enviado a revisión (programacionVisitas) mientras planificación la dejó «asignado»
  const enRevision = { programacionVisitas: { v_2: { estado: 'en revision' } }, estadosPorVisita: { V2: 'asignado' } };
  assert.equal(estadoUnificadoVisita(enRevision, 2), 'en revision');

  // Rechazada en revisión, con planificación en «asignado»: sigue siendo rechazada (la más avanzada)
  const rechazada = { programacionVisitas: { v_1: { estado: 'rechazada' } }, estadosPorVisita: { V1: 'asignado' } };
  assert.equal(estadoUnificadoVisita(rechazada, 1), 'rechazada');

  // Solo planificación
  assert.equal(estadoUnificadoVisita({ estadosPorVisita: { V3: 'en_ejecucion' } }, 3), 'en_ejecucion');
});

test('completada sin evidencia de terminada no se muestra como completada', () => {
  const orden = { estadosPorVisita: { V1: 'completada' }, programacionVisitas: { v_1: { estado: 'asignado' } } };
  assert.equal(estadoUnificadoVisita(orden, 1, { terminada: false }), 'asignado');
  assert.equal(estadoUnificadoVisita(orden, 1, { terminada: true }), 'completada');
});

test('sin datos devuelve null', () => {
  assert.equal(estadoUnificadoVisita({}, 1), null);
  assert.equal(estadoUnificadoVisita(undefined, 1), null);
});

test('acepta la clave antigua numérica de programacionVisitas', () => {
  assert.equal(estadoUnificadoVisita({ programacionVisitas: { 2: { estado: 'rechazada' } } }, 2), 'rechazada');
});
