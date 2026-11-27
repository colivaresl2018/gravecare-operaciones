/**
 * ia-rutas.js — «Sugerir rutas con IA» en Planificación, solo para el dueño (spec 082, etapa 3 / directriz B6).
 *
 * El dueño elige una fecha; la pantalla junta las visitas PENDIENTES de ese día («sepulturas», hasta 200, con id y cementerioId) y
 * los operadores (hasta 20, con uid) y llama a `sugerirRutasIA`. La función deja la propuesta en `rutasSugeridas/{fecha}` y la devuelve.
 * Es INFORMATIVA (R16): este módulo no aplica nada, no cambia órdenes, agenda ni configuración de rutas y no escribe datos.
 * A la función solo viajan ids (nunca nombres de clientes ni de personas); los nombres se usan aquí para mostrar.
 * Sin Firebase ni DOM real: la llamada (`llamar`), la lectura (`leer`) y el documento se inyectan, así se prueba con `node --test`.
 * Todo texto que viene de la IA, de Firestore o de la propuesta se pinta con textContent, nunca como HTML (R4).
 */
import { esFechaIso } from './fechas-semana.js';
import { normalizarNombre } from './rutas-planificacion.js';
import { visitaEditable, textoVisitaEdicion } from './planificacion-edicion.js';
import { mensajeErrorIA, MENSAJE_GENERICO } from './ia-informe.js';

export const FUNCION_RUTAS = 'sugerirRutasIA';
export const MAX_SEPULTURAS = 200;
export const MAX_OPERADORES = 20;
export const MENSAJE_SOLO_DUENO = 'Solo el dueño puede usar esta función.';
export const MENSAJE_SIN_SUGERENCIA = 'No hay una sugerencia guardada para esa fecha.';
export const MENSAJE_LECTURA = 'No se pudo leer la sugerencia guardada. Intenta de nuevo más tarde.';

const MENSAJE_FECHA = 'Elige la fecha (AAAA-MM-DD).';
const RE_ID = /^[A-Za-z0-9_-]{1,80}$/; // mismas formas que acepta la función
const RE_UID = /^[A-Za-z0-9_-]{1,128}$/;
const texto = (v) => String(v ?? '').trim();
const esObjeto = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

/** Solo el dueño (`dueno === true` en staff/{uid}); el administrador, el supervisor y el operador no. */
export function esDueno(perfil) {
  return esObjeto(perfil) && perfil.dueno === true;
}

/** Identificador estable del cementerio a partir de su nombre («Parque del Recuerdo» → «parque-del-recuerdo»); vacío si no hay. */
export function idCementerio(nombre) {
  return normalizarNombre(nombre).replace(/ /g, '-').slice(0, 80).replace(/-+$/, '');
}

/**
 * Visitas pendientes de la fecha: no realizadas ni en revisión, con cementerio conocido. Cada una es una «sepultura»
 * `{ id: '<ordenId>-V<n>', cementerioId }`. Las que no tienen cementerio o cuyo id no sirve se omiten y se cuentan.
 * @returns {{sepulturas: Array<{id: string, cementerioId: string}>, omitidas: number, nombresCementerio: object, etiquetas: object}}
 */
export function sepulturasPendientes(filas, fecha) {
  const sepulturas = [];
  const nombresCementerio = {};
  const etiquetas = {};
  const vistas = new Set();
  let omitidas = 0;
  for (const f of Array.isArray(filas) ? filas : []) {
    if (!esObjeto(f) || f.fechaIso !== fecha || !visitaEditable(f)) continue;
    const cementerioId = idCementerio(f.cementerio);
    const id = `${texto(f.docId)}-V${texto(f.visitaNumero)}`;
    if (!cementerioId || !RE_ID.test(id)) { omitidas += 1; continue; }
    if (vistas.has(id)) continue;
    vistas.add(id);
    sepulturas.push({ id, cementerioId });
    if (!nombresCementerio[cementerioId]) nombresCementerio[cementerioId] = texto(f.cementerio);
    etiquetas[id] = `${texto(f.numeroOrden) || texto(f.docId)} · ${textoVisitaEdicion(f)} · ${texto(f.cliente) || 'Sin registrar'}`;
  }
  return { sepulturas, omitidas, nombresCementerio, etiquetas };
}

/** Personal activo que se puede elegir: `{ uid, nombre }` (nombre o correo), con uid válido, ordenado por nombre. */
export function operadoresDisponibles(docsStaff) {
  const lista = [];
  for (const item of Array.isArray(docsStaff) ? docsStaff : []) {
    const d = item && esObjeto(item.data) ? item.data : null;
    if (!d || d.activo === false || typeof item.id !== 'string' || !RE_UID.test(item.id)) continue;
    const nombre = texto(d.nombre) || texto(d.email);
    if (nombre) lista.push({ uid: item.id, nombre });
  }
  return lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

/** R15: fecha real, de 1 a 200 sepulturas y de 1 a 20 operadores. Devuelve { ok, error }. */
export function validarSolicitud({ fecha, sepulturas, operadores } = {}) {
  if (typeof fecha !== 'string' || !esFechaIso(fecha)) return { ok: false, error: MENSAJE_FECHA };
  const nS = Array.isArray(sepulturas) ? sepulturas.length : 0;
  if (nS < 1) return { ok: false, error: 'No hay visitas pendientes para esa fecha.' };
  if (nS > MAX_SEPULTURAS) return { ok: false, error: `Hay ${nS} visitas pendientes ese día; el máximo es ${MAX_SEPULTURAS}.` };
  const nO = Array.isArray(operadores) ? operadores.length : 0;
  if (nO < 1) return { ok: false, error: 'Elige al menos un operador.' };
  if (nO > MAX_OPERADORES) return { ok: false, error: `Elige hasta ${MAX_OPERADORES} operadores.` };
  return { ok: true, error: '' };
}

/** Forma de los itinerarios: [{ operadorUid, cementerios: [{ cementerioId, sepulturas: [string] }] }]. */
function itinerariosBienFormados(it) {
  return Array.isArray(it) && it.every((x) => esObjeto(x) && typeof x.operadorUid === 'string' && Array.isArray(x.cementerios)
    && x.cementerios.every((c) => esObjeto(c) && typeof c.cementerioId === 'string' && Array.isArray(c.sepulturas) && c.sepulturas.every((s) => typeof s === 'string')));
}

/** CA9: cada sepultura pedida aparece exactamente una vez, bajo su cementerio y con un operador elegido; no sobra ninguna. */
function cubreExactamente(itinerarios, sepulturas, operadores) {
  const cementerioDe = new Map(sepulturas.map((s) => [s.id, s.cementerioId]));
  const uids = new Set(operadores.map((o) => o.uid));
  const vistas = new Set();
  for (const it of itinerarios) {
    if (!uids.has(it.operadorUid)) return false;
    for (const c of it.cementerios) {
      for (const id of c.sepulturas) {
        if (cementerioDe.get(id) !== c.cementerioId || vistas.has(id)) return false;
        vistas.add(id);
      }
    }
  }
  return vistas.size === sepulturas.length;
}

/**
 * Pide la sugerencia. Nunca lanza: devuelve { ok:true, fecha, itinerarios } o { ok:false, mensaje }.
 * Si no es dueño o la solicitud no vale, NO se llama a la función. Una respuesta que no cubre cada sepultura exactamente
 * una vez no se muestra. A la función solo viajan ids: operadores como `{ uid }`.
 * @param {{dueno: boolean, fecha: string, sepulturas: Array<{id: string, cementerioId: string}>, operadores: Array<{uid: string, nombre?: string}>,
 *          llamar: (datos: object) => Promise<any>}} p
 */
export async function solicitarRutas({ dueno, fecha, sepulturas, operadores, llamar }) {
  if (dueno !== true) return { ok: false, mensaje: MENSAJE_SOLO_DUENO };
  const v = validarSolicitud({ fecha, sepulturas, operadores });
  if (!v.ok) return { ok: false, mensaje: v.error };
  let respuesta;
  try {
    respuesta = await llamar({ fecha, sepulturas, operadores: operadores.map((o) => ({ uid: o.uid })) });
  } catch (e) {
    return { ok: false, mensaje: mensajeErrorIA(e) };
  }
  const bien = esObjeto(respuesta) && respuesta.ok === true && respuesta.fecha === fecha && itinerariosBienFormados(respuesta.itinerarios)
    && cubreExactamente(respuesta.itinerarios, sepulturas, operadores);
  if (!bien) return { ok: false, mensaje: MENSAJE_GENERICO };
  return { ok: true, fecha, itinerarios: respuesta.itinerarios };
}

/**
 * R16: vuelve a leer `rutasSugeridas/{fecha}` (solo lectura). `leer(fecha)` entrega los datos del documento o null.
 * @returns {Promise<{ok: true, fecha: string, itinerarios: object[], generadoEl: string} | {ok: false, mensaje: string}>}
 */
export async function leerSugerencia({ fecha, leer }) {
  if (typeof fecha !== 'string' || !esFechaIso(fecha)) return { ok: false, mensaje: MENSAJE_FECHA };
  let datos;
  try {
    datos = await leer(fecha);
  } catch (e) {
    return { ok: false, mensaje: MENSAJE_LECTURA };
  }
  if (datos === null || datos === undefined) return { ok: false, mensaje: MENSAJE_SIN_SUGERENCIA };
  if (!esObjeto(datos) || !itinerariosBienFormados(datos.itinerarios)) return { ok: false, mensaje: MENSAJE_LECTURA };
  return { ok: true, fecha, itinerarios: datos.itinerarios, generadoEl: typeof datos.generadoEl === 'string' ? datos.generadoEl : '' };
}

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

/** «5 visitas · 2 cementerios · 2 operadores». */
export function textoResumen(itinerarios) {
  const lista = Array.isArray(itinerarios) ? itinerarios : [];
  const cementerios = new Set();
  let visitas = 0;
  for (const it of lista) for (const c of it.cementerios || []) { cementerios.add(c.cementerioId); visitas += (c.sepulturas || []).length; }
  return `${plural(visitas, 'visita', 'visitas')} · ${plural(cementerios.size, 'cementerio', 'cementerios')} · ${plural(lista.length, 'operador', 'operadores')}`;
}

function agregar(doc, padre, etiqueta, contenido, clases) {
  const el = doc.createElement(etiqueta);
  el.textContent = contenido; // R4: texto, nunca HTML
  if (clases) el.className = clases;
  padre.appendChild(el);
  return el;
}

/**
 * Pinta el itinerario por operador, agrupado por cementerio, dentro de `destino` y solo con textContent (repintar reemplaza lo anterior).
 * Es solo texto: no hay botones ni enlaces que apliquen la propuesta (R16). Sin nombre conocido se muestra el identificador.
 */
export function pintarItinerarios(doc, destino, itinerarios, { nombreOperador, nombreCementerio, etiquetaSepultura } = {}) {
  destino.textContent = '';
  const nombreDe = (fn, id) => (typeof fn === 'function' && texto(fn(id))) || id;
  for (const it of Array.isArray(itinerarios) ? itinerarios : []) {
    const caja = agregar(doc, destino, 'div', '', 'mb-3 p-3 rounded-lg border border-slate-200 bg-white');
    agregar(doc, caja, 'p', nombreDe(nombreOperador, it.operadorUid), 'text-xs font-bold text-[#002d1a]');
    for (const c of it.cementerios || []) {
      agregar(doc, caja, 'p', nombreDe(nombreCementerio, c.cementerioId), 'text-[10px] uppercase font-bold text-slate-500 mt-2');
      const ul = agregar(doc, caja, 'ul', '', 'list-disc list-inside text-slate-700');
      for (const id of c.sepulturas || []) agregar(doc, ul, 'li', nombreDe(etiquetaSepultura, id));
    }
  }
}
