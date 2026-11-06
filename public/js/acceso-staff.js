/**
 * acceso-staff.js — control de acceso del backoffice (spec 040, N17).
 * Propuesta para gravecare-operaciones: public/js/acceso-staff.js
 *
 * Única responsabilidad: verificar que hay sesión y que el token trae el claim `staffActivo === true`.
 * - Sin usuario → login-ops.html
 * - Sin claim, claim distinto de true, o token ilegible → cierra la sesión y redirige a login-ops.html?sinAcceso=1
 * - Si falla cerrar la sesión, igual redirige (nunca deja pasar).
 *
 * Seguridad real: las reglas de Firestore (spec 040). Esto es control de interfaz; no sustituye a las reglas.
 * No toca Firestore, no cambia nombres de campos ni colecciones (regla 9).
 *
 * @param {object} auth  instancia de Firebase Auth (usa signOut)
 * @param {object|null} user  usuario de onAuthStateChanged
 * @param {{redirigir?: (url: string) => void}} [opciones]  redirección inyectable (pruebas)
 * @returns {Promise<boolean>} true solo si el usuario es staff
 */
export async function exigirStaff(auth, user, opciones = {}) {
  const redirigir = opciones.redirigir || ((url) => window.location.replace(url));
  if (!user) {
    redirigir("login-ops.html");
    return false;
  }
  let esStaff = false;
  try {
    // true fuerza un refresco del token, para leer el claim vigente (no uno cacheado).
    const token = await user.getIdTokenResult(true);
    esStaff = Boolean(token && token.claims && token.claims.staffActivo === true);
  } catch (e) {
    esStaff = false; // token ilegible: falla cerrado
  }
  if (esStaff) return true;
  try {
    await auth.signOut();
  } catch (e) {
    // si no se puede cerrar la sesión, igual se redirige: no se deja pasar
  }
  redirigir("login-ops.html?sinAcceso=1");
  return false;
}
