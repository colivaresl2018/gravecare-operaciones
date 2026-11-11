/**
 * informe-rechazado.js — «¿la visita tiene un informe rechazado que el operador debe corregir?».
 *
 * Al rechazar, informe-revision.html marca el informe (informes/{ordenId}-V{n}) como `rechazado` con su motivo y deja
 * la visita en la orden con estado `rechazada` (programacionVisitas.v_{n}). La asignación del operador no cambia, así que
 * la visita sigue siendo suya; aquí solo se decide si hay que mostrarla como «Rechazado» y con qué motivo.
 * Cuando el operador reenvía el informe corregido (informe-captura.html), el informe pasa a `pendiente_revision` y la
 * visita a «en revision»: deja de figurar como rechazada aunque conserve el motivo anterior.
 *
 * Solo LEE campos existentes (contrato de datos). Sin Firebase ni DOM: se prueba con node --test.
 */

const RECHAZADOS = ['rechazado', 'rechazada', 'rechazados'];
const norm = (s) => String(s == null ? '' : s).toLowerCase().trim();
const esRechazo = (estado) => RECHAZADOS.includes(norm(estado));
const texto = (v) => (typeof v === 'string' ? v.trim() : '');

/** Informe (con cualquier estado) de la visita n, buscado por los ids con que se conoce la orden. */
function informeDe(indice, identificadores, n) {
  if (!indice || !indice.porVisita) return null;
  for (const ident of identificadores) {
    const hit = indice.porVisita.get(`${ident}|${n}`);
    if (hit) return hit.data;
  }
  if (n === 1) {
    for (const ident of identificadores) {
      const data = indice.porId && indice.porId.get(ident);
      if (data) return data; // informe antiguo sin sufijo: solo corresponde a la visita 1
    }
  }
  return null;
}

/**
 * @param {object} orden  Documento de la orden.
 * @param {number} n      Número de visita (1..N).
 * @param {{docId?:string, indiceInformes?:object}} ctx  `indiceInformes` es el de crearIndiceInformes (servicio-terminado.js).
 * @returns {{rechazada:boolean, motivo:string}}
 */
export function rechazoDeVisita(orden, n, ctx = {}) {
  const o = orden && typeof orden === 'object' ? orden : {};
  const prog = (o.programacionVisitas && o.programacionVisitas[`v_${n}`]) || {};
  const ids = [...new Set([ctx.docId, o.numeroOrden, o.ordenId].filter(Boolean).map(String))];
  const informe = informeDe(ctx.indiceInformes, ids, n);
  const motivoVisita = texto(prog.motivoRechazo);
  if (informe) {
    // El informe manda: si ya se reenvió corregido, no es rechazo aunque conserve el motivo viejo.
    return esRechazo(informe.estado)
      ? { rechazada: true, motivo: texto(informe.motivoRechazo) || motivoVisita }
      : { rechazada: false, motivo: '' };
  }
  return esRechazo(prog.estado) ? { rechazada: true, motivo: motivoVisita } : { rechazada: false, motivo: '' };
}
