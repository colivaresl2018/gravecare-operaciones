/**
 * entorno.js — configuración de Firebase del backoffice según el host (spec 040 / operaciones).
 * - localhost, 127.0.0.1 y el sitio de QA → proyecto gravecare-qa (pruebas).
 * - Dominios de producción del backoffice → proyecto gravecare-2e8d2.
 * - Cualquier otro host → error: no se inicia Firebase (falla cerrado).
 * Las claves web de Firebase no son secretos (van en el cliente); la seguridad la dan las reglas.
 */
const HOSTS_QA = ["localhost", "127.0.0.1", "gravecare-qa.web.app", "gravecare-qa.firebaseapp.com"];
const HOSTS_PRODUCCION = ["gravecare-ops.web.app", "gravecare-ops.firebaseapp.com", "operaciones.gravecare.cl"];

const CONFIG_QA = {
  apiKey: "AIzaSyC2rGRWdbp9NTkUAvs8B_65oHUAvPPmLoU",
  authDomain: "gravecare-qa.firebaseapp.com",
  projectId: "gravecare-qa",
  storageBucket: "gravecare-qa.firebasestorage.app",
  messagingSenderId: "449089862967",
  appId: "1:449089862967:web:746ff0cc6c75e1bd506eb2"
};

const CONFIG_PRODUCCION = {
  apiKey: "AIzaSyAthgIWiVPDuscljVjQRAX-vIeUYLbrSC0",
  authDomain: "gravecare-2e8d2.firebaseapp.com",
  projectId: "gravecare-2e8d2",
  storageBucket: "gravecare-2e8d2.firebasestorage.app",
  messagingSenderId: "160012946248",
  appId: "1:160012946248:web:8c3e73100f1e92c485c17d",
  measurementId: "G-CEEG6MM47Z"
};

/** Elige la configuración por nombre de host. Lanza si el host no es reconocido. */
export function configuracionPara(hostname) {
  if (HOSTS_QA.includes(hostname)) return CONFIG_QA;
  if (HOSTS_PRODUCCION.includes(hostname)) return CONFIG_PRODUCCION;
  throw new Error(`Entorno no reconocido para el host «${hostname}». No se inicia Firebase.`);
}

/** Configuración de la página actual (navegador). */
export const FIREBASE_CONFIG = typeof window !== "undefined" ? configuracionPara(window.location.hostname) : null;
