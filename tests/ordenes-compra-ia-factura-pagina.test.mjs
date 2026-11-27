// Spec 082 etapa 2: ordenes-compra.html con «Crear borrador desde una factura (IA)». Aditivo: lo existente no cambia.
// Pruebas estáticas de integración (no ejecutan la página). La lógica está en public/js/ia-factura.test.mjs.
// Ejecutar: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AVISO_IA } from '../public/js/ia-informe.js';

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const html = readFileSync(join(PUBLIC, 'ordenes-compra.html'), 'utf8').replace(/\r/g, '');
const script = html.slice(html.indexOf('<script type="module">'));
const i0 = script.indexOf('async function crearBorradorConIA');
const manejador = i0 >= 0 ? script.slice(i0, script.indexOf('\n    }\n', i0)) : '';

test('importa el módulo (con ?v=) y carga los SDK de Functions y Storage solo al pulsar el botón', () => {
  assert.match(script, /from "\.\/js\/ia-factura\.js\?v=ia2"/);
  assert.match(manejador, /await import\("https:\/\/www\.gstatic\.com\/firebasejs\/10\.7\.0\/firebase-functions\.js"\)/);
  assert.match(manejador, /await import\("https:\/\/www\.gstatic\.com\/firebasejs\/10\.7\.0\/firebase-storage\.js"\)/);
  assert.match(manejador, /httpsCallable\(getFunctions\(app, "us-central1"\), FUNCION_FACTURA\)/);
  // ningún import estático de esos SDK: si no cargan, solo falla la IA y la pantalla sigue (R6)
  assert.doesNotMatch(script, /^\s*import [^\n]*firebase-(functions|storage)\.js/m);
});

test('el bloque tiene sus controles, el aviso exacto y solo acepta PDF', () => {
  for (const id of ['iaf-bloque', 'iaf-archivo', 'iaf-fecha', 'iaf-btn', 'iaf-error', 'iaf-resultado', 'iaf-detalle', 'iaf-abrir']) {
    assert.match(html, new RegExp(`id="${id}"`), id);
  }
  assert.match(html, /<input type="file" id="iaf-archivo" accept="application\/pdf"/);
  assert.match(html, /<input type="date" id="iaf-fecha"/);
  assert.ok(html.includes(AVISO_IA), 'aviso R5');
  assert.ok(html.includes('Crear borrador con IA'));
  assert.ok(html.includes('Borradores de orden por día'), 'la sección existente sigue');
});

test('el bloque va en la pestaña «Órdenes de compra», antes de «Borradores de orden por día»', () => {
  const panel = html.indexOf('id="panel-ordenes"');
  const bloque = html.indexOf('id="iaf-bloque"');
  const borradores = html.indexOf('Borradores de orden por día');
  const proveedores = html.indexOf('id="panel-proveedores"');
  assert.ok(panel > 0 && bloque > panel && bloque < borradores && borradores < proveedores);
});

test('R13: si el borrador del día ya existe en la lista cargada, no se sube nada (existeBorrador usa docsBorradores)', () => {
  assert.match(manejador, /existeBorrador: \(f\) => docsBorradores\.some\(\(d\) => d\.id === f\)/);
});

test('el resultado se pinta con el módulo (textContent): ningún innerHTML en el manejador', () => {
  assert.match(manejador, /pintarResultado\(document, \$\("iaf-detalle"\), r\)/);
  assert.doesNotMatch(manejador, /innerHTML/);
});

test('R14: el manejador no escribe en Firestore, no emite, no toca contadores ni envía correo; solo sube el PDF a Storage', () => {
  assert.doesNotMatch(manejador, /\b(setDoc|updateDoc|addDoc|deleteDoc|runTransaction|writeBatch|emitirOrden|emitirDesdeBorrador|enviarOrden|crearBorradorDia|COLECCION_CONTADORES|escritura)\b/);
  assert.equal([...manejador.matchAll(/\buploadBytes\(/g)].length, 1);
  assert.doesNotMatch(manejador, /deleteObject|fetch\(/);
});

test('mientras responde el botón queda deshabilitado (una sola llamada) y se vuelve a habilitar siempre', () => {
  assert.match(manejador, /if \(iaFacturaEnCurso\) return/);
  assert.match(manejador, /iaFacturaEnCurso = true/);
  assert.match(manejador, /finally/);
  assert.match(manejador, /iaFacturaEnCurso = false/);
  assert.match(manejador, /\$\("iaf-btn"\)\.disabled = /);
});

test('tras crear el borrador se recarga la lista y «Abrir borrador» lo abre con el flujo de siempre', () => {
  assert.match(manejador, /await recargarBorradores\(\)/);
  assert.match(script, /\$\("iaf-abrir"\)\.addEventListener\("click", \(\) => abrirBorrador\(/);
  assert.match(manejador, /if \(r\.yaExiste\)/);
});

test('lo existente se conserva: pestañas, emitir, borradores y la única forma de escribir (transacciones)', () => {
  for (const t of ['id="tab-ordenes"', 'id="btn-emitir"', 'id="tbody-borradores"', 'Nueva orden de compra', 'ejecutarTransaccion: (fn) => runTransaction(db, fn)', 'abrirBorrador(pedido)']) {
    assert.ok(html.includes(t), t);
  }
  assert.doesNotMatch(html, /AIza[0-9A-Za-z_-]{20,}/);
});
