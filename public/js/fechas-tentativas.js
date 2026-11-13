/**
 * fechas-tentativas.js — fecha TENTATIVA de cada visita según el plan contratado.
 *
 * - Se calcula en pantalla; NO se escribe en Firestore. Una fecha real (fechasPorVisita.<clave>) siempre gana.
 * - Visita n de un plan = fecha de inicio + n × intervalo (12 visitas → cada 1 mes; 6 → cada 2; 4 → cada 3),
 *   el mismo criterio que usaban Órdenes y Planificación.
 * - Spot (1 visita): su fecha la elige el cliente al comprar; sin fecha guardada no hay tentativa.
 * - Sin fecha de inicio conocida no hay tentativa (no se usa ninguna fecha por defecto).
 * Sin Firebase ni DOM.
 */
import { fechaGuardadaVisita } from './fechas-visita.js';

/** Campos de la orden que pueden indicar cuándo empezó el servicio, en orden de preferencia (igual que clientes.html). */
export const CAMPOS_INICIO = ['fechaContratacion', 'fechaCreacion', 'fechaInicio', 'fecha', 'createdAt', 'fechaPago', 'timestamp', 'creadoEl'];

function aFecha(v) {
  if (!v) return null;
  let d = null;
  if (typeof v.toDate === 'function') d = v.toDate();
  else if (v instanceof Date) d = v;
  else if (typeof v === 'string') {
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 10, 0, 0) : new Date(v);
  } else if (typeof v === 'number') d = new Date(v < 1e11 ? v * 1000 : v);
  return d && !isNaN(d.getTime()) ? d : null;
}

/** Fecha de inicio del servicio, o null si la orden no trae ninguna. */
export function fechaInicioOrden(orden) {
  const o = orden || {};
  for (const campo of CAMPOS_INICIO) {
    const f = aFecha(o[campo]) || aFecha(o.pago?.fecha) || aFecha(o.webpay?.transaction_date);
    if (f) return f;
  }
  return null;
}

/** Visitas del plan: 1 (Spot), 12, 6 o 4. Mismo criterio por nombre que usan las páginas (por defecto 4). */
export function totalVisitasPlan(plan) {
  const p = String(plan || '').toLowerCase();
  if (p.includes('spot')) return 1;
  if (p.includes('12')) return 12;
  if (p.includes('6')) return 6;
  if (p.includes('4')) return 4;
  return 4;
}

/** Meses entre visitas del plan; null para Spot (sin cadencia). */
export function intervaloMesesPlan(plan) {
  const total = totalVisitasPlan(plan);
  if (total === 1) return null;
  return { 12: 1, 6: 2, 4: 3 }[total];
}

/** Suma meses a una fecha sin desbordar el mes (31 ene + 1 mes = 28/29 feb). */
export function sumarMeses(fecha, meses) {
  const y = fecha.getFullYear();
  const mes = fecha.getMonth() + meses;
  const ultimoDia = new Date(y, mes + 1, 0).getDate();
  const dia = Math.min(fecha.getDate(), ultimoDia);
  return new Date(y, mes, dia, 10, 0, 0);
}

/** Plan de la orden (mismo orden de campos que las páginas). */
export function planDeOrden(orden) {
  const o = orden || {};
  return o.servicio?.planNombre || o.planNombre || o.tipoPlan || o.plan || 'Plan 4';
}

/** Fecha tentativa de la visita `numero` según el plan y la fecha de inicio, o null. */
export function fechaTentativaVisita(orden, numero) {
  const plan = planDeOrden(orden);
  const total = totalVisitasPlan(plan);
  const intervalo = intervaloMesesPlan(plan);
  if (!intervalo || !Number.isInteger(numero) || numero < 1 || numero > total) return null;
  const inicio = fechaInicioOrden(orden);
  if (!inicio) return null;
  return sumarMeses(inicio, numero * intervalo);
}

/**
 * Fecha que muestra la pantalla para la visita: la real si existe; si no, la tentativa del plan; si no, null.
 * @returns {{fecha: Date, tentativa: boolean} | null}
 */
export function fechaVisitaConOrigen(orden, numero) {
  const clave = `V${numero}`;
  const real = fechaGuardadaVisita(orden, clave);
  if (real) return { fecha: real, tentativa: false };
  const tentativa = fechaTentativaVisita(orden, numero);
  return tentativa ? { fecha: tentativa, tentativa: true } : null;
}
