// Prueba de navegador: Planificación & Gantt muestra la fecha bajo el cementerio y, al marcar la visita, abre el menú
// para cambiar fecha y operador (guarda solo esa visita). Solo emuladores (proyecto demo-*).
// Requiere, con el mismo GC_OFFSET (p. ej. 2300): emuladores de la web, `node scripts/local/sembrar-emulador.mjs` y
// `node scripts/local/servidor-emuladores.mjs`.   Ejecutar:  $env:GC_OFFSET=2300; node --test tests/e2e/planificacion-menu-visita.e2e.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { desplazamiento, proyectoEmulador, puertos } from '../../scripts/local/puertos.mjs';
import { STAFF_PRUEBA } from '../../scripts/local/sembrar-emulador.mjs';

const P = puertos(desplazamiento());
const SITIO = `http://localhost:${P.sitio}`;
const FS = `http://127.0.0.1:${P.firestore}/v1/projects/${proyectoEmulador()}/databases/(default)/documents`;
const OWNER = { authorization: 'Bearer owner', 'content-type': 'application/json' };
const OPERADOR = 'Operador Prueba Menu';
let navegador, pagina;

before(async () => {
  // Operador de prueba en el emulador (la página lee la colección staff para llenar el menú).
  const r = await fetch(`${FS}/staff/op-prueba-menu`, { method: 'PATCH', headers: OWNER, body: JSON.stringify({ fields: { nombre: { stringValue: OPERADOR }, activo: { booleanValue: true } } }) });
  assert.ok(r.ok, 'se pudo crear el operador de prueba en el emulador');
  navegador = await chromium.launch();
  pagina = await (await navegador.newContext()).newPage();
  await pagina.goto(`${SITIO}/login-ops.html`);
  await pagina.fill('#opsEmail', STAFF_PRUEBA.email);
  await pagina.fill('#opsPass', STAFF_PRUEBA.password);
  await Promise.all([pagina.waitForURL(/portal\.html/, { timeout: 20000 }), pagina.locator('#opsEmail').press('Enter')]);
});

after(async () => { await navegador?.close(); });

test('la fecha va bajo el cementerio y el clic en la visita abre el menú; guardar cambia fecha y operador de esa visita', async () => {
  await pagina.goto(`${SITIO}/planificacion.html`);
  const celda = pagina.locator("#cuerpo-gantt td[data-action='fila-visita']", { hasText: /Cliente Ficticio 1(?!\d)/ }).first();
  await celda.waitFor({ timeout: 20000 });

  // Fecha debajo del cementerio (orden de las líneas de la celda).
  const lineas = (await celda.innerText()).split('\n').map((l) => l.trim()).filter(Boolean);
  const iFecha = lineas.findIndex((l) => /Fecha: \d{2}[/-]\d{2}[/-]\d{4}/.test(l));
  const iCem = lineas.findIndex((l) => /Plan|Sin cementerio|·/.test(l));
  assert.ok(iFecha > iCem && iCem >= 0, `la fecha va después de la línea del cementerio: ${JSON.stringify(lineas)}`);

  // Clic → menú con fecha y operador.
  await celda.click();
  const modal = pagina.locator('#modal-reprogramar');
  await modal.waitFor({ state: 'visible' });
  await pagina.waitForFunction((op) => [...document.querySelectorAll('#modal-select-operador option')].some((o) => o.value === op), OPERADOR);
  await pagina.fill('#modal-input-fecha', '2026-12-15');
  await pagina.selectOption('#modal-select-operador', OPERADOR);
  await pagina.click('#btn-guardar-modal');
  await modal.waitFor({ state: 'hidden' });

  const texto = await celda.innerText();
  assert.match(texto, /Fecha: 15[/-]12[/-]2026/);
  assert.match(texto, new RegExp(String.raw`Operador:\s*${OPERADOR}`));

  // Firestore: solo esa visita (V1) recibió operador y fecha.
  const doc = await (await fetch(`${FS}/ordenes/b2-pagada-1`, { headers: OWNER })).json();
  const ops = doc.fields?.operadoresPorVisita?.mapValue?.fields || {};
  assert.deepEqual(Object.keys(ops), ['V1']);
  assert.equal(ops.V1.stringValue, OPERADOR);
});

test('«Mover eligiendo una casilla» cierra el menú y deja la visita marcada para elegir el día', async () => {
  await pagina.goto(`${SITIO}/planificacion.html`);
  const celda = pagina.locator("#cuerpo-gantt td[data-action='fila-visita']", { hasText: /Cliente Ficticio 1(?!\d)/ }).first();
  await celda.waitFor({ timeout: 20000 });
  await celda.click();
  await pagina.locator('#modal-reprogramar').waitFor({ state: 'visible' });
  await pagina.click('#btn-mover-en-gantt');
  await pagina.locator('#modal-reprogramar').waitFor({ state: 'hidden' });
  await pagina.locator('#barra-aviso-movimiento').waitFor({ state: 'visible' });
  assert.match(await pagina.locator('#texto-aviso-movimiento').innerText(), /Moviendo .* Haz clic en la casilla del nuevo día/);
});
