import test from 'node:test';
import assert from 'node:assert/strict';
import { diaListo, idBorrador, borradorDesdeDia } from './compra-dia.js';
import { construirListaCompra } from './compra-ramos.js';

const LUNES = '2026-11-30';
const MARTES = '2026-12-01';
const VALORES = { standard: 10000, premium: 15000, deluxe: 25000, adicionalStandard: 7000, adicionalPremium: 12000 };
const CON_RUTA = () => true;

const visita = (fechaIso, cementerio, nivel, ramosAdicionales = 0) => ({
  fechaIso, cementerio, nivel, ramosAdicionales, terminada: false, esTentativa: false,
});

const diaDe = (filas, valores = VALORES) => construirListaCompra(filas, { lunesIso: LUNES, valores }).dias.find((d) => d.iso === MARTES);

test('diaListo: un día completo, con ruta y con valores, está listo (CA-B1)', () => {
  const dia = diaDe([visita(MARTES, 'Cementerio X', 'Standard'), visita(MARTES, 'Cementerio X', 'Premium', 1)]);
  assert.deepEqual(diaListo(dia, { tieneRuta: CON_RUTA }), { listo: true, motivos: [] });
});

test('diaListo: un ramo sin valor deja el día no listo y lo nombra (CA-B1)', () => {
  const dia = diaDe([visita(MARTES, 'Cementerio X', 'Deluxe')], { ...VALORES, deluxe: null });
  const r = diaListo(dia, { tieneRuta: CON_RUTA });
  assert.equal(r.listo, false);
  assert.match(r.motivos.join(' '), /Falta el valor de «1 Ramo Deluxe»/);
});

test('diaListo: un cementerio sin eje o día de ruta deja el día no listo y lo nombra (CA-B6, R-R2)', () => {
  const dia = diaDe([visita(MARTES, 'Cementerio Sin Ruta', 'Standard')]);
  const r = diaListo(dia, { tieneRuta: (c) => c !== 'Cementerio Sin Ruta' });
  assert.equal(r.listo, false);
  assert.match(r.motivos.join(' '), /Sin eje y día de ruta: Cementerio Sin Ruta/);
});

test('diaListo: un día sin visitas no está listo', () => {
  const dia = diaDe([visita(LUNES, 'Cementerio X', 'Standard')]);
  const r = diaListo(dia, { tieneRuta: CON_RUTA });
  assert.equal(r.listo, false);
  assert.match(r.motivos.join(' '), /No hay visitas/);
});

test('idBorrador: un borrador por día con formato AAAA-MM-DD; la misma fecha da el mismo id (CA-B3, decisión 6)', () => {
  assert.equal(idBorrador({ fecha: MARTES }), '2026-12-01');
  assert.equal(idBorrador({ fecha: MARTES }), idBorrador({ fecha: '2026-12-01' }));
  assert.equal(idBorrador({ fecha: '01/12/2026' }), null);
  assert.equal(idBorrador({ fecha: '' }), null);
});

test('borradorDesdeDia: ramos del día con códigos RAM-*, precios de valores_ramos y totales R6 (CA-B2)', () => {
  // Tres visitas: Standard, Premium con 2 adicionales y Deluxe.
  const dia = diaDe([
    visita(MARTES, 'Cementerio X', 'Standard'),
    visita(MARTES, 'Cementerio X', 'Premium', 2),
    visita(MARTES, 'Cementerio Y', 'Deluxe'),
  ]);
  const r = borradorDesdeDia(dia);
  assert.equal(r.ok, true);
  assert.deepEqual(r.datos.lineas.map((l) => [l.codigo, l.descripcion, l.cantidad, l.precioUnitario, l.valor]), [
    ['RAM-STD', 'Ramo Standard', 1, 10000, 10000],
    ['RAM-PRE', 'Ramo Premium', 1, 15000, 15000],
    ['RAM-DLX', 'Ramo Deluxe', 1, 25000, 25000],
    ['RAM-ADP', 'Ramo Adicional Premium', 2, 12000, 24000],
  ]);
  assert.deepEqual(r.datos.lineas[0].unidad, 'UNI');
  assert.equal(r.datos.neto, 74000);
  assert.equal(r.datos.iva, 14060);
  assert.equal(r.datos.total, 88060);
});

test('borradorDesdeDia no inventa precios: con un ramo sin valor no arma el borrador (CA-B1)', () => {
  const dia = diaDe([visita(MARTES, 'Cementerio X', 'Standard')], { ...VALORES, standard: null });
  const r = borradorDesdeDia(dia);
  assert.equal(r.ok, false);
  assert.match(r.errores.join(' '), /sin valor/);
});

// ---- Días de programación de la semana (Rutas y feriados, spec 057 parte c) ----
import { diasDeProgramacion } from './compra-dia.js';

const RUTA_OK = (c) => (c === 'Cementerio Sin Ruta' ? null : { eje: 'Eje 1', diaSemana: 2, dia: 'Martes' });

test('diasDeProgramacion: los 7 días de la semana, con visitas, ramos y estado listo/no listo (CA-B1)', () => {
  const filas = [visita(MARTES, 'Cementerio X', 'Standard'), visita(MARTES, 'Cementerio Y', 'Premium', 1), visita(LUNES, 'Cementerio Sin Ruta', 'Standard')];
  const dias = diasDeProgramacion(filas, { lunesIso: LUNES, valores: VALORES, rutaDe: RUTA_OK });
  assert.equal(dias.length, 7);
  const martes = dias.find((d) => d.iso === MARTES);
  assert.equal(martes.visitas, 2);
  assert.equal(martes.ramos, 3);
  assert.equal(martes.listo, true);
  assert.deepEqual(martes.motivos, []);
  const lunes = dias.find((d) => d.iso === LUNES);
  assert.equal(lunes.listo, false);
  assert.match(lunes.motivos.join(' '), /Sin eje y día de ruta: Cementerio Sin Ruta/);
  const miercoles = dias.find((d) => d.iso === '2026-12-02');
  assert.equal(miercoles.listo, false);
  assert.match(miercoles.motivos.join(' '), /No hay visitas/);
});

test('diasDeProgramacion: un ruta con eje pero sin día de ruta no cuenta como ruta (R-R2)', () => {
  const dias = diasDeProgramacion([visita(MARTES, 'Cementerio X', 'Standard')], {
    lunesIso: LUNES, valores: VALORES, rutaDe: () => ({ eje: 'Eje 1', diaSemana: null, dia: '' }),
  });
  assert.equal(dias.find((d) => d.iso === MARTES).listo, false);
});

test('diasDeProgramacion: sin valores cargados ningún día queda listo y avisa el valor que falta (CA-B1)', () => {
  const dias = diasDeProgramacion([visita(MARTES, 'Cementerio X', 'Standard')], { lunesIso: LUNES, valores: {}, rutaDe: RUTA_OK });
  const martes = dias.find((d) => d.iso === MARTES);
  assert.equal(martes.listo, false);
  assert.match(martes.motivos.join(' '), /Falta el valor de «1 Ramo Standard»/);
});

test('diasDeProgramacion: marca el borrador existente del día y si ya se emitió (CA-B3, CA-B5)', () => {
  const borradores = [{ id: MARTES, data: { estado: 'Borrador' } }, { id: '2026-12-02', data: { estado: 'Borrador', emitidoComo: 'OC-0007' } }];
  const dias = diasDeProgramacion([visita(MARTES, 'Cementerio X', 'Standard')], { lunesIso: LUNES, valores: VALORES, rutaDe: RUTA_OK, borradores });
  assert.deepEqual(dias.find((d) => d.iso === MARTES).borrador, { id: MARTES, emitidoComo: '' });
  assert.deepEqual(dias.find((d) => d.iso === '2026-12-02').borrador, { id: '2026-12-02', emitidoComo: 'OC-0007' });
  assert.equal(dias.find((d) => d.iso === LUNES).borrador, null);
});

test('diasDeProgramacion: las visitas ya terminadas no cuentan (no se compra lo ya hecho)', () => {
  const hecha = { ...visita(MARTES, 'Cementerio X', 'Standard'), terminada: true };
  const dias = diasDeProgramacion([hecha], { lunesIso: LUNES, valores: VALORES, rutaDe: RUTA_OK });
  assert.equal(dias.find((d) => d.iso === MARTES).visitas, 0);
});

test('diasDeProgramacion: cada día trae su detalle para armar el borrador sin recalcular', () => {
  const dias = diasDeProgramacion([visita(MARTES, 'Cementerio X', 'Standard')], { lunesIso: LUNES, valores: VALORES, rutaDe: RUTA_OK });
  const r = borradorDesdeDia(dias.find((d) => d.iso === MARTES).detalle);
  assert.equal(r.ok, true);
  assert.equal(r.datos.neto, 10000);
});

import { textoErrorBorrador } from './compra-dia.js';

test('textoErrorBorrador: explica el permiso, la conexión y deja pasar el mensaje propio (nunca un código técnico crudo)', () => {
  assert.match(textoErrorBorrador({ code: 'permission-denied' }), /no tiene permiso|no están publicadas/);
  assert.match(textoErrorBorrador({ code: 'unavailable' }), /conexión/);
  assert.equal(textoErrorBorrador(new Error('La fecha del borrador no es válida (usa AAAA-MM-DD).')), 'La fecha del borrador no es válida (usa AAAA-MM-DD).');
  assert.match(textoErrorBorrador({}), /No se pudo crear el borrador/);
});

// ---- estadoDiasCompra: el estado de cada día de una lista de compra ya armada (Compra de flores) ----
import { estadoDiasCompra } from './compra-dia.js';

test('estadoDiasCompra usa la lista ya armada: mismo resultado que diasDeProgramacion, sin duplicar la regla de «día listo» (CA-B1)', () => {
  const filas = [visita(MARTES, 'Cementerio X', 'Standard'), visita(LUNES, 'Cementerio Sin Ruta', 'Standard')];
  const lista = construirListaCompra(filas, { lunesIso: LUNES, valores: VALORES });
  const estados = estadoDiasCompra(lista, { rutaDe: RUTA_OK });
  const dias = diasDeProgramacion(filas, { lunesIso: LUNES, valores: VALORES, rutaDe: RUTA_OK });
  assert.deepEqual(estados.map((e) => [e.iso, e.listo, e.motivos]), dias.map((d) => [d.iso, d.listo, d.motivos]));
  assert.equal(estados.find((e) => e.iso === MARTES).detalle, lista.dias.find((d) => d.iso === MARTES), 'el detalle es el mismo día que se está viendo');
});

test('estadoDiasCompra respeta «incluir visitas completadas»: el borrador sale de lo que se ve en pantalla', () => {
  const hecha = { ...visita(MARTES, 'Cementerio X', 'Standard'), terminada: true };
  const sin = estadoDiasCompra(construirListaCompra([hecha], { lunesIso: LUNES, valores: VALORES }), { rutaDe: RUTA_OK });
  const con = estadoDiasCompra(construirListaCompra([hecha], { lunesIso: LUNES, valores: VALORES, incluirCompletadas: true }), { rutaDe: RUTA_OK });
  assert.equal(sin.find((e) => e.iso === MARTES).listo, false);
  assert.equal(con.find((e) => e.iso === MARTES).listo, true);
});

test('estadoDiasCompra marca el borrador existente del día y si ya se emitió (CA-B3)', () => {
  const lista = construirListaCompra([visita(MARTES, 'Cementerio X', 'Standard')], { lunesIso: LUNES, valores: VALORES });
  const estados = estadoDiasCompra(lista, { rutaDe: RUTA_OK, borradores: [{ id: MARTES, data: { emitidoComo: 'OC-0003' } }] });
  assert.deepEqual(estados.find((e) => e.iso === MARTES).borrador, { id: MARTES, emitidoComo: 'OC-0003' });
});
