// Agrupación de «Gestión de Clientes» por RUT (public/clientes.html). Ejecutar: node --test public/js/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { claveRut, agruparPorCliente, estadoDeServicio, totalVisitasDelPlan } from './clientes-agrupar.js';

const base = { nombre: 'Ana Maria Soto Morgado', rut: '15.730.505-0', email: 'ana@correo.cl', telefono: '+56911111111', comuna: 'Santiago' };

test('claveRut ignora puntos, guion y mayúsculas; sin RUT válido devuelve null', () => {
  assert.equal(claveRut('15.730.505-0'), '157305050');
  assert.equal(claveRut('15730505-0'), '157305050');
  assert.equal(claveRut('12.345.678-k'), '12345678K');
  assert.equal(claveRut('-'), null);
  assert.equal(claveRut(''), null);
  assert.equal(claveRut(undefined), null);
});

test('plan y visitas: Spot 1, 12, 6 y 4 por defecto', () => {
  assert.equal(totalVisitasDelPlan('Spot'), 1);
  assert.equal(totalVisitasDelPlan('Plan 12'), 12);
  assert.equal(totalVisitasDelPlan('Plan 6'), 6);
  assert.equal(totalVisitasDelPlan('Plan 4'), 4);
  assert.equal(totalVisitasDelPlan(''), 4);
});

test('estado: en curso como V<n>/<total>; completado cuando todas las visitas están hechas', () => {
  assert.match(estadoDeServicio('Plan 4', 0), />V1\/4</);
  assert.match(estadoDeServicio('Plan 4', 1), />V2\/4</);
  assert.match(estadoDeServicio('Spot', 0), />V1\/1</);
  assert.match(estadoDeServicio('Spot', 1), />Completado \(1\/1\)</);
  assert.match(estadoDeServicio('Plan 4', 4), />Completado \(4\/4\)</);
});

test('dos servicios del mismo RUT (Plan 4 y Spot) quedan en un solo grupo con 2 servicios', () => {
  const registros = [
    { ...base, clienteId: 'ORD-1', ordenId: 'ORD-1', tieneServicio: true, plan: 'Plan 4', suscripcion: 'Anual', ramos: 'Sin ramos adicionales', rut: '15.730.505-0', cementerioDetalle: 'Parque del Recuerdo (Pat: 34 N°: 67)' },
    { ...base, clienteId: 'ORD-2', ordenId: 'ORD-2', tieneServicio: true, plan: 'Spot', suscripcion: 'Única', ramos: 'Sin ramos adicionales', rut: '15730505-0', cementerioDetalle: 'Parque del Recuerdo (Pat: 34 N°: 67)' },
  ];
  const grupos = agruparPorCliente(registros);
  assert.equal(grupos.length, 1);
  assert.equal(grupos[0].cantServicios, 2);
  assert.equal(grupos[0].servicios.length, 2);
  assert.equal(grupos[0].nombre, 'Ana Maria Soto Morgado');
  assert.equal(grupos[0].rut, '15.730.505-0');
  assert.equal(grupos[0].principal.plan, 'Plan 4');
  assert.deepEqual(grupos[0].servicios.map(s => s.plan), ['Plan 4', 'Spot']);
});

test('clientes distintos no se mezclan; el orden de aparición se mantiene', () => {
  const registros = [
    { nombre: 'Felipe Hermoso', rut: '14.257.474-8', clienteId: 'a', ordenId: 'o1', tieneServicio: true, plan: 'Plan 4' },
    { nombre: 'Luis Dimas', rut: '17.026.586-6', clienteId: 'b', ordenId: 'o2', tieneServicio: true, plan: 'Plan 4' },
    { nombre: 'Felipe Hermoso', rut: '14.257.474-8', clienteId: 'a', ordenId: 'o3', tieneServicio: true, plan: 'Spot' },
  ];
  const grupos = agruparPorCliente(registros);
  assert.deepEqual(grupos.map(g => g.nombre), ['Felipe Hermoso', 'Luis Dimas']);
  assert.equal(grupos[0].cantServicios, 2);
  assert.equal(grupos[1].cantServicios, 1);
});

test('la misma orden llegada por dos fichas se cuenta una sola vez', () => {
  const registros = [
    { ...base, clienteId: 'ficha-1', ordenId: 'ORD-9', tieneServicio: true, plan: 'Plan 4' },
    { ...base, clienteId: 'ficha-2', ordenId: 'ORD-9', tieneServicio: true, plan: 'Plan 4' },
  ];
  const [g] = agruparPorCliente(registros);
  assert.equal(g.cantServicios, 1);
  assert.equal(g.servicios.length, 1);
});

test('sin RUT, cada ficha queda en su propio grupo', () => {
  const registros = [
    { nombre: 'Sin Rut Uno', rut: '-', clienteId: 'f1', ordenId: '', tieneServicio: false },
    { nombre: 'Sin Rut Dos', rut: '', clienteId: 'f2', ordenId: '', tieneServicio: false },
  ];
  const grupos = agruparPorCliente(registros);
  assert.equal(grupos.length, 2);
  assert.equal(grupos[0].cantServicios, 0);
});

test('un cliente sin servicio cuenta 0 y su principal es el registro sin servicio', () => {
  const [g] = agruparPorCliente([{ ...base, clienteId: 'ficha', ordenId: '', tieneServicio: false, plan: '-' }]);
  assert.equal(g.cantServicios, 0);
  assert.equal(g.principal.tieneServicio, false);
});

test('el nombre toma el primero que no sea el genérico «Cliente»', () => {
  const [g] = agruparPorCliente([
    { nombre: 'Cliente', rut: '15.730.505-0', clienteId: 'a', ordenId: 'o1', tieneServicio: true },
    { nombre: 'Ana Maria Soto Morgado', rut: '15.730.505-0', clienteId: 'a', ordenId: 'o2', tieneServicio: true },
  ]);
  assert.equal(g.nombre, 'Ana Maria Soto Morgado');
});
