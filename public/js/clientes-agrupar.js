/**
 * clientes-agrupar.js — agrupa los servicios de «Gestión de Clientes» por cliente (RUT).
 *
 * Problema: la lista tenía una fila por cada servicio (orden) o ficha, así que un mismo cliente con dos servicios
 * (p. ej. Plan 4 y Spot) salía repetido con el mismo RUT y cementerio.
 *
 * Regla: un registro de entrada = un servicio (una orden) o una ficha sin servicio. Se agrupan por RUT normalizado
 * (sin puntos, guion ni caracteres que no sean dígitos o K). Sin RUT válido, cada ficha queda sola (clave por ficha).
 * Una misma orden nunca se cuenta dos veces dentro de un grupo.
 *
 * Sin DOM ni Firebase: se prueba con node --test public/js/.
 */

/** Clave de agrupación: solo dígitos y K del RUT. Null si no hay un RUT utilizable. */
export function claveRut(rut) {
  const s = String(rut ?? '').replace(/[^0-9kK]/g, '').toUpperCase();
  return s.length >= 2 ? s : null;
}

/** Visitas que contrata cada plan (misma regla que la página: Spot 1, 12, 6, 4 por defecto). */
export function totalVisitasDelPlan(plan) {
  const pL = String(plan || '').toLowerCase();
  if (pL.includes('spot')) return 1;
  if (pL.includes('12')) return 12;
  if (pL.includes('6')) return 6;
  return 4;
}

/** Etiqueta HTML del estado del servicio: «V1/4» en curso o «Completado (4/4)». Solo usa números internos. */
export function estadoDeServicio(plan, realizadas) {
  const total = totalVisitasDelPlan(plan);
  const hechas = Number(realizadas) || 0;
  if (hechas >= total) {
    return `<span class="bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full text-[10px]">Completado (${total}/${total})</span>`;
  }
  const enCurso = Math.min(total, hechas + 1);
  return `<span class="bg-amber-100 text-amber-800 font-extrabold px-2 py-0.5 rounded-full text-[10px]">V${enCurso}/${total}</span>`;
}

const primerValor = (lista, campo, vacio) => lista.map(s => s[campo]).find(v => v && v !== vacio) || vacio;

/**
 * Agrupa los registros de servicio por cliente.
 * @param {object[]} servicios  registros con: clienteId, ordenId ('' si no hay orden), tieneServicio, rut, nombre,
 *                              email, telefono, comuna, cementerioDetalle, plan, suscripcion, ramos, serQuerido,
 *                              estadoServicioHtml, fechaRegistro, id, numeroOrdenRef
 * @returns {object[]} un grupo por cliente: { clave, servicios, cantServicios, principal, nombre, rut, email, telefono, comuna }
 *          `principal` es el primer servicio contratado (o el primer registro si el cliente no tiene ninguno).
 */
export function agruparPorCliente(servicios) {
  const grupos = new Map();
  for (const s of servicios || []) {
    const clave = claveRut(s.rut) || `sin-rut:${s.clienteId ?? s.id}`;
    if (!grupos.has(clave)) grupos.set(clave, { clave, servicios: [], ordenesVistas: new Set() });
    const g = grupos.get(clave);
    if (s.ordenId) {
      if (g.ordenesVistas.has(s.ordenId)) continue; // la misma orden llegó por dos fichas: se muestra una vez
      g.ordenesVistas.add(s.ordenId);
    }
    g.servicios.push(s);
  }

  return [...grupos.values()].map(g => {
    const contratados = g.servicios.filter(s => s.tieneServicio);
    const principal = contratados[0] || g.servicios[0];
    const nombre = g.servicios.map(s => s.nombre).find(n => n && n !== 'Cliente') || principal.nombre || 'Cliente';
    return {
      clave: g.clave,
      servicios: g.servicios,
      cantServicios: contratados.length,
      principal,
      nombre,
      rut: primerValor(g.servicios, 'rut', '-'),
      email: primerValor(g.servicios, 'email', '-'),
      telefono: primerValor(g.servicios, 'telefono', '-'),
      comuna: primerValor(g.servicios, 'comuna', '-')
    };
  });
}
