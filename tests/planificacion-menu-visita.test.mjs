// Planificación & Gantt: la fecha de la visita bajo el cementerio y un menú (fecha + operador) al marcar la visita.
// Prueba estática sobre el código de la página. Ejecutar: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../public/planificacion.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const gantt = html.slice(html.indexOf('function renderizarGantt('), html.indexOf('const cuerpoGantt ='));

test('la fecha de la visita va debajo del cementerio y antes del operador, en la celda izquierda del Gantt', () => {
  const iCem = gantt.indexOf('item.cementerio || "Sin cementerio"');
  const iFecha = gantt.indexOf('data-fecha-visita');
  const iOper = gantt.indexOf('<strong>Operador:</strong>');
  assert.ok(iCem > 0 && iFecha > iCem && iOper > iFecha, `orden cementerio(${iCem}) < fecha(${iFecha}) < operador(${iOper})`);
  assert.match(gantt, /Fecha: \$\{esc\(formatearFecha\(item\.proximaVisita\)\)\}/);
});

test('sin fecha programada no se escribe una fecha (queda el aviso «Sin fecha programada»)', () => {
  assert.match(gantt, /item\.proximaVisita \? `[^`]*data-fecha-visita[^`]*` : ""/);
  assert.ok(gantt.includes('Sin fecha programada'));
});

test('al marcar la visita (tarjeta o celda izquierda) se abre el menú para cambiar fecha y operador', () => {
  assert.ok(html.includes('function abrirMenuVisita('));
  assert.ok(html.includes('data-action="fila-visita"'), 'la celda izquierda también abre el menú');
  const click = html.slice(html.indexOf('cuerpoGantt?.addEventListener("click"'), html.indexOf('function cerrarModal()'));
  assert.ok(click.includes('abrirMenuVisita('), 'el clic abre el menú');
  assert.ok(click.includes("closest(\"[data-action='fila-visita']\")") || click.includes("closest(\"td[data-action='fila-visita']\")"));
});

test('el menú trae fecha y operador (modal existente) y sigue guardando solo esa visita', () => {
  assert.ok(html.includes('id="modal-input-fecha"'));
  assert.ok(html.includes('id="modal-select-operador"'));
  assert.ok(html.includes('operadoresPorVisita.${item.claveVisita}'));
  assert.ok(html.includes('construirActualizacionFecha({ clave: item.claveVisita, fecha: nuevaFecha })'));
});

test('el menú conserva la opción de mover la visita eligiendo una casilla del Gantt', () => {
  assert.ok(html.includes('id="btn-mover-en-gantt"'));
  assert.ok(html.includes('function iniciarMovimiento('));
  assert.ok(html.includes('moverTareaACasillero('));
});

test('el menú no guarda sin una fecha válida (asignar operador exige fecha)', () => {
  assert.ok(html.includes('Por favor selecciona una fecha válida.'));
});
