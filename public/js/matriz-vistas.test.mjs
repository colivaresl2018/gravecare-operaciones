// HTML de las matrices de Planificación: todo dato de Firestore va escapado. Ejecutar: node --test public/js/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { construirMatrizSemana, construirMatrizMes } from './matriz-planificacion.js';
import { crearIndiceRutas, crearIndiceFeriados } from './rutas-planificacion.js';
import { htmlCabeceraSemana, htmlCuerpoSemana, htmlCabeceraMes, htmlCuerpoMes, htmlDetalle } from './matriz-vistas.js';

const LUNES = '2026-11-16';
const MALO = '<img src=x onerror=alert(1)>';
const RUTAS = crearIndiceRutas([
  { id: 'a', data: { cementerio: 'Cementerio General de Recoleta', eje: 'Eje Santiago Norte 1', diaSemana: 1 } },
  { id: 'b', data: { cementerio: 'Parque Canaán de Pudahuel', eje: 'Eje Santiago Poniente 1', diaSemana: 2 } },
  { id: 'c', data: { cementerio: 'Cementerio Metropolitano de Lo Espejo', eje: 'Eje Santiago Sur 1', diaSemana: 3 } },
  { id: 'd', data: { cementerio: 'Parque Sendero de San Bernardo', eje: 'Eje Santiago Sur 2', diaSemana: 4 } },
  { id: 'e', data: { cementerio: 'Parque Jardín de Rancagua', eje: 'Eje Rancagua – Machalí', diaSemana: 5 } },
]);
const FERIADOS = crearIndiceFeriados([{ id: '2026-11-01', data: { nombre: 'Día de Todos los Santos' } }]);
const CTX = { rutas: RUTAS, feriados: FERIADOS };

function fila(docId, cementerio, fechaIso, extra = {}) {
  const r = RUTAS.rutaDe(cementerio);
  return {
    docId, numeroOrden: `GC-${docId}`, cliente: `Cliente ${docId}`, serQuerido: 'Ser Querido', esPrueba: false, cementerio,
    nivel: 'Premium', ramosAdicionales: 2, eje: r ? r.eje : 'Sin eje', diaRuta: r ? r.diaSemana : null,
    plan: 'Plan 12', visitaNumero: 1, visitaTotal: 12, visitaTexto: '1 de 12', operador: 'Sin asignar', estado: 'Pendiente',
    estadoClases: 'bg-slate-100 border-slate-300 text-slate-700', terminada: false, esTentativa: false, fechaIso,
    fechaTexto: fechaIso ? fechaIso.split('-').reverse().join('/') : 'Sin fecha programada', ...extra,
  };
}

test('cabecera de semana: lunes a viernes con fecha y eje (de la colección rutas); sábado y domingo solo con visitas', () => {
  const m = construirMatrizSemana([], { lunesIso: '2026-10-26', ...CTX }); // viernes 30/10; domingo 1/11 es feriado
  const h = htmlCabeceraSemana(m);
  for (const t of ['Cliente / Cementerio', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', '26/10', 'Eje Santiago Norte 1', 'Eje Santiago Sur 2', 'Eje Rancagua – Machalí']) {
    assert.ok(h.includes(t), t);
  }
  assert.ok(!h.includes('Sábado') && !h.includes('Domingo'));
  assert.ok(!h.includes('FERIADO'));
  const conSabado = construirMatrizSemana([fila('A', 'Parque Canaán de Pudahuel', '2026-11-21')], { lunesIso: LUNES, ...CTX });
  assert.ok(htmlCabeceraSemana(conSabado).includes('Sábado'));
  const conFeriado = construirMatrizSemana([fila('A', 'Parque Canaán de Pudahuel', '2026-11-01')], { lunesIso: '2026-10-26', ...CTX });
  const hf = htmlCabeceraSemana(conFeriado);
  assert.ok(hf.includes('Domingo') && hf.includes('FERIADO') && hf.includes('Día de Todos los Santos'));
});

test('cabecera de semana sin colección de rutas: los días no traen eje (no se inventa ninguno)', () => {
  const h = htmlCabeceraSemana(construirMatrizSemana([], { lunesIso: LUNES }));
  assert.ok(!h.includes('Eje '));
  assert.ok(h.includes('Lunes'));
});

test('cuerpo de semana: tarjeta de visita con data-visita, estado, plan, número de visita y eje', () => {
  const m = construirMatrizSemana([fila('ORD-1', 'Cementerio General de Recoleta', LUNES)], { lunesIso: LUNES, ...CTX });
  const b = htmlCuerpoSemana(m);
  assert.ok(b.includes('data-visita="ORD-1|1"'));
  assert.ok(b.includes('Plan 12') && b.includes('Visita 1 de 12') && b.includes('Pendiente'));
  assert.ok(b.includes('Cliente ORD-1') && b.includes('Cementerio General de Recoleta') && b.includes('GC-ORD-1') && b.includes('Eje Santiago Norte 1'));
  assert.ok(!b.includes('Sin eje') && !b.includes('Fuera de su día de ruta') && !b.includes('Tentativa'));
});

test('cuerpo de semana: «Sin eje», «Fuera de su día de ruta» y «Tentativa» solo cuando corresponde', () => {
  const m = construirMatrizSemana([
    fila('A', '', LUNES),
    fila('B', 'Cementerio General de Recoleta', '2026-11-18', { esTentativa: true }),
  ], { lunesIso: LUNES, ...CTX });
  const b = htmlCuerpoSemana(m);
  assert.ok(b.includes('Sin eje'));
  assert.ok(b.includes('Fuera de su día de ruta'));
  assert.ok(b.includes('Tentativa'));
  assert.equal((b.match(/Fuera de su día de ruta/g) || []).length, 1); // solo la de B
});

test('cuerpo de semana: la orden sin visita esa semana muestra «Próx:» en la columna de su día de ruta', () => {
  const m = construirMatrizSemana([fila('A', 'Parque Canaán de Pudahuel', '2026-11-30', { visitaNumero: 2, visitaTexto: '2 de 12' })], { lunesIso: LUNES, soloConVisita: false, ...CTX });
  const b = htmlCuerpoSemana(m);
  assert.ok(b.includes('Sin visita esta semana') && b.includes('Próx: visita 2 de 12') && b.includes('data-orden="A"'));
  assert.ok(!b.includes('data-visita='));
});

test('sin órdenes: mensaje vacío con el ancho correcto de columnas', () => {
  const b = htmlCuerpoSemana(construirMatrizSemana([], { lunesIso: LUNES, ...CTX }));
  assert.ok(b.includes('No hay visitas programadas en esta semana con los filtros activos.'));
  assert.ok(b.includes('colspan="6"'));
});

test('escape: un nombre con HTML no se ejecuta en cabecera, cuerpo ni detalle (incluidos eje y feriado)', () => {
  const rutasMalas = crearIndiceRutas([{ id: 'x', data: { cementerio: MALO, eje: MALO, diaSemana: 1 } }]);
  const feriadosMalos = crearIndiceFeriados([{ id: '2026-11-21', data: { nombre: MALO } }]);
  const f = fila('A"><b>', MALO, '2026-11-21', { cliente: MALO, serQuerido: MALO, plan: MALO, operador: MALO, numeroOrden: MALO, estado: MALO, estadoClases: 'x" onmouseover="alert(1)', visitaTexto: MALO, fechaTexto: MALO, eje: MALO, nivel: MALO });
  const m = construirMatrizSemana([f], { lunesIso: LUNES, rutas: rutasMalas, feriados: feriadosMalos });
  for (const html of [htmlCabeceraSemana(m), htmlCuerpoSemana(m), htmlDetalle(m.ordenes[0].celdas[5][0], [f])]) {
    assert.ok(!html.includes('<img'), html.slice(0, 200));
    assert.ok(!html.includes('"><b>'));
    assert.ok(!html.includes('onmouseover="alert'));
  }
  assert.ok(htmlCuerpoSemana(m).includes('&lt;img src=x onerror=alert(1)&gt;'));
  const mes = construirMatrizMes([{ ...f, fechaIso: '2026-11-21' }], { mesIso: '2026-11', feriados: feriadosMalos });
  assert.ok(!htmlCabeceraMes(mes).includes('<img'));
  assert.ok(!htmlCuerpoMes(mes, MALO).includes('<img') && !htmlCuerpoMes(mes, MALO).includes('"><b>'));
  assert.ok(!htmlCuerpoMes(construirMatrizMes([], { mesIso: '2026-11' }), MALO).includes('<img'));
});

test('cabecera del mes: un th por día, fin de semana y feriado marcados con title', () => {
  const h = htmlCabeceraMes(construirMatrizMes([], { mesIso: '2026-11', ...CTX }));
  assert.equal((h.match(/<th/g) || []).length, 31); // Cliente + 30 días
  assert.ok(h.includes('Cliente / Cementerio'));
  assert.ok(h.includes('2026-11-01 — Día de Todos los Santos'));
  assert.ok(h.includes('title="2026-11-16"'));
});

test('cuerpo del mes: el botón S queda en la columna de su día; un feriado o sábado no lo bloquea; Spot no marca eje ni ruta', () => {
  const m = construirMatrizMes([fila('S1', 'Cementerio Metropolitano de Lo Espejo', '2026-11-24'), fila('S2', '', '2026-11-01')], { mesIso: '2026-11', ...CTX });
  const b = htmlCuerpoMes(m, 'Noviembre 2026');
  assert.ok(b.includes('data-visita="S1|1"') && b.includes('data-visita="S2|1"'));
  const filaS1 = b.split('<tr').find((t) => t.includes('data-visita="S1|1"'));
  assert.equal((filaS1.split('data-visita="S1|1"')[0].match(/<td/g) || []).length, 1 + 24);
  assert.ok(b.includes('Cementerio Metropolitano de Lo Espejo'));
  assert.ok(!b.includes('Fuera de su día de ruta'));
});

test('cuerpo del mes sin servicios: mensaje con el nombre del mes', () => {
  const b = htmlCuerpoMes(construirMatrizMes([], { mesIso: '2026-11', ...CTX }), 'Noviembre 2026');
  assert.ok(b.includes('No hay servicios Spot en Noviembre 2026.'));
  assert.ok(b.includes('colspan="31"'));
});

test('detalle de Plan: datos, eje, tipo de servicio, ramos adicionales y cronograma completo, sin botones de acción', () => {
  const visitas = [
    fila('A', 'Parque Canaán de Pudahuel', '2026-11-17', { visitaNumero: 1 }),
    fila('A', 'Parque Canaán de Pudahuel', '2026-12-17', { visitaNumero: 2, visitaTexto: '2 de 12', esTentativa: true }),
  ];
  const d = htmlDetalle(visitas[0], visitas);
  for (const t of ['Cliente A', 'Ser Querido', 'Plan 12', 'GC-A', 'Parque Canaán de Pudahuel', 'Eje Santiago Poniente 1', 'Premium', 'Ramos adicionales', 'Cronograma de visitas', '1 de 12', '2 de 12', '17/12/2026', 'Tentativa']) {
    assert.ok(d.includes(t), t);
  }
  assert.ok(!d.includes('<button') && !d.includes('onclick'));
  assert.ok(htmlDetalle(fila('B', '', LUNES), []).includes('Sin eje'));
});

test('detalle de Spot: fecha elegida por el cliente y sin cronograma', () => {
  const s = fila('S1', 'Cementerio Metropolitano de Lo Espejo', '2026-11-19', { plan: undefined, visitaTotal: undefined, visitaTexto: undefined });
  const d = htmlDetalle(s, [s]);
  assert.ok(d.includes('Fecha elegida por el cliente') && d.includes('19/11/2026'));
  assert.ok(!d.includes('Cronograma de visitas'));
});
