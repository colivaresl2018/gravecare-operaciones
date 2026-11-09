// N62 (directriz B-1): el botón «Reportar» de mis-trabajos abre la pantalla real de captura con el parámetro correcto,
// y ningún enlace a una página .html apunta a un archivo inexistente (Hosting distingue mayúsculas). Ejecutar:  node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const lee = (p) => readFileSync(join(PUBLIC, p), 'utf8').replace(/\r/g, '');

test('N62: «Reportar» de mis-trabajos abre informe-captura.html con ordenId y v', () => {
  const h = lee('mis-trabajos.html');
  assert.equal(h.includes('revision-informe.html'), false, 'no apunta a la página inexistente');
  assert.ok(h.includes('href="informe-captura.html?ordenId=${item.ordenDocId}&v=${item.numeroVisita}"'));
  const captura = lee('informe-captura.html');
  assert.ok(captura.includes("urlParams.get('ordenId')"), 'la captura lee ordenId');
  assert.ok(captura.includes("urlParams.get('v')"), 'la captura lee v');
});

test('N62: todo enlace a una página .html del backoffice apunta a un archivo existente (nombre exacto)', () => {
  const paginas = new Set(readdirSync(PUBLIC).filter((n) => n.endsWith('.html')));
  const fuentes = [...paginas].map((n) => [n, lee(n)])
    .concat(readdirSync(join(PUBLIC, 'js')).filter((n) => n.endsWith('.js')).map((n) => [`js/${n}`, lee(`js/${n}`)]));
  const rotos = [];
  for (const [nombre, txt] of fuentes) {
    // Se ignoran comentarios de una línea (pueden citar páginas del repo de la web).
    const sinComentarios = txt.split('\n').filter((l) => !/^\s*(\/\/|\*|<!--)/.test(l)).join('\n');
    for (const m of sinComentarios.matchAll(/["'`(=]\.?\/?([A-Za-z0-9_-]+\.html)/g)) {
      if (!paginas.has(m[1])) rotos.push(`${nombre} → ${m[1]}`);
    }
  }
  assert.deepEqual(rotos, []);
});
