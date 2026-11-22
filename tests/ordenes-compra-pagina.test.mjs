// «Órdenes de compra» (spec 055): pruebas estáticas de la página nueva y de su registro en el portal (reglas de oro del backoffice).
// No ejecutan la página. Ejecutar: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(RAIZ, 'public');
const lee = (p) => readFileSync(join(PUBLIC, p), 'utf8').replace(/\r/g, '');
const html = lee('ordenes-compra.html');
const portal = lee('portal.html');
const NUEVOS = ['js/ordenes-compra.js', 'js/ordenes-compra-db.js', 'js/ordenes-compra-vistas.js'];

function importsRelativos(src) {
  return [...src.matchAll(/from\s+["'](\.{1,2}\/[^"']+)["']/g)].map((m) => m[1].replace(/\?.*$/, ''));
}

test('todos los módulos que importa la página existen (un import roto deja la pantalla en blanco)', () => {
  const desdePagina = importsRelativos(html).map((r) => join(PUBLIC, r));
  assert.ok(desdePagina.length >= 7);
  for (const ruta of desdePagina) assert.ok(existsSync(ruta), `no existe ${ruta}`);
  for (const n of NUEVOS) for (const r of importsRelativos(lee(n))) assert.ok(existsSync(join(PUBLIC, 'js', r)), `${n}: no existe ${r}`);
});

test('exige el claim de staff antes de cargar nada (B-13) y los módulos nuevos van con ?v=', () => {
  assert.match(html, /import \{ exigirStaff \} from "\.\/js\/acceso-staff\.js"/);
  const iObs = html.search(/onAuthStateChanged\(auth,\s*async\s*\(/);
  const iGate = html.indexOf('if (!(await exigirStaff(auth, ', iObs);
  assert.ok(iObs > 0 && iGate > iObs);
  assert.ok(iGate - iObs < html.slice(iObs).search(/\bcargarDatos\(/), 'la barrera precede a la carga de datos');
  for (const m of ['ordenes-compra.js', 'ordenes-compra-db.js', 'ordenes-compra-vistas.js']) assert.match(html, new RegExp(`from "\\./js/${m.replace(/\./g, '\\.')}\\?v=oc1"`));
});

test('dos pestañas, «Órdenes de compra» y «Maestro de materiales», y un encabezado con el nombre de la pantalla', () => {
  assert.match(html, /<title>Órdenes de compra \| GraveCare Ops<\/title>/);
  assert.match(html, /<h1[^>]*>Órdenes de compra<\/h1>/);
  const boton = (id) => html.slice(html.indexOf(`id="tab-${id}"`), html.indexOf('</button>', html.indexOf(`id="tab-${id}"`)));
  assert.match(boton('ordenes'), /Órdenes de compra/);
  assert.match(boton('materiales'), /Maestro de materiales/);
  assert.ok(html.indexOf('id="tab-ordenes"') < html.indexOf('id="tab-materiales"'));
  assert.match(html, /const PESTANAS = \["ordenes", "materiales"\];/);
});

test('las escrituras son solo transacciones en materiales, ordenesCompra y contadores: sin setDoc, borrados ni otras colecciones', () => {
  assert.match(html, /runTransaction/);
  assert.match(html, /ejecutarTransaccion: \(fn\) => runTransaction\(db, fn\)/);
  for (const prohibido of ['setDoc', 'deleteDoc', 'updateDoc', 'addDoc', 'writeBatch']) assert.ok(!html.includes(prohibido), prohibido);
  const colecciones = [...html.matchAll(/(?:collection|doc)\(db,\s*([^,)]+)/g)].map((m) => m[1].trim());
  assert.ok(colecciones.length >= 4);
  for (const c of colecciones) assert.ok(['COLECCION_MATERIALES', 'COLECCION_ORDENES', 'COLECCION_CONTADORES', 'coleccion', '"staff"', '...RUTA_VALORES'].includes(c), `colección inesperada: ${c}`);
  assert.ok(!/\b(valores_ramos|gastos_ingresos|comprobantes_tributarios|rutas|feriados)\b/.test(html.replace(/RUTA_VALORES/g, '')), 'no toca otras colecciones');
});

test('nada se borra en los módulos nuevos: se retira con activo:false y una orden solo se anula', () => {
  for (const n of NUEVOS) {
    const src = lee(n);
    assert.ok(!/\b(deleteDoc|\.delete\()/.test(src), `${n} no debe borrar`);
  }
  assert.match(lee('js/ordenes-compra-db.js'), /Anulada/);
  assert.match(lee('js/ordenes-compra-db.js'), /activo/);
});

test('maestro: formulario de código, descripción, tipo, unidad y precio, con editar, retirar y reactivar', () => {
  for (const id of ['tbody-materiales', 'material-codigo', 'material-descripcion', 'material-tipo', 'material-unidad', 'material-precio', 'btn-guardar-material', 'btn-cancelar-material', 'aviso-material']) assert.match(html, new RegExp(`id="${id}"`), id);
  const select = html.slice(html.indexOf('id="material-tipo"'), html.indexOf('</select>', html.indexOf('id="material-tipo"')));
  for (const t of ['Insumo', 'Arreglo floral', 'Servicio']) assert.match(select, new RegExp(`value="${t}"`));
  assert.match(html, /crearMaterial\(/);
  assert.match(html, /actualizarMaterial\(/);
  assert.match(html, /editar-material/);
});

test('órdenes: proveedor, condiciones de pago, líneas por código y cantidad, totales, emitir, ver/imprimir y anular', () => {
  for (const id of ['oc-fecha', 'oc-entrega', 'oc-razon', 'oc-rut', 'oc-contacto', 'oc-telefono', 'oc-direccion', 'oc-condiciones', 'oc-lugar', 'oc-codigo', 'oc-cantidad', 'btn-agregar-linea', 'tbody-lineas', 'oc-totales', 'btn-emitir', 'tbody-ordenes', 'aviso-oc', 'zona-impresion', 'btn-imprimir', 'modal-oc']) assert.match(html, new RegExp(`id="${id}"`), id);
  const select = html.slice(html.indexOf('id="oc-condiciones"'), html.indexOf('</select>', html.indexOf('id="oc-condiciones"')));
  for (const c of ['Transferencia', 'Factura a 30 días', 'Contado', 'Otro']) assert.match(select, new RegExp(`value="${c}"`));
  for (const f of ['validarLinea(', 'calcularTotales(', 'emitirOrden(', 'anularOrden(', 'htmlImpresion(', 'window.print()']) assert.ok(html.includes(f), f);
});

test('anular está reservado al dueño (staff/{uid}.dueno === true); las reglas de Firestore siguen siendo la barrera real', () => {
  assert.match(html, /doc\(db, "staff", user\.uid\)/);
  assert.match(html, /\.dueno === true/);
  assert.match(html, /puedeAnular/);
  assert.match(html, /confirm\(/);
});

test('al imprimir solo sale la orden: el resto de la pantalla se oculta con @media print', () => {
  assert.match(html, /@media print/);
  assert.match(html, /#zona-impresion/);
});

test('sin datos escritos en el código: ni materiales, ni proveedores, ni precios (los carga el staff)', () => {
  const fuentes = [html, ...NUEVOS.map(lee)].join('\n').replace(/placeholder="[^"]*"/g, '').replace(/\(por ejemplo [^)]*\)/g, '');
  assert.ok(!/INS-0\d\d|Flores del Sur|Tijeras|Papel de envolver/.test(fuentes.replace(/\/\/.*$/gm, '')), 'hay un dato de ejemplo escrito');
});

test('si falla una lectura o una escritura, la pantalla avisa con un texto claro (no se queda en blanco ni en silencio)', () => {
  assert.match(html, /id="aviso-error"/);
  assert.match(html, /id="btn-reintentar"/);
  assert.match(html, /textoErrorOC\(/);
  assert.match(html, /textoErrorCarga\(/); // una lectura fallida no dice «no se guardó»
  assert.match(html, /\.disabled = true/); // evita doble clic mientras guarda
  assert.match(html, /finally/);
  assert.match(html, /cargaFallo = true;/);
  assert.match(html, /p !== pestanaActiva \|\| cargaFallo/);
});

test('AUD-01: lo que viene de Firestore pasa por las vistas escapadas; la página no arma HTML con datos sin esc()', () => {
  for (const f of ['htmlFilasMateriales(', 'htmlFilasOrdenes(', 'htmlLineasBorrador(', 'htmlTotales(']) assert.ok(html.includes(f), f);
  assert.match(html, /import \{ esc \} from "\.\/js\/html-seguro\.js"/);
});

test('registro en el portal: opción de menú, título del módulo y sin tocar el resto del menú', () => {
  assert.match(portal, /<li class="admin-only" style="display: none;">\s*<button class="nav-btn" id="btn-ordenes-compra" onclick="cargarModulo\('ordenes-compra'\)">\s*<i class="[^"]+"><\/i> Órdenes de compra\s*<\/button>\s*<\/li>/);
  assert.match(portal, /"ordenes-compra": \{ title: "Órdenes de compra", icon: "[^"]+" \}/);
  assert.match(portal, /"rutas-feriados": \{ title: "Rutas y feriados", icon: "[^"]+" \}/);
  assert.match(portal, /id="btn-admin-usuarios" onclick="cargarModulo\('admin-usuarios'\)"/);
  assert.ok(portal.indexOf('btn-rutas-feriados') < portal.indexOf('btn-ordenes-compra'));
});

test('no se tocan reglas ni firebase.json: este repo solo publica Hosting; las reglas propuestas van en un documento aparte', () => {
  const firebaseJson = readFileSync(join(RAIZ, 'firebase.json'), 'utf8');
  assert.ok(!/firestore|storage/i.test(firebaseJson));
  assert.ok(existsSync(join(RAIZ, 'docs', 'referencia', 'reglas-propuestas-055.md')));
});
