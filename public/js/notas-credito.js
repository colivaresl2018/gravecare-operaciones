/**
 * notas-credito.js — lógica pura de las notas de crédito de «Gastos e ingresos» (directriz B-3).
 *
 * El portal NO emite documentos tributarios: el dueño emite la boleta y la nota ante el SII y aquí solo se REGISTRAN
 * los folios, el monto, el motivo y el medio de devolución. Los datos viven en la colección aditiva `notasCredito`
 * (los `gastos_ingresos` y las `ordenes` existentes no se tocan; de `ordenes` solo se lee).
 *
 * Modelo: la boleta se mantiene y la nota la compensa. En el libro hay dos filas (neto cero): la nota aparece como un
 * ingreso con importes NEGATIVOS, en el mes de su fecha, y afecta a IVA igual que la boleta, así que resta del ingreso
 * neto y del débito fiscal de ese mes (ver liquidacion-tributaria.js). El documento guardado lleva el monto en positivo.
 *
 * Sin dependencias del navegador ni de Firebase: se prueba con `node --test`.
 */

export const TIPO_DTE_NOTA = 'Nota de Crédito Electrónica';
export const ORIGEN_NOTA = 'Nota de crédito';

/**
 * Avisos NO bloqueantes (el guardado nunca se impide por ellos). Se dejan como constantes para cambiarlos en un solo lugar.
 * - 6 meses entre la fecha de la boleta y la de la nota: art. 21 N°2 y art. 70 del D.L. 825 (texto leído en la BCN el 2026-11-09).
 *   Que se cuente desde la fecha de la boleta es criterio del contador (no está en el texto leído del art. 70).
 * - 30 días desde que el servicio queda sin efecto: art. 70 del D.L. 825 (se avisa solo si se informa esa fecha).
 */
export const PLAZO_MESES_BOLETA_NOTA = 6;
export const PLAZO_DIAS_TERMINO_SERVICIO = 30;

export const TASA_IVA = 0.19;

/** Código de referencia del SII en la nota: 1 anula el documento completo; 3 corrige montos. */
export const CODIGOS_REFERENCIA = { 1: 'Anula documento', 3: 'Corrige montos' };

/** Solo el medio: los datos bancarios del cliente quedan fuera de B-3 (datos personales). */
export const MEDIOS_DEVOLUCION = ['Reversa Transbank', 'Transferencia bancaria'];

const DIA_MS = 86400000;

/** Convierte Date, Timestamp de Firestore o «AAAA-MM-DD» en Date (al mediodía local); otra cosa da null. */
export function aFecha(v) {
  if (!v) return null;
  if (typeof v.toDate === 'function') return v.toDate();
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === 'string') {
    const d = new Date(v.includes('T') ? v : v + 'T12:00:00');
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Día calendario (sin hora) como número, para comparar fechas sin que influyan las horas ni el huso. */
function numeroDeDia(d) {
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DIA_MS;
}

/** Suma meses de calendario; si el día no existe en el mes de destino queda el último (31-ago + 6 = 28-feb). */
function sumarMeses(d, meses) {
  const total = d.getMonth() + meses;
  const anio = d.getFullYear() + Math.floor(total / 12);
  const mes = ((total % 12) + 12) % 12;
  const ultimo = new Date(anio, mes + 1, 0).getDate();
  return new Date(anio, mes, Math.min(d.getDate(), ultimo));
}

/** Neto e IVA de un monto bruto, con el mismo redondeo que el ingreso de una orden (neto = bruto / 1,19). */
export function desglosarBruto(bruto) {
  const total = Math.round(Number(bruto) || 0);
  const neto = Math.round(total / (1 + TASA_IVA));
  return { neto, iva: total - neto, total };
}

/** Solo las boletas electrónicas de venta (ingreso) con monto pueden recibir una nota. */
export function esBoletaCreditable(mov) {
  return Boolean(mov) && mov.tipo === 'Ingreso' && mov.dte === 'Boleta Venta' && mov.origen !== ORIGEN_NOTA && Number(mov.total) > 0;
}

/** Notas guardadas que referencian esa boleta (mismo origen e id de documento). */
export function notasDeBoleta(notas, boleta) {
  if (!boleta) return [];
  return (notas || []).filter((n) => n.refOrigen === boleta.origen && n.refId === boleta.id);
}

/** Lo que aún se puede compensar de la boleta: su monto bruto menos la suma de sus notas. */
export function saldoDeBoleta(boleta, notas) {
  const usado = notasDeBoleta(notas, boleta).reduce((s, n) => s + (Number(n.montoBruto) || 0), 0);
  return (Number(boleta?.total) || 0) - usado;
}

function opcionalEntero(valor) {
  if (valor === null || valor === undefined || valor === '') return { vacio: true };
  const n = Number(valor);
  return Number.isInteger(n) && n >= 0 ? { n } : { invalido: true };
}

/**
 * Valida una nota ANTES de guardarla. `nota`: { folio, fecha, montoBruto, motivo, codigoReferencia, medioDevolucion,
 * visitasContratadas?, visitasEjecutadas? }. `boleta`: la fila del libro referenciada (o null). `notas`: todas las notas guardadas.
 * Devuelve { ok, errores[] } con mensajes en español. Los avisos de plazo NO se validan aquí (ver avisosNotaCredito).
 */
export function validarNotaCredito(nota, { boleta, notas = [] } = {}) {
  const errores = [];
  const folio = String(nota?.folio ?? '').trim();
  const fechaNota = aFecha(nota?.fecha);
  const monto = Number(nota?.montoBruto);

  if (!boleta) errores.push('Falta la boleta de referencia: una nota de crédito debe referenciar una boleta registrada.');
  else if (!esBoletaCreditable(boleta)) errores.push('La boleta de referencia debe ser una boleta electrónica de venta.');

  if (!folio) errores.push('Falta el folio de la nota de crédito.');
  else if ((notas || []).some((n) => String(n.folio ?? '').trim() === folio)) errores.push(`Ya existe una nota de crédito con el folio ${folio}.`);

  if (!fechaNota) errores.push('Falta la fecha de la nota de crédito.');
  if (!Number.isInteger(monto) || monto <= 0) errores.push('El monto de la nota debe ser un número entero mayor que cero.');
  if (!String(nota?.motivo ?? '').trim()) errores.push('El motivo es obligatorio.');
  if (!Object.hasOwn(CODIGOS_REFERENCIA, Number(nota?.codigoReferencia))) errores.push('Elige el código de referencia (1 anula el documento, 3 corrige montos).');
  if (!MEDIOS_DEVOLUCION.includes(nota?.medioDevolucion)) errores.push('Elige el medio de devolución.');

  const vc = opcionalEntero(nota?.visitasContratadas);
  const ve = opcionalEntero(nota?.visitasEjecutadas);
  if (vc.invalido) errores.push('Las visitas contratadas deben ser un número entero (0 o más).');
  if (ve.invalido) errores.push('Las visitas ejecutadas deben ser un número entero (0 o más).');
  if (vc.n !== undefined && ve.n !== undefined && ve.n > vc.n) errores.push('Las visitas ejecutadas no pueden superar a las contratadas.');

  if (boleta && esBoletaCreditable(boleta)) {
    const fechaBoleta = aFecha(boleta.fecha);
    if (fechaNota && fechaBoleta && numeroDeDia(fechaNota) < numeroDeDia(fechaBoleta)) errores.push('La fecha de la nota no puede ser anterior a la de la boleta.');
    if (Number.isInteger(monto) && monto > 0) {
      const acumulado = (Number(boleta.total) - saldoDeBoleta(boleta, notas)) + monto;
      if (acumulado > Number(boleta.total)) {
        errores.push(`La suma de las notas de esta boleta supera su monto bruto: quedan $ ${Math.max(saldoDeBoleta(boleta, notas), 0).toLocaleString('es-CL')} por compensar.`);
      }
    }
  }
  return { ok: errores.length === 0, errores };
}

/**
 * Avisos no bloqueantes. Devuelve [{ codigo, texto }] (vacío si no hay nada que avisar).
 * `config` permite cambiar los plazos sin tocar la lógica (pruebas, o si el contador indica otro criterio).
 */
export function avisosNotaCredito({ fechaBoleta, fechaNota, fechaTerminoServicio } = {}, config = {}) {
  const plazoMeses = config.plazoMeses ?? PLAZO_MESES_BOLETA_NOTA;
  const plazoDias = config.plazoDias ?? PLAZO_DIAS_TERMINO_SERVICIO;
  const avisos = [];
  const b = aFecha(fechaBoleta);
  const n = aFecha(fechaNota);
  const t = aFecha(fechaTerminoServicio);

  if (b && n && numeroDeDia(n) > numeroDeDia(sumarMeses(b, plazoMeses))) {
    avisos.push({
      codigo: 'plazo-6-meses',
      texto: `Pasaron más de ${plazoMeses} meses entre la fecha de la boleta y la de la nota: el IVA podría no ser recuperable. Confírmalo con tu contador. Puedes guardar igual.`,
    });
  }
  if (t && n && numeroDeDia(n) - numeroDeDia(t) > plazoDias) {
    avisos.push({
      codigo: 'plazo-30-dias',
      texto: `Pasaron más de ${plazoDias} días desde el término del servicio: revisa con tu contador si la nota está a tiempo. Puedes guardar igual.`,
    });
  }
  return avisos;
}

/**
 * Fila del libro contable a partir de un documento de `notasCredito`. Los importes van en NEGATIVO: la nota es un ingreso
 * que compensa a la boleta, afecto a IVA, en el mes de su fecha.
 */
export function filaDeNota(id, d) {
  const bruto = Math.round(Number(d.montoBruto ?? d.total ?? 0)) || 0;
  const porDefecto = desglosarBruto(bruto);
  const neto = d.neto !== undefined && d.neto !== null ? Number(d.neto) : porDefecto.neto;
  const iva = d.iva !== undefined && d.iva !== null ? Number(d.iva) : bruto - neto;
  const refTxt = `boleta #${d.refFolio ?? '-'}${d.refFecha ? ' del ' + d.refFecha : ''}`;
  return {
    id,
    origen: ORIGEN_NOTA,
    esNota: true,
    tipo: 'Ingreso',
    dte: TIPO_DTE_NOTA,
    folio: d.folio || '-',
    rut: d.rut || '-',
    concepto: d.concepto || 'Cliente',
    fecha: aFecha(d.fecha) || new Date(),
    categoria: 'Venta de Planes',
    clasificacionF22: 'Ingreso Bruto',
    neto: -neto,
    impuesto: -iva,
    total: -bruto,
    descripcion: `Referencia: ${refTxt}. Motivo: ${d.motivo || ''}`,
    archivoUrl: d.archivoUrl || '',
    archivoNombre: d.archivoNombre || '',
    refOrigen: d.refOrigen || '',
    refId: d.refId || '',
    refFolio: d.refFolio || '',
    codigoReferencia: d.codigoReferencia ?? null,
    medioDevolucion: d.medioDevolucion || '',
    motivo: d.motivo || '',
    montoBruto: bruto,
  };
}
