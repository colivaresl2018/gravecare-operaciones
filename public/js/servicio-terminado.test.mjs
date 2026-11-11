// Regla única de «Servicio Terminado» por visita. Ejecutar: node --test public/js/servicio-terminado.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  esEstadoCompletada, aFecha, totalVisitasDePlan, crearIndiceInformes, informeDeVisita, informeTieneContenido, esOperadorValido,
  operadorDeVisita, fechaEjecucionReal, evaluarVisita, evaluarVisitas, visitasTerminadas, numerosTerminados, construirCierreVisita,
  CAMPOS_FECHA_PROHIBIDOS,
} from './servicio-terminado.js';

const COMPRA = '2026-11-09T15:30:00.000Z';
const EJECUCION = '2026-12-20T14:00:00.000Z';
const FOTO = 'https://almacen.test/foto.jpg';

/** Orden recién comprada tal como la deja la web: pagada, con fechas de compra y sin nada de ejecución. */
function ordenNueva(plan) {
  return {
    numeroOrden: 'ORD-1794358691756423', estado: 'Confirmado', pagoConfirmado: true, modoPago: 'produccion',
    planNombre: plan, fechaPago: COMPRA, creadoEl: COMPRA, creadoEn: COMPRA, createdAt: COMPRA, actualizadoEn: COMPRA,
    fechaEstimada: COMPRA, operadorAsignadoNombre: '',
  };
}
const sinInformes = crearIndiceInformes([]);
const ctx = (idx = sinInformes) => ({ docId: 'abc', indiceInformes: idx });
const informe = (n, extra = {}) => [`abc-V${n}`, { ordenId: 'abc', visitaNumero: n, estado: 'pendiente_revision', operador: 'Raúl Ravellos', fotos: { antes: FOTO, despues: FOTO }, fechaCaptura: EJECUCION, ...extra }];

test('estados de visita: completada/terminada/aprobado cuentan; Confirmado, pagado y en revisión no', () => {
  for (const e of ['completada', 'Completado', ' TERMINADA ', 'finalizada', 'aprobado', 'Aprobada']) assert.equal(esEstadoCompletada(e), true, e);
  for (const e of ['Confirmado', 'pagado', 'pendiente', 'asignado', 'en_ejecucion', 'en revision', 'rechazada', '', null, undefined]) assert.equal(esEstadoCompletada(e), false, String(e));
});

test('plan: cantidad de visitas por nombre de plan', () => {
  assert.equal(totalVisitasDePlan({ planNombre: 'Plan 12' }), 12);
  assert.equal(totalVisitasDePlan({ servicio: { planNombre: 'Plan 6' } }), 6);
  assert.equal(totalVisitasDePlan({ planNombre: 'Plan 4' }), 4);
  assert.equal(totalVisitasDePlan({ tipoServicio: 'SPOT' }), 1);
  assert.equal(totalVisitasDePlan({}), 4);
});

for (const [plan, total] of [['Plan 12', 12], ['Plan 6', 6], ['Plan 4', 4]]) {
  test(`orden recién comprada con ${total} visitas: ninguna está terminada`, () => {
    const ev = evaluarVisitas(ordenNueva(plan), ctx());
    assert.equal(ev.length, total);
    assert.equal(ev.every((v) => v.terminada === false), true);
  });
}

test('orden «Confirmado» con pagoConfirmado true pero sin operador o sin informe nunca sale como terminada', () => {
  const base = { ...ordenNueva('Plan 4'), estado: 'Confirmado', pagoConfirmado: true };
  // sin operador, aunque tenga estado de visita y informe
  const sinOp = { ...base, estadosPorVisita: { V1: 'completada' } };
  const hitSinOperador = crearIndiceInformes([informe(1, { operador: '' })]);
  const a = evaluarVisita(sinOp, 1, ctx(hitSinOperador));
  assert.equal(a.terminada, false);
  assert.equal(a.motivo, 'sin_operador');
  // con operador y estado, sin informe ni evidencia
  const sinInf = { ...base, operadorAsignadoNombre: 'Raul Ravellos', estadosPorVisita: { V1: 'completada' } };
  const b = evaluarVisita(sinInf, 1, ctx());
  assert.equal(b.terminada, false);
  assert.equal(b.motivo, 'sin_evidencia');
  // con operador e informe, pero solo con el estado de pago de la orden
  const soloPago = { ...base, operadorAsignadoNombre: 'Raul Ravellos' };
  assert.equal(evaluarVisita(soloPago, 1, ctx(crearIndiceInformes([informe(1)]))).motivo, 'sin_estado_completada');
  for (const estado of ['Confirmado', 'pagado', 'aprobado']) {
    assert.equal(numerosTerminados({ ...soloPago, estado }, ctx(crearIndiceInformes([informe(1)]))).size, 0, estado);
  }
});

test('el caso #ORD-…709-V1: asignada a un operador pero sin informe real no es terminada', () => {
  const o = { ...ordenNueva('Plan 6'), numeroOrden: 'ORD-1794357459960709', operadoresPorVisita: { V1: 'Raul Ravellos' }, visitasCompletadas: 1, estadosPorVisita: { V1: 'completada' } };
  const v = evaluarVisita(o, 1, ctx());
  assert.equal(v.terminada, false);
  assert.equal(v.operador, 'Raul Ravellos');
  assert.equal(v.motivo, 'sin_evidencia');
  // un informe vacío (sin fotos ni aprobación) tampoco vale
  const vacio = crearIndiceInformes([['abc-V1', { ordenId: 'abc', visitaNumero: 1, estado: 'pendiente_revision', operador: 'Raul Ravellos', fotos: { antes: null, despues: '' } }]]);
  assert.equal(evaluarVisita(o, 1, ctx(vacio)).terminada, false);
});

test('el caso #ORD-…756423 (Plan 6): contador, visitas[] y estado global erróneos sin operador ni informe: nada terminado', () => {
  const o = { ...ordenNueva('Plan 6'), visitasCompletadas: 2, estado: 'completada', visitas: [{ estado: 'completada', fechaEstimada: COMPRA }, { estado: 'completada', fechaEstimada: COMPRA }] };
  assert.equal(numerosTerminados(o, ctx()).size, 0);
});

test('visita completa: operador + informe con fotos + estado propio → terminada, con fecha del informe y botón de informe', () => {
  const o = { ...ordenNueva('Plan 6'), estadosPorVisita: { V1: 'completada' }, operadoresPorVisita: { V1: 'Raúl Ravellos' } };
  const v = evaluarVisita(o, 1, ctx(crearIndiceInformes([informe(1)])));
  assert.equal(v.terminada, true);
  assert.equal(v.origenEstado, 'explicito');
  assert.equal(v.tieneInforme, true);
  assert.equal(v.informeId, 'abc-V1');
  assert.equal(v.operador, 'Raúl Ravellos');
  assert.equal(v.fechaEjecucion.toISOString(), EJECUCION);
  assert.equal(evaluarVisita(o, 2, ctx(crearIndiceInformes([informe(1)]))).terminada, false);
});

test('evidencia propia de la visita sin documento de informe: fotos, informeUrl, reporteFotografico o informeAprobado', () => {
  for (const evidencia of [{ fotos: [FOTO] }, { fotosDespues: [FOTO] }, { evidencia: [FOTO] }, { informeUrl: FOTO }, { reporteFotografico: FOTO }, { informeAprobado: true }]) {
    const o = { ...ordenNueva('Plan 4'), operadorAsignadoNombre: 'Raul', visitas: [{ estado: 'terminada', ...evidencia }] };
    const v = evaluarVisita(o, 1, ctx());
    assert.equal(v.terminada, true, JSON.stringify(evidencia));
    assert.equal(v.tieneInforme, false, 'sin documento de informe el botón queda deshabilitado');
  }
  const sin = { ...ordenNueva('Plan 4'), operadorAsignadoNombre: 'Raul', visitas: [{ estado: 'terminada', fotos: [], informeAprobado: false }] };
  assert.equal(evaluarVisita(sin, 1, ctx()).terminada, false);
});

test('estados específicos de la visita: visita.estado, estadoOperativo y estadosPorVisita; todos exigen operador y evidencia', () => {
  const conIdx = ctx(crearIndiceInformes([informe(1)]));
  const base = { ...ordenNueva('Plan 4'), operadorAsignadoNombre: 'Raul' };
  assert.equal(evaluarVisita({ ...base, visitas: [{ estado: 'aprobado' }] }, 1, conIdx).terminada, true);
  assert.equal(evaluarVisita({ ...base, visitas: [{ estadoOperativo: 'completado' }] }, 1, conIdx).terminada, true);
  assert.equal(evaluarVisita({ ...base, estadosPorVisita: { V1: 'completada' } }, 1, conIdx).terminada, true);
  assert.equal(evaluarVisita({ ...base, programacionVisitas: { v_1: { estado: 'completada' } } }, 1, conIdx).terminada, true);
  assert.equal(evaluarVisita({ ...base, visitas: [{ estado: 'en revision' }] }, 1, conIdx).terminada, false);
});

test('informe rechazado o sin contenido no es evidencia', () => {
  const o = { ...ordenNueva('Plan 4'), operadorAsignadoNombre: 'Raul', estadosPorVisita: { V1: 'completada' } };
  const rechazado = crearIndiceInformes([informe(1, { estado: 'rechazado' })]);
  const v = evaluarVisita(o, 1, ctx(rechazado));
  assert.equal(v.terminada, false);
  assert.equal(v.tieneInforme, false);
  assert.equal(informeTieneContenido({ estado: 'aprobado' }), true);
  assert.equal(informeTieneContenido({ estado: 'pendiente_revision' }), false);
  assert.equal(informeTieneContenido({ fotos: { a: null } }), false);
  assert.equal(informeTieneContenido({ fotos: { a: FOTO } }), true);
});

test('operador: «Sin asignar», vacío y relleno no valen; el del informe, de la visita o de la orden sí', () => {
  for (const op of ['', '  ', 'Sin asignar', 'sin asignar', null, undefined, '-']) assert.equal(esOperadorValido(op), false, String(op));
  assert.equal(esOperadorValido('Raul Ravellos'), true);
  assert.equal(operadorDeVisita({ operadorAsignadoNombre: 'Sin asignar', operadoresPorVisita: { V2: 'Pedro' } }, 2, null), 'Pedro');
  assert.equal(operadorDeVisita({ operadorNombre: 'Global' }, 1, null), 'Global');
  assert.equal(operadorDeVisita({ operadoresPorVisita: { V1: 'Visita' } }, 1, { operador: 'Del informe' }), 'Del informe');
  assert.equal(operadorDeVisita({}, 1, null), null);
});

test('completar V2 no arrastra V1 (la escritura es por visita y la lectura también)', () => {
  const o = { ...ordenNueva('Plan 4'), operadorAsignadoNombre: 'Raul Ravellos' };
  const payload = construirCierreVisita({ numero: 2, totalVisitas: 4, terminadasPrevias: 0, uidOperador: 'uid1', marcaTiempo: new Date(EJECUCION) });
  assert.equal(Object.keys(payload).some((k) => /V1\b|v_1\b/.test(k)), false);
  assert.equal(payload['estadosPorVisita.V2'], 'completada');
  assert.equal('visitasCompletadas' in payload, false); // el contador posicional ya no se escribe (antes: 2, que daba también por hecha la V1)
  assert.equal('estado' in payload, false);     // no cierra la orden: faltan visitas
  assert.equal(Object.keys(payload).some((k) => k.startsWith('programacionVisitas')), false, 'no pisa fechas de ejecución reales');
  const despues = { ...o, estadosPorVisita: { V2: payload['estadosPorVisita.V2'] } };
  const idx = ctx(crearIndiceInformes([informe(1), informe(2)])); // ambas visitas tienen informe: solo la V2 tiene estado
  assert.equal(evaluarVisita(despues, 1, idx).terminada, false, 'V1 no se arrastra aunque tenga operador e informe');
  assert.equal(evaluarVisita(despues, 2, idx).terminada, true);
  assert.deepEqual([...numerosTerminados(despues, idx)], [2]);
});

test('el cierre exige operador y solo cierra la orden cuando están todas las visitas', () => {
  assert.throws(() => construirCierreVisita({ numero: 1, totalVisitas: 4, terminadasPrevias: 0, uidOperador: '', marcaTiempo: 1 }), /operador/);
  const ultima = construirCierreVisita({ numero: 4, totalVisitas: 4, terminadasPrevias: 3, uidOperador: 'u', marcaTiempo: 1 });
  assert.equal(ultima.estado, 'completada');
  assert.equal('visitasCompletadas' in ultima, false);
  assert.equal('estado' in construirCierreVisita({ numero: 4, totalVisitas: 4, terminadasPrevias: 1, uidOperador: 'u', marcaTiempo: 1 }), false);
});

test('fechaPago, creadoEn/creadoEl, actualizadoEn y fechaEstimada nunca son fecha de ejecución', () => {
  const o = {
    ...ordenNueva('Plan 4'), estadosPorVisita: { V1: 'completada' }, fechaCompletado: COMPRA, ultimaVisitaCompletadaFecha: COMPRA,
    fechaTermino: COMPRA, fechaEjecucion: COMPRA, visitas: [{ estado: 'completada', fechaEstimada: COMPRA }],
  };
  assert.equal(fechaEjecucionReal(o, 1, null), null);
  assert.equal(evaluarVisita(o, 1, ctx()).fechaEjecucion, null);
  for (const c of ['fechaPago', 'creadoEn', 'creadoEl', 'actualizadoEn', 'fechaEstimada']) assert.ok(CAMPOS_FECHA_PROHIBIDOS.includes(c), c);
});

test('fecha ejecutada: fechaEjecucion, fechaRealizada, fechaTermino o fechaInforme de la visita (o del informe)', () => {
  const f = (campo) => fechaEjecucionReal({ visitas: [{ [campo]: EJECUCION }] }, 1, null)?.toISOString();
  for (const campo of ['fechaEjecucion', 'fechaRealizada', 'fechaTermino', 'fechaInforme']) assert.equal(f(campo), EJECUCION, campo);
  assert.equal(fechaEjecucionReal({}, 1, { fechaInforme: EJECUCION }).toISOString(), EJECUCION);
  const o = { programacionVisitas: { v_1: { fechaEjecucion: '2026-12-01T10:00:00.000Z' }, v_2: { fechaEjecucion: '2027-02-01T10:00:00.000Z' } } };
  assert.equal(fechaEjecucionReal(o, 1, null).toISOString(), '2026-12-01T10:00:00.000Z');
  assert.equal(fechaEjecucionReal(o, 2, null).toISOString(), '2027-02-01T10:00:00.000Z');
  assert.equal(fechaEjecucionReal(o, 3, null), null);
});

test('compatibilidad: orden antigua con solo el contador, operador e informes reales conserva lo terminado', () => {
  const o = { ...ordenNueva('Plan 6'), visitasCompletadas: 2, operadorAsignadoNombre: 'Raul' };
  const idx = crearIndiceInformes([informe(1, { estado: 'aprobado' }), informe(2, { estado: 'aprobado' })]);
  const ev = visitasTerminadas(o, ctx(idx));
  assert.deepEqual(ev.map((v) => v.numero), [1, 2]);
  assert.ok(ev.every((v) => v.origenEstado === 'legado_contador' && v.tieneInforme));
});

test('compatibilidad: el contador sin informe de esa visita, o sin operador, no la termina; el estado global ya no cuenta', () => {
  const o = { ...ordenNueva('Plan 6'), visitasCompletadas: 3, operadorAsignadoNombre: 'Raul' };
  assert.deepEqual([...numerosTerminados(o, ctx(crearIndiceInformes([informe(2)])))], [2]);
  const sinOperador = { ...ordenNueva('Plan 6'), visitasCompletadas: 3 };
  assert.equal(numerosTerminados(sinOperador, ctx(crearIndiceInformes([informe(1, { operador: '' })]))).size, 0);
  const global = { ...ordenNueva('Servicio Spot'), estado: 'completada', operadorAsignadoNombre: 'Raul' };
  assert.equal(numerosTerminados(global, ctx(crearIndiceInformes([informe(1)]))).size, 0);
});

test('el informe antiguo sin sufijo es la visita 1; el informe se encuentra por ordenId+visitaNumero, sufijo o numeroOrden', () => {
  const o = { ...ordenNueva('Servicio Spot'), visitasCompletadas: 1, operadorAsignadoNombre: 'Raul' };
  const idx = crearIndiceInformes([['abc', { estado: 'aprobado', createdAt: { seconds: 1796000000 } }]]);
  const v = evaluarVisita(o, 1, ctx(idx));
  assert.equal(v.terminada, true);
  assert.equal(v.informeId, 'abc');
  assert.ok(v.fechaEjecucion instanceof Date);
  const idx2 = crearIndiceInformes(new Map([['ORD-9-V3', { estado: 'aprobado' }], ['otro', { ordenId: 'docZ', visitaNumero: 2, estado: 'pendiente_revision' }]]));
  assert.equal(informeDeVisita(idx2, ['docA', 'ORD-9'], 3).id, 'ORD-9-V3');
  assert.equal(informeDeVisita(idx2, ['docZ'], 2).id, 'otro');
  assert.equal(informeDeVisita(idx2, ['docA'], 1), null);
  assert.equal(informeDeVisita(null, ['docA'], 1), null);
});

test('aFecha entiende Timestamp, segundos, ISO y rechaza lo inválido', () => {
  assert.equal(aFecha({ toDate: () => new Date(EJECUCION) }).toISOString(), EJECUCION);
  assert.equal(aFecha({ seconds: 1796000000 }).getTime(), 1796000000000);
  assert.equal(aFecha(EJECUCION).toISOString(), EJECUCION);
  assert.equal(aFecha('no es fecha'), null);
  assert.equal(aFecha(''), null);
  assert.equal(aFecha(null), null);
});
