// Spec 061 · «Imprimir» la OC con el PDF archivado en Storage (spec 060). Pruebas estáticas de la página: no ejecutan el HTML.
// Ejecutar: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const lee = (p) => readFileSync(join(RAIZ, p), 'utf8').replace(/\r/g, '');
const html = lee('public/ordenes-compra.html');
const pdfJs = lee('public/js/ordenes-compra-pdf.js');

test('el módulo del PDF se importa con su versión (?v=061) para no usar una copia anterior', () => {
  assert.match(html, /import \{ obtenerPdfOC \} from "\.\/js\/ordenes-compra-pdf\.js\?v=061"/);
});

test('Storage se carga solo al pulsar Imprimir (import dinámico, sin cargar más SDK al abrir la pantalla)', () => {
  assert.match(html, /import\("https:\/\/www\.gstatic\.com\/firebasejs\/10\.7\.0\/firebase-storage\.js"\)/);
  assert.ok(!/^\s*import .*firebase-storage/m.test(html), 'no debe haber import estático de Storage');
});

test('un fallo de red se muestra en ~15 s: el SDK no reintenta durante minutos con el botón bloqueado (setMaxOperationRetryTime)', () => {
  assert.match(html, /setMaxOperationRetryTime/);
  assert.match(html, /setMaxOperationRetryTime\(almacen, 15000\)/);
  assert.match(html, /const almacen = getStorage\(app\)/);
  assert.match(html, /ref\(almacen, ruta\)/);
});

test('solo lectura de Storage: ni subidas, ni borrados, ni escrituras (R2)', () => {
  for (const prohibido of ['uploadBytes', 'uploadString', 'deleteObject', 'uploadBytesResumable']) {
    assert.ok(!html.includes(prohibido), prohibido);
    assert.ok(!pdfJs.includes(prohibido), prohibido);
  }
  assert.match(html, /getDownloadURL\(/);
});

test('«Imprimir» pide la URL del PDF archivado y la abre en una pestaña nueva (R1, D2)', () => {
  assert.match(html, /getStorage\(app\)/);
  assert.match(html, /ref\(almacen, ruta\)/);
  assert.match(html, /window\.open\(""?, "_blank"\)/);
  assert.match(html, /obtenerPdfOC\(\{ numero/);
  assert.match(html, /\.location\.href = resultado\.url/);
  assert.match(html, /opener = null/); // la pestaña del PDF no conserva referencia a la pantalla
});

test('la pestaña se abre al pulsar (antes de esperar a Storage) para que el bloqueador de ventanas no la corte', () => {
  const iAbre = html.indexOf('window.open(');
  const iEspera = html.indexOf('await obtenerPdfOC(');
  assert.ok(iAbre > 0 && iEspera > iAbre);
});

test('si el archivo no existe o hay error, la ventana muestra el aviso y el botón de la vista simple (R3, R4, D3)', () => {
  for (const id of ['aviso-impresion', 'aviso-impresion-texto', 'btn-imprimir-simple']) {
    assert.match(html, new RegExp(`id="${id}"`), id);
  }
  assert.match(html, /Imprimir vista simple/);
  assert.match(html, /getElementById\("btn-imprimir-simple"\)|\$\("btn-imprimir-simple"\)/);
  assert.match(html, /resultado\.estado === "sin-archivo"/);
  assert.match(html, /resultado\.mensaje/);
});

test('la vista simple (htmlImpresion y zona de impresión) se conserva como respaldo (R5)', () => {
  assert.match(html, /htmlImpresion\(orden\)/);
  assert.match(html, /\$\("zona-impresion"\)\.innerHTML = contenido/);
  assert.match(html, /window\.print\(\)/);
});

test('el aviso de impresión se oculta al abrir otra orden (no arrastra un aviso de la anterior)', () => {
  const iAbrir = html.indexOf('function abrirOrden(orden)');
  assert.ok(iAbrir > 0);
  assert.match(html.slice(iAbrir, iAbrir + 500), /ocultarAvisoImpresion\(\);/);
});

test('los textos del aviso y el error se escriben con textContent, nunca con innerHTML (AUD-01)', () => {
  const trozo = html.slice(html.indexOf('async function imprimirPdfOC'), html.indexOf('async function imprimirPdfOC') + 2500);
  assert.ok(trozo.length > 500, 'existe la función imprimirPdfOC');
  assert.ok(!/aviso-impresion-texto"\)\.innerHTML/.test(html));
  assert.match(html, /\$\("aviso-impresion-texto"\)\.textContent/);
});

test('el resto de la ventana no cambia: Enviar por correo, Anular y Ver / imprimir siguen igual (CA5)', () => {
  assert.match(html, /id="btn-enviar-correo"/);
  assert.match(html, /id="btn-imprimir"/);
  assert.match(html, /\$\("btn-enviar-correo"\)\.addEventListener\("click"/);
  assert.match(html, /accion === "ver-orden"/);
  assert.match(html, /accion !== "anular-orden"/);
});

test('el módulo nuevo no escribe en Firestore ni toca reglas: es lógica pura con la lectura inyectada', () => {
  for (const prohibido of ['firebase', 'getFirestore', 'setDoc', 'updateDoc', 'deleteDoc', 'addDoc', 'document.']) {
    assert.ok(!pdfJs.includes(prohibido), prohibido);
  }
});
