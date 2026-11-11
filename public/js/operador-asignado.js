/**
 * operador-asignado.js — «¿esta visita es mía?» y «¿esta visita ya está cerrada?» para Mis Trabajos.
 *
 * Por qué existe: todas las páginas que asignan operador (ordenes, planificacion, todos-los-trabajos) guardan en
 * `operadoresPorVisita.V{n}` el NOMBRE del staff (`staff.nombre`, o su correo si no tiene nombre), pero Mis Trabajos
 * comparaba contra un nombre fijo («Christian Olivares») con `includes`. «Christian Gerardo Olivares Lizama» no
 * contiene «christian olivares», y la visita quedaba fuera. Aquí se compara por uid, correo o nombre normalizado,
 * sin importar en qué estructura se guardó la asignación.
 *
 * Solo LEE campos existentes (contrato de datos con la web). Sin Firebase ni DOM: se prueba con node --test.
 */
import { esOperadorValido, numerosTerminados, esEstadoCompletada } from './servicio-terminado.js';

/** El administrador entra con cualquiera de estos correos y es la misma persona. */
export const ALIAS_ADMIN = Object.freeze({
  emails: Object.freeze(['colivaresl@hotmail.com', 'admin@gravecare.cl']),
  nombres: Object.freeze(['Christian Olivares', 'Christian Gerardo Olivares Lizama']),
});

/** Minúsculas, sin tildes, sin signos y con espacios simples. */
export function normalizarTexto(s) {
  return String(s == null ? '' : s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9@._\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function palabras(s) {
  return normalizarTexto(s).replace(/[@._-]/g, ' ').split(' ').filter(Boolean);
}

/**
 * ¿Son el mismo nombre? Todas las palabras del nombre más corto deben estar en el más largo (así «Christian Olivares»
 * coincide con «Christian Gerardo Olivares Lizama»). Un nombre de una sola palabra solo coincide con otro igual.
 */
export function nombresCoinciden(a, b) {
  const pa = palabras(a);
  const pb = palabras(b);
  if (pa.length === 0 || pb.length === 0) return false;
  const [corto, largo] = pa.length <= pb.length ? [pa, pb] : [pb, pa];
  if (corto.length === 1) return largo.length === 1 && corto[0] === largo[0];
  const setLargo = new Set(largo);
  return corto.every((p) => setLargo.has(p));
}

/**
 * Identidad del usuario conectado: uid, correos y nombres con los que puede aparecer en una asignación.
 * @param {{uid?:string, email?:string, displayName?:string, staffNombre?:string, staffEmail?:string}} u
 */
export function crearIdentidad(u = {}) {
  const emails = new Set();
  const nombres = [];
  const agregarEmail = (e) => { const n = normalizarTexto(e); if (n.includes('@')) emails.add(n); };
  const agregarNombre = (n) => { if (palabras(n).length > 0 && !nombres.some((x) => normalizarTexto(x) === normalizarTexto(n))) nombres.push(String(n).trim()); };
  agregarEmail(u.email);
  agregarEmail(u.staffEmail);
  agregarNombre(u.displayName);
  agregarNombre(u.staffNombre);
  if (emails.size && ALIAS_ADMIN.emails.some((e) => emails.has(e))) {
    ALIAS_ADMIN.emails.forEach(agregarEmail);
    ALIAS_ADMIN.nombres.forEach(agregarNombre);
  }
  return { uid: u.uid ? String(u.uid) : '', emails, nombres };
}

const CAMPOS_ID = ['operadorId', 'operadorUid', 'operadorAsignadoId', 'operadorAsignadoUid'];
const CAMPOS_EMAIL = ['operadorEmail', 'operadorAsignadoEmail'];
const CAMPOS_NOMBRE = ['operadorAsignadoNombre', 'operadorNombre', 'operadorAsignado', 'operador'];

/** Candidato normalizado {uid, email, texto} a partir de un texto u objeto guardado. Null si está vacío o «Sin asignar». */
function aCandidato(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'object') {
    const uid = v.uid || v.operadorId || v.operadorUid || v.id || '';
    const email = v.email || v.operadorEmail || '';
    const texto = v.nombre || v.nombreCompleto || v.operadorNombre || v.operadorAsignadoNombre || v.operador || '';
    const c = { uid: String(uid || ''), email: normalizarTexto(email), texto: esOperadorValido(texto) ? String(texto) : '' };
    return c.uid || c.email || c.texto ? c : null;
  }
  if (!esOperadorValido(v)) return null;
  const t = String(v).trim();
  return { uid: '', email: normalizarTexto(t).includes('@') ? normalizarTexto(t) : '', texto: t };
}

/** Candidatos de los campos `operador*` de un objeto (orden, visita o programación). */
function camposOperador(o, destino) {
  if (!o || typeof o !== 'object') return;
  for (const c of CAMPOS_ID) if (o[c]) destino.push({ uid: String(o[c]), email: '', texto: '' });
  for (const c of CAMPOS_EMAIL) { const k = aCandidato(o[c]); if (k) destino.push(k); }
  for (const c of CAMPOS_NOMBRE) { const k = aCandidato(o[c]); if (k) destino.push(k); }
}

/** Entrada de la visita n en un mapa/arreglo de asignaciones (claves V1, v_1, 1, o posición en arreglo). */
function entradaDeVisita(coleccion, n) {
  if (!coleccion) return [];
  if (Array.isArray(coleccion)) {
    const porNumero = coleccion.filter((e) => e && typeof e === 'object' && Number(e.visita ?? e.visitaNumero ?? e.numero) === n);
    return porNumero.length ? porNumero : [coleccion[n - 1]];
  }
  if (typeof coleccion === 'object') return [coleccion[`V${n}`], coleccion[`v_${n}`], coleccion[n]];
  return [];
}

/** Asignaciones PROPIAS de la visita n (en cualquiera de las estructuras conocidas). */
function candidatosDeVisita(orden, n) {
  const o = orden || {};
  const lista = [];
  const agregarValor = (v) => { const k = aCandidato(v); if (k) lista.push(k); };
  entradaDeVisita(o.operadoresPorVisita, n).forEach(agregarValor);
  for (const col of [o.asignacionesVisitas, o.visitasEstado]) {
    for (const e of entradaDeVisita(col, n)) {
      if (e && typeof e === 'object') { camposOperador(e, lista); agregarValor(e); }
    }
  }
  camposOperador(Array.isArray(o.visitas) ? o.visitas[n - 1] : null, lista);
  camposOperador(o.programacionVisitas && o.programacionVisitas[`v_${n}`], lista);
  return lista;
}

/** Asignación de la orden completa (vale para las visitas que no tienen una propia). */
function candidatosDeOrden(orden) {
  const lista = [];
  camposOperador(orden, lista);
  return lista;
}

function coincide(c, id) {
  if (c.uid && id.uid && c.uid === id.uid) return true;
  if (c.email && id.emails.has(c.email)) return true;
  if (c.texto) {
    const t = normalizarTexto(c.texto);
    if (id.emails.has(t)) return true;
    for (const e of id.emails) if (t.includes(e)) return true; // «Nombre <correo>»
    if (id.nombres.some((n) => nombresCoinciden(n, c.texto))) return true;
  }
  return false;
}

/**
 * ¿La visita n de la orden está asignada al usuario? Si la visita tiene asignación propia, manda esa; si no, vale la
 * de la orden. Coincide por uid, correo o nombre normalizado.
 */
export function visitaAsignadaA(orden, n, identidad) {
  const id = identidad || crearIdentidad();
  const propias = candidatosDeVisita(orden, n);
  const candidatos = propias.length ? propias : candidatosDeOrden(orden);
  return candidatos.some((c) => coincide(c, id));
}

/**
 * ¿Se oculta la visita n de Mis Trabajos porque ya está terminada? Usa la regla única de servicio-terminado.js
 * (operador + evidencia real + estado propio). El estado de la orden y el contador sin evidencia no ocultan nada.
 * Si los informes no se pudieron leer no hay forma de comprobar la evidencia: se oculta solo la visita con estado
 * propio de finalizada y operador válido (comportamiento anterior), para no reabrir visitas realmente hechas.
 * @param {{docId?:string, indiceInformes?:object, informesLeidos?:boolean}} ctx
 */
export function visitaCerradaParaMisTrabajos(orden, n, ctx = {}) {
  const o = orden || {};
  if (ctx.informesLeidos) return numerosTerminados(o, { docId: ctx.docId, indiceInformes: ctx.indiceInformes }).has(n);
  const propio = esEstadoCompletada((o.estadosPorVisita || {})[`V${n}`]);
  return propio && (candidatosDeVisita(o, n).length > 0 || candidatosDeOrden(o).length > 0);
}
