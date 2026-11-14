// Bug «visitas recién compradas aparecen como Completada» y nombre «Cliente» en las listas de trabajo. Ejecutar: node --test tests/
// Parte A: escenarios de aceptación sobre la colección de órdenes con la regla compartida.
// Parte B: pruebas estáticas de que las páginas usan la regla y el extractor de nombre.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { esOrdenPagada } from '../public/js/orden-pagada.js';
import { crearIndiceInformes, visitasTerminadas, numerosTerminados, evaluarVisitas } from '../public/js/servicio-terminado.js';
import { nombreClienteParaMostrar } from '../public/js/nombre-cliente.js';

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const lee = (p) => readFileSync(join(PUBLIC, p), 'utf8').replace(/\r/g, '');

const COMPRA = '2026-11-09T15:30:00.000Z';
const FOTO = 'https://almacen.test/foto.jpg';
const compra = (id, plan, extra = {}) => ({
  id, numeroOrden: id, estado: 'Confirmado', pagoConfirmado: true, modoPago: 'produccion', planNombre: plan,
  fechaPago: COMPRA, creadoEl: COMPRA, creadoEn: COMPRA, actualizadoEn: COMPRA, operadorAsignadoNombre: '', ...extra,
});
const informe = (ordenId, n, extra = {}) => [`${ordenId}-V${n}`, { ordenId, visitaNumero: n, estado: 'pendiente_revision', operador: 'Raúl Ravellos', fotos: { antes: FOTO, despues: FOTO }, fechaCaptura: '2026-12-15T13:00:00.000Z', ...extra }];

/** Lo que haría trabajos-terminados.html: filas de terminadas de toda la colección. */
function filasTerminadas(ordenes, informes = []) {
  const indiceInformes = crearIndiceInformes(informes);
  return ordenes.filter(esOrdenPagada).flatMap((o) => visitasTerminadas(o, { docId: o.id, indiceInformes }).map((v) => ({ orden: o.id, ...v })));
}

// ---------- Parte A ----------
test('órdenes recién compradas (Plan 12, Plan 6 y Plan 4): ninguna visita aparece en terminadas', () => {
  const ordenes = [compra('ORD-A', 'Plan 12'), compra('ORD-1794358691756423', 'Plan 6'), compra('ORD-C', 'Plan 4')];
  assert.deepEqual(filasTerminadas(ordenes), []);
});

test('orden «Confirmado» + pagoConfirmado sin operador o sin informe nunca sale como terminada (aunque la visita diga completada)', () => {
  const sinOperador = compra('ORD-S1', 'Plan 4', { visitas: [{ estado: 'completada' }] });
  const sinInforme = compra('ORD-S2', 'Plan 4', { operadorAsignadoNombre: 'Raul Ravellos', visitas: [{ estado: 'completada' }] });
  assert.deepEqual(filasTerminadas([sinOperador, sinInforme], [informe('ORD-S1', 1, { operador: '' })]), []);
  assert.deepEqual(filasTerminadas([sinOperador, sinInforme], [informe('ORD-S1', 1, { operador: 'Sin asignar' })]), []);
});

test('los casos reportados: #ORD-1794358691756423-V1/-V2 y #ORD-1794357459960709-V1 (asignada, sin informe real) no aparecen', () => {
  const cleo = compra('ORD-1794358691756423', 'Plan 6', {
    visitasCompletadas: 2, visitas: [{ estado: 'completada', fechaEstimada: COMPRA }, { estado: 'completada', fechaEstimada: COMPRA }],
  });
  const raul = compra('ORD-1794357459960709', 'Plan 6', { operadoresPorVisita: { V1: 'Raul Ravellos' }, visitasCompletadas: 1, estadosPorVisita: { V1: 'completada' } });
  assert.deepEqual(filasTerminadas([cleo, raul]), []);
  // un informe vacío de Raúl tampoco los hace aparecer
  assert.deepEqual(filasTerminadas([cleo, raul], [['ORD-1794357459960709-V1', { ordenId: 'ORD-1794357459960709', visitaNumero: 1, estado: 'pendiente_revision', operador: 'Raul Ravellos', fotos: {} }]]), []);
});

test('una orden no pagada nunca aparece, aunque tenga visitas completadas, operador e informe', () => {
  const o = { id: 'ORD-X', estado: 'iniciada', pagoConfirmado: false, planNombre: 'Plan 4', estadosPorVisita: { V1: 'completada' }, operadorAsignadoNombre: 'Raul' };
  assert.deepEqual(filasTerminadas([o], [informe('ORD-X', 1)]), []);
});

test('con operador + informe real + estado propio de la visita: aparece solo esa visita, con su fecha y botón de informe', () => {
  const o = compra('ORD-D', 'Plan 4', { estadosPorVisita: { V1: 'completada' }, operadoresPorVisita: { V1: 'Raúl Ravellos' } });
  const filas = filasTerminadas([o], [informe('ORD-D', 1)]);
  assert.deepEqual(filas.map((f) => [f.numero, f.tieneInforme, f.operador]), [[1, true, 'Raúl Ravellos']]);
  assert.equal(filas[0].fechaEjecucion.toISOString(), '2026-12-15T13:00:00.000Z');
});

test('con evidencia propia en la visita (sin documento de informe) aparece, pero «Ver Informe» queda deshabilitado', () => {
  const o = compra('ORD-F', 'Plan 4', { operadorAsignadoNombre: 'Raul', visitas: [{ estado: 'terminada', informeAprobado: true, fechaRealizada: '2027-03-01T10:00:00.000Z' }] });
  const filas = filasTerminadas([o]);
  assert.deepEqual(filas.map((f) => [f.numero, f.tieneInforme]), [[1, false]]);
  assert.equal(filas[0].fechaEjecucion.toISOString(), '2027-03-01T10:00:00.000Z');
});

test('la fecha de compra jamás se muestra como fecha de ejecución', () => {
  const o = compra('ORD-E', 'Plan 4', { operadorAsignadoNombre: 'Raul', estadosPorVisita: { V1: 'completada' }, informeAprobado: true, fechaCompletado: COMPRA, ultimaVisitaCompletadaFecha: COMPRA });
  const idx = crearIndiceInformes([['ORD-E-V1', { ordenId: 'ORD-E', visitaNumero: 1, estado: 'aprobado' }]]);
  const ev = evaluarVisitas(o, { docId: 'ORD-E', indiceInformes: idx });
  assert.equal(ev[0].terminada, true);
  assert.equal(ev[0].fechaEjecucion, null, 'sin fecha de ejecución real se muestra «—»');
  assert.equal(numerosTerminados(o, { docId: 'ORD-E', indiceInformes: crearIndiceInformes([]) }).size, 0);
});

test('nombre del cliente: titular con nombres + apellidos o solo «nombre» ya no se muestra como «Cliente»', () => {
  const orden = { numeroOrden: 'ORD-1794357459960709', titular: { nombres: 'Cleo', apellidoPaterno: 'Cleopatra', apellidoMaterno: 'Ponce' }, difunto: { nombreCompleto: 'Bruce Willis Jorquera' } };
  assert.equal(nombreClienteParaMostrar(orden), 'Cleo Cleopatra Ponce');
  assert.equal(nombreClienteParaMostrar({ titular: { nombre: 'Cleo Cleopatra Ponce' } }), 'Cleo Cleopatra Ponce');
  assert.equal(nombreClienteParaMostrar({ titular: { nombreCompleto: 'Cliente Registrado' }, clienteNombre: 'Nombre Real Apellido' }), 'Nombre Real Apellido');
});

// ---------- Parte B ----------
test('trabajos-terminados.html: usa la regla compartida, filtra pagadas y no usa contador ni fechas de compra', () => {
  const h = lee('trabajos-terminados.html');
  assert.match(h, /import \{[^}]*evaluarVisitas[^}]*\} from "\.\/js\/servicio-terminado\.js"/);
  assert.match(h, /if \(!esOrdenPagada\(d\)\) return;/);
  assert.doesNotMatch(h, /d\.visitasCompletadas/);
  assert.doesNotMatch(h, /d\.actualizadoEn|d\.creadoEl|d\.fechaPago|v\.fechaEstimada|ultimaVisitaCompletadaFecha/);
  assert.doesNotMatch(h, /estadoGlobal/);
  assert.doesNotMatch(h, /10-10-2026/, 'ya no inventa una fecha cuando falta');
  assert.match(h, /fechaTermino: ev\.fechaEjecucion/);
  assert.match(h, /const opDetectado = ev\.operador;/);
});

test('trabajos-terminados.html: «Ver Informe» solo se habilita si la visita tiene informe', () => {
  const h = lee('trabajos-terminados.html');
  assert.match(h, /\$\{item\.tieneInforme \? `<button type="button" data-informe="\$\{esc\(item\.idInforme\)\}" data-orden="\$\{esc\(item\.ordenDocId\)\}" data-operador="\$\{esc\(item\.operador\)\}" onclick="window\.abrirModalInforme\(this\.dataset\.informe/);
  assert.match(h, /disabled class="[^"]*cursor-not-allowed/);
  assert.match(h, /tieneInforme: ev\.tieneInforme/);
});

test('todos-los-trabajos.html: no oculta visitas por el contador y solo deja completar con operador y evidencia', () => {
  const h = lee('todos-los-trabajos.html');
  assert.match(h, /from "\.\/js\/servicio-terminado\.js"/);
  assert.doesNotMatch(h, /idx < visitasCompletadasCount/);
  assert.doesNotMatch(h, /Number\(d\.visitasCompletadas/);
  assert.doesNotMatch(h, /visitasCompletadas: numeroVisita/);
  assert.match(h, /construirCierreVisita\(/);
  assert.match(h, /terminadas\.has\(numeroVisita\)/);
  assert.match(h, /puedeCompletar: evVisita\.operadorValido && evVisita\.tieneEvidencia/);
  assert.match(h, /if \(item && !item\.puedeCompletar\)/);
});

test('planificacion.html y ordenes.html: las visitas realizadas salen de la regla compartida, no del contador', () => {
  const p = lee('planificacion.html');
  assert.match(p, /numerosTerminados\(ord, \{ docId: ordId, indiceInformes \}\)/);
  assert.doesNotMatch(p, /ord\.visitasCompletadas/);
  assert.match(p, /numVisita = numerosPendientes\[vIdx\]/);
  const o = lee('ordenes.html');
  assert.match(o, /numerosTerminados\(d, \{ docId: docSnap\.id, indiceInformes \}\)/);
  assert.doesNotMatch(o, /idx < visitasCompletadasCount/);
  assert.doesNotMatch(o, /Number\(d\.visitasCompletadas/);
});

test('las 4 listas usan el extractor único del nombre del cliente y ya no el genérico «Cliente» directo', () => {
  for (const pagina of ['trabajos-terminados.html', 'todos-los-trabajos.html', 'ordenes.html', 'planificacion.html']) {
    const h = lee(pagina);
    assert.match(h, /from "\.\/js\/nombre-cliente\.js"/, pagina);
    assert.match(h, /nombreClienteParaMostrar\(/, pagina);
    assert.doesNotMatch(h, /tit\.nombreCompleto \|\| tit\.nombreCliente/, pagina);
    assert.doesNotMatch(h, /Felipe Toledo Toledo/, pagina);
    assert.doesNotMatch(h, /collection\(db, "usuarios"\)|doc\(db, "usuarios"/, `${pagina}: staff no puede leer usuarios/{uid} (reglas)`);
  }
});

test('el módulo compartido no lee las fechas de compra como fecha de ejecución', () => {
  const m = lee('js/servicio-terminado.js');
  const cuerpo = m.slice(m.indexOf('export function fechaEjecucionReal'), m.indexOf('/** Estado explícito de finalizada'));
  for (const campo of ['fechaPago', 'creadoEn', 'creadoEl', 'actualizadoEn', 'updatedAt', 'fechaEstimada', 'ultimaVisitaCompletadaFecha']) {
    assert.ok(!cuerpo.includes(`.${campo}`), `fechaEjecucionReal no debe leer ${campo}`);
  }
});

test('ordenes.html y planificacion.html: un «completada» guardado sin operador/evidencia no oculta ni pinta como completada la visita pendiente', () => {
  const o = lee('ordenes.html');
  assert.match(o, /function estadoVisitaVigente\(orden, clave\)/);
  assert.match(o, /estadoPersistido: estadoVisitaVigente\(d, claveVisita\)/);
  const p = lee('planificacion.html');
  assert.match(p, /const estadoGuardado = esEstadoCompletada\(estadoCrudo\) \? null : estadoCrudo;/);
});

test('el cierre de la última visita no pisa orden.estado y no escribe el contador (ni en la página ni en el módulo)', () => {
  const h = lee('todos-los-trabajos.html');
  assert.doesNotMatch(h, /estado: ?["']completada["']|estadoServicio/, 'la página no escribe estado/estadoServicio');
  const m = lee('js/servicio-terminado.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''); // sin comentarios
  assert.doesNotMatch(m, /payload\.estado = |payload\.estadoServicio|visitasCompletadas: /);
  assert.match(m, /payload\.estadoOperativo = 'completada'/);
});

test('clientes.html: el avance sale de las visitas que cumplen la regla (no del contador); mis-trabajos y ordenes usan el nombre único', () => {
  const c = lee('clientes.html');
  assert.match(c, /from "\.\/js\/servicio-terminado\.js"/);
  assert.equal([...c.matchAll(/numerosTerminados\(ord, \{ docId: (ordId|docSnap\.id), indiceInformes \}\)\.size/g)].length, 2);
  assert.doesNotMatch(c, /ord\.visitasCompletadas/);
  const m = lee('mis-trabajos.html');
  assert.match(m, /from "\.\/js\/nombre-cliente\.js"/);
  assert.match(m, /nombreClienteParaMostrar\(d, /);
  // Mis Trabajos intenta leer informes (en try/catch, solo lectura) para aplicar la misma regla de visita terminada que Órdenes; si no puede, usa el criterio anterior.
  assert.match(m, /collection\(db, "informes"\)/);
  assert.match(m, /visitaCerradaParaMisTrabajos\(d, numVisita, /);
  const o = lee('ordenes.html');
  assert.doesNotMatch(o, /estadoGlobal/);
});
