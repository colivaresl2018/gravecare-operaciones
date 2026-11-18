/**
 * fechas-visita.js — fecha real de cada visita en el mapa aditivo `fechasPorVisita` (spec 041).
 * - Escritura: solo `fechasPorVisita.<clave>` más los punteros de orden `fechaProgramada` y `proximaVisita`.
 *   NUNCA se escribe el arreglo `fechasProgramadas` (ahí se guardaban fechas sintéticas de relleno).
 * - Lectura: prefiere `fechasPorVisita.<clave>`; sin ella, la página usa el respaldo anterior.
 * Sin Firebase ni DOM. Las dependencias de Firestore se inyectan.
 */

const CLAVE = /^V\d{1,3}$/;
export const CAMPO_PROHIBIDO = 'fechasProgramadas';

/** Un servicio Spot tiene una sola visita. */
export function esServicioSpot(ord) {
  const tipo = String((ord && ord.tipoServicio) || '').trim().toLowerCase();
  const plan = String((ord && (ord.plan || ord.planContratado)) || '').toLowerCase();
  return tipo === 'spot' || plan.includes('spot');
}

/**
 * Fecha que eligió el cliente al comprar un servicio Spot (fechaProgramada / fechaServicio de la orden).
 * Acepta AAAA-MM-DD o DD/MM/AAAA. Se toma a mediodía local para que no cambie de día por la zona horaria.
 */
export function fechaSpotDelCliente(ord) {
  if (!esServicioSpot(ord)) return null;
  const crudo = String((ord && (ord.fechaProgramada || ord.fechaServicio)) || '').trim();
  let y, m, d;
  let r = /^(\d{4})-(\d{2})-(\d{2})/.exec(crudo);
  if (r) { y = +r[1]; m = +r[2]; d = +r[3]; }
  else if ((r = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(crudo))) { d = +r[1]; m = +r[2]; y = +r[3]; }
  else return null;
  const f = new Date(y, m - 1, d, 12, 0, 0);
  return f.getFullYear() === y && f.getMonth() === m - 1 && f.getDate() === d ? f : null;
}

/**
 * Fecha guardada para una visita, o null si no existe o no es válida.
 * Si la orden es Spot y aún no tiene fechasPorVisita.V1, se usa la fecha que eligió el cliente (la misma que muestra la orden).
 */
export function fechaGuardadaVisita(ord, clave) {
  if (!CLAVE.test(String(clave || ''))) return null;
  const mapa = ord && ord.fechasPorVisita && typeof ord.fechasPorVisita === 'object' ? ord.fechasPorVisita : null;
  const v = mapa ? mapa[clave] : undefined;
  let f = null;
  if (v && typeof v.toDate === 'function') f = v.toDate();
  else if (v instanceof Date) f = v;
  else if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) f = new Date(+v.slice(0, 4), +v.slice(5, 7) - 1, +v.slice(8, 10), 12, 0, 0);
  else if (typeof v === 'string' || typeof v === 'number') f = new Date(v);
  if (f && !isNaN(f.getTime())) return f;
  if (clave === 'V1') return fechaSpotDelCliente(ord);
  return null;
}

/** Bloquea cualquier payload que intente escribir el arreglo completo. Lanza si lo encuentra. */
export function verificarPayloadSinArreglo(payload) {
  for (const k of Object.keys(payload || {})) {
    if (k === CAMPO_PROHIBIDO || k.startsWith(CAMPO_PROHIBIDO + '.')) {
      throw new Error('Se bloqueó la escritura del arreglo completo fechasProgramadas.');
    }
  }
  return payload;
}

/** Payload de la fecha de UNA visita. Solo toca su clave y los punteros de orden. */
export function construirActualizacionFecha({ clave, fecha }) {
  if (!CLAVE.test(String(clave || ''))) throw new Error('Clave de visita no válida.');
  if (!(fecha instanceof Date) || isNaN(fecha.getTime())) throw new Error('Fecha no válida.');
  const iso = fecha.toISOString();
  return verificarPayloadSinArreglo({
    [`fechasPorVisita.${clave}`]: iso,
    fechaProgramada: iso,
    proximaVisita: iso,
  });
}

/** Escribe la fecha de una visita, de forma aislada. Valida antes de llamar a Firestore. */
export async function guardarFechaVisitaEnOrden({ actualizar, referencia, ordenDocId, claveVisita, fecha, extra = {} }) {
  if (!ordenDocId) throw new Error('Falta la orden.');
  const payload = { ...construirActualizacionFecha({ clave: claveVisita, fecha }), ...verificarPayloadSinArreglo(extra) };
  await actualizar(referencia(ordenDocId), payload);
  return payload;
}
