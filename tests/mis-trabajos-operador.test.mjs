// Mis Trabajos: el segundo servicio del administrador no debe quedar fuera (identidad del operador y «completada» espurio).
// Ejecutar: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearIdentidad, visitaAsignadaA, visitaCerradaParaMisTrabajos } from '../public/js/operador-asignado.js';
import { crearIndiceInformes } from '../public/js/servicio-terminado.js';

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const html = readFileSync(join(PUBLIC, 'mis-trabajos.html'), 'utf8').replace(/\r/g, '');

// Réplica fiel del bucle de la página: qué visitas ve el usuario (datos simulados, sin Firestore).
function visitasVisibles(ordenes, usuario, informes = []) {
  const identidad = crearIdentidad(usuario);
  const indiceInformes = crearIndiceInformes(informes);
  const salida = [];
  for (const [docId, d] of ordenes) {
    for (let n = 1; n <= 4; n++) {
      if (visitaCerradaParaMisTrabajos(d, n, { docId, indiceInformes, informesLeidos: true })) continue;
      if (visitaAsignadaA(d, n, identidad)) salida.push(`${docId}-V${n}`);
    }
  }
  return salida;
}

const ORDENES = [
  // Pepito: asignada con el nombre corto.
  ['ORD-1794318778901977', { operadoresPorVisita: { V1: 'Christian Olivares' } }],
  // Carmelo: nombre completo del staff y «completada» espurio (sin informe ni fecha real) en orden y visita.
  ['ORD-1794358691756423', {
    estado: 'completada', estadoServicio: 'completada', visitasCompletadas: 1,
    estadosPorVisita: { V1: 'completada' },
    operadoresPorVisita: { V1: 'Christian Gerardo Olivares Lizama' },
  }],
];

test('el admin ve sus dos servicios, entre con el correo que entre', () => {
  for (const email of ['colivaresl@hotmail.com', 'admin@gravecare.cl']) {
    const vistas = visitasVisibles(ORDENES, { uid: 'uid-admin', email });
    assert.ok(vistas.includes('ORD-1794318778901977-V1'), email);
    assert.ok(vistas.includes('ORD-1794358691756423-V1'), email);
  }
});

test('cada causa por separado dejaba fuera el segundo servicio', () => {
  const soloNombre = [['ORD-A', { operadoresPorVisita: { V1: 'Christian Gerardo Olivares Lizama' } }]];
  assert.deepEqual(visitasVisibles(soloNombre, { uid: 'u', email: 'colivaresl@hotmail.com' }), ['ORD-A-V1']);
  const soloEstado = [['ORD-B', { estado: 'completada', estadosPorVisita: { V1: 'completada' }, operadoresPorVisita: { V1: 'Christian Olivares' } }]];
  assert.deepEqual(visitasVisibles(soloEstado, { uid: 'u', email: 'colivaresl@hotmail.com' }), ['ORD-B-V1']);
});

test('otro operador no ve el servicio del admin, y una visita realmente terminada sigue oculta', () => {
  assert.deepEqual(visitasVisibles(ORDENES, { uid: 'otro', email: 'otro@ejemplo.cl', displayName: 'Luis Soto' }), []);
  const hecha = [['ORD-C', { estadosPorVisita: { V1: 'completada' }, operadoresPorVisita: { V1: 'Christian Olivares' } }]];
  const informe = [['ORD-C-V1', { ordenId: 'ORD-C', visitaNumero: 1, fotos: ['f.jpg'] }]];
  assert.deepEqual(visitasVisibles(hecha, { uid: 'u', email: 'colivaresl@hotmail.com' }, informe), []);
});

test('la página usa los módulos y ya no compara contra un nombre fijo ni oculta por estado de la orden', () => {
  assert.match(html, /from "\.\/js\/operador-asignado\.js"/);
  assert.match(html, /visitaAsignadaA\(d, numVisita, identidad\)/);
  assert.doesNotMatch(html, /nombreOperador/);
  assert.doesNotMatch(html, /\.includes\(emailUser\)/);
  assert.doesNotMatch(html, /estadoGlobal/);
  assert.doesNotMatch(html, /d\.operadorId === usuario\.uid/);
});

test('lee informes como evidencia y sigue sin inventar campos nuevos de escritura', () => {
  assert.match(html, /getDocs\(collection\(db, "informes"\)\)/);
  assert.doesNotMatch(html, /updateDoc|setDoc|addDoc/);
});
