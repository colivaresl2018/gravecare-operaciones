import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TIPOS_RAMO, ramosDeVisita, textoRamos, normalizarValor, normalizarValores, construirListaCompra,
} from './compra-ramos.js';

// Lunes 2026-11-16 … domingo 2026-11-22
const LUNES = '2026-11-16';
const fila = (extra) => ({
  docId: 'o1', cliente: 'Cliente Ficticio', cementerio: 'Cementerio A', nivel: 'Standard', ramosAdicionales: 0,
  terminada: false, esTentativa: false, fechaIso: '2026-11-16', ...extra,
});
const VALORES = { standard: 10000, premium: 15000, deluxe: 25000, adicionalStandard: 8000, adicionalPremium: 12000 };

test('TIPOS_RAMO: los cinco tipos del documento valores_ramos/compra, en orden', () => {
  assert.deepEqual(TIPOS_RAMO.map((t) => t.clave), ['standard', 'premium', 'deluxe', 'adicionalStandard', 'adicionalPremium']);
});

test('ramosDeVisita: 1 ramo del nivel contratado más los adicionales del mismo nivel', () => {
  assert.deepEqual(ramosDeVisita('Standard', 0), { standard: 1, premium: 0, deluxe: 0, adicionalStandard: 0, adicionalPremium: 0 });
  assert.deepEqual(ramosDeVisita('Standard', 2), { standard: 1, premium: 0, deluxe: 0, adicionalStandard: 2, adicionalPremium: 0 });
  assert.deepEqual(ramosDeVisita('Premium', 3), { standard: 0, premium: 1, deluxe: 0, adicionalStandard: 0, adicionalPremium: 3 });
});

test('ramosDeVisita: Deluxe no admite adicionales (aunque vengan)', () => {
  assert.deepEqual(ramosDeVisita('Deluxe', 4), { standard: 0, premium: 0, deluxe: 1, adicionalStandard: 0, adicionalPremium: 0 });
});

test('ramosDeVisita: un nivel desconocido o adicionales inválidos no inventan ramos', () => {
  assert.equal(ramosDeVisita('Standard', -3).adicionalStandard, 0);
  assert.equal(ramosDeVisita('Standard', NaN).adicionalStandard, 0);
  assert.equal(ramosDeVisita(undefined, 0).standard, 1); // sin nivel se trata como Standard, igual que el servidor
});

test('textoRamos: singular y plural', () => {
  assert.equal(textoRamos('premium', 1), '1 Ramo Premium');
  assert.equal(textoRamos('premium', 2), '2 Ramos Premium');
  assert.equal(textoRamos('adicionalStandard', 3), '3 Ramos Adicionales Standard');
  assert.equal(textoRamos('desconocido', 1), '');
});

test('normalizarValor: enteros de pesos; vacío o inválido es null (nunca 0 inventado)', () => {
  assert.equal(normalizarValor(12000), 12000);
  assert.equal(normalizarValor('12.000'), 12000);
  assert.equal(normalizarValor('$ 12.000'), 12000);
  assert.equal(normalizarValor('0'), 0);
  assert.equal(normalizarValor(0), 0);
  assert.equal(normalizarValor(1234.6), 1235);
  assert.equal(normalizarValor('12000'), 12000);
  assert.equal(normalizarValor('1.234.567'), 1234567);
  assert.equal(normalizarValor('12,5'), 13);
  for (const malo of ['', '   ', 'abc', '-', -5, '-100', '12x', 'x12', '12.5', '1.2.3', '12 000', '1e3', null, undefined, NaN, Infinity]) assert.equal(normalizarValor(malo), null, String(malo));
});

test('normalizarValores: solo las 5 claves, el resto se ignora; las que faltan quedan null', () => {
  const v = normalizarValores({ standard: '10.000', premium: 'x', otro: 99, actualizadoPor: 'uid' });
  assert.deepEqual(v, { standard: 10000, premium: null, deluxe: null, adicionalStandard: null, adicionalPremium: null });
  assert.deepEqual(normalizarValores(null), { standard: null, premium: null, deluxe: null, adicionalStandard: null, adicionalPremium: null });
});

test('construirListaCompra: suma los ramos por día y cementerio, con 7 días de lunes a domingo', () => {
  const lista = construirListaCompra([
    fila({ docId: 'a', cementerio: 'Cementerio B', nivel: 'Premium', ramosAdicionales: 2 }),
    fila({ docId: 'b', cementerio: 'Cementerio A', nivel: 'Standard' }),
    fila({ docId: 'c', cementerio: 'Cementerio A', nivel: 'Standard', ramosAdicionales: 1 }),
    fila({ docId: 'd', nivel: 'Deluxe', fechaIso: '2026-11-18', cementerio: 'Cementerio C' }),
  ], { lunesIso: LUNES, valores: VALORES });
  assert.equal(lista.dias.length, 7);
  assert.deepEqual(lista.dias.map((d) => d.nombre).slice(0, 2), ['Lunes', 'Martes']);
  const lun = lista.dias[0];
  assert.deepEqual(lun.cementerios.map((c) => c.cementerio), ['Cementerio A', 'Cementerio B']); // ordenados
  assert.equal(lun.cementerios[0].visitas, 2);
  assert.deepEqual(lun.cementerios[0].lineas.map((l) => [l.clave, l.cantidad]), [['standard', 2], ['adicionalStandard', 1]]);
  assert.deepEqual(lun.cementerios[1].lineas.map((l) => [l.clave, l.cantidad]), [['premium', 1], ['adicionalPremium', 2]]);
  assert.equal(lun.visitas, 3);
  assert.equal(lista.dias[2].visitas, 1);
  assert.deepEqual(lista.dias[2].lineas.map((l) => l.clave), ['deluxe']);
  assert.equal(lista.dias[1].visitas, 0);
  assert.deepEqual(lista.dias[1].lineas, []);
});

test('construirListaCompra: el precio sale de valores_ramos; subtotales y total de la semana cuadran', () => {
  const lista = construirListaCompra([
    fila({ nivel: 'Standard', ramosAdicionales: 1 }), // 10.000 + 8.000
    fila({ docId: 'b', nivel: 'Premium', fechaIso: '2026-11-17' }), // 15.000
  ], { lunesIso: LUNES, valores: VALORES });
  assert.equal(lista.dias[0].total, 18000);
  assert.equal(lista.dias[1].total, 15000);
  assert.equal(lista.resumen.total, 33000);
  assert.equal(lista.resumen.incompleto, false);
  assert.deepEqual(lista.faltantes, []);
  const l = lista.dias[0].lineas.find((x) => x.clave === 'adicionalStandard');
  assert.equal(l.valorUnitario, 8000);
  assert.equal(l.subtotal, 8000);
  assert.equal(lista.resumen.totalRamos, 3);
});

test('construirListaCompra: un valor faltante deja la línea «sin valor» y el total incompleto; no inventa precio', () => {
  const lista = construirListaCompra([
    fila({ nivel: 'Premium', ramosAdicionales: 2 }),
  ], { lunesIso: LUNES, valores: { premium: 15000 } }); // falta el adicional Premium
  const adicional = lista.dias[0].lineas.find((l) => l.clave === 'adicionalPremium');
  assert.equal(adicional.valorUnitario, null);
  assert.equal(adicional.subtotal, null);
  assert.equal(lista.dias[0].incompleto, true);
  assert.equal(lista.dias[0].total, 15000); // solo lo valorizado
  assert.equal(lista.resumen.incompleto, true);
  assert.deepEqual(lista.faltantes, ['Ramo Adicional Premium']);
});

test('construirListaCompra: sin ningún valor cargado todo queda sin valor y el total es incompleto', () => {
  const lista = construirListaCompra([fila({})], { lunesIso: LUNES });
  assert.equal(lista.resumen.incompleto, true);
  assert.equal(lista.resumen.total, 0);
  assert.deepEqual(lista.faltantes, ['Ramo Standard']);
});

test('construirListaCompra: un 0 guardado es un valor (no «sin valor»)', () => {
  const lista = construirListaCompra([fila({})], { lunesIso: LUNES, valores: { standard: 0 } });
  assert.equal(lista.resumen.incompleto, false);
  assert.equal(lista.resumen.total, 0);
});

test('construirListaCompra: las visitas completadas no se compran, salvo que se pida incluirlas', () => {
  const filas = [fila({ terminada: true }), fila({ docId: 'b' })];
  assert.equal(construirListaCompra(filas, { lunesIso: LUNES, valores: VALORES }).resumen.totalRamos, 1);
  assert.equal(construirListaCompra(filas, { lunesIso: LUNES, valores: VALORES, incluirCompletadas: true }).resumen.totalRamos, 2);
});

test('construirListaCompra: las visitas de otra semana no cuentan; las sin fecha se avisan aparte', () => {
  const lista = construirListaCompra([
    fila({ fechaIso: '2026-11-15' }), fila({ docId: 'b', fechaIso: '2026-11-23' }),
    fila({ docId: 'c', fechaIso: null }), fila({ docId: 'd', fechaIso: null, terminada: true }),
  ], { lunesIso: LUNES, valores: VALORES });
  assert.equal(lista.resumen.visitas, 0);
  assert.equal(lista.sinFecha, 1); // la completada sin fecha no se iba a comprar
});

test('construirListaCompra: cuenta las visitas con fecha tentativa', () => {
  const lista = construirListaCompra([fila({ esTentativa: true }), fila({ docId: 'b' }), fila({ docId: 'c', esTentativa: true, fechaIso: '2026-12-30' })], { lunesIso: LUNES, valores: VALORES });
  assert.equal(lista.tentativas, 1); // la tentativa de otra semana no cuenta
});

test('construirListaCompra: el Spot (una fila por servicio) entra igual que una visita', () => {
  const spot = fila({ docId: 's1', nivel: 'Deluxe', cementerio: 'Cementerio S', plan: undefined, visitaTexto: undefined });
  const lista = construirListaCompra([spot], { lunesIso: LUNES, valores: VALORES });
  assert.equal(lista.resumen.total, 25000);
});

test('construirListaCompra: un lunes inválido no rompe ni inventa días', () => {
  const lista = construirListaCompra([fila({})], { lunesIso: 'nada', valores: VALORES });
  assert.deepEqual(lista.dias, []);
  assert.equal(lista.resumen.visitas, 0);
  assert.doesNotThrow(() => construirListaCompra(null, { lunesIso: LUNES }));
});
