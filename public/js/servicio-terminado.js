/**
 * servicio-terminado.js — regla única y estricta de «Servicio Terminado» por visita (corrección del bug de
 * visitas recién compradas que aparecían como «Completada» en trabajos-terminados.html).
 *
 * REGLA: una visita está terminada solo si cumple las DOS condiciones:
 *   1. Estado operativo explícito de completada, propio de ESA visita:
 *        - orden.estadosPorVisita.V{n}            (spec 041)
 *        - orden.visitas[n-1].estado              (arreglo histórico)
 *        - orden.programacionVisitas.v_{n}.estado (lo escribe la aprobación del informe)
 *   2. Evidencia real de ESA visita:
 *        - el informe de esa visita (informes/{ordenId}-V{n}, que no esté rechazado), o
 *        - una fecha de ejecución real propia de esa visita (ver fechaEjecucionReal).
 *
 * NUNCA se infiere de fechaPago, creadoEn/creadoEl/createdAt, actualizadoEn/updatedAt ni fechaEstimada: esas
 * fechas existen en cuanto se compra la orden y no prueban que se haya hecho nada.
 *
 * COMPATIBILIDAD (órdenes antiguas): el contador posicional `visitasCompletadas` (N) y el estado global de la orden
 * (completada/finalizada) se aceptan como estado SOLO de visitas que además tengan su informe real (no basta una fecha:
 * el contador arrastraba visitas anteriores y no distingue cuál se hizo). Sin informe, esas visitas quedan pendientes.
 * Así las órdenes viejas con informes reales no pierden lo ya terminado, y una orden recién comprada (sin estado,
 * sin informes) nunca aparece terminada, aunque traiga un contador o un estado erróneos.
 *
 * Solo LEE campos existentes (contrato de datos con la web). Sin Firebase ni DOM: se prueba con node --test.
 */

const ESTADOS_COMPLETADA = ['completada', 'completado', 'terminada', 'finalizada'];

/** Campos que jamás cuentan como fecha de término de una visita (se fijan en una prueba). */
export const CAMPOS_FECHA_PROHIBIDOS = Object.freeze([
  'fechaPago', 'creadoEn', 'creadoEl', 'createdAt', 'actualizadoEn', 'updatedAt', 'fechaEstimada',
  'fechaCompletado', 'ultimaVisitaCompletadaFecha',
]);

const norm = (s) => String(s == null ? '' : s).toLowerCase().trim();

/** ¿El texto de estado significa «completada»? */
export function esEstadoCompletada(estado) {
  return ESTADOS_COMPLETADA.includes(norm(estado));
}

/** Convierte Date, Timestamp de Firestore, {seconds}, ISO o milisegundos en Date; null si no es válido. */
export function aFecha(v) {
  if (v == null || v === '') return null;
  let f = null;
  if (typeof v.toDate === 'function') f = v.toDate();
  else if (v instanceof Date) f = v;
  else if (typeof v === 'object' && typeof v.seconds === 'number') f = new Date(v.seconds * 1000);
  else if (typeof v === 'string' || typeof v === 'number') f = new Date(v);
  return f && !isNaN(f.getTime()) ? f : null;
}

/** Cantidad de visitas del plan (mismo criterio por nombre de plan que usan las páginas). */
export function totalVisitasDePlan(orden) {
  const o = orden || {};
  const bruto = (o.servicio && o.servicio.planNombre) || o.planNombre || (typeof o.servicio === 'string' ? o.servicio : '') || o.tipoPlan || o.plan || '';
  const plan = norm(bruto);
  let total = 4;
  if (norm(o.tipoServicio) === 'spot' || plan.includes('spot')) total = 1;
  else if (plan.includes('12') || plan.includes('mensual')) total = 12;
  else if (plan.includes('6') || plan.includes('bimestral')) total = 6;
  else if (plan.includes('4') || plan.includes('trimestral')) total = 4;
  return total;
}

const CLAVE_RE = /^V(\d{1,3})$/;
const ID_INFORME_RE = /^(.+)-V(\d{1,3})$/;

/**
 * Índice de informes para buscar el de una visita. `entradas` es un Map id→datos, un arreglo de [id, datos] o un
 * arreglo de {id, data}. Se indexa por (ordenId, visitaNumero) y, si faltan, por el sufijo -V{n} del id.
 */
export function crearIndiceInformes(entradas) {
  const porVisita = new Map();
  const porId = new Map();
  const lista = entradas instanceof Map ? [...entradas.entries()] : Array.from(entradas || [], (e) => (Array.isArray(e) ? e : [e.id, e.data]));
  for (const [id, data] of lista) {
    if (!id || !data) continue;
    porId.set(String(id), data);
    const claves = [];
    const n = Number(data.visitaNumero);
    if (data.ordenId && Number.isInteger(n) && n > 0) claves.push(`${data.ordenId}|${n}`);
    const m = ID_INFORME_RE.exec(String(id));
    if (m) claves.push(`${m[1]}|${Number(m[2])}`);
    for (const k of claves) if (!porVisita.has(k)) porVisita.set(k, { id: String(id), data });
  }
  return { porVisita, porId };
}

/**
 * Informe válido de la visita n de la orden, o null. `identificadores` son los ids con que se puede conocer la
 * orden (id del documento, numeroOrden, ordenId). Un informe rechazado no es evidencia. El informe antiguo sin
 * sufijo (informes/{ordenId}) solo corresponde a la visita 1.
 */
export function informeDeVisita(indice, identificadores, n) {
  if (!indice) return null;
  const ids = [...new Set((identificadores || []).filter(Boolean).map(String))];
  for (const ident of ids) {
    const hit = indice.porVisita.get(`${ident}|${n}`);
    if (hit && norm(hit.data.estado) !== 'rechazado') return hit;
  }
  if (n === 1) {
    for (const ident of ids) {
      const data = indice.porId.get(ident);
      if (data && norm(data.estado) !== 'rechazado') return { id: ident, data };
    }
  }
  return null;
}

/**
 * Fecha de ejecución real de la visita n: solo fuentes propias de esa visita (el informe y los datos de ejecución
 * de esa visita). Devuelve null si no hay ninguna: la pantalla muestra «—». Nunca usa CAMPOS_FECHA_PROHIBIDOS
 * de la orden.
 */
export function fechaEjecucionReal(orden, n, informe) {
  const o = orden || {};
  const prog = (o.programacionVisitas && o.programacionVisitas[`v_${n}`]) || {};
  const vis = (Array.isArray(o.visitas) && o.visitas[n - 1]) || {};
  const inf = informe || {};
  const candidatas = [inf.fechaCaptura, inf.createdAt, prog.fechaEjecucion, vis.fechaEjecucion, vis.fechaCompletado];
  for (const c of candidatas) {
    const f = aFecha(c);
    if (f) return f;
  }
  return null;
}

/** Estado explícito de completada de ESA visita (no el contador ni el estado global). */
function estadoExplicitoCompletada(o, n) {
  const clave = `V${n}`;
  const porVisita = o.estadosPorVisita && o.estadosPorVisita[clave];
  const arreglo = Array.isArray(o.visitas) && o.visitas[n - 1] ? o.visitas[n - 1].estado : null;
  const prog = o.programacionVisitas && o.programacionVisitas[`v_${n}`] ? o.programacionVisitas[`v_${n}`].estado : null;
  return esEstadoCompletada(porVisita) || esEstadoCompletada(arreglo) || esEstadoCompletada(prog);
}

/** Origen del estado «completada» de la visita n, o null. Solo el explícito se completa con una fecha real. */
function origenEstado(o, n) {
  if (estadoExplicitoCompletada(o, n)) return 'explicito';
  const contador = Number(o.visitasCompletadas);
  if (Number.isFinite(contador) && contador >= n) return 'legado_contador';
  if (esEstadoCompletada(o.estado) || esEstadoCompletada(o.estadoServicio)) return 'legado_global';
  return null;
}

/**
 * Evalúa la visita n de una orden con la regla única.
 * @param {object} orden  datos del documento de la orden
 * @param {number} n      número de visita (1..)
 * @param {{docId?: string, indiceInformes?: object}} [ctx]
 * @returns {{numero:number, clave:string, terminada:boolean, origenEstado:string|null, motivo:string,
 *            tieneInforme:boolean, informeId:string|null, informe:object|null, fechaEjecucion:Date|null}}
 */
export function evaluarVisita(orden, n, ctx = {}) {
  const o = orden || {};
  const hit = informeDeVisita(ctx.indiceInformes, [ctx.docId, o.numeroOrden, o.ordenId], n);
  const informe = hit ? hit.data : null;
  const fechaEjecucion = fechaEjecucionReal(o, n, informe);
  const origen = origenEstado(o, n);
  let terminada = false;
  let motivo = 'sin_estado_completada';
  if (origen) {
    const evidencia = origen === 'explicito' ? Boolean(hit || fechaEjecucion) : Boolean(hit);
    terminada = evidencia;
    motivo = evidencia ? 'terminada' : 'sin_evidencia';
  }
  return {
    numero: n, clave: `V${n}`, terminada, origenEstado: origen, motivo,
    tieneInforme: Boolean(hit), informeId: hit ? hit.id : null, informe, fechaEjecucion,
  };
}

/** Mayor número de visita que conviene revisar en la orden. */
function maxVisitas(o) {
  let max = totalVisitasDePlan(o);
  if (Array.isArray(o.visitas)) max = Math.max(max, o.visitas.length);
  for (const mapa of [o.estadosPorVisita, o.programacionVisitas]) {
    if (mapa && typeof mapa === 'object') {
      for (const k of Object.keys(mapa)) {
        const m = CLAVE_RE.exec(k) || /^v_(\d{1,3})$/.exec(k);
        if (m) max = Math.max(max, Number(m[1]));
      }
    }
  }
  return max;
}

/** Evaluación de todas las visitas de la orden (1..total). */
export function evaluarVisitas(orden, ctx = {}) {
  const o = orden || {};
  const total = maxVisitas(o);
  const lista = [];
  for (let n = 1; n <= total; n++) lista.push(evaluarVisita(o, n, ctx));
  return lista;
}

/** Solo las visitas terminadas, en orden de número. */
export function visitasTerminadas(orden, ctx = {}) {
  return evaluarVisitas(orden, ctx).filter((v) => v.terminada);
}

/** Conjunto de números de visita terminadas (para las listas de visitas pendientes). */
export function numerosTerminados(orden, ctx = {}) {
  return new Set(visitasTerminadas(orden, ctx).map((v) => v.numero));
}

/**
 * Campos que escribe «Marcar visita completada» (todos-los-trabajos.html) para ESA visita, en rutas con punto:
 * no reemplaza mapas completos ni arrastra visitas anteriores (antes se escribía visitasCompletadas = n, un contador
 * posicional que marcaba también las visitas previas).
 *  - estadosPorVisita.V{n} = 'completada'        → estado explícito de la visita
 *  - programacionVisitas.v_{n}.fechaEjecucion     → fecha real propia de la visita (evidencia)
 *  - ultimaModificacion                           → auditoría (spec 041), con origen «cierre_manual»
 *  - visitasCompletadas = cantidad de visitas terminadas (no la posición), para quien aún lo lee
 *  - ultimaVisitaCompletadaFecha, actualizadoEn   → solo informativos (compatibilidad); NUNCA cuentan como fecha de término
 * Cuando con esta visita quedan todas las del plan terminadas, mantiene el comportamiento histórico de cerrar la orden
 * (estado/estadoServicio/fechaCompletado).
 * @param {object} p
 * @param {number} p.numero               visita que se completa (1..)
 * @param {number} p.totalVisitas         visitas del plan
 * @param {number} p.terminadasPrevias    visitas ya terminadas de la orden (sin contar esta)
 * @param {string} p.uidOperador          quien hace el cambio (obligatorio)
 * @param {*} p.marcaTiempo               serverTimestamp() de Firestore (o un Date en pruebas)
 * @param {string} [p.estadoAnterior]     estado previo de la visita (por defecto «pendiente»)
 */
export function construirCierreVisita({ numero, totalVisitas, terminadasPrevias, uidOperador, marcaTiempo, estadoAnterior = 'pendiente', ahora = Date.now() }) {
  if (!Number.isInteger(numero) || numero < 1) throw new Error('Número de visita no válido.');
  if (!uidOperador || typeof uidOperador !== 'string') throw new Error('Falta el operador que hace el cambio.');
  const terminadas = Math.max(0, Number(terminadasPrevias) || 0) + 1;
  const payload = {
    [`estadosPorVisita.V${numero}`]: 'completada',
    [`programacionVisitas.v_${numero}.visitaNumero`]: numero,
    [`programacionVisitas.v_${numero}.fechaEjecucion`]: marcaTiempo,
    ultimaModificacion: {
      uidOperador, timestamp: new Date(ahora).toISOString(), estadoAnterior, estadoNuevo: 'completada', origen: 'cierre_manual',
    },
    visitasCompletadas: terminadas,
    ultimaVisitaCompletadaFecha: marcaTiempo, // se sigue escribiendo por compatibilidad; NUNCA cuenta como fecha de término
    actualizadoEn: marcaTiempo,
  };
  if (terminadas >= Number(totalVisitas)) {
    payload.estado = 'completada';
    payload.estadoServicio = 'completada';
    payload.fechaCompletado = marcaTiempo;
  }
  return payload;
}
