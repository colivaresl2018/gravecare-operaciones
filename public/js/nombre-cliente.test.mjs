// Extractor único del nombre del cliente. Ejecutar: node --test public/js/nombre-cliente.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  esNombreGenerico, nombreDesdeObjeto, nombreClienteDeOrden, nombreClienteParaMostrar, idsContratoDeOrden, cargarContratos, contratosDeOrden,
} from './nombre-cliente.js';

test('genéricos: vacío, «Cliente», «Cliente Registrado» y correos no son nombres', () => {
  for (const g of ['', '  ', 'Cliente', 'cliente registrado', 'CLIENTE REGISTRADO', 'Sin nombre', null, undefined, 'ana@correo.cl']) assert.equal(esNombreGenerico(g), true, String(g));
  for (const n of ['Cleo Cleopatra Ponce', 'Ana', 'Cliente Ficticio 1']) assert.equal(esNombreGenerico(n), false, n);
});

test('titular.nombreCompleto gana', () => {
  assert.equal(nombreClienteDeOrden({ titular: { nombreCompleto: 'Cleo Cleopatra Ponce', nombre: 'Otro' } }), 'Cleo Cleopatra Ponce');
});

test('titular.nombre se usa cuando no hay nombreCompleto', () => {
  assert.equal(nombreClienteDeOrden({ titular: { nombre: 'Raúl Ravellos Soto' } }), 'Raúl Ravellos Soto');
});

test('titular.nombres + apellidoPaterno + apellidoMaterno se concatenan', () => {
  assert.equal(nombreClienteDeOrden({ titular: { nombres: 'María José', apellidoPaterno: 'Pérez', apellidoMaterno: 'Rojas' } }), 'María José Pérez Rojas');
});

test('titular.nombre con apellidos aparte los suma sin repetir', () => {
  assert.equal(nombreClienteDeOrden({ titular: { nombre: 'Juan', apellidoPaterno: 'Soto', apellidoMaterno: 'Lira' } }), 'Juan Soto Lira');
  assert.equal(nombreClienteDeOrden({ titular: { nombre: 'Juan Soto', apellidoPaterno: 'Soto' } }), 'Juan Soto');
});

test('la misma concatenación en la raíz de la orden', () => {
  assert.equal(nombreClienteDeOrden({ nombres: 'Ana', apellidoPaterno: 'Díaz', apellidoMaterno: 'Mora' }), 'Ana Díaz Mora');
  assert.equal(nombreClienteDeOrden({ apellidoPaterno: 'Díaz' }), '', 'un apellido suelto no es un nombre');
});

test('variantes de la raíz: nombreCompleto, nombreCliente, clienteNombre, cliente (texto) y comprador.nombre', () => {
  assert.equal(nombreClienteDeOrden({ nombreCompleto: 'A B C' }), 'A B C');
  assert.equal(nombreClienteDeOrden({ nombreCliente: 'D E F' }), 'D E F');
  assert.equal(nombreClienteDeOrden({ clienteNombre: 'G H I' }), 'G H I');
  assert.equal(nombreClienteDeOrden({ cliente: 'J K L' }), 'J K L');
  assert.equal(nombreClienteDeOrden({ comprador: { nombre: 'M N O' } }), 'M N O');
  assert.equal(nombreClienteDeOrden({ titular: 'P Q R' }), 'P Q R');
});

test('los genéricos se ignoran y se sigue buscando', () => {
  assert.equal(nombreClienteDeOrden({ titular: { nombreCompleto: 'Cliente' }, nombreCliente: 'Cliente Registrado', clienteNombre: 'Real Nombre Apellido' }), 'Real Nombre Apellido');
  assert.equal(nombreClienteDeOrden({ titular: { nombre: 'Cliente Registrado' }, comprador: { nombre: 'Comprador Real' } }), 'Comprador Real');
  assert.equal(nombreClienteDeOrden({ titular: {}, cliente: 'Cliente', usuario: 'x@y.cl' }), '');
});

test('el caso reportado: titular sin nombreCompleto ya no cae en «Cliente»', () => {
  const orden = { numeroOrden: 'ORD-1794357459960709', titular: { nombres: 'Cleo', apellidoPaterno: 'Cleopatra', apellidoMaterno: 'Ponce' }, difunto: { nombreCompleto: 'Bruce Willis Jorquera' } };
  assert.equal(nombreClienteParaMostrar(orden), 'Cleo Cleopatra Ponce');
});

test('sin ningún nombre se muestra «Cliente»; el respaldo (contrato) lo completa cuando existe', () => {
  const orden = { numeroOrden: 'ORD-9', titular: { email: 'a@b.cl' } };
  assert.equal(nombreClienteParaMostrar(orden), 'Cliente');
  assert.equal(nombreClienteParaMostrar(orden, [{ titular: { nombreCompleto: 'Titular Del Contrato' } }]), 'Titular Del Contrato');
  assert.equal(nombreClienteParaMostrar(orden, [{ nombreCliente: 'Cliente Desde Contrato' }]), 'Cliente Desde Contrato');
  assert.equal(nombreClienteParaMostrar(orden, [{ titular: { nombreCompleto: 'Cliente' } }]), 'Cliente');
});

test('el nombre de la orden tiene prioridad sobre el respaldo', () => {
  assert.equal(nombreClienteDeOrden({ nombreCliente: 'De La Orden Real' }, [{ nombreCliente: 'Del Contrato' }]), 'De La Orden Real');
});

test('contratos: ids, carga única con caché y tolerancia a fallos de lectura', async () => {
  assert.deepEqual(idsContratoDeOrden({ numeroOrden: 'ORD-1', ordenId: 'ORD-1' }, 'docA'), ['CTR-ORD-1', 'CTR-docA']);
  let lecturas = 0;
  const mapa = await cargarContratos(async () => { lecturas++; return [['CTR-ORD-1', { titular: { nombreCompleto: 'Del Contrato Uno' } }]]; });
  assert.equal(lecturas, 1);
  const docs = contratosDeOrden(mapa, { numeroOrden: 'ORD-1' }, 'docA');
  assert.equal(nombreClienteParaMostrar({ numeroOrden: 'ORD-1' }, docs), 'Del Contrato Uno');
  const roto = await cargarContratos(async () => { throw new Error('permission-denied'); });
  assert.equal(roto.size, 0);
  assert.deepEqual(contratosDeOrden(roto, { numeroOrden: 'ORD-1' }, 'x'), []);
  assert.deepEqual(contratosDeOrden(null, {}, 'x'), []);
});

test('nombreDesdeObjeto ignora lo que no es objeto', () => {
  assert.equal(nombreDesdeObjeto(null), '');
  assert.equal(nombreDesdeObjeto('texto'), '');
});
