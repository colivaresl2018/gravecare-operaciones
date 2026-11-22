// Matrices de Planificación (semana de Planes, mes de Spot): lógica pura. Ejecutar: node --test public/js/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { construirMatrizSemana, construirMatrizMes } from './matriz-planificacion.js';
import { crearIndiceRutas, crearIndiceFeriados } from './rutas-planificacion.js';
import { construirFilasPlanificacion } from './planificacion-servicios.js';

const LUNES = '2026-11-16';
const RUTAS = crearIndiceRutas([
  { id: 'cementerio-general-de-recoleta', data: { cementerio: 'Cementerio General de Recoleta', eje: 'Eje Santiago Norte 1', diaSemana: 1 } },
  { id: 'cementerio-catolico-de-recoleta', data: { cementerio: 'Cementerio Católico de Recoleta', eje: 'Eje Santiago Norte 1', diaSemana: 1 } },
  { id: 'parque-canaan-de-pudahuel', data: { cementerio: 'Parque Canaán de Pudahuel', eje: 'Eje Santiago Poniente 1', diaSemana: 2 } },
  { id: 'cementerio-metropolitano-de-lo-espejo', data: { cementerio: 'Cementerio Metropolitano de Lo Espejo', eje: 'Eje Santiago Sur 1', diaSemana: 3 } },
  { id: 'parque-sendero-de-san-bernardo', data: { cementerio: 'Parque Sendero de San Bernardo', eje: 'Eje Santiago Sur 2', diaSemana: 4 } },
  { id: 'parque-jardin-de-rancagua', data: { cementerio: 'Parque Jardín de Rancagua', eje: 'Eje Rancagua – Machalí', diaSemana: 5 } },
]);
const FERIADOS = crearIndiceFeriados([
  { id: '2026-11-01', data: { nombre: 'Día de Todos los Santos' } },
  { id: '2027-01-01', data: { nombre: 'Año Nuevo' } },
]);
const CTX = { rutas: RUTAS, feriados: FERIADOS };

function fila(docId, cementerio, fechaIso, extra = {}) {
  const r = RUTAS.rutaDe(cementerio);
  return {
    docId, numeroOrden: `GC-${docId}`, cliente: `Cliente ${docId}`, serQuerido: 'Ser Querido', esPrueba: false, cementerio,
    nivel: 'Standard', ramosAdicionales: 0, eje: r ? r.eje : 'Sin eje', diaRuta: r ? r.diaSemana : null,
    plan: 'Plan 12', visitaNumero: 1, visitaTotal: 12, visitaTexto: '1 de 12', operador: 'Sin asignar', estado: 'Pendiente', estadoClases: 'x',
    terminada: false, esTentativa: false, fechaIso, fechaTexto: fechaIso || 'Sin fecha programada', ...extra,
  };
}

// ---- semana de Planes
test('semana: 7 días lunes a domingo; cada día de lunes a viernes trae el eje de ruta que dice la colección rutas', () => {
  const m = construirMatrizSemana([], { lunesIso: LUNES, ...CTX });
  assert.deepEqual(m.dias.map((d) => d.nombre), ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']);
  assert.deepEqual(m.dias.slice(0, 5).map((d) => d.ejes), [['Eje Santiago Norte 1'], ['Eje Santiago Poniente 1'], ['Eje Santiago Sur 1'], ['Eje Santiago Sur 2'], ['Eje Rancagua – Machalí']]);
  assert.deepEqual(m.dias[5].ejes, []);
  assert.equal(m.dias[5].finDeSemana, true);
  assert.equal(m.dias[0].display, '16/11/2026');
  assert.deepEqual([m.ordenes.length, m.totalVisitas, m.sinFecha, m.fueraDeRuta], [0, 0, 0, 0]);
});

test('sin colección de rutas los días no traen eje', () => {
  const m = construirMatrizSemana([fila('A', 'Cementerio General de Recoleta', '2026-11-18')], { lunesIso: LUNES });
  assert.deepEqual(m.dias.map((d) => d.ejes), [[], [], [], [], [], [], []]);
  assert.equal(m.totalVisitas, 1);
});

test('una visita del lunes de un cementerio de Norte 1 va en la columna del lunes, dentro de su día de ruta', () => {
  const m = construirMatrizSemana([fila('A', 'Cementerio General de Recoleta', LUNES)], { lunesIso: LUNES, ...CTX });
  assert.equal(m.ordenes.length, 1);
  assert.equal(m.ordenes[0].eje, 'Eje Santiago Norte 1');
  assert.equal(m.ordenes[0].celdas[0].length, 1);
  assert.equal(m.ordenes[0].celdas[0][0].fueraDeRuta, false);
  assert.deepEqual([m.dias[0].visitas, m.totalVisitas, m.fueraDeRuta], [1, 1, 0]);
});

test('una visita en otro día que el de su ruta va en su fecha real y se marca «fuera de su día de ruta»', () => {
  const m = construirMatrizSemana([fila('A', 'Cementerio General de Recoleta', '2026-11-18')], { lunesIso: LUNES, ...CTX });
  assert.equal(m.ordenes[0].celdas[2][0].fueraDeRuta, true);
  assert.equal(m.fueraDeRuta, 1);
});

test('una orden con dos visitas en la misma semana muestra ambas, cada una en su día', () => {
  const m = construirMatrizSemana([
    fila('A', 'Parque Canaán de Pudahuel', '2026-11-17', { visitaNumero: 1 }),
    fila('A', 'Parque Canaán de Pudahuel', '2026-11-20', { visitaNumero: 2, visitaTexto: '2 de 12' }),
  ], { lunesIso: LUNES, ...CTX });
  assert.equal(m.ordenes.length, 1);
  assert.equal(m.ordenes[0].celdas[1][0].visitaNumero, 1);
  assert.equal(m.ordenes[0].celdas[4][0].visitaNumero, 2);
  assert.equal(m.ordenes[0].celdas[4][0].fueraDeRuta, true);
  assert.equal(m.totalVisitas, 2);
});

test('cementerio sin eje: «Sin eje», en su fecha real, y nunca «fuera de su día de ruta»', () => {
  const m = construirMatrizSemana([fila('A', '', LUNES), fila('B', 'Cementerio Desconocido', '2026-11-19')], { lunesIso: LUNES, ...CTX });
  assert.equal(m.ordenes.length, 2);
  for (const o of m.ordenes) assert.equal(o.eje, 'Sin eje');
  assert.equal(m.fueraDeRuta, 0);
  assert.equal(m.totalVisitas, 2);
  assert.equal(m.ordenes.at(-1).celdas.flat().length, 1);
});

test('sábado y domingo se muestran si tienen visitas; el feriado viene de la colección y no mueve nada', () => {
  const m = construirMatrizSemana([fila('A', 'Parque Canaán de Pudahuel', '2026-11-21'), fila('B', 'Parque Canaán de Pudahuel', '2026-11-22')], { lunesIso: LUNES, ...CTX });
  assert.deepEqual([m.dias[5].visitas, m.dias[6].visitas, m.totalVisitas], [1, 1, 2]);
  const f = construirMatrizSemana([fila('A', 'Parque Canaán de Pudahuel', '2026-11-01')], { lunesIso: '2026-10-26', ...CTX });
  assert.equal(f.dias[6].iso, '2026-11-01');
  assert.equal(f.dias[6].feriado, 'Día de Todos los Santos');
  assert.equal(f.dias[6].visitas, 1); // el feriado se pinta, la visita sigue en su fecha
});

test('una semana que cruza de año trae las fechas y feriados correctos', () => {
  const m = construirMatrizSemana([], { lunesIso: '2026-12-28', ...CTX });
  assert.equal(m.dias[4].iso, '2027-01-01');
  assert.equal(m.dias[4].feriado, 'Año Nuevo');
  assert.equal(m.dias[0].feriado, null);
});

test('las visitas sin fecha no van en la matriz y se cuentan para avisarlas', () => {
  const m = construirMatrizSemana([fila('A', 'Parque Canaán de Pudahuel', null), fila('B', 'Parque Canaán de Pudahuel', LUNES)], { lunesIso: LUNES, ...CTX });
  assert.equal(m.sinFecha, 1);
  assert.deepEqual(m.ordenes.map((o) => o.docId), ['B']);
});

test('por defecto solo las órdenes con visita esa semana; con soloConVisita=false todas, con su próxima visita', () => {
  const filas = [
    fila('A', 'Parque Canaán de Pudahuel', '2026-11-17'),
    fila('B', 'Parque Canaán de Pudahuel', '2026-11-30', { visitaNumero: 2, visitaTexto: '2 de 12' }),
    fila('B', 'Parque Canaán de Pudahuel', '2026-10-30', { visitaNumero: 1 }),
  ];
  assert.deepEqual(construirMatrizSemana(filas, { lunesIso: LUNES, ...CTX }).ordenes.map((o) => o.docId), ['A']);
  const todos = construirMatrizSemana(filas, { lunesIso: LUNES, soloConVisita: false, ...CTX });
  assert.deepEqual(todos.ordenes.map((o) => o.docId).sort(), ['A', 'B']);
  assert.deepEqual(todos.ordenes.find((o) => o.docId === 'B').proxima, { visitaTexto: '2 de 12', fechaTexto: '2026-11-30' });
  assert.equal(todos.ordenes.find((o) => o.docId === 'A').proxima, null);
});

test('filtros: búsqueda, cementerio, eje (incluido «Sin eje»), estado y operador', () => {
  const filas = [
    fila('A', 'Cementerio General de Recoleta', LUNES, { cliente: 'Ana Pérez' }),
    fila('B', 'Parque Canaán de Pudahuel', '2026-11-17', { serQuerido: 'Don Luis', estado: 'Completada', operador: 'Luis' }),
    fila('C', 'Parque Jardín de Rancagua', '2026-11-20'),
    fila('D', 'Cementerio Desconocido', '2026-11-19'),
  ];
  const ids = (o) => construirMatrizSemana(filas, { lunesIso: LUNES, ...CTX, ...o }).ordenes.map((x) => x.docId);
  assert.deepEqual(ids({ busqueda: 'ana perez' }), ['A']);
  assert.deepEqual(ids({ busqueda: 'DON LUIS' }), ['B']);
  assert.deepEqual(ids({ busqueda: 'gc-c' }), ['C']);
  assert.deepEqual(ids({ cementerio: 'Parque Canaán de Pudahuel' }), ['B']);
  assert.deepEqual(ids({ eje: 'Eje Rancagua – Machalí' }), ['C']);
  assert.deepEqual(ids({ eje: 'Sin eje' }), ['D']);
  assert.deepEqual(ids({ estado: 'Completada' }), ['B']);
  assert.deepEqual(ids({ operador: 'Luis' }), ['B']);
  assert.deepEqual(ids({}), ['A', 'B', 'C', 'D']);
});

test('el orden de las filas es por día de ruta, luego cementerio, luego N° de orden; «Sin eje» al final', () => {
  const filas = [fila('Z', '', LUNES), fila('A', 'Parque Jardín de Rancagua', LUNES), fila('B', 'Cementerio General de Recoleta', LUNES), fila('C', 'Cementerio Católico de Recoleta', LUNES)];
  assert.deepEqual(construirMatrizSemana(filas, { lunesIso: LUNES, ...CTX }).ordenes.map((o) => o.docId), ['C', 'B', 'A', 'Z']);
});

test('con filas reales de la pantalla: una orden de Plan 4 aparece en la semana de su visita (módulos reales)', () => {
  const { planes } = construirFilasPlanificacion([
    { id: 'o1', data: { numeroOrden: 'N-1', tipoPlan: 'Plan 4', fechasPorVisita: { V1: '2026-11-16' }, ubicacionSepultura: { cementerio: 'Cementerio General de Recoleta' } } },
  ], { rutas: RUTAS });
  const m = construirMatrizSemana(planes, { lunesIso: LUNES, ...CTX });
  assert.equal(m.totalVisitas, 1);
  assert.equal(m.ordenes[0].eje, 'Eje Santiago Norte 1');
});

// ---- mes de Spot
test('mes: días del mes (bisiesto, 30 y 31 días), fines de semana y feriados de la colección', () => {
  assert.equal(construirMatrizMes([], { mesIso: '2028-02', ...CTX }).dias.length, 29);
  assert.equal(construirMatrizMes([], { mesIso: '2027-02', ...CTX }).dias.length, 28);
  assert.equal(construirMatrizMes([], { mesIso: '2026-11', ...CTX }).dias.length, 30);
  assert.equal(construirMatrizMes([], { mesIso: '2026-12', ...CTX }).dias.length, 31);
  const d = construirMatrizMes([], { mesIso: '2026-11', ...CTX }).dias;
  assert.deepEqual([d[0].iso, d[0].dia, d[0].feriado, d[0].finDeSemana], ['2026-11-01', 1, 'Día de Todos los Santos', true]);
  assert.equal(d[20].finDeSemana, true);
});

test('mes: cada Spot cae en el día que eligió el cliente, sin reglas de ruta; sin fecha se cuenta aparte; otro mes no aparece', () => {
  const filas = [
    fila('S1', 'Cementerio Metropolitano de Lo Espejo', '2026-11-24', { visitaTotal: 1, visitaTexto: '1 de 1' }),
    fila('S2', 'Cementerio Metropolitano de Lo Espejo', '2026-12-01'),
    fila('S3', '', null),
    fila('S4', 'Parque Canaán de Pudahuel', '2026-11-21'), // sábado: se muestra
    fila('S5', 'Parque Canaán de Pudahuel', '2026-11-01'), // feriado: se muestra
  ];
  const m = construirMatrizMes(filas, { mesIso: '2026-11', ...CTX });
  assert.deepEqual(m.filas.map((f) => [f.docId, f.indiceDia]), [['S5', 0], ['S4', 20], ['S1', 23]]);
  assert.deepEqual([m.total, m.sinFecha], [3, 1]);
  assert.equal(m.filas.find((f) => f.docId === 'S1').visita.fueraDeRuta, false); // Spot no tiene regla de ruta
  assert.deepEqual(construirMatrizMes(filas, { mesIso: '2026-12', ...CTX }).filas.map((f) => f.docId), ['S2']);
});

test('mes: filtros de búsqueda (sin tildes), cementerio, estado y operador', () => {
  const filas = [
    fila('A', 'Parque Canaán de Pudahuel', '2026-11-03', { cliente: 'Ana Pérez' }),
    fila('B', 'Cementerio Metropolitano de Lo Espejo', '2026-11-04', { estado: 'Completada', operador: 'Luis' }),
  ];
  const ids = (o) => construirMatrizMes(filas, { mesIso: '2026-11', ...CTX, ...o }).filas.map((x) => x.docId);
  assert.deepEqual(ids({ busqueda: 'ana perez' }), ['A']);
  assert.deepEqual(ids({ cementerio: 'Cementerio Metropolitano de Lo Espejo' }), ['B']);
  assert.deepEqual(ids({ estado: 'Completada' }), ['B']);
  assert.deepEqual(ids({ operador: 'Luis' }), ['B']);
});
