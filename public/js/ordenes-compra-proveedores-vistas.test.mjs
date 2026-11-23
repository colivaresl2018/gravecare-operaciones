import test from 'node:test';
import assert from 'node:assert/strict';
import {
  htmlFilasProveedores, htmlOpcionesRazon, htmlFilasBorradores, VALOR_OTRO_PROVEEDOR,
} from './ordenes-compra-vistas.js';

const doc = (id, data) => ({ id, data });
const PROV = {
  razonSocial: 'Flores del Sur SpA', rut: '76.543.210-3', contacto: 'Ana', telefono: '+56 9 1234', direccion: 'Calle 1',
  condicionesPago: 'Transferencia', activo: true,
};

test('htmlFilasProveedores lista razón social, RUT, contacto, teléfono, condición y estado (CA-P1)', () => {
  const html = htmlFilasProveedores([doc('p1', PROV)]);
  for (const t of ['Flores del Sur SpA', '76.543.210-3', 'Ana', '+56 9 1234', 'Transferencia', 'Activo']) assert.ok(html.includes(t), t);
  assert.match(html, /data-accion="editar-proveedor"/);
});

test('quitar y reactivar solo aparecen para quien puede (dueño); un proveedor quitado se marca como tal (CA-P4)', () => {
  const activo = htmlFilasProveedores([doc('p1', PROV)], { puedeQuitar: true });
  assert.match(activo, /data-accion="quitar-proveedor"/);
  const sinPermiso = htmlFilasProveedores([doc('p1', PROV)], { puedeQuitar: false });
  assert.ok(!sinPermiso.includes('quitar-proveedor'));
  const quitado = htmlFilasProveedores([doc('p1', { ...PROV, activo: false })], { puedeQuitar: true });
  assert.match(quitado, /Quitado/);
  assert.match(quitado, /data-accion="reactivar-proveedor"/);
  assert.ok(!quitado.includes('data-accion="quitar-proveedor"'));
});

test('htmlFilasProveedores escapa los datos del proveedor (CA-O5, AUD-01)', () => {
  const html = htmlFilasProveedores([doc('p1', { ...PROV, razonSocial: '<b>Negrita</b>' })]);
  assert.ok(html.includes('&lt;b&gt;Negrita&lt;/b&gt;'));
  assert.ok(!html.includes('<b>Negrita</b>'));
});

test('htmlFilasProveedores con lista vacía dice que todavía no hay proveedores', () => {
  assert.match(htmlFilasProveedores([]), /No hay proveedores cargados todavía/);
});

test('htmlOpcionesRazon: un placeholder, los proveedores activos que llegan y «Otro proveedor» al final (CA-O1)', () => {
  const html = htmlOpcionesRazon([{ id: 'p1', razonSocial: 'Flores del Sur SpA' }, { id: 'p2', razonSocial: 'Bodega <i>X</i>' }], 'p2');
  assert.match(html, /<option value="">Elige un proveedor/);
  assert.match(html, /<option value="p1">Flores del Sur SpA<\/option>/);
  assert.match(html, /<option value="p2" selected>Bodega &lt;i&gt;X&lt;\/i&gt;<\/option>/);
  assert.match(html, new RegExp(`<option value="${VALOR_OTRO_PROVEEDOR}">Otro proveedor \\(escribir\\)<\\/option>$`));
});

test('htmlOpcionesRazon sin proveedores deja solo el placeholder y «Otro proveedor»', () => {
  const html = htmlOpcionesRazon([]);
  assert.equal((html.match(/<option/g) || []).length, 2);
});

test('htmlFilasBorradores: día, líneas, total y estado; un borrador pendiente se puede abrir (CA-B5)', () => {
  const html = htmlFilasBorradores([
    doc('2026-12-01', { fechaDia: '2026-12-01', lineas: [{}, {}], total: 40460, estado: 'Borrador' }),
    doc('2026-12-02', { fechaDia: '2026-12-02', lineas: [{}], total: 10000, estado: 'Borrador', emitidoComo: 'OC-0001' }),
  ]);
  assert.match(html, /01\/12\/2026/);
  assert.match(html, /\$40\.460/);
  assert.match(html, /data-accion="abrir-borrador" data-id="2026-12-01"/);
  assert.match(html, /Emitida como OC-0001/);
  assert.ok(!html.includes('data-id="2026-12-02"'), 'un borrador ya emitido no se abre');
});

test('htmlFilasBorradores sin borradores dice que no hay ninguno', () => {
  assert.match(htmlFilasBorradores([]), /No hay borradores de orden por día/);
});
