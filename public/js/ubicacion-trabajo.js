// Ubicación de las visitas asignadas en el mapa de «Mis Trabajos» (módulo puro, sin DOM ni Firebase).
//
// Antes el mapa buscaba el cementerio por nombre exacto en un diccionario de 5 entradas escrito dentro de
// mis-trabajos.html: «Cementerio El Prado de Puente Alto» (y casi cualquier otro nombre) no estaba, así que
// la visita aparecía en el listado pero no en el mapa. Además pasaba `coordenadas` tal cual a Google Maps,
// que falla con el formato {latitude, longitude} que usan las órdenes e informes.
//
// Prioridad: 1) coordenadas de la sepultura (orden) → 2) ubicación de referencia del cementerio (aproximada)
// → 3) sin ubicación (la página muestra un aviso en español en lugar de un mapa vacío).
//
// Las coordenadas de los cementerios son una copia del catálogo del repo de la web
// (docs/referencias/cementerios.json, 17 cementerios vigentes cem-001…cem-018 sin cem-004, eliminado por el dueño el 29-oct; con sus alias). Si allá se corrige una, replicarla aquí.

/** Texto comparable: minúsculas, sin tildes, sin puntuación y con espacios simples. */
export function normalizarNombre(s) {
  if (s === null || s === undefined) return '';
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

const aNumero = (v) => {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string' || v.trim() === '') return NaN;
  return Number(v.trim().replace(',', '.'));
};

/** Lee {lat,lng} | {latitude,longitude} | {_lat,_long} (GeoPoint serializado). Devuelve {lat,lng} válido o null. */
export function leerCoordenada(x) {
  if (!x || typeof x !== 'object') return null;
  const lat = aNumero(x.lat ?? x.latitude ?? x._lat);
  const lng = aNumero(x.lng ?? x.longitude ?? x._long ?? x.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  if (lat === 0 && lng === 0) return null; // GPS sin dato
  return { lat, lng };
}

/** Coordenadas de la sepultura guardadas en la orden, en cualquiera de sus formas habituales. */
export function coordenadasDeOrden(d) {
  if (!d || typeof d !== 'object') return null;
  const u = d.ubicacionSepultura || {};
  const candidatas = [u.coordenadas, u.coordenadasGps, d.coordenadas, d.coordenadasGps, u, d];
  for (const c of candidatas) {
    const r = leerCoordenada(c);
    if (r) return r;
  }
  return null;
}

// Catálogo de cementerios (copia de referencia; nombres visibles, alias y nombre corto cuando no es ambiguo).
const CATALOGO = [
  { nombres: ['Parque del Recuerdo de Huechuraba', 'Parque del Recuerdo Américo Vespucio'], lat: -33.3838805, lng: -70.6345455 },
  { nombres: ['Cementerio General de Recoleta', 'Cementerio General de Santiago', 'Cementerio General'], lat: -33.4176636, lng: -70.6500999 },
  { nombres: ['Cementerio Católico de Recoleta'], lat: -33.4134151, lng: -70.6422611 },
  { nombres: ['Parque Canaán de Pudahuel', 'Parque Canaán'], lat: -33.442826, lng: -70.8013175 },
  { nombres: ['Cementerio Metropolitano de Lo Espejo', 'Cementerio Metropolitano'], lat: -33.5304473, lng: -70.68327 },
  { nombres: ['Parque del Recuerdo Cordillera de Puente Alto', 'Parque del Recuerdo Cordillera'], lat: -33.5549429, lng: -70.54416 },
  { nombres: ['Cementerio El Prado de Puente Alto', 'Cementerio El Prado', 'Parque del Prado', 'Parque El Prado', 'Parque del Prado de Puente Alto'], lat: -33.5548133, lng: -70.5598832 },
  { nombres: ['Parque Sendero de San Bernardo', 'Parque Sendero San Bernardo'], lat: -33.609585, lng: -70.718771 },
  { nombres: ['Parque Sendero de Maipú', 'Parque Sendero Maipú'], lat: -33.4654272, lng: -70.7671207 },
  { nombres: ['Parque El Manantial de Maipú', 'Parque El Manantial'], lat: -33.4728208, lng: -70.76073 },
  { nombres: ['Cementerio Católico de Maipú'], lat: -33.5078387, lng: -70.7698562 },
  { nombres: ['Parque del Recuerdo de Padre Hurtado', 'Parque del Recuerdo Padre Hurtado', 'Padre Hurtado', 'Cementerio Parque Padre Hurtado'], lat: -33.6094158, lng: -70.835687 },
  { nombres: ['Cementerio Municipal N° 1 de Rancagua', 'Cementerio Municipal N° 1'], lat: -34.164688, lng: -70.7472616 },
  { nombres: ['Cementerio Municipal N° 2 de Rancagua', 'Cementerio Municipal N° 2 (Baquedano)', 'Cementerio Municipal N° 2'], lat: -34.1655658, lng: -70.7670607 },
  { nombres: ['Parque Jardín de Rancagua', 'Parque Jardín Rancagua'], lat: -34.162336, lng: -70.7975146 },
  { nombres: ['Parque Jardín Las Flores de Machalí', 'Parque Jardín Las Flores', 'Parque Jardín Las Flores de Rancagua'], lat: -34.1797461, lng: -70.6908177 },
  { nombres: ['Parque Sendero de Rancagua', 'Parque Sendero Rancagua', 'Sendero Rancagua', 'Parque del Recuerdo Rancagua'], lat: -34.1604909, lng: -70.7563741 },
];

const INDICE = CATALOGO.flatMap((c) => c.nombres.map((n) => ({ clave: normalizarNombre(n), lat: c.lat, lng: c.lng })));

/**
 * Ubicación de referencia de un cementerio por su nombre. Coincidencia exacta (sin tildes ni mayúsculas) o, si el
 * nombre de la orden contiene un nombre conocido, el más largo. Nombres genéricos («Parque Sendero») → null.
 */
export function coordenadasCementerio(nombre) {
  const n = normalizarNombre(nombre);
  if (!n) return null;
  let mejor = null;
  for (const e of INDICE) {
    if (n === e.clave) return { lat: e.lat, lng: e.lng };
    if ((` ${n} `).includes(` ${e.clave} `) && (!mejor || e.clave.length > mejor.clave.length)) mejor = e;
  }
  return mejor ? { lat: mejor.lat, lng: mejor.lng } : null;
}

/** Ubicación de una visita: {lat,lng,origen:'sepultura'|'cementerio',aproximada} o null si no hay ninguna. */
export function ubicacionDeVisita(orden, nombreCementerio) {
  const exacta = coordenadasDeOrden(orden);
  if (exacta) return { ...exacta, origen: 'sepultura', aproximada: false };
  const cem = coordenadasCementerio(nombreCementerio);
  if (cem) return { ...cem, origen: 'cementerio', aproximada: true };
  return null;
}

/** Un pin por lugar (con todas las visitas de ese lugar) y la lista de visitas que no se pueden ubicar. */
export function agruparMarcadores(visitas) {
  const porLugar = new Map();
  const sinUbicacion = [];
  for (const v of visitas || []) {
    const u = v && leerCoordenada(v.ubicacion);
    if (!u) { sinUbicacion.push(v); continue; }
    const aproximada = v.ubicacion.aproximada === true;
    const clave = `${u.lat.toFixed(6)},${u.lng.toFixed(6)},${aproximada ? 'a' : 'e'}`;
    if (!porLugar.has(clave)) porLugar.set(clave, { lat: u.lat, lng: u.lng, aproximada, cementerio: v.cementerio || '', visitas: [] });
    porLugar.get(clave).visitas.push(v);
  }
  return { marcadores: [...porLugar.values()], sinUbicacion };
}

/** Visitas de una misma orden juntas: [{orden, difunto, cementerio, visitas:['1/6','2/6']}] (sin repetir el N° de orden). */
export function agruparPorOrden(visitas) {
  const porOrden = new Map();
  for (const v of visitas || []) {
    const orden = String(v.idVisitaCompleto ?? '').replace(/-V\d+$/, '');
    if (!porOrden.has(orden)) porOrden.set(orden, { orden, difunto: v.difunto, cementerio: v.cementerio, visitas: [] });
    const g = porOrden.get(orden);
    g.visitas.push(v.badgeFraccion || String(v.idVisitaCompleto ?? '').match(/-V(\d+)$/)?.[0]?.slice(1) || '');
  }
  return [...porOrden.values()];
}

/** Textos para la cabecera del mapa y el aviso bajo él (español claro). `aviso` vacío = no mostrar. */
export function resumenMapa(visitas) {
  const lista = visitas || [];
  if (lista.length === 0) return { estado: 'Sin labores pendientes', aviso: '' };
  const { marcadores, sinUbicacion } = agruparMarcadores(lista);
  const ordenes = (vs) => agruparPorOrden(vs).map((o) => o.orden).join(', ');
  if (marcadores.length === 0) {
    const cems = [...new Set(sinUbicacion.map((v) => v.cementerio || 'sin cementerio'))].join(', ');
    const uno = agruparPorOrden(sinUbicacion).length === 1;
    return {
      estado: 'Sin coordenadas registradas',
      aviso: `${uno ? 'La orden' : 'Las órdenes'} ${ordenes(sinUbicacion)} ${uno ? 'no tiene' : 'no tienen'} ubicación en el mapa: no trae coordenadas y no conocemos las del cementerio (${cems}). Revisa el listado de abajo.`,
    };
  }
  const partes = [];
  if (marcadores.some((m) => m.aproximada)) partes.push('Los pines naranjos son la ubicación aproximada del cementerio: la sepultura todavía no tiene coordenadas exactas.');
  if (sinUbicacion.length) partes.push(`Sin ubicación en el mapa: ${ordenes(sinUbicacion)}.`);
  return {
    estado: `${marcadores.length} ${marcadores.length === 1 ? 'ubicación' : 'ubicaciones'} en el mapa`,
    aviso: partes.join(' '),
  };
}

export function escaparHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Texto plano al pasar el cursor por el pin. */
export function tituloMarcador(grupo) {
  return agruparPorOrden(grupo.visitas).map((o) => `${o.orden} · ${o.difunto} · ${o.cementerio}`).join(' | ');
}

/** HTML de la ventana que se abre al tocar un pin: orden, difunto y cementerio (con sus visitas pendientes). */
export function contenidoMarcador(grupo) {
  const filas = agruparPorOrden(grupo.visitas).map((o) => `<div style="margin-bottom:6px;"><strong>${escaparHtml(o.orden)}</strong><br>Difunto: ${escaparHtml(o.difunto)}<br>Cementerio: ${escaparHtml(o.cementerio)}<br>Visitas pendientes: ${escaparHtml(o.visitas.join(', '))}</div>`).join('');
  const nota = grupo.aproximada ? '<div style="color:#b45309;font-weight:600;">Ubicación aproximada del cementerio</div>' : '';
  return `<div style="color:#111;font-family:sans-serif;font-size:13px;max-width:260px;">${filas}${nota}</div>`;
}

/**
 * Ventana del Mapa de Operaciones: una ficha por visita del lugar (difunto, visita y estado, cementerio, cliente y operador),
 * con scroll si el lugar tiene muchas. Todo el texto va escapado.
 */
export function contenidoMarcadorOperativo(grupo) {
  const fichas = grupo.visitas.map((v) => `<div style="margin-bottom:8px;"><strong style="color:#002d1a;font-size:13px;">${escaparHtml(v.difunto)}</strong><br><span style="display:inline-block;margin:2px 0;background:#fef3c7;color:#92400e;padding:2px 6px;border-radius:4px;font-weight:bold;font-size:11px;">Visita ${escaparHtml(v.visitaNumero)} de ${escaparHtml(v.totalVisitas)} (${escaparHtml(String(v.estadoVisita || '').toUpperCase())})</span><br><span>${escaparHtml(v.cementerio)}</span><br><span style="color:#64748b;">Cliente: ${escaparHtml(v.cliente)}</span><br><span style="color:#002d1a;font-weight:bold;">Operador: ${escaparHtml(v.operador)}</span></div>`).join('');
  const nota = grupo.aproximada ? '<div style="color:#b45309;font-weight:600;">Ubicación aproximada del cementerio</div>' : '';
  return `<div style="font-family:sans-serif;font-size:12px;padding:4px;max-width:280px;max-height:240px;overflow-y:auto;">${fichas}${nota}</div>`;
}
