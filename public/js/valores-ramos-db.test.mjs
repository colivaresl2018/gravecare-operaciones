import test from 'node:test';
import assert from 'node:assert/strict';
import { RUTA_VALORES, leerValoresRamos, guardarValoresRamos } from './valores-ramos-db.js';

const AHORA = new Date('2026-11-22T15:30:00.000Z');
const REF = { ruta: 'valores_ramos/compra' };
const referencia = () => REF;

test('RUTA_VALORES: colección valores_ramos, documento compra (spec 056 R5)', () => {
  assert.deepEqual(RUTA_VALORES, ['valores_ramos', 'compra']);
});

test('leerValoresRamos: documento existente → valores normalizados, quién y cuándo', async () => {
  const r = await leerValoresRamos({
    referencia,
    obtener: async (ref) => {
      assert.equal(ref, REF);
      return { exists: () => true, data: () => ({ standard: 10000, premium: '15.000', deluxe: null, adicionalStandard: 8000, basura: 1, actualizadoEn: '2026-11-20T10:00:00.000Z', actualizadoPor: 'uid-1' }) };
    },
  });
  assert.equal(r.existe, true);
  assert.deepEqual(r.valores, { standard: 10000, premium: 15000, deluxe: null, adicionalStandard: 8000, adicionalPremium: null });
  assert.equal(r.actualizadoEn, '2026-11-20T10:00:00.000Z');
  assert.equal(r.actualizadoPor, 'uid-1');
});

test('leerValoresRamos: si el documento no existe, todo queda sin valor (no se inventa nada)', async () => {
  const r = await leerValoresRamos({ referencia, obtener: async () => ({ exists: () => false, data: () => undefined }) });
  assert.equal(r.existe, false);
  assert.deepEqual(r.valores, { standard: null, premium: null, deluxe: null, adicionalStandard: null, adicionalPremium: null });
  assert.equal(r.actualizadoEn, '');
});

test('leerValoresRamos: un error de lectura se propaga (la pantalla lo avisa)', async () => {
  await assert.rejects(leerValoresRamos({ referencia, obtener: async () => { throw Object.assign(new Error('x'), { code: 'permission-denied' }); } }), /x/);
});

test('guardarValoresRamos: escribe solo los 5 valores + actualizadoEn y actualizadoPor, en el documento compra y con merge', async () => {
  const llamadas = [];
  const escrito = await guardarValoresRamos({
    guardar: async (ref, datos, opciones) => { llamadas.push({ ref, datos, opciones }); },
    referencia, uid: 'uid-9', ahora: AHORA,
    valores: { standard: '10.000', premium: 15000, deluxe: '25000', adicionalStandard: '8.000', adicionalPremium: 12000 },
  });
  assert.equal(llamadas.length, 1);
  assert.equal(llamadas[0].ref, REF);
  assert.deepEqual(llamadas[0].opciones, { merge: true });
  assert.deepEqual(llamadas[0].datos, {
    standard: 10000, premium: 15000, deluxe: 25000, adicionalStandard: 8000, adicionalPremium: 12000,
    actualizadoEn: '2026-11-22T15:30:00.000Z', actualizadoPor: 'uid-9',
  });
  assert.deepEqual(escrito, llamadas[0].datos);
});

test('guardarValoresRamos: un campo vacío NO se escribe (no borra el precio guardado)', async () => {
  let datos;
  await guardarValoresRamos({
    guardar: async (_r, d) => { datos = d; }, referencia, uid: 'u', ahora: AHORA,
    valores: { standard: '12.000', premium: '', deluxe: '  ', adicionalStandard: null, adicionalPremium: undefined },
  });
  assert.deepEqual(Object.keys(datos).sort(), ['actualizadoEn', 'actualizadoPor', 'standard']);
});

test('guardarValoresRamos: acepta 0 como valor', async () => {
  let datos;
  await guardarValoresRamos({ guardar: async (_r, d) => { datos = d; }, referencia, uid: 'u', ahora: AHORA, valores: { standard: 0 } });
  assert.equal(datos.standard, 0);
});

test('guardarValoresRamos: un valor que no es número no se guarda y no escribe nada', async () => {
  let escribio = false;
  for (const malo of ['abc', '-500', '12x', -1, NaN]) {
    await assert.rejects(
      guardarValoresRamos({ guardar: async () => { escribio = true; }, referencia, uid: 'u', ahora: AHORA, valores: { standard: 10000, premium: malo } }),
      /Ramo Premium/,
      String(malo),
    );
  }
  assert.equal(escribio, false);
});

test('guardarValoresRamos: sin usuario o sin ningún valor no escribe', async () => {
  let escribio = false;
  const guardar = async () => { escribio = true; };
  await assert.rejects(guardarValoresRamos({ guardar, referencia, uid: '', ahora: AHORA, valores: { standard: 1 } }), /usuario/i);
  await assert.rejects(guardarValoresRamos({ guardar, referencia, uid: 'u', ahora: AHORA, valores: {} }), /ning[uú]n valor/i);
  await assert.rejects(guardarValoresRamos({ guardar, referencia, uid: 'u', ahora: AHORA, valores: { standard: '' } }), /ning[uú]n valor/i);
  assert.equal(escribio, false);
});

test('guardarValoresRamos: un fallo de Firestore (permission-denied) se propaga para avisar', async () => {
  await assert.rejects(
    guardarValoresRamos({ guardar: async () => { throw Object.assign(new Error('denegado'), { code: 'permission-denied' }); }, referencia, uid: 'u', ahora: AHORA, valores: { standard: 1 } }),
    /denegado/,
  );
});

test('guardarValoresRamos: ignora campos que no son de los 5 valores (no se cuela nada más al documento)', async () => {
  let datos;
  await guardarValoresRamos({ guardar: async (_r, d) => { datos = d; }, referencia, uid: 'u', ahora: AHORA, valores: { standard: 5, rol: 'administrador', actualizadoPor: 'otro' } });
  assert.deepEqual(Object.keys(datos).sort(), ['actualizadoEn', 'actualizadoPor', 'standard']);
  assert.equal(datos.actualizadoPor, 'u');
});
