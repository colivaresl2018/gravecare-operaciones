// Regla: un informe rechazado vuelve al MISMO operador (su visita sigue en Mis Trabajos) con estado «Rechazado»,
// el motivo a la vista y la opción de corregir y reenviar. Prueba estática sobre el código de las páginas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (f) => readFileSync(join(RAIZ, 'public', f), 'utf8');

test('Mis Trabajos usa la regla de rechazo y muestra el estado «Rechazado» en lugar de «Asignado»', () => {
  const html = leer('mis-trabajos.html');
  assert.ok(html.includes('rechazoDeVisita'), 'importa y usa rechazoDeVisita');
  assert.ok(/rechazoDeVisita\(d, numVisita, \{ docId: docSnap\.id, indiceInformes \}\)/.test(html), 'la evalúa por cada visita con el índice de informes');
  assert.ok(html.includes('item.rechazada'), 'el render distingue la visita rechazada');
  assert.ok(html.includes('Rechazado'), 'muestra la etiqueta Rechazado');
  assert.ok(html.includes('Asignado'), 'conserva la etiqueta Asignado para las demás');
});

test('Mis Trabajos muestra el motivo del rechazo en el menú de la visita (con textContent, sin HTML del usuario)', () => {
  const html = leer('mis-trabajos.html');
  assert.ok(html.includes('id="obs-rechazo"') && html.includes('id="obs-rechazo-texto"'), 'bloque del motivo en el menú');
  assert.ok(/getElementById\("obs-rechazo-texto"\)\.textContent\s*=\s*item\.motivoRechazo/.test(html), 'el motivo se inserta como texto');
});

test('la visita rechazada ofrece corregir el informe con el mismo enlace de captura', () => {
  const html = leer('mis-trabajos.html');
  assert.ok(html.includes('Corregir informe'), 'texto de la acción');
  assert.ok(html.includes('informe-captura.html?ordenId=${item.ordenDocId}&v=${item.numeroVisita}'), 'mismo enlace de captura');
});

test('la captura del informe avisa al operador por qué fue rechazado', () => {
  const html = leer('informe-captura.html');
  assert.ok(html.includes('id="avisoRechazo"') && html.includes('id="avisoRechazoMotivo"'), 'aviso con el motivo');
  assert.ok(html.includes('rechazoDeVisita(datosOrden, visitaIndex'), 'lo decide con la misma regla');
  assert.ok(/getElementById\("avisoRechazoMotivo"\)\.textContent\s*=/.test(html), 'el motivo se inserta como texto');
});

test('al reenviar, el informe corregido deja de estar rechazado (estado de informe y de visita)', () => {
  const html = leer('informe-captura.html');
  assert.ok(html.includes('estado: "pendiente_revision"'), 'el informe vuelve a revisión');
  assert.ok(html.includes('estado: "en revision"'), 'la visita vuelve a revisión');
});
