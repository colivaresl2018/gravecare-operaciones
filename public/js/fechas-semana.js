/**
 * fechas-semana.js — ayudas de calendario de las matrices y del resumen de Planificación (lógica pura, sin DOM ni Firebase).
 *
 * Todo trabaja con fechas AAAA-MM-DD y mediodía local: sin desfases de zona horaria. La semana va de lunes a domingo.
 */
export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function desdeIso(iso) {
  const r = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? '').trim());
  if (!r) return null;
  const d = new Date(+r[1], +r[2] - 1, +r[3], 12);
  return d.getFullYear() === +r[1] && d.getMonth() === +r[2] - 1 && d.getDate() === +r[3] ? d : null;
}

function aIso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function aDisplay(d) {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/** true si `iso` es una fecha AAAA-MM-DD que existe en el calendario. */
export function esFechaIso(iso) {
  return desdeIso(iso) !== null;
}

/** Fecha de hoy (AAAA-MM-DD) en la zona horaria del navegador. */
export function hoyIso(ahora = new Date()) {
  return aIso(ahora);
}

/** Suma `n` días (puede ser negativo) a una fecha AAAA-MM-DD; null si la fecha no es válida. */
export function sumarDias(iso, n) {
  const d = desdeIso(iso);
  if (!d) return null;
  d.setDate(d.getDate() + n);
  return aIso(d);
}

/** Lunes (AAAA-MM-DD) de la semana de una fecha; null si la fecha no es válida. */
export function lunesDeLaSemana(iso) {
  const d = desdeIso(iso);
  if (!d) return null;
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // lunes = 0 … domingo = 6
  return aIso(d);
}

/** Día de la semana de una fecha: 1 = lunes … 7 = domingo; null si no es válida. */
export function diaSemanaIso(iso) {
  const d = desdeIso(iso);
  return d ? ((d.getDay() + 6) % 7) + 1 : null;
}

/** true si la fecha cae en sábado o domingo. */
export function esFinDeSemana(iso) {
  const n = diaSemanaIso(iso);
  return n === 6 || n === 7;
}

/** Los 7 días de la semana que empieza en `lunesIso`: [{ iso, nombre, display }]. */
export function diasDeLaSemana(lunesIso) {
  const lunes = desdeIso(lunesIso);
  if (!lunes) return [];
  return DIAS_SEMANA.map((nombre, i) => {
    const d = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + i, 12);
    return { iso: aIso(d), nombre, display: aDisplay(d) };
  });
}

/** Mes (AAAA-MM) de una fecha AAAA-MM-DD, o null. */
export function mesDeIso(iso) {
  const r = /^(\d{4})-(\d{2})-\d{2}$/.exec(String(iso ?? ''));
  return r && +r[2] >= 1 && +r[2] <= 12 ? `${r[1]}-${r[2]}` : null;
}

/** Suma `n` meses (puede ser negativo) a un mes AAAA-MM. */
export function sumarMeses(mesIso, n) {
  const r = /^(\d{4})-(\d{2})$/.exec(String(mesIso ?? ''));
  if (!r || +r[2] < 1 || +r[2] > 12) return null;
  const total = +r[1] * 12 + (+r[2] - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/** «Noviembre 2026». */
export function nombreMes(mesIso) {
  const r = /^(\d{4})-(\d{2})$/.exec(String(mesIso ?? ''));
  return r && MESES[+r[2] - 1] ? `${MESES[+r[2] - 1]} ${r[1]}` : '';
}

/** «16/11/2026» a partir de AAAA-MM-DD ('' si no es válida). */
export function fechaDisplay(iso) {
  const d = desdeIso(iso);
  return d ? aDisplay(d) : '';
}
