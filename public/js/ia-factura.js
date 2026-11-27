/**
 * ia-factura.js — «Crear borrador desde una factura PDF» en Órdenes de compra (spec 082, etapa 2 / directriz B6).
 *
 * Flujo (R11–R14): el personal elige un PDF (≤ 5 MB, solo application/pdf) y la fecha; la pantalla sube el archivo a
 * `Ordenes_Compra/<fecha>/<nombre aleatorio>.pdf` y llama a `procesarFacturaIA({ ruta })`. La función lee la factura y crea
 * `ordenesCompraBorradores/<fecha>`; aquí solo se muestran total, líneas y advertencias. Un borrador por día: si ya existe
 * NO se sube ni se llama (la función igual avisa antes de gastar una de las 5 consultas diarias, spec 084).
 * Este módulo NO emite la orden, no toca el contador de órdenes ni envía correo, y no escribe datos: solo arma la ruta
 * y coordina la subida y la llamada, que se inyectan (`subir`, `llamar`). Sin SDK ni DOM real: se prueba con `node --test`.
 * Todo texto que viene de la factura se pinta con textContent, nunca como HTML (R4).
 */
import { esFechaIso } from './fechas-semana.js';
import { mensajeErrorIA, MENSAJE_GENERICO } from './ia-informe.js';

export const FUNCION_FACTURA = 'procesarFacturaIA';
export const MAX_PDF_BYTES = 5 * 1024 * 1024;
export const MENSAJE_YA_EXISTE = 'Ya existe un borrador de orden de compra para esa fecha. No se guardó nada.';
export const MENSAJE_SUBIDA = 'No se pudo subir el archivo. No se guardó nada. Intenta de nuevo más tarde.';

const MENSAJE_SIN_ARCHIVO = 'Elige el PDF de la factura.';
const MENSAJE_NO_PDF = 'El archivo debe ser un PDF.';
const MENSAJE_VACIO = 'El archivo está vacío.';
const MENSAJE_GRANDE = 'El PDF debe pesar hasta 5 MB.';
const MENSAJE_FECHA = 'Elige la fecha de emisión (AAAA-MM-DD).';

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-'; // 64 símbolos: [A-Za-z0-9_-]
const LARGO_NOMBRE = 24; // la función acepta de 8 a 64
const RE_NOMBRE = /^[A-Za-z0-9_-]{8,64}$/;

/** R11 / CA7: solo PDF (por tipo, no por la extensión), con contenido y de hasta 5 MB. Se rechaza antes de subir. */
export function validarArchivoFactura(archivo) {
  if (!archivo || typeof archivo !== 'object') return { ok: false, error: MENSAJE_SIN_ARCHIVO };
  if (archivo.type !== 'application/pdf') return { ok: false, error: MENSAJE_NO_PDF };
  const tamano = Number(archivo.size);
  if (!(tamano > 0)) return { ok: false, error: MENSAJE_VACIO };
  if (tamano > MAX_PDF_BYTES) return { ok: false, error: MENSAJE_GRANDE };
  return { ok: true, error: '' };
}

/** La fecha de emisión debe ser AAAA-MM-DD y existir en el calendario. */
export function validarFechaFactura(fecha) {
  if (typeof fecha !== 'string' || !esFechaIso(fecha)) return { ok: false, error: MENSAJE_FECHA };
  return { ok: true, error: '' };
}

/** Nombre del archivo en Storage: aleatorio (nunca el del archivo elegido), 24 caracteres [A-Za-z0-9_-]. `azar(n)` entrega n bytes. */
export function nombreAleatorio(azar = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n))) {
  const bytes = azar(LARGO_NOMBRE);
  if (!bytes || bytes.length < LARGO_NOMBRE) throw new Error('El generador de azar no entregó suficientes datos.');
  let nombre = '';
  for (let i = 0; i < LARGO_NOMBRE; i += 1) nombre += ALFABETO[bytes[i] & 63];
  return nombre;
}

/** Ruta oficial (spec 083): Ordenes_Compra/AAAA-MM-DD/<nombre>.pdf. Lanza si la fecha o el nombre no sirven. */
export function rutaFactura(fecha, nombre) {
  if (typeof fecha !== 'string' || !esFechaIso(fecha)) throw new Error('La fecha de la factura no es válida.');
  if (typeof nombre !== 'string' || !RE_NOMBRE.test(nombre)) throw new Error('El nombre del archivo no es válido.');
  return `Ordenes_Compra/${fecha}/${nombre}.pdf`;
}

const esLista = (v) => Array.isArray(v) && v.every((x) => typeof x === 'string');

/** La respuesta debe traer { ok:true, dia, total, lineas, advertencias[] }; si no, no se muestra. */
function respuestaValida(r) {
  return Boolean(r) && typeof r === 'object' && r.ok === true && typeof r.dia === 'string' && esFechaIso(r.dia)
    && Number.isInteger(r.total) && r.total >= 0 && Number.isInteger(r.lineas) && r.lineas >= 0 && esLista(r.advertencias);
}

const yaExisteEn = (e) => Boolean(e) && typeof e.code === 'string' && /already-exists$/.test(e.code);

/**
 * Sube el PDF y pide el borrador. Nunca lanza: devuelve { ok:true, dia, total, lineas, advertencias, ruta }
 * o { ok:false, mensaje, yaExiste? }. Antes de subir valida archivo y fecha, y si el borrador del día ya existe no hace nada (R13).
 * @param {{archivo: object, fecha: string, subir: (ruta: string, archivo: object, meta: {contentType: string}) => Promise<any>,
 *          llamar: (datos: {ruta: string}) => Promise<any>, existeBorrador?: (fecha: string) => boolean, azar?: (n: number) => Uint8Array}} p
 */
export async function procesarFactura({ archivo, fecha, subir, llamar, existeBorrador = () => false, azar }) {
  const a = validarArchivoFactura(archivo);
  if (!a.ok) return { ok: false, mensaje: a.error };
  const f = validarFechaFactura(fecha);
  if (!f.ok) return { ok: false, mensaje: f.error };
  if (existeBorrador(fecha)) return { ok: false, yaExiste: true, mensaje: MENSAJE_YA_EXISTE };

  let ruta;
  try {
    ruta = rutaFactura(fecha, nombreAleatorio(azar));
  } catch (e) {
    return { ok: false, mensaje: MENSAJE_GENERICO };
  }
  try {
    await subir(ruta, archivo, { contentType: 'application/pdf' });
  } catch (e) {
    return { ok: false, mensaje: MENSAJE_SUBIDA }; // sin detalles técnicos; la función no se llama
  }
  let respuesta;
  try {
    respuesta = await llamar({ ruta });
  } catch (e) {
    return { ok: false, yaExiste: yaExisteEn(e), mensaje: mensajeErrorIA(e) };
  }
  if (!respuestaValida(respuesta)) return { ok: false, mensaje: MENSAJE_GENERICO };
  return { ok: true, dia: respuesta.dia, total: respuesta.total, lineas: respuesta.lineas, advertencias: respuesta.advertencias, ruta };
}

const pesos = (n) => `$${String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

/** «Total: $11.900 · 2 líneas». */
export function textoResultado({ total, lineas }) {
  return `Total: ${pesos(total)} · ${lineas} ${lineas === 1 ? 'línea' : 'líneas'}`;
}

function agregar(doc, padre, etiqueta, texto, clases) {
  const el = doc.createElement(etiqueta);
  el.textContent = texto; // R4: texto, nunca HTML
  if (clases) el.className = clases;
  padre.appendChild(el);
  return el;
}

/** Pinta total, líneas y advertencias dentro de `destino`, solo con textContent; repintar reemplaza lo anterior. */
export function pintarResultado(doc, destino, resultado) {
  destino.textContent = '';
  const r = resultado || {};
  agregar(doc, destino, 'p', textoResultado(r), 'font-bold text-slate-900');
  const avisos = Array.isArray(r.advertencias) ? r.advertencias : [];
  if (avisos.length === 0) return;
  agregar(doc, destino, 'p', 'Advertencias', 'text-[10px] uppercase font-bold text-amber-700 mt-2');
  const ul = agregar(doc, destino, 'ul', '', 'list-disc list-inside text-amber-900');
  for (const aviso of avisos) agregar(doc, ul, 'li', String(aviso));
}
