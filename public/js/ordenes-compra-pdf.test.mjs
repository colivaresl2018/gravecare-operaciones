import test from 'node:test';
import assert from 'node:assert/strict';
import { rutaPdfOC, obtenerPdfOC, MENSAJE_SIN_PDF } from './ordenes-compra-pdf.js';

// Spec 061 (backoffice): «Imprimir» abre el PDF archivado por la spec 060. Lógica pura: la lectura de Storage se inyecta (`obtenerUrl`).

// ---------- Ruta del PDF archivado (R1, spec 060)
test('rutaPdfOC: arma ordenesCompra/{numero}/{numero}.pdf para un número OC-NNNN', () => {
  assert.equal(rutaPdfOC('OC-0002'), 'ordenesCompra/OC-0002/OC-0002.pdf');
  assert.equal(rutaPdfOC('OC-12345'), 'ordenesCompra/OC-12345/OC-12345.pdf');
});

test('rutaPdfOC: rechaza números fuera del patrón OC-NNNN (sin rutas con «../» ni nombres libres)', () => {
  for (const malo of ['../OC-0002', 'OC-2', 'oc-0002', 'OC-0002/x', 'OC-0002.pdf', '', undefined, null, 17]) {
    assert.throws(() => rutaPdfOC(malo), /no válido/, String(malo));
  }
});

// ---------- Lectura (CA1, CA2, CA3)
test('obtenerPdfOC: con archivo en Storage devuelve la URL de descarga de su ruta exacta (CA1)', async () => {
  const pedidas = [];
  const obtenerUrl = async (ruta) => { pedidas.push(ruta); return 'https://storage.example.test/OC-0002.pdf?token=t'; };
  const r = await obtenerPdfOC({ numero: 'OC-0002', obtenerUrl });
  assert.deepEqual(r, { estado: 'listo', url: 'https://storage.example.test/OC-0002.pdf?token=t' });
  assert.deepEqual(pedidas, ['ordenesCompra/OC-0002/OC-0002.pdf']);
});

test('obtenerPdfOC: si el archivo no existe (OC anterior a la 060) → sin-archivo con el aviso de R3 (CA2)', async () => {
  const obtenerUrl = async () => { throw Object.assign(new Error('No object exists'), { code: 'storage/object-not-found' }); };
  const r = await obtenerPdfOC({ numero: 'OC-0002', obtenerUrl });
  assert.equal(r.estado, 'sin-archivo');
  assert.equal(r.mensaje, MENSAJE_SIN_PDF);
  assert.match(MENSAJE_SIN_PDF, /aún no tiene PDF archivado: se archiva al enviarla por correo/);
});

test('obtenerPdfOC: un fallo de red da error con texto en español, sin el mensaje crudo del SDK (CA3)', async () => {
  const obtenerUrl = async () => { throw new TypeError('Failed to fetch'); };
  const r = await obtenerPdfOC({ numero: 'OC-0002', obtenerUrl });
  assert.equal(r.estado, 'error');
  assert.match(r.mensaje, /No se pudo abrir el PDF archivado/);
  assert.match(r.mensaje, /vista simple/);
  assert.ok(!r.mensaje.includes('Failed to fetch'));
});

test('obtenerPdfOC: sin permiso (storage/unauthorized) da error de permiso, no «sin archivo» (CA4)', async () => {
  for (const code of ['storage/unauthorized', 'storage/unauthenticated']) {
    const obtenerUrl = async () => { throw Object.assign(new Error('denied'), { code }); };
    const r = await obtenerPdfOC({ numero: 'OC-0002', obtenerUrl });
    assert.equal(r.estado, 'error', code);
    assert.match(r.mensaje, /permiso/, code);
  }
});

test('obtenerPdfOC: un número no válido da error sin llamar a Storage', async () => {
  let llamadas = 0;
  const obtenerUrl = async () => { llamadas += 1; return 'x'; };
  const r = await obtenerPdfOC({ numero: '../OC-0002', obtenerUrl });
  assert.equal(r.estado, 'error');
  assert.equal(llamadas, 0);
});

test('obtenerPdfOC: nunca lanza; cualquier fallo se devuelve como estado para que la lista siga funcionando (R4)', async () => {
  const obtenerUrl = async () => { throw null; };
  const r = await obtenerPdfOC({ numero: 'OC-0002', obtenerUrl });
  assert.equal(r.estado, 'error');
});
