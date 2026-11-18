// Tras la fusión de ops-16 se perdieron dos imports: Clientes no cargaba nombre-cliente.js y Todos los Trabajos no cargaba
// estado-visita-unificado.js (la página mostraba «estadoUnificadoVisita is not defined»). Esta prueba evita que vuelva a pasar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (f) => readFileSync(join(RAIZ, 'public', f), 'utf8');

test('Todos los Trabajos importa estadoUnificadoVisita', () => {
  assert.match(leer('todos-los-trabajos.html'), /import \{ estadoUnificadoVisita \} from "\.\/js\/estado-visita-unificado\.js\?v=ops13"/);
});

test('Clientes importa las funciones de nombre-cliente.js que usa', () => {
  const h = leer('clientes.html');
  assert.match(h, /import \{[^}]*nombreClienteParaMostrar[^}]*\} from "\.\/js\/nombre-cliente\.js\?v=ops13"/);
  assert.match(h, /contratosDeOrden/);
  assert.match(h, /cargarContratos/);
});

test('los módulos importados existen en public/js', () => {
  assert.ok(readFileSync(join(RAIZ, 'public', 'js', 'estado-visita-unificado.js'), 'utf8').length > 0);
  assert.ok(readFileSync(join(RAIZ, 'public', 'js', 'nombre-cliente.js'), 'utf8').length > 0);
});
