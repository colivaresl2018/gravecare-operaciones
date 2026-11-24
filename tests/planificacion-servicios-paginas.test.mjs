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
  assert.match(html, /from "\.\/js\/planificacion-servicios\.js\?v=b5"/);
  assert.match(js, /from '\.\/fechas-visita\.js\?v=ps1'/);
  assert.match(js, /from '\.\/fechas-tentativas\.js\?v=pv062'/);
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

test('solo escribe los valores de ramos (etapa 2) y, desde la spec 057, el borrador de orden de compra del día: ninguna otra escritura y nunca fechasProgramadas', () => {
  assert.doesNotMatch(html, /\b(updateDoc|addDoc|deleteDoc|writeBatch)\b/);
  // spec 057: la única transacción es la de crearBorradorDia (el import y la inyección), y solo escribe en ordenesCompraBorradores
  assert.equal([...html.matchAll(/\brunTransaction\b/g)].length, 2, 'runTransaction: el import y la inyección para crear el borrador');
  assert.equal([...html.matchAll(/\bcrearBorradorDia\(/g)].length, 1);
  // setDoc solo aparece en el import y como `guardar: setDoc` (la única escritura, de valores_ramos/compra)
  const sinPermitidos = html.replace('getFirestore, collection, getDocs, getDoc, doc, setDoc }', '').replace('guardar: setDoc', '');
  assert.doesNotMatch(sinPermitidos, /\bsetDoc\b/);
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

// ─── Directriz B5, etapa 1: pestañas Planes · matriz, Spot · matriz y Resumen de Ventas ───────────────────────

const NUEVOS = ['rutas-planificacion', 'fechas-semana', 'matriz-planificacion', 'matriz-vistas', 'resumen-ventas', 'resumen-vistas'];

test('B5: los módulos nuevos existen y todo lo que importan existe (un import roto deja la pantalla en blanco)', () => {
  for (const nombre of NUEVOS) {
    const ruta = join(PUBLIC, 'js', `${nombre}.js`);
    assert.ok(existsSync(ruta), `falta ${nombre}.js`);
    for (const r of importsRelativos(lee(`js/${nombre}.js`))) assert.ok(existsSync(join(PUBLIC, 'js', r)), `${nombre}.js importa ${r}, que no existe`);
    // rutas-planificacion subió a ?v=cfg1 (ignora las rutas y feriados «quitados» desde la pantalla Rutas y feriados): el navegador no debe usar la copia vieja
    const version = nombre === 'rutas-planificacion' ? 'cfg1' : 'b5';
    assert.match(html, new RegExp(`from "\\./js/${nombre}\\.js\\?v=${version}"`));
  }
});

test('B5: la página tiene las 5 pestañas (Planes, Spot, Planes · matriz, Spot · matriz, Resumen de Ventas)', () => {
  assert.match(html, /const PESTANAS = \["planes", "spot", "matriz-planes", "matriz-spot", "compra", "valores", "resumen"\];/); // las 5 de la etapa 1 siguen; el orden es el del simulador aprobado (Compra y Valores antes del Resumen)
  for (const [id, texto] of [['matriz-planes', 'Planes · matriz'], ['matriz-spot', 'Spot · matriz'], ['resumen', 'Resumen de Ventas']]) {
    assert.match(html, new RegExp(`id="tab-${id}" data-tab="${id}"`));
    assert.ok(html.includes(texto), texto);
    assert.match(html, new RegExp(`id="panel-${id}" class="hidden"`));
  }
});

test('B5: la lista de Planes trae las columnas Tipo de servicio, Ramos adicionales y Eje, en el orden de la directriz', () => {
  const cabecera = html.slice(html.indexOf('<th class="py-3.5 px-3">Fecha de la visita</th>'), html.indexOf('id="tbody-planes"'));
  const orden = ['Plan', 'Tipo de servicio', 'Visita', 'Ramos adicionales', 'Cementerio', 'Eje', 'Operador', 'Estado'].map((t) => cabecera.indexOf(`>${t}</th>`));
  assert.ok(orden.every((i) => i > 0), JSON.stringify(orden));
  assert.deepEqual([...orden].sort((x, y) => x - y), orden);
  assert.equal((cabecera.match(/<th /g) || []).length, 12);
  assert.match(html, /colspan="12" class="py-8/);
  assert.match(html, /\$\{esc\(f\.nivel\)\}/);
  assert.match(html, /\$\{esc\(f\.ramosAdicionales\)\}/);
  assert.match(html, /\$\{esc\(f\.eje\)\}/);
});

test('B5: filtros Eje y Mes en las listas, y Mes que lleva cada matriz a su semana o mes', () => {
  for (const id of ['planes-eje', 'planes-mes', 'spot-mes', 'mp-eje', 'mp-mes', 'mp-operador', 'ms-operador', 'ms-mes']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /mes: \$\("planes-mes"\)\.value/);
  assert.match(html, /mes: \$\("spot-mes"\)\.value/);
  assert.match(html, /lunesMatriz = lunesDeLaSemana\(\$\("mp-mes"\)\.value \+ "-01"\)/);
});

test('B5: los ejes y los feriados se LEEN de las colecciones rutas y feriados, sin copia en el código ni en el repo', () => {
  assert.match(html, /getDocs\(collection\(db, "rutas"\)\)/);
  assert.match(html, /getDocs\(collection\(db, "feriados"\)\)/);
  assert.match(html, /rutas = await leerRutas\(\);/);
  assert.match(html, /construirFilasPlanificacion\(ordenesPagadas, \{[\s\S]*?\brutas,\s*\}\)/);
  const codigo = NUEVOS.map((n) => lee(`js/${n}.js`)).join('\n') + js + html;
  for (const nombre of ['Eje Santiago Norte', 'Eje Santiago Poniente', 'Eje Santiago Sur', 'Eje Rancagua']) assert.ok(!codigo.includes(nombre), `el eje «${nombre}» no debe estar escrito en el código`);
  assert.doesNotMatch(codigo, /Todos los Santos|Año Nuevo|Navidad|Viernes Santo/); // los feriados no se copian al código
  assert.equal(existsSync(join(PUBLIC, '..', 'firestore.rules')), false); // el backoffice no tiene copia de reglas
  assert.equal(existsSync(join(PUBLIC, '..', 'storage.rules')), false);
});

test('B5: una lectura que falla (rutas, feriados) no tumba la pantalla: se avisa y el cementerio queda «Sin eje»', () => {
  assert.match(html, /async function leerRutas\(\) \{\s*try \{/);
  assert.match(html, /async function leerFeriados\(\) \{\s*try \{/);
  assert.match(html, /rutasFallo = true;/);
  assert.match(html, /Todos los cementerios aparecen como «Sin eje»/);
  assert.match(html, /No se pudieron leer los feriados/);
});

test('B5: sigue sin reprogramar ni asignar operador, y los módulos de la etapa 1 no escriben: nada que ocultar a un operador', () => {
  const todo = NUEVOS.map((n) => lee(`js/${n}.js`)).join('\n') + html;
  assert.doesNotMatch(NUEVOS.map((n) => lee(`js/${n}.js`)).join('\n'), /\b(updateDoc|setDoc|addDoc|deleteDoc|writeBatch|runTransaction)\b/);
  assert.doesNotMatch(todo, /operadoresPorVisita\s*[:=]|fechasPorVisita\s*[:=]|guardarEstadoVisita|moverTareaACasillero|reprogramar/i);
  assert.doesNotMatch(lee('js/matriz-vistas.js'), /onclick|<input|<select|draggable/);
});

test('B5: el resumen usa montoTotal del servidor y nunca recalcula montos ni usa tablas de precios', () => {
  const resumen = lee('js/resumen-ventas.js');
  assert.match(resumen, /orden\.montoTotal|\.montoTotal/);
  assert.doesNotMatch(resumen, /precioNumerico|TARIFAS|tarifas|valores_ramos|PRECIO|\bprecio\b/i);
  assert.match(resumen, /esOrdenPagada/);
  assert.match(html, /if \(!esOrdenPagada\(ord\)\) return;/);
});

test('B5: la matriz y el resumen no escriben en el DOM sin escapar los datos de Firestore (todo pasa por esc)', () => {
  for (const nombre of ['matriz-vistas', 'resumen-vistas']) {
    const src = lee(`js/${nombre}.js`);
    assert.match(src, /from '\.\/html-seguro\.js'/);
    assert.ok((src.match(/esc\(/g) || []).length >= 10, nombre);
  }
  assert.match(html, /\$\("mp-tbody"\)\.innerHTML = htmlCuerpoSemana\(matriz\)/);
});

test('B5: no se tocó la regla de acceso ni el Gantt (planificacion.html sigue en su lugar) y el menú no cambió en esta etapa', () => {
  assert.ok(existsSync(join(PUBLIC, 'planificacion.html')));
  assert.match(portal, /B4 \(2026-11-22\): «Planificación & Gantt» oculto del menú/);
  assert.match(portal, /cargarModulo\('planificacion-servicios'\)/);
});

// ─── Directriz B5, etapa 2: pestañas Compra de flores y Valores de ramos ───────────────────────────────────────

const NUEVOS_E2 = ['compra-ramos', 'compra-vistas', 'valores-ramos-db'];

test('B5 etapa 2: los módulos nuevos existen, todo lo que importan existe y la página los importa', () => {
  for (const nombre of NUEVOS_E2) {
    assert.ok(existsSync(join(PUBLIC, 'js', `${nombre}.js`)), `falta ${nombre}.js`);
    for (const r of importsRelativos(lee(`js/${nombre}.js`))) assert.ok(existsSync(join(PUBLIC, 'js', r)), `${nombre}.js importa ${r}, que no existe`);
  }
  assert.match(html, /from "\.\/js\/compra-ramos\.js\?v=b5e2"/);
  assert.match(html, /from "\.\/js\/compra-vistas\.js\?v=057"/); // spec 057: la tabla suma la columna «Orden de compra»
  assert.match(html, /from "\.\/js\/valores-ramos-db\.js\?v=b5e2"/);
});

test('B5 etapa 2: la página tiene 7 pestañas (se agregan Compra de flores y Valores de ramos)', () => {
  assert.match(html, /const PESTANAS = \["planes", "spot", "matriz-planes", "matriz-spot", "compra", "valores", "resumen"\];/);
  for (const [id, texto] of [['compra', 'Compra de flores'], ['valores', 'Valores de ramos']]) {
    assert.match(html, new RegExp(`id="tab-${id}" data-tab="${id}"`));
    assert.ok(html.includes(texto), texto);
    assert.match(html, new RegExp(`id="panel-${id}" class="hidden"`));
  }
});

test('B5 etapa 2: la lista de compra usa las visitas de Planes y de Spot y los valores leídos de valores_ramos', () => {
  assert.match(html, /construirListaCompra\(\[\.\.\.filasPlanes, \.\.\.filasSpot\]/);
  assert.match(html, /valores: valoresCompra/);
  assert.match(html, /leerValoresRamos\(\{ obtener: getDoc, referencia: referenciaValores \}\)/);
  assert.match(html, /doc\(db, \.\.\.RUTA_VALORES\)/);
});

test('B5 etapa 2: la lectura de valores no tumba la pantalla (se avisa) y guardar usa el usuario y avisa si falla', () => {
  assert.match(html, /valoresLecturaFallo = true;/);
  assert.match(html, /No se pudieron leer los valores de ramos/);
  assert.match(html, /guardarValoresRamos\(\{[\s\S]*?guardar: setDoc[\s\S]*?uid: auth\.currentUser/);
  assert.match(html, /No se pudieron guardar los valores/);
  assert.match(html, /boton\.disabled = false/);
});

test('B5 etapa 2: no hay precios escritos en el código (salen de valores_ramos) ni se tocan otras colecciones', () => {
  for (const nombre of NUEVOS_E2) assert.doesNotMatch(lee(`js/${nombre}.js`), /\b\d{4,}\b/, `${nombre}.js no debe tener precios`);
  assert.doesNotMatch(html, /valoresCompra\s*=\s*\{[^}]*\d{4,}/);
  // «Órdenes de Compra» (spec 055) sigue fuera de esta pantalla salvo el borrador del día (spec 057): ni materiales, ni órdenes, ni contadores
  assert.doesNotMatch(html + NUEVOS_E2.map((n) => lee(`js/${n}.js`)).join('\n'), /["']materiales["']|["']ordenesCompra["']|["']contadores["']/);
  assert.doesNotMatch(html, /id="tab-ordenes-compra"/);
});

test('B5 etapa 2: la única escritura es valores_ramos/compra, con merge y solo los 5 valores y quién/cuándo', () => {
  const db = lee('js/valores-ramos-db.js');
  assert.match(db, /RUTA_VALORES = \['valores_ramos', 'compra'\]/);
  assert.match(db, /\{ merge: true \}/);
  assert.equal((db.match(/await guardar\(/g) || []).length, 1);
  assert.doesNotMatch(lee('js/compra-ramos.js') + lee('js/compra-vistas.js'), /\b(setDoc|updateDoc|addDoc|deleteDoc|getDocs|getDoc|collection)\b/);
});

test('B5 etapa 2: lo que viene de Firestore (cementerios, valores) pasa por esc en las vistas de compra', () => {
  const src = lee('js/compra-vistas.js');
  assert.match(src, /from '\.\/html-seguro\.js'/);
  assert.ok((src.match(/esc\(/g) || []).length >= 15);
  assert.match(html, /\$\("cr-tbody"\)\.innerHTML = htmlCuerpoCompra\(lista, \{ ordenes: estados, puedeCrear: !informesFallo \}\)/);
});

test('B5 etapa 2: Gantt, menú y reglas siguen como estaban (sin firestore.rules en este repo)', () => {
  assert.ok(existsSync(join(PUBLIC, 'planificacion.html')));
  assert.equal(existsSync(join(PUBLIC, '..', 'firestore.rules')), false);
  assert.equal(existsSync(join(PUBLIC, '..', 'storage.rules')), false);
  assert.match(portal, /B4 \(2026-11-22\): «Planificación & Gantt» oculto del menú/);
});

// ─── Orden de las pestañas y encabezado por pestaña (igual que el simulador aprobado por el dueño) ────────────────

test('orden de las pestañas: Planes, Spot, matrices, Compra de flores, Valores de ramos y Resumen de Ventas (en la página y en el código)', () => {
  const orden = ['planes', 'spot', 'matriz-planes', 'matriz-spot', 'compra', 'valores', 'resumen'].map((id) => html.indexOf(`id="tab-${id}"`));
  assert.ok(orden.every((i) => i > 0), JSON.stringify(orden));
  assert.deepEqual([...orden].sort((x, y) => x - y), orden, 'los botones deben aparecer en este orden');
});

test('las dos primeras pestañas se llaman «Planificación Planes» y «Planificación Spot»', () => {
  const boton = (id) => html.slice(html.indexOf(`id="tab-${id}"`), html.indexOf('</button>', html.indexOf(`id="tab-${id}"`)));
  assert.match(boton('planes'), /Planificación Planes/);
  assert.match(boton('spot'), /Planificación Spot/);
  assert.match(boton('planes'), /id="contador-planes"/); // el contador sigue
  assert.match(boton('spot'), /id="contador-spot"/);
});

test('el encabezado (título y texto) cambia con la pestaña, con los textos del simulador', () => {
  assert.match(html, /<h1 id="titulo-planificacion"/);
  assert.match(html, /<p id="descripcion-planificacion"/);
  const bloque = html.slice(html.indexOf('const ENCABEZADO = {'), html.indexOf('function cambiarPestana'));
  const esperado = {
    planes: ['Planificación Planes', 'Visitas de los servicios con plan con pago confirmado.'],
    'matriz-planes': ['Planificación Planes', 'Visitas de los servicios con plan con pago confirmado.'],
    spot: ['Planificación Spot', 'Visitas de los servicios Spot con pago confirmado.'],
    'matriz-spot': ['Planificación Spot', 'Visitas de los servicios Spot con pago confirmado.'],
    compra: ['Compra de Flores', ''],
    valores: ['Valores de los Ramos', ''],
    resumen: ['Resumen de Ventas', ''],
  };
  for (const [tab, [titulo, texto]] of Object.entries(esperado)) {
    const clave = tab.includes('-') ? `"${tab}"` : tab;
    assert.ok(bloque.includes(`${clave}: { titulo: "${titulo}", texto: "${texto}" }`), `falta el encabezado de ${tab}`);
  }
  assert.match(html, /document\.title = enc\.titulo \+ " \| GraveCare Ops"/);
  assert.match(html, /hTexto\.style\.display = enc\.texto \? "" : "none"/);
});

test('el encabezado inicial (antes de cargar) ya es el de Planes y se aplica al abrir la página', () => {
  assert.match(html, /<h1 id="titulo-planificacion"[^>]*>Planificación Planes<\/h1>/);
  assert.match(html, /<title>Planificación Planes \| GraveCare Ops<\/title>/);
  assert.match(html, /cambiarPestana\(pestanaActiva\);\s*\n\s*onAuthStateChanged/); // también si la carga falla
});

test('el nombre de la página en el menú del portal no cambia', () => {
  assert.match(portal, /"planificacion-servicios": \{ title: "Planificación Planes y Spot", icon: "fa-solid fa-calendar-check" \}/);
});

test('spec 057: «Compra de flores» ofrece «Crear orden de compra» en cada día, con el mismo cálculo y el mismo motivo de «no listo»', () => {
  const panel = html.slice(html.indexOf('id="panel-compra"'), html.indexOf('id="panel-valores"'));
  assert.match(panel, /<th[^>]*>Orden de compra<\/th>/);
  assert.match(html, /from "\.\/js\/compra-dia\.js\?v=057"/);
  assert.match(html, /from "\.\/js\/ordenes-compra-db\.js\?v=057"/);
  assert.match(html, /estadoDiasCompra\(lista,/);
  assert.match(html, /htmlCuerpoCompra\(lista, \{ ordenes:/);
  assert.match(html, /data-accion="crear-oc-dia"/);
  // un día no listo no crea nada; mientras guarda el botón queda bloqueado (doble clic) y siempre se vuelve a habilitar
  assert.match(html, /\.listo/);
  assert.match(html, /boton\.disabled = true/);
  assert.match(html, /ordenes-compra\.html\?borrador=/);
  // la regla de «día listo» no se copia aquí
  assert.doesNotMatch(html, /Sin eje y día de ruta|No hay visitas programadas/);
});

test('spec 057: crear el borrador solo escribe ordenesCompraBorradores; si no se pueden leer informes o borradores se avisa y no se crea a ciegas', () => {
  assert.match(html, /COLECCION_BORRADORES/);
  assert.match(html, /informesFallo/);
  assert.match(html, /No se pudieron leer los informes/);
  assert.match(html, /textoErrorBorrador\(/);
  assert.match(html, /borradorDesdeDia\(/);
  assert.match(html, /idBorrador\(/);
});
