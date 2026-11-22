import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COLECCION_MATERIALES, COLECCION_ORDENES, COLECCION_CONTADORES, DOC_CONTADOR_ORDENES,
  crearMaterial, actualizarMaterial, emitirOrden, anularOrden, textoErrorOC, textoErrorCarga,
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
