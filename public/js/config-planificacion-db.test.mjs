import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COLECCION_RUTAS, COLECCION_FERIADOS, guardarRuta, guardarRutasEnLote, cambiarEstadoRuta,
  guardarFeriado, guardarFeriados, cambiarEstadoFeriado, textoErrorGuardar,
} from './config-planificacion-db.js';

const AHORA = new Date('2026-11-22T15:30:00.000Z');
const ISO = '2026-11-22T15:30:00.000Z';

function simulador({ falla = () => false } = {}) {
  const llamadas = [];
  return {
    llamadas,
    referencia: (coleccion) => (id) => ({ coleccion, id }),
    guardar: async (ref, datos, opciones) => {
      if (falla(ref)) throw Object.assign(new Error('rechazado'), { code: 'permission-denied' });
      llamadas.push({ ref, datos, opciones });
    },
  };
}

test('las colecciones son rutas y feriados (las de la web; no se crea ninguna nueva)', () => {
  assert.equal(COLECCION_RUTAS, 'rutas');
  assert.equal(COLECCION_FERIADOS, 'feriados');
});

// ─── rutas ───────────────────────────────────────────────────────────────────────────────────────────────────────

test('guardarRuta: escribe solo cementerio, eje, día, activo y quién/cuándo, en rutas/{id} y con merge', async () => {
  const s = simulador();
  const escrito = await guardarRuta({
    guardar: s.guardar, referencia: s.referencia('rutas'), id: 'parque-canaan', uid: 'uid-dueno', ahora: AHORA,
    datos: { cementerio: ' Parque Canaán ', eje: ' Norte ', diaSemana: '2', basura: 'x' },
  });
  assert.equal(s.llamadas.length, 1);
  assert.deepEqual(s.llamadas[0].ref, { coleccion: 'rutas', id: 'parque-canaan' });
  assert.deepEqual(s.llamadas[0].opciones, { merge: true });
  assert.deepEqual(s.llamadas[0].datos, { cementerio: 'Parque Canaán', eje: 'Norte', diaSemana: 2, activo: true, actualizadoPor: 'uid-dueno', actualizadoEn: ISO });
  assert.deepEqual(escrito, s.llamadas[0].datos);
});

test('guardarRuta: datos inválidos, sin id o sin usuario → error y NO se escribe nada', async () => {
  const s = simulador();
  const base = { guardar: s.guardar, referencia: s.referencia('rutas'), id: 'a', uid: 'u', ahora: AHORA, datos: { cementerio: 'A', eje: 'Norte', diaSemana: 1 } };
  await assert.rejects(guardarRuta({ ...base, datos: { cementerio: 'A', eje: '', diaSemana: 1 } }), /eje/i);
  await assert.rejects(guardarRuta({ ...base, datos: { cementerio: 'A', eje: 'N', diaSemana: 7 } }), /día/i);
  await assert.rejects(guardarRuta({ ...base, id: '' }), /identificador|id/i);
  await assert.rejects(guardarRuta({ ...base, id: 'a/b' }), /identificador|id/i); // no permite subrutas
  await assert.rejects(guardarRuta({ ...base, uid: '' }), /usuario/i);
  assert.equal(s.llamadas.length, 0);
});

test('guardarRutasEnLote: escribe una por una y sigue aunque alguna falle; informa el resultado de cada una', async () => {
  const s = simulador({ falla: (ref) => ref.id === 'b' });
  const items = ['a', 'b', 'c'].map((id) => ({ id, datos: { cementerio: id.toUpperCase(), eje: 'Norte', diaSemana: 3 } }));
  const r = await guardarRutasEnLote({ guardar: s.guardar, referencia: s.referencia('rutas'), items, uid: 'u', ahora: AHORA });
  assert.deepEqual(r.map((x) => [x.id, x.ok]), [['a', true], ['b', false], ['c', true]]);
  assert.equal(r[1].error.code, 'permission-denied');
  assert.deepEqual(s.llamadas.map((l) => l.ref.id), ['a', 'c']);
});

test('guardarRutasEnLote: sin elementos no escribe ni inventa nada', async () => {
  const s = simulador();
  assert.deepEqual(await guardarRutasEnLote({ guardar: s.guardar, referencia: s.referencia('rutas'), items: [], uid: 'u', ahora: AHORA }), []);
  assert.equal(s.llamadas.length, 0);
});

test('cambiarEstadoRuta: quitar = activo:false (aditivo, con merge); NUNCA se borra el documento', async () => {
  const s = simulador();
  await cambiarEstadoRuta({ guardar: s.guardar, referencia: s.referencia('rutas'), id: 'a', activo: false, uid: 'u', ahora: AHORA });
  await cambiarEstadoRuta({ guardar: s.guardar, referencia: s.referencia('rutas'), id: 'a', activo: true, uid: 'u', ahora: AHORA });
  assert.deepEqual(s.llamadas.map((l) => l.datos), [
    { activo: false, actualizadoPor: 'u', actualizadoEn: ISO },
    { activo: true, actualizadoPor: 'u', actualizadoEn: ISO },
  ]);
  assert.ok(s.llamadas.every((l) => l.opciones.merge === true));
  await assert.rejects(cambiarEstadoRuta({ guardar: s.guardar, referencia: s.referencia('rutas'), id: '', activo: false, uid: 'u' }), /id|identificador/i);
  await assert.rejects(cambiarEstadoRuta({ guardar: s.guardar, referencia: s.referencia('rutas'), id: 'a', activo: 'no', uid: 'u' }), /activo|estado/i);
});

// ─── feriados ────────────────────────────────────────────────────────────────────────────────────────────────────

test('guardarFeriado: documento feriados/{fecha} con nombre, alcance, activo y quién/cuándo; la fecha va solo en el id', async () => {
  const s = simulador();
  const escrito = await guardarFeriado({
    guardar: s.guardar, referencia: s.referencia('feriados'), uid: 'uid-admin', ahora: AHORA,
    datos: { fecha: '2026-12-25', nombre: ' Navidad ', alcance: '' },
  });
  assert.deepEqual(s.llamadas[0].ref, { coleccion: 'feriados', id: '2026-12-25' });
  assert.deepEqual(s.llamadas[0].opciones, { merge: true });
  assert.deepEqual(s.llamadas[0].datos, { nombre: 'Navidad', alcance: 'nacional', activo: true, actualizadoPor: 'uid-admin', actualizadoEn: ISO });
  assert.deepEqual(escrito, s.llamadas[0].datos);
});

test('guardarFeriado: fecha imposible, nombre vacío o sin usuario → error y no se escribe', async () => {
  const s = simulador();
  const base = { guardar: s.guardar, referencia: s.referencia('feriados'), uid: 'u', ahora: AHORA, datos: { fecha: '2026-12-25', nombre: 'N', alcance: 'nacional' } };
  await assert.rejects(guardarFeriado({ ...base, datos: { fecha: '2026-02-30', nombre: 'N', alcance: 'nacional' } }), /fecha/i);
  await assert.rejects(guardarFeriado({ ...base, datos: { fecha: '2026-12-25', nombre: '', alcance: 'nacional' } }), /nombre/i);
  await assert.rejects(guardarFeriado({ ...base, uid: '' }), /usuario/i);
  assert.equal(s.llamadas.length, 0);
});

test('guardarFeriados: una por fecha, sigue aunque alguna falle y informa cada resultado', async () => {
  const s = simulador({ falla: (ref) => ref.id === '2026-12-26' });
  const filas = [
    { fecha: '2026-12-25', nombre: 'Navidad', alcance: 'nacional' },
    { fecha: '2026-12-26', nombre: 'Otro', alcance: 'nacional' },
    { fecha: '2026-12-27', nombre: 'Y otro', alcance: 'regional' },
  ];
  const r = await guardarFeriados({ guardar: s.guardar, referencia: s.referencia('feriados'), filas, uid: 'u', ahora: AHORA });
  assert.deepEqual(r.map((x) => [x.id, x.ok]), [['2026-12-25', true], ['2026-12-26', false], ['2026-12-27', true]]);
  assert.deepEqual(s.llamadas.map((l) => l.ref.id), ['2026-12-25', '2026-12-27']);
});

test('cambiarEstadoFeriado: quitar = activo:false, sin borrar el documento', async () => {
  const s = simulador();
  await cambiarEstadoFeriado({ guardar: s.guardar, referencia: s.referencia('feriados'), fecha: '2026-12-25', activo: false, uid: 'u', ahora: AHORA });
  assert.deepEqual(s.llamadas[0].datos, { activo: false, actualizadoPor: 'u', actualizadoEn: ISO });
  assert.deepEqual(s.llamadas[0].opciones, { merge: true });
  await assert.rejects(cambiarEstadoFeriado({ guardar: s.guardar, referencia: s.referencia('feriados'), fecha: '25-12-2026', activo: false, uid: 'u' }), /fecha/i);
});

// ─── mensajes ────────────────────────────────────────────────────────────────────────────────────────────────────

test('textoErrorGuardar: permiso denegado dice quién puede cargar cada cosa; otros errores, un texto claro', () => {
  const permiso = Object.assign(new Error('x'), { code: 'permission-denied' });
  assert.match(textoErrorGuardar(permiso, 'rutas'), /dueño/i);
  assert.match(textoErrorGuardar(permiso, 'feriados'), /administrador/i);
  assert.match(textoErrorGuardar(Object.assign(new Error('x'), { code: 'unavailable' }), 'rutas'), /conexión|red|internet/i);
  assert.match(textoErrorGuardar(new Error('El eje es obligatorio.'), 'rutas'), /El eje es obligatorio\./);
  assert.match(textoErrorGuardar(null, 'rutas'), /no se pudo/i);
});
