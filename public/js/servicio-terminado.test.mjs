// Regla única de «Servicio Terminado» por visita. Ejecutar: node --test public/js/servicio-terminado.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  esEstadoCompletada, aFecha, totalVisitasDePlan, crearIndiceInformes, informeDeVisita, fechaEjecucionReal,
  evaluarVisita, evaluarVisitas, visitasTerminadas, numerosTerminados, construirCierreVisita, CAMPOS_FECHA_PROHIBIDOS,
} from './servicio-terminado.js';

const COMPRA = '2026-11-09T15:30:00.000Z';
const EJECUCION = '2026-12-20T14:00:00.000Z';

/** Orden recién comprada tal como la deja la web: pagada, con fechas de compra y sin nada de ejecución. */
function ordenNueva(plan) {
  return {
    numeroOrden: 'ORD-1794358691756423', estado: 'Confirmado', pagoConfirmado: true, modoPago: 'produccion',
    planNombre: plan, fechaPago: COMPRA, creadoEl: COMPRA, creadoEn: COMPRA, createdAt: COMPRA, actualizadoEn: COMPRA,
    fechaEstimada: COMPRA, operadorAsignadoNombre: '',
  };
}

const sinInformes = crearIndiceInformes([]);

test('estados: completada/completado/terminada/finalizada, sin distinguir mayúsculas', () => {
  for (const e of ['completada', 'Completado', ' TERMINADA ', 'finalizada']) assert.equal(esEstadoCompletada(e), true, e);
  for (const e of ['pendiente', 'asignado', 'en_ejecucion', 'en revision', 'aprobado', '', null, undefined]) assert.equal(esEstadoCompletada(e), false, String(e));
});

test('plan: cantidad de visitas por nombre de plan', () => {
  assert.equal(totalVisitasDePlan({ planNombre: 'Plan 12' }), 12);
  assert.equal(totalVisitasDePlan({ servicio: { planNombre: 'Plan 6' } }), 6);
  assert.equal(totalVisitasDePlan({ planNombre: 'Plan 4' }), 4);
  assert.equal(totalVisitasDePlan({ tipoServicio: 'SPOT' }), 1);
  assert.equal(totalVisitasDePlan({ planNombre: 'Servicio Spot' }), 1);
  assert.equal(totalVisitasDePlan({}), 4);
});

for (const [plan, total] of [['Plan 12', 12], ['Plan 6', 6], ['Plan 4', 4]]) {
  test(`orden recién comprada con ${total} visitas: ninguna está terminada`, () => {
    const o = ordenNueva(plan);
    const ev = evaluarVisitas(o, { docId: 'abc', indiceInformes: sinInformes });
    assert.equal(ev.length, total);
    assert.equal(ev.every((v) => v.terminada === false), true);
    assert.equal(visitasTerminadas(o, { docId: 'abc', indiceInformes: sinInformes }).length, 0);
  });
}

test('el bug: contador, visitas[] y estado global erróneos en una orden recién comprada tampoco la dan por terminada', () => {
  const contador = { ...ordenNueva('Plan 6'), visitasCompletadas: 2 };
  assert.equal(numerosTerminados(contador, { docId: 'x', indiceInformes: sinInformes }).size, 0);

  const arreglo = { ...ordenNueva('Plan 6'), visitas: [{ estado: 'completada', fechaEstimada: COMPRA }, { estado: 'completada', fechaEstimada: COMPRA }] };
  // Estado explícito, pero sin informe ni fecha de ejecución propia: solo existe fechaEstimada (fecha de compra).
  assert.equal(numerosTerminados(arreglo, { docId: 'x', indiceInformes: sinInformes }).size, 0);
  assert.equal(evaluarVisita(arreglo, 1, { docId: 'x', indiceInformes: sinInformes }).motivo, 'sin_evidencia');

  const global = { ...ordenNueva('Plan 4'), estado: 'completada', estadoServicio: 'completada' };
  assert.equal(numerosTerminados(global, { docId: 'x', indiceInformes: sinInformes }).size, 0);
});

test('visita completada con estado explícito y su informe: terminada, con fecha de ejecución del informe y botón de informe', () => {
  const o = { ...ordenNueva('Plan 6'), estadosPorVisita: { V1: 'completada' } };
  const idx = crearIndiceInformes([['abc-V1', { ordenId: 'abc', visitaNumero: 1, estado: 'aprobado', fechaCaptura: EJECUCION }]]);
  const v = evaluarVisita(o, 1, { docId: 'abc', indiceInformes: idx });
  assert.equal(v.terminada, true);
  assert.equal(v.origenEstado, 'explicito');
  assert.equal(v.tieneInforme, true);
  assert.equal(v.informeId, 'abc-V1');
  assert.equal(v.fechaEjecucion.toISOString(), EJECUCION);
  assert.equal(evaluarVisita(o, 2, { docId: 'abc', indiceInformes: idx }).terminada, false);
});

test('estado explícito + fecha de ejecución propia (sin informe): terminada, pero sin informe', () => {
  const o = { ...ordenNueva('Plan 4'), estadosPorVisita: { V1: 'completada' }, programacionVisitas: { v_1: { fechaEjecucion: EJECUCION } } };
  const v = evaluarVisita(o, 1, { docId: 'abc', indiceInformes: sinInformes });
  assert.equal(v.terminada, true);
  assert.equal(v.tieneInforme, false);
  assert.equal(v.informeId, null);
  assert.equal(v.fechaEjecucion.toISOString(), EJECUCION);
});

test('estado completada por la aprobación del informe (programacionVisitas.v_n) con su informe cuenta', () => {
  const o = { ...ordenNueva('Plan 4'), programacionVisitas: { v_2: { estado: 'completada', informeDocId: 'abc-V2' } } };
  const idx = crearIndiceInformes([['abc-V2', { ordenId: 'abc', visitaNumero: 2, estado: 'aprobado', fechaCaptura: EJECUCION }]]);
  assert.deepEqual([...numerosTerminados(o, { docId: 'abc', indiceInformes: idx })], [2]);
});

test('informe sin estado completada: en revisión no es visita terminada', () => {
  const o = { ...ordenNueva('Plan 4'), estadosPorVisita: { V1: 'en_ejecucion' }, programacionVisitas: { v_1: { estado: 'en revision', fechaEjecucion: EJECUCION } } };
  const idx = crearIndiceInformes([['abc-V1', { ordenId: 'abc', visitaNumero: 1, estado: 'pendiente_revision', fechaCaptura: EJECUCION }]]);
  const v = evaluarVisita(o, 1, { docId: 'abc', indiceInformes: idx });
  assert.equal(v.terminada, false);
  assert.equal(v.motivo, 'sin_estado_completada');
});

test('un informe rechazado no es evidencia', () => {
  const o = { ...ordenNueva('Plan 4'), estadosPorVisita: { V1: 'completada' } };
  const idx = crearIndiceInformes([['abc-V1', { ordenId: 'abc', visitaNumero: 1, estado: 'rechazado' }]]);
  const v = evaluarVisita(o, 1, { docId: 'abc', indiceInformes: idx });
  assert.equal(v.terminada, false);
  assert.equal(v.tieneInforme, false);
});

test('completar V2 no arrastra V1 (la escritura es por visita y la lectura también)', () => {
  const o = ordenNueva('Plan 4');
  const payload = construirCierreVisita({ numero: 2, totalVisitas: 4, terminadasPrevias: 0, uidOperador: 'uid1', marcaTiempo: new Date(EJECUCION) });
  assert.equal(Object.keys(payload).some((k) => /V1\b|v_1\b/.test(k)), false);
  assert.equal(payload['estadosPorVisita.V2'], 'completada');
  assert.equal(payload.visitasCompletadas, 1); // cantidad terminada, no la posición (antes: 2, que daba también por hecha la V1)
  assert.equal('estado' in payload, false);     // no cierra la orden: faltan visitas
  // Se simula la mezcla de Firestore sobre la orden y se vuelve a leer con la regla.
  const despues = {
    ...o,
    estadosPorVisita: { V2: payload['estadosPorVisita.V2'] },
    programacionVisitas: { v_2: { visitaNumero: 2, fechaEjecucion: payload['programacionVisitas.v_2.fechaEjecucion'] } },
    visitasCompletadas: payload.visitasCompletadas,
  };
  const ctx = { docId: 'abc', indiceInformes: sinInformes };
  assert.equal(evaluarVisita(despues, 1, ctx).terminada, false);
  assert.equal(evaluarVisita(despues, 2, ctx).terminada, true);
  assert.deepEqual([...numerosTerminados(despues, ctx)], [2]);
});

test('el cierre exige operador y solo cierra la orden cuando están todas las visitas', () => {
  assert.throws(() => construirCierreVisita({ numero: 1, totalVisitas: 4, terminadasPrevias: 0, uidOperador: '', marcaTiempo: 1 }), /operador/);
  const ultima = construirCierreVisita({ numero: 4, totalVisitas: 4, terminadasPrevias: 3, uidOperador: 'u', marcaTiempo: 1 });
  assert.equal(ultima.estado, 'completada');
  assert.equal(ultima.visitasCompletadas, 4);
  const intermedia = construirCierreVisita({ numero: 4, totalVisitas: 4, terminadasPrevias: 1, uidOperador: 'u', marcaTiempo: 1 });
  assert.equal('estado' in intermedia, false); // completar la V4 antes que la V2 no cierra la orden
});

test('fechaPago, creadoEn/creadoEl, actualizadoEn y fechaEstimada nunca son fecha de término', () => {
  const o = {
    ...ordenNueva('Plan 4'), estadosPorVisita: { V1: 'completada' }, fechaCompletado: COMPRA, ultimaVisitaCompletadaFecha: COMPRA,
    visitas: [{ estado: 'completada', fechaEstimada: COMPRA }],
  };
  assert.equal(fechaEjecucionReal(o, 1, null), null);
  const v = evaluarVisita(o, 1, { docId: 'abc', indiceInformes: sinInformes });
  assert.equal(v.fechaEjecucion, null);
  assert.equal(v.terminada, false, 'sin fecha real ni informe no hay evidencia');
  assert.ok(CAMPOS_FECHA_PROHIBIDOS.includes('fechaPago') && CAMPOS_FECHA_PROHIBIDOS.includes('creadoEn') && CAMPOS_FECHA_PROHIBIDOS.includes('actualizadoEn'));
});

test('cada visita usa su propia fecha, no la de otra', () => {
  const o = { ...ordenNueva('Plan 4'), programacionVisitas: { v_1: { fechaEjecucion: '2026-12-01T10:00:00.000Z' }, v_2: { fechaEjecucion: '2027-02-01T10:00:00.000Z' } } };
  assert.equal(fechaEjecucionReal(o, 1, null).toISOString(), '2026-12-01T10:00:00.000Z');
  assert.equal(fechaEjecucionReal(o, 2, null).toISOString(), '2027-02-01T10:00:00.000Z');
  assert.equal(fechaEjecucionReal(o, 3, null), null);
});

test('compatibilidad: orden antigua con solo el contador y sus informes reales conserva lo terminado', () => {
  const o = { ...ordenNueva('Plan 6'), visitasCompletadas: 2 };
  const idx = crearIndiceInformes([
    ['abc-V1', { ordenId: 'abc', visitaNumero: 1, estado: 'aprobado', fechaCaptura: '2026-10-01T10:00:00.000Z' }],
    ['abc-V2', { ordenId: 'abc', visitaNumero: 2, estado: 'aprobado', fechaCaptura: '2026-12-01T10:00:00.000Z' }],
  ]);
  const ev = visitasTerminadas(o, { docId: 'abc', indiceInformes: idx });
  assert.deepEqual(ev.map((v) => v.numero), [1, 2]);
  assert.ok(ev.every((v) => v.origenEstado === 'legado_contador' && v.tieneInforme));
});

test('compatibilidad: el contador sin informe de esa visita no la termina (solo la que tiene informe)', () => {
  const o = { ...ordenNueva('Plan 6'), visitasCompletadas: 3 };
  const idx = crearIndiceInformes([['abc-V2', { ordenId: 'abc', visitaNumero: 2, estado: 'aprobado', fechaCaptura: EJECUCION }]]);
  assert.deepEqual([...numerosTerminados(o, { docId: 'abc', indiceInformes: idx })], [2]);
});

test('compatibilidad: el contador no se completa con una fecha suelta, solo con informe', () => {
  const o = { ...ordenNueva('Plan 4'), visitasCompletadas: 1, ultimaVisitaCompletadaFecha: EJECUCION, programacionVisitas: { v_1: { fechaEjecucion: EJECUCION } } };
  assert.equal(evaluarVisita(o, 1, { docId: 'abc', indiceInformes: sinInformes }).terminada, false);
});

test('compatibilidad: estado global completada con informes terminó esas visitas; el informe antiguo sin sufijo es la visita 1', () => {
  const o = { ...ordenNueva('Servicio Spot'), estado: 'completada' };
  const idx = crearIndiceInformes([['abc', { estado: 'aprobado', createdAt: { seconds: 1796000000 } }]]);
  const v = evaluarVisita(o, 1, { docId: 'abc', indiceInformes: idx });
  assert.equal(v.terminada, true);
  assert.equal(v.origenEstado, 'legado_global');
  assert.equal(v.informeId, 'abc');
  assert.ok(v.fechaEjecucion instanceof Date);
});

test('el informe se encuentra por ordenId+visitaNumero, por sufijo del id o por numeroOrden', () => {
  const idx = crearIndiceInformes(new Map([
    ['ORD-9-V3', { estado: 'aprobado' }],
    ['otro', { ordenId: 'docZ', visitaNumero: 2, estado: 'pendiente_revision' }],
  ]));
  assert.equal(informeDeVisita(idx, ['docA', 'ORD-9'], 3).id, 'ORD-9-V3');
  assert.equal(informeDeVisita(idx, ['docZ'], 2).id, 'otro');
  assert.equal(informeDeVisita(idx, ['docA'], 1), null);
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
