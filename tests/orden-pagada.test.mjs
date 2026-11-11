// N80 (directriz B-2): criterio de orden pagada e ingreso tributario. Ejecutar:  node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esOrdenPagada, esOrdenDePrueba, cuentaComoIngreso, fechaDelIngreso, esCierreOperativoAntiguo } from '../public/js/orden-pagada.js';

// Datos como los de producción al 2026-11-08: 5 Confirmado con pagoConfirmado true y 2 iniciada con monto.
const ORDENES_PRODUCCION = [
  ...[1, 2, 3, 4, 5].map((n) => ({ id: `p${n}`, estado: 'Confirmado', pagoConfirmado: true, montoTotal: 100000 * n, modoPago: 'produccion' })),
  { id: 'i1', estado: 'iniciada', pagoConfirmado: false, montoTotal: 259960 },
  { id: 'i2', estado: 'iniciada', pagoConfirmado: false, montoTotal: 129990 },
];

test('con los datos de producción, el ingreso suma solo las 5 órdenes Confirmado', () => {
  const ingresos = ORDENES_PRODUCCION.filter(cuentaComoIngreso);
  assert.deepEqual(ingresos.map((o) => o.id), ['p1', 'p2', 'p3', 'p4', 'p5']);
  assert.equal(ingresos.reduce((s, o) => s + o.montoTotal, 0), 1500000);
});

test('con los datos de producción, las listas de trabajo no incluyen las 2 iniciada', () => {
  const trabajos = ORDENES_PRODUCCION.filter(esOrdenPagada);
  assert.equal(trabajos.length, 5);
  assert.ok(trabajos.every((o) => o.estado === 'Confirmado'));
});

for (const estado of ['cancelado', 'rechazado', 'vencida', 'monto_inconsistente', 'iniciada', 'pendiente']) {
  test(`una orden «${estado}» sin pago no es trabajo ni ingreso`, () => {
    const orden = { estado, pagoConfirmado: false, montoTotal: 50000, motivoSinPago: estado };
    assert.equal(esOrdenPagada(orden), false);
    assert.equal(cuentaComoIngreso(orden), false);
  });
}

test('Oneclick inscrito (pagoConfirmado true sin estado Confirmado) es pagada para operar, pero no suma ingreso (C2)', () => {
  const orden = { estado: 'inscripcion_iniciada', pagoConfirmado: true, montoTotal: 89990 };
  assert.equal(esOrdenPagada(orden), true);
  assert.equal(cuentaComoIngreso(orden), false);
});

test('una orden Confirmado de integración (prueba) es trabajo, pero no suma ingreso (B-1)', () => {
  const orden = { estado: 'Confirmado', pagoConfirmado: true, montoTotal: 89990, modoPago: 'integracion' };
  assert.equal(esOrdenPagada(orden), true);
  assert.equal(esOrdenDePrueba(orden), true);
  assert.equal(cuentaComoIngreso(orden), false);
});

test('estado Confirmado sin el campo pagoConfirmado (orden antigua) es pagada e ingreso', () => {
  const orden = { estado: 'Confirmado', montoTotal: 10000 };
  assert.equal(esOrdenPagada(orden), true);
  assert.equal(cuentaComoIngreso(orden), true);
});

test('campos ausentes o documento vacío no rompen y no cuentan', () => {
  for (const orden of [undefined, null, {}, { pagoConfirmado: 'true' }, { estado: 'confirmado' }, { pagado: true }]) {
    assert.equal(esOrdenPagada(orden), false);
    assert.equal(cuentaComoIngreso(orden), false);
    assert.equal(esOrdenDePrueba(orden), false);
  }
});

test('la fecha del ingreso sale de fechaPago cuando existe', () => {
  const fechaPago = { seconds: 1762560000, nanoseconds: 0 };
  assert.equal(fechaDelIngreso({ fechaPago, creadoEl: 'otra' }), fechaPago);
  assert.equal(fechaDelIngreso({ creadoEl: '2026-11-01' }), '2026-11-01');
  assert.equal(fechaDelIngreso({ createdAt: 'c' }), 'c');
  assert.equal(fechaDelIngreso({}), null);
  assert.equal(fechaDelIngreso(null), null);
});

// Cierre operativo: el backoffice ya no pisa `estado`, y los cierres antiguos no hacen perder ingreso histórico.
test('cierre antiguo: pagoConfirmado + fechaPago + estado «completada» (pisado) sigue contando como ingreso', () => {
  const orden = { estado: 'completada', pagoConfirmado: true, fechaPago: '2026-10-01T10:00:00.000Z', modoPago: 'produccion', montoTotal: 100000 };
  assert.equal(esOrdenPagada(orden), true);
  assert.equal(cuentaComoIngreso(orden), true);
  assert.equal(esCierreOperativoAntiguo(orden), true);
});

test('cierre antiguo: la excepción no abre la puerta a Oneclick sin cobro, a pruebas ni a órdenes sin pago', () => {
  assert.equal(cuentaComoIngreso({ estado: 'completada', pagoConfirmado: true, modoPago: 'produccion' }), false, 'sin fechaPago no hay evidencia de cobro');
  assert.equal(cuentaComoIngreso({ estado: 'completada', pagoConfirmado: true, fechaPago: '2026-10-01', modoPago: 'integracion' }), false);
  assert.equal(cuentaComoIngreso({ estado: 'completada', pagoConfirmado: false, fechaPago: '2026-10-01' }), false);
  assert.equal(cuentaComoIngreso({ estado: 'inscripcion_iniciada', pagoConfirmado: true, fechaPago: '2026-10-01' }), false);
});

test('una orden Confirmado con cierre operativo nuevo (estadoOperativo) conserva su estado y cuenta como ingreso', () => {
  const orden = { estado: 'Confirmado', pagoConfirmado: true, estadoOperativo: 'completada', fechaPago: '2026-10-01' };
  assert.equal(cuentaComoIngreso(orden), true);
  assert.equal(esCierreOperativoAntiguo(orden), false);
});
