/**
 * estados-visita-db.js — persistencia aditiva de estados por visita (spec 041).
 * Escribe SOLO en `estadosPorVisita.<clave>` y `ultimaModificacion` de la orden. No toca `operadoresPorVisita` ni otros campos.
 * Las dependencias de Firestore (updateDoc y la referencia al documento) se inyectan: así se prueban sin red.
 */
import { construirUltimaModificacion } from "./estados-visita.js";

const CLAVE_VALIDA = /^V\d{1,3}$/;

/**
 * @param {object} p
 * @param {(ref: any, datos: object) => Promise<any>} p.actualizar   función updateDoc de Firestore
 * @param {(id: string) => any} p.referencia                          devuelve la referencia a la orden
 * @param {string} p.ordenDocId
 * @param {string} p.claveVisita   p. ej. "V2"
 * @param {string} p.estadoAnterior
 * @param {string} p.estadoNuevo
 * @param {string} p.uidOperador
 * @returns {Promise<object>} el registro de auditoría escrito
 */
export async function guardarEstadoVisita({ actualizar, referencia, ordenDocId, claveVisita, estadoAnterior, estadoNuevo, uidOperador, ahora }) {
  if (!ordenDocId) throw new Error("Falta la orden.");
  if (!CLAVE_VALIDA.test(String(claveVisita || ""))) throw new Error("Clave de visita no válida.");
  // Valida la transición y arma la auditoría antes de escribir: si algo falla, no se escribe nada.
  const ultimaModificacion = construirUltimaModificacion({ uidOperador, estadoAnterior, estadoNuevo, ahora });
  await actualizar(referencia(ordenDocId), {
    [`estadosPorVisita.${claveVisita}`]: estadoNuevo,
    ultimaModificacion,
  });
  return ultimaModificacion;
}
