// Spec 082 etapa 1: informe-revision.html con «Redactar resumen con IA» y «Usar como base». Aditivo: lo existente no cambia.
// Ejecutar: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AVISO_IA, MENSAJE_APROBADO, MAX_NOTAS } from '../public/js/ia-informe.js';

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const html = readFileSync(join(PUBLIC, 'informe-revision.html'), 'utf8').replace(/\r/g, '');
const script = html.slice(html.indexOf('<script type="module">'));

test('importa el módulo de IA y carga el SDK de Functions solo al pulsar el botón (si falla, el resto de la pantalla sigue)', () => {
  assert.match(script, /from "\.\/js\/ia-informe\.js\?v=ia1"/);
  assert.match(script, /await import\("https:\/\/www\.gstatic\.com\/firebasejs\/10\.7\.0\/firebase-functions\.js"\)/);
  assert.match(script, /httpsCallable\(getFunctions\(app, "us-central1"\), FUNCION_INFORME\)/);
  // No se importa de forma estática: el SDK de Functions no debe poder romper la carga de la página.
  assert.doesNotMatch(script, /^\s*import [^\n]*firebase-functions\.js/m);
});

test('el bloque de IA tiene sus controles, el aviso exacto y el contador', () => {
  for (const id of ['ia-bloque', 'ia-notas', 'ia-contador', 'ia-btn-redactar', 'ia-aviso-aprobado', 'ia-error', 'ia-propuesta-wrap', 'ia-propuesta', 'ia-btn-base', 'ia-base-wrap', 'ia-base']) {
    assert.match(html, new RegExp(`id="${id}"`), id);
  }
  assert.ok(html.includes(AVISO_IA), 'aviso R5');
  assert.ok(html.includes('Redactar resumen con IA'));
  assert.ok(html.includes('Propuesta de la IA'));
  assert.ok(html.includes('Usar como base'));
  assert.match(html, new RegExp(`0 / ${MAX_NOTAS}`));
});

test('el bloque va dentro del modal de revisión, antes de las acciones de aprobar y rechazar', () => {
  const modal = html.indexOf('id="modal-revision"');
  const ia = html.indexOf('id="ia-bloque"');
  const acciones = html.indexOf('id="modal-acciones"');
  assert.ok(modal > 0 && ia > modal && ia < acciones);
});

test('la propuesta de la IA solo se pinta con el módulo (textContent): ningún innerHTML con IA', () => {
  assert.match(script, /pintarPropuesta\(document, \$ia\(['"]propuesta['"]\), /);
  const lineas = script.split('\n').filter((l) => /innerHTML/.test(l));
  for (const l of lineas) assert.doesNotMatch(l, /resumenIA|propuesta|ia-|textoBase|iaBase/i, l);
  assert.doesNotMatch(script, /\.ia[A-Za-z]*\.innerHTML|\$ia\([^)]*\)\.innerHTML/);
});

test('«Usar como base» solo copia al campo editable: no escribe en Firestore', () => {
  const i = script.indexOf('function usarComoBase');
  assert.ok(i > 0, 'existe usarComoBase');
  const cuerpo = script.slice(i, script.indexOf('\n    }', i));
  assert.match(cuerpo, /textoBase\(/);
  assert.doesNotMatch(cuerpo, /setDoc|updateDoc|addDoc|deleteDoc|writeBatch|runTransaction/);
});

test('R10: la pantalla no escribe nada nuevo en Firestore (solo las 2+2 escrituras de aprobar y rechazar de siempre)', () => {
  assert.equal((script.match(/\bsetDoc\(/g) || []).length, 2);
  assert.equal((script.match(/\bupdateDoc\(/g) || []).length, 2);
  assert.doesNotMatch(script, /resumenIA\s*:/);
  assert.doesNotMatch(script, /addDoc|deleteDoc|writeBatch|runTransaction/);
});

test('mientras responde se deshabilita el botón y se rehabilita al terminar (R2); el flujo manual no depende de la IA (R6)', () => {
  const i = script.indexOf('async function redactarResumen');
  assert.ok(i > 0, 'existe redactarResumen');
  const cuerpo = script.slice(i, script.indexOf('\n    }', i));
  assert.match(cuerpo, /iaEnCurso = true/);
  assert.match(cuerpo, /finally/);
  assert.match(cuerpo, /iaEnCurso = false/);
  assert.match(cuerpo, /solicitarResumenInforme\(/);
  // aprobar / rechazar / cerrar siguen sin mencionar la IA
  const aprobar = script.slice(script.indexOf('window.aprobarInforme'), script.indexOf('window.confirmarRechazoInforme'));
  assert.doesNotMatch(aprobar, /ia[A-Z]|solicitarResumenInforme|FUNCION_INFORME/);
});

test('informe aprobado: el estado de los controles sale del módulo (CA2) y el texto está en el módulo', () => {
  assert.match(script, /estadoControlesIA\(\{ estadoNorm: /);
  assert.equal(MENSAJE_APROBADO, 'El informe ya está aprobado.');
});

test('sin claves ni llamadas al modelo desde el navegador', () => {
  const nuevo = html.slice(html.indexOf('id="ia-bloque"'), html.indexOf('id="modal-acciones"')) + script;
  assert.doesNotMatch(nuevo, /AIza[0-9A-Za-z_-]{20,}|generativelanguage|aiplatform\.googleapis|vertex|gemini/i);
  assert.doesNotMatch(nuevo, /fetch\(/);
});

test('lo existente se conserva: modal, acciones de aprobar/rechazar y control de acceso', () => {
  for (const t of ['Aprobar y Certificar', 'Rechazar Informe', 'Observaciones Técnicas del Operador', 'Labores Ejecutadas por el Operador', 'exigirStaff(auth, user)', 'window.aprobarInforme', 'window.confirmarRechazoInforme']) {
    assert.ok(html.includes(t), t);
  }
});
