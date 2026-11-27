// Spec 082 etapa 3: planificacion-servicios.html con «Sugerir rutas con IA» (solo dueño). Aditivo: lo existente no cambia.
// Pruebas estáticas de integración (no ejecutan la página). La lógica está en public/js/ia-rutas.test.mjs.
// Ejecutar: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AVISO_IA } from '../public/js/ia-informe.js';

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const html = readFileSync(join(PUBLIC, 'planificacion-servicios.html'), 'utf8').replace(/\r/g, '');
const script = html.slice(html.indexOf('<script type="module">'));
const corte = (inicio) => {
  const i = script.indexOf(inicio);
  return i >= 0 ? script.slice(i, script.indexOf('\n    }\n', i)) : '';
};
const manejador = corte('async function sugerirRutasConIA');
const relectura = corte('async function verUltimaSugerencia');
const preparar = corte('function prepararRutasIA');

test('importa el módulo (con ?v=) y carga el SDK de Functions solo al pulsar el botón', () => {
  assert.match(script, /from "\.\/js\/ia-rutas\.js\?v=ia3"/);
  assert.match(manejador, /await import\("https:\/\/www\.gstatic\.com\/firebasejs\/10\.7\.0\/firebase-functions\.js"\)/);
  assert.match(manejador, /httpsCallable\(getFunctions\(app, "us-central1"\), FUNCION_RUTAS\)/);
  assert.doesNotMatch(script, /^\s*import [^\n]*firebase-functions\.js/m, 'ningún import estático: si no carga, solo falla la IA (R6)');
});

test('el bloque tiene sus controles, el aviso exacto y empieza oculto (solo se muestra al dueño)', () => {
  for (const id of ['rir-bloque', 'rir-fecha', 'rir-pendientes', 'rir-operadores', 'rir-btn', 'rir-leer', 'rir-error', 'rir-resultado', 'rir-resumen', 'rir-detalle']) {
    assert.match(html, new RegExp(`id="${id}"`), id);
  }
  assert.match(html, /<input type="date" id="rir-fecha"/);
  assert.ok(html.includes(AVISO_IA), 'aviso R5');
  assert.ok(html.includes('Sugerir rutas'), 'CA8: el texto del botón');
  assert.match(html, /<[a-z]+ id="rir-bloque"[^>]*class="[^"]*\bhidden\b/, 'CA8: oculto por defecto');
});

test('CA8: solo el dueño ve el bloque (esDueno del perfil) y el mismo valor se pasa a la función de la lógica', () => {
  assert.match(script, /esDuenoUsuario = esDueno\(perfil\)/);
  assert.match(preparar, /classList\.toggle\("hidden", !esDuenoUsuario\)/);
  assert.match(manejador, /dueno: esDuenoUsuario/);
  assert.match(manejador, /if \(rutasIAEnCurso\) return/);
});

test('R15: la solicitud sale de las filas ya cargadas (Planes y Spot) y de los operadores elegidos; sin lecturas nuevas ni nombres de clientes', () => {
  assert.match(manejador, /sepulturasPendientes\(\[\.\.\.filasPlanes, \.\.\.filasSpot\], fecha\)/);
  assert.match(manejador, /operadoresElegidos\(\)/);
  assert.match(manejador, /solicitarRutas\(\{/);
  assert.doesNotMatch(manejador, /getDocs|getDoc\(|collection\(/);
});

test('mientras responde el botón queda deshabilitado (una sola llamada) y se vuelve a habilitar siempre', () => {
  const bloqueo = corte('function bloquearRutasIA');
  assert.match(bloqueo, /rutasIAEnCurso = enCurso/);
  assert.match(bloqueo, /\$\("rir-btn"\)\.disabled = enCurso/);
  assert.match(bloqueo, /\$\("rir-leer"\)\.disabled = enCurso/);
  for (const m of [manejador, relectura]) {
    assert.match(m, /if \(rutasIAEnCurso\) return/);
    assert.match(m, /bloquearRutasIA\(true\)/);
    assert.match(m, /finally \{\s*bloquearRutasIA\(false\)/);
  }
});

test('R16: el itinerario y la relectura se pintan con el módulo (textContent); ningún innerHTML', () => {
  const mostrar = corte('function mostrarSugerenciaRutas');
  assert.match(mostrar, /pintarItinerarios\(document, \$\("rir-detalle"\)/);
  assert.match(manejador, /mostrarSugerenciaRutas\(r\.itinerarios/);
  assert.match(relectura, /mostrarSugerenciaRutas\(r\.itinerarios/);
  assert.match(relectura, /leerSugerencia\(\{/);
  assert.match(relectura, /getDoc\(doc\(db, "rutasSugeridas", /);
  assert.doesNotMatch(manejador + relectura + preparar + mostrar, /innerHTML/);
});

test('R16: la sugerencia es informativa: ni la llamada ni la relectura escriben en Firestore ni cambian órdenes, agenda o rutas', () => {
  const todo = manejador + relectura + preparar;
  assert.doesNotMatch(todo, /\b(setDoc|updateDoc|addDoc|deleteDoc|runTransaction|writeBatch|guardarCambioFecha|guardarCambioOperador|aplicarCambioEnOrden|crearBorradorDia|guardarValoresRamos)\b/);
  assert.doesNotMatch(todo, /doc\(db, "(rutas|ordenes|staff|feriados)"/);
});

test('el bloque se oculta si la carga falla y se prepara tras pintar (también tras editar una visita)', () => {
  assert.match(script, /function pintarTodo\(\) \{[\s\S]*?prepararRutasIA\(\);/);
  assert.match(script, /\$\("rir-btn"\)\.addEventListener\("click", \(\) => sugerirRutasConIA\(\)\)/);
  assert.match(script, /\$\("rir-leer"\)\.addEventListener\("click", \(\) => verUltimaSugerencia\(\)\)/);
  assert.match(script, /\$\("rir-fecha"\)\.addEventListener\("change"/);
});

test('lo existente se conserva: pestañas, edición de visitas (085) y su única forma de escribir', () => {
  for (const t of ['id="tab-planes"', 'id="tab-spot"', 'id="tab-compra"', 'id="th-acciones-planes"', 'id="th-acciones-spot"', 'abrirEdicion(', 'guardarCambioFecha', 'guardarCambioOperador']) {
    assert.ok(html.includes(t), t);
  }
  assert.doesNotMatch(html, /AIza[0-9A-Za-z_-]{20,}/);
});
