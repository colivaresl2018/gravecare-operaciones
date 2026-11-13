/**
 * estado-visita-unificado.js — estado único de cada visita para las pantallas del backoffice.
 *
 * Una visita puede tener estado en dos mapas de la orden:
 *   - programacionVisitas.v_<n>.estado  (lo escriben el informe y su revisión: «en revision», «rechazada», «completada»)
 *   - estadosPorVisita.V<n>             (lo escribe la planificación: pendiente, asignado, en_ejecucion, completada, reprogramada)
 * Aquí se toma el estado MÁS AVANZADO de los dos, con esta escala:
 *   pendiente / reprogramada (0) < asignado (1) < en_ejecucion (2) < en revision / rechazada (3) < completada (4)
 *
 * «completada» solo cuenta si la visita está terminada según la regla única (servicio-terminado.js); el llamador lo
 * indica con `terminada`. Si no lo está, se usa el siguiente estado más avanzado.
 *
 * Etiquetas visibles (solo estos cuatro cambian; los demás los decide cada página):
 *   en revision → «Pendiente Revisión» · rechazada → «Rechazada» · asignado → «Asignado» · completada → «Completada»
 */

export const AVANCE = Object.freeze({
  pendiente: 0,
  reprogramada: 0,
  asignado: 1,
  en_ejecucion: 2,
  'en revision': 3,
  rechazada: 3,
  completada: 4,
});

/** Lleva los sinónimos de los datos guardados a la clave de AVANCE. Devuelve '' si no se reconoce. */
export function normalizarEstadoVisita(valor) {
  const s = String(valor ?? '').trim().toLowerCase();
  if (!s) return '';
  if (['en revision', 'en_revision', 'en revisión', 'revision', 'proceso', 'en proceso', 'en_proceso'].includes(s)) return 'en revision';
  if (['asignada', 'asignado'].includes(s)) return 'asignado';
  if (['completado', 'completada', 'finalizada', 'terminada', 'aprobada', 'aprobado'].includes(s)) return 'completada';
  if (s === 'rechazado' || s === 'rechazada') return 'rechazada';
  return Object.prototype.hasOwnProperty.call(AVANCE, s) ? s : '';
}

/**
 * Estado más avanzado de la visita `numero` de la orden, o null si no hay estado conocido.
 * @param {object} orden  documento de la orden
 * @param {number} numero número de visita (1, 2, …)
 * @param {{terminada?: boolean}} [opts] `terminada`: la visita cumple la regla única de terminada
 */
export function estadoUnificadoVisita(orden, numero, { terminada = false } = {}) {
  const o = orden || {};
  const prog = o.programacionVisitas || {};
  const est = o.estadosPorVisita || {};
  const candidatos = [
    prog[`v_${numero}`]?.estado ?? prog[String(numero)]?.estado,
    est[`V${numero}`],
  ].map(normalizarEstadoVisita).filter(Boolean);

  const ordenados = [...candidatos].sort((a, b) => AVANCE[b] - AVANCE[a]);
  const sinCompletar = ordenados.filter((e) => e !== 'completada');
  if (ordenados[0] === 'completada' && !terminada) return sinCompletar[0] || null;
  return ordenados[0] || null;
}

/** Etiqueta visible de los cuatro estados estandarizados, o null para los demás (la página decide su texto). */
export function etiquetaEstadoVisita(estado) {
  switch (normalizarEstadoVisita(estado)) {
    case 'en revision': return 'Pendiente Revisión';
    case 'rechazada': return 'Rechazada';
    case 'asignado': return 'Asignado';
    case 'completada': return 'Completada';
    default: return null;
  }
}
