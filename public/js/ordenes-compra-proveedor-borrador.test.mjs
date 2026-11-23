import test from 'node:test';
import assert from 'node:assert/strict';
import { simuladorFirestore } from '../../tests/helpers/firestore-simulado.mjs';
import { emitirOrden, emitirDesdeBorrador, crearBorradorDia } from './ordenes-compra-db.js';
import { editarProveedor } from './proveedores-db.js';

const AHORA = new Date('2026-12-01T15:30:00.000Z');
const ISO = '2026-12-01T15:30:00.000Z';

const PROVEEDOR = {
  razonSocial: 'Flores del Sur SpA', rut: '76.543.210-3', contacto: 'Ana Pérez', telefono: '+56 9 1234 5678',
  direccion: 'Calle 1, Maipú', condicionesPago: 'Transferencia', activo: true,
};

const LINEAS_BORRADOR = [
  { codigo: 'RAM-STD', descripcion: 'Ramo Standard', unidad: 'UNI', cantidad: 1, precioUnitario: 10000, valor: 10000 },
  { codigo: 'RAM-ADP', descripcion: 'Ramo Adicional Premium', unidad: 'UNI', cantidad: 2, precioUnitario: 12000, valor: 24000 },
];

function entorno(inicial = {}) {
  const s = simuladorFirestore({ inicial: { 'proveedores/p1': PROVEEDOR, ...inicial } });
  const refs = {
    contador: () => s.refs.ref('contadores/ordenesCompra'),
    orden: (numero) => s.refs.ref(`ordenesCompra/${numero}`),
    proveedor: (id) => s.refs.ref(`proveedores/${id}`),
    proveedorNuevo: () => s.refs.nuevoId('proveedores'),
    rut: (rut) => s.refs.ref(`proveedoresRut/${rut}`),
    borrador: (id) => s.refs.ref(`ordenesCompraBorradores/${id}`),
  };
  return { s, base: { ejecutarTransaccion: s.ejecutarTransaccion, refs } };
}

const DATOS_OC = () => ({
  fecha: '2026-12-01', fechaEntrega: '2026-12-03', condicionesPago: 'Transferencia', lugarEntrega: 'Bodega',
  proveedor: { razonSocial: 'Flores del Sur SpA', rut: '76.543.210-3', contacto: 'Ana Pérez', telefono: '+56 9 1234 5678', direccion: 'Calle 1, Maipú' },
  lineas: [{ codigo: 'RAM-STD', descripcion: 'Ramo Standard', unidad: 'UNI', cantidad: 1, precioUnitario: 10000, valor: 10000 }],
});

test('emitir con proveedor activo guarda el número, el id del proveedor y una copia de sus datos (R-O2, R-O3)', async () => {
  const { s, base } = entorno();
  const r = await emitirOrden({ ...base, datos: DATOS_OC(), proveedorId: 'p1', uid: 'u1', ahora: AHORA });
  assert.equal(r.numero, 'OC-0001');
  const orden = s.almacen.get('ordenesCompra/OC-0001');
  assert.equal(orden.proveedorId, 'p1');
  assert.deepEqual(orden.proveedor, {
    razonSocial: 'Flores del Sur SpA', rut: '76.543.210-3', contacto: 'Ana Pérez', telefono: '+56 9 1234 5678', direccion: 'Calle 1, Maipú',
  });
  assert.equal(s.almacen.get('contadores/ordenesCompra').ultimo, 1);
});

test('CA-O4: emitir con un proveedor quitado se rechaza, no consume número y no escribe nada', async () => {
  const { s, base } = entorno({ 'proveedores/p1': { ...PROVEEDOR, activo: false } });
  await assert.rejects(
    emitirOrden({ ...base, datos: DATOS_OC(), proveedorId: 'p1', uid: 'u1', ahora: AHORA }),
    (e) => e.code === 'proveedor-inactivo' && /El proveedor ya no está activo; elige otro/.test(e.message),
  );
  assert.equal(s.escrituras.length, 0);
  assert.equal(s.almacen.has('contadores/ordenesCompra'), false);
});

test('emitir con un proveedor que no existe se rechaza igual que uno quitado', async () => {
  const { base } = entorno();
  await assert.rejects(emitirOrden({ ...base, datos: DATOS_OC(), proveedorId: 'nada', uid: 'u1', ahora: AHORA }), /ya no está activo/);
});

test('CA-O3: si el maestro cambia después de emitir, la OC conserva los datos del momento', async () => {
  const { s, base } = entorno();
  await emitirOrden({ ...base, datos: DATOS_OC(), proveedorId: 'p1', uid: 'u1', ahora: AHORA });
  await editarProveedor({ ...base, id: 'p1', cambios: { direccion: 'Otra calle 9', contacto: 'Luis' }, uid: 'u2', ahora: AHORA });
  const orden = s.almacen.get('ordenesCompra/OC-0001');
  assert.equal(orden.proveedor.direccion, 'Calle 1, Maipú');
  assert.equal(orden.proveedor.contacto, 'Ana Pérez');
});

test('emitir sin proveedorId (proveedor escrito a mano) sigue funcionando como en la spec 055', async () => {
  const { s, base } = entorno();
  await emitirOrden({ ...base, datos: DATOS_OC(), uid: 'u1', ahora: AHORA });
  const orden = s.almacen.get('ordenesCompra/OC-0001');
  assert.equal(orden.proveedor.razonSocial, 'Flores del Sur SpA');
  assert.equal(Object.prototype.hasOwnProperty.call(orden, 'proveedorId'), false);
});

test('CA-B5: emitir desde un borrador crea la OC con número y marca el borrador en la misma transacción', async () => {
  const { s, base } = entorno({
    'ordenesCompraBorradores/2026-12-01': { fechaDia: '2026-12-01', lineas: LINEAS_BORRADOR, estado: 'Borrador', creadoPor: 'u1', creadoEl: ISO },
  });
  const r = await emitirDesdeBorrador({ ...base, idBorrador: '2026-12-01', datos: DATOS_OC(), proveedorId: 'p1', uid: 'u1', ahora: AHORA });
  assert.equal(r.numero, 'OC-0001');
  assert.equal(s.almacen.get('ordenesCompraBorradores/2026-12-01').emitidoComo, 'OC-0001');
  assert.equal(s.almacen.get('ordenesCompra/OC-0001').estado, 'Emitida');
  assert.equal(s.almacen.get('contadores/ordenesCompra').ultimo, 1);
});

test('CA-B5: un borrador ya emitido no se vuelve a emitir y el contador no sube', async () => {
  const { s, base } = entorno({
    'ordenesCompraBorradores/2026-12-01': { fechaDia: '2026-12-01', lineas: LINEAS_BORRADOR, estado: 'Borrador', emitidoComo: 'OC-0001' },
  });
  await assert.rejects(
    emitirDesdeBorrador({ ...base, idBorrador: '2026-12-01', datos: DATOS_OC(), proveedorId: 'p1', uid: 'u1', ahora: AHORA }),
    /ya se emitió/,
  );
  assert.equal(s.almacen.has('contadores/ordenesCompra'), false);
  assert.equal(s.almacen.has('ordenesCompra/OC-0001'), false);
});

test('emitir desde un borrador que no existe falla con un aviso claro', async () => {
  const { base } = entorno();
  await assert.rejects(emitirDesdeBorrador({ ...base, idBorrador: '2026-12-02', datos: DATOS_OC(), uid: 'u1', ahora: AHORA }), /no existe/);
});

test('CA-B4: crear el borrador de un día no asigna número ni toca el contador', async () => {
  const { s, base } = entorno();
  const r = await crearBorradorDia({ ...base, id: '2026-12-01', datos: { lineas: LINEAS_BORRADOR }, uid: 'u1', ahora: AHORA });
  assert.deepEqual(r, { existe: false });
  const b = s.almacen.get('ordenesCompraBorradores/2026-12-01');
  assert.equal(b.estado, 'Borrador');
  assert.equal(b.numero, undefined);
  assert.equal(b.neto, 34000);
  assert.equal(b.iva, 6460);
  assert.equal(b.total, 40460);
  assert.equal(b.creadoPor, 'u1');
  assert.equal(s.almacen.has('contadores/ordenesCompra'), false);
  assert.ok(s.escrituras.every((e) => e.path.startsWith('ordenesCompraBorradores/')));
});

test('CA-B3: pulsar dos veces no crea un segundo borrador del mismo día', async () => {
  const { s, base } = entorno();
  await crearBorradorDia({ ...base, id: '2026-12-01', datos: { lineas: LINEAS_BORRADOR }, uid: 'u1', ahora: AHORA });
  const antes = s.escrituras.length;
  const r = await crearBorradorDia({ ...base, id: '2026-12-01', datos: { lineas: LINEAS_BORRADOR }, uid: 'u1', ahora: AHORA });
  assert.deepEqual(r, { existe: true });
  assert.equal(s.escrituras.length, antes);
});

test('crearBorradorDia rechaza un id de día inválido, un borrador sin líneas o una línea que no cuadra', async () => {
  const { base } = entorno();
  await assert.rejects(crearBorradorDia({ ...base, id: 'hoy', datos: { lineas: LINEAS_BORRADOR }, uid: 'u1', ahora: AHORA }), /fecha/);
  await assert.rejects(crearBorradorDia({ ...base, id: '2026-12-01', datos: { lineas: [] }, uid: 'u1', ahora: AHORA }), /al menos una línea/);
  const malo = [{ ...LINEAS_BORRADOR[0], valor: 1 }];
  await assert.rejects(crearBorradorDia({ ...base, id: '2026-12-01', datos: { lineas: malo }, uid: 'u1', ahora: AHORA }), /no cuadra/);
});
