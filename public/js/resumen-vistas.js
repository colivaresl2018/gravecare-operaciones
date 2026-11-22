/**
 * resumen-vistas.js — arma el HTML (como texto) del «Resumen de Ventas» de Planificación. Solo lectura, sin DOM ni Firebase.
 * AUD-01: todo texto que no sea un número pasa por esc(). Los montos salen de resumen-ventas.js (montoTotal del servidor).
 */
import { esc } from './html-seguro.js';
import { formatoPesos } from './resumen-ventas.js?v=b5';
import { fechaDisplay } from './fechas-semana.js';

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

function tarjeta(t, destacada) {
  const rango = t.desde === t.hasta ? fechaDisplay(t.desde) : `${fechaDisplay(t.desde)} – ${fechaDisplay(t.hasta)}`;
  const fila = (nombre, valor) => `<div class="flex justify-between gap-2 text-xs"><span class="text-slate-500">${nombre}</span><span class="font-semibold text-slate-800">${valor}</span></div>`;
  return `<div class="bg-white rounded-xl border ${destacada ? 'border-[#002d1a]' : 'border-slate-200'} shadow-sm p-4">`
    + `<div class="text-[10px] font-bold uppercase tracking-wider text-slate-500">${esc(t.titulo)}</div>`
    + `<div class="text-[11px] text-slate-400 mb-2">${esc(rango)}</div>`
    + `<div class="text-xl font-bold text-[#002d1a] mb-2">${esc(formatoPesos(t.monto))}</div>`
    + fila('Ventas', esc(t.ventas)) + fila('Planes', esc(t.planes)) + fila('Spot', esc(t.spot))
    + fila('Ramos adicionales', esc(t.ramosAdicionales)) + fila('Ticket promedio', esc(formatoPesos(t.ticket)))
    + `</div>`;
}

/** Tarjetas Día, Semana, Mes, Año y (si hay desde y hasta) Periodo. */
export function htmlTarjetasResumen(resumen) {
  const t = resumen.tarjetas;
  return [t.dia, t.semana, t.mes, t.anio].map((x) => tarjeta(x, false)).join('') + (t.periodo ? tarjeta(t.periodo, true) : '');
}

/** Filas de las tablas diaria, semanal y mensual. */
export function htmlFilasResumen(filas) {
  if (!filas || filas.length === 0) {
    return '<tr><td colspan="7" class="py-6 text-center text-slate-400">No hay ventas en este rango.</td></tr>';
  }
  return filas.map((f) => `<tr class="hover:bg-slate-50 transition">`
    + `<td class="py-2.5 px-3 whitespace-nowrap font-semibold text-slate-800">${esc(f.etiqueta)}</td>`
    + `<td class="py-2.5 px-3 text-right">${esc(f.ventas)}</td>`
    + `<td class="py-2.5 px-3 text-right">${esc(f.planes)}</td>`
    + `<td class="py-2.5 px-3 text-right">${esc(f.spot)}</td>`
    + `<td class="py-2.5 px-3 text-right">${esc(f.ramosAdicionales)}</td>`
    + `<td class="py-2.5 px-3 text-right font-semibold">${esc(formatoPesos(f.monto))}</td>`
    + `<td class="py-2.5 px-3 text-right text-slate-600">${esc(formatoPesos(f.ticket))}</td></tr>`).join('');
}

/** Textos de los avisos del resumen (vacío si no hay nada que avisar). Son números y texto fijo: no llevan datos de Firestore. */
export function textosAvisosResumen(avisos) {
  const a = avisos || {};
  const textos = [];
  if (a.sinFecha > 0) textos.push(`${plural(a.sinFecha, 'orden sin fecha de pago ni de creación', 'órdenes sin fecha de pago ni de creación')}: no entra${a.sinFecha === 1 ? '' : 'n'} en ningún período.`);
  if (a.sinMonto > 0) textos.push(`${plural(a.sinMonto, 'orden sin monto total', 'órdenes sin monto total')} guardado por el servidor: no entra${a.sinMonto === 1 ? '' : 'n'} en ningún período.`);
  if (a.fechaCreacion > 0) textos.push(`${plural(a.fechaCreacion, 'orden sin fecha de pago se cuenta en su fecha de creación', 'órdenes sin fecha de pago se cuentan en su fecha de creación')}.`);
  if (a.pruebas > 0) textos.push(`${plural(a.pruebas, 'orden de prueba (Transbank en integración) no se suma', 'órdenes de prueba (Transbank en integración) no se suman')} como venta.`);
  return textos;
}
