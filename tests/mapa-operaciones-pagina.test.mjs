// Mapa de Operaciones (mapa.html): usa el módulo compartido de ubicación y ya no tiene diccionario propio
// ni desplazamiento aleatorio. Ejecutar: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const html = readFileSync(join(PUBLIC, 'mapa.html'), 'utf8').replace(/\r/g, '');

test('importa el módulo compartido de ubicación', () => {
  assert.match(html, /from "\.\/js\/ubicacion-trabajo\.js"/);
  assert.match(html, /ubicacionDeVisita\(ord, cementerio\)/);
  assert.match(html, /agruparMarcadores\(visitas\)/);
  assert.match(html, /contenidoMarcadorOperativo\(g\)/);
});

test('ya no trae el diccionario antiguo de 8 nombres ni el desplazamiento aleatorio', () => {
  assert.doesNotMatch(html, /COORDENADAS_CEMENTERIOS/);
  assert.doesNotMatch(html, /resolverCoordenadas/);
  assert.doesNotMatch(html, /Math\.random/);
});

test('el pin se pone en la coordenada fija del cementerio o de la sepultura, sin mover la posición', () => {
  assert.match(html, /const posicion = \{ lat: g\.lat, lng: g\.lng \}/);
});

test('la ventana del pin escapa el texto y lista cada visita del lugar', () => {
  assert.match(html, /marcador\.addListener\('click'/);
  assert.match(html, /ventanaInfo\.setContent\(contenidoMarcadorOperativo\(g\)\)/);
});

test('el script en línea de la página es JavaScript válido', () => {
  const script = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
  const dir = mkdtempSync(join(tmpdir(), 'mapa-operaciones-'));
  const archivo = join(dir, 'pagina.mjs');
  try {
    writeFileSync(archivo, script);
    const r = spawnSync(process.execPath, ['--check', archivo], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
