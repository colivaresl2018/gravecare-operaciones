// Directriz B5 etapa 1: columnas Tipo de servicio, Ramos adicionales y Eje, y filtros Eje / Mes en las listas.
// Ejecutar: node --test public/js/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  nivelDeOrden, ramosAdicionalesDeOrden, construirFilasPlanificacion, filtrarPlanes, filtrarSpot,
} from './planificacion-servicios.js';
import { crearIndiceRutas } from './rutas-planificacion.js';

const ord = (id, data) => ({ id, data });
const RUTAS = crearIndiceRutas([
  { id: 'parque-canaan-de-pudahuel', data: { cementerio: 'Parque Canaán de Pudahuel', eje: 'Eje Santiago Poniente 1', diaSemana: 2 } },
  { id: 'cementerio-general-de-recoleta', data: { cementerio: 'Cementerio General de Recoleta', eje: 'Eje Santiago Norte 1', diaSemana: 1 } },
]);

test('nivel de la orden: servicio.nivel, nivel o nivelServicio; por defecto Standard (igual que el servidor)', () => {
  assert.equal(nivelDeOrden({ nivel: 'Premium' }), 'Premium');
  assert.equal(nivelDeOrden({ servicio: { nivel: 'DELUXE' } }), 'Deluxe');
  assert.equal(nivelDeOrden({ nivelServicio: 'premium' }), 'Premium');
  assert.equal(nivelDeOrden({}), 'Standard');
});

test('ramos adicionales: cantidadRamosAdicionales o ramosAdicionales, entre 0 y 10, y 0 en Deluxe', () => {
  assert.equal(ramosAdicionalesDeOrden({ ramosAdicionales: 2 }), 2);
  assert.equal(ramosAdicionalesDeOrden({ cantidadRamosAdicionales: '3' }), 3);
  assert.equal(ramosAdicionalesDeOrden({ ramosAdicionales: 99 }), 10);
  assert.equal(ramosAdicionalesDeOrden({ ramosAdicionales: -4 }), 0);
  assert.equal(ramosAdicionalesDeOrden({ ramosAdicionales: 'x' }), 0);
  assert.equal(ramosAdicionalesDeOrden({ nivel: 'Deluxe', ramosAdicionales: 3 }), 0);
  assert.equal(ramosAdicionalesDeOrden({}), 0);
});

test('cada fila trae tipo de servicio (nivel), ramos adicionales y eje con su día de ruta', () => {
  const r = construirFilasPlanificacion([
    ord('a', { numeroOrden: 'N-1', tipoPlan: 'Plan 4', nivel: 'Premium', ramosAdicionales: 2, fechasPorVisita: { V1: '2026-11-17' }, ubicacionSepultura: { cementerio: 'Parque Canaán de Pudahuel' } }),
    ord('b', { numeroOrden: 'N-2', tipoServicio: 'SPOT', fechaProgramada: '2026-11-18', ubicacionSepultura: { cementerio: 'Cementerio General de Recoleta' } }),
  ], { rutas: RUTAS });
  const plan = r.planes[0];
  assert.deepEqual([plan.nivel, plan.ramosAdicionales, plan.eje, plan.diaRuta], ['Premium', 2, 'Eje Santiago Poniente 1', 2]);
  const spot = r.spot[0];
  assert.deepEqual([spot.nivel, spot.ramosAdicionales, spot.eje, spot.diaRuta], ['Standard', 0, 'Eje Santiago Norte 1', 1]);
});

test('un cementerio que no está en rutas es «Sin eje» y sin día de ruta; sin colección de rutas, todo «Sin eje»', () => {
  const orden = ord('a', { tipoPlan: 'Plan 4', ubicacionSepultura: { cementerio: 'Cementerio Desconocido' } });
  const conRutas = construirFilasPlanificacion([orden], { rutas: RUTAS }).planes[0];
  assert.deepEqual([conRutas.eje, conRutas.diaRuta], ['Sin eje', null]);
  const sinRutas = construirFilasPlanificacion([orden]).planes[0];
  assert.deepEqual([sinRutas.eje, sinRutas.diaRuta], ['Sin eje', null]);
});

const FILAS = construirFilasPlanificacion([
  ord('a', { numeroOrden: 'N-1', tipoPlan: 'Plan 4', fechasPorVisita: { V1: '2026-11-17', V2: '2026-12-17' }, ubicacionSepultura: { cementerio: 'Parque Canaán de Pudahuel' } }),
  ord('b', { numeroOrden: 'N-2', tipoPlan: 'Plan 4', fechasPorVisita: { V1: '2026-11-16' }, ubicacionSepultura: { cementerio: 'Cementerio General de Recoleta' }, operadoresPorVisita: { V1: 'Luis' } }),
  ord('c', { numeroOrden: 'N-3', tipoPlan: 'Plan 4', fechasPorVisita: { V1: '2026-11-20' }, ubicacionSepultura: { cementerio: 'Otro' } }),
  ord('s1', { numeroOrden: 'S-1', tipoServicio: 'SPOT', fechaProgramada: '2026-11-18', ubicacionSepultura: { cementerio: 'Otro' } }),
  ord('s2', { numeroOrden: 'S-2', tipoServicio: 'SPOT', fechaProgramada: '2026-12-02', ubicacionSepultura: { cementerio: 'Otro' } }),
  ord('s3', { numeroOrden: 'S-3', tipoServicio: 'SPOT', ubicacionSepultura: { cementerio: 'Otro' } }),
], { rutas: RUTAS });

test('filtro Eje en Planes: un eje, o «Sin eje»', () => {
  assert.deepEqual([...new Set(filtrarPlanes(FILAS.planes, { eje: 'Eje Santiago Poniente 1' }).map((f) => f.docId))], ['a']);
  assert.deepEqual([...new Set(filtrarPlanes(FILAS.planes, { eje: 'Eje Santiago Norte 1' }).map((f) => f.docId))], ['b']);
  assert.deepEqual([...new Set(filtrarPlanes(FILAS.planes, { eje: 'Sin eje' }).map((f) => f.docId))], ['c']);
});

test('filtro Mes: solo las visitas de ese mes; sin mes, todas (también las sin fecha)', () => {
  const nov = filtrarPlanes(FILAS.planes, { mes: '2026-11' });
  assert.ok(nov.length > 0 && nov.every((f) => f.fechaIso && f.fechaIso.startsWith('2026-11-')));
  assert.ok(!nov.some((f) => f.fechaIso === '2026-12-17'));
  assert.equal(filtrarPlanes(FILAS.planes, { mes: '' }).length, FILAS.planes.length);
  assert.deepEqual(filtrarSpot(FILAS.spot, { mes: '2026-12' }).map((f) => f.docId), ['s2']);
  assert.deepEqual(filtrarSpot(FILAS.spot, { mes: '2026-11' }).map((f) => f.docId), ['s1']); // la sin fecha no cae en ningún mes
  assert.equal(filtrarSpot(FILAS.spot, {}).length, 3);
});

test('los filtros se combinan (eje + mes + operador)', () => {
  assert.deepEqual(filtrarPlanes(FILAS.planes, { eje: 'Eje Santiago Norte 1', mes: '2026-11', operador: 'Luis' }).map((f) => f.docId), ['b']);
  assert.equal(filtrarPlanes(FILAS.planes, { eje: 'Eje Santiago Norte 1', mes: '2026-12' }).length, 0);
});
