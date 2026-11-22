/**
 * compra-ramos.js — lógica pura de la lista de compra de ramos de flores (directriz B5, etapa 2; spec 056 R5 y R6).
 * Sin DOM ni Firebase: se prueba con `node --test`.
 *
 * - Cada visita lleva 1 ramo del nivel contratado más los ramos adicionales de la orden, del mismo nivel.
 *   Deluxe no admite adicionales. Mismo criterio con que el servidor cobra (functions/transbank.js); el nivel y los
 *   adicionales ya vienen calculados en cada fila (`nivel`, `ramosAdicionales`, de planificacion-servicios.js).
 * - El día de cada visita es el de su fecha (real o tentativa; en Spot, la que eligió el cliente).
 * - Los precios salen de `valores_ramos/compra` (CLP por ramo). Si falta un valor, la línea queda «sin valor» y el total
 *   se marca incompleto: NUNCA se inventa un precio. Un 0 guardado sí es un valor.
 */
import { diasDeLaSemana } from './fechas-semana.js?v=b5';

/** Tipos de ramo que se compran, en el orden en que se muestran (son las claves de valores_ramos/compra). */
export const TIPOS_RAMO = [
  { clave: 'standard', singular: 'Ramo Standard', plural: 'Ramos Standard' },
  { clave: 'premium', singular: 'Ramo Premium', plural: 'Ramos Premium' },
  { clave: 'deluxe', singular: 'Ramo Deluxe', plural: 'Ramos Deluxe' },
  { clave: 'adicionalStandard', singular: 'Ramo Adicional Standard', plural: 'Ramos Adicionales Standard' },
  { clave: 'adicionalPremium', singular: 'Ramo Adicional Premium', plural: 'Ramos Adicionales Premium' },
];

const conteoVacio = () => ({ standard: 0, premium: 0, deluxe: 0, adicionalStandard: 0, adicionalPremium: 0 });

/** Cantidades de cada tipo de ramo que necesita UNA visita con ese nivel y esos adicionales. */
export function ramosDeVisita(nivel, adicionales = 0) {
  const c = conteoVacio();
  const extra = Number.isFinite(Number(adicionales)) ? Math.max(0, Math.trunc(Number(adicionales))) : 0;
  if (nivel === 'Deluxe') c.deluxe = 1; // Deluxe no admite adicionales
  else if (nivel === 'Premium') { c.premium = 1; c.adicionalPremium = extra; }
  else { c.standard = 1; c.adicionalStandard = extra; } // sin nivel, Standard (igual que el servidor)
  return c;
}

/** «2 Ramos Premium», «1 Ramo Adicional Standard» ('' si el tipo no existe). */
export function textoRamos(clave, cantidad) {
  const t = TIPOS_RAMO.find((x) => x.clave === clave);
  return t ? `${cantidad} ${cantidad === 1 ? t.singular : t.plural}` : '';
}

/** Valor de compra de un ramo: entero de pesos >= 0, o null si no está definido o no es válido (nunca se inventa un 0). */
export function normalizarValor(v) {
  if (v === null || v === undefined) return null;
  let n = v;
  if (typeof v !== 'number') {
    // Formato chileno: puntos solo como separador de miles y coma decimal («12.000», «$ 12.000», «12,5»). Todo lo demás es inválido.
    const s = String(v).trim().replace(/^\$\s*/, '');
    if (!/^(\d{1,3}(\.\d{3})+|\d+)(,\d+)?$/.test(s)) return null;
    n = Number(s.replace(/\./g, '').replace(',', '.'));
  }
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

/** Deja los valores de las 5 claves como entero o null; cualquier otro campo se ignora. */
export function normalizarValores(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  for (const t of TIPOS_RAMO) out[t.clave] = normalizarValor(r[t.clave]);
  return out;
}

function sumar(a, b) {
  const out = {};
  for (const t of TIPOS_RAMO) out[t.clave] = (a[t.clave] || 0) + (b[t.clave] || 0);
  return out;
}

/** Líneas de un conteo con su precio: [{ clave, texto, cantidad, valorUnitario|null, subtotal|null }] + total y si quedó incompleto. */
function lineasDe(conteo, valores) {
  const lineas = [];
  let total = 0;
  let incompleto = false;
  for (const t of TIPOS_RAMO) {
    const cantidad = conteo[t.clave] || 0;
    if (cantidad <= 0) continue;
    const unitario = valores[t.clave];
    const subtotal = unitario === null || unitario === undefined ? null : unitario * cantidad;
    if (subtotal === null) incompleto = true; else total += subtotal;
    lineas.push({ clave: t.clave, texto: textoRamos(t.clave, cantidad), cantidad, valorUnitario: unitario ?? null, subtotal });
  }
  return { lineas, total, incompleto, totalRamos: lineas.reduce((s, l) => s + l.cantidad, 0) };
}

/**
 * Arma la lista de compra de una semana (lunes a domingo).
 *
 * @param {object[]} filas  Filas de visitas (Planes y Spot) de construirFilasPlanificacion: usan fechaIso, cementerio, nivel,
 *                          ramosAdicionales, terminada y esTentativa.
 * @param {{ lunesIso: string, incluirCompletadas?: boolean, valores?: object }} opciones
 * @returns {{ dias: object[], resumen: object, sinFecha: number, tentativas: number, faltantes: string[] }}
 */
export function construirListaCompra(filas, { lunesIso, incluirCompletadas = false, valores = {} } = {}) {
  const val = normalizarValores(valores);
  const dias = diasDeLaSemana(lunesIso).map((d) => ({ ...d, cementerios: [], conteo: conteoVacio() }));
  const porIso = new Map(dias.map((d) => [d.iso, d]));
  let sinFecha = 0;
  let tentativas = 0;

  for (const f of filas || []) {
    if (f.terminada && !incluirCompletadas) continue; // ya se hizo: no se compra
    if (!f.fechaIso) { sinFecha += 1; continue; }
    const dia = porIso.get(f.fechaIso);
    if (!dia) continue;
    const cem = f.cementerio || '—';
    let entrada = dia.cementerios.find((c) => c.cementerio === cem);
    if (!entrada) { entrada = { cementerio: cem, conteo: conteoVacio(), visitas: 0 }; dia.cementerios.push(entrada); }
    const r = ramosDeVisita(f.nivel, f.ramosAdicionales);
    entrada.conteo = sumar(entrada.conteo, r);
    entrada.visitas += 1;
    dia.conteo = sumar(dia.conteo, r);
    if (f.esTentativa) tentativas += 1;
  }

  let conteoSemana = conteoVacio();
  for (const dia of dias) {
    dia.cementerios.sort((a, b) => a.cementerio.localeCompare(b.cementerio, 'es'));
    for (const c of dia.cementerios) Object.assign(c, lineasDe(c.conteo, val));
    Object.assign(dia, lineasDe(dia.conteo, val));
    dia.visitas = dia.cementerios.reduce((s, c) => s + c.visitas, 0);
    conteoSemana = sumar(conteoSemana, dia.conteo);
  }
  const resumen = lineasDe(conteoSemana, val);
  resumen.visitas = dias.reduce((s, d) => s + d.visitas, 0);
  const faltantes = TIPOS_RAMO.filter((t) => (conteoSemana[t.clave] || 0) > 0 && val[t.clave] === null).map((t) => t.singular);

  return { dias, resumen, sinFecha, tentativas, faltantes };
}
