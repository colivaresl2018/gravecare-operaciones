// Mis Trabajos: el contador posicional visitasCompletadas ya no oculta visitas (la V1 de una orden con dato antiguo debe verse).
// Ejecutar: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const html = readFileSync(join(PUBLIC, 'mis-trabajos.html'), 'utf8').replace(/\r/g, '');

test('no lee ni usa el contador posicional visitasCompletadas para ocultar visitas', () => {
  assert.doesNotMatch(html, /visitasCompletadasCount/);
  assert.doesNotMatch(html, /idx\s*<\s*visitas/);
  assert.doesNotMatch(html, /d\.visitasCompletadas/);
});

test('sigue ocultando solo las visitas con su estado propio de finalizada', () => {
  assert.match(html, /if \(esEstadoCompletada\(\(d\.estadosPorVisita \|\| \{\}\)\[claveVisita\]\)\) continue;/);
});
