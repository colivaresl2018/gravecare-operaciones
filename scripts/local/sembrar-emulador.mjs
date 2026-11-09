// Datos de prueba del backoffice en los EMULADORES de la web (directriz B-1/B-2). Nunca toca un proyecto real:
// solo habla con 127.0.0.1 y con un proyecto «demo-*», con el token «owner» que solo aceptan los emuladores.
//
//   PowerShell:  $env:GC_OFFSET=800; node scripts/local/sembrar-emulador.mjs
//
// Crea un usuario staff de prueba (claim staffActivo) y órdenes ficticias que cubren los criterios de B-2:
// 5 «Confirmado» de producción, 2 «iniciada» con monto, cancelado/rechazado/vencida/monto_inconsistente,
// un Oneclick inscrito sin cobro y una orden pagada en integración (PRUEBA).
// Los datos son inventados (sin RUT ni correos reales).
import { desplazamiento, proyectoEmulador, puertos } from './puertos.mjs';

const OFF = desplazamiento();
const PROYECTO = proyectoEmulador();
const P = puertos(OFF);
const OWNER = { authorization: 'Bearer owner', 'content-type': 'application/json' };

// Credenciales de prueba SOLO para el emulador (no existen fuera de él).
export const STAFF_PRUEBA = { email: 'staff.prueba@demo-gravecare.test', password: 'emulador-solo-local-B2', nombre: 'Staff de Prueba' };

const ahora = Date.now();
const dia = 86400000;
const base = (n, extra) => ({
  numeroOrden: `GC-B2-${String(n).padStart(3, '0')}`,
  titular: { nombreCompleto: `Cliente Ficticio ${n}`, email: `cliente${n}@ejemplo.test`, rut: '11.111.111-1' },
  difunto: { nombreCompleto: `Difunto Ficticio ${n}` },
  ubicacionSepultura: { cementerio: 'Parque del Recuerdo', sector: 'A', patio: String(n), numeroSepultura: String(100 + n) },
  planNombre: 'Plan 4 visitas',
  tipoServicio: 'PLAN',
  creadoEl: new Date(ahora - (20 - n) * dia),
  ...extra,
});
const pagada = (fecha) => ({ estado: 'Confirmado', pagoConfirmado: true, modoPago: 'produccion', fechaPago: new Date(fecha) });

export const ORDENES = {
  'b2-pagada-1': base(1, { ...pagada(ahora - 5 * dia), montoTotal: 100000 }),
  'b2-pagada-2': base(2, { ...pagada(ahora - 4 * dia), montoTotal: 200000 }),
  'b2-pagada-3': base(3, { ...pagada(ahora - 3 * dia), montoTotal: 300000 }),
  'b2-pagada-4': base(4, { ...pagada(ahora - 2 * dia), montoTotal: 400000 }),
  'b2-pagada-5': base(5, { ...pagada(ahora - 1 * dia), montoTotal: 500000 }),
  'b2-iniciada-1': base(6, { estado: 'iniciada', pagoConfirmado: false, montoTotal: 259960 }),
  'b2-iniciada-2': base(7, { estado: 'iniciada', pagoConfirmado: false, montoTotal: 129990 }),
  'b2-cancelado': base(8, { estado: 'cancelado', pagoConfirmado: false, motivoSinPago: 'cancelado', montoTotal: 70000 }),
  'b2-rechazado': base(9, { estado: 'rechazado', pagoConfirmado: false, motivoSinPago: 'rechazado', montoTotal: 80000 }),
  'b2-vencida': base(10, { estado: 'vencida', pagoConfirmado: false, motivoSinPago: 'vencida', montoTotal: 90000 }),
  'b2-inconsistente': base(11, { estado: 'monto_inconsistente', pagoConfirmado: false, montoTotal: 95000 }),
  'b2-oneclick-inscrito': base(12, { estado: 'inscripcion_iniciada', pagoConfirmado: true, montoTotal: 89990 }),
  'b2-prueba-integracion': base(13, { estado: 'Confirmado', pagoConfirmado: true, modoPago: 'integracion', fechaPago: new Date(ahora), montoTotal: 49990 }),
  // N192: pagada pero sin ningún campo de monto → planificación muestra «—» y no suma ingreso (monto 0).
  'b2-pagada-sin-monto': base(14, { ...pagada(ahora - 6 * dia) }),
};

/** Valor de Firestore REST. */
function valor(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(valor) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, valor(x)])) } };
}

async function pedir(url, opciones) {
  const r = await fetch(url, opciones);
  const texto = await r.text();
  if (!r.ok) throw new Error(`${opciones?.method || 'GET'} ${url.replace(/\?.*/, '')} → ${r.status}: ${texto.slice(0, 200)}`);
  return texto ? JSON.parse(texto) : {};
}

async function usuarioStaff() {
  const authBase = `http://127.0.0.1:${P.auth}/identitytoolkit.googleapis.com/v1`;
  let localId;
  try {
    ({ localId } = await pedir(`${authBase}/accounts:signUp?key=demo-api-key-local`, { method: 'POST', headers: OWNER, body: JSON.stringify({ email: STAFF_PRUEBA.email, password: STAFF_PRUEBA.password, displayName: STAFF_PRUEBA.nombre, returnSecureToken: false }) }));
  } catch (e) {
    if (!/EMAIL_EXISTS/.test(e.message)) throw e;
    ({ localId } = await pedir(`${authBase}/accounts:signInWithPassword?key=demo-api-key-local`, { method: 'POST', headers: OWNER, body: JSON.stringify({ email: STAFF_PRUEBA.email, password: STAFF_PRUEBA.password }) }));
  }
  await pedir(`${authBase}/projects/${PROYECTO}/accounts:update`, { method: 'POST', headers: OWNER, body: JSON.stringify({ localId, customAttributes: JSON.stringify({ staffActivo: true }) }) });
  return localId;
}

async function main() {
  const fsBase = `http://127.0.0.1:${P.firestore}/v1/projects/${PROYECTO}/databases/(default)/documents`;
  try { await fetch(`http://127.0.0.1:${P.firestore}/`); } catch {
    console.error(`No responde el emulador de Firestore en 127.0.0.1:${P.firestore}. Abre primero los emuladores de la web con el mismo GC_OFFSET.`);
    process.exit(1);
  }
  const uid = await usuarioStaff();
  for (const [id, datos] of Object.entries(ORDENES)) {
    // operadorId: el staff de prueba ve las órdenes en mis-trabajos.html (filtra por operador asignado).
    const fields = Object.fromEntries(Object.entries({ ...datos, operadorId: uid }).map(([k, v]) => [k, valor(v)]));
    await pedir(`${fsBase}/ordenes/${id}`, { method: 'PATCH', headers: OWNER, body: JSON.stringify({ fields }) });
  }
  console.log(`Sembrado en ${PROYECTO} (GC_OFFSET=${OFF}): usuario staff de prueba (uid ${uid.slice(0, 6)}…) y ${Object.keys(ORDENES).length} órdenes ficticias.`);
  console.log(`Credenciales del emulador: ver STAFF_PRUEBA en scripts/local/sembrar-emulador.mjs.`);
}

if (process.argv[1] && /sembrar-emulador\.mjs$/.test(process.argv[1])) await main();
