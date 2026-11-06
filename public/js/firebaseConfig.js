import { FIREBASE_CONFIG } from "./entorno.js"; // configuración por entorno (spec 040)
/**
 * Configuración e Inicialización de Firebase SDK (v10+ Modular)
 * Proyecto: GraveCare (gravecare-2e8d2 / gravecare.cl)
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics.js";

const firebaseConfig = FIREBASE_CONFIG;

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
// getStorage(app) SIN el bucket explícito construye la URL de subida con
// el patrón antiguo {projectId}.appspot.com en vez de usar storageBucket
// de arriba (gravecare-2e8d2.firebasestorage.app, el formato nuevo). Ese
// bucket .appspot.com nunca existió para este proyecto (gsutil lo confirma
// con "404 The specified bucket does not exist"), así que cada subida
// fallaba: el navegador lo reportaba como error de CORS porque una
// petición a un bucket inexistente jamás puede tener los headers CORS
// correctos, aunque el bucket real sí los tuviera bien configurados.
export const storage = getStorage(app, `gs://${firebaseConfig.storageBucket}`);
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
