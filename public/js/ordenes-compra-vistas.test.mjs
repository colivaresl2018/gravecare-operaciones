import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatoPesos, htmlFilasMateriales, htmlFilasOrdenes, htmlLineasBorrador, htmlTotales, htmlImpresion,
} from './ordenes-compra-vistas.js';
import { catalogoMateriales } from './ordenes-compra.js';

const CATALOGO = catalogoMateriales(
  [
    { id: 'INS-001', data: { descripcion: 'Papel <b>fino</b>', tipo: 'Insumo', unidad: 'UNI', precioUnitario: 1500, activo: true } },
    { id: 'INS-002', data: { descripcion: 'Cinta', tipo: 'Insumo', unidad: 'MT', precioUnitario: 300, activo: false } },
  ],
  { standard: 10000 },
);

const ORDEN = (extra = {}) => ({
  numero: 'OC-0007', fecha: '2026-11-22', fechaEntrega: '2026-11-25', estado: 'Emitida',
  proveedor: { razonSocial: 'Flores <b>Sur</b> SpA', rut: '76.123.456-7', contacto: 'Ana <i>P</i>', telefono: '+56 9 1111 2222', direccion: 'Calle 1' },
  condicionesPago: 'Factura a 30 días', lugarEntrega: 'Bodega <script>x</script>',
  lineas: [{ codigo: 'INS-001', descripcion: 'Papel <b>fino</b>', unidad: 'UNI', cantidad: 3, precioUnitario: 1500, valor: 4500 }],
  neto: 4500, iva: 855, total: 5355, creadaEl: '2026-11-22T15:30:00.000Z', creadaPor: 'uid-secreto-123',
  ...extra,
});

test('formatoPesos: pesos chilenos con punto de miles', () => {
  assert.equal(formatoPesos(0), '$0');
  assert.equal(formatoPesos(1500), '$1.500');
  assert.equal(formatoPesos(1234567), '$1.234.567');
  assert.equal(formatoPesos(null), '—');
  assert.equal(formatoPesos(undefined), '—');
});

test('maestro: muestra código, descripción, tipo, unidad y precio; el ramo sin valor dice «Sin valor» y no tiene botones', () => {
  const html = htmlFilasMateriales(CATALOGO, { puedeEditar: true });
  assert.match(html, /RAM-STD/);
  assert.match(html, /\$10\.000/);
  assert.match(html, /RAM-PRE[\s\S]*?Sin valor/);
  assert.match(html, /Valores de ramos/);
  assert.ok(!/data-accion="[a-z-]+-material" data-codigo="RAM-/.test(html), 'los ramos no se editan aquí');
  assert.match(html, /data-accion="editar-material" data-codigo="INS-001"/);
  assert.match(html, /data-accion="retirar-material" data-codigo="INS-001"/);
  assert.match(html, /data-accion="reactivar-material" data-codigo="INS-002"/);
});

test('maestro: sin permiso no hay botones; un maestro vacío aún muestra los ramos', () => {
  assert.ok(!/data-accion=/.test(htmlFilasMateriales(CATALOGO, { puedeEditar: false })));
  assert.match(htmlFilasMateriales(catalogoMateriales([], {}), { puedeEditar: true }), /RAM-STD/);
  assert.match(htmlFilasMateriales([], { puedeEditar: true }), /No hay materiales/);
});

test('CA12: el texto con HTML se ve literal (escapado) en el maestro, la lista, el borrador y la impresión', () => {
  const todo = [
    htmlFilasMateriales(CATALOGO, { puedeEditar: true }),
    htmlFilasOrdenes([ORDEN()], { puedeAnular: true }),
    htmlLineasBorrador(ORDEN().lineas),
    htmlImpresion(ORDEN()),
  ].join('\n');
  assert.ok(!todo.includes('<b>'), 'sin etiquetas vivas');
  assert.ok(!todo.includes('<script>'));
  assert.ok(!todo.includes('<i>'));
  assert.match(todo, /&lt;b&gt;fino&lt;\/b&gt;/);
  assert.match(htmlImpresion(ORDEN()), /Flores &lt;b&gt;Sur&lt;\/b&gt; SpA/);
});

test('lista de órdenes: la más nueva primero, con total y estado; Anular solo para quien puede y solo si está Emitida', () => {
  const ordenes = [ORDEN({ numero: 'OC-0001' }), ORDEN({ numero: 'OC-0010' }), ORDEN({ numero: 'OC-0002', estado: 'Anulada' })];
  const html = htmlFilasOrdenes(ordenes, { puedeAnular: true });
  assert.ok(html.indexOf('OC-0010') < html.indexOf('OC-0002') && html.indexOf('OC-0002') < html.indexOf('OC-0001'));
  assert.match(html, /\$5\.355/);
  assert.match(html, /Anulada/);
  assert.match(html, /data-accion="anular-orden" data-numero="OC-0010"/);
  assert.ok(!/data-accion="anular-orden" data-numero="OC-0002"/.test(html), 'una anulada no se anula otra vez');
  assert.match(html, /data-accion="ver-orden" data-numero="OC-0002"/);
  assert.ok(!/anular-orden/.test(htmlFilasOrdenes(ordenes, { puedeAnular: false })));
  assert.match(htmlFilasOrdenes([], { puedeAnular: true }), /No hay órdenes de compra/);
});

test('borrador: líneas con cantidad, precio y valor, botón para quitar una línea y totales con IVA', () => {
  const html = htmlLineasBorrador(ORDEN().lineas);
  assert.match(html, /INS-001/);
  assert.match(html, /\$4\.500/);
  assert.match(html, /data-accion="quitar-linea" data-indice="0"/);
  assert.match(htmlLineasBorrador([]), /Todavía no hay líneas/);
  const t = htmlTotales({ neto: 4500, iva: 855, total: 5355 });
  assert.match(t, /Neto[\s\S]*\$4\.500/);
  assert.match(t, /IVA 19 %[\s\S]*\$855/);
  assert.match(t, /Total[\s\S]*\$5\.355/);
});

test('CA11: la impresión muestra GraveCare, número, fechas, proveedor, líneas y totales, y NINGÚN dato interno', () => {
  const html = htmlImpresion(ORDEN());
  assert.match(html, /GraveCare/);
  assert.match(html, /OC-0007/);
  assert.match(html, /22\/11\/2026/);
  assert.match(html, /25\/11\/2026/);
  assert.match(html, /76\.123\.456-7/);
  assert.match(html, /Factura a 30 días/);
  assert.match(html, /\$4\.500/);
  assert.match(html, /\$5\.355/);
  assert.ok(!html.includes('uid-secreto-123'), 'sin uid de quien la creó');
  assert.ok(!/creadaPor|staffActivo|claims/i.test(html));
});

test('impresión de una OC anulada: lo dice claramente con el motivo, sin mostrar quién la anuló', () => {
  const html = htmlImpresion(ORDEN({ estado: 'Anulada', motivoAnulacion: 'Pedido duplicado', anuladaPor: 'uid-anula-999', anuladaEl: '2026-11-23T10:00:00.000Z' }));
  assert.match(html, /ANULADA/);
  assert.match(html, /Pedido duplicado/);
  assert.ok(!html.includes('uid-anula-999'));
});

test('impresión: fecha de entrega y datos opcionales vacíos no dejan «undefined» ni filas rotas', () => {
  const html = htmlImpresion(ORDEN({ fechaEntrega: '', lugarEntrega: '', proveedor: { razonSocial: 'X', rut: '', contacto: '', telefono: '', direccion: '' } }));
  assert.ok(!/undefined|null|NaN/.test(html));
});
