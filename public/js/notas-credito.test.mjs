// B-3: notas de crédito en «Gastos e ingresos». Pruebas de la lógica pura (sin navegador ni Firebase).
// Ejecutar:  node --test tests/ public/js/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TIPO_DTE_NOTA, PLAZO_MESES_BOLETA_NOTA, PLAZO_DIAS_TERMINO_SERVICIO, CODIGOS_REFERENCIA, MEDIOS_DEVOLUCION,
  desglosarBruto, esBoletaCreditable, notasDeBoleta, saldoDeBoleta, validarNotaCredito, avisosNotaCredito, filaDeNota,
} from './notas-credito.js';
import { calcularLiquidacion } from './liquidacion-tributaria.js';
import { cuentaComoIngreso } from './orden-pagada.js';

const fecha = (s) => new Date(s + 'T12:00:00');
const boleta = (extra = {}) => ({ id: 'ord1', origen: 'Webpay', tipo: 'Ingreso', dte: 'Boleta Venta', folio: 'GC-1', fecha: fecha('2026-10-15'), neto: 100, impuesto: 19, total: 119, ...extra });
const notaOk = (extra = {}) => ({ folio: '77', fecha: fecha('2026-10-20'), montoBruto: 119, motivo: 'Devolución por término del servicio', codigoReferencia: 1, medioDevolucion: 'Reversa Transbank', ...extra });
const guardada = (extra = {}) => ({ id: 'n1', folio: '70', refOrigen: 'Webpay', refId: 'ord1', montoBruto: 50, ...extra });

test('constantes: el plazo de 6 meses y el de 30 días son valores configurables, con códigos 1 y 3 y dos medios de devolución', () => {
  assert.equal(PLAZO_MESES_BOLETA_NOTA, 6);
  assert.equal(PLAZO_DIAS_TERMINO_SERVICIO, 30);
  assert.deepEqual(Object.keys(CODIGOS_REFERENCIA), ['1', '3']);
  assert.deepEqual(MEDIOS_DEVOLUCION, ['Reversa Transbank', 'Transferencia bancaria']);
  assert.equal(TIPO_DTE_NOTA, 'Nota de Crédito Electrónica');
});

test('desglosarBruto usa el mismo redondeo que el ingreso de una orden (neto = bruto/1,19)', () => {
  assert.deepEqual(desglosarBruto(119), { neto: 100, iva: 19, total: 119 });
  assert.deepEqual(desglosarBruto(100), { neto: 84, iva: 16, total: 100 });
  assert.deepEqual(desglosarBruto(0), { neto: 0, iva: 0, total: 0 });
});

test('esBoletaCreditable: solo boletas electrónicas de venta (ingreso) con monto; nunca otra nota', () => {
  assert.equal(esBoletaCreditable(boleta()), true);
  assert.equal(esBoletaCreditable(boleta({ dte: 'Factura Afecta' })), false);
  assert.equal(esBoletaCreditable(boleta({ tipo: 'Gasto' })), false);
  assert.equal(esBoletaCreditable(boleta({ total: 0 })), false);
  assert.equal(esBoletaCreditable(boleta({ origen: 'Nota de crédito' })), false);
  assert.equal(esBoletaCreditable(null), false);
});

test('notasDeBoleta y saldoDeBoleta: suman solo las notas que referencian esa boleta (mismo origen e id)', () => {
  const notas = [guardada(), guardada({ id: 'n2', folio: '71', montoBruto: 30 }), guardada({ id: 'n3', folio: '72', refId: 'otra' }), guardada({ id: 'n4', folio: '73', refOrigen: 'Manual' })];
  assert.equal(notasDeBoleta(notas, boleta()).length, 2);
  assert.equal(saldoDeBoleta(boleta(), notas), 119 - 80);
  assert.equal(saldoDeBoleta(boleta(), []), 119);
});

test('validarNotaCredito: una nota completa y con boleta se acepta', () => {
  const r = validarNotaCredito(notaOk(), { boleta: boleta(), notas: [] });
  assert.deepEqual(r, { ok: true, errores: [] });
});

test('validarNotaCredito: una nota sin boleta de referencia no se guarda', () => {
  const r = validarNotaCredito(notaOk(), { boleta: null, notas: [] });
  assert.equal(r.ok, false);
  assert.match(r.errores.join(' '), /boleta de referencia/i);
});

test('validarNotaCredito: la referencia debe ser una boleta electrónica de venta (no una factura ni un gasto)', () => {
  assert.equal(validarNotaCredito(notaOk(), { boleta: boleta({ dte: 'Factura Afecta' }), notas: [] }).ok, false);
  assert.equal(validarNotaCredito(notaOk(), { boleta: boleta({ tipo: 'Gasto' }), notas: [] }).ok, false);
});

test('validarNotaCredito: monto mayor que la boleta no se guarda; igual sí', () => {
  assert.equal(validarNotaCredito(notaOk({ montoBruto: 120 }), { boleta: boleta(), notas: [] }).ok, false);
  assert.equal(validarNotaCredito(notaOk({ montoBruto: 119 }), { boleta: boleta(), notas: [] }).ok, true);
});

test('validarNotaCredito: la SUMA de las notas de una boleta no puede superar su monto bruto (parciales permitidas)', () => {
  const previas = [guardada({ montoBruto: 50 }), guardada({ id: 'n2', folio: '71', montoBruto: 40 })]; // 90 usados, quedan 29
  const r1 = validarNotaCredito(notaOk({ codigoReferencia: 3, montoBruto: 30 }), { boleta: boleta(), notas: previas });
  assert.equal(r1.ok, false);
  assert.match(r1.errores.join(' '), /supera/i);
  assert.equal(validarNotaCredito(notaOk({ codigoReferencia: 3, montoBruto: 29 }), { boleta: boleta(), notas: previas }).ok, true);
  // las notas de OTRA boleta no cuentan
  assert.equal(validarNotaCredito(notaOk({ montoBruto: 119 }), { boleta: boleta(), notas: [guardada({ refId: 'otra', montoBruto: 119 })] }).ok, true);
});

test('validarNotaCredito: campos obligatorios (folio, fecha, monto entero > 0, motivo, código 1 o 3, medio de devolución)', () => {
  const caso = (cambio) => validarNotaCredito({ ...notaOk(), ...cambio }, { boleta: boleta(), notas: [] });
  assert.equal(caso({ folio: ' ' }).ok, false);
  assert.equal(caso({ fecha: null }).ok, false);
  assert.equal(caso({ montoBruto: 0 }).ok, false);
  assert.equal(caso({ montoBruto: -5 }).ok, false);
  assert.equal(caso({ montoBruto: 10.5 }).ok, false);
  assert.equal(caso({ motivo: '   ' }).ok, false);
  assert.equal(caso({ codigoReferencia: 2 }).ok, false);
  assert.equal(caso({ codigoReferencia: undefined }).ok, false);
  assert.equal(caso({ medioDevolucion: '' }).ok, false);
  assert.equal(caso({ medioDevolucion: 'Efectivo' }).ok, false);
  assert.equal(caso({ codigoReferencia: '3', montoBruto: 10 }).ok, true, 'el código llega como texto del formulario');
});

test('validarNotaCredito: el folio de la nota no puede repetirse; la fecha no puede ser anterior a la boleta', () => {
  assert.equal(validarNotaCredito(notaOk({ folio: '70' }), { boleta: boleta(), notas: [guardada({ folio: '70', refId: 'otra' })] }).ok, false);
  assert.equal(validarNotaCredito(notaOk({ fecha: fecha('2026-10-14') }), { boleta: boleta(), notas: [] }).ok, false);
  assert.equal(validarNotaCredito(notaOk({ fecha: fecha('2026-10-15') }), { boleta: boleta(), notas: [] }).ok, true);
});

test('validarNotaCredito: visitas opcionales; si se informan deben ser enteros ≥ 0 y las ejecutadas no pueden superar a las contratadas', () => {
  const caso = (cambio) => validarNotaCredito({ ...notaOk(), ...cambio }, { boleta: boleta(), notas: [] });
  assert.equal(caso({ visitasContratadas: 12, visitasEjecutadas: 6 }).ok, true);
  assert.equal(caso({ visitasContratadas: null, visitasEjecutadas: null }).ok, true);
  assert.equal(caso({ visitasContratadas: 12, visitasEjecutadas: 13 }).ok, false);
  assert.equal(caso({ visitasContratadas: -1 }).ok, false);
  assert.equal(caso({ visitasEjecutadas: 1.5 }).ok, false);
});

test('avisosNotaCredito: avisa (sin bloquear) si pasaron más de 6 meses entre la boleta y la nota', () => {
  const av = (b, n) => avisosNotaCredito({ fechaBoleta: fecha(b), fechaNota: fecha(n) });
  assert.deepEqual(av('2026-03-15', '2026-09-15'), [], 'exactamente 6 meses: sin aviso');
  assert.equal(av('2026-03-15', '2026-09-16').length, 1);
  assert.equal(av('2026-03-15', '2026-09-16')[0].codigo, 'plazo-6-meses');
  assert.match(av('2026-03-15', '2026-09-16')[0].texto, /IVA podría no ser recuperable/);
  assert.deepEqual(av('2026-08-31', '2027-02-28'), [], 'fin de mes: 31-ago + 6 meses = 28-feb');
  assert.equal(av('2026-08-31', '2027-03-01').length, 1);
  assert.deepEqual(av('2026-10-15', '2026-10-20'), []);
});

test('avisosNotaCredito: avisa si pasaron más de 30 días desde el término del servicio, solo si se informa esa fecha', () => {
  const av = (term, n) => avisosNotaCredito({ fechaBoleta: fecha('2026-10-01'), fechaNota: fecha(n), fechaTerminoServicio: term ? fecha(term) : null });
  assert.deepEqual(av(null, '2026-12-31'), [], 'sin fecha de término no hay aviso de 30 días');
  assert.deepEqual(av('2026-10-10', '2026-11-09'), [], 'exactamente 30 días');
  const r = av('2026-10-10', '2026-11-10');
  assert.equal(r.length, 1);
  assert.equal(r[0].codigo, 'plazo-30-dias');
  assert.deepEqual(av('2026-11-05', '2026-11-01'), [], 'término posterior a la nota: sin aviso');
});

test('avisosNotaCredito: pueden salir los dos avisos a la vez y los plazos son configurables', () => {
  const dos = avisosNotaCredito({ fechaBoleta: fecha('2026-01-01'), fechaNota: fecha('2026-09-01'), fechaTerminoServicio: fecha('2026-06-01') });
  assert.deepEqual(dos.map((a) => a.codigo), ['plazo-6-meses', 'plazo-30-dias']);
  assert.equal(avisosNotaCredito({ fechaBoleta: fecha('2026-01-01'), fechaNota: fecha('2026-09-01') }, { plazoMeses: 12 }).length, 0);
  assert.equal(avisosNotaCredito({ fechaBoleta: fecha('2026-10-01'), fechaNota: fecha('2026-10-05'), fechaTerminoServicio: fecha('2026-10-01') }, { plazoDias: 2 }).length, 1);
});

test('filaDeNota: fila del libro con importes en negativo (resta del ingreso y del débito), tipo Ingreso, afecta a IVA', () => {
  const f = filaDeNota('n9', {
    folio: '77', fecha: '2026-10-20', montoBruto: 119, neto: 100, iva: 19, motivo: 'Devolución', codigoReferencia: 1,
    medioDevolucion: 'Reversa Transbank', refOrigen: 'Webpay', refId: 'ord1', refFolio: 'GC-1', refFecha: '2026-10-15', rut: '11.111.111-1', concepto: 'Cliente Ficticio',
  });
  assert.equal(f.id, 'n9');
  assert.equal(f.origen, 'Nota de crédito');
  assert.equal(f.tipo, 'Ingreso');
  assert.equal(f.dte, TIPO_DTE_NOTA);
  assert.deepEqual([f.neto, f.impuesto, f.total], [-100, -19, -119]);
  assert.equal(f.fecha.getFullYear(), 2026);
  assert.equal(f.fecha.getMonth(), 9);
  assert.equal(f.categoria, 'Venta de Planes');
  assert.equal(f.clasificacionF22, 'Ingreso Bruto');
  assert.match(f.descripcion, /GC-1/);
  assert.match(f.descripcion, /Devolución/);
});

test('filaDeNota: si el documento no trae neto e IVA, los deduce del monto bruto', () => {
  const f = filaDeNota('n1', { folio: '1', fecha: '2026-10-20', montoBruto: 100, refFolio: 'X' });
  assert.deepEqual([f.neto, f.impuesto, f.total], [-84, -16, -100]);
});

// --- Criterios de aceptación de B-3 sobre la liquidación mensual (ingreso neto y débito de IVA) ---
test('B-3: boleta de 100 + nota de crédito de 100 por la misma orden ⇒ ingreso neto del mes 0 y débito de IVA 0', () => {
  const b = boleta({ neto: 84, impuesto: 16, total: 100 });
  const n = filaDeNota('n1', { folio: '1', fecha: '2026-10-20', montoBruto: 100, refFolio: 'GC-1' });
  const sola = calcularLiquidacion([b], 2026, 9);
  assert.equal(sola.debitoMes, 16);
  const conNota = calcularLiquidacion([b, n], 2026, 9);
  assert.equal(conNota.totalIngresosNetos, 0);
  assert.equal(conNota.debitoMes, 0);
  assert.equal(conNota.mesesData[9].ingresosNetos, 0);
  assert.equal(conNota.mesesData[9].debito, 0);
});

test('B-3: la nota resta del mes de SU fecha (no del de la boleta) y una nota parcial resta proporcionalmente', () => {
  const b = boleta({ neto: 100, impuesto: 19, total: 119, fecha: fecha('2026-09-10') });
  const n = filaDeNota('n1', { folio: '1', fecha: '2026-10-20', montoBruto: 59, neto: 50, iva: 9, refFolio: 'GC-1' });
  const r = calcularLiquidacion([b, n], 2026, 9);
  assert.equal(r.mesesData[8].debito, 19, 'septiembre queda igual');
  assert.equal(r.mesesData[9].debito, -9, 'octubre queda con el débito rebajado');
  assert.equal(r.mesesData[9].ingresosNetos, -50);
  assert.equal(r.debitoMes, -9);
  assert.equal(r.totalIngresosNetos, 50);
});

test('calcularLiquidacion conserva el cálculo previo para gastos, facturas y boletas (sin notas)', () => {
  const movs = [
    { tipo: 'Ingreso', dte: 'Boleta Venta', fecha: fecha('2026-10-02'), neto: 1000, impuesto: 190, total: 1190 },
    { tipo: 'Ingreso', dte: 'Factura Exenta', fecha: fecha('2026-10-03'), neto: 500, impuesto: 0, total: 500 },
    { tipo: 'Gasto', dte: 'Factura Afecta', fecha: fecha('2026-10-04'), neto: 400, impuesto: 76, total: 476 },
    { tipo: 'Gasto', dte: 'Boleta Honorarios', fecha: fecha('2026-10-05'), neto: 200, impuesto: 30, total: 170 },
    { tipo: 'Gasto', dte: 'Factura Afecta', fecha: fecha('2025-10-04'), neto: 999, impuesto: 190, total: 1189 },
  ];
  const r = calcularLiquidacion(movs, 2026, 9);
  assert.equal(r.totalIngresosNetos, 1500);
  assert.equal(r.totalGastosNetos, 400 + 200 + 999);
  assert.equal(r.totalIvaDebito, 190);
  assert.equal(r.totalIvaCredito, 76 + 190);
  assert.equal(r.debitoMes, 190);
  assert.equal(r.creditoMes, 76);
  assert.equal(r.mesesData.length, 12);
  assert.equal(r.mesesData[9].gastosNetos, 600);
});

test('cuentaComoIngreso no cambia: sigue exigiendo estado Confirmado y excluyendo integración (la nota no habilita órdenes)', () => {
  assert.equal(cuentaComoIngreso({ pagoConfirmado: true, estado: 'Confirmado', modoPago: 'produccion' }), true);
  assert.equal(cuentaComoIngreso({ pagoConfirmado: true, estado: 'Confirmado', modoPago: 'integracion' }), false);
  assert.equal(cuentaComoIngreso({ pagoConfirmado: true, estado: 'inscripcion_iniciada' }), false);
});
