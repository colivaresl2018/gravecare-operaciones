import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatoPesos, htmlFilasMateriales, htmlFilasOrdenes, htmlLineasBorrador, htmlTotales, htmlImpresion, htmlOpcionesEstado,
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

// --- Spec 063: seguimiento de pago en la lista de órdenes ---
const PAGADA = (extra = {}) => ORDEN({ estado: 'Pagada', facturaNumero: 'F-1234', fechaPago: '2026-11-23', ...extra });
const filas = (html) => html.split('</tr>').filter((f) => f.includes('<tr'));
const celdas = (fila) => (fila.match(/<td\b/g) || []).length;

test('CA13: cada orden tiene 8 celdas (número, fecha, proveedor, total, estado, factura, fecha de pago, acciones) y la fila vacía ocupa 8', () => {
  const html = htmlFilasOrdenes([ORDEN({ numero: 'OC-0001' }), PAGADA({ numero: 'OC-0002' }), ORDEN({ numero: 'OC-0003', estado: 'Anulada' })], { puedeAnular: true });
  const todas = filas(html);
  assert.equal(todas.length, 3);
  for (const f of todas) assert.equal(celdas(f), 8);
  assert.match(htmlFilasOrdenes([], {}), /colspan="8"/);
});

test('CA13: una orden Pagada muestra su factura y su fecha; Emitida y Anulada muestran —', () => {
  const html = htmlFilasOrdenes([PAGADA({ numero: 'OC-0002' }), ORDEN({ numero: 'OC-0001' })], { puedeAnular: true });
  const [pagada, emitida] = filas(html);
  assert.match(pagada, /F-1234/);
  assert.match(pagada, /23-11-2026|23\/11\/2026/);
  assert.ok(!/F-1234/.test(emitida));
  assert.equal((emitida.match(/>—</g) || []).length, 2, 'factura y fecha de pago sin dato');
  const anulada = htmlFilasOrdenes([ORDEN({ estado: 'Anulada' })], {});
  assert.equal((anulada.match(/>—</g) || []).length, 2);
});

test('R16: el estado se pinta según su valor real; uno desconocido sale escapado y nunca como «Emitida»', () => {
  const pagada = htmlFilasOrdenes([PAGADA()], {});
  assert.match(pagada, />Pagada</);
  assert.ok(!/>Emitida</.test(pagada));
  const raro = htmlFilasOrdenes([ORDEN({ estado: '<b>Rara</b>' })], {});
  assert.match(raro, /&lt;b&gt;Rara&lt;\/b&gt;/);
  assert.ok(!raro.includes('<b>Rara'));
  assert.ok(!/>Emitida</.test(raro));
});

test('CA13/R2: «Anular» solo aparece en órdenes Emitidas y para quien puede; una Pagada no se anula', () => {
  const html = htmlFilasOrdenes([PAGADA({ numero: 'OC-0002' }), ORDEN({ numero: 'OC-0001' })], { puedeAnular: true });
  assert.match(html, /data-accion="anular-orden" data-numero="OC-0001"/);
  assert.ok(!/data-accion="anular-orden" data-numero="OC-0002"/.test(html));
});

test('R13: el botón «Seguimiento» está en las órdenes Emitidas y Pagadas, aun sin permiso de anular, y no en las Anuladas', () => {
  const html = htmlFilasOrdenes([ORDEN({ numero: 'OC-0001' }), PAGADA({ numero: 'OC-0002' }), ORDEN({ numero: 'OC-0003', estado: 'Anulada' })], { puedeAnular: false });
  assert.match(html, /data-accion="seguimiento-orden" data-numero="OC-0001"[^>]*>Seguimiento</);
  assert.match(html, /data-accion="seguimiento-orden" data-numero="OC-0002"/);
  assert.ok(!/data-accion="seguimiento-orden" data-numero="OC-0003"/.test(html));
  assert.match(html, /data-accion="ver-orden" data-numero="OC-0003"/, 'ver / imprimir sigue en todas');
});

test('CA14: factura, fecha y número con HTML se ven como texto, nunca como etiquetas', () => {
  const html = htmlFilasOrdenes([PAGADA({ facturaNumero: '<img src=x onerror=alert(1)>', numero: 'OC-0009' })], { puedeAnular: true });
  assert.ok(!html.includes('<img'));
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test('CA15/R12: con comentario aparece un indicador accesible junto al número; sin comentario no; el texto del comentario no va en la fila', () => {
  const con = htmlFilasOrdenes([ORDEN({ numero: 'OC-0001', comentario: 'Pagó <script>alert(1)</script> el gerente' })], {});
  assert.match(con, /data-accion="ver-comentario" data-numero="OC-0001"/);
  assert.match(con, /aria-label="Ver comentario de OC-0001"/);
  assert.match(con, /data-tiene-comentario="1"/);
  assert.ok(!con.includes('<script>'), 'sin etiquetas vivas');
  assert.ok(!/gerente/.test(con), 'el texto se pone en el globo con textContent, no en el HTML de la fila');
  for (const sin of [ORDEN({ numero: 'OC-0002' }), ORDEN({ numero: 'OC-0003', comentario: '' }), ORDEN({ numero: 'OC-0004', comentario: '   ' })]) {
    const html = htmlFilasOrdenes([sin], {});
    assert.ok(!/ver-comentario|data-tiene-comentario/.test(html), sin.numero);
  }
});

test('CA16: las opciones del menú de estado son las transiciones recibidas, con el actual elegido y todo escapado', () => {
  const html = htmlOpcionesEstado(['Pagada', 'Emitida'], 'Pagada');
  assert.match(html, /<option value="Pagada" selected>Pagada<\/option>/);
  assert.match(html, /<option value="Emitida">Emitida<\/option>/);
  assert.ok(!/Anulada/.test(html));
  const raro = htmlOpcionesEstado(['<b>x</b>'], '<b>x</b>');
  assert.ok(!raro.includes('<b>'));
  assert.match(raro, /&lt;b&gt;x&lt;\/b&gt;/);
});

test('CA16: en una orden Anulada la única opción está deshabilitada; sin transiciones se muestra el estado actual deshabilitado', () => {
  assert.match(htmlOpcionesEstado(['Anulada'], 'Anulada'), /<option value="Anulada" selected disabled>Anulada<\/option>/);
  assert.match(htmlOpcionesEstado([], 'Borrador'), /<option value="Borrador" selected disabled>Borrador<\/option>/);
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
