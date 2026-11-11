// Mapa de «Mis Trabajos»: la página usa el módulo de ubicación (sin diccionario propio) y avisa cuando no hay mapa.
// Ejecutar: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const html = readFileSync(join(PUBLIC, 'mis-trabajos.html'), 'utf8').replace(/\r/g, '');

test('usa el módulo ubicacion-trabajo.js y ya no trae un diccionario de cementerios propio', () => {
  assert.match(html, /from "\.\/js\/ubicacion-trabajo\.js"/);
  assert.doesNotMatch(html, /const CEMENTERIOS_COORDS\s*=/);
  assert.match(html, /ubicacion: ubicacionDeVisita\(d, cem\)/);
});

test('no entrega a Google Maps coordenadas crudas de la orden (formato {latitude, longitude} rompía el pin)', () => {
  assert.doesNotMatch(html, /v\.coordenadas/);
  assert.doesNotMatch(html, /coordenadas:\s*d\.ubicacionSepultura/);
});

test('el pin muestra orden, difunto y cementerio al tocarlo', () => {
  assert.match(html, /marker\.addListener\("click"/);
  assert.match(html, /contenidoMarcador\(g\)/);
  assert.match(html, /title: tituloMarcador\(g\)/);
});

test('hay aviso en español bajo el mapa y se muestra también si Google Maps no carga', () => {
  assert.match(html, /id="aviso-mapa"/);
  assert.match(html, /scriptMap\.onerror = avisarErrorMapa/);
  assert.match(html, /window\.gm_authFailure = avisarErrorMapa/);
  assert.match(html, /No se pudo cargar Google Maps/);
});

test('el aviso se actualiza aunque el mapa de Google aún no exista', () => {
  const i = html.indexOf('function actualizarMarcadoresMapa()');
  const cuerpo = html.slice(i, html.indexOf('if (!mapaInstancia', i));
  assert.match(cuerpo, /actualizarAvisoMapa\(\)/);
});

test('el script en línea de la página es JavaScript válido', () => {
  const script = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
  const dir = mkdtempSync(join(tmpdir(), 'mis-trabajos-'));
  const archivo = join(dir, 'pagina.mjs');
  try {
    writeFileSync(archivo, script);
    const r = spawnSync(process.execPath, ['--check', archivo], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
