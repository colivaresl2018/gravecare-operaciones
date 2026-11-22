import test from 'node:test';
import assert from 'node:assert/strict';
import { htmlResumenRutas, htmlFilasRutas, htmlFilasFeriados, htmlListaErroresFeriados, htmlResultadosGuardado } from './config-vistas.js';

const filas = [
  { nombre: 'Parque Canaán de Pudahuel', estado: 'activa', id: 'cem-001', eje: 'Norte', diaSemana: 2, dia: 'Martes' },
  { nombre: 'Cementerio General de Recoleta', estado: 'inactiva', id: 'cgr', eje: 'Centro', diaSemana: 1, dia: 'Lunes' },
  { nombre: 'Cementerio Metropolitano de Lo Espejo', estado: 'sin-ruta', id: '', eje: '', diaSemana: null, dia: '' },
];

test('htmlResumenRutas: cuenta con ruta, sin ruta y quitadas', () => {
  const html = htmlResumenRutas({ total: 3, activas: 1, inactivas: 1, sinRuta: 1 });
  assert.match(html, /1 con ruta/);
  assert.match(html, /1 sin ruta/);
  assert.match(html, /1 quitada/);
});

test('htmlFilasRutas: quien puede editar ve casilla, «Editar» y «Quitar»/«Reactivar»; quien no, solo la lectura', () => {
  const editable = htmlFilasRutas(filas, { puedeEditar: true });
  assert.match(editable, /type="checkbox"[^>]*data-cementerio="Parque Canaán de Pudahuel"/);
  assert.match(editable, /data-accion="editar-ruta"/);
  assert.match(editable, /data-accion="quitar-ruta"[^>]*data-id="cem-001"/);
  assert.match(editable, /data-accion="reactivar-ruta"[^>]*data-id="cgr"/);
  assert.doesNotMatch(editable, /data-accion="quitar-ruta"[^>]*data-id="cgr"/);
  const lectura = htmlFilasRutas(filas, { puedeEditar: false });
  assert.doesNotMatch(lectura, /type="checkbox"|data-accion=|<button/);
  assert.match(lectura, /Parque Canaán de Pudahuel/);
  assert.match(lectura, /Norte/);
  assert.match(lectura, /Martes/);
});

test('htmlFilasRutas: el cementerio sin ruta se ve como «Sin eje» y las quitadas se marcan', () => {
  const html = htmlFilasRutas(filas, { puedeEditar: false });
  assert.match(html, /Sin eje/);
  assert.match(html, /Quitada/);
  assert.match(html, /Sin ruta/);
});

test('htmlFilasRutas: lista vacía → mensaje claro (nada de tabla en blanco)', () => {
  assert.match(htmlFilasRutas([], { puedeEditar: true }), /No hay cementerios/);
});

test('AUD-01: los nombres y ejes vienen de Firestore y se escapan en todas las vistas', () => {
  const malo = '<img src=x onerror=alert(1)>"\'&';
  const html = htmlFilasRutas([{ nombre: malo, estado: 'activa', id: malo, eje: malo, diaSemana: 1, dia: 'Lunes' }], { puedeEditar: true });
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img/);
  const fer = htmlFilasFeriados([{ id: '2026-12-25', data: { nombre: malo, alcance: 'nacional' } }], { puedeEditar: true });
  assert.doesNotMatch(fer, /<img/);
  const err = htmlListaErroresFeriados([{ linea: 3, motivo: malo }]);
  assert.doesNotMatch(err, /<img/);
  const res = htmlResultadosGuardado([{ id: malo, ok: false, error: new Error(malo) }], 'rutas');
  assert.doesNotMatch(res, /<img/);
});

test('htmlFilasFeriados: fecha en dd/mm/aaaa y día de la semana, nombre, alcance y estado; botones solo para quien puede editar', () => {
  const docs = [
    { id: '2026-12-25', data: { nombre: 'Navidad', alcance: 'nacional' } },
    { id: '2026-12-08', data: { nombre: 'Inmaculada Concepción' } }, // sin alcance = nacional
    { id: '2026-12-31', data: { nombre: 'Regional', alcance: 'regional', activo: false } },
    { id: 'no-es-fecha', data: { nombre: 'Basura' } },
  ];
  const html = htmlFilasFeriados(docs, { puedeEditar: true });
  assert.match(html, /25\/12\/2026/);
  assert.match(html, /Viernes/); // 25-12-2026 es viernes
  assert.match(html, /Nacional/);
  assert.match(html, /Regional/);
  assert.match(html, /data-accion="quitar-feriado"[^>]*data-fecha="2026-12-25"/);
  assert.match(html, /data-accion="reactivar-feriado"[^>]*data-fecha="2026-12-31"/);
  assert.doesNotMatch(html, /Basura/); // un documento cuyo id no es una fecha no se lista
  assert.ok(html.indexOf('08/12/2026') < html.indexOf('25/12/2026'), 'ordenados por fecha');
  assert.doesNotMatch(htmlFilasFeriados(docs, { puedeEditar: false }), /<button|data-accion=/);
  assert.match(htmlFilasFeriados([], { puedeEditar: true }), /No hay feriados/);
});

test('htmlListaErroresFeriados: cada línea con su número; sin errores no pinta nada', () => {
  assert.equal(htmlListaErroresFeriados([]), '');
  const html = htmlListaErroresFeriados([{ linea: 3, motivo: 'La fecha no es válida.' }, { linea: 7, motivo: 'Falta el nombre.' }]);
  assert.match(html, /Línea 3/);
  assert.match(html, /La fecha no es válida\./);
  assert.match(html, /Línea 7/);
});

test('htmlResultadosGuardado: resume cuántas se guardaron y lista las que fallaron con el motivo', () => {
  const ok = htmlResultadosGuardado([{ id: 'a', ok: true }, { id: 'b', ok: true }], 'rutas');
  assert.match(ok, /2 de 2/);
  assert.doesNotMatch(ok, /no se pudo/i);
  const parcial = htmlResultadosGuardado([
    { id: 'a', ok: true },
    { id: 'b', ok: false, error: Object.assign(new Error('x'), { code: 'permission-denied' }) },
  ], 'rutas');
  assert.match(parcial, /1 de 2/);
  assert.match(parcial, /no se pudo/i);
  assert.match(parcial, /dueño/i);
  assert.equal(htmlResultadosGuardado([], 'rutas'), '');
});
