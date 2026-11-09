// N80 (directriz B-2): las 7 páginas filtran con el criterio de orden pagada ANTES de listar o contar.
// Prueba estática (no ejecuta las páginas). Ejecutar:  node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const lee = (p) => readFileSync(join(PUBLIC, p), 'utf8').replace(/\r/g, '');

/** Cuerpo del primer forEach sobre la lectura de la colección «ordenes». */
function cuerpoForEachOrdenes(html) {
  const iLectura = html.indexOf('getDocs(collection(db, "ordenes"))');
  assert.ok(iLectura > 0, 'lee la colección ordenes');
  const iForEach = html.indexOf('.forEach(', iLectura);
  assert.ok(iForEach > iLectura, 'recorre las órdenes');
  return html.slice(iForEach, iForEach + 6000);
}

const LISTAS = ['ordenes.html', 'mis-trabajos.html', 'todos-los-trabajos.html', 'mapa.html', 'planificacion.html', 'clientes.html'];

for (const pagina of LISTAS) {
  test(`${pagina}: importa esOrdenPagada y descarta las órdenes sin pago antes de listarlas`, () => {
    const h = lee(pagina);
    assert.match(h, /import \{ esOrdenPagada[^}]*\} from "\.\/js\/orden-pagada\.js"/);
    const cuerpo = cuerpoForEachOrdenes(h);
    const iFiltro = cuerpo.search(/if \(!esOrdenPagada\((d|ord)\)\) return;/);
    assert.ok(iFiltro > 0, 'filtra con esOrdenPagada dentro del recorrido');
    const iPrimerUso = cuerpo.search(/\.push\(|\.set\(|cementeriosSet\.add\(/);
    assert.ok(iPrimerUso < 0 || iFiltro < iPrimerUso, 'el filtro va antes de agregar la orden a cualquier lista');
    // Solo debe haber una lectura de la colección completa por página (la que se filtra).
    assert.equal(h.split('getDocs(collection(db, "ordenes"))').length - 1, 1);
  });
}

test('gastos-ingresos.html: el ingreso exige cuentaComoIngreso y toma la fecha de fechaPago', () => {
  const h = lee('gastos-ingresos.html');
  assert.match(h, /import \{ cuentaComoIngreso, fechaDelIngreso \} from "\.\/js\/orden-pagada\.js"/);
  const cuerpo = cuerpoForEachOrdenes(h);
  const iCond = cuerpo.indexOf('if (totalBruto > 0 && cuentaComoIngreso(ord)) {');
  const iPush = cuerpo.indexOf('lista.push(');
  assert.ok(iCond > 0 && iCond < iPush, 'la condición de ingreso precede al registro del movimiento');
  assert.ok(cuerpo.includes('extraerFechaDate(fechaDelIngreso(ord))'), 'la fecha del ingreso sale de fechaDelIngreso');
  assert.ok(!cuerpo.includes('ord.creadoEl || ord.createdAt || ord.fechaPago'), 'ya no prioriza creadoEl sobre fechaPago');
});
