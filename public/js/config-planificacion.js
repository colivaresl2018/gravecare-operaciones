/**
 * config-planificacion.js — lógica pura de la pantalla «Rutas y feriados» (sin Firestore ni DOM).
 *
 * - `rutas/{idCementerio}`: `cementerio`, `eje`, `diaSemana` (1 = lunes … 5 = viernes). Solo las escribe el dueño (reglas).
 * - `feriados/{AAAA-MM-DD}`: `nombre`, `alcance` («nacional» | «regional»). Solo los escribe un administrador (reglas).
 * - «Quitar» no borra: marca `activo: false` (campo aditivo). Los lectores ignoran solo `activo === false`.
 * - Nada de datos escritos aquí: ni ejes, ni días por cementerio, ni feriados. Los carga el dueño o el administrador.
 * - Los permisos de acá solo deciden qué botones se muestran; la barrera real son las reglas de Firestore.
 */
import { DIAS_SEMANA, esFechaIso } from './fechas-semana.js';
import { normalizarNombre } from './rutas-planificacion.js?v=cfg1';
import { obtenerCementerio } from './planificacion-servicios.js';
import { CATALOGO_CEMENTERIOS } from './ubicacion-trabajo.js?v=cfg4'; // con versión: el navegador no reutiliza la copia del catálogo anterior

export const ALCANCES = ['nacional', 'regional'];
const MAX_CEMENTERIO = 120;
const MAX_EJE = 40;
const MAX_NOMBRE_FERIADO = 80;

const texto = (v) => String(v ?? '').trim();

/** Id de documento para un cementerio nuevo: su nombre sin tildes ni símbolos, con guiones. */
export function idDeCementerio(nombre) {
  return normalizarNombre(nombre).replace(/ /g, '-');
}

/**
 * Devuelve la posición del grupo (de `gruposDeCatalogo`) al que pertenece uno de los nombres dados, o -1.
 * Así un alias del mismo cementerio cae en el mismo grupo.
 */
function buscadorDeGrupos(grupos) {
  const indice = new Map();
  (Array.isArray(grupos) ? grupos : []).forEach((g, i) => {
    for (const clave of g.claves) if (!indice.has(clave)) indice.set(clave, i);
  });
  return (...nombres) => {
    for (const n of nombres) {
      const clave = normalizarNombre(n);
      if (clave && indice.has(clave)) return indice.get(clave);
    }
    return -1;
  };
}

/**
 * Si el cementerio ya tiene documento (por nombre, por id o por un alias del mismo cementerio en `grupos`) se reutiliza
 * ese id. Si no, nace uno nuevo: con el id del nombre oficial si está en el catálogo, para que no haya dos documentos.
 */
export function idDeRuta(cementerio, existentes, grupos = []) {
  const clave = normalizarNombre(cementerio);
  if (!clave) return '';
  const grupoDe = buscadorDeGrupos(grupos);
  const grupo = grupoDe(cementerio);
  for (const item of Array.isArray(existentes) ? existentes : []) {
    if (!item || !item.id) continue;
    const d = item.data && typeof item.data === 'object' ? item.data : {};
    if (normalizarNombre(d.cementerio) === clave || normalizarNombre(item.id) === clave) return String(item.id);
    if (grupo >= 0 && grupoDe(d.cementerio, item.id) === grupo) return String(item.id);
  }
  return grupo >= 0 ? idDeCementerio(grupos[grupo].nombre) : idDeCementerio(cementerio);
}

function diaValido(valor) {
  const n = typeof valor === 'number' ? valor : /^\d+$/.test(texto(valor)) ? Number(valor) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}

/** @returns {{ok: true, datos: {cementerio: string, eje: string, diaSemana: number}} | {ok: false, errores: string[]}} */
export function validarRuta(entrada) {
  const e = entrada && typeof entrada === 'object' ? entrada : {};
  const cementerio = texto(e.cementerio);
  const eje = texto(e.eje);
  const diaSemana = diaValido(e.diaSemana);
  const errores = [];
  if (!cementerio) errores.push('Falta el nombre del cementerio.');
  else if (cementerio.length > MAX_CEMENTERIO) errores.push(`El nombre del cementerio es demasiado largo (máximo ${MAX_CEMENTERIO} letras).`);
  if (!eje) errores.push('Falta el eje.');
  else if (eje.length > MAX_EJE) errores.push(`El nombre del eje es demasiado largo (máximo ${MAX_EJE} letras).`);
  if (diaSemana === null) errores.push('El día de ruta debe ser de lunes a viernes.');
  return errores.length ? { ok: false, errores } : { ok: true, datos: { cementerio, eje, diaSemana } };
}

/**
 * Prepara la carga de varios cementerios con el mismo eje y día. No repite cementerios (sin tildes ni mayúsculas, ni
 * alias del mismo cementerio) y reutiliza el id del documento que ya exista. Si el documento ya existe, conserva el
 * nombre con el que se guardó (las matrices lo buscan por ese nombre).
 * @returns {{items: Array<{id: string, datos: object}>, errores: string[]}}
 */
export function prepararLoteRutas({ cementerios, eje, diaSemana, existentes, grupos = [] } = {}) {
  const vistos = new Set();
  const nombres = [];
  for (const c of Array.isArray(cementerios) ? cementerios : []) {
    const nombre = texto(c);
    const clave = normalizarNombre(nombre);
    if (!clave || vistos.has(clave)) continue;
    vistos.add(clave);
    nombres.push(nombre);
  }
  if (nombres.length === 0) return { items: [], errores: ['Marca al menos un cementerio.'] };

  const items = [];
  const ids = new Set();
  const errores = [];
  const lista = Array.isArray(existentes) ? existentes : [];
  for (const nombre of nombres) {
    const r = validarRuta({ cementerio: nombre, eje, diaSemana });
    if (!r.ok) {
      for (const m of r.errores) if (!errores.includes(m)) errores.push(m);
      continue;
    }
    const id = idDeRuta(nombre, existentes, grupos);
    if (ids.has(id)) continue; // dos nombres (p. ej. un alias y el oficial) del mismo cementerio: uno solo
    ids.add(id);
    const previo = lista.find((item) => item && String(item.id) === id);
    const cementerio = previo && previo.data && texto(previo.data.cementerio) ? texto(previo.data.cementerio) : r.datos.cementerio;
    items.push({ id, datos: { ...r.datos, cementerio } });
  }
  return errores.length ? { items: [], errores } : { items, errores: [] };
}

/** @returns {{ok: true, datos: {fecha: string, nombre: string, alcance: string}} | {ok: false, errores: string[]}} */
export function validarFeriado(entrada) {
  const e = entrada && typeof entrada === 'object' ? entrada : {};
  const fecha = texto(e.fecha);
  const nombre = texto(e.nombre);
  const alcance = normalizarNombre(e.alcance) || 'nacional';
  const errores = [];
  if (!esFechaIso(fecha)) errores.push('La fecha no es válida (usa AAAA-MM-DD, por ejemplo 2026-12-25).');
  if (!nombre) errores.push('Falta el nombre del feriado.');
  else if (nombre.length > MAX_NOMBRE_FERIADO) errores.push(`El nombre del feriado es demasiado largo (máximo ${MAX_NOMBRE_FERIADO} letras).`);
  if (!ALCANCES.includes(alcance)) errores.push('El alcance debe ser «nacional» o «regional».');
  return errores.length ? { ok: false, errores } : { ok: true, datos: { fecha, nombre, alcance } };
}

/** `dd/mm/aaaa` o `dd-mm-aaaa` → `AAAA-MM-DD`; lo demás se devuelve igual. */
function fechaAIso(bruta) {
  const m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(bruta);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : bruta;
}

/**
 * Lee una lista pegada: una línea por feriado, «fecha | nombre | alcance» (alcance opcional; también vale «;» o tabulación).
 * Las líneas vacías o que empiezan con # se saltan. Las líneas con problemas se informan con su número y no impiden leer las buenas.
 * @returns {{filas: Array<{linea: number, fecha: string, nombre: string, alcance: string}>, errores: Array<{linea: number, motivo: string}>}}
 */
export function parsearFeriados(entrada) {
  const filas = [];
  const errores = [];
  const fechas = new Set();
  const lineas = String(entrada ?? '').split(/\r?\n/);
  lineas.forEach((crudo, i) => {
    const linea = i + 1;
    const limpia = crudo.trim();
    if (!limpia || limpia.startsWith('#')) return;
    const partes = limpia.split(/\s*[|;\t]\s*/);
    if (partes.length < 2) {
      errores.push({ linea, motivo: 'Falta el separador: escribe «fecha | nombre | alcance».' });
      return;
    }
    const r = validarFeriado({ fecha: fechaAIso(partes[0].trim()), nombre: partes[1], alcance: partes[2] });
    if (!r.ok) {
      errores.push({ linea, motivo: r.errores[0] });
      return;
    }
    if (fechas.has(r.datos.fecha)) {
      errores.push({ linea, motivo: `La fecha ${r.datos.fecha} está repetida en la lista.` });
      return;
    }
    fechas.add(r.datos.fecha);
    filas.push({ linea, ...r.datos });
  });
  return { filas, errores };
}

/** Qué botones se muestran. Rutas: solo el dueño (dueno === true, estricto como la regla). Feriados: administrador o admin. */
export function permisosDeStaff(perfil) {
  const p = perfil && typeof perfil === 'object' ? perfil : {};
  const rol = texto(p.rol).toLowerCase();
  return { editaRutas: p.dueno === true, editaFeriados: rol === 'administrador' || rol === 'admin' };
}

/** Un documento anterior (sin el campo) está activo; solo `activo === false` lo deja fuera. */
export function estaActivo(datos) {
  return !(datos && typeof datos === 'object' && datos.activo === false);
}

/** Nombres distintos de cementerio que hay en las órdenes (ubicación de la sepultura o cementerio), ordenados. */
export function cementeriosDeOrdenes(ordenes) {
  const porClave = new Map();
  for (const item of Array.isArray(ordenes) ? ordenes : []) {
    if (!item || !item.data || typeof item.data !== 'object') continue;
    const nombre = texto(obtenerCementerio(item.data));
    const clave = normalizarNombre(nombre);
    if (!clave || nombre === '—' || porClave.has(clave)) continue;
    porClave.set(clave, nombre);
  }
  return [...porClave.values()].sort((a, b) => a.localeCompare(b, 'es'));
}

/**
 * Los 17 cementerios vigentes con el nombre oficial, confirmado por el dueño. Es el primer nombre de cada entrada de
 * CATALOGO_CEMENTERIOS (ubicacion-trabajo.js); la prueba lo verifica.
 */
export const CEMENTERIOS_OFICIALES = [
  'Parque del Recuerdo de Huechuraba',
  'Cementerio General de Recoleta',
  'Cementerio Católico de Recoleta',
  'Parque Canaán de Pudahuel',
  'Cementerio Metropolitano de Lo Espejo',
  'Parque del Recuerdo Cordillera de Puente Alto',
  'Cementerio El Prado de Puente Alto',
  'Parque Sendero de San Bernardo',
  'Parque Sendero de Maipú',
  'Parque El Manantial de Maipú',
  'Cementerio Católico de Maipú',
  'Parque del Recuerdo de Padre Hurtado-Peñaflor',
  'Cementerio Municipal N° 1 de Rancagua',
  'Cementerio Municipal N° 2 de Rancagua',
  'Parque Jardín de Rancagua',
  'Parque Jardín Las Flores de Machalí',
  'Parque Sendero de Rancagua',
];

/**
 * Un grupo por cementerio oficial: {nombre, claves} con las claves normalizadas de todos sus nombres y alias del catálogo.
 * Si un oficial no estuviera en el catálogo, su grupo queda solo con su nombre: nunca se pierde su fila.
 */
export function gruposDeCatalogo(catalogo = CATALOGO_CEMENTERIOS, oficiales = CEMENTERIOS_OFICIALES) {
  const lista = Array.isArray(catalogo) ? catalogo : [];
  return oficiales.map((oficial) => {
    const clave = normalizarNombre(oficial);
    const entrada = lista.find((c) => (Array.isArray(c.nombres) ? c.nombres : []).some((n) => normalizarNombre(n) === clave));
    const nombres = entrada ? entrada.nombres : [];
    return { nombre: oficial, claves: new Set([clave, ...nombres.map(normalizarNombre)]) };
  });
}

/**
 * Filas de la tabla de rutas: los cementerios del catálogo oficial (`grupos`), los de las órdenes y los que ya tienen
 * documento en `rutas`. Un nombre o alias del mismo cementerio cuenta una sola vez.
 * - `nombre`: el que se guarda y se usa para asignar (el de la ruta si ya existe; así no se duplica el documento).
 * - `etiqueta`: el que se muestra (el oficial si el cementerio está en el catálogo).
 * estado: 'activa' | 'inactiva' (quitada) | 'sin-ruta'. Nunca se inventa un eje.
 */
export function filasDeRutas(docsRutas, nombresCementerios, grupos = []) {
  const lista = Array.isArray(docsRutas) ? docsRutas : [];
  const grupoLista = Array.isArray(grupos) ? grupos : [];
  const grupoDe = buscadorDeGrupos(grupoLista);
  const filas = new Map();

  for (const item of lista) {
    if (!item || !item.id) continue;
    const d = item.data && typeof item.data === 'object' ? item.data : {};
    const nombre = texto(d.cementerio) || String(item.id);
    const g = grupoDe(d.cementerio, item.id);
    const clave = g >= 0 ? `grupo:${g}` : normalizarNombre(d.cementerio) || normalizarNombre(item.id);
    if (!clave || filas.has(clave)) continue;
    const diaSemana = diaValido(d.diaSemana);
    filas.set(clave, {
      nombre, etiqueta: g >= 0 ? grupoLista[g].nombre : nombre, id: String(item.id), eje: texto(d.eje), diaSemana,
      dia: diaSemana ? DIAS_SEMANA[diaSemana - 1] : '', estado: estaActivo(d) ? 'activa' : 'inactiva',
    });
  }
  for (const n of Array.isArray(nombresCementerios) ? nombresCementerios : []) {
    const nombre = texto(n);
    const g = grupoDe(nombre);
    const clave = g >= 0 ? `grupo:${g}` : normalizarNombre(nombre);
    if (!clave || filas.has(clave)) continue;
    const etiqueta = g >= 0 ? grupoLista[g].nombre : nombre;
    filas.set(clave, { nombre: etiqueta, etiqueta, id: '', eje: '', diaSemana: null, dia: '', estado: 'sin-ruta' });
  }
  grupoLista.forEach((g, i) => {
    if (filas.has(`grupo:${i}`)) return;
    filas.set(`grupo:${i}`, { nombre: g.nombre, etiqueta: g.nombre, id: '', eje: '', diaSemana: null, dia: '', estado: 'sin-ruta' });
  });
  return [...filas.values()].sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es'));
}

export function resumenDeRutas(filas) {
  const lista = Array.isArray(filas) ? filas : [];
  const cuenta = (estado) => lista.filter((f) => f.estado === estado).length;
  return { total: lista.length, activas: cuenta('activa'), inactivas: cuenta('inactiva'), sinRuta: cuenta('sin-ruta') };
}
