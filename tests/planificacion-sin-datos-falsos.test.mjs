// Planificación & Carta Gantt: no mostrar datos inventados y ofrecer reintento si falla la carga.
// Ejecutar: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../public/planificacion.html', import.meta.url), 'utf8');

test('no aparecen datos de relleno («Tulio Santana», cementerio fijo, fechas 2027 inventadas)', () => {
  assert.equal(html.includes('Tulio Santana'), false);
  assert.equal(html.includes('Parque del Recuerdo Padre Hurtado'), false);
  assert.equal(html.includes('new Date(2027, 0, 16'), false);
  assert.equal(html.includes('new Date(2027, 3, 16'), false);
  assert.equal(html.includes('new Date(2027, 6, 16'), false);
});

test('una visita sin fecha se marca como «Sin fecha programada» y no se usa la primera fecha para las demás', () => {
  assert.ok(html.includes('Sin fecha programada'));
  assert.equal(html.includes('fechasProyectadas[0];'), false);
});

test('si la carga falla hay aviso con botón «Reintentar»', () => {
  assert.ok(html.includes('function mostrarErrorCarga()'));
  assert.ok(html.includes('mostrarErrorCarga();'));
  assert.ok(html.includes('btn-reintentar-carga'));
});
