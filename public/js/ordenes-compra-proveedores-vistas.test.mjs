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

// ---- «Días de programación» (Rutas y feriados, solo estado) y acción por día (Compra de flores) ----
import { htmlFilasDiasProgramacion, htmlAccionDia } from './compra-dia-vistas.js';

const DIA = (extra) => ({ iso: '2026-12-01', nombre: 'Martes', display: '01/12/2026', visitas: 2, ramos: 3, listo: true, motivos: [], borrador: null, ...extra });

test('htmlFilasDiasProgramacion (Rutas y feriados): día, fecha, visitas, ramos y estado; sin ningún botón de crear', () => {
  const html = htmlFilasDiasProgramacion([DIA(), DIA({ iso: '2026-12-02', nombre: 'Miércoles', display: '02/12/2026', listo: false, motivos: ['No hay visitas programadas este día.'] })]);
  assert.match(html, /Martes/);
  assert.match(html, /01\/12\/2026/);
  assert.match(html, /Listo/);
  assert.match(html, /No listo/);
  assert.match(html, /No hay visitas programadas este día\./);
  assert.ok(!html.includes('<button'), 'el botón vive en Compra de flores');
  assert.ok(!html.includes('crear-oc-dia'));
});

test('htmlFilasDiasProgramacion escapa los motivos (AUD-01)', () => {
  const html = htmlFilasDiasProgramacion([DIA({ listo: false, motivos: ['Sin eje y día de ruta: <b>X</b>.'] })]);
  assert.ok(html.includes('Sin eje y día de ruta: &lt;b&gt;X&lt;/b&gt;.'));
  assert.ok(!html.includes('<b>X</b>'));
});

test('htmlAccionDia: día listo y con permiso muestra «Crear orden de compra» habilitado (CA-B2)', () => {
  const html = htmlAccionDia(DIA(), { puedeCrear: true });
  assert.match(html, /data-accion="crear-oc-dia" data-fecha="2026-12-01"[^>]*>Crear orden de compra<\/button>/);
  assert.ok(!/crear-oc-dia[^>]*\sdisabled(?=[\s>])/.test(html), 'habilitado');
});

test('htmlAccionDia: día no listo deja el botón deshabilitado y muestra los motivos escapados (CA-B1)', () => {
  const html = htmlAccionDia(DIA({ listo: false, motivos: ['Falta el valor de «1 Ramo Standard» en Valores de ramos.', 'Sin eje: <i>X</i>.'] }), { puedeCrear: true });
  assert.match(html, /data-accion="crear-oc-dia"[^>]*\sdisabled(?=[\s>])/);
  assert.match(html, /Falta el valor de «1 Ramo Standard» en Valores de ramos\./);
  assert.ok(html.includes('Sin eje: &lt;i&gt;X&lt;/i&gt;.'));
  assert.ok(!html.includes('<i>X</i>'));
});

test('htmlAccionDia: sin permiso no hay botón de crear, pero los motivos de «no listo» se ven (R-S)', () => {
  assert.ok(!htmlAccionDia(DIA(), { puedeCrear: false }).includes('crear-oc-dia'));
  assert.match(htmlAccionDia(DIA({ listo: false, motivos: ['No hay visitas programadas este día.'] }), { puedeCrear: false }), /No hay visitas/);
});

test('htmlAccionDia: con borrador existente ofrece abrirlo en vez de crear otro (CA-B3)', () => {
  const html = htmlAccionDia(DIA({ borrador: { id: '2026-12-01', emitidoComo: '' } }), { puedeCrear: true });
  assert.match(html, /href="ordenes-compra\.html\?borrador=2026-12-01"/);
  assert.ok(!html.includes('crear-oc-dia'));
});

test('htmlAccionDia: un borrador ya emitido dice «Emitida como OC-xxxx» y no se abre', () => {
  const html = htmlAccionDia(DIA({ borrador: { id: '2026-12-01', emitidoComo: 'OC-0007' } }), { puedeCrear: true });
  assert.match(html, /Emitida como OC-0007/);
  assert.ok(!html.includes('?borrador='));
});

// ---- Spec 058: columna «Correo» del maestro de proveedores (CA4, R5)
test('spec 058: htmlFilasProveedores muestra el correo después del teléfono y deja la celda vacía si falta', () => {
  const con = htmlFilasProveedores([doc('p1', { ...PROV, correo: 'ventas@ejemplo.test' })]);
  assert.match(con, /ventas@ejemplo\.test/);
  assert.equal([...con.matchAll(/<td\b/g)].length, 8, 'ocho celdas por fila');
  assert.ok(con.indexOf(PROV.telefono) < con.indexOf('ventas@ejemplo.test'), 'el correo va después del teléfono');
  const sin = htmlFilasProveedores([doc('p1', PROV)]);
  assert.equal([...sin.matchAll(/<td\b/g)].length, 8);
  assert.doesNotMatch(sin, /undefined|null/);
});

test('spec 058: htmlFilasProveedores escapa el correo (AUD-01)', () => {
  const html = htmlFilasProveedores([doc('p1', { ...PROV, correo: '"><img src=x onerror=alert(1)>@ejemplo.test' })]);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img/);
  const script = htmlFilasProveedores([doc('p1', { ...PROV, correo: '<script>x</script>' })]);
  assert.doesNotMatch(script, /<script>/);
});

test('spec 058: la fila de «No hay proveedores» ocupa las ocho columnas', () => {
  assert.match(htmlFilasProveedores([]), /colspan="8"/);
});
