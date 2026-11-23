/**
 * compra-vistas.js — arma el HTML (como texto) de «Compra de flores» y del formulario de «Valores de ramos».
 * Sin DOM ni Firebase: se prueba con `node --test`; la página asigna el resultado a innerHTML.
 * AUD-01: todo texto que viene de Firestore (cementerios) pasa por esc(). Un valor que falta se muestra «sin valor», nunca $0.
 */
import { esc } from './html-seguro.js';
import { formatoPesos } from './resumen-ventas.js?v=b5';
import { fechaDisplay } from './fechas-semana.js?v=b5';
import { TIPOS_RAMO } from './compra-ramos.js?v=b5e2';
import { htmlAccionDia } from './compra-dia-vistas.js?v=057';

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const TD = 'py-2.5 px-3 align-top';

/** Texto del total: «$18.000», «$15.000 · incompleto» (parte sin valor) o «Sin valor» (nada valorizado). */
function textoTotal(total, incompleto, totalRamos) {
  if (!incompleto) return esc(formatoPesos(total));
  if (totalRamos > 0 && total === 0) return '<span class="text-amber-700 font-semibold">Sin valor</span>';
  return `${esc(formatoPesos(total))} <span class="text-amber-700 font-semibold">· incompleto</span>`;
}

function lineasHtml(lineas) {
  return lineas.map((l) => {
    const precio = l.valorUnitario === null
      ? '<span class="text-amber-700 font-semibold">sin valor</span>'
      : `× ${esc(formatoPesos(l.valorUnitario))} = <span class="font-semibold">${esc(formatoPesos(l.subtotal))}</span>`;
    return `<div>${esc(l.texto)} <span class="text-slate-500">${precio}</span></div>`;
  }).join('');
}

/**
 * Filas de la tabla: por día (lunes a viernes siempre; sábado y domingo solo si tienen visitas), con sus cementerios.
 * Spec 057: si llegan `ordenes` (estadoDiasCompra), cada día con visitas suma una 5.ª celda con «Crear orden de compra».
 */
export function htmlCuerpoCompra(lista, { ordenes = null, puedeCrear = false } = {}) {
  const dias = (lista && lista.dias) || [];
  const estados = ordenes ? new Map(ordenes.map((o) => [o.iso, o])) : null;
  const columnas = estados ? 5 : 4;
  return dias.map((dia, indice) => ({ dia, indice })).filter(({ dia, indice }) => indice < 5 || dia.visitas > 0).map(({ dia }) => {
    const cabecera = `<tr class="bg-slate-100 border-t border-slate-200">`
      + `<td class="${TD} font-bold text-[#002d1a]">${esc(dia.nombre)} <span class="font-normal text-slate-500">${esc(dia.display)}</span></td>`
      + `<td class="${TD} font-semibold">${esc(dia.visitas)}</td>`
      + `<td class="${TD}">${dia.visitas > 0 ? esc(plural(dia.totalRamos, 'ramo', 'ramos')) : ''}</td>`
      + `<td class="${TD} text-right font-bold">${dia.visitas > 0 ? textoTotal(dia.total, dia.incompleto, dia.totalRamos) : ''}</td>`
      + (estados ? `<td class="${TD}">${dia.visitas > 0 && estados.get(dia.iso) ? htmlAccionDia(estados.get(dia.iso), { puedeCrear }) : ''}</td>` : '')
      + `</tr>`;
    if (dia.visitas === 0) {
      return cabecera + `<tr><td colspan="${columnas}" class="py-2 px-3 text-slate-400 italic">Sin visitas</td></tr>`;
    }
    const filas = dia.cementerios.map((c) => `<tr class="hover:bg-slate-50 transition">`
      + `<td class="${TD} pl-6 text-slate-700">${esc(c.cementerio)}</td>`
      + `<td class="${TD}">${esc(c.visitas)}</td>`
      + `<td class="${TD}">${lineasHtml(c.lineas)}</td>`
      + `<td class="${TD} text-right">${textoTotal(c.total, c.incompleto, c.totalRamos)}</td>`
      + (estados ? `<td class="${TD}"></td>` : '')
      + `</tr>`).join('');
    return cabecera + filas;
  }).join('');
}

/** Tarjetas del resumen de la semana: visitas, ramos, total y el detalle por tipo de ramo. */
export function htmlResumenCompra(lista) {
  const r = lista.resumen;
  const tarjeta = (titulo, valor) => `<div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4"><div class="text-[10px] font-bold uppercase tracking-wider text-slate-500">${esc(titulo)}</div><div class="text-xl font-bold text-[#002d1a] mt-1">${valor}</div></div>`;
  return tarjeta('Visitas de la semana', esc(plural(r.visitas, 'visita', 'visitas')))
    + tarjeta('Ramos a comprar', esc(plural(r.totalRamos, 'ramo', 'ramos')))
    + tarjeta('Total de la semana', textoTotal(r.total, r.incompleto, r.totalRamos)
      + (r.incompleto ? '<div class="text-[11px] font-normal text-amber-700 mt-1">Total incompleto: faltan valores de compra.</div>' : ''))
    + `<div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4 text-xs"><div class="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Detalle por tipo</div>${r.lineas.length ? lineasHtml(r.lineas) : '<span class="text-slate-400 italic">Sin ramos esta semana</span>'}</div>`;
}

/** Avisos de la lista (cada texto va a la página, que lo escapa). */
export function textosAvisosCompra(lista) {
  const avisos = [];
  if (lista.faltantes.length > 0) {
    avisos.push(`Falta el valor de compra de: ${lista.faltantes.join(', ')}. Esas líneas aparecen «sin valor» y el total es incompleto. Cárgalos en «Valores de ramos».`);
  }
  if (lista.sinFecha > 0) {
    avisos.push(`${plural(lista.sinFecha, 'visita no tiene fecha', 'visitas no tienen fecha')} y no entra en la lista de compra (se ve en las pestañas «Planes» y «Spot»).`);
  }
  if (lista.tentativas > 0) {
    avisos.push(`${plural(lista.tentativas, 'visita tiene fecha tentativa', 'visitas tienen fecha tentativa')}: los ramos de esos días pueden cambiar si se reprograma.`);
  }
  return avisos;
}

/** Formulario de «Valores de ramos»: un campo por tipo, con el valor guardado (vacío si no hay). */
export function htmlFormularioValores(valores) {
  const v = valores || {};
  return TIPOS_RAMO.map((t) => {
    const actual = v[t.clave] === null || v[t.clave] === undefined ? '' : String(v[t.clave]);
    return `<div class="w-full sm:w-56">`
      + `<label for="valor-${esc(t.clave)}" class="block text-[10px] font-bold uppercase text-slate-500 mb-1">${esc(t.singular)}</label>`
      + `<div class="flex items-center gap-1"><span class="text-xs text-slate-500">$</span>`
      + `<input type="text" inputmode="numeric" autocomplete="off" id="valor-${esc(t.clave)}" data-clave="${esc(t.clave)}" value="${esc(actual)}" placeholder="Sin valor" class="valor-input w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#002d1a]"></div>`
      + `</div>`;
  }).join('');
}

/** «Última actualización: dd/mm/aaaa» a partir del ISO guardado ('' si no hay). */
export function textoActualizacion(actualizadoEn) {
  const iso = typeof actualizadoEn === 'string' ? actualizadoEn.slice(0, 10) : '';
  const f = fechaDisplay(iso);
  return f ? `Última actualización: ${f}` : '';
}
