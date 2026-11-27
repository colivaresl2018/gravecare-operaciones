/**
 * ia-informe.js — «Redactar resumen con IA» en la revisión de informes (spec 082, etapa 1 / directriz B6).
 *
 * La IA PROPONE, nunca decide: la función `redactarInformeIA` deja el campo `informes/{id}.resumenIA` y devuelve la propuesta;
 * esta pantalla la muestra como texto de solo lectura. «Usar como base» copia el texto sin guardar nada.
 * Sin Firebase ni DOM real: la llamada a la función (`llamar`) y el documento se inyectan, así se prueba con `node --test`.
 *
 * - R2: mientras responde (hasta 120 s) el botón queda deshabilitado (cada intento que llega al modelo gasta 1 de 5 al día).
 * - R3: los errores de la función se muestran tal cual (ya vienen en español y sin detalles técnicos); si el fallo es de red
 *   o trae solo un código, se muestra el mensaje genérico de la spec.
 * - R4: todo texto de la IA se pinta con textContent, nunca con innerHTML.
 */

export const FUNCION_INFORME = 'redactarInformeIA';
export const MAX_NOTAS = 4000;
export const AVISO_IA = 'La IA puede equivocarse: revisa antes de usar. No escribas RUT, correo ni teléfono.';
export const MENSAJE_APROBADO = 'El informe ya está aprobado.';
export const MENSAJE_GENERICO = 'No pudimos generar la propuesta en este momento. No se guardó nada. Intenta de nuevo más tarde.';

const MENSAJE_NOTAS_VACIAS = 'Escribe las notas del operador.';
const MENSAJE_NOTAS_LARGAS = `Las notas pueden tener hasta ${MAX_NOTAS} caracteres.`;
const MENSAJE_SIN_INFORME = 'No se pudo identificar el informe.';

/** Estado de los controles: aprobado → deshabilitado con aviso (R8); respondiendo → deshabilitado (R2). */
export function estadoControlesIA({ estadoNorm, enCurso = false } = {}) {
  if (estadoNorm === 'aprobado') return { deshabilitado: true, aviso: MENSAJE_APROBADO };
  return { deshabilitado: Boolean(enCurso), aviso: '' };
}

/** Las notas deben existir y no pasar de 4000 caracteres (R7). Devuelve { ok, error }. */
export function validarNotas(notas) {
  const texto = typeof notas === 'string' ? notas : '';
  if (texto.trim() === '') return { ok: false, error: MENSAJE_NOTAS_VACIAS };
  if (texto.length > MAX_NOTAS) return { ok: false, error: MENSAJE_NOTAS_LARGAS };
  return { ok: true, error: '' };
}

/** Contador junto al campo de notas: «123 / 4000». */
export function textoContador(notas) {
  const n = typeof notas === 'string' ? notas.length : 0;
  return `${n} / ${MAX_NOTAS}`;
}

// Mensajes que el SDK entrega cuando la función no llegó a responder: no son de la función, no se muestran.
const MENSAJE_TECNICO = /^(internal|unavailable|deadline-exceeded|unknown|cancelled|failed to fetch|network ?error|load failed)\b/i;

/** Mensaje para el personal: el de la función tal cual (R3); sin texto útil o técnico → el genérico. */
export function mensajeErrorIA(e) {
  const texto = e && typeof e.message === 'string' ? e.message.trim() : '';
  if (!texto || MENSAJE_TECNICO.test(texto)) return MENSAJE_GENERICO;
  return texto;
}

const esTexto = (v) => typeof v === 'string' && v.trim() !== '';
const esLista = (v) => Array.isArray(v) && v.every((x) => typeof x === 'string');

/** La propuesta debe traer título, resumen y las dos listas; si no, no se muestra. */
function propuestaValida(r) {
  return Boolean(r) && typeof r === 'object' && esTexto(r.titulo) && esTexto(r.resumen) && esLista(r.tareas) && esLista(r.alertas);
}

/**
 * Pide la propuesta. Antes de llamar valida lo que se puede validar aquí (informe aprobado, notas, identificador): en esos
 * casos NO se llama a la función. Nunca lanza: devuelve { ok:true, resumenIA } o { ok:false, mensaje }.
 * @param {{llamar: (datos: object) => Promise<any>, informeId: string, notas: string, estadoNorm: string}} p
 */
export async function solicitarResumenInforme({ llamar, informeId, notas, estadoNorm }) {
  if (estadoNorm === 'aprobado') return { ok: false, mensaje: MENSAJE_APROBADO };
  if (typeof informeId !== 'string' || informeId.trim() === '') return { ok: false, mensaje: MENSAJE_SIN_INFORME };
  const v = validarNotas(notas);
  if (!v.ok) return { ok: false, mensaje: v.error };
  let respuesta;
  try {
    respuesta = await llamar({ informeId, notasBrutas: notas });
  } catch (e) {
    return { ok: false, mensaje: mensajeErrorIA(e) };
  }
  const resumenIA = respuesta && typeof respuesta === 'object' ? respuesta.resumenIA : null;
  if (!propuestaValida(resumenIA)) return { ok: false, mensaje: MENSAJE_GENERICO };
  return { ok: true, resumenIA };
}

/** Texto plano de la propuesta para «Usar como base». No guarda ni modifica nada. */
export function textoBase(resumenIA) {
  const r = resumenIA || {};
  const partes = [String(r.titulo || ''), '', String(r.resumen || '')];
  const tareas = Array.isArray(r.tareas) ? r.tareas : [];
  const alertas = Array.isArray(r.alertas) ? r.alertas : [];
  if (tareas.length) partes.push('', 'Tareas:', ...tareas.map((t) => `- ${t}`));
  if (alertas.length) partes.push('', 'Alertas:', ...alertas.map((a) => `- ${a}`));
  return partes.join('\n');
}

function agregar(doc, padre, etiqueta, texto, clases) {
  const el = doc.createElement(etiqueta);
  el.textContent = texto; // R4: texto, nunca HTML
  if (clases) el.className = clases;
  padre.appendChild(el);
  return el;
}

/** Pinta «Propuesta de la IA» (solo lectura) dentro de `destino`, solo con textContent; repintar reemplaza lo anterior. */
export function pintarPropuesta(doc, destino, resumenIA) {
  destino.textContent = '';
  const r = resumenIA || {};
  agregar(doc, destino, 'p', String(r.titulo || ''), 'font-bold text-slate-900');
  agregar(doc, destino, 'p', String(r.resumen || ''), 'text-slate-700 mt-1');
  const listas = [['Tareas', r.tareas], ['Alertas', r.alertas]];
  for (const [titulo, items] of listas) {
    if (!Array.isArray(items) || items.length === 0) continue;
    agregar(doc, destino, 'p', titulo, 'text-[10px] uppercase font-bold text-slate-400 mt-2');
    const ul = agregar(doc, destino, 'ul', '', 'list-disc list-inside text-slate-700');
    for (const item of items) agregar(doc, ul, 'li', String(item));
  }
}
