// «Planificación Planes y Spot»: pruebas estáticas de integración con la app (portal, módulos compartidos, reglas de oro).
// No ejecutan la página. Ejecutar: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const lee = (p) => readFileSync(join(PUBLIC, p), 'utf8').replace(/\r/g, '');
const html = lee('planificacion-servicios.html');
const js = lee('js/planificacion-servicios.js');
const portal = lee('portal.html');

/** Rutas relativas importadas (`from "./js/x.js?v=1"` o `from './x.js'`), sin el `?v=`. */
function importsRelativos(src) {
  return [...src.matchAll(/from\s+["'](\.{1,2}\/[^"']+)["']/g)].map((m) => m[1].replace(/\?.*$/, ''));
}

test('todos los módulos que importa la página y su lógica existen en public/js (un import roto deja la pantalla en blanco)', () => {
  const desdePagina = importsRelativos(html).map((r) => join(PUBLIC, r));
  const desdeModulo = importsRelativos(js).map((r) => join(PUBLIC, 'js', r));
  assert.ok(desdePagina.length >= 7 && desdeModulo.length >= 4);
  for (const ruta of [...desdePagina, ...desdeModulo]) assert.ok(existsSync(ruta), `no existe ${ruta}`);
});

test('usa los módulos compartidos reales y con ?v= (no una copia vieja del navegador)', () => {
  assert.match(html, /from "\.\/js\/nombre-cliente\.js\?v=ops13"/);
  assert.match(html, /from "\.\/js\/servicio-terminado\.js\?v=ops13"/);
  assert.match(html, /from "\.\/js\/planificacion-servicios\.js\?v=ps1"/);
  assert.match(js, /from '\.\/fechas-visita\.js\?v=ps1'/);
  assert.match(js, /from '\.\/fechas-tentativas\.js\?v=ps1'/);
  assert.doesNotMatch(html, /\.\/js\/(contratos|visitas-estado)\.js/);
});

test('Firebase 10.7.0 como el resto de las pantallas, y la app se reutiliza si ya existe', () => {
  assert.match(html, /firebasejs\/10\.7\.0\/firebase-firestore\.js/);
  assert.doesNotMatch(html, /firebasejs\/(?!10\.7\.0)/);
  assert.match(html, /getApps\(\)\.length === 0 \? initializeApp\(FIREBASE_CONFIG\) : getApps\(\)\[0\]/);
});

test('los módulos compartidos se llaman con la forma que esperan', () => {
  // cargarContratos recibe una función que devuelve [id, datos]; crearIndiceInformes recibe pares [id, datos].
  assert.match(html, /cargarContratos\(async \(\) => \{/);
  assert.match(html, /l\.push\(\[c\.id, c\.data\(\)\]\)/);
  assert.match(html, /entradas\.push\(\[i\.id, i\.data\(\)\]\)/);
  assert.doesNotMatch(html, /crearIndiceInformes\([^)]*\.docs/);
});

test('las lecturas auxiliares (contratos, informes, staff) no tumban la pantalla si fallan', () => {
  assert.match(html, /async function leerIndiceInformes\(\) \{\s*try \{/);
  assert.match(html, /async function leerOperadores\(\) \{\s*const nombres = \[\];\s*try \{/);
  assert.match(html, /<button type="button" id="btn-reintentar"/);
});

test('exige staff antes de cargar datos y filtra las órdenes pagadas antes de listarlas', () => {
  const iObs = html.search(/onAuthStateChanged\(auth,\s*async\s*\(/);
  const iGate = html.indexOf('if (!(await exigirStaff(auth, ', iObs);
  const iCarga = html.indexOf('await cargarDatos();', iGate);
  assert.ok(iObs > 0 && iGate > iObs && iCarga > iGate);
  const iFiltro = html.indexOf('if (!esOrdenPagada(ord)) return;');
  const iPush = html.indexOf('ordenesPagadas.push(', iFiltro);
  assert.ok(iFiltro > 0 && iPush > iFiltro);
  assert.equal(html.split('getDocs(collection(db, "ordenes"))').length - 1, 1);
});

test('es de solo lectura: ninguna escritura y nunca fechasProgramadas', () => {
  assert.doesNotMatch(html, /\b(updateDoc|setDoc|addDoc|deleteDoc|writeBatch|runTransaction)\b/);
  assert.doesNotMatch(html + js, /fechasProgramadas/);
  assert.doesNotMatch(js, /construirActualizacionFecha|guardarFechaVisitaEnOrden/);
});

test('no inventa datos: ni «Plan 4» por defecto, ni datos de relleno, ni claves en el código', () => {
  assert.doesNotMatch(html + js, /Plan 4/);
  assert.doesNotMatch(html + js, /Tulio Santana|Padre Hurtado/);
  assert.doesNotMatch(html + js, /AIza[0-9A-Za-z_-]{30,}/);
  assert.match(js, /Sin fecha programada/);
  assert.match(js, /Sin fecha del cliente/);
});

test('la fecha tentativa se lee de la propiedad real del módulo de fechas (`tentativa`), no de una inventada', () => {
  assert.match(js, /r\.tentativa/);
  assert.doesNotMatch(js, /origen|esTentativa\s*===/);
});

test('los datos de Firestore se escapan con esc() y no hay manejadores inline con datos', () => {
  assert.match(html, /import \{ esc \} from "\.\/js\/html-seguro\.js"/);
  for (const campo of ['f.cliente', 'f.serQuerido', 'f.numeroOrden', 'f.plan', 'f.cementerio', 'f.operador', 'f.estado', 'f.fechaTexto']) {
    assert.ok(html.includes('${esc(' + campo + ')}'), `falta esc(${campo})`);
  }
  assert.doesNotMatch(html, /onclick=/);
});

test('las órdenes de prueba (integración) llevan la insignia PRUEBA en ambas tablas', () => {
  assert.match(html, /import \{ esOrdenPagada, INSIGNIA_PRUEBA \} from "\.\/js\/orden-pagada\.js"/);
  assert.equal(html.split('${f.esPrueba ? INSIGNIA_PRUEBA : ""}').length - 1, 2);
});

test('las dos subpestañas existen y Planes es la inicial', () => {
  assert.match(html, /id="tab-planes"[^>]*aria-selected="true"/);
  assert.match(html, /id="tab-spot"[^>]*aria-selected="false"/);
  assert.match(html, /id="panel-planes"/);
  assert.match(html, /id="panel-spot"/);
  assert.match(html, /let pestanaActiva = "planes"/);
});

test('mismo aspecto que las demás pantallas: tipografía, fondo y componentes de la Gantt', () => {
  assert.match(html, /font-family: 'Plus Jakarta Sans'/);
  assert.match(html, /background: #f8faf8/);
  assert.match(html, /bg-\[#002d1a\] text-white shadow-sm/);
});

test('portal.html: botón solo para administradores y título del módulo', () => {
  assert.match(portal, /<li class="admin-only" style="display: none;">\s*<button class="nav-btn" id="btn-planificacion-servicios" onclick="cargarModulo\('planificacion-servicios'\)">/);
  assert.match(portal, /"planificacion-servicios": \{ title: "Planificación Planes y Spot", icon: "fa-solid fa-calendar-check" \}/);
  // el resto del menú sigue ahí
  for (const id of ['btn-planificacion', 'btn-ordenes', 'btn-clientes', 'btn-mis-trabajos']) assert.ok(portal.includes(`id="${id}"`));
});

test('la pantalla existente «Planificación & Gantt» no se tocó', () => {
  const gantt = lee('planificacion.html');
  assert.ok(!gantt.includes('planificacion-servicios'));
});
