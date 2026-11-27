// Spec 082 etapa 1 (directriz B6): resumen de un informe con IA en informe-revision.html. Lógica sin Firebase ni DOM real.
// Ejecutar: node --test public/js/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FUNCION_INFORME, MAX_NOTAS, AVISO_IA, MENSAJE_APROBADO, MENSAJE_GENERICO,
  estadoControlesIA, validarNotas, textoContador, textoBase, mensajeErrorIA, solicitarResumenInforme, pintarPropuesta,
} from './ia-informe.js';

const RESUMEN = { titulo: 'Mantención de sepultura', resumen: 'Se limpió la lápida y se retiró la maleza.', tareas: ['Limpieza de lápida', 'Retiro de maleza'], alertas: ['Grieta en la base'], modelo: 'gemini-3.5-flash', generadoEl: '2026-11-27T12:00:00.000Z', generadoPor: 'uid1' };

/** `llamar` simulado: anota cada llamada y responde lo que se le diga. */
function llamarSimulado(respuesta) {
  const llamadas = [];
  const llamar = async (datos) => { llamadas.push(datos); if (respuesta instanceof Error) throw respuesta; return respuesta; };
  return { llamar, llamadas };
}

/** Error como el que entrega httpsCallable: `code` con prefijo `functions/` y el mensaje de la función. */
const errorFunciones = (code, message) => Object.assign(new Error(message), { code: `functions/${code}` });

// ───────── Constantes de la spec ─────────

test('constantes: función, límite de notas y textos exactos de la spec 082', () => {
  assert.equal(FUNCION_INFORME, 'redactarInformeIA');
  assert.equal(MAX_NOTAS, 4000);
  assert.equal(AVISO_IA, 'La IA puede equivocarse: revisa antes de usar. No escribas RUT, correo ni teléfono.');
  assert.equal(MENSAJE_APROBADO, 'El informe ya está aprobado.');
  assert.equal(MENSAJE_GENERICO, 'No pudimos generar la propuesta en este momento. No se guardó nada. Intenta de nuevo más tarde.');
});

// ───────── R8 / CA2: informe aprobado ─────────

test('estadoControlesIA: informe aprobado → botón deshabilitado con «El informe ya está aprobado.»', () => {
  assert.deepEqual(estadoControlesIA({ estadoNorm: 'aprobado', enCurso: false }), { deshabilitado: true, aviso: 'El informe ya está aprobado.' });
});

test('estadoControlesIA: pendiente y rechazado habilitan; mientras responde se deshabilita sin aviso (R2)', () => {
  assert.deepEqual(estadoControlesIA({ estadoNorm: 'pendiente', enCurso: false }), { deshabilitado: false, aviso: '' });
  assert.deepEqual(estadoControlesIA({ estadoNorm: 'rechazado', enCurso: false }), { deshabilitado: false, aviso: '' });
  assert.deepEqual(estadoControlesIA({ estadoNorm: 'pendiente', enCurso: true }), { deshabilitado: true, aviso: '' });
});

test('estadoControlesIA: aprobado gana sobre enCurso (el aviso se mantiene)', () => {
  assert.equal(estadoControlesIA({ estadoNorm: 'aprobado', enCurso: true }).aviso, MENSAJE_APROBADO);
});

// ───────── R7 / CA3: notas ─────────

test('validarNotas: vacías o solo espacios no se envían', () => {
  assert.equal(validarNotas('').ok, false);
  assert.equal(validarNotas('   \n ').ok, false);
  assert.match(validarNotas('').error, /Escribe las notas del operador/);
  assert.equal(validarNotas(undefined).ok, false);
  assert.equal(validarNotas(null).ok, false);
});

test('validarNotas: 4000 caracteres pasan; 4001 no (CA3) y avisa del límite', () => {
  assert.equal(validarNotas('a'.repeat(4000)).ok, true);
  const r = validarNotas('a'.repeat(4001));
  assert.equal(r.ok, false);
  assert.match(r.error, /hasta 4000 caracteres/);
});

test('textoContador: «n / 4000» con separador de miles', () => {
  assert.equal(textoContador(''), '0 / 4000');
  assert.equal(textoContador('hola'), '4 / 4000');
  assert.equal(textoContador('a'.repeat(4001)), '4001 / 4000');
  assert.equal(textoContador(null), '0 / 4000');
});

// ───────── solicitarResumenInforme ─────────

test('CA1: con notas válidas llama una vez con { informeId, notasBrutas } y devuelve la propuesta', async () => {
  const { llamar, llamadas } = llamarSimulado({ ok: true, resumenIA: RESUMEN });
  const r = await solicitarResumenInforme({ llamar, informeId: 'ORD-123456-V1', notas: 'Se limpió la lápida.', estadoNorm: 'pendiente' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.resumenIA, RESUMEN);
  assert.deepEqual(llamadas, [{ informeId: 'ORD-123456-V1', notasBrutas: 'Se limpió la lápida.' }]);
});

test('CA2: informe aprobado → no llama a la función y devuelve el mensaje', async () => {
  const { llamar, llamadas } = llamarSimulado({ ok: true, resumenIA: RESUMEN });
  const r = await solicitarResumenInforme({ llamar, informeId: 'ORD-123456-V1', notas: 'texto', estadoNorm: 'aprobado' });
  assert.equal(r.ok, false);
  assert.equal(r.mensaje, 'El informe ya está aprobado.');
  assert.equal(llamadas.length, 0);
});

test('CA3: notas de 4001 caracteres → no llama a la función y avisa del límite', async () => {
  const { llamar, llamadas } = llamarSimulado({ ok: true, resumenIA: RESUMEN });
  const r = await solicitarResumenInforme({ llamar, informeId: 'ORD-123456-V1', notas: 'a'.repeat(4001), estadoNorm: 'pendiente' });
  assert.equal(r.ok, false);
  assert.match(r.mensaje, /hasta 4000 caracteres/);
  assert.equal(llamadas.length, 0);
});

test('notas vacías → no llama a la función', async () => {
  const { llamar, llamadas } = llamarSimulado({ ok: true, resumenIA: RESUMEN });
  const r = await solicitarResumenInforme({ llamar, informeId: 'ORD-123456-V1', notas: '  ', estadoNorm: 'pendiente' });
  assert.equal(r.ok, false);
  assert.equal(llamadas.length, 0);
});

test('informe sin identificador → no llama a la función', async () => {
  const { llamar, llamadas } = llamarSimulado({ ok: true, resumenIA: RESUMEN });
  for (const informeId of [undefined, '', null, 42]) {
    const r = await solicitarResumenInforme({ llamar, informeId, notas: 'texto', estadoNorm: 'pendiente' });
    assert.equal(r.ok, false);
  }
  assert.equal(llamadas.length, 0);
});

test('CA10 y R3: el mensaje de cuota agotada se muestra tal cual lo devuelve la función', async () => {
  const msg = 'Llegaste al límite de 5 propuestas de IA por día. Podrás usarla de nuevo mañana.';
  const { llamar } = llamarSimulado(errorFunciones('resource-exhausted', msg));
  const r = await solicitarResumenInforme({ llamar, informeId: 'ORD-123456-V1', notas: 'texto', estadoNorm: 'pendiente' });
  assert.deepEqual(r, { ok: false, mensaje: msg });
});

test('R3: los demás mensajes de la función también van tal cual', async () => {
  for (const msg of ['Debes iniciar sesión para usar esta función.', 'No tienes permiso para usar esta función.', 'El informe ya está aprobado y no se puede modificar.', 'No existe ese informe.']) {
    const { llamar } = llamarSimulado(errorFunciones('permission-denied', msg));
    const r = await solicitarResumenInforme({ llamar, informeId: 'ORD-123456-V1', notas: 'texto', estadoNorm: 'pendiente' });
    assert.equal(r.mensaje, msg);
  }
});

test('CA12: si la función no responde (error de red) se muestra el mensaje genérico, sin texto técnico', async () => {
  for (const e of [new TypeError('Failed to fetch'), errorFunciones('unavailable', 'unavailable'), errorFunciones('internal', 'internal'), errorFunciones('deadline-exceeded', 'deadline-exceeded'), new Error('')]) {
    const { llamar } = llamarSimulado(e);
    const r = await solicitarResumenInforme({ llamar, informeId: 'ORD-123456-V1', notas: 'texto', estadoNorm: 'pendiente' });
    assert.equal(r.ok, false);
    assert.equal(r.mensaje, MENSAJE_GENERICO);
  }
});

test('el mensaje que ya trae la función para un fallo interno se conserva (no es técnico)', async () => {
  const { llamar } = llamarSimulado(errorFunciones('internal', MENSAJE_GENERICO));
  const r = await solicitarResumenInforme({ llamar, informeId: 'ORD-123456-V1', notas: 'texto', estadoNorm: 'pendiente' });
  assert.equal(r.mensaje, MENSAJE_GENERICO);
});

test('una respuesta sin resumenIA válido no se muestra: mensaje genérico', async () => {
  for (const respuesta of [undefined, null, {}, { ok: true }, { ok: true, resumenIA: 'texto' }, { ok: true, resumenIA: {} }, { ok: true, resumenIA: { titulo: 'a', resumen: 'b', tareas: 'no es lista', alertas: [] } }]) {
    const { llamar } = llamarSimulado(respuesta);
    const r = await solicitarResumenInforme({ llamar, informeId: 'ORD-123456-V1', notas: 'texto', estadoNorm: 'pendiente' });
    assert.equal(r.ok, false);
    assert.equal(r.mensaje, MENSAJE_GENERICO);
  }
});

test('mensajeErrorIA: mensaje no textual o nulo → genérico', () => {
  assert.equal(mensajeErrorIA(null), MENSAJE_GENERICO);
  assert.equal(mensajeErrorIA(undefined), MENSAJE_GENERICO);
  assert.equal(mensajeErrorIA({ message: 42 }), MENSAJE_GENERICO);
  assert.equal(mensajeErrorIA(new Error('  Solo el dueño puede usar esta función. ')), 'Solo el dueño puede usar esta función.');
});

// ───────── R9 / CA4: «Usar como base» ─────────

test('textoBase: título, resumen, tareas y alertas en texto plano', () => {
  assert.equal(textoBase(RESUMEN), [
    'Mantención de sepultura', '', 'Se limpió la lápida y se retiró la maleza.', '', 'Tareas:', '- Limpieza de lápida', '- Retiro de maleza', '', 'Alertas:', '- Grieta en la base',
  ].join('\n'));
});

test('textoBase: sin tareas ni alertas omite esas secciones', () => {
  assert.equal(textoBase({ titulo: 'T', resumen: 'R', tareas: [], alertas: [] }), 'T\n\nR');
});

test('textoBase no modifica la propuesta ni escribe nada (CA4: copiar no guarda)', () => {
  const copia = JSON.parse(JSON.stringify(RESUMEN));
  textoBase(RESUMEN);
  assert.deepEqual(RESUMEN, copia);
});

// ───────── R4 / CA11: la propuesta se pinta como texto ─────────

/** DOM mínimo: lo único que `pintarPropuesta` puede usar. Pintar con innerHTML lanza. */
function documentoFalso() {
  const creados = [];
  const crear = (tag) => {
    const el = {
      tagName: String(tag).toUpperCase(), hijos: [], _texto: '', className: '',
      appendChild(h) { this.hijos.push(h); return h; },
      set textContent(v) { this._texto = String(v); this.hijos = []; },
      get textContent() { return this._texto + this.hijos.map((h) => h.textContent).join(''); },
      set innerHTML(_) { throw new Error('innerHTML no se debe usar con texto de la IA'); },
      get innerHTML() { throw new Error('innerHTML no se debe usar con texto de la IA'); },
    };
    creados.push(el);
    return el;
  };
  return { createElement: crear, creados };
}

test('CA11: una propuesta con <script> y HTML se ve como texto y no crea elementos de esas etiquetas', () => {
  const hostil = { titulo: '<img src=x onerror=alert(1)>', resumen: '<script>alert(1)</script> & "comillas"', tareas: ['<b>negrita</b>'], alertas: ['</li><script>x</script>'] };
  const doc = documentoFalso();
  const destino = doc.createElement('div');
  pintarPropuesta(doc, destino, hostil);
  const etiquetas = doc.creados.map((e) => e.tagName);
  assert.ok(!etiquetas.includes('SCRIPT'));
  assert.ok(!etiquetas.includes('IMG'));
  assert.ok(!etiquetas.includes('B'));
  const texto = destino.textContent;
  for (const t of [hostil.titulo, hostil.resumen, hostil.tareas[0], hostil.alertas[0]]) assert.ok(texto.includes(t), t);
});

test('pintarPropuesta: muestra título, resumen, tareas y alertas, y repinta sin acumular', () => {
  const doc = documentoFalso();
  const destino = doc.createElement('div');
  pintarPropuesta(doc, destino, RESUMEN);
  pintarPropuesta(doc, destino, RESUMEN);
  const texto = destino.textContent;
  assert.equal(texto.split('Mantención de sepultura').length - 1, 1);
  for (const t of ['Se limpió la lápida', 'Limpieza de lápida', 'Retiro de maleza', 'Grieta en la base']) assert.ok(texto.includes(t), t);
});

test('pintarPropuesta: sin alertas ni tareas no pinta esos encabezados', () => {
  const doc = documentoFalso();
  const destino = doc.createElement('div');
  pintarPropuesta(doc, destino, { titulo: 'T', resumen: 'R', tareas: [], alertas: [] });
  assert.ok(!destino.textContent.includes('Alertas'));
  assert.ok(!destino.textContent.includes('Tareas'));
});
