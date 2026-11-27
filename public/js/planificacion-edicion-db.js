/**
 * planificacion-edicion-db.js — escritura de UNA visita desde «Planificación Planes y Spot» (spec 085 / directriz B7).
 *
 * Solo `updateDoc` de las claves de esa visita (nunca el mapa completo, nunca `set` sin `merge` de la orden):
 *   fecha    → fechasPorVisita.V<n>, fechaProgramada y proximaVisita (los construye fechas-visita.js, spec 041)
 *   operador → operadoresPorVisita.V<n> (mismo valor que ya usa el backoffice: nombre del personal o su correo, o «Sin asignar»)
 * Las dependencias de Firestore se inyectan: se prueba con Firestore falso. Sin DOM.
 */
import { construirActualizacionFecha, verificarPayloadSinArreglo } from './fechas-visita.js?v=ps1';
import { esFechaIso } from './fechas-semana.js';
import { MAX_OPERADOR } from './planificacion-edicion.js';

const CLAVE_VISITA = /^V\d{1,3}$/;

function claveValida(claveVisita) {
  if (typeof claveVisita !== 'string' || !CLAVE_VISITA.test(claveVisita)) throw new Error('Clave de visita no válida.');
  return claveVisita;
}

/** Payload de la fecha de una visita. La fecha se guarda a las 10:00 locales, como en Órdenes de Servicio y en el Gantt. */
export function construirCambioFecha({ claveVisita, fechaIso } = {}) {
  claveValida(claveVisita);
  if (typeof fechaIso !== 'string' || !esFechaIso(fechaIso)) throw new Error('Fecha no válida.');
  const fecha = new Date(Number(fechaIso.slice(0, 4)), Number(fechaIso.slice(5, 7)) - 1, Number(fechaIso.slice(8, 10)), 10, 0, 0);
  return construirActualizacionFecha({ clave: claveVisita, fecha });
}

/** Payload del operador de una visita: solo `operadoresPorVisita.V<n>`. */
export function construirCambioOperador({ claveVisita, operador } = {}) {
  claveValida(claveVisita);
  const valor = typeof operador === 'string' ? operador.trim() : '';
  if (!valor || valor.length > MAX_OPERADOR) throw new Error('Operador no válido.');
  return verificarPayloadSinArreglo({ [`operadoresPorVisita.${claveVisita}`]: valor });
}

async function actualizarOrden({ actualizar, referencia, ordenDocId, payload }) {
  if (typeof ordenDocId !== 'string' || !ordenDocId.trim()) throw new Error('Falta la orden.');
  await actualizar(referencia(ordenDocId), payload);
  return payload;
}

/** Escribe la fecha de una visita. Valida antes de llamar a Firestore; si Firestore falla, el error sube tal cual. */
export async function guardarCambioFecha({ actualizar, referencia, ordenDocId, claveVisita, fechaIso }) {
  return actualizarOrden({ actualizar, referencia, ordenDocId, payload: construirCambioFecha({ claveVisita, fechaIso }) });
}

/** Escribe el operador de una visita. Valida antes de llamar a Firestore; si Firestore falla, el error sube tal cual. */
export async function guardarCambioOperador({ actualizar, referencia, ordenDocId, claveVisita, operador }) {
  return actualizarOrden({ actualizar, referencia, ordenDocId, payload: construirCambioOperador({ claveVisita, operador }) });
}
