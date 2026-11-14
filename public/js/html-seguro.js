/**
 * html-seguro.js — escape de datos antes de interpolarlos en `innerHTML` o en un atributo HTML.
 *
 * Por qué existe (AUD-01): las órdenes se crean desde el sitio público (`iniciarOrden`) y guardan texto libre
 * (difunto, titular, sector, patio, N° de sepultura). Si el backoffice lo pega en `innerHTML` sin escapar, ese texto se
 * ejecuta con la sesión del staff. Regla: TODO dato que venga de Firestore (órdenes, contratos, informes, clientes,
 * staff) pasa por `escaparHtml` al ir en una plantilla; si no hace falta HTML, usar `textContent`.
 *
 * Mismo criterio que `public/js/html-seguro.js` de la web. Sin DOM ni Firebase: se prueba con node --test.
 */
export function escaparHtml(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;');
}

/** Alias corto para plantillas largas: `${esc(item.difunto)}`. */
export const esc = escaparHtml;
