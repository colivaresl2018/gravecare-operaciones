/**
 * fechas-tentativas.js — fecha TENTATIVA de cada visita según el plan contratado.
 *
 * - Se calcula en pantalla; NO se escribe en Firestore. Una fecha real (fechasPorVisita.<clave>) siempre gana.
 * - Visita n de un plan = fecha de inicio + n × intervalo (12 visitas → cada 1 mes; 6 → cada 2; 4 → cada 3),
 *   el mismo criterio que usaban Órdenes y Planificación.
 * - Spot (1 visita): su fecha la elige el cliente al comprar y la web la guarda en la orden (`fechaProgramada`
 *   AAAA-MM-DD o `fechaServicio` DD/MM/AAAA). Se muestra como fecha REAL (no tentativa); `fechasPorVisita.V1` la supera.
 *   Sin ninguna de las dos no hay fecha: Spot no tiene tentativa.
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

/** Fecha elegida por el cliente al contratar un Spot, guardada por la web en la orden. Solo se acepta una fecha de calendario válida. */
export function fechaSpotDelCliente(orden) {
  const o = orden || {};
  let y, mo, d;
  let m = typeof o.fechaProgramada === 'string' && o.fechaProgramada.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) [, y, mo, d] = m;
  else if ((m = typeof o.fechaServicio === 'string' && o.fechaServicio.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) [, d, mo, y] = m;
  else return null;
  const f = new Date(Number(y), Number(mo) - 1, Number(d), 10, 0, 0);
  const valida = f.getFullYear() === Number(y) && f.getMonth() === Number(mo) - 1 && f.getDate() === Number(d);
  return valida ? f : null;
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
  // Spot: la fecha que eligió el cliente al contratar. Solo la visita 1 de un plan de 1 visita; en los demás planes
  // `fechaProgramada` es el puntero a la próxima visita y no es la fecha de ninguna en particular.
  if (numero === 1 && totalVisitasPlan(planDeOrden(orden)) === 1) {
    const delCliente = fechaSpotDelCliente(orden);
    if (delCliente) return { fecha: delCliente, tentativa: false };
  }
  const tentativa = fechaTentativaVisita(orden, numero);
  return tentativa ? { fecha: tentativa, tentativa: true } : null;
}
