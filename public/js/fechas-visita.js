/**
 * fechas-visita.js — fecha real de cada visita en el mapa aditivo `fechasPorVisita` (spec 041).
 * - Escritura: solo `fechasPorVisita.<clave>` más los punteros de orden `fechaProgramada` y `proximaVisita`.
 *   NUNCA se escribe el arreglo `fechasProgramadas` (ahí se guardaban fechas sintéticas de relleno).
 * - Lectura: prefiere `fechasPorVisita.<clave>`; sin ella, la página usa el respaldo anterior.
 * Sin Firebase ni DOM. Las dependencias de Firestore se inyectan.
 */

const CLAVE = /^V\d{1,3}$/;
export const CAMPO_PROHIBIDO = 'fechasProgramadas';

/** Fecha guardada para una visita, o null si no existe o no es válida. */
export function fechaGuardadaVisita(ord, clave) {
  if (!CLAVE.test(String(clave || ''))) return null;
  const mapa = ord && ord.fechasPorVisita && typeof ord.fechasPorVisita === 'object' ? ord.fechasPorVisita : null;
  if (!mapa) return null;
  const v = mapa[clave];
  let f = null;
  if (v && typeof v.toDate === 'function') f = v.toDate();
  else if (v instanceof Date) f = v;
  else if (typeof v === 'string' || typeof v === 'number') f = new Date(v);
  return f && !isNaN(f.getTime()) ? f : null;
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
