// Spec 085 / B7, etapa 1: «Planificación Planes» permite cambiar la fecha y asignar el operador de UNA visita (dueño y administrador).
// Pruebas estáticas de integración: no ejecutan la página. La lógica está en public/js/planificacion-edicion*.test.mjs.
// Ejecutar: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const lee = (p) => readFileSync(join(PUBLIC, p), 'utf8').replace(/\r/g, '');
const html = lee('planificacion-servicios.html');
const script = html.slice(html.indexOf('<script type="module">'));

test('importa los módulos de edición (con ?v=) y existen en public/js', () => {
  assert.match(script, /from "\.\/js\/planificacion-edicion\.js\?v=085"/);
  assert.match(script, /from "\.\/js\/planificacion-edicion-db\.js\?v=085"/);
  for (const m of ['planificacion-edicion', 'planificacion-edicion-db']) assert.ok(existsSync(join(PUBLIC, 'js', `${m}.js`)), m);
});

test('D1: solo el dueño y el administrador ven los controles; el perfil sale de staff/{uid} y la columna «Acciones» está oculta por defecto', () => {
  assert.match(script, /getDoc\(doc\(db, "staff", user\.uid\)\)/);
  assert.match(script, /puedeEditar = puedeEditarPlanificacion\(/);
  assert.match(html, /<th id="th-acciones-planes" class="hidden /);
  assert.match(script, /\$\("th-acciones-planes"\)\.classList\.toggle\("hidden", !puedeEditar\)/);
  // el botón solo existe si puede editar Y la visita se puede editar (no realizada ni aprobada)
  assert.match(script, /function celdaAcciones\(f\)/);
  const c = script.slice(script.indexOf('function celdaAcciones'), script.indexOf('function renderPlanes'));
  assert.match(c, /if \(!puedeEditar\) return ""/);
  assert.match(c, /visitaEditable\(f\)/);
  assert.match(c, /data-accion="editar-visita"/);
});

test('solo la tabla de Planes tiene la columna «Acciones» (la etapa 2 hará Spot): la de Spot no cambia', () => {
  const spot = html.slice(html.indexOf('id="panel-spot"'), html.indexOf('id="panel-matriz-planes"'));
  assert.doesNotMatch(spot, /Acciones/);
  const renderSpot = script.slice(script.indexOf('function renderSpot'), script.indexOf('// ----', script.indexOf('function renderSpot')));
  assert.doesNotMatch(renderSpot, /celdaAcciones|editar-visita/);
  assert.match(script, /colspan="\$\{puedeEditar \? 13 : 12\}"/);
});

test('el modal de edición tiene fecha, operador, confirmación y error, y se cierra con ×, clic fuera y Escape', () => {
  for (const id of ['modal-edicion', 'edicion-titulo', 'edicion-fecha', 'edicion-guardar-fecha', 'edicion-operador', 'edicion-guardar-operador', 'edicion-confirmacion', 'edicion-confirmar', 'edicion-volver', 'edicion-avisos', 'edicion-error', 'edicion-cerrar', 'aviso-edicion']) {
    assert.match(html, new RegExp(`id="${id}"`), id);
  }
  assert.match(html, /<input type="date" id="edicion-fecha"/);
  assert.match(script, /\$\("edicion-cerrar"\)\.addEventListener\("click", cerrarEdicion\)/);
  assert.match(script, /e\.target === \$\("modal-edicion"\)/);
  assert.match(script, /e\.key === "Escape"[^\n]*cerrarEdicion\(\)|cerrarEdicion\(\);[^\n]*Escape|Escape[^\n]*\n[^\n]*cerrarEdicion/);
});

test('escribe SOLO con los módulos de edición: un updateDoc inyectado, sin setDoc nuevo ni claves de mapas en la página', () => {
  assert.equal([...script.matchAll(/\bguardarCambioFecha\(/g)].length, 1);
  assert.equal([...script.matchAll(/\bguardarCambioOperador\(/g)].length, 1);
  assert.equal([...script.matchAll(/\bactualizar: updateDoc\b/g)].length, 1, 'updateDoc se inyecta una sola vez');
  assert.equal([...script.matchAll(/\bupdateDoc\b/g)].length, 2, 'el import y la inyección');
  assert.doesNotMatch(script, /\b(addDoc|deleteDoc|writeBatch)\b/);
  assert.doesNotMatch(script, /fechasPorVisita|operadoresPorVisita|fechasProgramadas|proximaVisita|fechaProgramada/);
  // la referencia apunta a ordenes/{id}
  assert.match(script, /referencia: \(id\) => doc\(db, "ordenes", id\)/);
});

test('D3: antes de escribir se pide confirmación («anterior → nuevo»); los avisos no bloquean y los errores sí', () => {
  assert.match(script, /validarCambioFecha\(\{/);
  assert.match(script, /validarCambioOperador\(\{/);
  assert.match(script, /confirmacionFecha\(/);
  assert.match(script, /confirmacionOperador\(/);
  assert.match(script, /fechaPagoDeOrden\(/);
  assert.match(script, /opcionesOperador\(docsStaff, \{ actual: /);
});

test('si el guardado falla, la fila queda como estaba y se avisa; si sale bien, se refresca sin recargar y se conservan los filtros', () => {
  const i = script.indexOf('async function confirmarEdicion');
  assert.ok(i > 0, 'existe confirmarEdicion');
  const cuerpo = script.slice(i, script.indexOf('\n    }\n', i));
  assert.match(cuerpo, /edicionEnCurso = true/);
  assert.match(cuerpo, /finally/);
  assert.match(cuerpo, /edicionEnCurso = false/);
  // aplicar el cambio local y repintar solo ocurre DESPUÉS de que el guardado terminó bien
  const iGuardar = cuerpo.search(/await (guardarCambioFecha|guardarCambioOperador)\(/);
  const iAplicar = cuerpo.indexOf('aplicarCambioEnOrden(');
  assert.ok(iGuardar > 0 && iAplicar > iGuardar, 'aplica el cambio local después del guardado');
  assert.match(cuerpo, /catch \(e\)/);
  assert.match(cuerpo, /No se pudo guardar el cambio/);
  assert.match(cuerpo, /reconstruirFilas\(\)/);
  // no se recarga la página ni se vuelve a leer todo
  assert.doesNotMatch(cuerpo, /location\.reload|cargarDatos\(/);
});

test('cargarDatos guarda lo necesario para reconstruir las filas y se refactorizó sin cambiar lo que pinta', () => {
  assert.match(script, /function reconstruirFilas\(\)/);
  assert.match(script, /function pintarTodo\(\)/);
  assert.match(script, /let docsStaff = \[\]/);
  for (const r of ['renderPlanes()', 'renderSpot()', 'renderMatrizPlanes()', 'renderMatrizSpot()', 'renderResumen()', 'renderCompra()']) {
    const p = script.slice(script.indexOf('function pintarTodo'), script.indexOf('async function cargarDatos'));
    assert.ok(p.includes(r), r);
  }
  // sigue habiendo una sola lectura de órdenes y el filtro de órdenes pagadas
  assert.equal(script.split('getDocs(collection(db, "ordenes"))').length - 1, 1);
  assert.match(script, /if \(!esOrdenPagada\(ord\)\) return;/);
});

test('texto de las alertas en español y sin datos de Firestore sin escapar en el modal', () => {
  const m = script.slice(script.indexOf('function abrirEdicion'), script.indexOf('function cerrarEdicion'));
  assert.ok(m.length > 0);
  for (const l of m.split('\n').filter((x) => /innerHTML/.test(x))) assert.match(l, /esc\(/, l);
  assert.doesNotMatch(m, /reprogramar/i);
});

test('sin claves y lo existente se conserva: pestañas, filtros, matrices, compra y valores', () => {
  for (const t of ['id="panel-planes"', 'id="panel-spot"', 'id="tbody-planes"', 'id="tbody-spot"', 'Fecha de la visita', 'Fecha elegida por el cliente', 'crearBorradorDia(', 'guardarValoresRamos(', 'exigirStaff(auth, user)']) {
    assert.ok(html.includes(t), t);
  }
  assert.doesNotMatch(html, /AIza[0-9A-Za-z_-]{20,}/);
});
