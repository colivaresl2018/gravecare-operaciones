// Órdenes de Servicio: la fecha de ejecución se elige en un calendario y se guarda por visita.
// Ejecutar: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../public/ordenes.html', import.meta.url), 'utf8').replace(/\r/g, '');

test('la celda de fecha abre el modal con el calendario', () => {
  assert.match(html, /data-id="\$\{esc\(item\.idVisitaCompleto\)\}" onclick="window\.abrirModalAsignar\(this\.dataset\.id, 'fecha'\)"/);
  assert.match(html, /window\.abrirModalAsignar = function\(idVisitaCompleto, foco\)/);
  assert.match(html, /if \(foco === "fecha"\)/);
  assert.match(html, /inputFecha\.showPicker\?\.\(\)/);
});

test('el modal tiene campo de fecha de ejecución (input date)', () => {
  assert.match(html, /<input type="date" id="modal-input-fecha"/);
});

test('guardar la fecha escribe solo la clave de la visita (fechasPorVisita), nunca el arreglo completo', () => {
  assert.match(html, /guardarFechaVisitaEnOrden\(\{/);
  assert.doesNotMatch(html, /fechasProgramadas\.push|fechasProgramadas:\s*fechas/);
});

test('ya no se inventan fechas de relleno: sin fecha guardada se muestra «Sin fecha»', () => {
  assert.doesNotMatch(html, /while \(fechasGuardadas\.length < totalVisitas\)/);
  assert.match(html, /\$\{item\.fechaEstimada \? formatearFechaChile\(item\.fechaEstimada\) : "Sin fecha"\}/);
});
