/**
 * matriz-planificacion.js — lógica pura de las matrices de Planificación (solo lectura):
 *   - semana de Planes: una fila por orden, una columna por día; la visita va en la columna de su fecha (real o tentativa).
 *   - mes de Spot: una fila por servicio Spot, una columna por día del mes.
 *
 * - Sin DOM ni Firebase: se prueba con `node --test`. Las filas vienen de construirFilasPlanificacion().
 * - El eje y el día de ruta del cementerio se LEEN de la colección `rutas` (ya vienen en cada fila: `eje`, `diaRuta`). Un cementerio
 *   sin eje es «Sin eje»: la orden aparece igual, en su fecha real, y nunca se marca «Fuera de su día de ruta». No se inventa nada.
 * - Una visita en un día distinto al de su ruta se muestra en su fecha real con la marca «Fuera de su día de ruta».
 * - Feriados (colección `feriados`) y fines de semana solo se informan para pintarlos: no bloquean ni mueven visitas.
 *   Spot no sigue reglas de ruta ni de feriados.
 */
import { diasDeLaSemana, esFinDeSemana } from './fechas-semana.js';
import { normalizarNombre } from './rutas-planificacion.js?v=b5';

const SIN_EJE = 'Sin eje';

/** Fila de visita que pasa búsqueda (cliente, ser querido, N° orden, cementerio; sin tildes), cementerio, eje, estado y operador. */
function pasaFiltros(f, { busqueda = '', cementerio = '', eje = '', estado = '', operador = '' }) {
  const q = normalizarNombre(busqueda);
  if (q && ![f.cliente, f.serQuerido, f.numeroOrden, f.cementerio].some((v) => normalizarNombre(v).includes(q))) return false;
  if (cementerio && f.cementerio !== cementerio) return false;
  if (eje && (f.eje || SIN_EJE) !== eje) return false;
  if (estado && f.estado !== estado) return false;
  if (operador && f.operador !== operador) return false;
  return true;
}

const porNumeroOrden = (a, b) => String(a).localeCompare(String(b), 'es', { numeric: true });
const nombreFeriadoDe = (feriados, iso) => (feriados && feriados.nombre(iso)) || null;

// ---------------------------------------------------------------- semana de Planes

/**
 * @param {object[]} filas  Filas de Planes (construirFilasPlanificacion().planes).
 * @param {{ lunesIso: string, busqueda?: string, cementerio?: string, eje?: string, estado?: string, operador?: string,
 *           soloConVisita?: boolean, rutas?: object, feriados?: object }} opciones
 */
export function construirMatrizSemana(filas, { lunesIso, busqueda = '', cementerio = '', eje = '', estado = '', operador = '', soloConVisita = true, rutas = null, feriados = null } = {}) {
  const dias = diasDeLaSemana(lunesIso).map((d, i) => ({
    ...d,
    feriado: nombreFeriadoDe(feriados, d.iso),
    finDeSemana: i >= 5,
    ejes: rutas ? rutas.ejesDelDia(i + 1) : [],
    visitas: 0,
  }));
  const indicePorIso = new Map(dias.map((d, i) => [d.iso, i]));
  const domingo = dias.length ? dias[6].iso : '';
  const filtros = { busqueda, cementerio, eje, estado, operador };

  let sinFecha = 0;
  let fueraDeRuta = 0;
  let totalVisitas = 0;
  const porOrden = new Map();

  for (const f of filas || []) {
    if (!pasaFiltros(f, filtros)) continue;
    let orden = porOrden.get(f.docId);
    if (!orden) {
      orden = {
        docId: f.docId, numeroOrden: f.numeroOrden, cliente: f.cliente, esPrueba: Boolean(f.esPrueba), cementerio: f.cementerio, plan: f.plan,
        nivel: f.nivel, ramosAdicionales: f.ramosAdicionales, eje: f.eje || SIN_EJE, diaRuta: f.diaRuta ?? null,
        celdas: dias.map(() => []), proxima: null, _siguientes: [],
      };
      porOrden.set(f.docId, orden);
    }
    if (!f.fechaIso) { sinFecha += 1; continue; }
    const i = indicePorIso.get(f.fechaIso);
    if (i === undefined) {
      if (domingo && f.fechaIso > domingo) orden._siguientes.push(f);
      continue;
    }
    const fuera = orden.diaRuta !== null && orden.diaRuta !== i + 1;
    orden.celdas[i].push({ ...f, fueraDeRuta: fuera });
    dias[i].visitas += 1;
    totalVisitas += 1;
    if (fuera) fueraDeRuta += 1;
  }

  let ordenes = [...porOrden.values()];
  for (const o of ordenes) {
    const sig = o._siguientes.sort((a, b) => (a.fechaIso < b.fechaIso ? -1 : a.fechaIso > b.fechaIso ? 1 : 0))[0];
    o.proxima = sig ? { visitaTexto: sig.visitaTexto, fechaTexto: sig.fechaTexto } : null;
    delete o._siguientes;
  }
  ordenes = ordenes.filter((o) => (soloConVisita ? o.celdas.some((c) => c.length > 0) : true));
  ordenes.sort((a, b) => {
    const da = a.diaRuta ?? 99;
    const db = b.diaRuta ?? 99;
    return da - db || String(a.cementerio).localeCompare(String(b.cementerio), 'es') || porNumeroOrden(a.numeroOrden, b.numeroOrden);
  });

  return { dias, ordenes, totalVisitas, sinFecha, fueraDeRuta };
}

// ---------------------------------------------------------------- mes de Spot

/**
 * @param {object[]} filas  Filas de Spot (construirFilasPlanificacion().spot).
 * @param {{ mesIso: string, busqueda?: string, cementerio?: string, estado?: string, operador?: string, feriados?: object }} opciones
 */
export function construirMatrizMes(filas, { mesIso, busqueda = '', cementerio = '', estado = '', operador = '', feriados = null } = {}) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(mesIso ?? ''));
  const cantidad = m ? new Date(+m[1], +m[2], 0).getDate() : 0;
  const dias = [];
  for (let d = 1; d <= cantidad; d += 1) {
    const iso = `${mesIso}-${String(d).padStart(2, '0')}`;
    dias.push({ iso, dia: d, finDeSemana: esFinDeSemana(iso), feriado: nombreFeriadoDe(feriados, iso) });
  }

  let sinFecha = 0;
  const lista = [];
  for (const f of filas || []) {
    if (!pasaFiltros(f, { busqueda, cementerio, estado, operador })) continue;
    if (!f.fechaIso) { sinFecha += 1; continue; }
    const indiceDia = dias.findIndex((d) => d.iso === f.fechaIso);
    if (indiceDia < 0) continue;
    lista.push({
      docId: f.docId, numeroOrden: f.numeroOrden, cliente: f.cliente, esPrueba: Boolean(f.esPrueba), cementerio: f.cementerio,
      eje: f.eje || SIN_EJE, visita: { ...f, fueraDeRuta: false }, indiceDia,
    });
  }
  lista.sort((a, b) => a.indiceDia - b.indiceDia || porNumeroOrden(a.numeroOrden, b.numeroOrden));
  return { dias, filas: lista, total: lista.length, sinFecha };
}
