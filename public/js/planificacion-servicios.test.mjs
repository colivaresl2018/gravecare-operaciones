// «Planificación Planes y Spot»: lógica pura con los módulos REALES de fechas, terminadas y estados (sin simulaciones).
// Ejecutar: node --test public/js/planificacion-servicios.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  esSpot, nombrePlanDeOrden, normalizarFechaSinDesfase, estadoDeVisita, ordenarFilasPorFecha,
  construirFilasPlanificacion, filtrarPlanes, filtrarSpot,
  SIN_PLAN, SIN_FECHA_PLAN, SIN_FECHA_SPOT,
} from './planificacion-servicios.js';

const ord = (id, data) => ({ id, data });

test('esSpot: tipoServicio manda; si falta, el nombre del plan; sin datos es Planes', () => {
  assert.equal(esSpot({ tipoServicio: 'SPOT' }), true);
  assert.equal(esSpot({ tipoServicio: 'spot' }), true);
  assert.equal(esSpot({ planNombre: 'Servicio Spot' }), true);
  assert.equal(esSpot({ servicio: { planNombre: 'Spot' } }), true);
  assert.equal(esSpot({ tipoServicio: 'PLAN', servicio: { planNombre: 'Plan 12' } }), false);
  assert.equal(esSpot({ servicio: { planNombre: 'Plan 12' } }), false);
  assert.equal(esSpot({}), false);
});

test('el nombre del plan sale de los mismos campos que las demás pantallas (incluido tipoPlan) y no inventa uno', () => {
  assert.equal(nombrePlanDeOrden({ servicio: { planNombre: 'Plan 6' } }), 'Plan 6');
  assert.equal(nombrePlanDeOrden({ planNombre: 'Plan 12' }), 'Plan 12');
  assert.equal(nombrePlanDeOrden({ tipoPlan: 'Plan 4' }), 'Plan 4');
  assert.equal(nombrePlanDeOrden({ plan: 'Plan 6' }), 'Plan 6');
  assert.equal(nombrePlanDeOrden({}), '');
});

test('normalizarFechaSinDesfase acepta Date, Timestamp, AAAA-MM-DD, DD/MM/AAAA e ISO con hora; rechaza lo inválido', () => {
  const esperado = { iso: '2026-12-05', display: '05/12/2026' };
  assert.deepEqual(normalizarFechaSinDesfase(new Date(2026, 11, 5, 12)), esperado);
  assert.deepEqual(normalizarFechaSinDesfase(new Date(2026, 11, 5, 23, 30)), esperado);
  assert.deepEqual(normalizarFechaSinDesfase({ toDate: () => new Date(2026, 11, 5, 10) }), esperado);
  assert.deepEqual(normalizarFechaSinDesfase('2026-12-05'), esperado);
  assert.deepEqual(normalizarFechaSinDesfase('5/12/2026'), esperado);
  assert.deepEqual(normalizarFechaSinDesfase(new Date(2026, 11, 5, 15).toISOString()), esperado);
  assert.equal(normalizarFechaSinDesfase('2026-02-31'), null);
  assert.equal(normalizarFechaSinDesfase('mañana'), null);
  assert.equal(normalizarFechaSinDesfase(new Date('x')), null);
  assert.equal(normalizarFechaSinDesfase(null), null);
  assert.equal(normalizarFechaSinDesfase(''), null);
});

// ─── Spot ────────────────────────────────────────────────────────────────────────────────────────

test('Spot con fechaProgramada AAAA-MM-DD: una fila en Spot con la fecha del cliente (módulos reales)', () => {
  const r = construirFilasPlanificacion([ord('a', { numeroOrden: 'N-1', tipoServicio: 'SPOT', fechaProgramada: '2026-12-05' })]);
  assert.equal(r.planes.length, 0);
  assert.equal(r.spot.length, 1);
  assert.equal(r.spot[0].fechaIso, '2026-12-05');
  assert.equal(r.spot[0].fechaTexto, '05/12/2026');
});

test('Spot con fechaServicio DD/MM/AAAA también muestra la fecha del cliente', () => {
  const r = construirFilasPlanificacion([ord('a', { tipoServicio: 'SPOT', fechaServicio: '17/12/2026' })]);
  assert.equal(r.spot[0].fechaTexto, '17/12/2026');
});

test('Spot: si la visita ya tiene fechasPorVisita.V1, esa fecha manda sobre la del cliente', () => {
  const r = construirFilasPlanificacion([ord('a', { tipoServicio: 'SPOT', fechaProgramada: '2026-12-05', fechasPorVisita: { V1: '2026-12-20' } })]);
  assert.equal(r.spot[0].fechaTexto, '20/12/2026');
});

test('Spot sin fecha o con fecha inválida: «Sin fecha del cliente» (no se inventa)', () => {
  const r = construirFilasPlanificacion([
    ord('a', { tipoServicio: 'SPOT' }),
    ord('b', { tipoServicio: 'SPOT', fechaProgramada: '2026-02-31' }),
  ]);
  assert.equal(r.spot.length, 2);
  for (const f of r.spot) { assert.equal(f.fechaIso, null); assert.equal(f.fechaTexto, SIN_FECHA_SPOT); }
});

test('Spot con tipoServicio SPOT va a Spot aunque el nombre del plan diga otra cosa', () => {
  const r = construirFilasPlanificacion([ord('a', { tipoServicio: 'SPOT', planNombre: 'Plan 12', fechaProgramada: '2026-12-05' })]);
  assert.equal(r.spot.length, 1);
  assert.equal(r.planes.length, 0);
});

// ─── Planes ──────────────────────────────────────────────────────────────────────────────────────

test('Plan 12: 12 filas, una visita al mes desde el inicio, todas tentativas y ninguna terminada', () => {
  const r = construirFilasPlanificacion([ord('p', { numeroOrden: 'N-12', servicio: { planNombre: 'Plan 12' }, fechaCreacion: '2026-01-15' })]);
  assert.equal(r.spot.length, 0);
  assert.equal(r.planes.length, 12);
  assert.deepEqual(r.planes.map((f) => f.visitaTexto), Array.from({ length: 12 }, (_, i) => `${i + 1} de 12`));
  assert.equal(r.planes[0].fechaTexto, '15/02/2026');
  assert.equal(r.planes[11].fechaTexto, '15/01/2027');
  assert.ok(r.planes.every((f) => f.esTentativa && !f.terminada && f.estado === 'Pendiente'));
});

test('Plan 4: visita n = inicio + 3·n meses (mismo criterio de Órdenes y Planificación)', () => {
  const r = construirFilasPlanificacion([ord('p', { planNombre: 'Plan 4', fechaCreacion: '2026-01-15' })]);
  assert.deepEqual(r.planes.map((f) => f.fechaTexto), ['15/04/2026', '15/07/2026', '15/10/2026', '15/01/2027']);
});

test('Plan 6: una visita cada 2 meses', () => {
  const r = construirFilasPlanificacion([ord('p', { tipoPlan: 'Plan 6', fechaCreacion: '2026-01-15' })]);
  assert.equal(r.planes.length, 6);
  assert.deepEqual(r.planes.slice(0, 3).map((f) => f.fechaTexto), ['15/03/2026', '15/05/2026', '15/07/2026']);
});

test('una fecha real guardada (fechasPorVisita.V2) gana sobre la tentativa y no lleva la insignia', () => {
  const r = construirFilasPlanificacion([ord('p', { planNombre: 'Plan 4', fechaCreacion: '2026-01-15', fechasPorVisita: { V2: '2026-03-20' } })]);
  const v2 = r.planes.find((f) => f.visitaNumero === 2);
  assert.equal(v2.fechaTexto, '20/03/2026');
  assert.equal(v2.esTentativa, false);
  assert.equal(r.planes.find((f) => f.visitaNumero === 1).esTentativa, true);
});

test('sin fecha de inicio no hay fechas tentativas: «Sin fecha programada»', () => {
  const r = construirFilasPlanificacion([ord('p', { servicio: { planNombre: 'Plan 6' } })]);
  assert.equal(r.planes.length, 6);
  for (const f of r.planes) { assert.equal(f.fechaIso, null); assert.equal(f.fechaTexto, SIN_FECHA_PLAN); assert.equal(f.esTentativa, false); }
});

test('sin plan registrado: una fila «Sin plan registrado» y NO se calcula con un plan por defecto', () => {
  const r = construirFilasPlanificacion([ord('p', { numeroOrden: 'N-X', fechaCreacion: '2026-01-15' })]);
  assert.equal(r.planes.length, 1);
  assert.equal(r.planes[0].plan, SIN_PLAN);
  assert.equal(r.planes[0].fechaTexto, SIN_FECHA_PLAN);
  assert.equal(r.planes[0].esTentativa, false);
});

test('sin plan registrado pero con fecha real guardada: se muestra esa fecha', () => {
  const r = construirFilasPlanificacion([ord('p', { fechasPorVisita: { V1: '2026-05-04' } })]);
  assert.equal(r.planes[0].fechaTexto, '04/05/2026');
});

// ─── Datos de la fila, estados, orden y filtros ──────────────────────────────────────────────────

test('la fila trae cliente, Ser Querido, cementerio, N° de orden y operador de ESA visita', () => {
  const r = construirFilasPlanificacion(
    [ord('doc9', {
      planNombre: 'Plan 4', fechaCreacion: '2026-01-15',
      difunto: { nombreCompleto: 'Ana Pérez' }, ubicacionSepultura: { cementerio: 'Cementerio General' },
      operadoresPorVisita: { V2: 'Luis' },
    })],
    { nombreCliente: () => 'María Soto' },
  );
  const [v1, v2] = r.planes;
  assert.equal(v1.numeroOrden, 'doc9'); // sin numeroOrden se usa el id del documento
  assert.equal(v1.cliente, 'María Soto');
  assert.equal(v1.serQuerido, 'Ana Pérez');
  assert.equal(v1.cementerio, 'Cementerio General');
  assert.equal(v1.operador, 'Sin asignar');
  assert.equal(v2.operador, 'Luis');
  assert.equal(v2.estado, 'Asignado');
});

test('una orden pagada en integración de Transbank se marca como PRUEBA (como en la Gantt)', () => {
  const r = construirFilasPlanificacion([
    ord('t', { tipoServicio: 'SPOT', modoPago: 'integracion' }),
    ord('p', { planNombre: 'Plan 4', modoPago: 'produccion' }),
  ]);
  assert.equal(r.spot[0].esPrueba, true);
  assert.equal(r.planes[0].esPrueba, false);
});

test('faltan datos: textos de aviso en vez de vacíos', () => {
  const r = construirFilasPlanificacion([ord('x', { tipoServicio: 'SPOT' })]);
  assert.equal(r.spot[0].cliente, 'Sin registrar');
  assert.equal(r.spot[0].serQuerido, 'Sin registrar');
  assert.equal(r.spot[0].cementerio, '—');
});

test('estadoDeVisita usa las mismas etiquetas de la Gantt (no el valor crudo)', () => {
  assert.equal(estadoDeVisita({}, 1).etiqueta, 'Pendiente');
  assert.equal(estadoDeVisita({}, 1, { operador: 'Luis' }).etiqueta, 'Asignado');
  assert.equal(estadoDeVisita({ estadosPorVisita: { V1: 'en_ejecucion' } }, 1).etiqueta, 'En ejecución');
  assert.equal(estadoDeVisita({ estadosPorVisita: { V1: 'reprogramada' } }, 1).etiqueta, 'Reprogramada');
  assert.equal(estadoDeVisita({ programacionVisitas: { v_1: { estado: 'en revision' } } }, 1).etiqueta, 'Pendiente Revisión');
  assert.equal(estadoDeVisita({ programacionVisitas: { v_1: { estado: 'rechazada' } } }, 1).etiqueta, 'Rechazada');
  assert.equal(estadoDeVisita({}, 1, { terminada: true }).etiqueta, 'Completada');
  // «completada» guardada sin cumplir la regla única de terminada no vale
  assert.equal(estadoDeVisita({ estadosPorVisita: { V1: 'completada' } }, 1, { terminada: false }).etiqueta, 'Pendiente');
});

test('orden: fecha ascendente, las visitas sin fecha al final; a igual fecha por N° de orden y visita', () => {
  const filas = ordenarFilasPorFecha([
    { numeroOrden: 'B', visitaNumero: 1, fechaIso: null },
    { numeroOrden: 'A', visitaNumero: 2, fechaIso: '2026-05-01' },
    { numeroOrden: 'A', visitaNumero: 1, fechaIso: '2026-05-01' },
    { numeroOrden: 'C', visitaNumero: 1, fechaIso: '2026-01-01' },
  ]);
  assert.deepEqual(filas.map((f) => `${f.numeroOrden}${f.visitaNumero}`), ['C1', 'A1', 'A2', 'B1']);
});

test('filtros de Planes (búsqueda, cementerio, operador, estado) y de Spot (búsqueda, cementerio)', () => {
  const { planes, spot } = construirFilasPlanificacion([
    ord('1', { numeroOrden: 'N-1', planNombre: 'Plan 4', fechaCreacion: '2026-01-15', difunto: 'Rosa Díaz', cementerio: 'Parque A', operadoresPorVisita: { V1: 'Luis' } }),
    ord('2', { numeroOrden: 'N-2', tipoServicio: 'SPOT', fechaProgramada: '2026-12-05', difunto: 'Juan Gómez', cementerio: 'Parque B' }),
    ord('3', { numeroOrden: 'N-3', tipoServicio: 'SPOT', fechaProgramada: '2026-12-06', difunto: 'Eva Ríos', cementerio: 'Parque A' }),
  ], { nombreCliente: (o, id) => `Cliente ${id}` });
  assert.equal(filtrarPlanes(planes, { busqueda: 'rosa' }).length, 4);
  assert.equal(filtrarPlanes(planes, { busqueda: 'zzz' }).length, 0);
  assert.equal(filtrarPlanes(planes, { operador: 'Luis' }).length, 1);
  assert.equal(filtrarPlanes(planes, { estado: 'Asignado' }).length, 1);
  assert.equal(filtrarPlanes(planes, { cementerio: 'Parque B' }).length, 0);
  assert.equal(filtrarSpot(spot, { busqueda: 'n-2' }).length, 1);
  assert.equal(filtrarSpot(spot, { cementerio: 'Parque A' }).length, 1);
  assert.equal(filtrarSpot(spot, {}).length, 2);
});
