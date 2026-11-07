// B-13 (auditoría de cierre 2026-11-07): toda página operativa del backoffice exige el claim staffActivo (exigirStaff) dentro de onAuthStateChanged.
// Prueba estática: no ejecuta las páginas. Ejecutar:  node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const lee = (p) => readFileSync(join(PUBLIC, p), 'utf8').replace(/\r/g, '');

// Páginas con la barrera ya desde la spec 040 + las seis cerradas en B-13.
const PAGINAS = [
  'ordenes.html', 'planificacion.html', 'todos-los-trabajos.html', 'trabajos-terminados.html', 'gastos-ingresos.html',
  'clientes.html', 'informe-captura.html', 'informe-revision.html', 'mapa.html', 'mis-trabajos.html', 'portal.html',
];

for (const pagina of PAGINAS) {
  test(`${pagina}: importa exigirStaff y lo llama dentro de onAuthStateChanged, antes de cargar datos`, () => {
    const h = lee(pagina);
    const iImport = h.indexOf('import { exigirStaff } from "./js/acceso-staff.js"');
    assert.ok(iImport > 0, 'importa exigirStaff desde ./js/acceso-staff.js');
    const iObs = h.search(/onAuthStateChanged\(auth,\s*async\s*\(/);
    assert.ok(iObs > 0, 'el observador de sesión es async (necesita await)');
    const iGate = h.indexOf('if (!(await exigirStaff(auth, ', iObs);
    assert.ok(iGate > iObs, 'exige staff dentro del observador');
    assert.ok(iImport < iObs, 'el import va antes del observador');
    // La barrera va antes de cualquier carga de datos del observador.
    const cuerpo = h.slice(iObs, iObs + 1500);
    const iCarga = cuerpo.search(/await (cargar\w+|inicializar\w+)\(|\bcargar\w+\(|\binicializarMapa\(/);
    if (iCarga >= 0) assert.ok(iGate - iObs < iCarga, 'la barrera precede a la carga de datos');
  });
}

test('acceso-staff.js sigue cerrando en falso (sin claim o token ilegible no pasa)', () => {
  const js = lee('js/acceso-staff.js');
  assert.match(js, /claims\.staffActivo === true/);
  assert.match(js, /esStaff = false; \/\/ token ilegible: falla cerrado/);
});

test('las reglas deprecadas de operaciones ya no están en la raíz (B-18)', () => {
  const raiz = join(PUBLIC, '..');
  assert.equal(existsSync(join(raiz, 'firestore.rules')), false);
  assert.equal(existsSync(join(raiz, 'storage.rules')), false);
  assert.equal(existsSync(join(raiz, 'legacy', 'reglas-deprecadas', 'LEEME.md')), true);
});
