// N83 (directriz B-2): el backoffice NUNCA publica reglas de Firestore, Storage ni Realtime Database.
// La fuente única de las reglas es el repo de la web (gravecare). Este repo solo publica Hosting del sitio gravecare-ops.
// Prueba estática. Ejecutar:  node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(join(RAIZ, 'firebase.json'), 'utf8'));

test('firebase.json no declara firestore, storage ni database (no se pueden publicar reglas desde aquí)', () => {
  for (const clave of ['firestore', 'storage', 'database']) {
    assert.equal(clave in config, false, `firebase.json no debe contener «${clave}»`);
  }
});

test('firebase.json solo declara hosting', () => {
  assert.deepEqual(Object.keys(config), ['hosting']);
});

test('el único destino de Hosting es el sitio gravecare-ops', () => {
  const sitios = [].concat(config.hosting);
  assert.equal(sitios.length, 1);
  assert.equal(sitios[0].site, 'gravecare-ops');
  assert.equal(sitios[0].public, 'public');
});

test('no hay archivos de reglas en la raíz del repo', () => {
  for (const archivo of ['firestore.rules', 'storage.rules', 'database.rules.json']) {
    assert.equal(existsSync(join(RAIZ, archivo)), false, `${archivo} no debe estar en la raíz`);
  }
  const reglasSueltas = readdirSync(RAIZ).filter((n) => /\.rules$/i.test(n));
  assert.deepEqual(reglasSueltas, []);
});

test('.firebaserc no tiene proyecto por defecto (la CLI exige --project)', () => {
  const rc = JSON.parse(readFileSync(join(RAIZ, '.firebaserc'), 'utf8'));
  assert.equal('default' in (rc.projects || {}), false);
});
