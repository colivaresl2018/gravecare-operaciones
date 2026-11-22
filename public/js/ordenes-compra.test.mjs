import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TIPOS_MATERIAL, CONDICIONES_PAGO, TASA_IVA, RAMOS_MAESTRO,
  normalizarCodigo, esCodigoValido, validarMaterial, catalogoMateriales, buscarMaterial,
  validarLinea, calcularTotales, validarOrden, formatearNumeroOC, esNumeroOC,
} from './ordenes-compra.js';

const VALORES = { standard: 10000, premium: 15000, deluxe: 25000, adicionalStandard: 7000, adicionalPremium: 12000 };
const doc = (id, data) => ({ id, data });
const CATALOGO = catalogoMateriales(
  [
    doc('INS-001', { codigo: 'INS-001', descripcion: 'Papel de envolver', tipo: 'Insumo', unidad: 'UNI', precioUnitario: 1500, activo: true }),
    doc('INS-002', { codigo: 'INS-002', descripcion: 'Cinta', tipo: 'Insumo', unidad: 'MT', precioUnitario: 300, activo: false }),
  ],
  VALORES,
);

test('constantes de la spec 055: tipos, condiciones de pago, IVA 19 % y los 5 ramos del maestro', () => {
  assert.deepEqual(TIPOS_MATERIAL, ['Insumo', 'Arreglo floral', 'Servicio']);
  assert.deepEqual(CONDICIONES_PAGO, ['Transferencia', 'Factura a 30 días', 'Contado', 'Otro']);
  assert.equal(TASA_IVA, 0.19);
  assert.deepEqual(RAMOS_MAESTRO.map((r) => [r.codigo, r.clave]), [
    ['RAM-STD', 'standard'], ['RAM-PRE', 'premium'], ['RAM-DLX', 'deluxe'], ['RAM-ADS', 'adicionalStandard'], ['RAM-ADP', 'adicionalPremium'],
  ]);
});

test('código: se normaliza a mayúsculas sin espacios en los bordes y vale [A-Z0-9-] de 2 a 20 caracteres (R2)', () => {
  assert.equal(normalizarCodigo('  ins-010 '), 'INS-010');
  assert.equal(normalizarCodigo(null), '');
  for (const ok of ['AB', 'INS-010', 'A'.repeat(20), 'X1-Y2']) assert.ok(esCodigoValido(ok), ok);
  for (const mal of ['', 'A', 'A'.repeat(21), 'INS 010', 'ins-010', 'INS_010', 'ÑU-1', 'A/B']) assert.ok(!esCodigoValido(mal), mal);
});

test('material válido: guarda código, descripción, tipo, unidad (UNI por defecto), precio entero y activo (R3)', () => {
  const r = validarMaterial({ codigo: ' ins-010 ', descripcion: ' Tijeras ', tipo: 'Insumo', precioUnitario: '12.500' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.datos, { codigo: 'INS-010', descripcion: 'Tijeras', tipo: 'Insumo', unidad: 'UNI', precioUnitario: 12500, activo: true });
});

test('material inválido: código, descripción, tipo y precio se validan con mensajes claros', () => {
  const r = validarMaterial({ codigo: 'x', descripcion: '', tipo: 'Otro', precioUnitario: '-5' });
  assert.equal(r.ok, false);
  assert.ok(r.errores.some((e) => /código/i.test(e)));
  assert.ok(r.errores.some((e) => /descripci/i.test(e)));
  assert.ok(r.errores.some((e) => /tipo/i.test(e)));
  assert.ok(r.errores.some((e) => /precio/i.test(e)));
  assert.equal(validarMaterial({ codigo: 'INS-1', descripcion: 'a', tipo: 'Insumo', precioUnitario: '12,5' }).ok, false, 'el precio es un entero en pesos');
  assert.equal(validarMaterial({ codigo: 'INS-1', descripcion: 'a', tipo: 'Insumo', precioUnitario: '0' }).ok, true, 'un precio 0 es válido');
});

test('los códigos de los ramos (RAM-STD…) están reservados: su precio sale de valores_ramos/compra y no se crean a mano', () => {
  const r = validarMaterial({ codigo: 'RAM-STD', descripcion: 'otro', tipo: 'Arreglo floral', precioUnitario: 1 });
  assert.equal(r.ok, false);
  assert.ok(r.errores.some((e) => /reservado|ramos/i.test(e)));
});

test('catálogo: maestro + los 5 ramos con el precio de valores_ramos; un ramo sin valor queda sin precio (no se inventa)', () => {
  const ramos = CATALOGO.filter((m) => m.origen === 'ramo');
  assert.deepEqual(ramos.map((m) => [m.codigo, m.precioUnitario]), [['RAM-STD', 10000], ['RAM-PRE', 15000], ['RAM-DLX', 25000], ['RAM-ADS', 7000], ['RAM-ADP', 12000]]);
  assert.ok(ramos.every((m) => m.editable === false && m.tipo === 'Arreglo floral' && m.unidad === 'UNI' && m.activo === true));
  const sinValor = catalogoMateriales([], { standard: 10000 });
  assert.equal(sinValor.find((m) => m.codigo === 'RAM-PRE').precioUnitario, null);
  const maestro = CATALOGO.filter((m) => m.origen === 'maestro');
  assert.deepEqual(maestro.map((m) => m.codigo), ['INS-001', 'INS-002']);
  assert.ok(maestro.every((m) => m.editable === true));
});

test('catálogo: un documento del maestro con el código de un ramo no pisa al ramo; un código tomado del id', () => {
  const c = catalogoMateriales([doc('RAM-STD', { descripcion: 'x', precioUnitario: 1, activo: true }), doc('INS-9', { descripcion: 'Sin campo código', tipo: 'Insumo', precioUnitario: 5 })], VALORES);
  assert.equal(c.find((m) => m.codigo === 'RAM-STD').precioUnitario, 10000);
  assert.equal(c.filter((m) => m.codigo === 'RAM-STD').length, 1);
  const m = c.find((x) => x.codigo === 'INS-9');
  assert.equal(m.activo, true, 'un documento sin el campo activo se toma como activo');
  assert.equal(m.unidad, 'UNI');
});

test('buscarMaterial: normaliza lo escrito y devuelve el material o null', () => {
  assert.equal(buscarMaterial(CATALOGO, ' ins-001 ').descripcion, 'Papel de envolver');
  assert.equal(buscarMaterial(CATALOGO, 'NOPE-1'), null);
  assert.equal(buscarMaterial(CATALOGO, ''), null);
});

test('CA4: un código del maestro completa descripción, unidad y precio, y calcula el valor', () => {
  const r = validarLinea({ codigo: 'ins-001', cantidad: '3' }, CATALOGO);
  assert.equal(r.ok, true);
  assert.deepEqual(r.linea, { codigo: 'INS-001', descripcion: 'Papel de envolver', unidad: 'UNI', cantidad: 3, precioUnitario: 1500, valor: 4500 });
});

test('CA5: un código que no existe en el maestro no se agrega y avisa «no está en el maestro»', () => {
  const r = validarLinea({ codigo: 'ZZZ-9', cantidad: 1 }, CATALOGO);
  assert.equal(r.ok, false);
  assert.match(r.error, /no está en el maestro/);
});

test('CA6: la cantidad debe ser un entero ≥ 1 (0, negativa, decimal o texto no se agregan)', () => {
  for (const mala of [0, -2, 1.5, '2,5', '', 'dos', null, undefined, NaN]) {
    const r = validarLinea({ codigo: 'INS-001', cantidad: mala }, CATALOGO);
    assert.equal(r.ok, false, String(mala));
    assert.match(r.error, /cantidad/i);
  }
  assert.equal(validarLinea({ codigo: 'INS-001', cantidad: ' 4 ' }, CATALOGO).linea.cantidad, 4);
});

test('un material retirado (activo:false) no se puede pedir; un ramo sin valor tampoco (no se inventa precio)', () => {
  const retirado = validarLinea({ codigo: 'INS-002', cantidad: 1 }, CATALOGO);
  assert.equal(retirado.ok, false);
  assert.match(retirado.error, /retirado/i);
  const sinValor = validarLinea({ codigo: 'RAM-PRE', cantidad: 1 }, catalogoMateriales([], { standard: 10000 }));
  assert.equal(sinValor.ok, false);
  assert.match(sinValor.error, /sin valor/i);
  const ramo = validarLinea({ codigo: 'RAM-DLX', cantidad: 2 }, CATALOGO);
  assert.equal(ramo.ok, true);
  assert.equal(ramo.linea.valor, 50000);
});

test('totales (R6): neto = Σ valor; IVA = round(neto × 0,19); total = neto + IVA', () => {
  assert.deepEqual(calcularTotales([{ valor: 4500 }, { valor: 50000 }, { valor: 300 }]), { neto: 54800, iva: 10412, total: 65212 });
  assert.deepEqual(calcularTotales([]), { neto: 0, iva: 0, total: 0 });
  assert.equal(calcularTotales([{ valor: 1 }]).iva, 0, '0,19 redondea a 0');
  assert.equal(calcularTotales([{ valor: 3 }]).iva, 1, '0,57 redondea a 1');
});

const BASE = () => ({
  fecha: '2026-11-22',
  fechaEntrega: '2026-11-25',
  proveedor: { razonSocial: ' Flores del Sur SpA ', rut: '76.123.456-7', contacto: 'Ana', telefono: '+56 9 1111 2222', direccion: 'Calle 1' },
  condicionesPago: 'Factura a 30 días',
  lugarEntrega: 'Bodega GraveCare',
  lineas: [
    { codigo: 'INS-001', descripcion: 'Papel de envolver', unidad: 'UNI', cantidad: 3, precioUnitario: 1500, valor: 4500 },
    { codigo: 'RAM-DLX', descripcion: 'Ramo Deluxe', unidad: 'UNI', cantidad: 2, precioUnitario: 25000, valor: 50000 },
  ],
});

test('orden válida: copia los datos, recalcula valor y totales (R6) y no confía en los números que traiga', () => {
  const entrada = BASE();
  entrada.lineas[0].valor = 999999; // un valor manipulado se descarta: se recalcula
  entrada.neto = 1; entrada.total = 1;
  const r = validarOrden(entrada);
  assert.equal(r.ok, true);
  assert.equal(r.datos.lineas[0].valor, 4500);
  assert.deepEqual([r.datos.neto, r.datos.iva, r.datos.total], [54500, 10355, 64855]);
  assert.equal(r.datos.proveedor.razonSocial, 'Flores del Sur SpA');
  assert.equal(r.datos.estado, 'Emitida');
  assert.equal(r.datos.condicionesPago, 'Factura a 30 días');
  assert.equal(r.datos.fecha, '2026-11-22');
});

test('orden: R8, sin líneas o sin razón social no se emite; fechas, condición y cantidades se validan', () => {
  const sinLineas = BASE(); sinLineas.lineas = [];
  assert.match(validarOrden(sinLineas).errores.join(' '), /línea/i);
  const sinProveedor = BASE(); sinProveedor.proveedor.razonSocial = '  ';
  assert.match(validarOrden(sinProveedor).errores.join(' '), /razón social/i);
  const fechaMala = BASE(); fechaMala.fecha = '22/11/2026';
  assert.match(validarOrden(fechaMala).errores.join(' '), /fecha/i);
  const entregaAntes = BASE(); entregaAntes.fechaEntrega = '2026-11-20';
  assert.match(validarOrden(entregaAntes).errores.join(' '), /entrega/i);
  const sinEntrega = BASE(); sinEntrega.fechaEntrega = '';
  assert.equal(validarOrden(sinEntrega).ok, true, 'la fecha de entrega es opcional');
  const condicion = BASE(); condicion.condicionesPago = 'A convenir';
  assert.match(validarOrden(condicion).errores.join(' '), /condici/i);
  const cantidad = BASE(); cantidad.lineas[0].cantidad = 1.5;
  assert.equal(validarOrden(cantidad).ok, false);
  const precio = BASE(); precio.lineas[0].precioUnitario = -1;
  assert.equal(validarOrden(precio).ok, false);
});

test('orden: no inventa campos (solo los de R5) y no incluye datos internos', () => {
  const entrada = BASE(); entrada.claims = { staffActivo: true }; entrada.proveedor.apodo = 'x'; entrada.lineas[0].interno = 'y';
  const r = validarOrden(entrada);
  assert.deepEqual(Object.keys(r.datos).sort(), ['condicionesPago', 'estado', 'fecha', 'fechaEntrega', 'iva', 'lineas', 'lugarEntrega', 'neto', 'proveedor', 'total']);
  assert.deepEqual(Object.keys(r.datos.proveedor).sort(), ['contacto', 'direccion', 'razonSocial', 'rut', 'telefono']);
  assert.deepEqual(Object.keys(r.datos.lineas[0]).sort(), ['cantidad', 'codigo', 'descripcion', 'precioUnitario', 'unidad', 'valor']);
});

test('número de OC: OC-0001 con cuatro dígitos; sigue creciendo pasado 9999; no acepta valores inválidos', () => {
  assert.equal(formatearNumeroOC(1), 'OC-0001');
  assert.equal(formatearNumeroOC(42), 'OC-0042');
  assert.equal(formatearNumeroOC(10000), 'OC-10000');
  for (const mal of [0, -1, 1.5, 'a', null, NaN]) assert.throws(() => formatearNumeroOC(mal), /número/i);
  assert.ok(esNumeroOC('OC-0001') && esNumeroOC('OC-12345'));
  for (const mal of ['OC-1', 'oc-0001', 'OC0001', 'OC-0001/x', '']) assert.ok(!esNumeroOC(mal), mal);
});
