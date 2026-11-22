// Ejes y feriados que se leen de Firestore (colecciones `rutas` y `feriados`). Ejecutar: node --test public/js/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SIN_EJE, normalizarNombre, crearIndiceRutas, crearIndiceFeriados } from './rutas-planificacion.js';

const RUTAS_DOCS = [
  { id: 'cementerio-general-de-recoleta', data: { cementerio: 'Cementerio General de Recoleta', eje: 'Eje Santiago Norte 1', diaSemana: 1 } },
  { id: 'parque-canaan-de-pudahuel', data: { cementerio: 'Parque Canaán de Pudahuel', eje: 'Eje Santiago Poniente 1', diaSemana: 2 } },
  { id: 'cementerio-metropolitano-de-lo-espejo', data: { cementerio: 'Cementerio Metropolitano de Lo Espejo', eje: 'Eje Santiago Sur 1', diaSemana: 3 } },
  { id: 'parque-sendero-de-san-bernardo', data: { cementerio: 'Parque Sendero de San Bernardo', eje: 'Eje Santiago Sur 2', diaSemana: 4 } },
  { id: 'parque-sendero-de-rancagua', data: { cementerio: 'Parque Sendero de Rancagua', eje: 'Eje Rancagua – Machalí', diaSemana: 5 } },
];

test('normalizarNombre: sin tildes, minúsculas y espacios simples', () => {
  assert.equal(normalizarNombre('  Parque  Canaán de Pudahuel '), 'parque canaan de pudahuel');
  assert.equal(normalizarNombre('Cementerio Municipal N° 1 de Rancagua'), 'cementerio municipal n 1 de rancagua');
  assert.equal(normalizarNombre(null), '');
});

test('el eje y el día de ruta salen de la colección rutas (por nombre del cementerio, con o sin tildes)', () => {
  const rutas = crearIndiceRutas(RUTAS_DOCS);
  assert.deepEqual(rutas.rutaDe('Cementerio General de Recoleta'), { eje: 'Eje Santiago Norte 1', diaSemana: 1, dia: 'Lunes' });
  assert.equal(rutas.rutaDe('PARQUE CANAAN DE PUDAHUEL').eje, 'Eje Santiago Poniente 1');
  assert.equal(rutas.rutaDe('Parque Sendero de Rancagua').diaSemana, 5);
  assert.equal(rutas.rutaDe('Parque Sendero de Rancagua').dia, 'Viernes');
});

test('un cementerio que no está en rutas es «Sin eje»: no se inventa ni se adivina por parecido', () => {
  const rutas = crearIndiceRutas(RUTAS_DOCS);
  assert.equal(SIN_EJE, 'Sin eje');
  assert.equal(rutas.rutaDe('Parque Canaán'), null); // nombre incompleto: no es el del catálogo
  assert.equal(rutas.rutaDe('Cementerio Desconocido'), null);
  assert.equal(rutas.rutaDe(''), null);
  assert.equal(rutas.rutaDe(null), null);
  assert.equal(rutas.rutaDe('—'), null);
});

test('también se reconoce por el id del documento cuando falta el campo cementerio', () => {
  const rutas = crearIndiceRutas([{ id: 'parque-el-manantial-de-maipu', data: { eje: 'Eje Santiago Poniente 1', diaSemana: 2 } }]);
  assert.equal(rutas.rutaDe('Parque El Manantial de Maipú').eje, 'Eje Santiago Poniente 1');
});

test('documentos incompletos: sin eje no hay ruta; un día de ruta inválido deja el eje sin día', () => {
  const rutas = crearIndiceRutas([
    { id: 'a', data: { cementerio: 'Cementerio A', eje: '   ', diaSemana: 1 } },
    { id: 'b', data: { cementerio: 'Cementerio B', eje: 'Eje B', diaSemana: 9 } },
    { id: 'c', data: { cementerio: 'Cementerio C', eje: 'Eje C', diaSemana: '3' } },
    { id: 'd', data: null },
  ]);
  assert.equal(rutas.rutaDe('Cementerio A'), null);
  assert.deepEqual(rutas.rutaDe('Cementerio B'), { eje: 'Eje B', diaSemana: null, dia: '' });
  assert.deepEqual(rutas.rutaDe('Cementerio C'), { eje: 'Eje C', diaSemana: 3, dia: 'Miércoles' });
});

test('la lista de ejes va ordenada por día de la semana, sin repetir, y sabe qué ejes tiene cada día', () => {
  const rutas = crearIndiceRutas([...RUTAS_DOCS].reverse().concat([{ id: 'x', data: { cementerio: 'Otro Norte', eje: 'Eje Santiago Norte 1', diaSemana: 1 } }]));
  assert.deepEqual(rutas.ejes.map((e) => e.eje), ['Eje Santiago Norte 1', 'Eje Santiago Poniente 1', 'Eje Santiago Sur 1', 'Eje Santiago Sur 2', 'Eje Rancagua – Machalí']);
  assert.deepEqual(rutas.ejesDelDia(1), ['Eje Santiago Norte 1']);
  assert.deepEqual(rutas.ejesDelDia(6), []);
  assert.equal(rutas.cantidad, 6);
});

test('sin documentos (colección vacía o ilegible) todo es «Sin eje» y el índice lo dice', () => {
  for (const vacio of [[], null, undefined]) {
    const rutas = crearIndiceRutas(vacio);
    assert.equal(rutas.vacio, true);
    assert.equal(rutas.rutaDe('Cementerio General de Recoleta'), null);
    assert.deepEqual(rutas.ejes, []);
  }
  assert.equal(crearIndiceRutas(RUTAS_DOCS).vacio, false);
});

// ---- feriados
const FERIADOS_DOCS = [
  { id: '2026-11-01', data: { nombre: 'Día de Todos los Santos', alcance: 'nacional' } },
  { id: '2026-12-08', data: { nombre: 'Inmaculada Concepción' } },
  { id: '2026-06-07', data: { nombre: 'Asalto y Toma del Morro de Arica', alcance: 'regional' } },
  { id: 'no-es-fecha', data: { nombre: 'Basura' } },
];

test('feriados: se pintan los nacionales (con o sin alcance) y no los regionales ni los ids que no son fecha', () => {
  const f = crearIndiceFeriados(FERIADOS_DOCS);
  assert.equal(f.nombre('2026-11-01'), 'Día de Todos los Santos');
  assert.equal(f.nombre('2026-12-08'), 'Inmaculada Concepción');
  assert.equal(f.nombre('2026-06-07'), null); // regional: no aplica a Santiago ni a Rancagua
  assert.equal(f.nombre('2026-11-02'), null);
  assert.equal(f.cantidad, 2);
});

test('feriados: un feriado sin nombre igual se pinta con un nombre genérico; sin documentos no hay feriados', () => {
  assert.equal(crearIndiceFeriados([{ id: '2026-05-01', data: {} }]).nombre('2026-05-01'), 'Feriado');
  const vacio = crearIndiceFeriados(null);
  assert.equal(vacio.nombre('2026-05-01'), null);
  assert.equal(vacio.cantidad, 0);
});

// ─── «Quitar» una ruta o un feriado = activo:false (campo aditivo): las matrices lo ignoran ───────────────────────

test('rutas: un documento con activo:false se ignora (el cementerio vuelve a «Sin eje»); sin el campo o con activo:true sigue valiendo', () => {
  const idx = crearIndiceRutas([
    { id: 'a', data: { cementerio: 'Cementerio A', eje: 'Norte', diaSemana: 1, activo: false } },
    { id: 'b', data: { cementerio: 'Cementerio B', eje: 'Sur', diaSemana: 2, activo: true } },
    { id: 'c', data: { cementerio: 'Cementerio C', eje: 'Centro', diaSemana: 3 } },
  ]);
  assert.equal(idx.rutaDe('Cementerio A'), null);
  assert.equal(idx.rutaDe('Cementerio B').eje, 'Sur');
  assert.equal(idx.rutaDe('Cementerio C').eje, 'Centro');
  assert.equal(idx.cantidad, 2);
  assert.deepEqual(idx.ejes.map((e) => e.eje), ['Sur', 'Centro']);
  assert.deepEqual(idx.ejesDelDia(1), []);
});

test('rutas: si todas están quitadas el índice queda vacío', () => {
  const idx = crearIndiceRutas([{ id: 'a', data: { cementerio: 'A', eje: 'Norte', diaSemana: 1, activo: false } }]);
  assert.equal(idx.vacio, true);
});

test('feriados: uno con activo:false no se pinta; los demás siguen', () => {
  const f = crearIndiceFeriados([
    { id: '2026-12-25', data: { nombre: 'Navidad', activo: false } },
    { id: '2026-12-08', data: { nombre: 'Inmaculada Concepción', activo: true } },
    { id: '2026-05-01', data: { nombre: 'Día del Trabajo' } },
  ]);
  assert.equal(f.nombre('2026-12-25'), null);
  assert.equal(f.nombre('2026-12-08'), 'Inmaculada Concepción');
  assert.equal(f.nombre('2026-05-01'), 'Día del Trabajo');
  assert.equal(f.cantidad, 2);
});
