// Planificación & Gantt: cada visita muestra su fecha en la columna del cliente y se puede cambiar con un botón,
// sin depender de encontrar la tarjeta dentro de los días visibles del cronograma.
// Ejecutar: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../public/planificacion.html', import.meta.url), 'utf8').replace(/\r/g, '');

test('la columna del cliente muestra la fecha de la visita con formato local', () => {
  assert.match(html, /<strong>Fecha:<\/strong> \$\{esc\(formatearFecha\(item\.proximaVisita\)\)\}/);
});

test('hay un botón «Cambiar fecha» por visita, con el identificador de la visita', () => {
  assert.match(html, /data-action="editar-fecha" data-sub-id="\$\{esc\(item\.subId\)\}"/);
  assert.match(html, /\$\{item\.proximaVisita \? "Cambiar fecha" : "Asignar fecha"\}/);
});

test('el botón abre el mismo modal de reprogramación que el doble clic', () => {
  assert.match(html, /function abrirModalReprogramar\(item, fechaOrigen\)/);
  // el doble clic y el botón usan la misma función
  const usos = html.match(/abrirModalReprogramar\(/g) || [];
  assert.ok(usos.length >= 3, `se esperaba la definición y dos usos, hay ${usos.length}`);
  assert.match(html, /closest\("button\[data-action='editar-fecha'\]"\)/);
});

test('el botón no dispara además la selección de la tarjeta amarilla (atiende primero y termina)', () => {
  const i = html.indexOf('closest("button[data-action=\'editar-fecha\']")');
  const j = html.indexOf('closest("div[data-action=\'tarjeta-amarilla\']")');
  assert.ok(i > 0 && j > 0 && i < j, 'el botón debe atenderse antes que la tarjeta');
});

test('el modal y su guardado no cambian: sigue guardando solo la clave de la visita', () => {
  assert.match(html, /construirActualizacionFecha\(\{ clave: item\.claveVisita, fecha: nuevaFecha \}\)/);
  assert.match(html, /<input type="date" id="modal-input-fecha"/);
});
