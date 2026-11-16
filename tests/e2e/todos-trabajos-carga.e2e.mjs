// Prueba de navegador: «Todos los Trabajos» nunca queda en «Cargando…» (fix/todos-trabajos-import-estado).
// Requiere, con el mismo GC_OFFSET (p. ej. 2300): emuladores Auth/Firestore/Storage de la web (proyecto demo-gravecare),
// `node scripts/local/sembrar-emulador.mjs` y `node scripts/local/servidor-emuladores.mjs`.
// Ejecutar:  $env:GC_OFFSET=2300; node --test tests/e2e/todos-trabajos-carga.e2e.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { desplazamiento, puertos } from '../../scripts/local/puertos.mjs';
import { STAFF_PRUEBA } from '../../scripts/local/sembrar-emulador.mjs';

const P = puertos(desplazamiento());
const SITIO = `http://localhost:${P.sitio}`;
let navegador, pagina;
const consola = [];

before(async () => {
  try { await fetch(`${SITIO}/login-ops.html`); } catch {
    throw new Error(`No responde ${SITIO}. Abre los emuladores, siembra y levanta scripts/local/servidor-emuladores.mjs con el mismo GC_OFFSET.`);
  }
  navegador = await chromium.launch();
  pagina = await (await navegador.newContext()).newPage();
  pagina.on('console', (m) => { if (['error', 'warning'].includes(m.type())) consola.push(`${m.type()}: ${m.text()}`); });
  pagina.on('pageerror', (e) => consola.push(`pageerror: ${e.message}`));
  await pagina.goto(`${SITIO}/login-ops.html`);
  await pagina.fill('#opsEmail', STAFF_PRUEBA.email);
  await pagina.fill('#opsPass', STAFF_PRUEBA.password);
  await Promise.all([pagina.waitForURL(/portal\.html/, { timeout: 20000 }), pagina.locator('#opsEmail').press('Enter')]);
});

after(async () => { await navegador?.close(); });

test('todos-los-trabajos.html termina de cargar y lista las visitas pendientes (sin «Cargando…» eterno)', async () => {
  await pagina.goto(`${SITIO}/todos-los-trabajos.html`);
  try {
    await pagina.waitForFunction(() => !document.body.innerText.includes('Cargando cronograma operativo de visitas'), null, { timeout: 15000 });
  } catch {
    assert.fail(`La pantalla quedó en «Cargando…». Consola: ${consola.join(' | ') || '(vacía)'}`);
  }
  const texto = await pagina.evaluate(() => document.body.innerText);
  assert.match(texto, /Mostrando \d+ visita\(s\) pendiente\(s\)/);
  assert.match(texto, /Cliente Ficticio 1(?!\d)/);
  assert.equal(consola.filter((l) => /is not defined|pageerror/.test(l)).length, 0, consola.join(' | '));
});
