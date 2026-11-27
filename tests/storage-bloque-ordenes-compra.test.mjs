// Resguardo: cualquier storage.rules que alguna vez aparezca en este repo debe incluir el bloque de Ordenes_Compra/
// que ya está publicado en producción (si no, publicarlo lo borraría y las subidas de órdenes de compra fallarían).
// El texto del bloque vive en docs/referencia/storage-ordenes-compra-bloque.md (única fuente aquí).
// Prueba estática. Ejecutar:  node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const normalizar = (t) => t.replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim();

/** Bloque de referencia: el primer bloque de código del documento. */
function bloqueDeReferencia() {
  const doc = readFileSync(join(RAIZ, 'docs', 'referencia', 'storage-ordenes-compra-bloque.md'), 'utf8').replace(/\r\n/g, '\n');
  const m = doc.match(/```\n([\s\S]*?)\n```/);
  assert.ok(m, 'el documento de referencia debe traer el bloque en un bloque de código');
  return m[1];
}

/** Todos los storage.rules del repo, salvo los archivados en legacy/ y las dependencias. */
function archivosStorageRules(dir = RAIZ, acc = []) {
  for (const nombre of readdirSync(dir)) {
    if (nombre === 'node_modules' || nombre === '.git' || nombre === '.omc' || nombre === '.claude') continue;
    const ruta = join(dir, nombre);
    const rel = relative(RAIZ, ruta).split(sep);
    if (rel[0] === 'legacy') continue;
    if (statSync(ruta).isDirectory()) archivosStorageRules(ruta, acc);
    else if (nombre === 'storage.rules') acc.push(ruta);
  }
  return acc;
}

/** Devuelve true si el texto de reglas incluye el bloque exacto (ignorando saltos de línea y espacios). */
function incluyeBloque(textoReglas, bloque) {
  return normalizar(textoReglas).includes(normalizar(bloque));
}

test('el bloque de referencia trae lo esencial de Ordenes_Compra/', () => {
  const b = bloqueDeReferencia();
  assert.match(b, /match \/Ordenes_Compra\/\{fecha\}\/\{archivo\}/);
  assert.match(b, /esStaffActivo\(\)/);
  assert.match(b, /\[A-Za-z0-9_-\]\{8,64\}\[\.\]pdf/);
  assert.match(b, /5 \* 1024 \* 1024/);
  assert.match(b, /application\/pdf/);
  assert.match(b, /allow update, delete: if false;/);
});

test('el comprobador distingue unas reglas con el bloque de unas sin él (o con él alterado)', () => {
  const b = bloqueDeReferencia();
  assert.equal(incluyeBloque('rules_version = \'2\';\nservice firebase.storage {\n' + b + '\n}', b), true);
  assert.equal(incluyeBloque('rules_version = \'2\';\nservice firebase.storage {\n}', b), false);
  assert.equal(incluyeBloque(b.replace('5 * 1024 * 1024', '50 * 1024 * 1024'), b), false);
  assert.equal(incluyeBloque(b.replace('allow update, delete: if false;', 'allow update, delete: if true;'), b), false);
});

test('todo storage.rules que exista fuera de legacy/ incluye el bloque de Ordenes_Compra/ tal cual', () => {
  const archivos = archivosStorageRules();
  const b = bloqueDeReferencia();
  for (const ruta of archivos) {
    assert.ok(incluyeBloque(readFileSync(ruta, 'utf8'), b), `${relative(RAIZ, ruta)} debe incluir el bloque de Ordenes_Compra/ de docs/referencia/storage-ordenes-compra-bloque.md`);
  }
});

test('hoy el repo no trae storage.rules fuera de legacy/ (las reglas se publican solo desde el repo de la web)', () => {
  assert.deepEqual(archivosStorageRules().map((r) => relative(RAIZ, r)), []);
});

test('firebase.json sigue sin declarar storage (no hay forma de publicar reglas de Storage desde aquí)', () => {
  const cfg = JSON.parse(readFileSync(join(RAIZ, 'firebase.json'), 'utf8'));
  assert.equal('storage' in cfg, false);
  assert.ok(existsSync(join(RAIZ, 'docs', 'referencia', 'storage-ordenes-compra-bloque.md')));
});
