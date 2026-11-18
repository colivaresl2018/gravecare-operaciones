// Servicio Spot: la fecha que eligió el cliente aparece como fecha de la visita (Órdenes, Planificación y Mis Trabajos),
// aunque la orden no tenga fechasPorVisita.V1. Un plan normal no cambia.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fechaGuardadaVisita, fechaSpotDelCliente, esServicioSpot } from '../public/js/fechas-visita.js';

test('Spot con fechaProgramada AAAA-MM-DD: la visita V1 queda con esa fecha (día local, sin desfase)', () => {
  const f = fechaGuardadaVisita({ tipoServicio: 'Spot', fechaProgramada: '2026-12-05' }, 'V1');
  assert.ok(f instanceof Date);
  assert.equal(f.getFullYear(), 2026);
  assert.equal(f.getMonth(), 11);
  assert.equal(f.getDate(), 5);
});

test('Spot con fechaServicio DD/MM/AAAA también funciona', () => {
  const f = fechaSpotDelCliente({ plan: 'Spot', fechaServicio: '17/12/2026' });
  assert.equal(f.getDate(), 17);
  assert.equal(f.getMonth(), 11);
});

test('si la orden ya tiene fechasPorVisita.V1, esa fecha manda', () => {
  const f = fechaGuardadaVisita({ tipoServicio: 'SPOT', fechaProgramada: '2026-12-05', fechasPorVisita: { V1: '2026-12-20' } }, 'V1');
  assert.equal(f.getDate(), 20);
});

test('un plan normal (no Spot) no toma fechaProgramada como fecha de visita', () => {
  assert.equal(fechaGuardadaVisita({ plan: 'Plan 12', fechaProgramada: '2026-12-05' }, 'V1'), null);
  assert.equal(esServicioSpot({ plan: 'Plan 12' }), false);
});

test('Spot sin fecha o con fecha inválida: sin fecha (no se inventa)', () => {
  assert.equal(fechaGuardadaVisita({ tipoServicio: 'Spot' }, 'V1'), null);
  assert.equal(fechaSpotDelCliente({ tipoServicio: 'Spot', fechaProgramada: '2026-02-31' }), null);
});

test('solo la visita V1 de un Spot toma la fecha del cliente', () => {
  assert.equal(fechaGuardadaVisita({ tipoServicio: 'Spot', fechaProgramada: '2026-12-05' }, 'V2'), null);
});
