// Prueba de navegador de B-3 (notas de crédito en «Gastos e ingresos») contra los EMULADORES (proyecto demo-gravecare).
// Requiere, con el mismo GC_OFFSET (usa uno propio, p. ej. 1300; nunca 0):
//   1) emuladores Auth/Firestore/Storage abiertos con ese desplazamiento, con las reglas de la web MÁS la regla aditiva de
//      notasCredito (docs/entregas/reglas-notasCredito.md);
//   2) node scripts/local/sembrar-emulador.mjs
//   3) node scripts/local/servidor-emuladores.mjs
// Ejecutar:  $env:GC_OFFSET=1300; npm run test:e2e:b3
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { desplazamiento, proyectoEmulador, puertos } from '../../scripts/local/puertos.mjs';
import { STAFF_PRUEBA } from '../../scripts/local/sembrar-emulador.mjs';

const OFF = desplazamiento();
assert.ok(OFF > 0, 'Usa un GC_OFFSET propio (> 0): nunca los puertos por defecto del dueño.');
const P = puertos(OFF);
const PROYECTO = proyectoEmulador();
const SITIO = `http://localhost:${P.sitio}`;
const FS = `http://127.0.0.1:${P.firestore}/v1/projects/${PROYECTO}/databases/(default)/documents`;
const OWNER = { authorization: 'Bearer owner', 'content-type': 'application/json' };

let navegador, contexto, pagina;
const externas = [];
const dialogos = [];

const dinero = (t) => { const n = Number(String(t).replace(/[^\d]/g, '')); return /-/.test(t) ? -n : n; };
const iso = (ddmmyyyy) => ddmmyyyy.split('-').reverse().join('-');

async function limpiarNotas() {
  const r = await fetch(`${FS}/notasCredito?pageSize=300`, { headers: OWNER });
  const j = await r.json();
  for (const d of j.documents || []) await fetch(`http://127.0.0.1:${P.firestore}/v1/${d.name}`, { method: 'DELETE', headers: OWNER });
}

before(async () => {
  try { await fetch(`${SITIO}/login-ops.html`); } catch {
    throw new Error(`No responde ${SITIO}. Abre los emuladores, siembra y levanta scripts/local/servidor-emuladores.mjs con el mismo GC_OFFSET.`);
  }
  await limpiarNotas(); // repetible: parte sin notas
  navegador = await chromium.launch();
  contexto = await navegador.newContext();
  contexto.on('request', (r) => {
    const h = new URL(r.url()).hostname;
    if (/^(firestore|identitytoolkit|securetoken|firebasestorage|firebaseinstallations|firebase|firebaselogging)\.googleapis\.com$|firebaseio\.com$|google-analytics\.com$|googletagmanager\.com$/.test(h)) externas.push(h);
  });
  pagina = await contexto.newPage();
  pagina.on('dialog', async (d) => { dialogos.push(d.message()); await d.accept(); });
  await pagina.goto(`${SITIO}/login-ops.html`);
  await pagina.fill('#opsEmail', STAFF_PRUEBA.email);
  await pagina.fill('#opsPass', STAFF_PRUEBA.password);
  await Promise.all([pagina.waitForURL(/portal\.html/, { timeout: 20000 }), pagina.locator('#opsEmail').press('Enter')]);
});

after(async () => { await navegador?.close(); });

async function abrirLibro() {
  await pagina.goto(`${SITIO}/gastos-ingresos.html`);
  await pagina.waitForFunction(() => document.body.innerText.includes('GC-B2-001'), null, { timeout: 20000 });
  await pagina.waitForTimeout(400);
}
const fila = (folio) => pagina.locator('#tabla-movimientos tr', { hasText: `Folio: #${folio}` }); // la fila de la boleta (la nota solo la cita como «Ref. boleta»)
const filasDeNota = () => pagina.locator('#tabla-movimientos tr', { hasText: 'Nota de Crédito Electrónica' });

async function seleccionarMesDeBoleta(fechaDdMmYyyy) {
  const [d, m, a] = fechaDdMmYyyy.split('-');
  await pagina.selectOption('#periodo-tributario-mes', String(Number(m) - 1));
  await pagina.selectOption('#periodo-tributario-anio', a);
}
async function debitoMes() {
  const t = await pagina.locator('#detalle-sub-iva').innerText();
  return dinero(t.match(/Débito:\s*(\$\s*-?[\d.]+)/)[1]);
}
const ingresoNetoTotal = async () => dinero(await pagina.locator('#resumen-ingresos-neto').innerText());

async function llenarNota({ folio, medio = 'Reversa Transbank', motivo = 'Devolución por término anticipado del servicio' }) {
  await pagina.fill('#form-folio', folio);
  await pagina.selectOption('#form-nc-medio', medio);
  await pagina.fill('#form-nc-motivo', motivo);
}
async function guardar() {
  dialogos.length = 0;
  await pagina.locator('#btn-guardar').click();
  await pagina.waitForFunction(() => !document.getElementById('btn-guardar').disabled, null, { timeout: 20000 });
  await pagina.waitForTimeout(300);
  return dialogos.at(-1) || '';
}

test('criterio B-3: boleta de la orden 1 + nota por el 100 % ⇒ el ingreso neto y el débito del mes bajan exactamente lo que aportaba la boleta', async () => {
  await abrirLibro();
  const filaBoleta = fila('GC-B2-001');
  assert.equal(await filaBoleta.locator('button[data-nc-id]').count(), 1, 'la fila de la boleta tiene «Registrar nota de crédito»');
  assert.match(await filaBoleta.innerText(), /Registrar nota de crédito/);
  // las filas de gastos / otros tipos no la tienen
  assert.equal(await pagina.locator('#tabla-movimientos button[data-nc-id]').count(), 5, 'solo las 5 boletas pagadas');

  await filaBoleta.locator('button[data-nc-id]').click();
  // pre-llena la referencia
  assert.equal(await pagina.inputValue('#form-dte'), 'Nota de Crédito Electrónica');
  assert.equal(await pagina.inputValue('#form-nc-folio-boleta'), 'GC-B2-001');
  const fechaBoleta = await pagina.inputValue('#form-nc-fecha-boleta');
  assert.match(fechaBoleta, /^\d{2}-\d{2}-\d{4}$/);
  assert.equal(await pagina.inputValue('#form-nc-codigo'), '1');
  assert.equal(await pagina.inputValue('#form-total'), '$ 100.000');
  assert.equal(await pagina.isVisible('#bloque-nota-credito'), true);

  await seleccionarMesDeBoleta(fechaBoleta);
  const debitoAntes = await debitoMes();
  const ingresoAntes = await ingresoNetoTotal();

  await pagina.fill('#form-fecha', iso(fechaBoleta)); // misma fecha de la boleta: queda en el mismo mes
  await llenarNota({ folio: '9001' });
  const mensaje = await guardar();
  assert.match(mensaje, /Nota de crédito registrada/);

  await pagina.waitForFunction(() => document.body.innerText.includes('Nota de Crédito Electrónica'), null, { timeout: 20000 });
  await seleccionarMesDeBoleta(fechaBoleta);
  assert.equal(await debitoMes(), debitoAntes - 15966, 'el débito del mes baja el IVA de la boleta (100.000 / 1,19 → IVA 15.966)');
  assert.equal(await ingresoNetoTotal(), ingresoAntes - 84034, 'el ingreso neto baja el neto de la boleta');
  // dos filas visibles: la boleta se mantiene y la nota la compensa
  assert.equal(await fila('GC-B2-001').count() >= 1, true);
  const nota = filasDeNota().first();
  const t = await nota.innerText();
  assert.match(t, /Folio: #9001/);
  assert.match(t, /Ref\. boleta #GC-B2-001/);
  assert.match(t, /Cód. 1/);
  assert.match(t, /Reversa Transbank/);
  assert.match(t, /-100\.000/);
  // la nota no se edita ni se elimina, y la boleta compensada ya no ofrece otra nota
  assert.equal(await nota.locator('button').count(), 0);
  assert.equal(await pagina.locator('#tabla-movimientos tr', { hasText: 'Folio: #GC-B2-001' }).locator('button[data-nc-id]').count(), 0);
  assert.equal(await pagina.locator('#tabla-movimientos button[data-nc-id]').count(), 4);
});

test('una nota sin boleta de referencia no se guarda', async () => {
  await abrirLibro();
  const antes = await filasDeNota().count();
  await pagina.selectOption('#form-dte', 'Nota de Crédito Electrónica');
  await pagina.fill('#form-rut', '11.111.111-1');
  await pagina.fill('#form-concepto', 'Cliente Ficticio');
  await pagina.fill('#form-monto-neto', '50000');
  await pagina.selectOption('#form-nc-codigo', '3');
  await llenarNota({ folio: '9002' });
  const mensaje = await guardar();
  assert.match(mensaje, /boleta de referencia/i);
  await abrirLibro();
  assert.equal(await filasDeNota().count(), antes);
});

test('una nota mayor que la boleta no se guarda; las parciales sí, hasta que la SUMA llega al bruto', async () => {
  await abrirLibro();
  const antes = await filasDeNota().count();
  // orden 3 (300.000): nota por más que la boleta
  await fila('GC-B2-003').locator('button[data-nc-id]').click();
  await pagina.selectOption('#form-nc-codigo', '3');
  await pagina.fill('#form-monto-neto', '300000'); // + IVA 19 % = 357.000 > 300.000
  await llenarNota({ folio: '9003' });
  assert.match(await guardar(), /supera su monto bruto/);

  // orden 2 (200.000): parcial de 150.000 → se guarda
  await abrirLibro();
  await fila('GC-B2-002').locator('button[data-nc-id]').click();
  await pagina.selectOption('#form-nc-codigo', '3');
  await pagina.fill('#form-monto-neto', '126050'); // + IVA = 150.000
  assert.equal(await pagina.inputValue('#form-total'), '$ 150.000');
  await pagina.fill('#form-nc-visitas-contratadas', '12');
  await pagina.fill('#form-nc-visitas-ejecutadas', '3');
  await llenarNota({ folio: '9004', motivo: 'Devolución proporcional por 9 visitas no realizadas del Plan Anual' });
  assert.match(await guardar(), /Nota de crédito registrada/);

  // segunda parcial que haría superar la boleta (150.000 + 60.000 > 200.000) → no se guarda
  await abrirLibro();
  assert.match(await fila('GC-B2-002').innerText(), /saldo \$ 50\.000/);
  await fila('GC-B2-002').locator('button[data-nc-id]').click();
  assert.equal(await pagina.inputValue('#form-nc-codigo'), '3', 'con notas previas la compensación del saldo es «corrige montos»');
  assert.equal(await pagina.inputValue('#form-total'), '$ 50.000', 'propone el saldo');
  await pagina.fill('#form-monto-neto', '50420'); // + IVA = 60.000
  await llenarNota({ folio: '9005' });
  assert.match(await guardar(), /supera su monto bruto: quedan \$ 50\.000/);

  // y exactamente el saldo sí
  await abrirLibro();
  await fila('GC-B2-002').locator('button[data-nc-id]').click();
  await llenarNota({ folio: '9006' });
  assert.match(await guardar(), /Nota de crédito registrada/);
  await abrirLibro();
  assert.equal(await fila('GC-B2-002').locator('button[data-nc-id]').count(), 0, 'boleta totalmente compensada');
  assert.equal(await filasDeNota().count(), antes + 2);
});

test('avisos NO bloqueantes: más de 6 meses entre la boleta y la nota, y más de 30 días desde el término del servicio; igual se guarda', async () => {
  await abrirLibro();
  await fila('GC-B2-004').locator('button[data-nc-id]').click();
  const fechaBoleta = await pagina.inputValue('#form-nc-fecha-boleta');
  assert.equal(await pagina.isVisible('#nc-avisos'), false, 'sin aviso con la fecha de hoy');
  const [d, m, a] = fechaBoleta.split('-').map(Number);
  const lejana = new Date(a, m - 1 + 7, d); // 7 meses después
  const lejanaIso = `${lejana.getFullYear()}-${String(lejana.getMonth() + 1).padStart(2, '0')}-${String(lejana.getDate()).padStart(2, '0')}`;
  await pagina.fill('#form-fecha', lejanaIso);
  assert.equal(await pagina.isVisible('#nc-avisos'), true);
  assert.match(await pagina.locator('#nc-avisos').innerText(), /más de 6 meses.*IVA podría no ser recuperable/s);
  assert.doesNotMatch(await pagina.locator('#nc-avisos').innerText(), /30 días/);
  const termino = new Date(lejana.getTime() - 40 * 86400000);
  await pagina.fill('#form-nc-termino', `${termino.getFullYear()}-${String(termino.getMonth() + 1).padStart(2, '0')}-${String(termino.getDate()).padStart(2, '0')}`);
  assert.match(await pagina.locator('#nc-avisos').innerText(), /más de 30 días desde el término del servicio/);
  await llenarNota({ folio: '9007', medio: 'Transferencia bancaria' });
  assert.match(await guardar(), /Nota de crédito registrada/, 'los avisos no impiden guardar');
  await abrirLibro();
  assert.match(await filasDeNota().filter({ hasText: '#9007' }).innerText(), /Transferencia bancaria/);
});

test('reglas (propuesta aditiva): el staff crea notas, pero nadie las actualiza ni las borra; sin claim no se lee', async () => {
  const auth = `http://127.0.0.1:${P.auth}/identitytoolkit.googleapis.com/v1`;
  const { idToken } = await (await fetch(`${auth}/accounts:signInWithPassword?key=demo-api-key-local`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: STAFF_PRUEBA.email, password: STAFF_PRUEBA.password, returnSecureToken: true }) })).json();
  const H = { authorization: `Bearer ${idToken}`, 'content-type': 'application/json' };
  const doc = { fields: { folio: { stringValue: 'regla-1' }, montoBruto: { integerValue: '1' } } };
  const crear = await fetch(`${FS}/notasCredito?documentId=regla-1`, { method: 'POST', headers: H, body: JSON.stringify(doc) });
  assert.equal(crear.status, 200, 'staff crea');
  const act = await fetch(`${FS}/notasCredito/regla-1?updateMask.fieldPaths=montoBruto`, { method: 'PATCH', headers: H, body: JSON.stringify({ fields: { montoBruto: { integerValue: '2' } } }) });
  assert.equal(act.status, 403, 'nadie actualiza');
  const del = await fetch(`${FS}/notasCredito/regla-1`, { method: 'DELETE', headers: H });
  assert.equal(del.status, 403, 'nadie borra');
  const sinSesion = await fetch(`${FS}/notasCredito/regla-1`);
  assert.equal(sinSesion.status, 403, 'sin sesión no lee');
  await fetch(`${FS}/notasCredito/regla-1`, { method: 'DELETE', headers: OWNER }); // limpieza con el token del emulador
});

test('las listas de trabajo no cambian: ordenes.html sigue mostrando las órdenes pagadas (con sus notas guardadas)', async () => {
  await pagina.goto(`${SITIO}/ordenes.html`);
  await pagina.waitForFunction(() => document.body.innerText.includes('Cliente Ficticio 1'), null, { timeout: 20000 });
  const t = await pagina.evaluate(() => document.body.innerText);
  for (const n of [1, 2, 3, 4, 5]) assert.match(t, new RegExp(`Cliente Ficticio ${n}(?!\\d)`));
  assert.doesNotMatch(t, /Nota de Crédito/);
});

test('ninguna petición salió a servicios reales de Firebase (todo va a los emuladores)', () => {
  assert.deepEqual([...new Set(externas)], []);
});
