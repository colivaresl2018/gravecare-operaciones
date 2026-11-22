// N192, N193 (directriz B-2) e insignia «PRUEBA» (respuesta del dueño en B-1). Pruebas estáticas. Ejecutar:  node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { INSIGNIA_PRUEBA } from '../public/js/orden-pagada.js';

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const lee = (p) => readFileSync(join(PUBLIC, p), 'utf8').replace(/\r/g, '');

test('N192: planificacion no presenta un monto por defecto como pagado', () => {
  const h = lee('planificacion.html');
  assert.equal(h.includes('259960'), false, 'no queda el monto por defecto 259960');
  assert.match(h, /montoPagado: ord\.montoTotal \|\| ord\.monto \|\| ord\.precioNumerico \|\| null,/);
  assert.ok(h.includes('${item.montoPagado ? formatearDinero(item.montoPagado) : "—"}'), 'sin monto se muestra «—»');
});

test('N192: ninguna página del backoffice tiene el monto por defecto 259960', () => {
  const html = readdirSync(PUBLIC).filter((n) => n.endsWith('.html'));
  for (const n of html) assert.equal(lee(n).includes('259960'), false, n);
});

test('N193: clientes.html no contiene una clave fija ni borra clientes desde el navegador', () => {
  const h = lee('clientes.html');
  assert.equal(/prompt\(/.test(h), false, 'no pide una clave');
  assert.equal(/claveIngresada/.test(h), false, 'no compara una clave');
  assert.equal(/deleteDoc\(doc\(db,\s*"clientes"/.test(h), false, 'no intenta borrar clientes/{id}');
  assert.match(h, /window\.eliminarClienteConClave = function\(id, nombre\) \{\n\s+alert\(`⚠️ El borrado de clientes está deshabilitado/);
});

test('N193: ninguna página compara una entrada con una clave numérica fija', () => {
  const html = readdirSync(PUBLIC).filter((n) => n.endsWith('.html'));
  for (const n of html) {
    assert.equal(/\.trim\(\)\s*!==\s*["']\d{4,}["']/.test(lee(n)), false, n);
  }
});

const CON_INSIGNIA = {
  'ordenes.html': ['esPrueba: esOrdenDePrueba(d)', '${esc(item.cliente)}${item.esPrueba ? INSIGNIA_PRUEBA : ""}'],
  'todos-los-trabajos.html': ['esPrueba: esOrdenDePrueba(d)', '${esc(item.cliente)}${item.esPrueba ? INSIGNIA_PRUEBA : ""}'],
  'mis-trabajos.html': ['esPrueba: esOrdenDePrueba(d)', '${esc(item.difunto)}${item.esPrueba ? INSIGNIA_PRUEBA : ""}'],
  'planificacion.html': ['esPrueba: esOrdenDePrueba(ord)', '${esc(item.titular)}${item.esPrueba ? INSIGNIA_PRUEBA : ""}'],
  'mapa.html': ['esPrueba: esOrdenDePrueba(ord)', '${esc(v.cliente)}${v.esPrueba ? INSIGNIA_PRUEBA : ""}'],
};
for (const [pagina, [marca, render]] of Object.entries(CON_INSIGNIA)) {
  test(`B-1: ${pagina} marca las órdenes de integración con la insignia PRUEBA`, () => {
    const h = lee(pagina);
    assert.match(h, /import \{ esOrdenPagada, esOrdenDePrueba, INSIGNIA_PRUEBA \} from "\.\/js\/orden-pagada\.js"/);
    assert.ok(h.includes(marca), 'calcula esPrueba al armar la fila');
    assert.ok(h.includes(render), 'muestra la insignia junto al nombre');
  });
}

test('B-1: la insignia dice exactamente «PRUEBA»', () => {
  assert.match(INSIGNIA_PRUEBA, />PRUEBA<\/span>$/);
});
