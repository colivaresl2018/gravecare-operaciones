// «Rutas y feriados»: pruebas estáticas de la página nueva y de su registro en el portal (reglas de oro del backoffice).
// No ejecutan la página. Ejecutar: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const lee = (p) => readFileSync(join(PUBLIC, p), 'utf8').replace(/\r/g, '');
const html = lee('rutas-feriados.html');
const portal = lee('portal.html');
const NUEVOS = ['js/config-planificacion.js', 'js/config-planificacion-db.js', 'js/config-vistas.js'];

function importsRelativos(src) {
  return [...src.matchAll(/from\s+["'](\.{1,2}\/[^"']+)["']/g)].map((m) => m[1].replace(/\?.*$/, ''));
}

test('todos los módulos que importa la página existen (un import roto deja la pantalla en blanco)', () => {
  const desdePagina = importsRelativos(html).map((r) => join(PUBLIC, r));
  assert.ok(desdePagina.length >= 6);
  for (const ruta of desdePagina) assert.ok(existsSync(ruta), `no existe ${ruta}`);
  for (const n of NUEVOS) for (const r of importsRelativos(lee(n))) assert.ok(existsSync(join(PUBLIC, 'js', r)), `${n}: no existe ${r}`);
});

test('exige el claim de staff antes de cargar nada (B-13) y los módulos compartidos van con ?v=', () => {
  assert.match(html, /import \{ exigirStaff \} from "\.\/js\/acceso-staff\.js"/);
  const iObs = html.search(/onAuthStateChanged\(auth,\s*async\s*\(/);
  const iGate = html.indexOf('if (!(await exigirStaff(auth, ', iObs);
  assert.ok(iObs > 0 && iGate > iObs);
  assert.ok(iGate - iObs < html.slice(iObs).search(/\bcargarDatos\(/), 'la barrera precede a la carga de datos');
  for (const m of ['config-planificacion.js', 'config-planificacion-db.js', 'config-vistas.js']) assert.match(html, new RegExp(`from "\\./js/${m.replace('.', '\\.')}\\?v=cfg1"`));
});

test('dos pestañas, «Rutas por cementerio» y «Feriados», y un encabezado con el nombre de la pantalla', () => {
  assert.match(html, /<title>Rutas y feriados \| GraveCare Ops<\/title>/);
  assert.match(html, /<h1[^>]*>Rutas y feriados<\/h1>/);
  const boton = (id) => html.slice(html.indexOf(`id="tab-${id}"`), html.indexOf('</button>', html.indexOf(`id="tab-${id}"`)));
  assert.match(boton('rutas'), /Rutas por cementerio/);
  assert.match(boton('feriados'), /Feriados/);
  assert.ok(html.indexOf('id="tab-rutas"') < html.indexOf('id="tab-feriados"'));
  assert.match(html, /const PESTANAS = \["rutas", "feriados"\];/);
});

test('las únicas escrituras son setDoc en rutas y feriados: no hay borrados ni otras colecciones', () => {
  const usos = [...html.matchAll(/\bsetDoc\b/g)].length;
  assert.equal(usos, 3, 'setDoc: el import y las dos inyecciones (rutas y feriados) como `guardar`');
  assert.match(html, /guardar: setDoc/);
  for (const prohibido of ['deleteDoc', 'updateDoc', 'addDoc', 'writeBatch', 'runTransaction']) assert.ok(!html.includes(prohibido), prohibido);
  const colecciones = [...html.matchAll(/(?:collection|doc)\(db,\s*([^,)]+)/g)].map((m) => m[1].trim());
  for (const c of colecciones) assert.ok(['COLECCION_RUTAS', 'COLECCION_FERIADOS', 'coleccion', '"staff"', '"ordenes"'].includes(c), `colección inesperada: ${c}`);
  assert.ok(!/\b(materiales|ordenesCompra|contadores|valores_ramos|gastos_ingresos|comprobantes_tributarios)\b/.test(html));
});

test('nada se borra en los módulos nuevos: «quitar» marca activo:false', () => {
  for (const n of NUEVOS) {
    const src = lee(n);
    assert.ok(!/\b(deleteDoc|delete\()/.test(src), `${n} no debe borrar`);
  }
  assert.match(lee('js/config-planificacion-db.js'), /activo/);
});

test('los permisos se leen del perfil de staff y mandan sobre los botones; las reglas de Firestore siguen siendo la barrera real', () => {
  assert.match(html, /doc\(db, "staff", user\.uid\)/);
  assert.match(html, /permisosDeStaff\(/);
  assert.match(html, /id="aviso-permisos-rutas"/);
  assert.match(html, /id="aviso-permisos-feriados"/);
  assert.match(html, /dueño/i);
  assert.match(html, /administrador/i);
});

test('pestaña de rutas: tabla, formulario de eje y día de lunes a viernes, y carga de varios cementerios a la vez', () => {
  for (const id of ['tbody-rutas', 'resumen-rutas', 'ruta-eje', 'ruta-dia', 'btn-asignar-ruta', 'btn-marcar-sin-ruta', 'ruta-cementerio-otro', 'resultado-rutas']) assert.match(html, new RegExp(`id="${id}"`), id);
  const select = html.slice(html.indexOf('id="ruta-dia"'), html.indexOf('</select>', html.indexOf('id="ruta-dia"')));
  for (const [n, dia] of [[1, 'Lunes'], [2, 'Martes'], [3, 'Miércoles'], [4, 'Jueves'], [5, 'Viernes']]) assert.match(select, new RegExp(`value="${n}"[^>]*>${dia}<`));
  assert.ok(!/value="6"|value="7"/.test(select), 'sin sábado ni domingo');
  assert.match(html, /prepararLoteRutas\(/);
  assert.match(html, /guardarRutasEnLote\(/);
});

test('pestaña de feriados: formulario de uno, carga de una lista pegada, tabla y avisos de líneas con problemas', () => {
  for (const id of ['tbody-feriados', 'feriado-fecha', 'feriado-nombre', 'feriado-alcance', 'btn-guardar-feriado', 'feriados-texto', 'btn-cargar-feriados', 'errores-feriados', 'resultado-feriados']) assert.match(html, new RegExp(`id="${id}"`), id);
  assert.match(html, /parsearFeriados\(/);
  assert.match(html, /guardarFeriados\(/);
  assert.match(html, /guardarFeriado\(/);
  const select = html.slice(html.indexOf('id="feriado-alcance"'), html.indexOf('</select>', html.indexOf('id="feriado-alcance"')));
  assert.match(select, /value="nacional"/);
  assert.match(select, /value="regional"/);
});

test('sin datos escritos en el código: ni ejes, ni días por cementerio, ni feriados (los carga el dueño o el administrador)', () => {
  const fuentes = [html, ...NUEVOS.map(lee)].join('\n');
  assert.ok(!/Eje (Santiago|Rancagua|Norte|Sur|Poniente|Oriente|Centro)/i.test(fuentes.replace(/placeholder="[^"]*"/g, '')), 'hay un eje escrito');
  assert.ok(!/Navidad|Año Nuevo|Inmaculada|Viernes Santo|Independencia/.test(fuentes.replace(/placeholder="[^"]*"/g, '')), 'hay un feriado escrito');
  assert.ok(!/(Parque Canaán|Cementerio General de|Parque Sendero|Parque del Recuerdo)/.test(fuentes.replace(/placeholder="[^"]*"/g, '')), 'hay un cementerio escrito');
});

test('si falla una lectura o una escritura, la pantalla avisa con un texto claro (no se queda en blanco ni en silencio)', () => {
  assert.match(html, /id="aviso-error"/);
  assert.match(html, /id="btn-reintentar"/);
  assert.match(html, /textoErrorGuardar\(/);
  assert.match(html, /\.disabled = true/); // evita doble clic mientras guarda
  assert.match(html, /finally/);
  assert.match(html, /cargaFallo = true;/); // con la carga fallida se ve solo el aviso con «Reintentar», no un panel vacío
  assert.match(html, /p !== pestanaActiva \|\| cargaFallo/);
});

test('AUD-01: lo que viene de Firestore pasa por las vistas escapadas; la página no arma HTML con datos sin esc()', () => {
  assert.match(html, /htmlFilasRutas\(/);
  assert.match(html, /htmlFilasFeriados\(/);
  assert.match(html, /htmlResultadosGuardado\(/);
  assert.match(html, /import \{ esc \} from "\.\/js\/html-seguro\.js"/);
});

test('registro en el portal: opción de menú solo para quien no es operador, título del módulo y sin tocar el resto del menú', () => {
  assert.match(portal, /<li class="admin-only" style="display: none;">\s*<button class="nav-btn" id="btn-rutas-feriados" onclick="cargarModulo\('rutas-feriados'\)">\s*<i class="[^"]+"><\/i> Rutas y feriados\s*<\/button>\s*<\/li>/);
  assert.match(portal, /"rutas-feriados": \{ title: "Rutas y feriados", icon: "[^"]+" \}/);
  // el menú de planificación y los demás módulos siguen igual
  assert.match(portal, /"planificacion-servicios": \{ title: "Planificación Planes y Spot", icon: "fa-solid fa-calendar-check" \}/);
  assert.match(portal, /id="btn-admin-usuarios" onclick="cargarModulo\('admin-usuarios'\)"/);
  assert.ok(portal.indexOf('btn-planificacion-servicios') < portal.indexOf('btn-rutas-feriados'));
});

test('no se tocan reglas ni firebase.json: este repo solo publica Hosting', () => {
  const firebaseJson = readFileSync(join(PUBLIC, '..', 'firebase.json'), 'utf8');
  assert.ok(!/firestore|storage/i.test(firebaseJson));
});
