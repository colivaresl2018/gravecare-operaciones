/**
 * estados-visita.js — lógica pura de estados, trazabilidad y clasificación de visitas (spec 041).
 * Sin Firebase ni DOM: se prueba con node --test. La interfaz y las escrituras van en otra etapa.
 *
 * Estados por visita: pendiente → asignado → en_ejecucion → completada, y reprogramada desde cualquier estado abierto.
 * Órdenes históricas sin fecha de visita se clasifican aparte (no se marcan como atrasadas).
 */

export const ESTADOS = Object.freeze(['pendiente', 'asignado', 'en_ejecucion', 'completada', 'reprogramada']);
export const TOLERANCIA_ATRASO_DIAS = 3;      // spec 041: más de 3 días calendario desde la fecha programada
export const VENTANA_PROXIMA_DIAS = 7;        // spec 041 (aprobada por el dueño, 2026-11-06): «próximas a vencer» = dentro de 7 días

const DIA_MS = 24 * 60 * 60 * 1000;

// Transiciones permitidas. «reprogramada» puede venir de cualquier estado abierto y vuelve a pendiente/asignado.
const TRANSICIONES = {
  pendiente: ['asignado', 'reprogramada'],
  asignado: ['en_ejecucion', 'pendiente', 'reprogramada'],
  en_ejecucion: ['completada', 'asignado', 'reprogramada'],
  reprogramada: ['pendiente', 'asignado'],
  completada: [],
};

/** ¿Se puede pasar de `desde` a `hacia`? */
export function transicionValida(desde, hacia) {
  if (!ESTADOS.includes(hacia)) return false;
  if (desde === hacia) return false;
  return (TRANSICIONES[desde] || []).includes(hacia);
}

/**
 * Registro de auditoría de una transición. La fecha `ahora` es inyectable para pruebas.
 * Lanza si la transición no es válida o si falta el operador (no se registra nada a medias).
 */
export function construirUltimaModificacion({ uidOperador, estadoAnterior, estadoNuevo, ahora = Date.now() }) {
  if (!uidOperador || typeof uidOperador !== 'string') throw new Error('Falta el operador que hace el cambio.');
  if (!transicionValida(estadoAnterior, estadoNuevo)) {
    throw new Error(`Transición no permitida: ${estadoAnterior} → ${estadoNuevo}.`);
  }
  return { uidOperador, timestamp: new Date(ahora).toISOString(), estadoAnterior, estadoNuevo };
}

/** Convierte un valor de fecha (Date, ISO o timestamp numérico) en milisegundos, o null si no es válido. */
function aMs(f) {
  if (f == null || f === '') return null;
  const ms = f instanceof Date ? f.getTime() : typeof f === 'number' ? f : Date.parse(String(f));
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Clasifica una visita. Devuelve un conjunto de etiquetas (puede tener varias).
 * - sinFecha: no hay fecha de visita (histórico). Se aparta; no se marca atrasada ni próxima.
 * - atrasada: fecha programada hace más de TOLERANCIA_ATRASO_DIAS días y sin pasar a en_ejecucion ni completada.
 * - sinOperador: no tiene operador asignado.
 * - proximaVencer: la fecha cae dentro de los próximos VENTANA_PROXIMA_DIAS días y aún no está completada.
 */
export function clasificarVisita({ estado, fechaProgramada, operador, ahora = Date.now() }) {
  const etiquetas = new Set();
  const cerradaOEnCurso = estado === 'completada' || estado === 'en_ejecucion';
  if (!operador || operador === 'Sin asignar') etiquetas.add('sinOperador');
  const ms = aMs(fechaProgramada);
  if (ms === null) { etiquetas.add('sinFecha'); return etiquetas; }
  const dias = (ms - ahora) / DIA_MS;
  if (!cerradaOEnCurso && dias < -TOLERANCIA_ATRASO_DIAS) etiquetas.add('atrasada');
  if (estado !== 'completada' && dias >= 0 && dias <= VENTANA_PROXIMA_DIAS) etiquetas.add('proximaVencer');
  return etiquetas;
}

/** Filtro de la interfaz: ¿la visita cumple el criterio elegido? */
export function cumpleFiltro(etiquetas, filtro) {
  if (!filtro) return true;
  return etiquetas.has(filtro);
}
