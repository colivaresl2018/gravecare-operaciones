import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COLECCION_MATERIALES, COLECCION_ORDENES, COLECCION_CONTADORES, DOC_CONTADOR_ORDENES,
  crearMaterial, actualizarMaterial, emitirOrden, anularOrden, textoErrorOC, textoErrorCarga, guardarSeguimientoOrden,
} from './ordenes-compra-db.js';

const AHORA = new Date('2026-11-22T15:30:00.000Z');
const ISO = '2026-11-22T15:30:00.000Z';

/** Firestore simulado en memoria con transacciones optimistas (reintenta si alguien escribió lo que se leyó). */
function simulador({ inicial = {}, falla = null } = {}) {
  const almacen = new Map(Object.entries(inicial));
  const version = new Map();
  const escrituras = [];
  const ref = (coleccion, id) => ({ path: `${coleccion}/${id}` });
  const refs = {
    material: (codigo) => ref(COLECCION_MATERIALES, codigo),
    orden: (numero) => ref(COLECCION_ORDENES, numero),
    contador: () => ref(COLECCION_CONTADORES, DOC_CONTADOR_ORDENES),
  };
  const ver = (path) => version.get(path) || 0;
  async function ejecutarTransaccion(fn) {
    for (let intento = 0; intento < 20; intento++) {
      const leidos = new Map();
      const pendientes = [];
      let escribio = false;
      const tx = {
        async get(r) {
          if (escribio) throw new Error('Firestore exige leer antes de escribir en una transacción');
          leidos.set(r.path, ver(r.path));
          await Promise.resolve(); // punto de intercalado entre transacciones concurrentes
          const dato = almacen.get(r.path);
          return { exists: () => dato !== undefined, data: () => (dato === undefined ? undefined : JSON.parse(JSON.stringify(dato))) };
        },
        set(r, datos) { escribio = true; pendientes.push({ tipo: 'set', r, datos }); },
        update(r, datos) { escribio = true; pendientes.push({ tipo: 'update', r, datos }); },
      };
      const resultado = await fn(tx);
      if ([...leidos].some(([path, v]) => ver(path) !== v)) continue; // conflicto: se reintenta
      if (falla) throw Object.assign(new Error('rechazado'), { code: falla });
      for (const p of pendientes) {
        if (p.tipo === 'update' && !almacen.has(p.r.path)) throw new Error('update de un documento que no existe');
        almacen.set(p.r.path, p.tipo === 'set' ? JSON.parse(JSON.stringify(p.datos)) : { ...almacen.get(p.r.path), ...JSON.parse(JSON.stringify(p.datos)) });
        version.set(p.r.path, ver(p.r.path) + 1);
        escrituras.push({ tipo: p.tipo, path: p.r.path, datos: p.datos });
      }
      return resultado;
    }
    throw new Error('demasiados reintentos');
  }
  return { almacen, escrituras, refs, ejecutarTransaccion };
}

const MATERIAL = { codigo: 'ins-010', descripcion: 'Tijeras', tipo: 'Insumo', precioUnitario: '12.500' };
const ORDEN = () => ({
  fecha: '2026-11-22', fechaEntrega: '2026-11-25', condicionesPago: 'Transferencia', lugarEntrega: 'Bodega',
  proveedor: { razonSocial: 'Flores del Sur SpA', rut: '', contacto: '', telefono: '', direccion: '' },
  lineas: [{ codigo: 'INS-001', descripcion: 'Papel', unidad: 'UNI', cantidad: 3, precioUnitario: 1500, valor: 4500 }],
});

test('colecciones y documento del contador (spec 055 §8): nuevas y aditivas', () => {
  assert.equal(COLECCION_MATERIALES, 'materiales');
  assert.equal(COLECCION_ORDENES, 'ordenesCompra');
  assert.equal(COLECCION_CONTADORES, 'contadores');
  assert.equal(DOC_CONTADOR_ORDENES, 'ordenesCompra');
});

test('CA1: crear un material lo guarda con sus campos, quién y cuándo (R3)', async () => {
  const s = simulador();
  const r = await crearMaterial({ ...s, datos: MATERIAL, uid: 'u1', ahora: AHORA });
  assert.equal(r.codigo, 'INS-010');
  assert.deepEqual(s.almacen.get('materiales/INS-010'), {
    codigo: 'INS-010', descripcion: 'Tijeras', tipo: 'Insumo', unidad: 'UNI', precioUnitario: 12500, activo: true, creadoEl: ISO, creadoPor: 'u1',
  });
});

test('CA2: un código repetido se rechaza con «El código ya existe» y no se escribe nada', async () => {
  const s = simulador();
  await crearMaterial({ ...s, datos: MATERIAL, uid: 'u1', ahora: AHORA });
  const antes = s.escrituras.length;
  await assert.rejects(crearMaterial({ ...s, datos: { ...MATERIAL, precioUnitario: 1 }, uid: 'u2', ahora: AHORA }), /El código ya existe/);
  assert.equal(s.escrituras.length, antes);
  assert.equal(s.almacen.get('materiales/INS-010').precioUnitario, 12500, 'el material original queda intacto');
});

test('crear un material inválido (o con código de ramo) falla antes de tocar Firestore', async () => {
  const s = simulador();
  await assert.rejects(crearMaterial({ ...s, datos: { ...MATERIAL, codigo: 'RAM-STD' }, uid: 'u1', ahora: AHORA }), /reservado/);
  await assert.rejects(crearMaterial({ ...s, datos: { ...MATERIAL, descripcion: '' }, uid: 'u1', ahora: AHORA }), /descripci/i);
  await assert.rejects(crearMaterial({ ...s, datos: MATERIAL, uid: '', ahora: AHORA }), /usuario/i);
  assert.equal(s.escrituras.length, 0);
});

test('editar un material cambia solo descripción, tipo, unidad, precio y activo; nunca el código ni quién lo creó', async () => {
  const s = simulador();
  await crearMaterial({ ...s, datos: MATERIAL, uid: 'u1', ahora: AHORA });
  await actualizarMaterial({ ...s, codigo: 'INS-010', cambios: { precioUnitario: '14.000', activo: false, codigo: 'OTRO', creadoPor: 'hacker', creadoEl: 'x' }, uid: 'u2' });
  const m = s.almacen.get('materiales/INS-010');
  assert.equal(m.precioUnitario, 14000);
  assert.equal(m.activo, false, 'retirar es activo:false, no borrar');
  assert.equal(m.codigo, 'INS-010');
  assert.equal(m.creadoPor, 'u1');
  assert.equal(m.creadoEl, ISO);
  assert.deepEqual(Object.keys(s.escrituras.at(-1).datos).sort(), ['activo', 'precioUnitario']);
});

test('editar: no se puede cambiar un ramo, ni un material que no existe, ni dejar datos inválidos; sin cambios no escribe', async () => {
  const s = simulador();
  await crearMaterial({ ...s, datos: MATERIAL, uid: 'u1', ahora: AHORA });
  const n = s.escrituras.length;
  await assert.rejects(actualizarMaterial({ ...s, codigo: 'RAM-STD', cambios: { precioUnitario: 1 }, uid: 'u1' }), /ramo|reservado/i);
  await assert.rejects(actualizarMaterial({ ...s, codigo: 'NOPE-1', cambios: { precioUnitario: 1 }, uid: 'u1' }), /no existe/i);
  await assert.rejects(actualizarMaterial({ ...s, codigo: 'INS-010', cambios: { precioUnitario: '-3' }, uid: 'u1' }), /precio/i);
  await assert.rejects(actualizarMaterial({ ...s, codigo: 'INS-010', cambios: { tipo: 'Cualquiera' }, uid: 'u1' }), /tipo/i);
  await assert.rejects(actualizarMaterial({ ...s, codigo: 'INS-010', cambios: {}, uid: 'u1' }), /nada que cambiar|ningún cambio/i);
  assert.equal(s.escrituras.length, n);
});

test('CA7: emitir toma el siguiente número del contador, guarda la OC con totales (R6) y actualiza el contador', async () => {
  const s = simulador({ inicial: { 'contadores/ordenesCompra': { ultimo: 41 } } });
  const r = await emitirOrden({ ...s, datos: ORDEN(), uid: 'u1', ahora: AHORA });
  assert.equal(r.numero, 'OC-0042');
  assert.deepEqual(s.almacen.get('contadores/ordenesCompra'), { ultimo: 42 });
  const oc = s.almacen.get('ordenesCompra/OC-0042');
  assert.equal(oc.numero, 'OC-0042');
  assert.deepEqual([oc.neto, oc.iva, oc.total], [4500, 855, 5355]);
  assert.equal(oc.estado, 'Emitida');
  assert.equal(oc.creadaEl, ISO);
  assert.equal(oc.creadaPor, 'u1');
  assert.deepEqual(r.orden, oc);
});

test('emitir con el contador aún inexistente empieza en OC-0001', async () => {
  const s = simulador();
  const r = await emitirOrden({ ...s, datos: ORDEN(), uid: 'u1', ahora: AHORA });
  assert.equal(r.numero, 'OC-0001');
  assert.deepEqual(s.almacen.get('contadores/ordenesCompra'), { ultimo: 1 });
});

test('CA8: emisiones simultáneas obtienen números distintos y consecutivos, sin saltos ni repetidos', async () => {
  const s = simulador();
  const resultados = await Promise.all(Array.from({ length: 6 }, (_, i) => emitirOrden({ ...s, datos: ORDEN(), uid: `u${i}`, ahora: AHORA })));
  const numeros = resultados.map((r) => r.numero).sort();
  assert.deepEqual(numeros, ['OC-0001', 'OC-0002', 'OC-0003', 'OC-0004', 'OC-0005', 'OC-0006']);
  assert.deepEqual(s.almacen.get('contadores/ordenesCompra'), { ultimo: 6 });
  assert.equal([...s.almacen.keys()].filter((k) => k.startsWith('ordenesCompra/OC-')).length, 6);
});

test('una orden inválida no consume número ni escribe nada (R8)', async () => {
  const s = simulador();
  const sinLineas = ORDEN(); sinLineas.lineas = [];
  await assert.rejects(emitirOrden({ ...s, datos: sinLineas, uid: 'u1', ahora: AHORA }), /línea/i);
  const sinRazon = ORDEN(); sinRazon.proveedor.razonSocial = '';
  await assert.rejects(emitirOrden({ ...s, datos: sinRazon, uid: 'u1', ahora: AHORA }), /razón social/i);
  assert.equal(s.escrituras.length, 0);
  assert.equal(s.almacen.has('contadores/ordenesCompra'), false);
});

test('si la emisión es rechazada no se avanza el contador (todo o nada) y un contador corrupto se rechaza', async () => {
  const rechazada = simulador({ falla: 'permission-denied' });
  await assert.rejects(emitirOrden({ ...rechazada, datos: ORDEN(), uid: 'u1', ahora: AHORA }), (e) => e.code === 'permission-denied');
  assert.equal(rechazada.almacen.size, 0);
  const corrupto = simulador({ inicial: { 'contadores/ordenesCompra': { ultimo: 'x' } } });
  await assert.rejects(emitirOrden({ ...corrupto, datos: ORDEN(), uid: 'u1', ahora: AHORA }), /contador/i);
  const chocado = simulador({ inicial: { 'contadores/ordenesCompra': { ultimo: 0 }, 'ordenesCompra/OC-0001': { numero: 'OC-0001' } } });
  await assert.rejects(emitirOrden({ ...chocado, datos: ORDEN(), uid: 'u1', ahora: AHORA }), /ya existe/i);
});

test('CA10: cambiar el precio del maestro después no altera una OC ya emitida (la OC guarda sus propios precios)', async () => {
  const s = simulador();
  await crearMaterial({ ...s, datos: { ...MATERIAL, codigo: 'INS-001', precioUnitario: 1500 }, uid: 'u1', ahora: AHORA });
  const { numero } = await emitirOrden({ ...s, datos: ORDEN(), uid: 'u1', ahora: AHORA });
  await actualizarMaterial({ ...s, codigo: 'INS-001', cambios: { precioUnitario: 9999 }, uid: 'u1' });
  const oc = s.almacen.get(`ordenesCompra/${numero}`);
  assert.equal(oc.lineas[0].precioUnitario, 1500);
  assert.equal(oc.total, 5355);
});

test('CA9 (cliente): anular solo pasa de Emitida a Anulada con motivo; no toca montos ni líneas', async () => {
  const s = simulador();
  const { numero } = await emitirOrden({ ...s, datos: ORDEN(), uid: 'u1', ahora: AHORA });
  const antes = JSON.stringify(s.almacen.get(`ordenesCompra/${numero}`));
  await assert.rejects(anularOrden({ ...s, numero, motivo: '  ', uid: 'u1', ahora: AHORA }), /motivo/i);
  assert.equal(JSON.stringify(s.almacen.get(`ordenesCompra/${numero}`)), antes);
  await anularOrden({ ...s, numero, motivo: 'Pedido duplicado', uid: 'u9', ahora: new Date('2026-11-23T10:00:00.000Z') });
  const oc = s.almacen.get(`ordenesCompra/${numero}`);
  assert.equal(oc.estado, 'Anulada');
  assert.equal(oc.motivoAnulacion, 'Pedido duplicado');
  assert.equal(oc.anuladaEl, '2026-11-23T10:00:00.000Z');
  assert.equal(oc.anuladaPor, 'u9');
  assert.deepEqual([oc.neto, oc.iva, oc.total], [4500, 855, 5355]);
  assert.equal(oc.lineas.length, 1);
  assert.deepEqual(Object.keys(s.escrituras.at(-1).datos).sort(), ['anuladaEl', 'anuladaPor', 'estado', 'motivoAnulacion']);
});

test('anular: una OC ya anulada o inexistente no se puede anular; el número anulado no se reutiliza', async () => {
  const s = simulador();
  const { numero } = await emitirOrden({ ...s, datos: ORDEN(), uid: 'u1', ahora: AHORA });
  await anularOrden({ ...s, numero, motivo: 'Error', uid: 'u1', ahora: AHORA });
  await assert.rejects(anularOrden({ ...s, numero, motivo: 'Otra vez', uid: 'u1', ahora: AHORA }), /ya está anulada/i);
  await assert.rejects(anularOrden({ ...s, numero: 'OC-0999', motivo: 'x', uid: 'u1', ahora: AHORA }), /no existe/i);
  await assert.rejects(anularOrden({ ...s, numero: 'malo', motivo: 'x', uid: 'u1', ahora: AHORA }), /número/i);
  const siguiente = await emitirOrden({ ...s, datos: ORDEN(), uid: 'u1', ahora: AHORA });
  assert.equal(siguiente.numero, 'OC-0002', 'R4: nunca se reutiliza un número, aunque la OC se anule');
});

test('textoErrorOC: permiso denegado explica que falta permiso o que las reglas no están publicadas; el resto, un mensaje claro', () => {
  assert.match(textoErrorOC({ code: 'permission-denied' }), /permiso|reglas/i);
  assert.match(textoErrorOC(new Error('El código ya existe')), /El código ya existe/);
  assert.match(textoErrorOC({ code: 'unavailable' }), /conexi/i);
  assert.ok(textoErrorOC(null).length > 10);
});

test('textoErrorCarga: al leer, un permiso denegado habla de leer (no de guardar) y explica que las reglas pueden no estar publicadas', () => {
  const t = textoErrorCarga({ code: 'permission-denied' });
  assert.match(t, /leer|cargar/i);
  assert.match(t, /reglas/i);
  assert.ok(!/guardado|no se guardó/i.test(t), 'una lectura no guarda nada');
  assert.match(textoErrorCarga({ code: 'unavailable' }), /conexi/i);
  assert.ok(textoErrorCarga(null).length > 10);
});

// ---------------------------------------------------------------------------------------------------------------
// Spec 063: seguimiento de pago (estado Pagada, N° de factura, fecha de pago, comentario)
// ---------------------------------------------------------------------------------------------------------------
const DUENO = { dueno: true, rol: 'supervisor' };
const ADMIN = { rol: 'administrador' };
const SUPERVISOR = { rol: 'supervisor' };
const HOY = '2026-11-23';
const AHORA_PAGO = new Date('2026-11-23T14:00:00.000Z');
const ISO_PAGO = '2026-11-23T14:00:00.000Z';
const PATH = 'ordenesCompra/OC-0001';
const COMERCIALES = ['numero', 'fecha', 'fechaEntrega', 'proveedor', 'proveedorId', 'condicionesPago', 'lugarEntrega', 'lineas', 'neto', 'iva', 'total',
  'creadaEl', 'creadaPor', 'envios', 'anuladaEl', 'anuladaPor', 'motivoAnulacion'];
const PERMITIDAS = ['estado', 'facturaNumero', 'fechaPago', 'pagoRegistradoEl', 'pagoRegistradoPor', 'pagoRevertidoEl', 'pagoRevertidoPor',
  'motivoReversionPago', 'comentario', 'comentarioActualizadoEl', 'comentarioActualizadoPor'];

const ordenBase = (extra = {}) => ({
  numero: 'OC-0001', fecha: '2026-11-20', fechaEntrega: '', condicionesPago: 'Transferencia', lugarEntrega: 'Bodega',
  proveedor: { razonSocial: 'Flores del Sur SpA', rut: '', contacto: '', telefono: '', direccion: '' }, proveedorId: 'p1',
  lineas: [{ codigo: 'INS-001', descripcion: 'Papel', unidad: 'UNI', cantidad: 3, precioUnitario: 1500, valor: 4500 }],
  neto: 4500, iva: 855, total: 5355, estado: 'Emitida', creadaEl: ISO, creadaPor: 'u1', envios: [{ para: 'a@ejemplo.test' }], ...extra,
});
const conOrden = (extra, opciones) => simulador({ inicial: { [PATH]: ordenBase(extra) }, ...opciones });
const pagada = (extra = {}) => ({ estado: 'Pagada', facturaNumero: 'F-100', fechaPago: '2026-11-21', pagoRegistradoEl: ISO, pagoRegistradoPor: 'u1', ...extra });
const guardar = (s, args) => guardarSeguimientoOrden({
  ...s, numero: 'OC-0001', uid: 'u-dueno', perfil: DUENO, ahora: AHORA_PAGO, hoy: HOY, ...args,
});

test('CA1: Emitida → Pagada escribe solo estado, factura, fecha y constancia; lo comercial no se toca', async () => {
  const s = conOrden();
  const antes = JSON.stringify(s.almacen.get(PATH));
  await guardar(s, { estadoVisto: 'Emitida', estadoNuevo: 'Pagada', facturaNumero: ' F-1234 ', fechaPago: '2026-11-22' });
  assert.deepEqual(s.escrituras.at(-1).datos, {
    estado: 'Pagada', facturaNumero: 'F-1234', fechaPago: '2026-11-22', pagoRegistradoEl: ISO_PAGO, pagoRegistradoPor: 'u-dueno',
  });
  const oc = s.almacen.get(PATH);
  for (const k of COMERCIALES) assert.deepEqual(oc[k], JSON.parse(antes)[k], `${k} no debe cambiar`);
  assert.equal(oc.estado, 'Pagada');
});

test('CA1: el administrador también registra el pago', async () => {
  const s = conOrden();
  await guardar(s, { perfil: ADMIN, uid: 'u-admin', estadoVisto: 'Emitida', estadoNuevo: 'Pagada', facturaNumero: '77', fechaPago: '2026-11-21' });
  assert.equal(s.almacen.get(PATH).pagoRegistradoPor, 'u-admin');
});

test('CA2/CA3: un pago sin factura, con factura mala o con fecha mala se rechaza antes de escribir', async () => {
  const s = conOrden();
  const base = { estadoVisto: 'Emitida', estadoNuevo: 'Pagada', facturaNumero: 'F-1', fechaPago: '2026-11-22' };
  for (const malo of [
    { facturaNumero: '' }, { facturaNumero: '1'.repeat(21) }, { facturaNumero: '<b>1' },
    { fechaPago: '' }, { fechaPago: '2026-02-30' }, { fechaPago: '2026-11-19' }, { fechaPago: '2026-11-24' },
  ]) {
    await assert.rejects(guardar(s, { ...base, ...malo }), /factura|fecha/i, JSON.stringify(malo));
  }
  assert.equal(s.escrituras.length, 0);
  assert.equal(s.almacen.get(PATH).estado, 'Emitida');
});

test('CA4: corregir la factura de una Pagada la deja Pagada y escribe solo lo que cambió más la constancia', async () => {
  const s = conOrden(pagada());
  await guardar(s, { estadoVisto: 'Pagada', estadoNuevo: 'Pagada', facturaNumero: 'F-200', fechaPago: '2026-11-21' });
  assert.deepEqual(s.escrituras.at(-1).datos, { facturaNumero: 'F-200', pagoRegistradoEl: ISO_PAGO, pagoRegistradoPor: 'u-dueno' });
  assert.equal(s.almacen.get(PATH).estado, 'Pagada');
});

test('CA4: corregir la fecha respeta las mismas reglas (no anterior a la orden, no futura)', async () => {
  const s = conOrden(pagada());
  await assert.rejects(guardar(s, { estadoVisto: 'Pagada', estadoNuevo: 'Pagada', fechaPago: '2026-11-01' }), /anterior/i);
  await assert.rejects(guardar(s, { estadoVisto: 'Pagada', estadoNuevo: 'Pagada', fechaPago: '2026-12-01' }), /futura/i);
  await guardar(s, { estadoVisto: 'Pagada', estadoNuevo: 'Pagada', fechaPago: '2026-11-22' });
  assert.deepEqual(Object.keys(s.escrituras.at(-1).datos).sort(), ['fechaPago', 'pagoRegistradoEl', 'pagoRegistradoPor']);
});

test('CA10: pago y comentario viajan en una sola escritura, con la constancia del comentario', async () => {
  const s = conOrden();
  await guardar(s, { estadoVisto: 'Emitida', estadoNuevo: 'Pagada', facturaNumero: 'F-9', fechaPago: '2026-11-22', comentario: '  Pagó el gerente  ' });
  assert.equal(s.escrituras.length, 1);
  const d = s.escrituras.at(-1).datos;
  assert.equal(d.comentario, 'Pagó el gerente');
  assert.equal(d.comentarioActualizadoEl, ISO_PAGO);
  assert.equal(d.comentarioActualizadoPor, 'u-dueno');
  assert.equal(d.estado, 'Pagada');
});

test('CA10: el comentario de 500 caracteres pasa, el de 501 no, y se puede borrar con texto vacío', async () => {
  const s = conOrden();
  await guardar(s, { estadoVisto: 'Emitida', estadoNuevo: 'Emitida', comentario: 'a'.repeat(500) });
  await assert.rejects(guardar(s, { estadoVisto: 'Emitida', estadoNuevo: 'Emitida', comentario: 'a'.repeat(501) }), /500/);
  await guardar(s, { estadoVisto: 'Emitida', estadoNuevo: 'Emitida', comentario: '   ' });
  assert.equal(s.almacen.get(PATH).comentario, '');
});

test('CA12: un supervisor solo puede comentar: la escritura trae solo campos de comentario', async () => {
  const s = conOrden(pagada());
  await guardar(s, { perfil: SUPERVISOR, uid: 'u-sup', estadoVisto: 'Pagada', estadoNuevo: 'Pagada', comentario: 'Falta el comprobante' });
  assert.deepEqual(s.escrituras.at(-1).datos, { comentario: 'Falta el comprobante', comentarioActualizadoEl: ISO_PAGO, comentarioActualizadoPor: 'u-sup' });
  assert.equal(s.almacen.get(PATH).facturaNumero, 'F-100');
});

test('CA12: un supervisor no puede registrar, corregir ni revertir un pago', async () => {
  const emitida = conOrden();
  await assert.rejects(guardar(emitida, { perfil: SUPERVISOR, estadoVisto: 'Emitida', estadoNuevo: 'Pagada', facturaNumero: 'F-1', fechaPago: '2026-11-22' }), /permiso|no puede/i);
  const paga = conOrden(pagada());
  await assert.rejects(guardar(paga, { perfil: SUPERVISOR, estadoVisto: 'Pagada', estadoNuevo: 'Pagada', facturaNumero: 'F-2' }), /permiso|no puede/i);
  await assert.rejects(guardar(paga, { perfil: SUPERVISOR, estadoVisto: 'Pagada', estadoNuevo: 'Emitida', motivo: 'x' }), /permiso|no puede/i);
  await assert.rejects(guardar(paga, { perfil: null, estadoVisto: 'Pagada', estadoNuevo: 'Pagada', facturaNumero: 'F-2' }), /permiso|no puede/i);
  assert.equal(emitida.escrituras.length + paga.escrituras.length, 0);
});

test('CA5: revertir Pagada → Emitida vacía factura y fecha y deja constancia con lo que se quitó', async () => {
  const s = conOrden(pagada());
  await guardar(s, { estadoVisto: 'Pagada', estadoNuevo: 'Emitida', motivo: ' Se marcó por error ' });
  assert.deepEqual(s.escrituras.at(-1).datos, {
    estado: 'Emitida', facturaNumero: '', fechaPago: '',
    pagoRevertidoEl: ISO_PAGO, pagoRevertidoPor: 'u-dueno',
    motivoReversionPago: 'Se quitó: factura N° F-100 y fecha de pago 2026-11-21. Motivo: Se marcó por error',
  });
  assert.equal(s.almacen.get(PATH).estado, 'Emitida');
});

test('CA6: revertir sin motivo, o con un motivo que no cabe en 500, se rechaza', async () => {
  const s = conOrden(pagada());
  await assert.rejects(guardar(s, { estadoVisto: 'Pagada', estadoNuevo: 'Emitida', motivo: '  ' }), /motivo/i);
  await assert.rejects(guardar(s, { estadoVisto: 'Pagada', estadoNuevo: 'Emitida', motivo: 'm'.repeat(500) }), /500/);
  assert.equal(s.escrituras.length, 0);
});

test('CA5: tras revertir se puede volver a pagar y los datos nuevos reemplazan a los anteriores', async () => {
  const s = conOrden(pagada());
  await guardar(s, { estadoVisto: 'Pagada', estadoNuevo: 'Emitida', motivo: 'Error' });
  await guardar(s, { estadoVisto: 'Emitida', estadoNuevo: 'Pagada', facturaNumero: 'F-300', fechaPago: '2026-11-23' });
  const oc = s.almacen.get(PATH);
  assert.deepEqual([oc.estado, oc.facturaNumero, oc.fechaPago], ['Pagada', 'F-300', '2026-11-23']);
});

test('CA7: una orden Pagada no se puede anular desde el seguimiento (se corrige con nota de crédito)', async () => {
  const s = conOrden(pagada());
  await assert.rejects(guardar(s, { estadoVisto: 'Pagada', estadoNuevo: 'Anulada' }), /no se puede anular desde el estado «Pagada»/);
  assert.equal(s.escrituras.length, 0);
});

test('CA7: Anulada no se pide por el seguimiento: para anular está «Anular»', async () => {
  const s = conOrden();
  await assert.rejects(guardar(s, { estadoVisto: 'Emitida', estadoNuevo: 'Anulada' }), /Anular/);
  assert.equal(s.escrituras.length, 0);
});

test('CA8: una orden Anulada no admite ningún cambio de pago, estado ni comentario', async () => {
  const s = conOrden({ estado: 'Anulada', anuladaEl: ISO, anuladaPor: 'u1', motivoAnulacion: 'Duplicada' });
  for (const cambio of [
    { estadoNuevo: 'Pagada', facturaNumero: 'F-1', fechaPago: '2026-11-22' },
    { estadoNuevo: 'Emitida' },
    { estadoNuevo: 'Anulada', comentario: 'Nota' },
  ]) {
    await assert.rejects(guardar(s, { estadoVisto: 'Anulada', ...cambio }), /anulada/i);
  }
  assert.equal(s.escrituras.length, 0);
});

test('CA11: si otra persona cambió el estado mientras se editaba, no se escribe y se avisa', async () => {
  const s = conOrden(pagada());
  await assert.rejects(
    guardar(s, { estadoVisto: 'Emitida', estadoNuevo: 'Pagada', facturaNumero: 'F-9', fechaPago: '2026-11-22' }),
    (e) => e.code === 'estado-cambiado' && /cambi/i.test(e.message),
  );
  assert.equal(s.escrituras.length, 0);
});

test('CA11: dos registros de pago a la vez: gana uno y el otro es rechazado, sin pisarse', async () => {
  const s = conOrden();
  const intento = (factura) => guardar(s, { estadoVisto: 'Emitida', estadoNuevo: 'Pagada', facturaNumero: factura, fechaPago: '2026-11-22' });
  const resultados = await Promise.allSettled([intento('F-1'), intento('F-2')]);
  assert.equal(resultados.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(resultados.filter((r) => r.status === 'rejected').length, 1);
  assert.equal(s.escrituras.length, 1);
});

test('una orden inexistente, un número malo, sin usuario o sin ningún cambio se rechazan sin escribir', async () => {
  const s = conOrden();
  await assert.rejects(guardar(s, { numero: 'OC-0999', estadoVisto: 'Emitida', estadoNuevo: 'Pagada', facturaNumero: 'F-1', fechaPago: '2026-11-22' }), /no existe/i);
  await assert.rejects(guardar(s, { numero: 'malo', estadoVisto: 'Emitida', estadoNuevo: 'Emitida', comentario: 'x' }), /número/i);
  await assert.rejects(guardar(s, { uid: '', estadoVisto: 'Emitida', estadoNuevo: 'Emitida', comentario: 'x' }), /usuario/i);
  await assert.rejects(guardar(s, { estadoVisto: 'Emitida', estadoNuevo: 'Emitida' }), /ningún cambio/i);
  await assert.rejects(guardar(s, { estadoVisto: 'Emitida', estadoNuevo: 'Emitida', comentario: '' }), /ningún cambio/i); // ya estaba sin comentario
  assert.equal(s.escrituras.length, 0);
});

test('sin cambios reales: repetir el mismo comentario o la misma factura no escribe', async () => {
  const s = conOrden(pagada({ comentario: 'Hola' }));
  await assert.rejects(guardar(s, { estadoVisto: 'Pagada', estadoNuevo: 'Pagada', comentario: ' Hola ' }), /ningún cambio/i);
  await assert.rejects(guardar(s, { estadoVisto: 'Pagada', estadoNuevo: 'Pagada', facturaNumero: 'F-100', fechaPago: '2026-11-21' }), /ningún cambio/i);
  assert.equal(s.escrituras.length, 0);
});

test('factura y fecha solo se guardan al marcar Pagada: con la orden Emitida y sin cambiar de estado se rechaza', async () => {
  const s = conOrden();
  await assert.rejects(guardar(s, { estadoVisto: 'Emitida', estadoNuevo: 'Emitida', facturaNumero: 'F-1', fechaPago: '2026-11-22' }), /Pagada/);
  assert.equal(s.escrituras.length, 0);
});

test('R15: si Firestore rechaza el guardado, el error llega con su código y no queda nada escrito', async () => {
  const s = conOrden(undefined, { falla: 'permission-denied' });
  await assert.rejects(guardar(s, { estadoVisto: 'Emitida', estadoNuevo: 'Pagada', facturaNumero: 'F-1', fechaPago: '2026-11-22' }), (e) => e.code === 'permission-denied');
  assert.equal(s.almacen.get(PATH).estado, 'Emitida');
});

test('CA9/R10: ninguna escritura del seguimiento incluye campos comerciales; todas están en la lista cerrada', async () => {
  const casos = [
    [conOrden(), { estadoVisto: 'Emitida', estadoNuevo: 'Pagada', facturaNumero: 'F-1', fechaPago: '2026-11-22', comentario: 'c' }],
    [conOrden(pagada()), { estadoVisto: 'Pagada', estadoNuevo: 'Pagada', facturaNumero: 'F-9' }],
    [conOrden(pagada()), { estadoVisto: 'Pagada', estadoNuevo: 'Emitida', motivo: 'm', comentario: 'c' }],
    [conOrden(pagada()), { perfil: SUPERVISOR, estadoVisto: 'Pagada', estadoNuevo: 'Pagada', comentario: 'c' }],
  ];
  for (const [s, args] of casos) {
    await guardar(s, args);
    const claves = Object.keys(s.escrituras.at(-1).datos);
    for (const k of claves) {
      assert.ok(PERMITIDAS.includes(k), `clave fuera de la lista cerrada: ${k}`);
      assert.ok(!COMERCIALES.includes(k), `clave comercial escrita: ${k}`);
    }
  }
});

test('la anulación existente sigue igual y una orden Pagada no se puede anular con anularOrden', async () => {
  const s = conOrden(pagada());
  await assert.rejects(anularOrden({ ...s, numero: 'OC-0001', motivo: 'x', uid: 'u1', ahora: AHORA }), /no se puede anular desde el estado «Pagada»/);
  assert.equal(s.escrituras.length, 0);
});
