/**
 * rutas-planificacion.js — ejes de ruta y feriados que las matrices de Planificación LEEN de Firestore (solo lectura, lógica pura).
 *
 * - `rutas/{idCementerio}`: `cementerio` (nombre del catálogo), `eje`, `diaSemana` (1 = lunes … 5 = viernes). Lo mantiene solo el dueño.
 * - `feriados/{AAAA-MM-DD}`: `nombre` y, si es regional, `alcance`. Solo se PINTAN: no bloquean ni mueven visitas.
 * - Nunca se inventa un eje: un cementerio que no está en `rutas` es «Sin eje». No hay una distribución escrita en el código.
 * - El cementerio se reconoce por su nombre completo (sin tildes ni mayúsculas) o por el id del documento; sin parecidos.
 */
import { DIAS_SEMANA, esFechaIso } from './fechas-semana.js';

export const SIN_EJE = 'Sin eje';

/** Minúsculas, sin tildes, solo letras y dígitos separados por un espacio: «Municipal N° 1» → «municipal n 1». */
export function normalizarNombre(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const texto = (v) => String(v ?? '').trim();

function diaDeRuta(valor) {
  const n = typeof valor === 'number' ? valor : /^\d+$/.test(texto(valor)) ? Number(valor) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}

/**
 * @param {Array<{id: string, data: object}> | null | undefined} docs  Documentos de la colección `rutas`.
 * @returns {{ rutaDe: (cementerio: string) => ({eje: string, diaSemana: number|null, dia: string}|null),
 *             ejes: Array<{eje: string, diaSemana: number|null, dia: string}>, ejesDelDia: (n: number) => string[],
 *             cantidad: number, vacio: boolean }}
 */
export function crearIndiceRutas(docs) {
  const porNombre = new Map();
  const ejes = new Map();
  let cantidad = 0;

  const lista = Array.isArray(docs) ? [...docs] : [];
  lista.sort((a, b) => String(a && a.id).localeCompare(String(b && b.id), 'es'));
  for (const item of lista) {
    const d = item && item.data && typeof item.data === 'object' ? item.data : null;
    if (!d) continue;
    const eje = texto(d.eje);
    if (!eje) continue; // sin eje no hay ruta: el cementerio queda «Sin eje»
    const diaSemana = diaDeRuta(d.diaSemana);
    const ruta = { eje, diaSemana, dia: diaSemana ? DIAS_SEMANA[diaSemana - 1] : '' };
    cantidad += 1;
    for (const clave of [normalizarNombre(d.cementerio), normalizarNombre(item.id)]) {
      if (clave && !porNombre.has(clave)) porNombre.set(clave, ruta);
    }
    const claveEje = `${eje}|${diaSemana ?? ''}`;
    if (!ejes.has(claveEje)) ejes.set(claveEje, ruta);
  }

  const porDia = [...ejes.values()].sort((a, b) => (a.diaSemana ?? 99) - (b.diaSemana ?? 99) || a.eje.localeCompare(b.eje, 'es'));
  const sinRepetir = porDia.filter((e, i) => porDia.findIndex((u) => u.eje === e.eje) === i);

  return {
    rutaDe: (cementerio) => porNombre.get(normalizarNombre(cementerio)) || null,
    ejes: sinRepetir,
    ejesDelDia: (n) => [...new Set(porDia.filter((e) => e.diaSemana === n).map((e) => e.eje))],
    cantidad,
    vacio: cantidad === 0,
  };
}

/**
 * @param {Array<{id: string, data: object}> | null | undefined} docs  Documentos de la colección `feriados` (id = AAAA-MM-DD).
 * @returns {{ nombre: (iso: string) => string|null, cantidad: number }}
 */
export function crearIndiceFeriados(docs) {
  const feriados = new Map();
  for (const item of Array.isArray(docs) ? docs : []) {
    const id = texto(item && item.id);
    if (!esFechaIso(id)) continue;
    const d = item.data && typeof item.data === 'object' ? item.data : {};
    const alcance = normalizarNombre(d.alcance);
    if (alcance && alcance !== 'nacional') continue; // un feriado regional no aplica a las rutas de Santiago ni de Rancagua
    feriados.set(id, texto(d.nombre) || 'Feriado');
  }
  return { nombre: (iso) => feriados.get(iso) || null, cantidad: feriados.size };
}
