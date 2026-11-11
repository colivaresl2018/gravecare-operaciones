/**
 * fotos-informe.js — resolución única de las 4 fotografías de un informe de visita.
 *
 * El protocolo de terreno (informe-captura.html) guarda 4 fotos en `informes/{id}.fotos`:
 *   inicial → «1. Estado Inicial»      (y su alias `antes`)
 *   finalizado → «2. Finalizado»       (y su alias `despues`)
 *   ornamentacion → «3. Ornamentación»
 *   panoramica → «4. Vista Panorámica»
 * informe-revision.html las lee con esos nombres (más los alias `flores`, `general` y los campos sueltos
 * `fotoInicial`, `fotoFinal`, `fotoOrnamentacion`, `fotoPanoramica`). Antes, trabajos-terminados.html buscaba solo un
 * esquema distinto de 2 «antes» + 2 «después» (`fotoAntes2`/`fotoDespues2`) y por eso mostraba «Sin fotografía
 * registrada» en las otras dos. Ambas pantallas usan ahora esta función.
 *
 * Prioridad: primero los campos del protocolo (los mismos de informe-revision); después, como respaldo, los esquemas
 * antiguos (`fotoAntes1/2`, `fotoDespues1/2`, `fotosAntes`, `fotosDespues`, `fotos` como arreglo, `fotoAntes`…).
 * Sin Firebase ni DOM: se prueba con node --test.
 */

export const TITULOS_FOTOS = Object.freeze(['1. Estado Inicial', '2. Finalizado', '3. Ornamentación', '4. Vista Panorámica']);

/** Texto de URL de un valor (cadena o {url}); '' si no hay. */
function url(v) {
  if (typeof v === 'string') return v.trim();
  if (v && typeof v === 'object' && typeof v.url === 'string') return v.url.trim();
  return '';
}

/** Primer valor con URL de la lista. */
function primera(...valores) {
  for (const v of valores) {
    const u = url(v);
    if (u) return u;
  }
  return '';
}

/**
 * @param {object} inf  documento de informes/{id}
 * @returns {{numero:number, titulo:string, url:string}[]}  siempre 4 elementos; `url` vacía si no hay foto
 */
export function resolverFotosInforme(inf) {
  const i = inf || {};
  const arreglo = Array.isArray(i.fotos) ? i.fotos : (Array.isArray(i.imagenes) ? i.imagenes : null);
  const f = i.fotos && typeof i.fotos === 'object' && !Array.isArray(i.fotos) ? i.fotos : {};
  const antes = Array.isArray(i.fotosAntes) ? i.fotosAntes : [];
  const despues = Array.isArray(i.fotosDespues) ? i.fotosDespues : [];

  // 1. Campos del protocolo (los mismos que lee informe-revision.html).
  const slots = [
    primera(f.inicial, f.antes, i.fotoInicial),
    primera(f.finalizado, f.despues, i.fotoFinal),
    primera(f.ornamentacion, f.flores, i.fotoOrnamentacion),
    primera(f.panoramica, f.general, i.fotoPanoramica),
  ];
  const titulos = [...TITULOS_FOTOS];

  // 2. Respaldo: esquemas antiguos de «antes»/«después».
  if (!slots[0]) slots[0] = primera(i.fotoAntes1, i.fotoAntesUrl1, antes[0], f.antes1, i.fotoAntesUrl, i.fotoAntes, i.urlFotoAntes);
  if (!slots[1]) slots[1] = primera(i.fotoDespues1, i.fotoDespuesUrl1, despues[0], f.despues1, i.fotoDespuesUrl, i.fotoDespues, i.urlFotoDespues);
  if (arreglo && arreglo.length >= 2) {
    const orden = arreglo.length >= 4 ? [0, 1, 2, 3] : [0, 1];
    orden.forEach((origen, destino) => { if (!slots[destino]) slots[destino] = url(arreglo[origen]); });
  }
  // Segundas fotos del esquema antiguo, solo si el lugar 3 / 4 del protocolo está libre (se rotulan como lo que son).
  if (!slots[2]) {
    const u = primera(i.fotoAntes2, i.fotoAntesUrl2, antes[1], f.antes2, i.fotoAntesExtra);
    if (u) { slots[2] = u; titulos[2] = '3. Estado Inicial (2)'; }
  }
  if (!slots[3]) {
    const u = primera(i.fotoDespues2, i.fotoDespuesUrl2, despues[1], f.despues2, i.fotoDespuesExtra);
    if (u) { slots[3] = u; titulos[3] = '4. Finalizado (2)'; }
  }
  return slots.map((u, k) => ({ numero: k + 1, titulo: titulos[k], url: u }));
}
