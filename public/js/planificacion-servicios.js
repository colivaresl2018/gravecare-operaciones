/**
 * planificacion-servicios.js — lógica pura de la pantalla «Planificación Planes y Spot» (solo lectura).
 *
 * - No escribe en Firestore (ni el arreglo antiguo de fechas ni nada). No toca el DOM ni Firebase: todo se prueba con `node --test`.
 * - Usa las mismas reglas únicas que el resto del backoffice:
 *     fechas reales y Spot  → fechas-visita.js        (fechasPorVisita.V<n>, fecha que eligió el cliente)
 *     fecha tentativa       → fechas-tentativas.js    (se calcula, no se guarda)
 *     visita terminada      → servicio-terminado.js   (operador + evidencia + estado propio)
 *     estado de la visita   → estado-visita-unificado.js
 * - No aplica las reglas nuevas de la especificación v5.1 (ejes, feriados, +30 ±3): están pendientes de decisión del dueño.
 *   Cuando se aprueben se cambian en fechas-tentativas.js y esta pantalla las recoge sola.
 * - Las rutas llevan `?v=` para no usar una copia vieja del navegador (ya nos pasó con fechas-visita.js).
 */
import { fechaGuardadaVisita } from './fechas-visita.js?v=ps1';
import { fechaVisitaConOrigen, totalVisitasPlan } from './fechas-tentativas.js?v=ps1';
import { esOrdenDePrueba } from './orden-pagada.js';
import { numerosTerminados } from './servicio-terminado.js?v=ops13';
import { estadoUnificadoVisita, normalizarEstadoVisita } from './estado-visita-unificado.js?v=ops13';

export const SIN_PLAN = 'Sin plan registrado';
export const SIN_FECHA_PLAN = 'Sin fecha programada';
export const SIN_FECHA_SPOT = 'Sin fecha del cliente';

const texto = (v) => String(v ?? '').trim();

/** Nombre del plan tal como lo guarda la orden (mismos campos que las demás pantallas), sin valor por defecto. */
export function nombrePlanDeOrden(orden) {
  const o = orden || {};
  const candidatos = [
    o.servicio && typeof o.servicio === 'object' ? o.servicio.planNombre : '',
    o.planNombre,
    typeof o.servicio === 'string' ? o.servicio : '',
    o.tipoPlan,
    o.plan,
    o.planContratado,
  ];
  for (const c of candidatos) if (texto(c)) return texto(c);
  return '';
}

/** true si la orden es un servicio Spot: `tipoServicio` primero (como Órdenes) y, si falta, el nombre del plan. */
export function esSpot(orden) {
  const tipo = texto(orden && orden.tipoServicio).toUpperCase();
  if (tipo === 'SPOT') return true;
  return nombrePlanDeOrden(orden).toLowerCase().includes('spot');
}

export function obtenerNumeroOrden(orden, docId = '') {
  const o = orden || {};
  return texto(o.numeroOrden ?? o.nOrden ?? docId) || '—';
}

export function obtenerSerQuerido(orden) {
  const o = orden || {};
  const d = o.difunto;
  const val =
    (d && typeof d === 'object' && (d.nombreCompleto || d.nombre)) ||
    (typeof d === 'string' && d) ||
    o.nombreCompletoDifunto ||
    o.difuntoNombre ||
    o.nombreDifunto ||
    o.fallecido ||
    '';
  return texto(val) || 'Sin registrar';
}

export function obtenerCementerio(orden) {
  const o = orden || {};
  return texto((o.ubicacionSepultura && o.ubicacionSepultura.cementerio) || o.cementerio) || '—';
}

/** Operador asignado a la visita `numero`, o «Sin asignar». */
export function obtenerOperadorVisita(orden, numero) {
  const raw = orden && orden.operadoresPorVisita ? orden.operadoresPorVisita[`V${numero}`] : null;
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (raw && typeof raw === 'object') {
    const n = texto(raw.nombre || raw.displayName);
    if (n) return n;
  }
  return 'Sin asignar';
}

/**
 * Lleva una fecha a { iso: 'AAAA-MM-DD', display: 'DD/MM/AAAA' } sin desfase de zona horaria.
 * Acepta lo que devuelven los módulos de fechas (Date), un Timestamp de Firestore, 'AAAA-MM-DD', 'DD/MM/AAAA'
 * o un ISO con hora. Devuelve null si no hay una fecha válida (nunca se inventa una).
 */
export function normalizarFechaSinDesfase(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  let y; let m; let d;
  const desdeDate = (f) => {
    if (!(f instanceof Date) || isNaN(f.getTime())) return false;
    y = f.getFullYear(); m = f.getMonth() + 1; d = f.getDate();
    return true;
  };
  if (valor instanceof Date) {
    if (!desdeDate(valor)) return null;
  } else if (typeof valor === 'object' && typeof valor.toDate === 'function') {
    if (!desdeDate(valor.toDate())) return null;
  } else if (typeof valor === 'string') {
    const t = valor.trim();
    let r = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
    if (r) { y = +r[1]; m = +r[2]; d = +r[3]; }
    else if ((r = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t))) { d = +r[1]; m = +r[2]; y = +r[3]; }
    else if (/^\d{4}-\d{2}-\d{2}T/.test(t)) { if (!desdeDate(new Date(t))) return null; }
    else return null;
  } else {
    return null;
  }
  // Valida que el día exista (31/02 no es una fecha).
  const prueba = new Date(y, m - 1, d, 12);
  if (prueba.getFullYear() !== y || prueba.getMonth() !== m - 1 || prueba.getDate() !== d) return null;
  const dd = String(d).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return { iso: `${y}-${mm}-${dd}`, display: `${dd}/${mm}/${y}` };
}

/** Apariencia del estado (mismas etiquetas y colores que la Carta Gantt). */
const ESTADOS = {
  pendiente: ['Pendiente', 'bg-slate-100 border-slate-300 text-slate-700'],
  asignado: ['Asignado', 'bg-violet-50 border-violet-300 text-violet-800'],
  en_ejecucion: ['En ejecución', 'bg-sky-50 border-sky-300 text-sky-800'],
  completada: ['Completada', 'bg-emerald-100 border-emerald-400 text-emerald-900'],
  reprogramada: ['Reprogramada', 'bg-orange-50 border-orange-300 text-orange-800'],
  'en revision': ['Pendiente Revisión', 'bg-blue-50 border-blue-300 text-blue-800'],
  rechazada: ['Rechazada', 'bg-rose-50 border-rose-300 text-rose-800'],
};

/**
 * Estado visible de una visita. Igual que la Gantt: el estado unificado; si no hay, «Asignado» cuando tiene operador
 * y «Pendiente» cuando no. Una visita terminada según la regla única siempre es «Completada».
 */
export function estadoDeVisita(orden, numero, { terminada = false, operador = 'Sin asignar' } = {}) {
  let clave = terminada ? 'completada' : normalizarEstadoVisita(estadoUnificadoVisita(orden, numero, { terminada }));
  if (!clave) clave = operador && operador !== 'Sin asignar' ? 'asignado' : 'pendiente';
  const [etiqueta, clases] = ESTADOS[clave] || ESTADOS.pendiente;
  return { clave, etiqueta, clases };
}

/** Ordena por fecha ascendente (las visitas sin fecha al final) y, a igual fecha, por número de orden y de visita. */
export function ordenarFilasPorFecha(filas) {
  return [...filas].sort((a, b) => {
    const fa = a.fechaIso || '';
    const fb = b.fechaIso || '';
    if (fa && !fb) return -1;
    if (!fa && fb) return 1;
    if (fa !== fb) return fa < fb ? -1 : 1;
    const porOrden = String(a.numeroOrden).localeCompare(String(b.numeroOrden), 'es', { numeric: true });
    return porOrden || (a.visitaNumero || 0) - (b.visitaNumero || 0);
  });
}

/**
 * Construye las filas de las dos subpestañas. Las órdenes deben venir YA filtradas con esOrdenPagada.
 *
 * @param {Array<{id: string, data: object}>} ordenes
 * @param {{ indiceInformes?: object, nombreCliente?: (orden: object, id: string) => string }} [ctx]
 * @returns {{ planes: object[], spot: object[] }}
 */
export function construirFilasPlanificacion(ordenes, { indiceInformes = null, nombreCliente = null } = {}) {
  const planes = [];
  const spot = [];

  for (const item of ordenes || []) {
    const docId = item && item.id ? String(item.id) : '';
    const orden = (item && item.data) || {};
    const base = {
      docId,
      numeroOrden: obtenerNumeroOrden(orden, docId),
      cliente: (nombreCliente ? nombreCliente(orden, docId) : '') || 'Sin registrar',
      esPrueba: esOrdenDePrueba(orden), // B-1: orden pagada en integración de Transbank (insignia PRUEBA, como en la Gantt)
      serQuerido: obtenerSerQuerido(orden),
      cementerio: obtenerCementerio(orden),
    };
    const terminadas = numerosTerminados(orden, { docId, indiceInformes });

    if (esSpot(orden)) {
      // Spot: una fila por servicio. fechasPorVisita.V1 si existe; si no, la fecha que eligió el cliente. Nunca se mueve ni se inventa.
      const fecha = normalizarFechaSinDesfase(fechaGuardadaVisita(orden, 'V1'));
      const operador = obtenerOperadorVisita(orden, 1);
      const estado = estadoDeVisita(orden, 1, { terminada: terminadas.has(1), operador });
      spot.push({
        ...base,
        visitaNumero: 1,
        operador,
        estado: estado.etiqueta,
        estadoClases: estado.clases,
        terminada: estado.clave === 'completada',
        fechaIso: fecha ? fecha.iso : null,
        fechaTexto: fecha ? fecha.display : SIN_FECHA_SPOT,
      });
      continue;
    }

    // Planes: una fila por visita (n de N).
    const nombrePlan = nombrePlanDeOrden(orden);
    const total = nombrePlan ? totalVisitasPlan(nombrePlan) : 1;
    for (let n = 1; n <= total; n += 1) {
      // Sin plan registrado no hay cadencia: solo vale una fecha real guardada (no se calcula con un plan por defecto).
      let fecha = null;
      let esTentativa = false;
      if (nombrePlan) {
        const r = fechaVisitaConOrigen(orden, n);
        fecha = r ? normalizarFechaSinDesfase(r.fecha) : null;
        esTentativa = Boolean(fecha && r.tentativa);
      } else {
        fecha = normalizarFechaSinDesfase(fechaGuardadaVisita(orden, `V${n}`));
      }
      const operador = obtenerOperadorVisita(orden, n);
      const estado = estadoDeVisita(orden, n, { terminada: terminadas.has(n), operador });
      planes.push({
        ...base,
        plan: nombrePlan || SIN_PLAN,
        visitaNumero: n,
        visitaTotal: total,
        visitaTexto: `${n} de ${total}`,
        operador,
        estado: estado.etiqueta,
        estadoClases: estado.clases,
        terminada: estado.clave === 'completada',
        esTentativa,
        fechaIso: fecha ? fecha.iso : null,
        fechaTexto: fecha ? fecha.display : SIN_FECHA_PLAN,
      });
    }
  }

  return { planes: ordenarFilasPorFecha(planes), spot: ordenarFilasPorFecha(spot) };
}

function coincideBusqueda(fila, q) {
  if (!q) return true;
  return [fila.cliente, fila.serQuerido, fila.numeroOrden].some((v) => String(v || '').toLowerCase().includes(q));
}

/** Filtra la pestaña «Planes» por búsqueda, cementerio, operador y estado. */
export function filtrarPlanes(filas, filtros = {}) {
  const q = texto(filtros.busqueda).toLowerCase();
  const { cementerio = '', operador = '', estado = '' } = filtros;
  return (filas || []).filter((f) =>
    coincideBusqueda(f, q) &&
    (!cementerio || f.cementerio === cementerio) &&
    (!operador || f.operador === operador) &&
    (!estado || f.estado === estado));
}

/** Filtra la pestaña «Spot» por búsqueda y cementerio. */
export function filtrarSpot(filas, filtros = {}) {
  const q = texto(filtros.busqueda).toLowerCase();
  const { cementerio = '' } = filtros;
  return (filas || []).filter((f) => coincideBusqueda(f, q) && (!cementerio || f.cementerio === cementerio));
}
