// Directriz B8: los montos de «Gastos e Ingresos» se ven en UNA sola fila (el «$ » no se separa de la cifra).
// Causa: formatearDinero devuelve "$ " + número con un espacio normal y las celdas no tenían white-space: nowrap.
// Solución elegida (opción A de B8): white-space: nowrap en las celdas de monto. No cambia datos, textos ni formato.
// Prueba estática. Ejecutar:  node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(RAIZ, 'public', 'gastos-ingresos.html'), 'utf8').replace(/\r\n/g, '\n');

/** Etiqueta <td ...> que abre la celda cuyo contenido empieza con la expresión dada. */
function celdaDe(expresion) {
  const i = html.indexOf(expresion);
  assert.ok(i > -1, `no se encontró ${expresion} en la página`);
  const abre = html.lastIndexOf('<td', i);
  return html.slice(abre, html.indexOf('>', abre) + 1);
}

test('B8: las celdas Neto, IVA / Ret. y Total de la tabla de movimientos no parten el monto', () => {
  for (const campo of ['m.neto', 'm.impuesto', 'm.total']) {
    assert.match(celdaDe('${formatearDinero(' + campo + ')}'), /white-space:\s*nowrap/, `la celda de ${campo} debe llevar white-space: nowrap`);
  }
});

test('B8: las celdas de Débito, Crédito y saldo del resumen mensual tampoco parten el monto', () => {
  for (const expresion of ['${formatearDinero(d.debito)}', '${formatearDinero(d.credito)}', '${saldoTxt}']) {
    assert.match(celdaDe(expresion), /white-space:\s*nowrap/, `la celda de ${expresion} debe llevar white-space: nowrap`);
  }
});

test('B8: no se tocó el formato del número ni el espacio de formatearDinero (el formulario sigue leyendo el valor)', () => {
  assert.match(html, /function formatearDinero\(num\)\s*\{\s*return "\$ " \+ /, 'formatearDinero conserva el "$ " con espacio normal (opción A)');
  assert.ok(html.includes('es-CL'), 'se conserva el formato es-CL');
});

test('B8: las celdas conservan alineación a la derecha y su color/peso', () => {
  assert.match(celdaDe('${formatearDinero(m.neto)}'), /text-align:\s*right/);
  assert.match(celdaDe('${formatearDinero(m.neto)}'), /font-weight:\s*600/);
  assert.match(celdaDe('${formatearDinero(m.total)}'), /font-weight:\s*800/);
  assert.match(celdaDe('${formatearDinero(m.impuesto)}'), /color:\s*#475569/);
});
