// Coordenadas de referencia (ubicación general, no de una sepultura
// puntual) de cada cementerio donde opera GraveCare. Se usan como respaldo
// en el mapa de "Mis Trabajos" cuando una orden todavía no tiene
// coordenadas propias — así el operador igual ve un pin de referencia con
// la ubicación aproximada del cementerio, en vez de que el trabajo
// desaparezca del mapa.
//
// Misma fuente que gravecare/public/cementerios.html (repo del sitio del
// cliente) — si corriges una coordenada ahí, replica el cambio aquí
// también, ya que son dos repos/Hostings separados y no comparten
// archivos. Obtenidas de Google Maps en septiembre 2026.
//
// NOTA: "Parque del Recuerdo Rancagua" y "Parque Sendero Rancagua"
// arrojaron la misma dirección en la búsqueda (Av. Libertador Bernardo
// O'Higgins 71, Rancagua) — parecen ser el mismo predio bajo dos nombres
// comerciales. Si en la práctica son ubicaciones distintas, corregir una
// de las dos coordenadas abajo.

export const CEMENTERIOS_COORDS = {
  "Parque del Recuerdo Américo Vespucio": { lat: -33.3838805, lng: -70.6345455 },
  "Cementerio General de Santiago": { lat: -33.4176636, lng: -70.6500999 },
  "Cementerio Católico de Recoleta": { lat: -33.4134151, lng: -70.6422611 },
  "Cementerio Parque del Santiago": { lat: -33.3908378, lng: -70.6106419 },
  "Parque Canaán": { lat: -33.4428260, lng: -70.8013175 },
  "Cementerio Metropolitano": { lat: -33.5304473, lng: -70.6832700 },
  "Parque del Recuerdo Cordillera": { lat: -33.5549429, lng: -70.5441600 },
  "Parque del Prado": { lat: -33.5548133, lng: -70.5598832 },
  "Parque Sendero San Bernardo": { lat: -33.6095850, lng: -70.7187710 },
  "Parque Sendero Maipú": { lat: -33.4654272, lng: -70.7671207 },
  "Parque El Manantial": { lat: -33.4728208, lng: -70.7607300 },
  "Cementerio Católico de Maipú": { lat: -33.5078387, lng: -70.7698562 },
  "Parque del Recuerdo Padre Hurtado": { lat: -33.6094158, lng: -70.8356870 },
  "Parque del Recuerdo Rancagua": { lat: -34.1604909, lng: -70.7563741 },
  "Parque Sendero Rancagua": { lat: -34.1604909, lng: -70.7563741 },
  "Cementerio Municipal N° 1 de Rancagua": { lat: -34.1646880, lng: -70.7472616 },
  "Cementerio Municipal N° 2 (Baquedano)": { lat: -34.1655658, lng: -70.7670607 },
  "Parque Jardín Rancagua": { lat: -34.1623360, lng: -70.7975146 },
  "Parque Jardín Las Flores": { lat: -34.1797461, lng: -70.6908177 },
};
