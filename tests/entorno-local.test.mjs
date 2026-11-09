// Entorno local del backoffice (directriz B-1): el servidor solo conecta a emuladores «demo-*» en 127.0.0.1 y no toca public/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { proyectoEmulador, puertos, desplazamiento } from '../scripts/local/puertos.mjs';
import { envoltorio, reescribirSdk } from '../scripts/local/servidor-emuladores.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

test('el proyecto del emulador debe ser «demo-*» (nunca un proyecto real)', () => {
  assert.equal(proyectoEmulador({}), 'demo-gravecare');
  assert.equal(proyectoEmulador({ GC_PROYECTO_EMULADOR: 'demo-otro' }), 'demo-otro');
  for (const real of ['gravecare-2e8d2', 'gravecare-qa', 'demo', 'DEMO-x']) {
    assert.throws(() => proyectoEmulador({ GC_PROYECTO_EMULADOR: real }), /demo-/);
  }
});

test('los puertos se desplazan con GC_OFFSET y el sitio no usa puertos por defecto de la web', () => {
  assert.deepEqual(puertos(800), { sitio: 5850, firestore: 8880, auth: 9899, storage: 9999 });
  const porDefectoWeb = [5000, 4000, 4400, 4500, 8080, 9099, 9199, 5001];
  assert.equal(porDefectoWeb.includes(puertos(0).sitio), false);
  assert.throws(() => desplazamiento({ GC_OFFSET: '-1' }));
  assert.throws(() => desplazamiento({ GC_OFFSET: 'abc' }));
});

test('reescribe solo los módulos del SDK de gstatic hacia los envoltorios locales', () => {
  const html = '<script type="module">import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js"; import x from "https://cdn.tailwindcss.com";</script>';
  const r = reescribirSdk(html);
  assert.ok(r.includes('"/__emuladores__/10.7.0/firebase-auth.js"'));
  assert.ok(r.includes('https://cdn.tailwindcss.com'));
});

test('los envoltorios conectan a 127.0.0.1 con el proyecto demo y sin measurementId', () => {
  const p = puertos(800);
  const app = envoltorio('10.7.0', 'app', { proyecto: 'demo-gravecare', p });
  assert.match(app, /projectId: "demo-gravecare"/);
  assert.match(app, /delete local\.measurementId/);
  assert.match(envoltorio('10.7.0', 'auth', { proyecto: 'demo-gravecare', p }), /connectAuthEmulator\(a, "http:\/\/127\.0\.0\.1:9899"/);
  assert.match(envoltorio('10.7.0', 'firestore', { proyecto: 'demo-gravecare', p }), /connectFirestoreEmulator\(db, "127\.0\.0\.1", 8880\)/);
  assert.match(envoltorio('10.12.0', 'storage', { proyecto: 'demo-gravecare', p }), /connectStorageEmulator\(s, "127\.0\.0\.1", 9999\)/);
  assert.doesNotMatch(envoltorio('10.12.0', 'analytics', { proyecto: 'demo-gravecare', p }), /gstatic/);
});

test('el entorno local vive fuera de public/ (no se publica en Hosting)', () => {
  const config = JSON.parse(readFileSync(join(RAIZ, 'firebase.json'), 'utf8'));
  assert.equal(config.hosting.public, 'public');
  const servidor = readFileSync(join(RAIZ, 'scripts', 'local', 'servidor-emuladores.mjs'), 'utf8');
  assert.match(servidor, /listen\(P\.sitio, '127\.0\.0\.1'/);
});
