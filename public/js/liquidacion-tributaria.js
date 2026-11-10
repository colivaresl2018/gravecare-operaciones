/**
 * liquidacion-tributaria.js — totales de ingresos, gastos e IVA de «Gastos e ingresos» (extraído de gastos-ingresos.html
 * en B-3 para poder probarlo; el cálculo es el mismo que ya tenía la página, más la nota de crédito como documento afecto).
 *
 * Cada movimiento: { tipo: 'Ingreso'|'Gasto', dte, fecha: Date, neto, impuesto }. Las notas de crédito llegan con importes
 * negativos (ver filaDeNota en notas-credito.js), por lo que restan del ingreso neto y del débito del mes de su fecha.
 */
import { TIPO_DTE_NOTA } from './notas-credito.js';

/** Documentos que generan débito o crédito fiscal. */
export function esDocumentoAfecto(dte) {
  return dte === 'Factura Afecta' || dte === 'Boleta Venta' || dte === TIPO_DTE_NOTA;
}

/** @returns {{totalIngresosNetos, totalGastosNetos, totalIvaDebito, totalIvaCredito, debitoMes, creditoMes, mesesData}} */
export function calcularLiquidacion(movimientos, anioFiltro, mesFiltro) {
  let totalIngresosNetos = 0;
  let totalGastosNetos = 0;
  let totalIvaDebito = 0;
  let totalIvaCredito = 0;
  let debitoMes = 0;
  let creditoMes = 0;

  const mesesData = Array.from({ length: 12 }, () => ({ ingresosNetos: 0, gastosNetos: 0, debito: 0, credito: 0 }));

  (movimientos || []).forEach((m) => {
    const anio = m.fecha.getFullYear();
    const mes = m.fecha.getMonth();
    const esIngreso = m.tipo === 'Ingreso';
    const esAfecto = esDocumentoAfecto(m.dte);

    if (esIngreso) {
      totalIngresosNetos += m.neto;
      if (esAfecto) totalIvaDebito += m.impuesto;
    } else {
      totalGastosNetos += m.neto;
      if (esAfecto) totalIvaCredito += m.impuesto;
    }

    if (anio === anioFiltro && mes === mesFiltro) {
      if (esIngreso && esAfecto) debitoMes += m.impuesto;
      if (!esIngreso && esAfecto) creditoMes += m.impuesto;
    }

    if (anio === anioFiltro) {
      if (esIngreso) {
        mesesData[mes].ingresosNetos += m.neto;
        if (esAfecto) mesesData[mes].debito += m.impuesto;
      } else {
        mesesData[mes].gastosNetos += m.neto;
        if (esAfecto) mesesData[mes].credito += m.impuesto;
      }
    }
  });

  return { totalIngresosNetos, totalGastosNetos, totalIvaDebito, totalIvaCredito, debitoMes, creditoMes, mesesData };
}
