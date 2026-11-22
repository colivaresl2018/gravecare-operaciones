// Todos los Trabajos: dos menús desplegables («Ser Querido» y «Titular») que se arman con los nombres de la lista cargada
// y filtran la tabla. Prueba estática sobre public/todos-los-trabajos.html.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(RAIZ, 'public', 'todos-los-trabajos.html'), 'utf8');

test('hay un menú para Ser Querido y otro para Titular, junto a Cementerio', () => {
  assert.match(html, /<select id="filtro-ser-querido"/);
  assert.match(html, /<select id="filtro-titular"/);
  assert.match(html, /Todos los Seres Queridos/);
  assert.match(html, /Todos los Titulares/);
});

test('las opciones salen de los nombres de la lista cargada (sin duplicados, ordenadas, escapadas)', () => {
  assert.match(html, /llenarMenuNombres\("filtro-ser-querido", "Todos los Seres Queridos", listaVisitasActivas\.map\(v => v\.difunto\)\)/);
  assert.match(html, /llenarMenuNombres\("filtro-titular", "Todos los Titulares", listaVisitasActivas\.map\(v => v\.cliente\)\)/);
  assert.match(html, /new Set\(nombres\.filter\(Boolean\)\)/);
  assert.match(html, /localeCompare\(b, "es"\)/);
  assert.match(html, /<option value="\$\{esc\(n\)\}">\$\{esc\(n\)\}<\/option>/);
});

test('los menús se actualizan al cargar la lista y al completar una visita, y conservan la elección si sigue existiendo', () => {
  const llamadas = html.match(/actualizarFiltrosPersonas\(\);/g) || [];
  assert.ok(llamadas.length >= 2, 'se llama al cargar la lista y al completar una visita');
  assert.match(html, /sel\.value = lista\.includes\(previa\) \? previa : ""/);
});

test('renderizarTabla filtra por Ser Querido y por Titular además de la búsqueda y el cementerio', () => {
  assert.match(html, /const sq = document\.getElementById\("filtro-ser-querido"\)\?\.value \|\| ""/);
  assert.match(html, /const st = document\.getElementById\("filtro-titular"\)\?\.value \|\| ""/);
  assert.match(html, /if \(sq && item\.difunto !== sq\) return false;/);
  assert.match(html, /if \(st && item\.cliente !== st\) return false;/);
  assert.match(html, /getElementById\("filtro-ser-querido"\)\?\.addEventListener\("change", renderizarTabla\)/);
  assert.match(html, /getElementById\("filtro-titular"\)\?\.addEventListener\("change", renderizarTabla\)/);
});
