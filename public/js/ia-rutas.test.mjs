// Spec 082 etapa 3: «Sugerir rutas con IA» en Planificación (solo dueño). Lógica sin Firebase ni DOM real.
// R15 (fecha + sepulturas ≤ 200 + operadores ≤ 20, solo dueño), R16 (itinerario por operador y cementerio, informativo),
// CA8 (no dueño: no ve el botón y no se llama), CA9 (cada sepultura exactamente una vez), CA10/CA12 (errores), CA11 (HTML como texto).
// Ejecutar: node --test public/js/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FUNCION_RUTAS, MAX_SEPULTURAS, MAX_OPERADORES, MENSAJE_SOLO_DUENO, MENSAJE_SIN_SUGERENCIA, esDueno, idCementerio, sepulturasPendientes,
  operadoresDisponibles, validarSolicitud, solicitarRutas, leerSugerencia, pintarItinerarios, textoResumen,
} from './ia-rutas.js';
import { AVISO_IA, MENSAJE_GENERICO } from './ia-informe.js';

const fila = (o = {}) => ({ docId: 'ORD1', visitaNumero: 1, cementerio: 'Parque del Recuerdo', fechaIso: '2026-12-01', estadoClave: 'programada', terminada: false, cliente: 'Cliente Uno', ...o });
const STAFF = [
  { id: 'uidA', data: { nombre: 'Ana', activo: true } },
  { id: 'uidB', data: { nombre: 'Beto' } },
  { id: 'uidC', data: { nombre: 'Carla', activo: false } },
  { id: 'uidD', data: { email: 'd@x.cl' } },
];

test('constantes: función, topes de la spec y mensaje del dueño', () => {
  assert.equal(FUNCION_RUTAS, 'sugerirRutasIA');
  assert.equal(MAX_SEPULTURAS, 200);
  assert.equal(MAX_OPERADORES, 20);
  assert.equal(MENSAJE_SOLO_DUENO, 'Solo el dueño puede usar esta función.');
  assert.match(AVISO_IA, /La IA puede equivocarse/);
});

test('CA8: solo es dueño quien tiene dueno === true (administrador, supervisor, operador y sin perfil no)', () => {
  assert.equal(esDueno({ dueno: true }), true);
  for (const p of [{ dueno: false }, { rol: 'administrador' }, { rol: 'admin', dueno: 'true' }, { rol: 'supervisor' }, {}, null, undefined, 'dueno']) assert.equal(esDueno(p), false, JSON.stringify(p));
});

test('idCementerio: slug estable [a-z0-9-] sin tildes; vacío si no hay cementerio real', () => {
  assert.equal(idCementerio('Parque del Recuerdo'), 'parque-del-recuerdo');
  assert.equal(idCementerio('  Municipal N° 1 '), 'municipal-n-1');
  assert.equal(idCementerio('Ñuñoa Cementerio'), 'nunoa-cementerio');
  for (const v of ['', '—', null, undefined, '  ']) assert.equal(idCementerio(v), '', String(v));
  assert.ok(idCementerio('x'.repeat(300)).length <= 80);
  assert.match(idCementerio('Parque del Recuerdo'), /^[A-Za-z0-9_-]{1,80}$/);
});

test('sepulturasPendientes: solo las visitas de esa fecha que no están realizadas ni en revisión, con id y cementerioId', () => {
  const filas = [
    fila(),
    fila({ docId: 'ORD2', visitaNumero: 3, cementerio: 'Cementerio General' }),
    fila({ docId: 'ORD3', fechaIso: '2026-12-02' }),
    fila({ docId: 'ORD4', estadoClave: 'completada', terminada: true }),
    fila({ docId: 'ORD5', estadoClave: 'en revision' }),
    fila({ docId: 'ORD6', fechaIso: null }),
  ];
  const r = sepulturasPendientes(filas, '2026-12-01');
  assert.deepEqual(r.sepulturas, [{ id: 'ORD1-V1', cementerioId: 'parque-del-recuerdo' }, { id: 'ORD2-V3', cementerioId: 'cementerio-general' }]);
  assert.equal(r.omitidas, 0);
  assert.deepEqual(r.nombresCementerio, { 'parque-del-recuerdo': 'Parque del Recuerdo', 'cementerio-general': 'Cementerio General' });
  assert.equal(r.etiquetas['ORD1-V1'].includes('Cliente Uno'), true);
});

test('sepulturasPendientes: sin cementerio o con un id que la función rechazaría se omiten y se cuentan (no se inventan)', () => {
  const r = sepulturasPendientes([fila({ cementerio: '—' }), fila({ docId: 'ORD/2' }), fila({ docId: 'a'.repeat(90) }), fila({ docId: 'OK_1' })], '2026-12-01');
  assert.deepEqual(r.sepulturas.map((s) => s.id), ['OK_1-V1']);
  assert.equal(r.omitidas, 3);
});

test('sepulturasPendientes: una visita repetida entra una sola vez; filas inválidas no rompen', () => {
  const r = sepulturasPendientes([fila(), fila(), null, undefined, {}, 'x'], '2026-12-01');
  assert.equal(r.sepulturas.length, 1);
  assert.deepEqual(sepulturasPendientes(null, '2026-12-01').sepulturas, []);
});

test('el nombre del cliente NO viaja a la función: solo id y cementerioId', () => {
  const { sepulturas } = sepulturasPendientes([fila()], '2026-12-01');
  assert.deepEqual(Object.keys(sepulturas[0]).sort(), ['cementerioId', 'id']);
});

test('operadoresDisponibles: personal activo con uid válido, con nombre o correo, ordenado; sin los desactivados', () => {
  const r = operadoresDisponibles([...STAFF, { id: 'mal uid!', data: { nombre: 'Zeta' } }, null]);
  assert.deepEqual(r, [{ uid: 'uidA', nombre: 'Ana' }, { uid: 'uidB', nombre: 'Beto' }, { uid: 'uidD', nombre: 'd@x.cl' }]);
  assert.deepEqual(operadoresDisponibles(null), []);
});

test('R15: validarSolicitud exige fecha real, de 1 a 200 sepulturas y de 1 a 20 operadores', () => {
  const sep = [{ id: 'A-V1', cementerioId: 'c' }];
  const ops = [{ uid: 'u1', nombre: 'Ana' }];
  assert.equal(validarSolicitud({ fecha: '2026-12-01', sepulturas: sep, operadores: ops }).ok, true);
  assert.equal(validarSolicitud({ fecha: '2026-12-01', sepulturas: Array.from({ length: 200 }, (_, i) => ({ id: `A${i}-V1`, cementerioId: 'c' })), operadores: ops }).ok, true);
  assert.equal(validarSolicitud({ fecha: '2026-12-01', sepulturas: Array.from({ length: 201 }, (_, i) => ({ id: `A${i}-V1`, cementerioId: 'c' })), operadores: ops }).ok, false);
  assert.match(validarSolicitud({ fecha: '2026-12-01', sepulturas: Array.from({ length: 201 }, (_, i) => ({ id: `A${i}-V1`, cementerioId: 'c' })), operadores: ops }).error, /200/);
  assert.equal(validarSolicitud({ fecha: '2026-12-01', sepulturas: sep, operadores: Array.from({ length: 21 }, (_, i) => ({ uid: `u${i}`, nombre: 'x' })) }).ok, false);
  assert.match(validarSolicitud({ fecha: '2026-12-01', sepulturas: sep, operadores: Array.from({ length: 21 }, (_, i) => ({ uid: `u${i}`, nombre: 'x' })) }).error, /20/);
  assert.equal(validarSolicitud({ fecha: '2026-12-01', sepulturas: [], operadores: ops }).ok, false);
  assert.equal(validarSolicitud({ fecha: '2026-12-01', sepulturas: sep, operadores: [] }).ok, false);
  assert.equal(validarSolicitud({ fecha: '01/12/2026', sepulturas: sep, operadores: ops }).ok, false);
  assert.equal(validarSolicitud({ fecha: '2026-02-30', sepulturas: sep, operadores: ops }).ok, false);
});

const SEP5 = ['A-V1', 'B-V1', 'C-V1', 'D-V1', 'E-V1'].map((id, i) => ({ id, cementerioId: i < 3 ? 'c1' : 'c2' }));
const OPS2 = [{ uid: 'uidA', nombre: 'Ana' }, { uid: 'uidB', nombre: 'Beto' }];
const RESP_OK = { ok: true, fecha: '2026-12-01', itinerarios: [
  { operadorUid: 'uidA', cementerios: [{ cementerioId: 'c1', sepulturas: ['A-V1', 'B-V1', 'C-V1'] }] },
  { operadorUid: 'uidB', cementerios: [{ cementerioId: 'c2', sepulturas: ['D-V1', 'E-V1'] }] },
] };

test('CA9: llama con { fecha, sepulturas (id y cementerioId), operadores (solo uid) } y devuelve cada sepultura exactamente una vez', async () => {
  const llamadas = [];
  const r = await solicitarRutas({ dueno: true, fecha: '2026-12-01', sepulturas: SEP5, operadores: OPS2, llamar: async (d) => { llamadas.push(d); return RESP_OK; } });
  assert.equal(r.ok, true);
  assert.deepEqual(llamadas, [{ fecha: '2026-12-01', sepulturas: SEP5, operadores: [{ uid: 'uidA' }, { uid: 'uidB' }] }], 'sin nombres de personas en la llamada');
  const vistas = r.itinerarios.flatMap((it) => it.cementerios.flatMap((c) => c.sepulturas));
  assert.deepEqual([...vistas].sort(), SEP5.map((s) => s.id).sort());
  assert.equal(r.fecha, '2026-12-01');
});

test('CA8: si no es dueño NO se llama a la función y se muestra el mensaje del dueño', async () => {
  let llamo = 0;
  const r = await solicitarRutas({ dueno: false, fecha: '2026-12-01', sepulturas: SEP5, operadores: OPS2, llamar: async () => { llamo += 1; return RESP_OK; } });
  assert.deepEqual({ ok: r.ok, mensaje: r.mensaje }, { ok: false, mensaje: MENSAJE_SOLO_DUENO });
  assert.equal(llamo, 0);
});

test('R15: una solicitud inválida se rechaza SIN llamar a la función', async () => {
  let llamo = 0;
  const llamar = async () => { llamo += 1; return RESP_OK; };
  for (const p of [{ fecha: 'hoy', sepulturas: SEP5, operadores: OPS2 }, { fecha: '2026-12-01', sepulturas: [], operadores: OPS2 }, { fecha: '2026-12-01', sepulturas: SEP5, operadores: [] }]) {
    const r = await solicitarRutas({ dueno: true, llamar, ...p });
    assert.equal(r.ok, false);
    assert.ok(r.mensaje);
  }
  assert.equal(llamo, 0);
});

test('R3 / CA10 / CA12: los errores de la función salen tal cual; los técnicos o de red, con el mensaje genérico', async () => {
  const dep = (e) => ({ dueno: true, fecha: '2026-12-01', sepulturas: SEP5, operadores: OPS2, llamar: async () => { throw e; } });
  let r = await solicitarRutas(dep(Object.assign(new Error('Llegaste al límite de 5 propuestas de IA por día. Podrás usarla de nuevo mañana.'), { code: 'functions/resource-exhausted' })));
  assert.equal(r.mensaje, 'Llegaste al límite de 5 propuestas de IA por día. Podrás usarla de nuevo mañana.');
  r = await solicitarRutas(dep(Object.assign(new Error('Solo el dueño puede usar esta función.'), { code: 'functions/permission-denied' })));
  assert.equal(r.mensaje, MENSAJE_SOLO_DUENO);
  r = await solicitarRutas(dep(new TypeError('Failed to fetch')));
  assert.equal(r.mensaje, MENSAJE_GENERICO);
  r = await solicitarRutas(dep(new Error('internal')));
  assert.equal(r.mensaje, MENSAJE_GENERICO);
});

test('una respuesta que no cuadra (falta o sobra una sepultura, repetida, de otro cementerio u operador ajeno) no se muestra', async () => {
  const mal = [
    null, {}, { ok: false },
    { ok: true, fecha: '2026-12-01', itinerarios: 'no' },
    { ...RESP_OK, itinerarios: [RESP_OK.itinerarios[0]] }, // faltan D y E
    { ...RESP_OK, itinerarios: [...RESP_OK.itinerarios, { operadorUid: 'uidA', cementerios: [{ cementerioId: 'c1', sepulturas: ['A-V1'] }] }] }, // repetida
    { ...RESP_OK, itinerarios: [RESP_OK.itinerarios[0], { operadorUid: 'uidB', cementerios: [{ cementerioId: 'c2', sepulturas: ['D-V1', 'E-V1', 'Z-V1'] }] }] }, // sobra Z
    { ...RESP_OK, itinerarios: [RESP_OK.itinerarios[0], { operadorUid: 'uidB', cementerios: [{ cementerioId: 'c1', sepulturas: ['D-V1', 'E-V1'] }] }] }, // otro cementerio
    { ...RESP_OK, itinerarios: [RESP_OK.itinerarios[0], { operadorUid: 'uidX', cementerios: [{ cementerioId: 'c2', sepulturas: ['D-V1', 'E-V1'] }] }] }, // operador ajeno
  ];
  for (const m of mal) {
    const r = await solicitarRutas({ dueno: true, fecha: '2026-12-01', sepulturas: SEP5, operadores: OPS2, llamar: async () => m });
    assert.equal(r.ok, false, JSON.stringify(m));
    assert.equal(r.mensaje, MENSAJE_GENERICO);
  }
});

test('R16: releer rutasSugeridas/{fecha}: devuelve los itinerarios guardados o avisa que no hay', async () => {
  const guardada = { fecha: '2026-12-01', itinerarios: RESP_OK.itinerarios, generadoEl: '2026-11-30T15:00:00.000Z', generadoPor: 'uidOwner', modelo: 'm' };
  let r = await leerSugerencia({ fecha: '2026-12-01', leer: async (f) => (f === '2026-12-01' ? guardada : null) });
  assert.equal(r.ok, true);
  assert.deepEqual(r.itinerarios, RESP_OK.itinerarios);
  assert.equal(r.generadoEl, '2026-11-30T15:00:00.000Z');
  r = await leerSugerencia({ fecha: '2026-12-05', leer: async () => null });
  assert.deepEqual({ ok: r.ok, mensaje: r.mensaje }, { ok: false, mensaje: MENSAJE_SIN_SUGERENCIA });
  r = await leerSugerencia({ fecha: 'mañana', leer: async () => guardada });
  assert.equal(r.ok, false);
  r = await leerSugerencia({ fecha: '2026-12-01', leer: async () => { throw new Error('permission-denied'); } });
  assert.equal(r.ok, false);
  assert.doesNotMatch(r.mensaje, /permission|denied/i);
  r = await leerSugerencia({ fecha: '2026-12-01', leer: async () => ({ itinerarios: 'x' }) });
  assert.equal(r.ok, false, 'un documento mal formado no se muestra');
});

test('textoResumen: «5 visitas · 2 cementerios · 2 operadores»', () => {
  assert.equal(textoResumen(RESP_OK.itinerarios), '5 visitas · 2 cementerios · 2 operadores');
  assert.equal(textoResumen([{ operadorUid: 'u', cementerios: [{ cementerioId: 'c', sepulturas: ['x'] }] }]), '1 visita · 1 cementerio · 1 operador');
});

// Documento falso mínimo (sin jsdom): comprueba que todo texto entra por textContent.
function docFalso() {
  const crea = (tag) => ({ tag, children: [], className: '', _t: '', set textContent(v) { this._t = String(v); if (v === '') this.children = []; }, get textContent() { return this._t; }, appendChild(h) { this.children.push(h); return h; } });
  return { createElement: crea };
}
const textosDe = (n, acc = []) => { acc.push(n.textContent); n.children.forEach((h) => textosDe(h, acc)); return acc; };

test('R16: el itinerario se agrupa por operador y cementerio, con los nombres que se pasan; ningún botón lo aplica', () => {
  const doc = docFalso();
  const destino = doc.createElement('div');
  pintarItinerarios(doc, destino, RESP_OK.itinerarios, {
    nombreOperador: (u) => ({ uidA: 'Ana', uidB: 'Beto' })[u],
    nombreCementerio: (c) => ({ c1: 'Parque del Recuerdo', c2: 'Cementerio General' })[c],
    etiquetaSepultura: (id) => `Visita ${id}`,
  });
  const t = textosDe(destino);
  for (const esperado of ['Ana', 'Beto', 'Parque del Recuerdo', 'Cementerio General', 'Visita A-V1', 'Visita E-V1']) assert.ok(t.some((x) => x.includes(esperado)), esperado);
  const tags = []; const rec = (n) => { tags.push(n.tag); n.children.forEach(rec); }; rec(destino);
  assert.ok(!tags.includes('button') && !tags.includes('a') && !tags.includes('input'), 'solo texto: nada que aplique la sugerencia');
});

test('CA11: operador, cementerio o sepultura con HTML se ven como texto (solo textContent)', () => {
  const doc = docFalso();
  const destino = doc.createElement('div');
  const html = '<img src=x onerror=alert(1)>';
  pintarItinerarios(doc, destino, [{ operadorUid: 'uidA', cementerios: [{ cementerioId: 'c1', sepulturas: ['A-V1'] }] }], {
    nombreOperador: () => html, nombreCementerio: () => '<script>1</script>', etiquetaSepultura: () => html,
  });
  const t = textosDe(destino);
  assert.ok(t.includes(html));
  assert.ok(t.some((x) => x.includes('<script>1</script>')));
  assert.ok(!('innerHTML' in destino));
});

test('sin nombre conocido se muestra el identificador (nunca queda vacío)', () => {
  const doc = docFalso();
  const destino = doc.createElement('div');
  pintarItinerarios(doc, destino, [{ operadorUid: 'uidZ', cementerios: [{ cementerioId: 'cz', sepulturas: ['Z-V1'] }] }], {});
  const t = textosDe(destino);
  for (const id of ['uidZ', 'cz', 'Z-V1']) assert.ok(t.some((x) => x.includes(id)), id);
});

test('el módulo no escribe nada ni usa Firebase ni innerHTML; no toca rutas/{idCementerio} ni órdenes ni agenda', () => {
  const fuente = readFileSync(new URL('./ia-rutas.js', import.meta.url), 'utf8');
  assert.doesNotMatch(fuente, /firebase|setDoc|updateDoc|addDoc|deleteDoc|writeBatch|innerHTML|fetch\(|["'`]rutas["'`]/);
});
