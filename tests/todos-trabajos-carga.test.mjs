// «Todos los Trabajos» se quedaba en «Cargando…» para siempre (fix/todos-trabajos-import-estado).
// Causa: la página usaba estadoUnificadoVisita() sin importarla (un merge dejó solo el import de html-seguro.js), lanzaba
// ReferenceError dentro del try y el catch solo escribía en consola. Estas pruebas fijan:
//   1) ninguna página usa una función de public/js/*.js sin importarla;
//   2) todos-los-trabajos.html importa lo que usa (con ?v=ops13 como el resto de las páginas con esos módulos);
//   3) si la carga falla, la pantalla muestra un aviso con «Reintentar» y no el spinner.
// Ejecutar: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const PUBLIC = new URL('../public/', import.meta.url);
const JS = new URL('js/', PUBLIC);
const leer = (u) => readFileSync(u, 'utf8').replace(/\r\n/g, '\n');

// Nombres exportados por cada módulo local (public/js/*.js).
const exportados = new Map(); // nombre -> archivo
for (const f of readdirSync(JS).filter((n) => n.endsWith('.js'))) {
  const src = leer(new URL(f, JS));
  for (const m of src.matchAll(/^export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm)) {
    if (m[1].length >= 6) exportados.set(m[1], f);
  }
}

function modulo(html) {
  const m = /<script type="module">([\s\S]*?)<\/script>/.exec(html);
  return m ? m[1] : '';
}

test('ninguna página usa una función de public/js sin importarla (evita ReferenceError silencioso)', () => {
  const problemas = [];
  for (const pagina of readdirSync(PUBLIC).filter((n) => n.endsWith('.html'))) {
    const codigo = modulo(leer(new URL(pagina, PUBLIC)));
    if (!codigo) continue;
    const importados = new Set();
    for (const m of codigo.matchAll(/import\s*\{([^}]*)\}\s*from/g)) m[1].split(',').forEach((n) => importados.add(n.trim().split(/\s+as\s+/).pop()));
    const sinImports = codigo.replace(/^\s*import\b[^\n]*$/gm, '');
    for (const [nombre, archivo] of exportados) {
      if (!new RegExp(String.raw`(?<![\w$.])${nombre}\s*\(`).test(sinImports)) continue; // no se llama en la página
      if (new RegExp(String.raw`(?:function|const|let|var)\s+${nombre}\b`).test(sinImports)) continue; // la declara la propia página
      if (!importados.has(nombre)) problemas.push(`${pagina}: usa ${nombre}() de js/${archivo} y no la importa`);
    }
  }
  assert.deepEqual(problemas, []);
});

const todos = leer(new URL('todos-los-trabajos.html', PUBLIC));

test('todos-los-trabajos.html importa estadoUnificadoVisita con la versión de caché ops13', () => {
  assert.match(todos, /import\s*\{[^}]*\bestadoUnificadoVisita\b[^}]*\}\s*from\s*"\.\/js\/estado-visita-unificado\.js\?v=ops13"/);
  assert.match(todos, /from "\.\/js\/servicio-terminado\.js\?v=ops13"/);
  assert.match(todos, /from "\.\/js\/nombre-cliente\.js\?v=ops13"/);
  assert.match(todos, /import \{ esc \} from "\.\/js\/html-seguro\.js"/, 'conserva el escape de AUD-01');
});

test('si la carga falla, todos-los-trabajos.html muestra un aviso con «Reintentar» en vez de «Cargando…»', () => {
  assert.ok(todos.includes('function mostrarErrorCarga()'));
  const catchCarga = /console\.error\("Error al cargar trabajos:", err\);\s*mostrarErrorCarga\(\);/;
  assert.match(todos, catchCarga);
  assert.ok(todos.includes('btn-reintentar-carga'));
  assert.ok(todos.includes('No se pudieron cargar los trabajos'));
});

test('si la carga falla, el contador deja de decir «Cargando…» (queda «Error al cargar»)', () => {
  const fn = /function mostrarErrorCarga\(\) \{([\s\S]*?)\n    \}\n/.exec(todos);
  assert.ok(fn, 'existe mostrarErrorCarga');
  assert.ok(fn[1].includes('Error al cargar'));
});
