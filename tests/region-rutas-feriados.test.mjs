// Spec 062 · Parte B — región opcional en «Rutas y feriados». Ejecutar: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REGIONES_CHILE, regionDe, validarRuta, validarFeriado, prepararLoteRutas, parsearFeriados, filasDeRutas } from '../public/js/config-planificacion.js';
import { guardarRuta, guardarFeriado } from '../public/js/config-planificacion-db.js';
import { htmlFilasRutas, htmlFilasFeriados } from '../public/js/config-vistas.js';

const AHORA = new Date('2026-11-24T15:00:00.000Z');
const sim = () => {
  const llamadas = [];
  return { llamadas, referencia: (id) => ({ id }), guardar: async (ref, datos, opciones) => { llamadas.push({ ref, datos, opciones }); } };
};

test('la lista cerrada trae las 16 regiones con nombre corto, como docs/referencias/regiones-comunas-chile.json del repo web', () => {
  assert.equal(REGIONES_CHILE.length, 16);
  assert.ok(REGIONES_CHILE.includes('Región Metropolitana'));
  assert.ok(REGIONES_CHILE.includes("Región de O'Higgins"));
  assert.equal(new Set(REGIONES_CHILE).size, 16);
});

test('regionDe: devuelve el nombre canónico (sin importar tildes ni mayúsculas), vacío si no hay, null si no existe', () => {
  assert.equal(regionDe('region metropolitana'), 'Región Metropolitana');
  assert.equal(regionDe("  REGIÓN DE O'HIGGINS "), "Región de O'Higgins");
  assert.equal(regionDe('Narnia'), null);
  assert.equal(regionDe(''), '');
  assert.equal(regionDe(undefined), '');
});

test('rutas: la región es opcional; sin ella los datos son los de siempre', () => {
  const r = validarRuta({ cementerio: 'X', eje: 'Norte', diaSemana: 2 });
  assert.deepEqual(r.datos, { cementerio: 'X', eje: 'Norte', diaSemana: 2 });
  const c = validarRuta({ cementerio: 'X', eje: 'Norte', diaSemana: 2, region: 'region metropolitana' });
  assert.deepEqual(c.datos, { cementerio: 'X', eje: 'Norte', diaSemana: 2, region: 'Región Metropolitana' });
  const mala = validarRuta({ cementerio: 'X', eje: 'Norte', diaSemana: 2, region: 'Narnia' });
  assert.equal(mala.ok, false);
  assert.match(mala.errores.join(' '), /regi[oó]n/i);
});

test('CA8: guardar la región no toca diaSemana, eje ni cementerio y va con merge; sin región no se escribe el campo', async () => {
  const s = sim();
  await guardarRuta({ guardar: s.guardar, referencia: s.referencia, id: 'cem-1', datos: { cementerio: 'X', eje: 'Norte', diaSemana: 2, region: 'Región Metropolitana' }, uid: 'u', ahora: AHORA });
  assert.deepEqual(s.llamadas[0].opciones, { merge: true });
  assert.deepEqual(s.llamadas[0].datos, { cementerio: 'X', eje: 'Norte', diaSemana: 2, region: 'Región Metropolitana', activo: true, actualizadoPor: 'u', actualizadoEn: AHORA.toISOString() });
  await guardarRuta({ guardar: s.guardar, referencia: s.referencia, id: 'cem-2', datos: { cementerio: 'Y', eje: 'Sur', diaSemana: 3 }, uid: 'u', ahora: AHORA });
  assert.equal('region' in s.llamadas[1].datos, false, 'una ruta sin región elegida no pisa la que ya tenía (merge)');
});

test('el lote de rutas pasa la región a cada cementerio marcado', () => {
  const r = prepararLoteRutas({ cementerios: ['A', 'B'], eje: 'Norte', diaSemana: 1, region: "Región de O'Higgins", existentes: [] });
  assert.deepEqual(r.errores, []);
  assert.ok(r.items.every((i) => i.datos.region === "Región de O'Higgins"));
  const sin = prepararLoteRutas({ cementerios: ['A'], eje: 'Norte', diaSemana: 1, existentes: [] });
  assert.equal('region' in sin.items[0].datos, false);
});

test('los documentos de rutas sin región se leen igual; con región, la fila la trae', () => {
  const filas = filasDeRutas([
    { id: 'a', data: { cementerio: 'A', eje: 'N', diaSemana: 1 } },
    { id: 'b', data: { cementerio: 'B', eje: 'N', diaSemana: 1, region: 'Región Metropolitana' } },
  ], []);
  const porNombre = Object.fromEntries(filas.map((f) => [f.nombre, f]));
  assert.equal(porNombre.A.region, '');
  assert.equal(porNombre.A.estado, 'activa');
  assert.equal(porNombre.B.region, 'Región Metropolitana');
  const html = htmlFilasRutas(filas.filter((f) => f.id), { puedeEditar: true });
  assert.match(html, /data-region="Región Metropolitana"/);
  assert.match(html, /Región Metropolitana/);
});

test('CA7: feriado regional exige región; nacional no la pide ni la guarda', () => {
  const sinRegion = validarFeriado({ fecha: '2026-12-31', nombre: 'X', alcance: 'regional' });
  assert.equal(sinRegion.ok, false);
  assert.match(sinRegion.errores.join(' '), /regi[oó]n/i);
  assert.equal(validarFeriado({ fecha: '2026-12-31', nombre: 'X', alcance: 'regional', region: 'Narnia' }).ok, false);
  const ok = validarFeriado({ fecha: '2026-12-31', nombre: 'X', alcance: 'regional', region: 'región metropolitana' });
  assert.deepEqual(ok.datos, { fecha: '2026-12-31', nombre: 'X', alcance: 'regional', region: 'Región Metropolitana' });
  const nac = validarFeriado({ fecha: '2026-12-25', nombre: 'Navidad', alcance: 'nacional', region: 'Región Metropolitana' });
  assert.deepEqual(nac.datos, { fecha: '2026-12-25', nombre: 'Navidad', alcance: 'nacional' }, 'nacional: el documento no cambia de forma');
});

test('guardarFeriado: regional escribe region; nacional escribe lo de siempre; regional sin región no escribe nada', async () => {
  const s = sim();
  await guardarFeriado({ guardar: s.guardar, referencia: s.referencia, datos: { fecha: '2026-12-31', nombre: 'X', alcance: 'regional', region: 'Región Metropolitana' }, uid: 'u', ahora: AHORA });
  assert.equal(s.llamadas[0].datos.region, 'Región Metropolitana');
  await guardarFeriado({ guardar: s.guardar, referencia: s.referencia, datos: { fecha: '2026-12-25', nombre: 'N', alcance: 'nacional' }, uid: 'u', ahora: AHORA });
  assert.deepEqual(Object.keys(s.llamadas[1].datos).sort(), ['activo', 'actualizadoEn', 'actualizadoPor', 'alcance', 'nombre']);
  await assert.rejects(guardarFeriado({ guardar: s.guardar, referencia: s.referencia, datos: { fecha: '2026-12-31', nombre: 'X', alcance: 'regional' }, uid: 'u', ahora: AHORA }), /regi[oó]n/i);
  assert.equal(s.llamadas.length, 2);
});

test('lista pegada: cuarta columna opcional con la región; regional sin región se informa en su línea', () => {
  const r = parsearFeriados([
    '2026-12-25 | Navidad | nacional',
    "2026-12-31 | Feriado regional | regional | Región de O'Higgins",
    '2027-01-02 | Sin región | regional',
  ].join('\n'));
  assert.deepEqual(r.filas.map((f) => f.region), [undefined, "Región de O'Higgins"]);
  assert.deepEqual(r.errores.map((e) => e.linea), [3]);
});

test('tabla de feriados: un regional muestra su región; los anteriores sin región se leen igual', () => {
  const html = htmlFilasFeriados([
    { id: '2026-12-31', data: { nombre: 'Uno', alcance: 'regional', region: 'Región Metropolitana' } },
    { id: '2026-12-30', data: { nombre: 'Dos', alcance: 'regional' } },
    { id: '2026-12-25', data: { nombre: 'Tres', alcance: 'nacional' } },
  ], { puedeEditar: false });
  assert.match(html, /Regional[^<]*Región Metropolitana/);
  assert.match(html, /Nacional/);
  assert.match(html, /Dos/);
});

test('la pantalla ofrece la lista cerrada y muestra la región del feriado solo si el alcance es regional', () => {
  const html = readFileSync('public/rutas-feriados.html', 'utf8');
  assert.match(html, /id="ruta-region"/);
  assert.match(html, /id="feriado-region"/);
  assert.match(html, /feriado-alcance"\)\.addEventListener\("change"/);
  assert.doesNotMatch(html, /primeraVisitaTentativa/);
});

test('firebase.json sigue sin reglas (no cambian permisos ni reglas)', () => {
  assert.doesNotMatch(readFileSync('firebase.json', 'utf8'), /firestore|storage/);
});
