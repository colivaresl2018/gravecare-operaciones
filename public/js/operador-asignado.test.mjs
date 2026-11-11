// operador-asignado.js — identidad del operador y visita cerrada para «Mis Trabajos».
// Ejecutar: node --test public/js/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizarTexto, nombresCoinciden, crearIdentidad, visitaAsignadaA, visitaCerradaParaMisTrabajos,
} from './operador-asignado.js';
import { crearIndiceInformes } from './servicio-terminado.js';

const ADMIN = { uid: 'uid-admin', email: 'colivaresl@hotmail.com', displayName: '' };

test('normalizarTexto: minúsculas, sin tildes ni espacios sobrantes', () => {
  assert.equal(normalizarTexto('  Cristián   OLIVARES '), 'cristian olivares');
  assert.equal(normalizarTexto(null), '');
});

test('nombresCoinciden: el nombre corto cabe en el largo (Christian Olivares ~ Christian Gerardo Olivares Lizama)', () => {
  assert.equal(nombresCoinciden('Christian Olivares', 'Christian Gerardo Olivares Lizama'), true);
  assert.equal(nombresCoinciden('christian gerardo olivares lizama', 'CHRISTIAN OLIVARES'), true);
  assert.equal(nombresCoinciden('Olivares Lizama, Christian', 'Christian Olivares'), true); // el orden y la coma no importan
});

test('nombresCoinciden: no confunde personas distintas ni nombres de una sola palabra', () => {
  assert.equal(nombresCoinciden('Christian Olivares', 'Carlos Olivares'), false);
  assert.equal(nombresCoinciden('Juan', 'Juan Pérez'), false);
  assert.equal(nombresCoinciden('Juan', 'juan'), true);
  assert.equal(nombresCoinciden('', 'Juan'), false);
});

test('identidad del admin: ambos correos y ambos nombres, entre en con el correo que entre', () => {
  const a = crearIdentidad({ uid: 'u1', email: 'admin@gravecare.cl' });
  assert.ok(a.emails.has('colivaresl@hotmail.com'));
  assert.ok(a.emails.has('admin@gravecare.cl'));
  assert.equal(visitaAsignadaA({ operadoresPorVisita: { V1: 'colivaresl@hotmail.com' } }, 1, a), true);
  assert.equal(visitaAsignadaA({ operadoresPorVisita: { V1: 'Christian Gerardo Olivares Lizama' } }, 1, a), true);
});

test('el nombre guardado es el del staff (nombre completo): la visita aparece al admin', () => {
  const id = crearIdentidad(ADMIN);
  const orden = { operadoresPorVisita: { V1: 'Christian Gerardo Olivares Lizama' } };
  assert.equal(visitaAsignadaA(orden, 1, id), true);
});

test('coincide por uid, correo o nombre, estén guardados donde estén', () => {
  const id = crearIdentidad({ uid: 'uid-op', email: 'op@ejemplo.cl', displayName: 'Ana Pérez' });
  const casos = [
    { operadoresPorVisita: { V1: 'Ana Pérez' } },
    { operadoresPorVisita: { V1: { uid: 'uid-op' } } },
    { operadoresPorVisita: { V1: { email: 'OP@ejemplo.cl' } } },
    { asignacionesVisitas: { V1: { operadorId: 'uid-op' } } },
    { asignacionesVisitas: [{ operadorEmail: 'op@ejemplo.cl' }] },
    { asignacionesVisitas: [{ visita: 1, operadorNombre: 'Ana Pérez' }] },
    { visitasEstado: { V1: { operadorNombre: 'ana perez' } } },
    { visitas: [{ operadorId: 'uid-op' }] },
    { visitas: [{ operador: 'Ana Pérez' }] },
    { programacionVisitas: { v_1: { operadorEmail: 'op@ejemplo.cl' } } },
    { operador: 'Ana Pérez' },
    { operadorAsignado: 'Ana Pérez' },
    { operadorEmail: 'op@ejemplo.cl' },
    { operadorId: 'uid-op' },
    { operadorAsignadoNombre: 'Ana Pérez' },
  ];
  for (const orden of casos) assert.equal(visitaAsignadaA(orden, 1, id), true, JSON.stringify(orden));
});

test('no coincide con otro operador ni con «Sin asignar»', () => {
  const id = crearIdentidad({ uid: 'uid-op', email: 'op@ejemplo.cl', displayName: 'Ana Pérez' });
  assert.equal(visitaAsignadaA({ operadoresPorVisita: { V1: 'Luis Soto' } }, 1, id), false);
  assert.equal(visitaAsignadaA({ operadoresPorVisita: { V1: 'Sin asignar' } }, 1, id), false);
  assert.equal(visitaAsignadaA({}, 1, id), false);
});

test('la asignación propia de la visita manda sobre la de la orden', () => {
  const id = crearIdentidad({ uid: 'uid-op', email: 'op@ejemplo.cl', displayName: 'Ana Pérez' });
  const orden = { operadorId: 'uid-op', operadoresPorVisita: { V2: 'Luis Soto' } };
  assert.equal(visitaAsignadaA(orden, 1, id), true); // V1 sin asignación propia: vale la de la orden
  assert.equal(visitaAsignadaA(orden, 2, id), false); // V2 es de otro operador
});

test('visita cerrada: «completada» sin informe ni evidencia NO se oculta (caso Carmelo LU Kuan)', () => {
  const orden = {
    estado: 'completada', estadoServicio: 'completada', estadosPorVisita: { V1: 'completada' },
    operadoresPorVisita: { V1: 'Christian Gerardo Olivares Lizama' },
  };
  const indiceInformes = crearIndiceInformes([]);
  assert.equal(visitaCerradaParaMisTrabajos(orden, 1, { docId: 'ORD-X', indiceInformes, informesLeidos: true }), false);
});

test('visita cerrada: «completada» con operador, informe con fotos y estado propio sí se oculta', () => {
  const orden = { estadosPorVisita: { V1: 'completada' }, operadoresPorVisita: { V1: 'Ana Pérez' } };
  const indiceInformes = crearIndiceInformes([['ORD-Y-V1', { ordenId: 'ORD-Y', visitaNumero: 1, fotos: ['a.jpg'] }]]);
  assert.equal(visitaCerradaParaMisTrabajos(orden, 1, { docId: 'ORD-Y', indiceInformes, informesLeidos: true }), true);
});

test('visita cerrada: el estado de la orden «completada» o un contador sin evidencia no ocultan nada', () => {
  const indiceInformes = crearIndiceInformes([]);
  const ctx = { docId: 'ORD-Z', indiceInformes, informesLeidos: true };
  assert.equal(visitaCerradaParaMisTrabajos({ estado: 'completada', operadoresPorVisita: { V1: 'Ana Pérez' } }, 1, ctx), false);
  assert.equal(visitaCerradaParaMisTrabajos({ visitasCompletadas: 1, operadoresPorVisita: { V1: 'Ana Pérez' } }, 1, ctx), false);
});

test('visita cerrada: dato antiguo (contador) con operador e informe real sigue contando como terminada, igual que Órdenes', () => {
  const indiceInformes = crearIndiceInformes([['ORD-Z-V1', { ordenId: 'ORD-Z', visitaNumero: 1, fotos: ['a.jpg'] }]]);
  const orden = { visitasCompletadas: 1, operadoresPorVisita: { V1: 'Ana Pérez' } };
  assert.equal(visitaCerradaParaMisTrabajos(orden, 1, { docId: 'ORD-Z', indiceInformes, informesLeidos: true }), true);
});

test('si los informes no se pueden leer, se ocultan solo las visitas con estado propio y operador (sin regresión)', () => {
  const orden = { estadosPorVisita: { V1: 'completada' }, operadoresPorVisita: { V1: 'Ana Pérez' } };
  assert.equal(visitaCerradaParaMisTrabajos(orden, 1, { docId: 'ORD-W', informesLeidos: false }), true);
  const sinOperador = { estadosPorVisita: { V1: 'completada' } };
  assert.equal(visitaCerradaParaMisTrabajos(sinOperador, 1, { docId: 'ORD-W', informesLeidos: false }), false);
});
