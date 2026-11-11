/**
 * servicio-terminado.js — regla única y estricta de «Servicio Terminado» por visita (corrección del bug de
 * visitas recién compradas que aparecían como «Completada» en trabajos-terminados.html).
 *
 * REGLA: una visita está terminada solo si cumple LAS TRES condiciones:
 *   1. Operador asignado válido (no vacío ni «Sin asignar»).
 *   2. Evidencia real de ESA visita: su informe con contenido (fotos, informeUrl, reporteFotografico o aprobado) o
 *      evidencia propia en la visita (fotos / fotosDespues / evidencia / informeUrl / reporteFotografico /
 *      informeAprobado === true). Un informe rechazado o vacío no es evidencia.
 *   3. Estado explícito de finalizada, propio de ESA visita:
 *        - orden.estadosPorVisita.V{n}                       (spec 041)
 *        - orden.visitas[n-1].estado / .estadoOperativo       (arreglo histórico)
 *        - orden.programacionVisitas.v_{n}.estado / .estadoOperativo (lo escribe la aprobación del informe)
 *      Valores: completada, completado, terminada, finalizada, aprobado/aprobada.
 *      NUNCA vale el estado de la orden («Confirmado», «pagado», «aprobado», «completada») ni pagoConfirmado.
 *
 * Fecha de ejecución: solo de campos de ejecución de ESA visita (fechaEjecucion, fechaRealizada, fechaTermino,
 * fechaInforme y, del informe, fechaCaptura/createdAt, que es cuando se capturó). NUNCA de fechaPago,
 * creadoEn/creadoEl/createdAt de la orden, actualizadoEn/updatedAt ni fechaEstimada.
 *
 * COMPATIBILIDAD (órdenes antiguas): el contador posicional `visitasCompletadas` (N) cuenta como estado de las
 * visitas 1..N SOLO si esa visita además cumple operador y evidencia (el contador no distingue cuál se hizo). El
 * estado global de la orden ya no cuenta como estado de ninguna visita. Una orden recién comprada (sin operador,
 * sin informe) nunca aparece terminada, aunque traiga un contador o un estado erróneos.
 *
 * Solo LEE campos existentes (contrato de datos con la web). Sin Firebase ni DOM: se prueba con node --test.
 */

const ESTADOS_FINALIZADA = ['completada', 'completado', 'terminada', 'finalizada', 'aprobado', 'aprobada'];

/** Campos de la orden que jamás cuentan como fecha de término de una visita (se fijan en una prueba). */
export const CAMPOS_FECHA_PROHIBIDOS = Object.freeze([
  'fechaPago', 'creadoEn', 'creadoEl', 'createdAt', 'actualizadoEn', 'updatedAt', 'fechaEstimada',
  'fechaCompletado', 'ultimaVisitaCompletadaFecha',
]);

const norm = (s) => String(s == null ? '' : s).toLowerCase().trim();

/** ¿El texto de estado de una VISITA significa finalizada? («Confirmado», «pagado», «en revision» no.) */
export function esEstadoCompletada(estado) {
  return ESTADOS_FINALIZADA.includes(norm(estado));
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
 * Informe (no rechazado) de la visita n de la orden, o null. `identificadores` son los ids con que se puede conocer
 * la orden (id del documento, numeroOrden, ordenId). El informe antiguo sin sufijo (informes/{ordenId}) solo
 * corresponde a la visita 1. Que exista no basta para ser evidencia: ver informeTieneContenido.
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

/** ¿Hay algo real en este valor? (texto no vacío, arreglo con elementos, objeto con algún valor útil). */
function hayContenido(v) {
  if (v == null || v === false) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.some(hayContenido);
  if (typeof v === 'object') return Object.values(v).some(hayContenido);
  return Boolean(v);
}

const CAMPOS_EVIDENCIA = ['fotos', 'fotosDespues', 'fotosAntes', 'evidencia', 'informeUrl', 'reporteFotografico',
  'fotoAntes1', 'fotoAntes2', 'fotoDespues1', 'fotoDespues2', 'fotoAntes', 'fotoDespues'];

/** ¿El objeto (informe o visita) trae evidencia real: fotos, enlace de informe, reporte o informe aprobado? */
function tieneEvidenciaPropia(x) {
  if (!x || typeof x !== 'object') return false;
  if (x.informeAprobado === true) return true;
  return CAMPOS_EVIDENCIA.some((c) => hayContenido(x[c]));
}

/** Un informe es evidencia si trae contenido o está aprobado. Un documento vacío o recién creado no lo es. */
export function informeTieneContenido(informe) {
  if (!informe || typeof informe !== 'object') return false;
  return norm(informe.estado) === 'aprobado' || tieneEvidenciaPropia(informe);
}

const OPERADOR_VACIO = ['sin asignar', 'sin operador', 'sin asignación', 'no asignado', '-', '—', 'n/a', 'undefined', 'null'];

function textoOperador(op) {
  if (op && typeof op === 'object') return String(op.nombre || op.nombreCompleto || op.email || '').trim();
  return String(op == null ? '' : op).trim();
}

/** ¿Es un operador válido? No vacío ni «Sin asignar» (ni marcas de relleno). */
export function esOperadorValido(op) {
  const t = textoOperador(op).toLowerCase();
  return t !== '' && !OPERADOR_VACIO.includes(t);
}

/**
 * Operador de la visita n: primero el que hizo el informe, luego el de la visita, luego el mapa por visita y por
 * último el de la orden. Devuelve el texto del primero válido, o null si ninguno lo es.
 */
export function operadorDeVisita(orden, n, informe) {
  const o = orden || {};
  const inf = informe || {};
  const vis = (Array.isArray(o.visitas) && o.visitas[n - 1]) || {};
  const prog = (o.programacionVisitas && o.programacionVisitas[`v_${n}`]) || {};
  const porVisita = o.operadoresPorVisita && o.operadoresPorVisita[`V${n}`];
  const candidatos = [inf.operador, inf.operadorNombre, vis.operadorNombre, vis.operador, vis.operadorAsignado, prog.operadorNombre,
    prog.operador, porVisita, o.operadorAsignadoNombre, o.operadorNombre, o.operador];
  for (const c of candidatos) if (esOperadorValido(c)) return textoOperador(c);
  return null;
}

const CAMPOS_FECHA_VISITA = ['fechaEjecucion', 'fechaRealizada', 'fechaTermino', 'fechaInforme'];

/**
 * Fecha de ejecución real de la visita n: solo campos de ejecución de esa visita y el informe (fechaCaptura/createdAt
 * del informe = cuándo se capturó). Devuelve null si no hay ninguna: la pantalla muestra «—». Nunca usa
 * CAMPOS_FECHA_PROHIBIDOS de la orden.
 */
export function fechaEjecucionReal(orden, n, informe) {
  const o = orden || {};
  const prog = (o.programacionVisitas && o.programacionVisitas[`v_${n}`]) || {};
  const vis = (Array.isArray(o.visitas) && o.visitas[n - 1]) || {};
  const inf = informe || {};
  const candidatas = [
    ...CAMPOS_FECHA_VISITA.map((c) => inf[c]), inf.fechaCaptura, inf.createdAt,
    ...CAMPOS_FECHA_VISITA.map((c) => prog[c]),
    ...CAMPOS_FECHA_VISITA.map((c) => vis[c]), vis.fechaCompletado,
  ];
  for (const c of candidatas) {
    const f = aFecha(c);
    if (f) return f;
  }
  return null;
}

/** Estado explícito de finalizada de ESA visita (no el contador ni el estado de la orden). */
function estadoExplicitoCompletada(o, n) {
  const porVisita = o.estadosPorVisita && o.estadosPorVisita[`V${n}`];
  const vis = (Array.isArray(o.visitas) && o.visitas[n - 1]) || {};
  const prog = (o.programacionVisitas && o.programacionVisitas[`v_${n}`]) || {};
  return [porVisita, vis.estado, vis.estadoOperativo, prog.estado, prog.estadoOperativo].some(esEstadoCompletada);
}

/** Origen del estado «finalizada» de la visita n, o null. El contador solo cuenta si hay operador y evidencia. */
function origenEstado(o, n) {
  if (estadoExplicitoCompletada(o, n)) return 'explicito';
  const contador = Number(o.visitasCompletadas);
  if (Number.isFinite(contador) && contador >= n) return 'legado_contador';
  return null;
}

/**
 * Evalúa la visita n de una orden con la regla única.
 * @param {object} orden  datos del documento de la orden
 * @param {number} n      número de visita (1..)
 * @param {{docId?: string, indiceInformes?: object}} [ctx]
 * @returns {{numero:number, clave:string, terminada:boolean, origenEstado:string|null, motivo:string,
 *            operador:string|null, operadorValido:boolean, tieneEvidencia:boolean,
 *            tieneInforme:boolean, informeId:string|null, informe:object|null, fechaEjecucion:Date|null}}
 *   motivo: 'terminada' | 'sin_estado_completada' | 'sin_operador' | 'sin_evidencia'
 */
export function evaluarVisita(orden, n, ctx = {}) {
  const o = orden || {};
  const hit = informeDeVisita(ctx.indiceInformes, [ctx.docId, o.numeroOrden, o.ordenId], n);
  const informe = hit ? hit.data : null;
  const vis = (Array.isArray(o.visitas) && o.visitas[n - 1]) || {};
  const prog = (o.programacionVisitas && o.programacionVisitas[`v_${n}`]) || {};
  const operador = operadorDeVisita(o, n, informe);
  const tieneEvidencia = informeTieneContenido(informe) || tieneEvidenciaPropia(vis) || tieneEvidenciaPropia(prog);
  const origen = origenEstado(o, n);
  let motivo = 'terminada';
  if (!origen) motivo = 'sin_estado_completada';
  else if (!operador) motivo = 'sin_operador';
  else if (!tieneEvidencia) motivo = 'sin_evidencia';
  return {
    numero: n, clave: `V${n}`, terminada: motivo === 'terminada', origenEstado: origen, motivo,
    operador, operadorValido: Boolean(operador), tieneEvidencia,
    tieneInforme: Boolean(hit), informeId: hit ? hit.id : null, informe, fechaEjecucion: fechaEjecucionReal(o, n, informe),
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
 * posicional que marcaba también las visitas previas). La página solo lo permite si la visita ya tiene operador y
 * evidencia (si no, no pasaría a terminada). No escribe fechas de ejecución: esa fecha sale del informe de la visita.
 *  - estadosPorVisita.V{n} = 'completada'        → estado explícito de la visita
 *  - ultimaModificacion                           → auditoría (spec 041), con origen «cierre_manual»
 *  - NO escribe visitasCompletadas: ese contador posicional queda congelado como dato histórico (si se escribiera,
 *    la regla de compatibilidad lo leería como «visitas 1..N» y volvería a arrastrar las anteriores)
 *  - ultimaVisitaCompletadaFecha, actualizadoEn   → solo informativos (compatibilidad); NUNCA cuentan como fecha de término
 * Cuando con esta visita quedan todas las del plan terminadas, marca el cierre operativo de la orden en un campo
 * SEPARADO (`estadoOperativo: 'completada'` y `fechaCompletado`). NUNCA sobrescribe `estado` (guarda 'Confirmado' del
 * pago Webpay: de él depende el ingreso tributario) ni `estadoServicio`.
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
    ultimaModificacion: {
      uidOperador, timestamp: new Date(ahora).toISOString(), estadoAnterior, estadoNuevo: 'completada', origen: 'cierre_manual',
    },
    ultimaVisitaCompletadaFecha: marcaTiempo, // se sigue escribiendo por compatibilidad; NUNCA cuenta como fecha de término
    actualizadoEn: marcaTiempo,
  };
  if (terminadas >= Number(totalVisitas)) {
    payload.estadoOperativo = 'completada';
    payload.fechaCompletado = marcaTiempo;
  }
  return payload;
}
