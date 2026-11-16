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

const FOTO_ES_TEXTO = (v) => (typeof v === 'string' && v.trim() !== '' ? v : null);

/**
 * Lo que el operador ya había cargado en el informe, para que al corregirlo no tenga que rehacerlo.
 * Devuelve las 4 fotos (1 estado inicial, 2 finalizado, 3 ornamentación, 4 vista panorámica), las labores y las observaciones.
 * @returns {{fotos:{1:?string,2:?string,3:?string,4:?string}, labores:string[], observaciones:string}}
 */
export function datosParaCorregir(informe) {
  const i = informe && typeof informe === 'object' ? informe : {};
  const f = i.fotos && typeof i.fotos === 'object' ? i.fotos : {};
  return {
    fotos: {
      1: FOTO_ES_TEXTO(f.inicial) || FOTO_ES_TEXTO(f.antes),
      2: FOTO_ES_TEXTO(f.finalizado) || FOTO_ES_TEXTO(f.despues),
      3: FOTO_ES_TEXTO(f.ornamentacion),
      4: FOTO_ES_TEXTO(f.panoramica),
    },
    labores: Array.isArray(i.laboresEjecutadas) ? i.laboresEjecutadas.filter((x) => typeof x === 'string') : [],
    observaciones: texto(i.observaciones),
  };
}
