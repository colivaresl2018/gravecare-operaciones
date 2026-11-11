// Resolución única de las 4 fotos del informe. Ejecutar: node --test public/js/fotos-informe.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolverFotosInforme, TITULOS_FOTOS } from './fotos-informe.js';

const U = (n) => `data:image/jpeg;base64,FOTO${n}`;

/** Documento tal como lo escribe informe-captura.html (setDoc de informes/{ordenId}-V{n}). */
const informeDeCaptura = () => ({
  informeId: 'ORD-1794357459960709-V1', ordenId: 'ORD-1794357459960709', visitaNumero: 1, estado: 'pendiente_revision',
  fotos: { inicial: U(1), finalizado: U(2), ornamentacion: U(3), panoramica: U(4), antes: U(1), despues: U(2) },
});

test('informe de captura con las 4 fotos: las 4 salen con su título y ninguna queda vacía', () => {
  const r = resolverFotosInforme(informeDeCaptura());
  assert.deepEqual(r.map((x) => x.titulo), ['1. Estado Inicial', '2. Finalizado', '3. Ornamentación', '4. Vista Panorámica']);
  assert.deepEqual(r.map((x) => x.url), [U(1), U(2), U(3), U(4)]);
  assert.ok(r.every((x) => x.url !== ''), 'ninguna foto queda como «Sin fotografía registrada»');
  assert.deepEqual(TITULOS_FOTOS, r.map((x) => x.titulo));
});

test('la resolución coincide con la de informe-revision.html (alias y campos sueltos)', () => {
  // informe-revision: f1 = fotos.inicial||fotos.antes||inf.fotoInicial; f2 = finalizado||despues||fotoFinal;
  // f3 = ornamentacion||flores||fotoOrnamentacion; f4 = panoramica||general||fotoPanoramica.
  const alias = resolverFotosInforme({ fotos: { antes: U(1), despues: U(2), flores: U(3), general: U(4) } });
  assert.deepEqual(alias.map((x) => x.url), [U(1), U(2), U(3), U(4)]);
  const sueltos = resolverFotosInforme({ fotoInicial: U(1), fotoFinal: U(2), fotoOrnamentacion: U(3), fotoPanoramica: U(4) });
  assert.deepEqual(sueltos.map((x) => x.url), [U(1), U(2), U(3), U(4)]);
});

test('los campos del protocolo tienen prioridad sobre los esquemas antiguos', () => {
  const r = resolverFotosInforme({ ...informeDeCaptura(), fotoAntes1: 'antiguo-a1', fotoAntes2: 'antiguo-a2', fotoDespues1: 'antiguo-d1', fotoDespues2: 'antiguo-d2' });
  assert.deepEqual(r.map((x) => x.url), [U(1), U(2), U(3), U(4)]);
  assert.deepEqual(r.map((x) => x.titulo), [...TITULOS_FOTOS]);
});

test('respaldo: informe antiguo con fotoAntes1/2 y fotoDespues1/2 sigue mostrando sus 4 fotos', () => {
  const r = resolverFotosInforme({ fotoAntes1: 'a1', fotoAntes2: 'a2', fotoDespues1: 'd1', fotoDespues2: 'd2' });
  assert.deepEqual(r.map((x) => x.url), ['a1', 'd1', 'a2', 'd2']);
  assert.equal(r[2].titulo, '3. Estado Inicial (2)');
  assert.equal(r[3].titulo, '4. Finalizado (2)');
  assert.equal(r[0].titulo, '1. Estado Inicial');
});

test('respaldo: variantes antiguas fotosAntes/fotosDespues, fotos como arreglo y campos únicos', () => {
  assert.deepEqual(resolverFotosInforme({ fotosAntes: ['a1', 'a2'], fotosDespues: ['d1', 'd2'] }).map((x) => x.url), ['a1', 'd1', 'a2', 'd2']);
  assert.deepEqual(resolverFotosInforme({ fotos: ['f1', 'f2', 'f3', 'f4'] }).map((x) => x.url), ['f1', 'f2', 'f3', 'f4']);
  assert.deepEqual(resolverFotosInforme({ fotos: ['f1', 'f2'] }).map((x) => x.url), ['f1', 'f2', '', '']);
  assert.deepEqual(resolverFotosInforme({ fotoAntesUrl: 'a', fotoDespuesUrl: 'd' }).map((x) => x.url), ['a', 'd', '', '']);
  assert.deepEqual(resolverFotosInforme({ fotos: { inicial: { url: 'obj1' } } }).map((x) => x.url), ['obj1', '', '', '']);
});

test('faltantes: las fotos que no existen quedan vacías; sin informe, las 4 vacías', () => {
  assert.deepEqual(resolverFotosInforme({ fotos: { inicial: U(1), finalizado: U(2) } }).map((x) => x.url), [U(1), U(2), '', '']);
  assert.deepEqual(resolverFotosInforme({ fotos: { inicial: null, finalizado: '', ornamentacion: '  ' } }).map((x) => x.url), ['', '', '', '']);
  assert.deepEqual(resolverFotosInforme(null).map((x) => x.url), ['', '', '', '']);
  assert.equal(resolverFotosInforme(undefined).length, 4);
});
