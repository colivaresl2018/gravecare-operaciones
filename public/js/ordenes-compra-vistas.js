/**
 * ordenes-compra-vistas.js — arma el HTML (como texto) de las órdenes de compra y del maestro de materiales (spec 055).
 * Sin DOM ni Firebase: se prueba con `node --test`; la página asigna el resultado a innerHTML.
 * R10 / AUD-01: todo texto que viene de Firestore o del usuario pasa por esc(), también en la vista de impresión.
 * R9: la impresión muestra solo lo que va en la orden (nada interno: ni uid de quien la creó o anuló, ni claims).
 */
import { esc } from './html-seguro.js';
import { fechaDisplay, esFechaIso } from './fechas-semana.js';

const TD = 'py-2.5 px-3 align-top';
const BOTON = 'px-2.5 py-1 rounded-lg text-[11px] font-bold border transition';

/** $1.234.567 (pesos chilenos, punto de miles). Sin valor → «—». */
export function formatoPesos(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  const signo = n < 0 ? '-' : '';
  return `${signo}$${String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

const fecha = (iso) => (esFechaIso(String(iso ?? '')) ? fechaDisplay(iso) : '');

/** Valor del desplegable de razón social que significa «Otro proveedor (escribir)» (spec 057, decisión 3). */
export const VALOR_OTRO_PROVEEDOR = '__otro__';

/** Filas (<tr>) del maestro de proveedores (spec 057, parte a). Quitar y reactivar solo para quien puede (dueño). */
export function htmlFilasProveedores(docs, { puedeQuitar = false } = {}) {
  const lista = (Array.isArray(docs) ? docs : []).filter((d) => d && d.data)
    .sort((a, b) => String(a.data.razonSocial ?? '').localeCompare(String(b.data.razonSocial ?? ''), 'es'));
  if (lista.length === 0) {
    return '<tr><td colspan="8" class="py-6 text-center text-slate-400 text-sm">No hay proveedores cargados todavía.</td></tr>';
  }
  return lista.map(({ id, data: p }) => {
    const activo = p.activo === true;
    const estado = activo
      ? '<span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">Activo</span>'
      : '<span class="px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 text-[11px] font-bold">Quitado</span>';
    const datos = `data-id="${esc(id)}"`;
    const editar = `<button type="button" data-accion="editar-proveedor" ${datos} class="${BOTON} border-slate-300 text-slate-700 hover:bg-slate-100">Editar</button>`;
    let estadoBtn = '';
    if (puedeQuitar) {
      estadoBtn = activo
        ? ` <button type="button" data-accion="quitar-proveedor" ${datos} class="${BOTON} border-rose-300 text-rose-700 hover:bg-rose-50">Quitar</button>`
        : ` <button type="button" data-accion="reactivar-proveedor" ${datos} class="${BOTON} border-emerald-300 text-emerald-800 hover:bg-emerald-50">Reactivar</button>`;
    }
    return `<tr class="border-b border-slate-100 ${activo ? '' : 'text-slate-400'}"><td class="${TD} font-semibold">${esc(p.razonSocial)}</td><td class="${TD} whitespace-nowrap">${esc(p.rut)}</td><td class="${TD}">${esc(p.contacto)}</td><td class="${TD} whitespace-nowrap">${esc(p.telefono)}</td><td class="${TD}">${esc(p.correo)}</td><td class="${TD}">${esc(p.condicionesPago)}</td><td class="${TD}">${estado}</td><td class="${TD} text-right whitespace-nowrap">${editar}${estadoBtn}</td></tr>`;
  }).join('');
}

/** Opciones del desplegable de razón social: placeholder, proveedores activos y «Otro proveedor (escribir)» al final. */
export function htmlOpcionesRazon(opciones, seleccionado = '') {
  const lista = Array.isArray(opciones) ? opciones : [];
  const opcion = (valor, texto, marcada = false) => `<option value="${esc(valor)}"${marcada ? ' selected' : ''}>${esc(texto)}</option>`;
  const provs = lista.map((o) => opcion(o.id, o.razonSocial, o.id === seleccionado)).join('');
  return `${opcion('', 'Elige un proveedor…')}${provs}${opcion(VALOR_OTRO_PROVEEDOR, 'Otro proveedor (escribir)', seleccionado === VALOR_OTRO_PROVEEDOR)}`;
}

/** Filas (<tr>) de los borradores de orden por día (spec 057, parte c). Solo los pendientes se pueden abrir. */
export function htmlFilasBorradores(borradores) {
  const lista = (Array.isArray(borradores) ? borradores : []).filter((b) => b && b.data)
    .sort((a, b) => String(a.id).localeCompare(String(b.id), 'es'));
  if (lista.length === 0) {
    return '<tr><td colspan="5" class="py-6 text-center text-slate-400 text-sm">No hay borradores de orden por día.</td></tr>';
  }
  return lista.map(({ id, data: b }) => {
    const emitido = String(b.emitidoComo ?? '').trim();
    const estado = emitido
      ? `<span class="px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 text-[11px] font-bold">Emitida como ${esc(emitido)}</span>`
      : '<span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[11px] font-bold">Pendiente</span>';
    const abrir = emitido
      ? ''
      : `<button type="button" data-accion="abrir-borrador" data-id="${esc(id)}" class="${BOTON} border-slate-300 text-slate-700 hover:bg-slate-100">Abrir</button>`;
    const cantidad = Array.isArray(b.lineas) ? b.lineas.length : 0;
    return `<tr class="border-b border-slate-100 ${emitido ? 'text-slate-400' : ''}"><td class="${TD} whitespace-nowrap">${esc(fecha(b.fechaDia || id))}</td><td class="${TD} text-right">${esc(cantidad)}</td><td class="${TD} text-right whitespace-nowrap">${esc(formatoPesos(b.total))}</td><td class="${TD}">${estado}</td><td class="${TD} text-right">${abrir}</td></tr>`;
  }).join('');
}

/** Filas (<tr>) del maestro: los 5 ramos (precio de «Valores de ramos», sin botones) y los materiales del maestro. */
export function htmlFilasMateriales(catalogo, { puedeEditar = false } = {}) {
  const lista = Array.isArray(catalogo) ? catalogo : [];
  if (lista.length === 0) {
    return `<tr><td colspan="${puedeEditar ? 6 : 5}" class="py-6 text-center text-slate-400 text-sm">No hay materiales cargados todavía.</td></tr>`;
  }
  return lista.map((m) => {
    const esRamo = m.origen === 'ramo';
    const precio = m.precioUnitario === null
      ? '<span class="text-amber-700 font-semibold">Sin valor</span>'
      : esc(formatoPesos(m.precioUnitario));
    const estado = esRamo
      ? '<span class="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 text-[11px] font-bold">Desde Valores de ramos</span>'
      : m.activo
        ? '<span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">Activo</span>'
        : '<span class="px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 text-[11px] font-bold">Retirado</span>';
    let acciones = '';
    if (puedeEditar && !esRamo) {
      const datos = `data-codigo="${esc(m.codigo)}"`;
      const editar = `<button type="button" data-accion="editar-material" ${datos} class="${BOTON} border-slate-300 text-slate-700 hover:bg-slate-100">Editar</button>`;
      const estadoBtn = m.activo
        ? `<button type="button" data-accion="retirar-material" ${datos} class="${BOTON} border-rose-300 text-rose-700 hover:bg-rose-50">Retirar</button>`
        : `<button type="button" data-accion="reactivar-material" ${datos} class="${BOTON} border-emerald-300 text-emerald-800 hover:bg-emerald-50">Reactivar</button>`;
      acciones = `${editar} ${estadoBtn}`;
    }
    const celdaAcciones = puedeEditar ? `<td class="${TD} text-right whitespace-nowrap">${acciones}</td>` : '';
    return `<tr class="border-b border-slate-100 ${!esRamo && !m.activo ? 'text-slate-400' : ''}"><td class="${TD} font-semibold whitespace-nowrap">${esc(m.codigo)}</td><td class="${TD}">${esc(m.descripcion)}</td><td class="${TD}">${esc(m.tipo)}</td><td class="${TD}">${esc(m.unidad)}</td><td class="${TD} text-right whitespace-nowrap">${precio}</td><td class="${TD}">${estado}</td>${celdaAcciones}</tr>`;
  }).join('');
}

/** Filas (<tr>) de las órdenes emitidas, la más nueva primero. «Anular» solo para quien puede y solo si está Emitida. */
export function htmlFilasOrdenes(ordenes, { puedeAnular = false } = {}) {
  const lista = (Array.isArray(ordenes) ? ordenes : []).filter((o) => o && o.numero)
    .sort((a, b) => String(b.numero).localeCompare(String(a.numero), 'es', { numeric: true }));
  if (lista.length === 0) {
    return '<tr><td colspan="6" class="py-6 text-center text-slate-400 text-sm">No hay órdenes de compra todavía.</td></tr>';
  }
  return lista.map((o) => {
    const anulada = o.estado === 'Anulada';
    const estado = anulada
      ? '<span class="px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 text-[11px] font-bold">Anulada</span>'
      : '<span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">Emitida</span>';
    const datos = `data-numero="${esc(o.numero)}"`;
    const ver = `<button type="button" data-accion="ver-orden" ${datos} class="${BOTON} border-slate-300 text-slate-700 hover:bg-slate-100">Ver / imprimir</button>`;
    const anular = puedeAnular && !anulada
      ? ` <button type="button" data-accion="anular-orden" ${datos} class="${BOTON} border-rose-300 text-rose-700 hover:bg-rose-50">Anular</button>`
      : '';
    const proveedor = o.proveedor && typeof o.proveedor === 'object' ? o.proveedor.razonSocial : '';
    return `<tr class="border-b border-slate-100 ${anulada ? 'text-slate-400' : ''}"><td class="${TD} font-semibold whitespace-nowrap">${esc(o.numero)}</td><td class="${TD} whitespace-nowrap">${esc(fecha(o.fecha))}</td><td class="${TD}">${esc(proveedor)}</td><td class="${TD} text-right whitespace-nowrap">${esc(formatoPesos(o.total))}</td><td class="${TD}">${estado}</td><td class="${TD} text-right whitespace-nowrap">${ver}${anular}</td></tr>`;
  }).join('');
}

/** Filas del borrador de una orden: cada línea con su valor y un botón para quitarla (solo del borrador, antes de emitir). */
export function htmlLineasBorrador(lineas) {
  const lista = Array.isArray(lineas) ? lineas : [];
  if (lista.length === 0) return `<tr><td colspan="7" class="py-5 text-center text-slate-400 text-sm">Todavía no hay líneas. Agrega un material con su código y cantidad.</td></tr>`;
  return lista.map((l, i) => `<tr class="border-b border-slate-100"><td class="${TD} font-semibold whitespace-nowrap">${esc(l.codigo)}</td><td class="${TD}">${esc(l.descripcion)}</td><td class="${TD}">${esc(l.unidad)}</td><td class="${TD} text-right">${esc(l.cantidad)}</td><td class="${TD} text-right whitespace-nowrap">${esc(formatoPesos(l.precioUnitario))}</td><td class="${TD} text-right whitespace-nowrap">${esc(formatoPesos(l.valor))}</td><td class="${TD} text-right"><button type="button" data-accion="quitar-linea" data-indice="${i}" class="${BOTON} border-rose-300 text-rose-700 hover:bg-rose-50">Quitar</button></td></tr>`).join('');
}

/** Neto, IVA 19 % y total. */
export function htmlTotales(t) {
  const v = t || { neto: 0, iva: 0, total: 0 };
  return `<dl class="text-sm space-y-1"><div class="flex justify-between gap-6"><dt class="text-slate-600">Neto</dt><dd class="font-semibold">${esc(formatoPesos(v.neto))}</dd></div><div class="flex justify-between gap-6"><dt class="text-slate-600">IVA 19 %</dt><dd class="font-semibold">${esc(formatoPesos(v.iva))}</dd></div><div class="flex justify-between gap-6 border-t border-slate-300 pt-1"><dt class="font-bold">Total</dt><dd class="font-bold">${esc(formatoPesos(v.total))}</dd></div></dl>`;
}

const filaDato = (etiqueta, valor) => (String(valor ?? '').trim()
  ? `<p><span class="font-bold">${esc(etiqueta)}:</span> ${esc(valor)}</p>`
  : '');

/** Vista de impresión de una OC: GraveCare, número, fechas, proveedor, líneas y totales. Nada interno (R9). */
export function htmlImpresion(orden) {
  const o = orden && typeof orden === 'object' ? orden : {};
  const p = o.proveedor && typeof o.proveedor === 'object' ? o.proveedor : {};
  const lineas = (Array.isArray(o.lineas) ? o.lineas : []).map((l) => `<tr><td class="py-1.5 px-2 border border-slate-400">${esc(l.codigo)}</td><td class="py-1.5 px-2 border border-slate-400">${esc(l.descripcion)}</td><td class="py-1.5 px-2 border border-slate-400">${esc(l.unidad)}</td><td class="py-1.5 px-2 border border-slate-400 text-right">${esc(l.cantidad)}</td><td class="py-1.5 px-2 border border-slate-400 text-right">${esc(formatoPesos(l.precioUnitario))}</td><td class="py-1.5 px-2 border border-slate-400 text-right">${esc(formatoPesos(l.valor))}</td></tr>`).join('');
  const anulada = o.estado === 'Anulada';
  const aviso = anulada
    ? `<p class="my-3 p-2 border-2 border-rose-700 text-rose-700 font-bold text-center">ORDEN ANULADA${String(o.motivoAnulacion ?? '').trim() ? ` — Motivo: ${esc(o.motivoAnulacion)}` : ''}</p>`
    : '';
  return `<div class="oc-impresion text-sm text-black">
<div class="flex justify-between items-start border-b-2 border-black pb-2 mb-3"><div><p class="text-2xl font-bold">GraveCare</p><p class="text-xs">Orden de compra a proveedor</p></div><div class="text-right"><p class="text-xl font-bold">${esc(o.numero)}</p>${filaDato('Fecha', fecha(o.fecha))}${filaDato('Entrega', fecha(o.fechaEntrega))}</div></div>
${aviso}
<div class="mb-3"><p class="font-bold uppercase text-xs mb-1">Proveedor</p>${filaDato('Razón social', p.razonSocial)}${filaDato('RUT', p.rut)}${filaDato('Contacto', p.contacto)}${filaDato('Teléfono', p.telefono)}${filaDato('Dirección', p.direccion)}</div>
<div class="mb-3">${filaDato('Condiciones de pago', o.condicionesPago)}${filaDato('Lugar de entrega', o.lugarEntrega)}</div>
<table class="w-full border-collapse mb-3"><thead><tr class="bg-slate-200"><th class="py-1.5 px-2 border border-slate-400 text-left">Código</th><th class="py-1.5 px-2 border border-slate-400 text-left">Descripción</th><th class="py-1.5 px-2 border border-slate-400 text-left">Unidad</th><th class="py-1.5 px-2 border border-slate-400 text-right">Cantidad</th><th class="py-1.5 px-2 border border-slate-400 text-right">Precio</th><th class="py-1.5 px-2 border border-slate-400 text-right">Valor</th></tr></thead><tbody>${lineas}</tbody></table>
<div class="flex justify-end">${htmlTotales({ neto: o.neto, iva: o.iva, total: o.total })}</div>
</div>`;
}
