/**
 * planificacion-edicion.js — lógica pura para cambiar la fecha y asignar el operador de UNA visita desde
 * «Planificación Planes y Spot» (spec 085 / directriz B7). Sin Firebase ni DOM: se prueba con `node --test`.
 *
 * - Quién edita (D1): solo el dueño (`dueno === true`, estricto como las reglas) y el administrador (`rol` administrador o admin).
 *   Es comodidad de la pantalla; la barrera real son las reglas de Firestore (hoy `ordenes` lo permite a todo el personal con claim).
 * - Visitas cerradas (D4): una visita realizada (en revisión) o aprobada (completada) no se edita.
 * - Fecha (R5, D3): fin de semana, feriado y fuera del día de ruta AVISAN y se puede continuar; anterior al pago NO se permite.
 * - Lo que se escribe lo arma planificacion-edicion-db.js; aquí también está el cambio local para refrescar la lista sin recargar.
 */
import { esFechaIso, diaSemanaIso, DIAS_SEMANA } from './fechas-semana.js';
import { normalizarFechaSinDesfase } from './planificacion-servicios.js?v=b5';
import { fechaDelIngreso } from './orden-pagada.js';

/** Texto que ya usa el backoffice para una visita sin operador (el mismo valor que se guarda). */
export const SIN_ASIGNAR = 'Sin asignar';
/** Estados en que la visita ya está hecha: no se reprograma ni se reasigna. */
export const ESTADOS_CERRADOS = Object.freeze(['completada', 'en revision']);
export const MAX_OPERADOR = 120;

const texto = (v) => String(v ?? '').trim();

/** Dueño (`dueno === true`) o administrador (`rol` administrador o admin). El supervisor y el operador no. */
export function puedeEditarPlanificacion(perfil) {
  const p = perfil && typeof perfil === 'object' ? perfil : {};
  const rol = typeof p.rol === 'string' ? p.rol.trim().toLowerCase() : '';
  return p.dueno === true || rol === 'administrador' || rol === 'admin';
}

/** ¿Se pueden mostrar los controles de esta fila? No si la visita ya se realizó o se aprobó. */
export function visitaEditable(fila) {
  if (!fila || typeof fila !== 'object') return false;
  if (fila.terminada === true) return false;
  return !ESTADOS_CERRADOS.includes(String(fila.estadoClave || '').toLowerCase());
}

/**
 * Valores del selector de operador: «Sin asignar» y el personal activo (nombre o, si no tiene, correo), sin repetir.
 * El operador actual se agrega si ya no está en el personal, para no perderlo al abrir el selector.
 * @param {Array<{id: string, data: object}> | null} docsStaff
 */
export function opcionesOperador(docsStaff, { actual = '' } = {}) {
  const nombres = new Set();
  for (const item of Array.isArray(docsStaff) ? docsStaff : []) {
    const d = item && item.data && typeof item.data === 'object' ? item.data : {};
    if (d.activo === false) continue;
    const nombre = texto(d.nombre) || texto(d.email);
    if (nombre && nombre !== SIN_ASIGNAR) nombres.add(nombre);
  }
  const act = texto(actual);
  if (act && act !== SIN_ASIGNAR) nombres.add(act);
  return [SIN_ASIGNAR, ...[...nombres].sort((a, b) => a.localeCompare(b, 'es'))];
}

/** El operador debe ser uno de la lista (o «Sin asignar»), no más largo de lo razonable y distinto del actual. */
export function validarCambioOperador({ operador, actual, opciones } = {}) {
  const valor = texto(operador);
  const errores = [];
  if (!valor) errores.push('Elige un operador.');
  else if (valor.length > MAX_OPERADOR) errores.push('El nombre del operador es demasiado largo.');
  else if (!Array.isArray(opciones) || !opciones.includes(valor)) errores.push('Elige un operador de la lista.');
  else if (valor === texto(actual) || (valor === SIN_ASIGNAR && !texto(actual))) errores.push('La visita ya tiene ese operador.');
  return { ok: errores.length === 0, errores, valor };
}

/** Fecha de pago (AAAA-MM-DD) de la orden: fechaPago o, si falta, la de creación; null si no hay (entonces no se compara). */
export function fechaPagoDeOrden(orden) {
  if (!orden || typeof orden !== 'object') return null;
  const f = normalizarFechaSinDesfase(fechaDelIngreso(orden));
  return f ? f.iso : null;
}

const display = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/**
 * Valida la fecha nueva de una visita. `errores` bloquean; `avisos` solo informan (se puede continuar).
 * @param {{fechaIso: string, actualIso?: string|null, esTentativa?: boolean, pagoIso?: string|null,
 *          feriados?: {nombre: (iso: string) => string|null}|null, diaRuta?: number|null}} p
 */
export function validarCambioFecha({ fechaIso, actualIso = null, esTentativa = false, pagoIso = null, feriados = null, diaRuta = null } = {}) {
  const errores = [];
  const avisos = [];
  if (typeof fechaIso !== 'string' || !esFechaIso(fechaIso)) {
    return { ok: false, errores: ['Elige una fecha válida.'], avisos };
  }
  if (pagoIso && esFechaIso(pagoIso) && fechaIso < pagoIso) {
    errores.push(`La fecha no puede ser anterior a la fecha del pago (${display(pagoIso)}).`);
  } else if (fechaIso === actualIso && !esTentativa) {
    errores.push('Es la misma fecha que ya tiene la visita.');
  }
  if (errores.length === 0) {
    const dia = diaSemanaIso(fechaIso); // 1 = lunes … 7 = domingo
    if (dia === 6 || dia === 7) avisos.push(`La fecha cae en ${dia === 6 ? 'sábado' : 'domingo'}.`);
    const feriado = feriados && typeof feriados.nombre === 'function' ? feriados.nombre(fechaIso) : null;
    if (feriado) avisos.push(`La fecha es feriado: ${feriado}.`);
    if (Number.isInteger(diaRuta) && diaRuta >= 1 && diaRuta <= 5 && dia !== diaRuta) {
      avisos.push(`El día de ruta de este cementerio es el ${DIAS_SEMANA[diaRuta - 1].toLowerCase()} y esta fecha cae en ${DIAS_SEMANA[dia - 1].toLowerCase()}.`);
    }
  }
  return { ok: errores.length === 0, errores, avisos };
}

/** «30/11/2026 → 02/12/2026» (sin fecha anterior: «Sin fecha → …»). */
export function confirmacionFecha(anteriorDisplay, nuevaIso) {
  return `${anteriorDisplay || 'Sin fecha'} → ${display(nuevaIso)}`;
}

/** «Sin asignar → Nombre». */
export function confirmacionOperador(anterior, nuevo) {
  return `${texto(anterior) || SIN_ASIGNAR} → ${texto(nuevo)}`;
}

const CLAVE_MAPA = /^(fechasPorVisita|operadoresPorVisita)\.(V\d{1,3})$/;

/**
 * Copia de la orden con el cambio aplicado (para refrescar la lista sin recargar). Solo admite las claves que escribe esta
 * pantalla: `fechasPorVisita.V<n>`, `operadoresPorVisita.V<n>`, `fechaProgramada` y `proximaVisita`. No muta la original y
 * deja idéntico todo lo demás (CA3).
 */
export function aplicarCambioEnOrden(orden, cambios) {
  const base = orden && typeof orden === 'object' ? orden : {};
  const copia = { ...base };
  for (const [clave, valor] of Object.entries(cambios || {})) {
    const m = CLAVE_MAPA.exec(clave);
    if (m) {
      const [, mapa, visita] = m;
      const actual = copia[mapa] && typeof copia[mapa] === 'object' ? copia[mapa] : {};
      copia[mapa] = { ...actual, [visita]: valor };
    } else if (clave === 'fechaProgramada' || clave === 'proximaVisita') {
      copia[clave] = valor;
    } else {
      throw new Error(`No se puede aplicar el campo «${clave}» a la visita.`);
    }
  }
  return copia;
}
