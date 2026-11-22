/**
 * matriz-vistas.js — arma el HTML (como texto) de las matrices de Planificación y del detalle de una visita.
 *
 * - Sin DOM ni Firebase: se prueba con `node --test`. La página asigna el resultado a innerHTML.
 * - AUD-01: TODO dato que viene de Firestore (incluidos eje y feriado, que salen de `rutas` y `feriados`) pasa por esc().
 *   Las clases de Tailwind son las del resto del backoffice.
 * - Solo lectura: las tarjetas son botones `data-visita="docId|visitaNumero"` (o `data-orden="docId"`); la página delega el clic
 *   para abrir el detalle. No hay botones que cambien nada (no se reprograma ni se asigna operador desde aquí).
 */
import { esc } from './html-seguro.js';
import { INSIGNIA_PRUEBA } from './orden-pagada.js';

const SIN_EJE = 'Sin eje';
const TH_BASE = 'py-3 px-3 text-[11px] font-bold text-white text-center align-top min-w-[9rem]';
const TH_CLIENTE = 'py-3 px-3 text-[10px] font-bold uppercase tracking-wider text-white text-left sticky left-0 z-10 bg-[#002d1a] min-w-[14rem]';
const BADGE = 'inline-block mt-1 mr-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold';

function fondoDia(dia) {
  if (dia.feriado) return 'bg-rose-50';
  if (dia.finDeSemana) return 'bg-slate-50';
  return '';
}

function colorCabeceraDia(dia) {
  if (dia.feriado) return 'bg-rose-800';
  if (dia.finDeSemana) return 'bg-slate-600';
  return 'bg-[#002d1a]';
}

/** Días que se dibujan: lunes a viernes siempre; sábado y domingo solo si tienen visitas. */
function diasVisibles(matriz) {
  return matriz.dias.map((dia, indice) => ({ dia, indice })).filter(({ dia, indice }) => indice < 5 || dia.visitas > 0);
}

/** Insignia del eje de la orden: solo cuando NO tiene eje (el eje conocido va como texto). */
function insigniaSinEje(eje) {
  return eje === SIN_EJE ? `<span class="${BADGE} bg-slate-100 border-slate-300 text-slate-600">${SIN_EJE}</span>` : '';
}

// ---------------------------------------------------------------- semana de Planes

export function htmlCabeceraSemana(matriz) {
  const columnas = diasVisibles(matriz).map(({ dia }) => {
    const corto = dia.display.slice(0, 5); // dd/mm
    const feriado = dia.feriado ? ` <span class="block text-[10px] font-bold text-rose-100">FERIADO · ${esc(dia.feriado)}</span>` : '';
    const eje = dia.ejes && dia.ejes.length > 0 ? dia.ejes.map((e) => esc(e)).join(' · ') : (dia.finDeSemana ? 'Fin de semana' : '');
    return `<th class="${TH_BASE} ${colorCabeceraDia(dia)}" title="${esc(dia.feriado || dia.display)}">${esc(dia.nombre)} <span class="inline-block ml-1 px-1.5 py-0.5 rounded bg-white/20 text-[10px]">${esc(corto)}</span>${feriado}<span class="block mt-1 text-[10px] font-normal text-slate-200">${eje}</span></th>`;
  }).join('');
  return `<tr><th class="${TH_CLIENTE}">Cliente / Cementerio</th>${columnas}</tr>`;
}

function tarjetaVisita(v) {
  const insignias = (v.esTentativa ? `<span class="${BADGE} bg-white/70 border-slate-300 text-slate-600">Tentativa</span>` : '')
    + (v.fueraDeRuta ? `<span class="${BADGE} bg-amber-50 border-amber-300 text-amber-800">Fuera de su día de ruta</span>` : '');
  return `<button type="button" data-visita="${esc(v.docId)}|${esc(v.visitaNumero)}" class="block w-full text-left p-2 mb-1 rounded-lg border text-[11px] hover:shadow transition ${esc(v.estadoClases)}">`
    + `<span class="block font-bold">${esc(v.plan)}</span>`
    + `<span class="block">Visita ${esc(v.visitaTexto)} · ${esc(v.fechaTexto)}</span>`
    + `<span class="block font-semibold">${esc(v.estado)}</span>${insignias}</button>`;
}

function tarjetaSinVisita(orden) {
  const prox = orden.proxima ? `Próx: visita ${esc(orden.proxima.visitaTexto)} · ${esc(orden.proxima.fechaTexto)}` : 'Sin próximas visitas';
  return `<button type="button" data-orden="${esc(orden.docId)}" class="block w-full text-left p-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 text-[11px] text-slate-500 hover:border-[#002d1a] hover:text-[#002d1a] transition">Sin visita esta semana<br><strong>${prox}</strong></button>`;
}

export function htmlCuerpoSemana(matriz) {
  const visibles = diasVisibles(matriz);
  if (matriz.ordenes.length === 0) {
    return `<tr><td colspan="${visibles.length + 1}" class="py-8 text-center text-slate-400">No hay visitas programadas en esta semana con los filtros activos.</td></tr>`;
  }
  return matriz.ordenes.map((o) => {
    const sinVisitas = o.celdas.every((c) => c.length === 0);
    const fantasmaEnCliente = sinVisitas && o.diaRuta === null;
    const celdaCliente = `<td class="py-3 px-3 align-top sticky left-0 z-[1] bg-white border-r border-slate-200">`
      + `<div class="font-bold text-sm text-[#002d1a]">${esc(o.cliente)}${o.esPrueba ? INSIGNIA_PRUEBA : ''}</div>`
      + `<div class="text-[11px] text-slate-500">${esc(o.cementerio)}</div>`
      + `<div class="text-[11px] text-slate-500">${esc(o.plan)} · ${esc(o.numeroOrden)}</div>`
      + (o.eje === SIN_EJE ? insigniaSinEje(o.eje) : `<div class="text-[11px] text-slate-500">${esc(o.eje)}</div>`)
      + (fantasmaEnCliente ? `<div class="mt-2">${tarjetaSinVisita(o)}</div>` : '')
      + `</td>`;
    const celdas = visibles.map(({ dia, indice }) => {
      const visitas = o.celdas[indice];
      const esSuDia = sinVisitas && o.diaRuta === indice + 1;
      let contenido;
      if (visitas.length > 0) contenido = visitas.map(tarjetaVisita).join('');
      else if (esSuDia) contenido = tarjetaSinVisita(o);
      else contenido = '<span class="text-slate-300">—</span>';
      const alineacion = visitas.length === 0 && !esSuDia ? ' text-center align-middle' : ' align-top';
      return `<td class="py-2 px-2 border-l border-slate-100 ${fondoDia(dia)}${alineacion}">${contenido}</td>`;
    }).join('');
    return `<tr class="border-b border-slate-100">${celdaCliente}${celdas}</tr>`;
  }).join('');
}

// ---------------------------------------------------------------- mes de Spot

export function htmlCabeceraMes(matriz) {
  const columnas = matriz.dias.map((d) => {
    const titulo = d.feriado ? `${d.iso} — ${d.feriado}` : d.iso;
    return `<th class="py-3 px-1 min-w-[2.5rem] text-[11px] font-bold text-white text-center ${colorCabeceraDia(d)}" title="${esc(titulo)}">${esc(d.dia)}</th>`;
  }).join('');
  return `<tr><th class="${TH_CLIENTE}">Cliente / Cementerio</th>${columnas}</tr>`;
}

export function htmlCuerpoMes(matriz, tituloMes = '') {
  if (matriz.filas.length === 0) {
    return `<tr><td colspan="${matriz.dias.length + 1}" class="py-8 text-center text-slate-400">No hay servicios Spot en ${esc(tituloMes)}.</td></tr>`;
  }
  return matriz.filas.map((f) => {
    const celdaCliente = `<td class="py-3 px-3 align-top sticky left-0 z-[1] bg-white border-r border-slate-200">`
      + `<div class="font-bold text-sm text-[#002d1a]">${esc(f.cliente)}${f.esPrueba ? INSIGNIA_PRUEBA : ''}</div>`
      + `<div class="text-[11px] text-slate-500">${esc(f.cementerio)}</div>`
      + `<div class="text-[11px] text-slate-500">${esc(f.numeroOrden)}</div></td>`;
    const celdas = matriz.dias.map((dia, i) => {
      const contenido = i === f.indiceDia
        ? `<button type="button" data-visita="${esc(f.docId)}|${esc(f.visita.visitaNumero)}" title="${esc(f.cementerio)} (${esc(f.visita.estado)})" class="inline-block w-7 h-7 leading-7 rounded-md border text-[11px] font-bold hover:scale-110 transition ${esc(f.visita.estadoClases)}">S</button>`
        : '';
      return `<td class="py-2 px-1 text-center border-l border-slate-100 ${fondoDia(dia)}">${contenido}</td>`;
    }).join('');
    return `<tr class="border-b border-slate-100">${celdaCliente}${celdas}</tr>`;
  }).join('');
}

// ---------------------------------------------------------------- detalle

function dato(etiqueta, valor) {
  return `<div class="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2"><div class="text-[10px] font-bold uppercase text-slate-500">${esc(etiqueta)}</div><div class="text-xs text-slate-800">${valor}</div></div>`;
}

/** Detalle de una visita (solo lectura). `visitasDeLaOrden`: todas las filas de esa orden, para el cronograma de Planes. */
export function htmlDetalle(visita, visitasDeLaOrden) {
  const v = visita || {};
  const esPlan = v.visitaTotal !== undefined && v.visitaTotal !== null;
  const datos = [
    dato('Cliente', esc(v.cliente) + (v.esPrueba ? INSIGNIA_PRUEBA : '')),
    dato('Ser querido', esc(v.serQuerido)),
    esPlan ? dato('Plan', esc(v.plan)) : '',
    dato('Tipo de servicio', esc(v.nivel)),
    dato('Ramos adicionales', esc(v.ramosAdicionales ?? 0)),
    dato('N° de orden', esc(v.numeroOrden)),
    dato('Cementerio', esc(v.cementerio)),
    dato('Eje', esc(v.eje || SIN_EJE)),
    dato('Operador', esc(v.operador)),
    esPlan ? '' : dato('Fecha elegida por el cliente', `<strong>${esc(v.fechaTexto)}</strong>`),
  ].join('');
  let cronograma = '';
  if (esPlan) {
    const lista = [...(visitasDeLaOrden || [])].sort((a, b) => (a.visitaNumero || 0) - (b.visitaNumero || 0));
    cronograma = `<h3 class="mt-4 mb-2 text-xs font-bold text-[#002d1a]">Cronograma de visitas</h3><ul class="space-y-1">`
      + lista.map((x) => `<li class="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg border text-xs ${x.visitaNumero === v.visitaNumero ? 'border-[#002d1a] bg-emerald-50/40' : 'border-slate-200'}">`
        + `<span><strong>Visita ${esc(x.visitaTexto)}:</strong> ${esc(x.fechaTexto)}${x.esTentativa ? ` <span class="${BADGE} bg-slate-100 border-slate-200 text-slate-600">Tentativa</span>` : ''}</span>`
        + `<span class="inline-block px-2 py-0.5 rounded-full border text-[10px] font-bold ${esc(x.estadoClases)}">${esc(x.estado)}</span></li>`).join('')
      + `</ul>`;
  }
  return `<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">${datos}</div>${cronograma}`;
}
