/**
 * config-vistas.js — arma el HTML (como texto) de la pantalla «Rutas y feriados».
 * Sin DOM ni Firebase: se prueba con `node --test`; la página asigna el resultado a innerHTML.
 * AUD-01: todo texto que viene de Firestore (cementerios, ejes, nombres de feriados, ids) pasa por esc().
 * Los botones y casillas solo salen si `puedeEditar` es true (las reglas de Firestore siguen siendo la barrera real).
 */
import { esc } from './html-seguro.js';
import { DIAS_SEMANA, esFechaIso, diaSemanaIso, fechaDisplay } from './fechas-semana.js';
import { textoErrorGuardar } from './config-planificacion-db.js';

const TD = 'py-2.5 px-3 align-top';
const BOTON = 'px-2.5 py-1 rounded-lg text-[11px] font-bold border transition';

export function htmlResumenRutas(resumen) {
  const r = resumen || { activas: 0, sinRuta: 0, inactivas: 0 };
  const partes = [
    `<span class="font-semibold text-emerald-800">${esc(r.activas)} con ruta</span>`,
    `<span class="font-semibold ${r.sinRuta ? 'text-amber-700' : 'text-slate-500'}">${esc(r.sinRuta)} sin ruta</span>`,
  ];
  if (r.inactivas) partes.push(`<span class="text-slate-500">${esc(r.inactivas)} ${r.inactivas === 1 ? 'quitada' : 'quitadas'}</span>`);
  return partes.join(' · ');
}

function botonesRuta(f) {
  if (f.estado === 'sin-ruta') return '';
  const datos = `data-id="${esc(f.id)}" data-cementerio="${esc(f.nombre)}" data-eje="${esc(f.eje)}" data-dia="${esc(f.diaSemana ?? '')}"`;
  const editar = `<button type="button" data-accion="editar-ruta" ${datos} class="${BOTON} border-slate-300 text-slate-700 hover:bg-slate-100">Editar</button>`;
  const estado = f.estado === 'inactiva'
    ? `<button type="button" data-accion="reactivar-ruta" ${datos} class="${BOTON} border-emerald-300 text-emerald-800 hover:bg-emerald-50">Reactivar</button>`
    : `<button type="button" data-accion="quitar-ruta" ${datos} class="${BOTON} border-rose-300 text-rose-700 hover:bg-rose-50">Quitar</button>`;
  return `${editar} ${estado}`;
}

/** Filas (<tr>) de la tabla de rutas por cementerio. */
export function htmlFilasRutas(filas, { puedeEditar = false } = {}) {
  if (!filas || filas.length === 0) {
    return `<tr><td colspan="${puedeEditar ? 6 : 4}" class="py-6 text-center text-slate-400 text-sm">No hay cementerios para mostrar todavía.</td></tr>`;
  }
  return filas.map((f) => {
    const sinRuta = f.estado === 'sin-ruta';
    const estado = f.estado === 'activa'
      ? '<span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">Activa</span>'
      : f.estado === 'inactiva'
        ? '<span class="px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 text-[11px] font-bold">Quitada</span>'
        : '<span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold">Sin ruta</span>';
    const eje = f.eje ? esc(f.eje) : '<span class="text-amber-700 font-semibold">Sin eje</span>';
    const dia = f.dia ? esc(f.dia) : '<span class="text-slate-400">—</span>';
    const casilla = puedeEditar
      ? `<td class="${TD} w-8"><input type="checkbox" class="chk-cementerio" data-cementerio="${esc(f.nombre)}" data-sin-ruta="${sinRuta ? '1' : '0'}" aria-label="Marcar ${esc(f.nombre)}"></td>`
      : '';
    const acciones = puedeEditar ? `<td class="${TD} text-right whitespace-nowrap">${botonesRuta(f)}</td>` : '';
    return `<tr class="border-b border-slate-100 ${f.estado === 'inactiva' ? 'text-slate-400' : ''}">${casilla}<td class="${TD} font-semibold">${esc(f.etiqueta || f.nombre)}</td><td class="${TD}">${eje}</td><td class="${TD}">${dia}</td><td class="${TD}">${estado}</td>${acciones}</tr>`;
  }).join('');
}

function botonesFeriado(fecha, activo) {
  const datos = `data-fecha="${esc(fecha)}"`;
  return activo
    ? `<button type="button" data-accion="quitar-feriado" ${datos} class="${BOTON} border-rose-300 text-rose-700 hover:bg-rose-50">Quitar</button>`
    : `<button type="button" data-accion="reactivar-feriado" ${datos} class="${BOTON} border-emerald-300 text-emerald-800 hover:bg-emerald-50">Reactivar</button>`;
}

/** Filas (<tr>) de la tabla de feriados, ordenadas por fecha. Un documento cuyo id no es una fecha no se lista. */
export function htmlFilasFeriados(docs, { puedeEditar = false } = {}) {
  const validos = (Array.isArray(docs) ? docs : [])
    .filter((d) => d && esFechaIso(String(d.id ?? '')))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  if (validos.length === 0) {
    return `<tr><td colspan="${puedeEditar ? 6 : 5}" class="py-6 text-center text-slate-400 text-sm">No hay feriados cargados todavía.</td></tr>`;
  }
  return validos.map((d) => {
    const datos = d.data && typeof d.data === 'object' ? d.data : {};
    const activo = datos.activo !== false;
    const regional = String(datos.alcance ?? '').trim().toLowerCase() === 'regional';
    const dia = DIAS_SEMANA[diaSemanaIso(d.id) - 1] || '';
    const estado = activo
      ? '<span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">Activo</span>'
      : '<span class="px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 text-[11px] font-bold">Quitado</span>';
    const acciones = puedeEditar ? `<td class="${TD} text-right whitespace-nowrap">${botonesFeriado(d.id, activo)}</td>` : '';
    return `<tr class="border-b border-slate-100 ${activo ? '' : 'text-slate-400'}"><td class="${TD} font-semibold whitespace-nowrap">${esc(fechaDisplay(d.id))}</td><td class="${TD}">${esc(dia)}</td><td class="${TD}">${esc(String(datos.nombre ?? '').trim() || 'Feriado')}</td><td class="${TD}">${regional ? 'Regional' : 'Nacional'}</td><td class="${TD}">${estado}</td>${acciones}</tr>`;
  }).join('');
}

/** Líneas con problemas de una lista pegada de feriados. Sin errores no pinta nada. */
export function htmlListaErroresFeriados(errores) {
  if (!errores || errores.length === 0) return '';
  const items = errores.map((e) => `<li><span class="font-bold">Línea ${esc(e.linea)}:</span> ${esc(e.motivo)}</li>`).join('');
  return `<div class="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900"><p class="font-bold mb-1">Estas líneas no se pueden cargar. Corrígelas y vuelve a intentar: no se guardó nada:</p><ul class="list-disc pl-5 space-y-0.5">${items}</ul></div>`;
}

/** Resumen de un guardado en lote: cuántas se guardaron y, de las que fallaron, el motivo. `tipo`: 'rutas' | 'feriados'. */
export function htmlResultadosGuardado(resultados, tipo) {
  if (!resultados || resultados.length === 0) return '';
  const ok = resultados.filter((r) => r.ok).length;
  const fallas = resultados.filter((r) => !r.ok);
  const clase = fallas.length ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-emerald-50 border-emerald-300 text-emerald-900';
  const detalle = fallas.length
    ? `<ul class="list-disc pl-5 mt-1 space-y-0.5">${fallas.map((r) => `<li>No se pudo guardar «${esc(r.id)}»: ${esc(textoErrorGuardar(r.error, tipo))}</li>`).join('')}</ul>`
    : '';
  return `<div class="p-3 border rounded-xl text-xs ${clase}" role="status"><p class="font-bold">Se guardaron ${esc(ok)} de ${esc(resultados.length)}.</p>${detalle}</div>`;
}
