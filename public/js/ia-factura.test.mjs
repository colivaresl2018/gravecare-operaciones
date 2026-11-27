// Spec 082 etapa 2: factura PDF → borrador de orden de compra (lógica sin Firebase ni DOM real).
// CA5 (se sube y se procesa), CA6 (ya existe: no se sube ni se llama), CA7 (no PDF / más de 5 MB: se rechaza antes de llamar).
// Ejecutar: node --test public/js/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FUNCION_FACTURA, MAX_PDF_BYTES, MENSAJE_YA_EXISTE, MENSAJE_SUBIDA, validarArchivoFactura, validarFechaFactura,
  nombreAleatorio, rutaFactura, procesarFactura, textoResultado, pintarResultado,
} from './ia-factura.js';
import { AVISO_IA, MENSAJE_GENERICO } from './ia-informe.js';

const PDF = { name: 'factura.pdf', type: 'application/pdf', size: 4 * 1024 * 1024 };
const azarFijo = (n) => Uint8Array.from({ length: n }, (_, i) => i * 7 + 3);
const RESP = { ok: true, dia: '2026-12-01', total: 11900, lineas: 2, advertencias: ['La suma de las líneas no coincide con el neto: revisar antes de emitir.'] };

test('constantes: función, tope de 5 MB y aviso compartido con el informe', () => {
  assert.equal(FUNCION_FACTURA, 'procesarFacturaIA');
  assert.equal(MAX_PDF_BYTES, 5 * 1024 * 1024);
  assert.match(AVISO_IA, /La IA puede equivocarse/);
});

test('CA7: solo PDF de hasta 5 MB y con contenido', () => {
  assert.equal(validarArchivoFactura(PDF).ok, true);
  assert.equal(validarArchivoFactura({ name: 'a.pdf', type: 'application/pdf', size: MAX_PDF_BYTES }).ok, true);
  assert.equal(validarArchivoFactura({ name: 'a.pdf', type: 'application/pdf', size: MAX_PDF_BYTES + 1 }).ok, false);
  assert.equal(validarArchivoFactura({ name: 'a.png', type: 'image/png', size: 100 }).ok, false);
  assert.equal(validarArchivoFactura({ name: 'a.pdf', type: '', size: 100 }).ok, false, 'sin tipo PDF no se acepta aunque termine en .pdf');
  assert.equal(validarArchivoFactura({ name: 'a.pdf', type: 'application/pdf', size: 0 }).ok, false);
  assert.equal(validarArchivoFactura(null).ok, false);
  assert.match(validarArchivoFactura({ name: 'a.png', type: 'image/png', size: 1 }).error, /PDF/);
  assert.match(validarArchivoFactura({ name: 'a.pdf', type: 'application/pdf', size: MAX_PDF_BYTES + 1 }).error, /5 MB/);
});

test('la fecha de emisión debe ser AAAA-MM-DD real', () => {
  assert.equal(validarFechaFactura('2026-12-01').ok, true);
  for (const mala of ['', '01/12/2026', '2026-13-01', '2026-02-30', null, undefined, '2026-12-1']) assert.equal(validarFechaFactura(mala).ok, false, String(mala));
});

test('nombre aleatorio: de 8 a 64 caracteres [A-Za-z0-9_-], distinto con distinto azar y sin usar el nombre del archivo', () => {
  const n = nombreAleatorio(azarFijo);
  assert.match(n, /^[A-Za-z0-9_-]{8,64}$/);
  assert.notEqual(nombreAleatorio((k) => Uint8Array.from({ length: k }, () => 200)), n);
  assert.throws(() => nombreAleatorio(() => new Uint8Array(2)), /azar/i, 'un azar corto no sirve');
});

test('ruta oficial: Ordenes_Compra/<fecha>/<nombre>.pdf', () => {
  const nombre = nombreAleatorio(azarFijo);
  assert.equal(rutaFactura('2026-12-01', nombre), `Ordenes_Compra/2026-12-01/${nombre}.pdf`);
  assert.throws(() => rutaFactura('2026-12-01', 'corto'));
  assert.throws(() => rutaFactura('2026-12-01', '../../etc/passwd1'));
  assert.throws(() => rutaFactura('hoy', nombre));
});

test('CA5: sube a la ruta oficial con contentType PDF y luego llama a la función con { ruta }; devuelve total, líneas y avisos', async () => {
  const subidas = [], llamadas = [];
  const r = await procesarFactura({
    archivo: PDF, fecha: '2026-12-01', azar: azarFijo, existeBorrador: () => false,
    subir: async (ruta, archivo, meta) => { subidas.push({ ruta, archivo, meta }); },
    llamar: async (datos) => { llamadas.push(datos); return RESP; },
  });
  assert.equal(r.ok, true);
  assert.deepEqual({ dia: r.dia, total: r.total, lineas: r.lineas, advertencias: r.advertencias }, { dia: '2026-12-01', total: 11900, lineas: 2, advertencias: RESP.advertencias });
  assert.equal(subidas.length, 1);
  assert.match(subidas[0].ruta, /^Ordenes_Compra\/2026-12-01\/[A-Za-z0-9_-]{8,64}\.pdf$/);
  assert.deepEqual(subidas[0].meta, { contentType: 'application/pdf' });
  assert.equal(subidas[0].archivo, PDF);
  assert.deepEqual(llamadas, [{ ruta: subidas[0].ruta }], 'solo la ruta, sin más datos');
});

test('CA7: un archivo inválido o una fecha inválida se rechazan SIN subir ni llamar', async () => {
  let toco = 0;
  const deps = { azar: azarFijo, existeBorrador: () => false, subir: async () => { toco += 1; }, llamar: async () => { toco += 1; return RESP; } };
  for (const archivo of [{ name: 'a.png', type: 'image/png', size: 5 }, { ...PDF, size: MAX_PDF_BYTES + 1 }, null]) {
    const r = await procesarFactura({ ...deps, archivo, fecha: '2026-12-01' });
    assert.equal(r.ok, false);
    assert.ok(r.mensaje);
  }
  const r = await procesarFactura({ ...deps, archivo: PDF, fecha: 'mañana' });
  assert.equal(r.ok, false);
  assert.equal(toco, 0);
});

test('CA6 / R13: si el borrador de ese día ya existe, se informa y NO se sube ni se llama (no se ofrece reintentar)', async () => {
  let toco = 0;
  const r = await procesarFactura({ archivo: PDF, fecha: '2026-12-01', azar: azarFijo, existeBorrador: (f) => f === '2026-12-01', subir: async () => { toco += 1; }, llamar: async () => { toco += 1; } });
  assert.deepEqual({ ok: r.ok, yaExiste: r.yaExiste, mensaje: r.mensaje }, { ok: false, yaExiste: true, mensaje: MENSAJE_YA_EXISTE });
  assert.equal(toco, 0);
  assert.match(MENSAJE_YA_EXISTE, /Ya existe un borrador de orden de compra para esa fecha/);
});

test('CA6: si la función responde «ya existe» (otra persona lo creó al mismo tiempo) se informa tal cual y yaExiste es true', async () => {
  const e = Object.assign(new Error('Ya existe un borrador de orden de compra para esa fecha. No se guardó nada.'), { code: 'functions/already-exists' });
  const r = await procesarFactura({ archivo: PDF, fecha: '2026-12-01', azar: azarFijo, existeBorrador: () => false, subir: async () => {}, llamar: async () => { throw e; } });
  assert.equal(r.ok, false);
  assert.equal(r.yaExiste, true);
  assert.equal(r.mensaje, e.message);
});

test('R3: otros errores de la función se muestran tal cual; los técnicos o de red, con el mensaje genérico', async () => {
  const dep = (e) => ({ archivo: PDF, fecha: '2026-12-01', azar: azarFijo, existeBorrador: () => false, subir: async () => {}, llamar: async () => { throw e; } });
  let r = await procesarFactura(dep(Object.assign(new Error('Llegaste al límite de 5 propuestas de IA por día. Podrás usarla de nuevo mañana.'), { code: 'functions/resource-exhausted' })));
  assert.equal(r.mensaje, 'Llegaste al límite de 5 propuestas de IA por día. Podrás usarla de nuevo mañana.');
  assert.notEqual(r.yaExiste, true);
  r = await procesarFactura(dep(new Error('internal')));
  assert.equal(r.mensaje, MENSAJE_GENERICO);
  r = await procesarFactura(dep(new TypeError('Failed to fetch')));
  assert.equal(r.mensaje, MENSAJE_GENERICO);
  r = await procesarFactura(dep(Object.assign(new Error('No pudimos leer la factura con datos consistentes. No se guardó nada.'), { code: 'functions/failed-precondition' })));
  assert.equal(r.mensaje, 'No pudimos leer la factura con datos consistentes. No se guardó nada.');
});

test('R6: si la subida falla NO se llama a la función y se avisa con un mensaje claro (sin detalles técnicos)', async () => {
  let llamo = 0;
  const r = await procesarFactura({ archivo: PDF, fecha: '2026-12-01', azar: azarFijo, existeBorrador: () => false, subir: async () => { throw Object.assign(new Error('storage/unauthorized'), { code: 'storage/unauthorized' }); }, llamar: async () => { llamo += 1; } });
  assert.equal(r.ok, false);
  assert.equal(r.mensaje, MENSAJE_SUBIDA);
  assert.equal(llamo, 0);
  assert.doesNotMatch(r.mensaje, /storage|unauthorized/i);
});

test('respuesta mal formada → mensaje genérico (no se inventa un resultado)', async () => {
  for (const mala of [null, undefined, {}, { ok: false }, { ok: true, dia: '2026-12-01', total: 'x', lineas: 1, advertencias: [] }, { ok: true, dia: '2026-12-01', total: 100, lineas: 1, advertencias: 'no' }, { ok: true, total: 100, lineas: 1, advertencias: [] }]) {
    const r = await procesarFactura({ archivo: PDF, fecha: '2026-12-01', azar: azarFijo, existeBorrador: () => false, subir: async () => {}, llamar: async () => mala });
    assert.equal(r.ok, false, JSON.stringify(mala));
    assert.equal(r.mensaje, MENSAJE_GENERICO);
  }
});

test('R14: el módulo no emite la orden, no toca contadores ni envía correo (no importa nada de Firebase ni de órdenes)', async () => {
  const { readFileSync } = await import('node:fs');
  const fuente = readFileSync(new URL('./ia-factura.js', import.meta.url), 'utf8');
  assert.doesNotMatch(fuente, /firebase|contadores|emitirOrden|emitirDesdeBorrador|enviarOrden|innerHTML|fetch\(/);
});

test('textoResultado: total en pesos y número de líneas, en español', () => {
  assert.equal(textoResultado({ total: 11900, lineas: 2 }), 'Total: $11.900 · 2 líneas');
  assert.equal(textoResultado({ total: 5000, lineas: 1 }), 'Total: $5.000 · 1 línea');
});

// Documento falso mínimo (sin jsdom): lo bastante para comprobar que el texto de la factura solo entra por textContent.
function docFalso() {
  const crea = (tag) => ({ tag, children: [], className: '', _t: '', set textContent(v) { this._t = String(v); if (v === '') this.children = []; }, get textContent() { return this._t; }, appendChild(h) { this.children.push(h); return h; } });
  return { createElement: crea, crea };
}

test('CA11-bis: el resultado se pinta con textContent: advertencias con HTML se ven como texto', () => {
  const doc = docFalso();
  const destino = doc.createElement('div');
  pintarResultado(doc, destino, { ...RESP, advertencias: ['<img src=x onerror=alert(1)>', '<script>1</script>'] });
  const textos = [];
  const recorre = (n) => { textos.push(n.textContent); n.children.forEach(recorre); };
  recorre(destino);
  assert.ok(textos.some((t) => t === '<img src=x onerror=alert(1)>'));
  assert.ok(textos.some((t) => /Total: \$11\.900/.test(t)));
  assert.ok(!('innerHTML' in destino));
});
