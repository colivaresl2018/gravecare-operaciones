// Ubicación de las visitas en el mapa de «Mis Trabajos». Ejecutar: node --test public/js/ubicacion-trabajo.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizarNombre, leerCoordenada, coordenadasDeOrden, coordenadasCementerio, ubicacionDeVisita,
  agruparMarcadores, resumenMapa, contenidoMarcador, tituloMarcador, agruparPorOrden, escaparHtml,
} from './ubicacion-trabajo.js';

test('normalizarNombre: minúsculas, sin tildes ni puntuación', () => {
  assert.equal(normalizarNombre('  Cementerio  Católico de Maipú '), 'cementerio catolico de maipu');
  assert.equal(normalizarNombre('Cementerio Municipal N° 2 (Baquedano)'), 'cementerio municipal n 2 baquedano');
  assert.equal(normalizarNombre(null), '');
});

test('leerCoordenada acepta lat/lng, latitude/longitude, GeoPoint y textos; descarta lo inválido', () => {
  assert.deepEqual(leerCoordenada({ lat: -33.5, lng: -70.5 }), { lat: -33.5, lng: -70.5 });
  assert.deepEqual(leerCoordenada({ latitude: -33.5, longitude: -70.5 }), { lat: -33.5, lng: -70.5 });
  assert.deepEqual(leerCoordenada({ _lat: -33.5, _long: -70.5 }), { lat: -33.5, lng: -70.5 });
  assert.deepEqual(leerCoordenada({ lat: '-33.5', lng: '-70,5' }), { lat: -33.5, lng: -70.5 });
  assert.deepEqual(leerCoordenada({ latitude: -33.5, longitude: -70.5, toJSON() {} }), { lat: -33.5, lng: -70.5 });
  for (const malo of [null, undefined, {}, 'x', 5, { lat: 0, lng: 0 }, { lat: 95, lng: 10 }, { lat: -33, lng: 200 }, { lat: NaN, lng: 1 }, { lat: '', lng: '' }]) {
    assert.equal(leerCoordenada(malo), null, JSON.stringify(malo));
  }
});

test('coordenadasDeOrden: sepultura primero, luego orden; cualquiera de sus formas', () => {
  const sep = { latitude: -33.1, longitude: -70.1 };
  assert.deepEqual(coordenadasDeOrden({ ubicacionSepultura: { coordenadas: sep }, coordenadas: { lat: -1, lng: -2 } }), { lat: -33.1, lng: -70.1 });
  assert.deepEqual(coordenadasDeOrden({ coordenadas: { lat: -33.2, lng: -70.2 } }), { lat: -33.2, lng: -70.2 });
  assert.deepEqual(coordenadasDeOrden({ coordenadasGps: { lat: -33.3, lng: -70.3 } }), { lat: -33.3, lng: -70.3 });
  assert.deepEqual(coordenadasDeOrden({ ubicacionSepultura: { lat: -33.4, lng: -70.4 } }), { lat: -33.4, lng: -70.4 });
  assert.deepEqual(coordenadasDeOrden({ lat: -33.5, lng: -70.5 }), { lat: -33.5, lng: -70.5 });
  assert.equal(coordenadasDeOrden({ ubicacionSepultura: { coordenadas: {} } }), null);
  assert.equal(coordenadasDeOrden(null), null);
});

test('coordenadasCementerio: el caso de producción «Cementerio El Prado de Puente Alto» tiene ubicación', () => {
  const c = coordenadasCementerio('Cementerio El Prado de Puente Alto');
  assert.ok(c, 'debe encontrar El Prado');
  assert.ok(Math.abs(c.lat - -33.5548) < 0.001 && Math.abs(c.lng - -70.5599) < 0.001);
});

test('coordenadasCementerio: alias históricos, mayúsculas y tildes', () => {
  const prado = coordenadasCementerio('Cementerio El Prado de Puente Alto');
  for (const n of ['Parque del Prado', 'PARQUE EL PRADO', 'parque del prado de puente alto', 'Cementerio El Prado']) assert.deepEqual(coordenadasCementerio(n), prado, n);
  assert.deepEqual(coordenadasCementerio('Cementerio Catolico de Maipu'), coordenadasCementerio('Cementerio Católico de Maipú'));
  assert.ok(coordenadasCementerio('Cementerio General de Recoleta'));
  assert.ok(coordenadasCementerio('Cementerio General'));
  assert.ok(coordenadasCementerio('Parque del Recuerdo Américo Vespucio'));
  assert.ok(coordenadasCementerio('Parque del Recuerdo de Padre Hurtado'));
  assert.ok(coordenadasCementerio('Parque del Recuerdo Cordillera de Puente Alto'));
});

test('coordenadasCementerio: no confunde cementerios parecidos (gana el nombre más específico)', () => {
  const maipu = coordenadasCementerio('Parque Sendero de Maipú');
  const sanBernardo = coordenadasCementerio('Parque Sendero de San Bernardo');
  const rancagua = coordenadasCementerio('Parque Sendero de Rancagua');
  assert.notDeepEqual(maipu, sanBernardo);
  assert.notDeepEqual(maipu, rancagua);
  assert.notDeepEqual(coordenadasCementerio('Parque Jardín Las Flores de Machalí'), coordenadasCementerio('Parque Jardín de Rancagua'));
  assert.notDeepEqual(coordenadasCementerio('Cementerio Municipal N° 1 de Rancagua'), coordenadasCementerio('Cementerio Municipal N° 2 de Rancagua'));
});

test('coordenadasCementerio: nombres genéricos o desconocidos no inventan ubicación', () => {
  for (const n of ['', 'Cementerio', null, undefined, 'Parque Sendero', 'Parque del Recuerdo', 'Cementerio Inventado de Marte']) assert.equal(coordenadasCementerio(n), null, String(n));
});

test('ubicacionDeVisita: sepultura exacta > cementerio aproximado > sin ubicación', () => {
  const exacta = ubicacionDeVisita({ ubicacionSepultura: { cementerio: 'Parque del Prado', coordenadas: { lat: -33.55, lng: -70.56 } } }, 'Parque del Prado');
  assert.deepEqual(exacta, { lat: -33.55, lng: -70.56, origen: 'sepultura', aproximada: false });
  const aprox = ubicacionDeVisita({}, 'Cementerio El Prado de Puente Alto');
  assert.equal(aprox.origen, 'cementerio');
  assert.equal(aprox.aproximada, true);
  assert.equal(ubicacionDeVisita({}, 'Cementerio'), null);
});

const visita = (id, dif, cem, ub) => ({ idVisitaCompleto: id, difunto: dif, cementerio: cem, badgeFraccion: '1/6', ubicacion: ub });
const PRADO = { lat: -33.5548133, lng: -70.5598832, origen: 'cementerio', aproximada: true };

test('agruparMarcadores: un pin por lugar, con todas las visitas; las sin ubicación quedan aparte', () => {
  const vs = [
    visita('ORD-1-V1', 'Pepito', 'Cementerio El Prado de Puente Alto', PRADO),
    visita('ORD-2-V3', 'Ana', 'Cementerio El Prado de Puente Alto', PRADO),
    visita('ORD-3-V1', 'Luis', 'Parque X', { lat: -33.4, lng: -70.6, origen: 'sepultura', aproximada: false }),
    visita('ORD-4-V1', 'Sin', 'Lugar desconocido', null),
  ];
  const { marcadores, sinUbicacion } = agruparMarcadores(vs);
  assert.equal(marcadores.length, 2);
  assert.equal(marcadores[0].visitas.length, 2);
  assert.equal(marcadores[0].aproximada, true);
  assert.equal(marcadores[1].aproximada, false);
  assert.deepEqual(sinUbicacion.map((v) => v.idVisitaCompleto), ['ORD-4-V1']);
});

test('agruparPorOrden: las visitas de una misma orden van juntas', () => {
  const r = agruparPorOrden([visita('ORD-1-V1', 'Pepito', 'C', PRADO), visita('ORD-1-V2', 'Pepito', 'C', PRADO), visita('ORD-2-V1', 'Ana', 'C', PRADO)]);
  assert.deepEqual(r.map((o) => [o.orden, o.visitas.length]), [['ORD-1', 2], ['ORD-2', 1]]);
});

test('resumenMapa: textos claros en español para cada situación', () => {
  assert.deepEqual(resumenMapa([]), { estado: 'Sin labores pendientes', aviso: '' });
  const ok = resumenMapa([visita('ORD-A-V1', 'P', 'C', PRADO)]);
  assert.equal(ok.estado, '1 ubicación en el mapa');
  assert.match(ok.aviso, /aproximada/i);
  const dos = resumenMapa([visita('ORD-A-V1', 'P', 'C', PRADO), visita('ORD-B-V1', 'Q', 'D', { ...PRADO, lat: -33.1 })]);
  assert.equal(dos.estado, '2 ubicaciones en el mapa');
  const nada = resumenMapa([visita('ORD-A-V1', 'P', 'Lugar raro', null), visita('ORD-A-V2', 'P', 'Lugar raro', null)]);
  assert.equal(nada.estado, 'Sin coordenadas registradas');
  assert.match(nada.aviso, /no tiene ubicación/i);
  assert.match(nada.aviso, /Lugar raro/);
  assert.equal((nada.aviso.match(/ORD-A/g) || []).length, 1, 'la orden se nombra una sola vez aunque tenga varias visitas');
  const mixto = resumenMapa([visita('ORD-A-V1', 'P', 'C', { ...PRADO, aproximada: false }), visita('ORD-B-V1', 'Q', 'Lugar raro', null)]);
  assert.match(mixto.aviso, /ORD-B/);
  assert.doesNotMatch(mixto.aviso, /ORD-A/);
});

test('contenidoMarcador: orden, difunto y cementerio, con HTML escapado', () => {
  const g = agruparMarcadores([visita('ORD-1794318778901977-V1', 'Pepito <b>TV</b> Solis', 'Cementerio El Prado de Puente Alto', PRADO)]).marcadores[0];
  const html = contenidoMarcador(g);
  assert.match(html, /ORD-1794318778901977/);
  assert.match(html, /Pepito &lt;b&gt;TV&lt;\/b&gt; Solis/);
  assert.match(html, /Cementerio El Prado de Puente Alto/);
  assert.match(html, /Visitas pendientes: 1\/6/);
  assert.match(html, /aproximada/i);
  assert.doesNotMatch(html, /<b>TV/);
  assert.equal(tituloMarcador(g), 'ORD-1794318778901977 · Pepito <b>TV</b> Solis · Cementerio El Prado de Puente Alto');
  assert.equal(escaparHtml(`<&"'>`), '&lt;&amp;&quot;&#39;&gt;');
});
