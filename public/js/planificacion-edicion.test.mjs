// Spec 085 / directriz B7: cambiar la fecha y asignar el operador de UNA visita desde «Planificación Planes y Spot».
// Lógica pura (permisos, qué visitas se pueden editar, validación con avisos, textos de confirmación, cambio local) y
// escritura aislada con Firestore falso. Ejecutar:  node --test public/js/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SIN_ASIGNAR, puedeEditarPlanificacion, visitaEditable, opcionesOperador, fechaPagoDeOrden,
  validarCambioFecha, validarCambioOperador, confirmacionFecha, confirmacionOperador, aplicarCambioEnOrden,
} from './planificacion-edicion.js';
import {
  construirCambioFecha, construirCambioOperador, guardarCambioFecha, guardarCambioOperador,
} from './planificacion-edicion-db.js';

// ---------------------------------------------------------------- permisos (D1, R7, CA7)
test('D1: solo el dueño (dueno === true) y el administrador (rol administrador o admin) editan', () => {
  assert.equal(puedeEditarPlanificacion({ dueno: true, rol: 'supervisor' }), true);
  assert.equal(puedeEditarPlanificacion({ rol: 'administrador' }), true);
  assert.equal(puedeEditarPlanificacion({ rol: 'Admin' }), true);
  assert.equal(puedeEditarPlanificacion({ rol: ' ADMINISTRADOR ' }), true);
});

test('D1: el supervisor, el operador, quien no tiene perfil y valores raros NO editan', () => {
  for (const perfil of [{ rol: 'supervisor' }, { rol: 'operador' }, { rol: '' }, {}, null, undefined, 'administrador', 42, { dueno: 'true' }, { dueno: 1 }, { dueno: false, rol: 'operador' }]) {
    assert.equal(puedeEditarPlanificacion(perfil), false, JSON.stringify(perfil));
  }
});

// ---------------------------------------------------------------- visitas cerradas (D4, R6, CA6)
test('D4: una visita realizada (en revisión) o aprobada (completada) no se edita; las demás sí', () => {
  assert.equal(visitaEditable({ estadoClave: 'completada', terminada: true }), false);
  assert.equal(visitaEditable({ estadoClave: 'en revision', terminada: false }), false);
  assert.equal(visitaEditable({ estadoClave: 'pendiente' }), true);
  assert.equal(visitaEditable({ estadoClave: 'asignado' }), true);
  assert.equal(visitaEditable({ estadoClave: 'reprogramada' }), true);
  assert.equal(visitaEditable({ estadoClave: 'rechazada' }), true);
});

test('una visita marcada como terminada por la regla única nunca se edita, aunque el estado no lo diga', () => {
  assert.equal(visitaEditable({ estadoClave: 'asignado', terminada: true }), false);
  assert.equal(visitaEditable(null), false);
  assert.equal(visitaEditable({}), true); // sin estado conocido: se trata como pendiente
});

// ---------------------------------------------------------------- operadores (R2)
test('R2: la lista de operadores son los del personal activo (nombre o, si no tiene, correo), sin repetir, con «Sin asignar» primero', () => {
  const staff = [
    { id: 'u1', data: { nombre: 'Zoila Pérez', activo: true } },
    { id: 'u2', data: { nombre: '', email: 'ana@ejemplo.cl' } },
    { id: 'u3', data: { nombre: 'Beto Soto', activo: false } },
    { id: 'u4', data: { nombre: 'Zoila Pérez' } },
    { id: 'u5', data: {} },
    { id: 'u6', data: { nombre: '  Carla Díaz  ' } },
  ];
  assert.deepEqual(opcionesOperador(staff), [SIN_ASIGNAR, 'ana@ejemplo.cl', 'Carla Díaz', 'Zoila Pérez']);
});

test('R2: si el operador actual ya no está en el personal, igual aparece para no perderlo al abrir el selector', () => {
  const o = opcionesOperador([{ id: 'u1', data: { nombre: 'Ana' } }], { actual: 'Pedro que se fue' });
  assert.ok(o.includes('Pedro que se fue'));
  assert.deepEqual(opcionesOperador([{ id: 'u1', data: { nombre: 'Ana' } }], { actual: SIN_ASIGNAR }), [SIN_ASIGNAR, 'Ana']);
  assert.deepEqual(opcionesOperador(null), [SIN_ASIGNAR]);
});

test('R2: el cambio de operador exige uno de la lista (o «Sin asignar») y distinto del actual', () => {
  const opciones = [SIN_ASIGNAR, 'Ana', 'Beto'];
  assert.deepEqual(validarCambioOperador({ operador: 'Beto', actual: SIN_ASIGNAR, opciones }), { ok: true, errores: [], valor: 'Beto' });
  assert.deepEqual(validarCambioOperador({ operador: SIN_ASIGNAR, actual: 'Ana', opciones }), { ok: true, errores: [], valor: SIN_ASIGNAR });
  assert.equal(validarCambioOperador({ operador: 'Ana', actual: 'Ana', opciones }).ok, false);
  assert.equal(validarCambioOperador({ operador: 'Intruso', actual: 'Ana', opciones }).ok, false);
  assert.equal(validarCambioOperador({ operador: '', actual: 'Ana', opciones }).ok, false);
  assert.equal(validarCambioOperador({ operador: undefined, actual: 'Ana', opciones }).ok, false);
});

// ---------------------------------------------------------------- fecha (R5, CA5)
test('R5: una fecha en día hábil, que no es feriado y cae en el día de ruta, no trae avisos', () => {
  // 2026-12-02 es miércoles; diaRuta 3 = miércoles
  const r = validarCambioFecha({ fechaIso: '2026-12-02', actualIso: '2026-11-30', pagoIso: '2026-11-01', feriados: { nombre: () => null }, diaRuta: 3 });
  assert.deepEqual(r, { ok: true, errores: [], avisos: [] });
});

test('R5/D3: sábado, domingo, feriado y fuera del día de ruta AVISAN pero no bloquean', () => {
  const feriados = { nombre: (iso) => (iso === '2026-12-08' ? 'Inmaculada Concepción' : null) };
  const sab = validarCambioFecha({ fechaIso: '2026-12-05', actualIso: '2026-11-30', feriados });
  assert.equal(sab.ok, true);
  assert.equal(sab.avisos.length, 1);
  assert.match(sab.avisos[0], /sábado/);
  const dom = validarCambioFecha({ fechaIso: '2026-12-06', actualIso: '2026-11-30', feriados });
  assert.equal(dom.ok, true);
  assert.match(dom.avisos[0], /domingo/);
  const fer = validarCambioFecha({ fechaIso: '2026-12-08', actualIso: '2026-11-30', feriados });
  assert.equal(fer.ok, true);
  assert.match(fer.avisos.join(' '), /feriado.*Inmaculada Concepción/i);
  const ruta = validarCambioFecha({ fechaIso: '2026-12-03', actualIso: '2026-11-30', feriados, diaRuta: 3 }); // jueves, la ruta es el miércoles
  assert.equal(ruta.ok, true);
  assert.match(ruta.avisos[0], /miércoles/);
  assert.match(ruta.avisos[0], /jueves/);
});

test('R5/D3: varios avisos a la vez (domingo y feriado)', () => {
  const r = validarCambioFecha({ fechaIso: '2026-12-06', actualIso: null, feriados: { nombre: () => 'Día X' } });
  assert.equal(r.ok, true);
  assert.equal(r.avisos.length, 2);
});

test('R5: una fecha ANTERIOR al pago no se permite; el mismo día del pago sí', () => {
  const antes = validarCambioFecha({ fechaIso: '2026-10-31', actualIso: '2026-11-30', pagoIso: '2026-11-01' });
  assert.equal(antes.ok, false);
  assert.match(antes.errores[0], /anterior.*pago.*01\/11\/2026/i);
  assert.equal(validarCambioFecha({ fechaIso: '2026-11-01', actualIso: '2026-11-30', pagoIso: '2026-11-01' }).ok, true);
  assert.equal(validarCambioFecha({ fechaIso: '2026-10-31', actualIso: '2026-11-30', pagoIso: null }).ok, true, 'sin fecha de pago no hay con qué comparar');
});

test('una fecha inválida o vacía se rechaza; la misma fecha también, salvo que la actual sea tentativa', () => {
  for (const f of ['', null, undefined, '2026-02-30', '30/11/2026', 'mañana', '2026-13-01']) {
    const r = validarCambioFecha({ fechaIso: f, actualIso: '2026-11-30' });
    assert.equal(r.ok, false, String(f));
    assert.match(r.errores[0], /fecha válida/i);
  }
  assert.equal(validarCambioFecha({ fechaIso: '2026-11-30', actualIso: '2026-11-30' }).ok, false);
  assert.equal(validarCambioFecha({ fechaIso: '2026-11-30', actualIso: '2026-11-30', esTentativa: true }).ok, true, 'fijar la fecha tentativa la vuelve real');
});

test('la fecha de pago de una orden sale de fechaPago (o la de creación) sin desfase de día', () => {
  assert.equal(fechaPagoDeOrden({ fechaPago: '2026-11-20T14:00:00.000Z' }), '2026-11-20');
  assert.equal(fechaPagoDeOrden({ fechaPago: '2026-11-20' }), '2026-11-20');
  assert.equal(fechaPagoDeOrden({ creadoEl: '2026-11-18' }), '2026-11-18');
  assert.equal(fechaPagoDeOrden({ fechaPago: { toDate: () => new Date(2026, 10, 5, 12) } }), '2026-11-05');
  assert.equal(fechaPagoDeOrden({}), null);
  assert.equal(fechaPagoDeOrden(null), null);
});

// ---------------------------------------------------------------- textos (R4)
test('R4: la confirmación muestra «antes → después»', () => {
  assert.equal(confirmacionFecha('30/11/2026', '2026-12-02'), '30/11/2026 → 02/12/2026');
  assert.equal(confirmacionFecha(null, '2026-12-02'), 'Sin fecha → 02/12/2026');
  assert.equal(confirmacionOperador(SIN_ASIGNAR, 'Ana'), 'Sin asignar → Ana');
  assert.equal(confirmacionOperador('Ana', SIN_ASIGNAR), 'Ana → Sin asignar');
});

// ---------------------------------------------------------------- qué se escribe (R1, R2, R3, CA1, CA2, CA3)
test('R1: el cambio de fecha escribe solo la clave de esa visita y los dos punteros, nunca el arreglo antiguo', () => {
  const p = construirCambioFecha({ claveVisita: 'V3', fechaIso: '2026-12-02' });
  assert.deepEqual(Object.keys(p).sort(), ['fechaProgramada', 'fechasPorVisita.V3', 'proximaVisita']);
  assert.equal(p['fechasPorVisita.V3'], p.fechaProgramada);
  assert.equal(p.proximaVisita, p.fechaProgramada);
  assert.match(p['fechasPorVisita.V3'], /^2026-12-02T\d\d:\d\d:\d\d\.\d{3}Z$/);
  assert.ok(!Object.keys(p).some((k) => k.startsWith('fechasProgramadas')));
});

test('R2: el cambio de operador escribe solo operadoresPorVisita.V<n> con el valor elegido («Sin asignar» incluido)', () => {
  assert.deepEqual(construirCambioOperador({ claveVisita: 'V12', operador: 'Ana' }), { 'operadoresPorVisita.V12': 'Ana' });
  assert.deepEqual(construirCambioOperador({ claveVisita: 'V1', operador: SIN_ASIGNAR }), { 'operadoresPorVisita.V1': SIN_ASIGNAR });
});

test('R3: una clave de visita que no sea V + número se rechaza (inyección de claves), y también un operador o fecha inválidos', () => {
  for (const clave of ['', 'V', 'v1', 'V1.x', 'V1000', '1', 'V1; drop', 'fechasProgramadas', '__proto__', 'V-1', null, undefined]) {
    assert.throws(() => construirCambioFecha({ claveVisita: clave, fechaIso: '2026-12-02' }), /visita/i, `fecha ${clave}`);
    assert.throws(() => construirCambioOperador({ claveVisita: clave, operador: 'Ana' }), /visita/i, `operador ${clave}`);
  }
  assert.throws(() => construirCambioFecha({ claveVisita: 'V1', fechaIso: '2026-02-30' }), /fecha/i);
  assert.throws(() => construirCambioOperador({ claveVisita: 'V1', operador: '' }), /operador/i);
  assert.throws(() => construirCambioOperador({ claveVisita: 'V1', operador: 'x'.repeat(121) }), /operador/i);
});

test('guardar la fecha hace UN updateDoc de la orden, con solo esas claves', async () => {
  const llamadas = [];
  const payload = await guardarCambioFecha({
    actualizar: async (ref, datos) => { llamadas.push([ref, datos]); },
    referencia: (id) => ({ path: `ordenes/${id}` }),
    ordenDocId: 'ord-1', claveVisita: 'V2', fechaIso: '2026-12-02',
  });
  assert.equal(llamadas.length, 1);
  assert.deepEqual(llamadas[0][0], { path: 'ordenes/ord-1' });
  assert.deepEqual(Object.keys(llamadas[0][1]).sort(), ['fechaProgramada', 'fechasPorVisita.V2', 'proximaVisita']);
  assert.deepEqual(payload, llamadas[0][1]);
});

test('guardar el operador hace UN updateDoc con solo operadoresPorVisita.V<n>', async () => {
  const llamadas = [];
  await guardarCambioOperador({
    actualizar: async (ref, datos) => { llamadas.push([ref, datos]); },
    referencia: (id) => ({ path: `ordenes/${id}` }),
    ordenDocId: 'ord-1', claveVisita: 'V2', operador: 'Ana',
  });
  assert.equal(llamadas.length, 1);
  assert.deepEqual(llamadas[0][1], { 'operadoresPorVisita.V2': 'Ana' });
});

test('sin orden no se escribe nada; si Firestore falla, el error sube tal cual (CA4)', async () => {
  let escribio = false;
  const base = { actualizar: async () => { escribio = true; }, referencia: (id) => ({ id }) };
  await assert.rejects(() => guardarCambioFecha({ ...base, ordenDocId: '', claveVisita: 'V1', fechaIso: '2026-12-02' }), /orden/i);
  await assert.rejects(() => guardarCambioOperador({ ...base, ordenDocId: '', claveVisita: 'V1', operador: 'Ana' }), /orden/i);
  assert.equal(escribio, false);
  const falla = Object.assign(new Error('permiso'), { code: 'permission-denied' });
  await assert.rejects(() => guardarCambioFecha({ actualizar: async () => { throw falla; }, referencia: (id) => ({ id }), ordenDocId: 'o', claveVisita: 'V1', fechaIso: '2026-12-02' }), (e) => e === falla);
  await assert.rejects(() => guardarCambioOperador({ actualizar: async () => { throw falla; }, referencia: (id) => ({ id }), ordenDocId: 'o', claveVisita: 'V1', operador: 'Ana' }), (e) => e === falla);
});

// ---------------------------------------------------------------- CA3: las otras visitas quedan idénticas
function ordenDe12() {
  const fechasPorVisita = {}; const operadoresPorVisita = {};
  for (let n = 1; n <= 12; n += 1) {
    fechasPorVisita[`V${n}`] = `2026-${String(Math.min(n, 12)).padStart(2, '0')}-10T10:00:00.000Z`;
    operadoresPorVisita[`V${n}`] = n % 2 ? 'Ana' : SIN_ASIGNAR;
  }
  return { numeroOrden: 7, cliente: 'X', fechasPorVisita, operadoresPorVisita, estadosPorVisita: { V1: 'completada' }, fechaProgramada: '2026-01-10T10:00:00.000Z', proximaVisita: '2026-01-10T10:00:00.000Z' };
}

test('CA3: al cambiar la fecha de una visita, las otras 11 y el resto del documento quedan idénticos', () => {
  const orden = ordenDe12();
  const copia = structuredClone(orden);
  const nuevo = aplicarCambioEnOrden(orden, construirCambioFecha({ claveVisita: 'V5', fechaIso: '2026-12-02' }));
  assert.deepEqual(orden, copia, 'no se muta la orden original');
  assert.match(nuevo.fechasPorVisita.V5, /^2026-12-02T/);
  const sin = (o, ...claves) => { const c = structuredClone(o); claves.forEach((k) => { const [mapa, v] = k.split('.'); if (v) delete c[mapa][v]; else delete c[mapa]; }); return c; };
  assert.deepEqual(sin(nuevo, 'fechasPorVisita.V5', 'fechaProgramada', 'proximaVisita'), sin(orden, 'fechasPorVisita.V5', 'fechaProgramada', 'proximaVisita'));
  for (let n = 1; n <= 12; n += 1) if (n !== 5) assert.equal(nuevo.fechasPorVisita[`V${n}`], orden.fechasPorVisita[`V${n}`]);
  assert.deepEqual(nuevo.operadoresPorVisita, orden.operadoresPorVisita);
});

test('CA3: al cambiar el operador de una visita, las otras 11 y el resto quedan idénticos', () => {
  const orden = ordenDe12();
  const nuevo = aplicarCambioEnOrden(orden, construirCambioOperador({ claveVisita: 'V4', operador: 'Beto' }));
  assert.equal(nuevo.operadoresPorVisita.V4, 'Beto');
  const esperado = structuredClone(orden);
  esperado.operadoresPorVisita.V4 = 'Beto';
  assert.deepEqual(nuevo, esperado);
});

test('aplicarCambioEnOrden crea los mapas si la orden no los tenía y rechaza claves ajenas', () => {
  const nuevo = aplicarCambioEnOrden({ numeroOrden: 1 }, { 'operadoresPorVisita.V1': 'Ana', 'fechasPorVisita.V1': '2026-12-02T13:00:00.000Z', fechaProgramada: 'x', proximaVisita: 'x' });
  assert.deepEqual(nuevo.operadoresPorVisita, { V1: 'Ana' });
  assert.deepEqual(nuevo.fechasPorVisita, { V1: '2026-12-02T13:00:00.000Z' });
  for (const k of ['fechasProgramadas', 'estado', 'fechasPorVisita', 'operadoresPorVisita.V1x', 'a.b', '__proto__.x']) {
    assert.throws(() => aplicarCambioEnOrden({}, { [k]: 'x' }), /no se puede/i, k);
  }
});

// ─── Etapa 2 (Spot) ─────────────────────────────────────────────────────────────────────────────────────────────
import { textoVisitaEdicion } from './planificacion-edicion.js';

test('textoVisitaEdicion: Planes dice «n de N»; Spot (sin visitaTexto) dice «Servicio Spot»', () => {
  assert.equal(textoVisitaEdicion({ visitaTexto: '2 de 4' }), 'Visita 2 de 4');
  assert.equal(textoVisitaEdicion({ visitaNumero: 1 }), 'Servicio Spot');
  assert.equal(textoVisitaEdicion(null), 'Servicio Spot');
});

test('Spot: una fila de Spot (V1, sin visitaTexto) se puede editar salvo realizada o aprobada', () => {
  assert.equal(visitaEditable({ visitaNumero: 1, estadoClave: 'pendiente', terminada: false }), true);
  assert.equal(visitaEditable({ visitaNumero: 1, estadoClave: 'completada', terminada: true }), false);
  assert.equal(visitaEditable({ visitaNumero: 1, estadoClave: 'en revision' }), false);
});

test('Spot: la orden se actualiza solo con las llaves de V1 (la fecha que eligió el cliente deja de mandar sobre fechasPorVisita.V1)', () => {
  const orden = { tipoServicio: 'Spot', fechaProgramada: '2026-12-10', cliente: 'X' };
  const c = aplicarCambioEnOrden(orden, { 'fechasPorVisita.V1': '2026-12-15T13:00:00.000Z', fechaProgramada: '2026-12-15T13:00:00.000Z', proximaVisita: '2026-12-15T13:00:00.000Z' });
  assert.deepEqual(c.fechasPorVisita, { V1: '2026-12-15T13:00:00.000Z' });
  assert.equal(orden.fechasPorVisita, undefined, 'no muta la original');
  assert.equal(c.cliente, 'X');
});
