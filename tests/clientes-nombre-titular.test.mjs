// Nombre del cliente en «Gestión de Clientes» (public/clientes.html). Ejecutar: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nombreFilaCliente, nombreClienteDeOrden } from '../public/js/nombre-cliente.js';

// Caso 1: ficha de `clientes` con nombres y apellidos separados (sin nombreCompleto ni apellidos).
test('ficha con nombres + apellidoPaterno + apellidoMaterno muestra el nombre completo', () => {
  const cliente = { nombres: 'María José', apellidoPaterno: 'Pérez', apellidoMaterno: 'Rojas' };
  assert.equal(nombreFilaCliente(cliente, []), 'María José Pérez Rojas');
});

// Caso 2: ficha de `clientes` sin datos de nombre; se usa el titular de la orden vinculada.
test('ficha sin nombre usa el titular de la orden vinculada', () => {
  const ordenDirecta = { titularNombre: nombreClienteDeOrden({ titular: { nombreCompleto: 'Raúl Ravellos Soto' } }) };
  assert.equal(nombreFilaCliente({ email: 'x@correo.cl' }, [ordenDirecta]), 'Raúl Ravellos Soto');

  const ordenPartida = { titularNombre: nombreClienteDeOrden({ titular: { nombres: 'Juan', apellidoPaterno: 'Soto', apellidoMaterno: 'Lira' } }) };
  assert.equal(nombreFilaCliente({}, [ordenPartida]), 'Juan Soto Lira');
});

test('sin nombre en la ficha ni en las órdenes, queda «Cliente»', () => {
  assert.equal(nombreFilaCliente({}, [{ titularNombre: '' }]), 'Cliente');
  assert.equal(nombreFilaCliente(undefined, []), 'Cliente');
});

// Caso 3: ficha con nombreCompleto directo (p. ej. Ana Maria Soto Morgado).
test('ficha con nombreCompleto directo gana sobre la orden', () => {
  const cliente = { nombreCompleto: 'Ana Maria Soto Morgado' };
  assert.equal(nombreFilaCliente(cliente, [{ titularNombre: 'Otro Nombre' }]), 'Ana Maria Soto Morgado');
});
