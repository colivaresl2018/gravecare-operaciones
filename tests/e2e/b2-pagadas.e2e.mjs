// Prueba de navegador de B-2 (N80, N192, N193) y B-1 (PRUEBA, N62) contra los EMULADORES de la web.
// Requiere, con el mismo GC_OFFSET (p. ej. 800):
//   1) emuladores Auth/Firestore/Storage de la web abiertos (proyecto demo-gravecare);
//   2) node scripts/local/sembrar-emulador.mjs
//   3) node scripts/local/servidor-emuladores.mjs
// Ejecutar:  $env:GC_OFFSET=800; npm run test:e2e
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { desplazamiento, puertos } from '../../scripts/local/puertos.mjs';
import { STAFF_PRUEBA } from '../../scripts/local/sembrar-emulador.mjs';

const P = puertos(desplazamiento());
const SITIO = `http://localhost:${P.sitio}`;
const PAGADAS_PRODUCCION = [1, 2, 3, 4, 5];
const SIN_PAGO = [6, 7, 8, 9, 10, 11]; // iniciada ×2, cancelado, rechazado, vencida, monto_inconsistente
const ONECLICK = 12, INTEGRACION = 13, SIN_MONTO = 14;

let navegador, contexto, pagina;
const externas = []; // peticiones a servicios reales de Google (no deben existir)

before(async () => {
  try { await fetch(`${SITIO}/login-ops.html`); } catch {
    throw new Error(`No responde ${SITIO}. Abre los emuladores, siembra y levanta scripts/local/servidor-emuladores.mjs con el mismo GC_OFFSET.`);
  }
  navegador = await chromium.launch();
  contexto = await navegador.newContext();
  contexto.on('request', (r) => {
    const h = new URL(r.url()).hostname;
    // Servicios de datos de Firebase/Google Analytics. Google Fonts y Maps (mapa.html) no son datos de Firebase.
    if (/^(firestore|identitytoolkit|securetoken|firebasestorage|firebaseinstallations|firebase|firebaselogging)\.googleapis\.com$|firebaseio\.com$|google-analytics\.com$|googletagmanager\.com$/.test(h)) externas.push(h);
  });
  pagina = await contexto.newPage();
  await pagina.goto(`${SITIO}/login-ops.html`);
  await pagina.fill('#opsEmail', STAFF_PRUEBA.email);
  await pagina.fill('#opsPass', STAFF_PRUEBA.password);
  await Promise.all([pagina.waitForURL(/portal\.html/, { timeout: 20000 }), pagina.locator('#opsEmail').press('Enter')]);
});

after(async () => { await navegador?.close(); });

async function textoDe(ruta, esperar) {
  await pagina.goto(`${SITIO}/${ruta}`);
  await pagina.waitForFunction((t) => document.body.innerText.includes(t), esperar, { timeout: 20000 });
  await pagina.waitForTimeout(500);
  return pagina.evaluate(() => document.body.innerText);
}

// En planificacion.html se usa la tabla de lista (#cuerpo-tabla); el Gantt (#cuerpo-gantt) no lleva insignia ni montos.
const filas = (ruta) => (ruta === 'planificacion.html' ? '#cuerpo-tabla tr' : 'tr');
const nombre = (n) => new RegExp(`Cliente Ficticio ${n}(?!\\d)`);
const difunto = (n) => new RegExp(`Difunto Ficticio ${n}(?!\\d)`);

for (const [ruta, marca] of [['ordenes.html', nombre], ['todos-los-trabajos.html', nombre], ['planificacion.html', nombre], ['mapa.html', nombre], ['mis-trabajos.html', difunto], ['clientes.html', nombre]]) {
  test(`${ruta}: muestra solo órdenes pagadas (sin iniciada, cancelado, rechazado, vencida ni monto_inconsistente)`, async () => {
    const t = await textoDe(ruta, marca === nombre ? 'Cliente Ficticio 1' : 'Difunto Ficticio 1');
    for (const n of [...PAGADAS_PRODUCCION, ONECLICK, INTEGRACION]) assert.match(t, marca(n), `debe aparecer la orden ${n}`);
    for (const n of SIN_PAGO) assert.doesNotMatch(t, marca(n), `no debe aparecer la orden sin pago ${n}`);
  });
}

for (const ruta of ['ordenes.html', 'todos-los-trabajos.html', 'planificacion.html', 'mapa.html', 'mis-trabajos.html']) {
  test(`${ruta}: la orden de integración lleva la insignia PRUEBA y las de producción no`, async () => {
    await textoDe(ruta, ruta === 'mis-trabajos.html' ? 'Difunto Ficticio 1' : 'Cliente Ficticio 1');
    const insignias = await pagina.locator('span', { hasText: /^PRUEBA$/ }).count();
    assert.ok(insignias >= 1, 'hay al menos una insignia PRUEBA');
    const filaPrueba = pagina.locator(filas(ruta), { hasText: ruta === 'mis-trabajos.html' ? difunto(INTEGRACION) : nombre(INTEGRACION) }).first();
    assert.equal(await filaPrueba.locator('span', { hasText: /^PRUEBA$/ }).count() >= 1, true);
    const filaProd = pagina.locator(filas(ruta), { hasText: ruta === 'mis-trabajos.html' ? difunto(1) : nombre(1) }).first();
    assert.equal(await filaProd.locator('span', { hasText: /^PRUEBA$/ }).count(), 0);
  });
}

test('gastos-ingresos.html: el ingreso suma solo las 5 Confirmado de producción', async () => {
  const t = await textoDe('gastos-ingresos.html', 'GC-B2-001');
  for (const n of PAGADAS_PRODUCCION) assert.match(t, new RegExp(`GC-B2-00${n}`), `ingreso de la orden ${n}`);
  for (const n of [...SIN_PAGO, ONECLICK, INTEGRACION, SIN_MONTO]) {
    assert.doesNotMatch(t, new RegExp(`GC-B2-0${String(n).padStart(2, '0')}`), `la orden ${n} no es ingreso`);
  }
});

test('planificacion.html (N192): sin monto se muestra «—» y nunca 259.960', async () => {
  const t = await textoDe('planificacion.html', 'Cliente Ficticio 1');
  assert.doesNotMatch(t, /259\.960/);
  const fila = pagina.locator(filas('planificacion.html'), { hasText: nombre(SIN_MONTO) }).first();
  assert.match(await fila.innerText(), /—/);
});

test('clientes.html (N193): «Borrar» solo muestra el aviso y no pide clave', async () => {
  await textoDe('clientes.html', 'Cliente Ficticio 1');
  const dialogos = [];
  pagina.on('dialog', async (d) => { dialogos.push({ tipo: d.type(), msg: d.message() }); await d.dismiss(); });
  await pagina.locator('button[title="Eliminar cliente con clave"]').first().click();
  await pagina.waitForTimeout(500);
  assert.equal(dialogos.length, 1);
  assert.equal(dialogos[0].tipo, 'alert');
  assert.match(dialogos[0].msg, /deshabilitado por seguridad/);
});

test('mis-trabajos.html (N62): «Reportar» lleva a informe-captura.html con ordenId y v', async () => {
  await textoDe('mis-trabajos.html', 'Difunto Ficticio 1');
  const href = await pagina.locator('a', { hasText: 'Reportar' }).first().getAttribute('href');
  assert.match(href, /^informe-captura\.html\?ordenId=b2-[a-z0-9-]+&v=\d+$/);
});

test('ninguna petición salió a servicios reales de Firebase (todo va a los emuladores)', () => {
  assert.deepEqual([...new Set(externas)], []);
});
