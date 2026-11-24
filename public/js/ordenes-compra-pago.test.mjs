import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ESTADOS_OC, MAX_COMENTARIO, transicionesDisponibles, validarPago, validarComentario, textoReversion, puedeRegistrarPago,
} from './ordenes-compra-pago.js';

// --- Estados y transiciones (spec 063, R1, R2, R4, CA16) ---

test('R1: hay exactamente tres estados de orden', () => {
  assert.deepEqual(ESTADOS_OC, ['Emitida', 'Pagada', 'Anulada']);
});

test('CA16: desde Emitida se ofrece Pagada y, solo al dueño, Anulada', () => {
  assert.deepEqual(transicionesDisponibles({ estado: 'Emitida', puedePago: true, puedeAnular: true }), ['Emitida', 'Pagada', 'Anulada']);
  assert.deepEqual(transicionesDisponibles({ estado: 'Emitida', puedePago: true, puedeAnular: false }), ['Emitida', 'Pagada']);
});

test('CA16: sin permiso de pago solo se ofrece el estado actual', () => {
  assert.deepEqual(transicionesDisponibles({ estado: 'Emitida', puedePago: false, puedeAnular: false }), ['Emitida']);
  assert.deepEqual(transicionesDisponibles({ estado: 'Pagada', puedePago: false, puedeAnular: false }), ['Pagada']);
});

test('R2: desde Pagada se puede volver a Emitida (reversión) pero nunca a Anulada (D4)', () => {
  assert.deepEqual(transicionesDisponibles({ estado: 'Pagada', puedePago: true, puedeAnular: true }), ['Pagada', 'Emitida']);
});

test('R2: Anulada es definitiva; un estado desconocido no ofrece nada', () => {
  assert.deepEqual(transicionesDisponibles({ estado: 'Anulada', puedePago: true, puedeAnular: true }), ['Anulada']);
  assert.deepEqual(transicionesDisponibles({ estado: 'Borrador', puedePago: true, puedeAnular: true }), []);
  assert.deepEqual(transicionesDisponibles({}), []);
});

// --- Pago: N° de factura y fecha (R5, CA2, CA3) ---

const BASE = { facturaNumero: 'F-1234', fechaPago: '2026-11-23', fechaOrden: '2026-11-20', hoy: '2026-11-23' };

test('CA1: un pago válido devuelve los datos limpios (factura sin espacios sobrantes)', () => {
  const r = validarPago({ ...BASE, facturaNumero: '  F-1234 ' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.datos, { facturaNumero: 'F-1234', fechaPago: '2026-11-23' });
});

test('CA2: la factura es obligatoria y no pasa de 20 caracteres', () => {
  for (const mala of ['', '   ', undefined, null]) {
    const r = validarPago({ ...BASE, facturaNumero: mala });
    assert.equal(r.ok, false);
    assert.match(r.errores.join(' '), /factura/i);
  }
  assert.equal(validarPago({ ...BASE, facturaNumero: '1'.repeat(20) }).ok, true);
  assert.equal(validarPago({ ...BASE, facturaNumero: '1'.repeat(21) }).ok, false);
});

test('CA2: la factura solo admite letras, números, espacio, punto, barra y guion, y no empieza con símbolo', () => {
  for (const buena of ['123', 'F-1234', 'A/45', '12.345', 'FAC 77']) assert.equal(validarPago({ ...BASE, facturaNumero: buena }).ok, true, buena);
  for (const mala of ['-123', '.1', '12;34', '<b>1</b>', '1,2', 'ñ12', 'F\n12']) assert.equal(validarPago({ ...BASE, facturaNumero: mala }).ok, false, mala);
});

test('CA3: la fecha de pago es obligatoria y debe ser una fecha real', () => {
  for (const mala of ['', undefined, '2026-02-30', '2026-13-01', '23-11-2026', '2026/11/23', '2026-11-3']) {
    const r = validarPago({ ...BASE, fechaPago: mala });
    assert.equal(r.ok, false, String(mala));
    assert.match(r.errores.join(' '), /fecha de pago/i);
  }
});

test('CA3: la fecha de pago no puede ser anterior a la de la orden ni futura', () => {
  assert.equal(validarPago({ ...BASE, fechaPago: '2026-11-19' }).ok, false);
  assert.match(validarPago({ ...BASE, fechaPago: '2026-11-19' }).errores.join(' '), /anterior/i);
  assert.equal(validarPago({ ...BASE, fechaPago: '2026-11-24' }).ok, false);
  assert.match(validarPago({ ...BASE, fechaPago: '2026-11-24' }).errores.join(' '), /futura/i);
  assert.equal(validarPago({ ...BASE, fechaPago: '2026-11-20' }).ok, true); // el mismo día de la orden vale
  assert.equal(validarPago({ ...BASE, fechaPago: '2026-11-23' }).ok, true); // hoy vale
});

test('CA3: se informan todos los errores juntos', () => {
  const r = validarPago({ facturaNumero: '', fechaPago: '', fechaOrden: '2026-11-20', hoy: '2026-11-23' });
  assert.equal(r.ok, false);
  assert.equal(r.errores.length, 2);
});

// --- Comentario (R6, CA10) ---

test('CA10: el comentario admite 0, 1 y 500 caracteres y rechaza 501 (tras trim)', () => {
  assert.deepEqual(validarComentario(''), { ok: true, errores: [], comentario: '' });
  assert.deepEqual(validarComentario(undefined), { ok: true, errores: [], comentario: '' });
  assert.equal(validarComentario('a').comentario, 'a');
  assert.equal(MAX_COMENTARIO, 500);
  assert.equal(validarComentario('a'.repeat(500)).ok, true);
  assert.equal(validarComentario(`  ${'a'.repeat(500)}  `).ok, true); // el trim cuenta antes del tope
  const largo = validarComentario('a'.repeat(501));
  assert.equal(largo.ok, false);
  assert.match(largo.errores.join(' '), /500/);
});

test('CA10/CA14: el comentario conserva el texto tal cual (el escape es de las vistas) y los saltos de línea', () => {
  const r = validarComentario('  <script>x</script>\nsegunda línea ');
  assert.equal(r.ok, true);
  assert.equal(r.comentario, '<script>x</script>\nsegunda línea');
});

test('el comentario que no es texto se rechaza', () => {
  assert.equal(validarComentario(42).ok, false);
  assert.equal(validarComentario({}).ok, false);
});

// --- Reversión (R9, CA5, CA6) ---

test('CA5: la reversión antepone lo que se quita y deja el motivo', () => {
  const r = textoReversion({ facturaNumero: 'F-1234', fechaPago: '2026-11-23', motivo: ' Se marcó por error ' });
  assert.equal(r.ok, true);
  assert.equal(r.texto, 'Se quitó: factura N° F-1234 y fecha de pago 2026-11-23. Motivo: Se marcó por error');
});

test('CA6: la reversión exige motivo', () => {
  for (const sin of ['', '   ', undefined]) {
    const r = textoReversion({ facturaNumero: 'F-1', fechaPago: '2026-11-23', motivo: sin });
    assert.equal(r.ok, false);
    assert.match(r.errores.join(' '), /motivo/i);
  }
});

test('R9: el texto completo cabe en 500 caracteres; si no, se rechaza avisando', () => {
  const justo = 'm'.repeat(500 - 'Se quitó: factura N° F-1 y fecha de pago 2026-11-23. Motivo: '.length);
  assert.equal(textoReversion({ facturaNumero: 'F-1', fechaPago: '2026-11-23', motivo: justo }).ok, true);
  const pasado = textoReversion({ facturaNumero: 'F-1', fechaPago: '2026-11-23', motivo: `${justo}x` });
  assert.equal(pasado.ok, false);
  assert.match(pasado.errores.join(' '), /500/);
});

test('R9: si no había nada anotado, el texto es solo el motivo', () => {
  const r = textoReversion({ facturaNumero: '', fechaPago: '', motivo: 'Corrección' });
  assert.equal(r.ok, true);
  assert.equal(r.texto, 'Corrección');
});

// --- Quién puede (R4) ---

test('R4: registran pagos el dueño y el administrador; supervisor, operador y sin perfil, no', () => {
  assert.equal(puedeRegistrarPago({ dueno: true, rol: 'supervisor' }), true);
  assert.equal(puedeRegistrarPago({ rol: 'administrador' }), true);
  assert.equal(puedeRegistrarPago({ rol: 'Admin' }), true);
  assert.equal(puedeRegistrarPago({ rol: 'ADMINISTRADOR' }), true);
  assert.equal(puedeRegistrarPago({ rol: 'supervisor' }), false);
  assert.equal(puedeRegistrarPago({ rol: 'operador' }), false);
  assert.equal(puedeRegistrarPago({ dueno: 'true' }), false); // solo el booleano verdadero, como las reglas
  assert.equal(puedeRegistrarPago({}), false);
  assert.equal(puedeRegistrarPago(null), false);
  assert.equal(puedeRegistrarPago(undefined), false);
});
