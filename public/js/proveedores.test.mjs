import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validarRut, validarProveedor, opcionesProveedores, datosDeProveedor, condicionPorDefecto, OPCION_OTRO,
  validarCorreo, correoDeProveedor, REGEX_CORREO,
} from './proveedores.js';

const doc = (id, data) => ({ id, data });

const PROVEEDOR_OK = {
  razonSocial: 'Floristería Los Olivos Ltda.',
  rut: '76.543.210-3',
  contacto: 'Ana Pérez',
  telefono: '+56 9 1234 5678',
  direccion: 'Av. Principal 123, Maipú',
  condicionesPago: 'Factura a 30 días',
  activo: true,
};

test('validarRut acepta RUT con y sin puntos, con dígito K y devuelve la forma normalizada (CA-P2)', () => {
  const con = validarRut('12.345.678-5');
  assert.equal(con.ok, true);
  assert.equal(con.normalizado, '12345678-5');
  assert.equal(con.formateado, '12.345.678-5');
  assert.equal(validarRut('12345678-5').ok, true);
  assert.equal(validarRut('30.000.007-K').ok, true);
  assert.equal(validarRut('30.000.007-k').normalizado, '30000007-K');
});

test('validarRut rechaza un dígito verificador incorrecto, un formato malo o un texto vacío (CA-P2)', () => {
  const malo = validarRut('12.345.678-6');
  assert.equal(malo.ok, false);
  assert.match(malo.errores[0], /dígito verificador/);
  assert.equal(validarRut('abc').ok, false);
  assert.equal(validarRut('').ok, false);
  assert.equal(validarRut('12.345.678').ok, false);
});

test('validarProveedor deja un proveedor completo con su RUT normalizado (CA-P1)', () => {
  const r = validarProveedor(PROVEEDOR_OK);
  assert.equal(r.ok, true);
  assert.equal(r.datos.razonSocial, 'Floristería Los Olivos Ltda.');
  assert.equal(r.datos.rut, '76.543.210-3');
  assert.equal(r.datos.rutNormalizado, '76543210-3');
  assert.equal(r.datos.condicionesPago, 'Factura a 30 días');
  assert.equal(r.datos.activo, true);
});

test('validarProveedor exige razón social, RUT válido y condición de la lista', () => {
  const sinRazon = validarProveedor({ ...PROVEEDOR_OK, razonSocial: '   ' });
  assert.equal(sinRazon.ok, false);
  assert.match(sinRazon.errores.join(' '), /razón social/);
  assert.equal(validarProveedor({ ...PROVEEDOR_OK, rut: '76.543.210-9' }).ok, false);
  assert.equal(validarProveedor({ ...PROVEEDOR_OK, condicionesPago: 'Crédito' }).ok, false);
});

test('validarProveedor respeta los largos máximos y el formato del teléfono', () => {
  assert.equal(validarProveedor({ ...PROVEEDOR_OK, razonSocial: 'x'.repeat(121) }).ok, false);
  assert.equal(validarProveedor({ ...PROVEEDOR_OK, contacto: 'x'.repeat(81) }).ok, false);
  assert.equal(validarProveedor({ ...PROVEEDOR_OK, direccion: 'x'.repeat(201) }).ok, false);
  assert.equal(validarProveedor({ ...PROVEEDOR_OK, telefono: '12 abc' }).ok, false);
  assert.equal(validarProveedor({ ...PROVEEDOR_OK, telefono: '' }).ok, true);
});

test('opcionesProveedores solo muestra los activos, ordenados por razón social en español (CA-O2)', () => {
  const docs = [
    doc('p3', { razonSocial: 'Zeta', activo: true }),
    doc('p1', { razonSocial: 'Árbol Verde', activo: true }),
    doc('p2', { razonSocial: 'Bodega', activo: false }),
    doc('p4', { razonSocial: 'Cacao', activo: true }),
  ];
  assert.deepEqual(opcionesProveedores(docs).map((o) => o.razonSocial), ['Árbol Verde', 'Cacao', 'Zeta']);
  assert.deepEqual(opcionesProveedores(docs).map((o) => o.id), ['p1', 'p4', 'p3']);
  assert.deepEqual(opcionesProveedores(null), []);
  assert.equal(OPCION_OTRO.razonSocial, 'Otro proveedor (escribir)');
});

test('datosDeProveedor devuelve los cinco datos que se rellenan en la OC (CA-O1)', () => {
  assert.deepEqual(datosDeProveedor(doc('p1', PROVEEDOR_OK)), {
    razonSocial: 'Floristería Los Olivos Ltda.',
    rut: '76.543.210-3',
    contacto: 'Ana Pérez',
    telefono: '+56 9 1234 5678',
    direccion: 'Av. Principal 123, Maipú',
  });
});

test('condicionPorDefecto usa la del proveedor y cae en Transferencia si no tiene una válida (CA-O1)', () => {
  assert.equal(condicionPorDefecto(doc('p1', PROVEEDOR_OK)), 'Factura a 30 días');
  assert.equal(condicionPorDefecto(doc('p2', { ...PROVEEDOR_OK, condicionesPago: 'Crédito' })), 'Transferencia');
  assert.equal(condicionPorDefecto(doc('p3', {})), 'Transferencia');
});

// ---- Spec 058: correo electrónico del proveedor (CA1, R2, R4)
test('spec 058: la regex del correo es la de las reglas de Firestore publicadas', () => {
  assert.equal(REGEX_CORREO.source, '^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+([.][A-Za-z0-9-]+)*[.][A-Za-z]{2,}$');
});

test('spec 058: validarCorreo acepta una dirección válida y la devuelve recortada', () => {
  for (const ok of ['ventas@ejemplo.test', '  ventas@ejemplo.test  ', 'a.b+c_d%e-f@sub.dominio.ejemplo.cl', 'X@y.co']) {
    const r = validarCorreo(ok);
    assert.equal(r.ok, true, ok);
    assert.equal(r.valor, ok.trim());
    assert.deepEqual(r.errores, []);
  }
});

test('spec 058: validarCorreo acepta vacío, solo espacios, nulo y ausente (se guarda cadena vacía)', () => {
  for (const vacio of ['', '   ', null, undefined]) {
    const r = validarCorreo(vacio);
    assert.equal(r.ok, true);
    assert.equal(r.valor, '');
  }
});

test('spec 058: validarCorreo rechaza sin @, con espacio, con coma o punto y coma, con salto de línea y de más de 120', () => {
  const malos = [
    'ventas.ejemplo.test', 'ventas@', '@ejemplo.test', 'ventas@ejemplo', 'ven tas@ejemplo.test', 'ventas@ejem plo.test',
    'a@ejemplo.test,b@ejemplo.test', 'a@ejemplo.test;b@ejemplo.test', 'a@ejemplo.test\nb@ejemplo.test', 'a@ejemplo.test\r\nCc: x@y.cl',
    'ventas@ejemplo..test', 'ventas@ejemplo.t', '<a@ejemplo.test>', 'ñandú@ejemplo.test',
    `${'a'.repeat(108)}@ejemplo.test`, // 121 caracteres
  ];
  for (const m of malos) {
    const r = validarCorreo(m);
    assert.equal(r.ok, false, JSON.stringify(m));
    assert.ok(r.errores.length >= 1);
    assert.match(r.errores[0], /correo/i);
  }
  assert.equal(validarCorreo(`${'a'.repeat(107)}@ejemplo.test`).ok, true, '120 caracteres exactos sí');
  assert.equal(validarCorreo(12345).ok, false, 'un número no es un correo');
  assert.equal(validarCorreo({ correo: 'a@b.cl' }).ok, false);
});

test('spec 058: validarProveedor con correo: ausente y vacío son válidos; malo falla junto con los demás errores; válido va recortado', () => {
  const ausente = validarProveedor(PROVEEDOR_OK);
  assert.equal(ausente.ok, true);
  assert.equal('correo' in ausente.datos, false, 'sin correo no hay clave correo');
  const vacio = validarProveedor({ ...PROVEEDOR_OK, correo: '  ' });
  assert.equal(vacio.ok, true);
  assert.equal(vacio.datos.correo, '');
  const bueno = validarProveedor({ ...PROVEEDOR_OK, correo: ' ventas@ejemplo.test ' });
  assert.equal(bueno.ok, true);
  assert.equal(bueno.datos.correo, 'ventas@ejemplo.test');
  const malo = validarProveedor({ ...PROVEEDOR_OK, razonSocial: '', correo: 'sin-arroba' });
  assert.equal(malo.ok, false);
  assert.equal(malo.errores.length, 2, 'avisa de la razón social y del correo');
  assert.ok(malo.errores.some((e) => /correo/i.test(e)));
});

test('spec 058: correoDeProveedor devuelve el correo (vacío si falta) y datosDeProveedor NO lo copia a la OC', () => {
  assert.equal(correoDeProveedor(doc('p1', { ...PROVEEDOR_OK, correo: ' ventas@ejemplo.test ' })), 'ventas@ejemplo.test');
  assert.equal(correoDeProveedor(doc('p1', PROVEEDOR_OK)), '');
  assert.equal(correoDeProveedor(doc('p1', { ...PROVEEDOR_OK, correo: null })), '');
  assert.equal(correoDeProveedor(null), '');
  assert.deepEqual(Object.keys(datosDeProveedor(doc('p1', { ...PROVEEDOR_OK, correo: 'ventas@ejemplo.test' }))), ['razonSocial', 'rut', 'contacto', 'telefono', 'direccion']);
});
