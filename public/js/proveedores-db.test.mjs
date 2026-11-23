import test from 'node:test';
import assert from 'node:assert/strict';
import { simuladorFirestore } from '../../tests/helpers/firestore-simulado.mjs';
import {
  crearProveedor, editarProveedor, cambiarActivoProveedor, textoErrorProveedor,
} from './proveedores-db.js';

const AHORA = new Date('2026-11-23T12:00:00.000Z');
const ISO = '2026-11-23T12:00:00.000Z';
const DATOS = {
  razonSocial: 'Flores del Sur SpA', rut: '76.543.210-3', contacto: 'Ana Pérez', telefono: '+56 9 1234 5678',
  direccion: 'Calle 1, Maipú', condicionesPago: 'Transferencia',
};
const OTRO_RUT = '30.000.007-K';

function entorno() {
  const s = simuladorFirestore();
  const refs = {
    proveedor: (id) => s.refs.ref(`proveedores/${id}`),
    proveedorNuevo: () => s.refs.nuevoId('proveedores'),
    rut: (rut) => s.refs.ref(`proveedoresRut/${rut}`),
  };
  return { s, base: { ejecutarTransaccion: s.ejecutarTransaccion, refs } };
}

test('CA-P1: crear un proveedor guarda sus datos, quién y cuándo, y reserva su RUT', async () => {
  const { s, base } = entorno();
  const id = await crearProveedor({ ...base, datos: DATOS, uid: 'u1', ahora: AHORA });
  const prov = s.almacen.get(`proveedores/${id}`);
  assert.equal(prov.razonSocial, 'Flores del Sur SpA');
  assert.equal(prov.rut, '76.543.210-3');
  assert.equal(prov.activo, true);
  assert.equal(prov.creadoPor, 'u1');
  assert.equal(prov.creadoEl, ISO);
  assert.equal(prov.rutNormalizado, undefined, 'el RUT normalizado solo va en el bloqueo');
  assert.deepEqual(s.almacen.get('proveedoresRut/76543210-3'), { proveedorId: id, liberado: false, actualizadoEl: ISO });
});

test('CA-P3: un RUT ya reservado se rechaza con «Ya existe un proveedor con ese RUT» y no se escribe nada', async () => {
  const { s, base } = entorno();
  await crearProveedor({ ...base, datos: DATOS, uid: 'u1', ahora: AHORA });
  const antes = s.escrituras.length;
  await assert.rejects(
    crearProveedor({ ...base, datos: { ...DATOS, razonSocial: 'Otra' }, uid: 'u1', ahora: AHORA }),
    (e) => e.code === 'codigo-existe' && /Ya existe un proveedor con ese RUT/.test(e.message),
  );
  assert.equal(s.escrituras.length, antes);
});

test('CA-P3: dos altas simultáneas con el mismo RUT: solo una gana', async () => {
  const { base } = entorno();
  const resultados = await Promise.allSettled([
    crearProveedor({ ...base, datos: DATOS, uid: 'u1', ahora: AHORA }),
    crearProveedor({ ...base, datos: { ...DATOS, razonSocial: 'Copia' }, uid: 'u2', ahora: AHORA }),
  ]);
  assert.equal(resultados.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(resultados.filter((r) => r.status === 'rejected').length, 1);
});

test('crear rechaza datos inválidos antes de tocar Firestore (RUT con dígito malo)', async () => {
  const { s, base } = entorno();
  await assert.rejects(crearProveedor({ ...base, datos: { ...DATOS, rut: '76.543.210-9' }, uid: 'u1', ahora: AHORA }), /dígito verificador/);
  assert.equal(s.escrituras.length, 0);
});

test('un RUT cuyo bloqueo está liberado se puede volver a usar (R-P3)', async () => {
  const { s, base } = entorno();
  const primero = await crearProveedor({ ...base, datos: DATOS, uid: 'u1', ahora: AHORA });
  await editarProveedor({ ...base, id: primero, cambios: { rut: OTRO_RUT }, uid: 'u1', ahora: AHORA });
  // El RUT anterior quedó liberado: otro proveedor lo puede tomar.
  const segundo = await crearProveedor({ ...base, datos: { ...DATOS, razonSocial: 'Nueva' }, uid: 'u2', ahora: AHORA });
  assert.equal(s.almacen.get('proveedoresRut/76543210-3').proveedorId, segundo);
  assert.equal(s.almacen.get('proveedoresRut/76543210-3').liberado, false);
});

test('editar cambiando el RUT reserva el nuevo, libera el anterior y no borra nada (R-P3)', async () => {
  const { s, base } = entorno();
  const id = await crearProveedor({ ...base, datos: DATOS, uid: 'u1', ahora: AHORA });
  await editarProveedor({ ...base, id, cambios: { rut: OTRO_RUT, contacto: 'Luis' }, uid: 'u2', ahora: AHORA });
  const prov = s.almacen.get(`proveedores/${id}`);
  assert.equal(prov.rut, '30.000.007-K');
  assert.equal(prov.contacto, 'Luis');
  assert.equal(prov.creadoPor, 'u1', 'quién creó no cambia');
  assert.equal(prov.actualizadoPor, 'u2');
  assert.deepEqual(s.almacen.get('proveedoresRut/30000007-K'), { proveedorId: id, liberado: false, actualizadoEl: ISO });
  assert.equal(s.almacen.get('proveedoresRut/76543210-3').liberado, true);
  assert.ok(s.escrituras.every((e) => e.tipo === 'set' || e.tipo === 'update'), 'nunca se borra');
});

test('editar a un RUT que otro proveedor tiene reservado se rechaza sin escribir (R-P3, CA-P3)', async () => {
  const { s, base } = entorno();
  await crearProveedor({ ...base, datos: DATOS, uid: 'u1', ahora: AHORA });
  const otro = await crearProveedor({ ...base, datos: { ...DATOS, rut: OTRO_RUT, razonSocial: 'Segunda' }, uid: 'u1', ahora: AHORA });
  const antes = s.escrituras.length;
  await assert.rejects(
    editarProveedor({ ...base, id: otro, cambios: { rut: DATOS.rut }, uid: 'u1', ahora: AHORA }),
    (e) => e.code === 'codigo-existe',
  );
  assert.equal(s.escrituras.length, antes);
});

test('editar sin cambiar el RUT no toca el bloqueo', async () => {
  const { s, base } = entorno();
  const id = await crearProveedor({ ...base, datos: DATOS, uid: 'u1', ahora: AHORA });
  const antes = s.escrituras.length;
  await editarProveedor({ ...base, id, cambios: { direccion: 'Calle 9' }, uid: 'u1', ahora: AHORA });
  const nuevas = s.escrituras.slice(antes);
  assert.equal(nuevas.length, 1);
  assert.equal(nuevas[0].path, `proveedores/${id}`);
});

test('editar no cambia el campo activo: con solo ese campo no hay nada que guardar', async () => {
  const { s, base } = entorno();
  const id = await crearProveedor({ ...base, datos: DATOS, uid: 'u1', ahora: AHORA });
  await assert.rejects(editarProveedor({ ...base, id, cambios: { activo: false }, uid: 'u1', ahora: AHORA }), /No hay ningún cambio/);
  assert.equal(s.almacen.get(`proveedores/${id}`).activo, true);
});

test('editar un proveedor que no existe falla con un aviso claro', async () => {
  const { base } = entorno();
  await assert.rejects(editarProveedor({ ...base, id: 'no-existe', cambios: { contacto: 'x' }, uid: 'u1', ahora: AHORA }), /no existe/);
});

test('CA-P4: quitar un proveedor pone activo en false y no borra ni cambia sus datos', async () => {
  const { s, base } = entorno();
  const id = await crearProveedor({ ...base, datos: DATOS, uid: 'u1', ahora: AHORA });
  await cambiarActivoProveedor({ ...base, id, activo: false, uid: 'u2', ahora: AHORA });
  const prov = s.almacen.get(`proveedores/${id}`);
  assert.equal(prov.activo, false);
  assert.equal(prov.razonSocial, 'Flores del Sur SpA');
  assert.equal(prov.actualizadoPor, 'u2');
  assert.ok(s.escrituras.every((e) => e.tipo !== 'delete'));
});

test('reactivar devuelve el proveedor a activo; un valor que no es booleano se rechaza', async () => {
  const { s, base } = entorno();
  const id = await crearProveedor({ ...base, datos: DATOS, uid: 'u1', ahora: AHORA });
  await cambiarActivoProveedor({ ...base, id, activo: false, uid: 'u1', ahora: AHORA });
  await cambiarActivoProveedor({ ...base, id, activo: true, uid: 'u1', ahora: AHORA });
  assert.equal(s.almacen.get(`proveedores/${id}`).activo, true);
  await assert.rejects(cambiarActivoProveedor({ ...base, id, activo: 'si', uid: 'u1', ahora: AHORA }), /activo o quitado/);
});

test('textoErrorProveedor: mensajes claros para RUT repetido y para permiso denegado', () => {
  assert.equal(textoErrorProveedor({ code: 'codigo-existe', message: 'Ya existe un proveedor con ese RUT.' }), 'Ya existe un proveedor con ese RUT.');
  assert.match(textoErrorProveedor({ code: 'permission-denied' }), /permiso/);
  assert.match(textoErrorProveedor({}), /Vuelve a intentar/);
});

test('contrato con las reglas de la web: el proveedor guarda el RUT con puntos y K mayúscula, y el id del candado es ese RUT sin puntos (con guion)', async () => {
  // Entradas de todo tipo (con y sin puntos, con k minúscula, con espacios) deben terminar en el mismo formato.
  const casos = [['76.543.210-3', '76543210-3'], ['76543210-3', '76543210-3'], [' 30.000.007-k ', '30000007-K'], ['30000007-k', '30000007-K']];
  for (const [entrada, idCandado] of casos) {
    const { s, base } = entorno();
    const id = await crearProveedor({ ...base, datos: { ...DATOS, rut: entrada }, uid: 'u1', ahora: AHORA });
    const rut = s.almacen.get(`proveedores/${id}`).rut;
    assert.match(rut, /^\d{1,2}\.\d{3}\.\d{3}-[0-9K]$/, `RUT guardado con puntos y K mayúscula (${entrada})`);
    assert.equal(rut.replace(/\./g, ''), idCandado, 'el id del candado es el RUT guardado sin puntos');
    assert.ok(s.almacen.has(`proveedoresRut/${idCandado}`), 'el candado existe con ese id');
    assert.equal(s.almacen.get(`proveedoresRut/${idCandado}`).proveedorId, id);
  }
});

test('contrato con las reglas de la web: al editar el RUT se mantiene el mismo formato en el proveedor y en los dos candados', async () => {
  const { s, base } = entorno();
  const id = await crearProveedor({ ...base, datos: DATOS, uid: 'u1', ahora: AHORA });
  await editarProveedor({ ...base, id, cambios: { rut: '30000007-k' }, uid: 'u1', ahora: AHORA });
  assert.equal(s.almacen.get(`proveedores/${id}`).rut, '30.000.007-K');
  assert.equal(s.almacen.get('proveedoresRut/30000007-K').liberado, false);
  assert.equal(s.almacen.get('proveedoresRut/76543210-3').liberado, true);
});

// ---- Spec 058: correo del proveedor en las escrituras (CA2, CA3, R3, R4)
test('spec 058: crear sin correo (ausente o vacío) no guarda la clave correo; con correo válido la guarda', async () => {
  const { s, base } = entorno();
  const sin = await crearProveedor({ ...base, datos: DATOS, uid: 'u1', ahora: AHORA });
  assert.equal('correo' in s.almacen.get(`proveedores/${sin}`), false);
  const vacio = await crearProveedor({ ...base, datos: { ...DATOS, rut: OTRO_RUT, correo: '  ' }, uid: 'u1', ahora: AHORA });
  assert.equal('correo' in s.almacen.get(`proveedores/${vacio}`), false, 'vacío al crear = sin clave');
  const con = await crearProveedor({ ...base, datos: { ...DATOS, rut: '12.345.678-5', correo: ' ventas@ejemplo.test ' }, uid: 'u1', ahora: AHORA });
  assert.equal(s.almacen.get(`proveedores/${con}`).correo, 'ventas@ejemplo.test');
  assert.deepEqual(Object.keys(s.almacen.get('proveedoresRut/12345678-5')).sort(), ['actualizadoEl', 'liberado', 'proveedorId'], 'el candado de RUT no cambia');
});

test('spec 058: crear con un correo malo se rechaza sin escribir nada (ni proveedor ni candado)', async () => {
  const { s, base } = entorno();
  for (const malo of ['sin-arroba', 'a@ejemplo.test,b@ejemplo.test', 'a b@ejemplo.test']) {
    await assert.rejects(crearProveedor({ ...base, datos: { ...DATOS, correo: malo }, uid: 'u1', ahora: AHORA }), /correo/i);
  }
  assert.equal(s.escrituras.length, 0);
});

test('spec 058: editar solo el teléfono de un proveedor viejo (sin correo) no agrega la clave correo', async () => {
  const { s, base } = entorno();
  const id = await crearProveedor({ ...base, datos: DATOS, uid: 'u1', ahora: AHORA });
  const antes = s.escrituras.length;
  await editarProveedor({ ...base, id, cambios: { telefono: '+56 9 8765 4321' }, uid: 'u2', ahora: AHORA });
  const w = s.escrituras.slice(antes);
  assert.equal(w.length, 1);
  assert.equal('correo' in w[0].datos, false, 'el update no lleva correo');
  assert.equal(w[0].datos.telefono, '+56 9 8765 4321');
  assert.equal(w[0].datos.actualizadoPor, 'u2');
  assert.equal(w[0].datos.actualizadoEl, ISO);
  assert.equal('correo' in s.almacen.get(`proveedores/${id}`), false);
});

test('spec 058: agregar, cambiar y borrar el correo al editar (el campo no se elimina: queda cadena vacía)', async () => {
  const { s, base } = entorno();
  const id = await crearProveedor({ ...base, datos: DATOS, uid: 'u1', ahora: AHORA });
  await editarProveedor({ ...base, id, cambios: { correo: 'ventas@ejemplo.test' }, uid: 'u1', ahora: AHORA });
  assert.equal(s.almacen.get(`proveedores/${id}`).correo, 'ventas@ejemplo.test');
  await editarProveedor({ ...base, id, cambios: { correo: 'compras@ejemplo.test' }, uid: 'u1', ahora: AHORA });
  assert.equal(s.almacen.get(`proveedores/${id}`).correo, 'compras@ejemplo.test');
  await editarProveedor({ ...base, id, cambios: { correo: '' }, uid: 'u1', ahora: AHORA });
  assert.equal('correo' in s.almacen.get(`proveedores/${id}`), true);
  assert.equal(s.almacen.get(`proveedores/${id}`).correo, '');
});

test('spec 058: editar sin cambiar el correo (mismo valor) no manda la clave correo', async () => {
  const { s, base } = entorno();
  const id = await crearProveedor({ ...base, datos: { ...DATOS, correo: 'ventas@ejemplo.test' }, uid: 'u1', ahora: AHORA });
  const antes = s.escrituras.length;
  await editarProveedor({ ...base, id, cambios: { correo: ' ventas@ejemplo.test ', direccion: 'Calle 9' }, uid: 'u1', ahora: AHORA });
  const w = s.escrituras.slice(antes);
  assert.equal(w.length, 1);
  assert.equal('correo' in w[0].datos, false, 'no cambió, no viaja');
  assert.equal(s.almacen.get(`proveedores/${id}`).correo, 'ventas@ejemplo.test', 'y no se pierde');
});

test('spec 058: editar con un correo malo se rechaza sin escribir; un correo vacío sobre un proveedor sin correo no escribe la clave', async () => {
  const { s, base } = entorno();
  const id = await crearProveedor({ ...base, datos: DATOS, uid: 'u1', ahora: AHORA });
  const antes = s.escrituras.length;
  await assert.rejects(editarProveedor({ ...base, id, cambios: { correo: 'malo' }, uid: 'u1', ahora: AHORA }), /correo/i);
  assert.equal(s.escrituras.length, antes);
  await editarProveedor({ ...base, id, cambios: { correo: '', direccion: 'Calle 9' }, uid: 'u1', ahora: AHORA });
  assert.equal('correo' in s.escrituras[s.escrituras.length - 1].datos, false, 'ausente + vacío = sin cambio de correo');
});
