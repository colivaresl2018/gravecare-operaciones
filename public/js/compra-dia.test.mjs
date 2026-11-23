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
