// B-3: comprobaciones estáticas de public/gastos-ingresos.html (no ejecuta la página; la prueba de navegador está en tests/e2e).
// Ejecutar:  node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const html = readFileSync(join(PUBLIC, 'gastos-ingresos.html'), 'utf8').replace(/\r/g, '');

test('el formulario ofrece «Nota de Crédito Electrónica» y conserva los tipos de documento que ya existían', () => {
  for (const v of ['Factura Afecta', 'Factura Exenta', 'Boleta Honorarios', 'Boleta Venta', 'Voucher/Comprobante']) {
    assert.match(html, new RegExp(`<option value="${v}">`), `sigue existiendo ${v}`);
  }
  assert.match(html, /<option value="Nota de Crédito Electrónica">Nota de Crédito Electrónica<\/option>/);
});

test('el formulario trae los campos de la nota: boleta de referencia, folio y fecha, código, medio, motivo, visitas y término', () => {
  for (const id of ['form-nc-boleta', 'form-nc-folio-boleta', 'form-nc-fecha-boleta', 'form-nc-codigo', 'form-nc-medio', 'form-nc-motivo',
    'form-nc-visitas-contratadas', 'form-nc-visitas-ejecutadas', 'form-nc-termino', 'nc-avisos', 'bloque-nota-credito']) {
    assert.match(html, new RegExp(`id="${id}"`), `falta #${id}`);
  }
  assert.match(html, /<option value="1">1 · Anula documento<\/option>/);
  assert.match(html, /<option value="3">3 · Corrige montos<\/option>/);
  assert.match(html, /<option value="Reversa Transbank">/);
  assert.match(html, /<option value="Transferencia bancaria">/);
});

test('los campos propios de la nota no son «required» (el bloque está oculto en el resto de los documentos y bloquearía el envío)', () => {
  const bloque = html.slice(html.indexOf('id="bloque-nota-credito"'), html.indexOf('<div class="tax-box">'));
  assert.ok(bloque.length > 500);
  assert.doesNotMatch(bloque, /\brequired\b/);
});

test('no se piden ni guardan datos bancarios del cliente (fuera de B-3: solo el medio de devolución)', () => {
  assert.doesNotMatch(html, /n[uú]mero de cuenta|tipo de cuenta|cuenta corriente|cuenta vista|titular de la cuenta/i);
  assert.doesNotMatch(html, /id="form-nc-(banco|cuenta|titular)/);
});

test('las notas se guardan en la colección aditiva «notasCredito» y nunca se actualizan ni se borran desde la página', () => {
  assert.match(html, /addDoc\(collection\(db, "notasCredito"\)/);
  assert.match(html, /getDocs\(collection\(db, "notasCredito"\)\)/);
  assert.doesNotMatch(html, /(updateDoc|deleteDoc|setDoc)\(doc\(db, "notasCredito"/);
  // Las escrituras a gastos_ingresos siguen siendo las de antes (alta, adjuntar documento y eliminar manuales).
  assert.equal(html.split('addDoc(collection(db, "gastos_ingresos")').length - 1, 1);
  assert.equal(html.split('deleteDoc(doc(db, "gastos_ingresos"').length - 1, 1);
  assert.equal(html.split('updateDoc(doc(db, "gastos_ingresos"').length - 1, 1);
});

test('de «ordenes» solo se lee (contrato con la web) y el ingreso sigue pasando por cuentaComoIngreso', () => {
  assert.match(html, /import \{ cuentaComoIngreso, fechaDelIngreso \} from "\.\/js\/orden-pagada\.js"/);
  assert.match(html, /if \(totalBruto > 0 && cuentaComoIngreso\(ord\)\)/);
  assert.equal(html.split('getDocs(collection(db, "ordenes"))').length - 1, 1);
  // La única escritura a ordenes es la que ya existía: adjuntar el comprobante a una orden Webpay.
  assert.equal(html.split('updateDoc(doc(db, "ordenes"').length - 1, 1);
  assert.doesNotMatch(html, /addDoc\(collection\(db, "ordenes"\)|setDoc\(doc\(db, "ordenes"|deleteDoc\(doc\(db, "ordenes"/);
});

test('el guardado de la nota valida antes de subir archivos y los avisos de plazo no bloquean', () => {
  const iValida = html.indexOf('leerYValidarNota()', html.indexOf('async (e) => {\n      e.preventDefault();'));
  const iSube = html.indexOf('await uploadBytes(storageRef, archivoFacturaFormulario)');
  assert.ok(iValida > 0 && iSube > iValida, 'valida antes de subir el archivo');
  const funcAvisos = html.slice(html.indexOf('function actualizarAvisosNota'), html.indexOf('function leerYValidarNota'));
  assert.doesNotMatch(funcAvisos, /return false|preventDefault|confirm\(|disabled\s*=/, 'los avisos solo se muestran');
});

test('los plazos de 6 meses y 30 días están en el módulo (constantes), no escritos en la página', () => {
  assert.doesNotMatch(html, /PLAZO_MESES|PLAZO_DIAS|> ?180|> ?30\b/);
  const modulo = readFileSync(join(PUBLIC, 'js', 'notas-credito.js'), 'utf8');
  assert.match(modulo, /export const PLAZO_MESES_BOLETA_NOTA = 6;/);
  assert.match(modulo, /export const PLAZO_DIAS_TERMINO_SERVICIO = 30;/);
});

test('los módulos nuevos existen donde la página los importa', () => {
  for (const m of ['notas-credito.js', 'liquidacion-tributaria.js']) {
    assert.match(html, new RegExp(`from "\\./js/${m.replace('.', '\\.')}"`));
    assert.ok(existsSync(join(PUBLIC, 'js', m)));
  }
});

test('B-3 no agrega reglas ni cambia firebase.json: las reglas se publican desde el repo de la web', () => {
  const raiz = join(PUBLIC, '..');
  assert.equal(existsSync(join(raiz, 'firestore.rules')), false);
  assert.equal(existsSync(join(raiz, 'storage.rules')), false);
  assert.deepEqual(Object.keys(JSON.parse(readFileSync(join(raiz, 'firebase.json'), 'utf8'))), ['hosting']);
});
