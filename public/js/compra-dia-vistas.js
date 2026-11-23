/**
 * compra-dia-vistas.js — HTML (como texto) del estado de cada día y de su acción «Crear orden de compra» (spec 057, parte c).
 * Sin DOM ni Firebase. AUD-01: todo texto que viene de los datos pasa por esc().
 */
import { esc } from './html-seguro.js';

const TD = 'py-2.5 px-3 align-top';
const BOTON = 'px-2.5 py-1 rounded-lg text-[11px] font-bold border transition';

const textoMotivos = (d) => ((d.motivos || []).length ? `<div class="mt-1 text-[11px] text-slate-500">${d.motivos.map((m) => esc(m)).join('<br>')}</div>` : '');

/** Insignia «Listo» / «No listo» con los motivos (sin botones). */
function htmlEstado(d) {
  return d.listo
    ? '<span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">Listo</span>'
    : `<span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">No listo</span>${textoMotivos(d)}`;
}

/**
 * Filas del estado de la semana en «Rutas y feriados»: solo estado y motivos; NO hay botón (el botón está en «Compra de flores»).
 * @param {Array<object>} dias  Salida de diasDeProgramacion.
 */
export function htmlFilasDiasProgramacion(dias) {
  return (Array.isArray(dias) ? dias : []).map((d) => `<tr class="border-b border-slate-100">`
    + `<td class="${TD} font-semibold text-slate-700">${esc(d.nombre)}</td>`
    + `<td class="${TD} text-slate-600">${esc(d.display)}</td>`
    + `<td class="${TD} text-right">${esc(String(d.visitas))}</td>`
    + `<td class="${TD} text-right">${esc(String(d.ramos))}</td>`
    + `<td class="${TD}">${htmlEstado(d)}</td></tr>`).join('');
}

/**
 * Contenido de la acción de un día en «Compra de flores»: el botón «Crear orden de compra» (habilitado solo si el día está listo),
 * o «Abrir borrador» si ya existe, o «Emitida como OC-xxxx». Si no está listo, se ven los mismos motivos junto al botón deshabilitado.
 * @param {object} d  Un elemento de estadoDiasCompra.
 * @param {{puedeCrear?: boolean}} opciones  Quién puede crear borradores (las reglas mandan igual).
 */
export function htmlAccionDia(d, { puedeCrear = false } = {}) {
  if (d.borrador && d.borrador.emitidoComo) return `<span class="text-[11px] text-slate-600">Emitida como ${esc(d.borrador.emitidoComo)}</span>`;
  if (d.borrador) return `<a href="ordenes-compra.html?borrador=${esc(d.borrador.id)}" class="${BOTON} border-[#002d1a] text-[#002d1a] hover:bg-slate-100">Abrir borrador</a>`;
  const motivos = d.listo ? '' : textoMotivos(d);
  if (!puedeCrear) return motivos;
  return `<button type="button" data-accion="crear-oc-dia" data-fecha="${esc(d.iso)}" class="${BOTON} border-[#002d1a] bg-[#002d1a] text-white hover:bg-[#003d24] disabled:opacity-50 disabled:cursor-not-allowed"${d.listo ? '' : ' disabled'}>Crear orden de compra</button>${motivos}`;
}
