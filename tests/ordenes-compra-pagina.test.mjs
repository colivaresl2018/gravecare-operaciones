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
const NUEVOS = ['js/ordenes-compra.js', 'js/ordenes-compra-db.js', 'js/ordenes-compra-vistas.js', 'js/proveedores.js', 'js/proveedores-db.js'];

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
  assert.match(html, /from "\.\/js\/ordenes-compra\.js\?v=oc1"/);
  // Los módulos que cambiaron en la spec 057 suben de versión para que el navegador no use la copia anterior.
  // La spec 058 (correo) subió a ?v=058 los que tocó: ordenes-compra-vistas.js, proveedores.js y proveedores-db.js.
  assert.match(html, /from \"\.\/js\/ordenes-compra-db\.js\?v=057\"/);
  for (const m of ['ordenes-compra-vistas.js', 'proveedores.js', 'proveedores-db.js']) assert.match(html, new RegExp(`from \"\\./js/${m.replace(/\./g, '\\.')}\\?v=058\"`));
});

test('tres pestañas, «Órdenes de compra», «Proveedores» y «Maestro de materiales», y un encabezado con el nombre de la pantalla', () => {
  assert.match(html, /<title>Órdenes de compra \| GraveCare Ops<\/title>/);
  assert.match(html, /<h1[^>]*>Órdenes de compra<\/h1>/);
  const boton = (id) => html.slice(html.indexOf(`id="tab-${id}"`), html.indexOf('</button>', html.indexOf(`id="tab-${id}"`)));
  assert.match(boton('ordenes'), /Órdenes de compra/);
  assert.match(boton('proveedores'), /Proveedores/);
  assert.match(boton('materiales'), /Maestro de materiales/);
  assert.ok(html.indexOf('id="tab-ordenes"') < html.indexOf('id="tab-proveedores"'));
  assert.ok(html.indexOf('id="tab-proveedores"') < html.indexOf('id="tab-materiales"'));
  assert.match(html, /const PESTANAS = \["ordenes", "proveedores", "materiales"\];/);
});

test('pestaña Proveedores (spec 057 a/b): alta, edición, quitar y reactivar; el desplegable de razón social y los borradores de OC', () => {
  for (const id of [
    'panel-proveedores', 'tbody-proveedores', 'prov-razon', 'prov-rut', 'prov-contacto', 'prov-telefono', 'prov-direccion',
    'prov-condicion', 'btn-guardar-proveedor', 'btn-cancelar-proveedor', 'aviso-proveedor',
    'oc-razon-select', 'oc-razon', 'tbody-borradores', 'aviso-borradores',
  ]) assert.match(html, new RegExp(`id="${id}"`), id);
  const condicion = html.slice(html.indexOf('id="prov-condicion"'), html.indexOf('</select>', html.indexOf('id="prov-condicion"')));
  for (const c of ['Transferencia', 'Factura a 30 días', 'Contado', 'Otro']) assert.match(condicion, new RegExp(`value="${c}"`));
  for (const f of ['crearProveedor(', 'editarProveedor(', 'cambiarActivoProveedor(', 'emitirDesdeBorrador(', 'htmlFilasProveedores(', 'htmlOpcionesRazon(', 'htmlFilasBorradores(', 'opcionesProveedores(', 'datosDeProveedor(', 'condicionPorDefecto(']) {
    assert.ok(html.includes(f), f);
  }
  assert.match(html, /puedeQuitar: puedeAnular/); // quitar y reactivar: solo el dueño (decisión 1)
  assert.match(html, /abrir-borrador/);
  assert.match(html, /searchParams|URLSearchParams\(window\.location\.search\)\.get\("borrador"\)/); // el borrador llega por ?borrador=AAAA-MM-DD
});

test('las escrituras son solo transacciones en materiales, ordenesCompra y contadores: sin setDoc, borrados ni otras colecciones', () => {
  assert.match(html, /runTransaction/);
  assert.match(html, /ejecutarTransaccion: \(fn\) => runTransaction\(db, fn\)/);
  for (const prohibido of ['setDoc', 'deleteDoc', 'updateDoc', 'addDoc', 'writeBatch']) assert.ok(!html.includes(prohibido), prohibido);
  const colecciones = [...html.matchAll(/(?:collection|doc)\(db,\s*([^,)]+)/g)].map((m) => m[1].trim());
  assert.ok(colecciones.length >= 4);
  const permitidas = ['COLECCION_MATERIALES', 'COLECCION_ORDENES', 'COLECCION_CONTADORES', 'COLECCION_PROVEEDORES', 'COLECCION_RUT_PROVEEDORES', 'COLECCION_BORRADORES', 'coleccion', '"staff"', '...RUTA_VALORES'];
  for (const c of colecciones) assert.ok(permitidas.includes(c), `colección inesperada: ${c}`);
  // La página puede nombrar la pantalla «Rutas y feriados» en un texto, pero no leer ni escribir esas colecciones.
  const sinNombreDePantalla = html.replace(/RUTA_VALORES/g, '').replace(/«Rutas y feriados»/g, '');
  assert.ok(!/\b(valores_ramos|gastos_ingresos|comprobantes_tributarios|rutas|feriados)\b/.test(sinNombreDePantalla), 'no toca otras colecciones');
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
  for (const f of ['htmlFilasMateriales(', 'htmlFilasOrdenes(', 'htmlLineasBorrador(', 'htmlTotales(', 'htmlFilasProveedores(', 'htmlOpcionesRazon(', 'htmlFilasBorradores(']) assert.ok(html.includes(f), f);
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

// ---- Spec 058: correo electrónico en la pestaña Proveedores (R1, R5)
test('spec 058: el formulario de proveedor tiene «Correo electrónico» y la tabla la columna «Correo»', () => {
  assert.match(html, /<label[^>]*>Correo electrónico\s*<input type="text" id="prov-correo" maxlength="120" class="[^"]*">/);
  const panel = html.slice(html.indexOf('id="panel-proveedores"'), html.indexOf('id="panel-materiales"'));
  assert.match(panel, /<th class="py-2 px-3">Teléfono<\/th><th class="py-2 px-3">Correo<\/th><th class="py-2 px-3">Condición de pago<\/th>/);
  // el campo nuevo usa el mismo estilo que contacto y teléfono
  const clase = (id) => (html.match(new RegExp(`id="${id}"[^>]*class="([^"]*)"`)) || [])[1];
  assert.equal(clase('prov-correo'), clase('prov-contacto'));
});

test('spec 058: el controlador lee, rellena y limpia el correo del proveedor', () => {
  assert.match(html, /correo:\s*\$\("prov-correo"\)\.value/);
  assert.match(html, /\$\("prov-correo"\)\.value = p\.correo \|\| ""/);
  assert.match(html, /for \(const id of \["prov-razon", "prov-rut", "prov-contacto", "prov-telefono", "prov-direccion", "prov-correo"\]\) \$\(id\)\.value = ""/);
});

test('spec 058: los módulos tocados se piden con ?v=058 (también el import interno de proveedores-db.js)', () => {
  for (const m of ['proveedores.js', 'proveedores-db.js', 'ordenes-compra-vistas.js']) assert.match(html, new RegExp(`from "\\./js/${m.replace('.', '\\.')}\\?v=058"`), m);
  assert.match(lee('js/proveedores-db.js'), /from '\.\/proveedores\.js\?v=058'/);
});

// ---- Spec 058: botón «Enviar por correo» en la OC emitida (R6-R14, CA13, CA14)
test('spec 058: el modal de la OC tiene «Enviar por correo» junto a «Imprimir», oculto por defecto, con su información y su aviso', () => {
  const modal = html.slice(html.indexOf('id="modal-oc"'), html.indexOf('id="zona-impresion"'));
  assert.match(modal, /<button type="button" id="btn-enviar-correo" class="hidden [^"]*"[^>]*>Enviar por correo<\/button>/);
  assert.ok(modal.indexOf('id="btn-enviar-correo"') < modal.indexOf('id="btn-imprimir"'), 'el botón nuevo va junto a Imprimir');
  assert.match(modal, /id="info-envio"/);
  assert.match(modal, /id="aviso-envio"/);
  assert.match(modal, /id="btn-imprimir"[^>]*>Imprimir<\/button>/, 'Imprimir no cambia');
});

test('spec 058: el SDK de Functions 10.7.0 se carga solo aquí y bajo demanda (si falla, la pantalla de órdenes sigue)', () => {
  const url = 'https://www.gstatic.com/firebasejs/10.7.0/firebase-functions.js';
  assert.equal(html.split(url).length - 1, 1, 'una sola referencia a firebase-functions.js');
  assert.match(html, new RegExp(`await import\\("${url.replace(/[.\/]/g, '\\$&')}"\\)`), 'import dinámico');
  assert.doesNotMatch(html, /import\s*\{[^}]*\}\s*from\s*"[^"]*firebase-functions\.js"/, 'sin import estático');
  const otras = ['index.html', 'portal.html', 'planificacion-servicios.html', 'rutas-feriados.html', 'clientes.html'].filter((f) => existsSync(join(PUBLIC, f)));
  for (const f of otras) assert.ok(!lee(f).includes('firebase-functions'), `${f} no debe cargar el SDK de Functions`);
});

test('spec 058: llama a enviarOrdenCompraPorCorreo (us-central1) solo con { numero }, pide confirmación y bloquea el doble clic', () => {
  assert.match(html, /getFunctions\(app, "us-central1"\)/);
  assert.match(html, /httpsCallable\(getFunctions\(app, "us-central1"\), "enviarOrdenCompraPorCorreo"\)/);
  assert.match(html, /from "\.\/js\/ordenes-compra-envio\.js\?v=058"/);
  assert.match(html, /enviarOrden\(\{ numero, llamar \}\)/);
  assert.match(html, /window\.confirm\(textoConfirmacion\(/);
  assert.match(html, /envioEnCurso = true/);
  assert.match(html, /Enviando…/);
  // al terminar (éxito o error) se vuelve a poder pulsar
  assert.match(html, /finally \{\s*envioEnCurso = false/);
  assert.match(html, /mensajeErrorEnvio\(/);
  assert.match(html, /textoResultado\(/);
});

test('spec 058: la pantalla no escribe nada del envío: ni la colección mail, ni envios, ni destinatario, copia o remitente', () => {
  assert.doesNotMatch(html, /["'`]mail["'`]/);
  assert.doesNotMatch(html, /envios\s*:|envioReservadoEl|arrayUnion/);
  assert.doesNotMatch(html, /rravellos|colivaresl|nodemailer|SMTP/i, 'las direcciones y el SMTP no viven en la página');
  // la copia solo aparece como constante del módulo del envío (para el texto de confirmación)
  assert.equal(lee('js/ordenes-compra-envio.js').split('rravellos@gravecare.cl').length - 1, 1);
  for (const f of ['proveedores.js', 'proveedores-db.js', 'ordenes-compra.js', 'ordenes-compra-db.js', 'ordenes-compra-vistas.js']) {
    assert.doesNotMatch(lee(`js/${f}`), /colivaresl/, f);
  }
  // el envío usa los datos que la pantalla ya cargó: ni lecturas nuevas ni historial escrito desde el navegador
  assert.match(html, /orden\.envios|ordenAbierta\.envios|\.envios\)/);
});
