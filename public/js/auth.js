/**
 * Módulo de Autenticación, Registro y Recuperación de Clave
 * Proyecto: GraveCare (gravecare.cl)
 */

import { auth, db } from "./firebaseConfig.js";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
  doc, 
  setDoc, 
  getDoc,
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { cleanRut, formatRut, validateRut } from "./utils/rutHelper.js";

/**
 * Normaliza el teléfono al formato internacional chileno (+569XXXXXXXX)
 * @param {string} phone
 * @returns {string}
 */
export function normalizeChileanPhone(phone) {
  if (!phone) return '';
  let digits = phone.replace(/[^0-9]/g, '');
  
  if (digits.startsWith('569') && digits.length === 11) {
    return `+${digits}`;
  }
  if (digits.startsWith('9') && digits.length === 9) {
    return `+56${digits}`;
  }
  if (digits.length === 8) {
    return `+569${digits}`;
  }
  if (digits.startsWith('56') && digits.length === 11) {
    return `+${digits}`;
  }
  return `+${digits}`;
}

/**
 * Registra un nuevo usuario con Nombre, RUT, Correo, Dirección, Comuna, Teléfono y Contraseña.
 * @param {Object} userData - { nombreCompleto, rut, email, direccion, comuna, telefono, password }
 * @returns {Promise<Object>} - Usuario creado en Firebase
 */
export async function registerUser({ nombreCompleto, rut, email, direccion, comuna, telefono, password }) {
  // Validaciones
  if (!nombreCompleto || nombreCompleto.trim().length < 3) {
    throw new Error("Por favor ingresa tu nombre completo.");
  }

  if (!validateRut(rut)) {
    throw new Error("El RUT ingresado no es válido. Verifica el dígito verificador.");
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    throw new Error("Por favor ingresa un correo electrónico válido (ej: usuario@gmail.com).");
  }

  if (!direccion || direccion.trim().length < 3) {
    throw new Error("Por favor ingresa tu dirección.");
  }

  if (!comuna || comuna.trim().length < 2) {
    throw new Error("Por favor ingresa tu comuna.");
  }

  const normalizedPhone = normalizeChileanPhone(telefono);
  if (!/^\+569\d{8}$/.test(normalizedPhone)) {
    throw new Error("El teléfono debe ser un móvil chileno válido (+56 9 XXXX XXXX o 9XXXXXXXX).");
  }

  if (!password || password.length < 6) {
    throw new Error("La contraseña debe tener al menos 6 caracteres.");
  }

  const cleanedRut = cleanRut(rut);
  const normalizedEmail = email.trim().toLowerCase();

  // 1. Crear credencial en Firebase Authentication con el correo real
  const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
  const user = userCredential.user;

  // 2. Guardar perfil completo en Firestore
  await setDoc(doc(db, "usuarios", user.uid), {
    uid: user.uid,
    nombreCompleto: nombreCompleto.trim(),
    rut: cleanedRut,
    rutFormateado: formatRut(cleanedRut),
    email: normalizedEmail,
    direccion: direccion.trim(),
    comuna: comuna.trim(),
    telefono: normalizedPhone,
    estadoSuscripcion: "pendiente",
    planId: null,
    creadoEn: serverTimestamp(),
    actualizadoEn: serverTimestamp()
  });

  // 3. Crear índice de búsqueda por RUT para permitir inicio de sesión y recuperación mediante RUT
  try {
    await setDoc(doc(db, "rut_lookup", cleanedRut), {
      email: normalizedEmail,
      uid: user.uid,
      rut: cleanedRut
    });
  } catch (err) {
    console.warn("Aviso al indexar RUT:", err);
  }

  return user;
}

/**
 * Inicia sesión utilizando RUT chileno O Correo Electrónico.
 * @param {string} identifier - RUT (ej: 12.345.678-5) o Correo (ej: juan@gmail.com)
 * @param {string} password - Contraseña
 * @returns {Promise<Object>}
 */
export async function loginUser(identifier, password) {
  if (!identifier || !identifier.trim()) {
    throw new Error("Por favor ingresa tu RUT o correo electrónico.");
  }

  if (!password) {
    throw new Error("Por favor ingresa tu contraseña.");
  }

  let emailToAuth = identifier.trim().toLowerCase();

  // Si no contiene '@', se asume que es un RUT
  if (!emailToAuth.includes("@")) {
    const cleaned = cleanRut(identifier);
    if (!validateRut(cleaned)) {
      throw new Error("El RUT ingresado no es válido.");
    }

    try {
      const lookupSnap = await getDoc(doc(db, "rut_lookup", cleaned));
      if (lookupSnap.exists() && lookupSnap.data().email) {
        emailToAuth = lookupSnap.data().email;
      } else {
        throw new Error("No se encontró ninguna cuenta asociada a este RUT. Por favor regístrate.");
      }
    } catch (err) {
      if (err.message && err.message.includes("No se encontró")) throw err;
      // Si falla la búsqueda directa, intentar con error amigable
      throw new Error("No se pudo verificar el RUT. Puedes ingresar con tu correo electrónico o verificar tu RUT.");
    }
  }

  const userCredential = await signInWithEmailAndPassword(auth, emailToAuth, password);
  return userCredential.user;
}

/**
 * Envía un correo electrónico oficial de Firebase para restablecer la contraseña.
 * @param {string} identifier - Correo electrónico o RUT
 * @returns {Promise<string>} - Correo al que fue enviado el enlace
 */
export async function resetPasswordWithEmail(identifier) {
  if (!identifier || !identifier.trim()) {
    throw new Error("Por favor ingresa tu correo electrónico o RUT.");
  }

  let emailToSend = identifier.trim().toLowerCase();

  if (!emailToSend.includes("@")) {
    const cleaned = cleanRut(identifier);
    if (!validateRut(cleaned)) {
      throw new Error("El RUT ingresado no es válido.");
    }

    const lookupSnap = await getDoc(doc(db, "rut_lookup", cleaned));
    if (lookupSnap.exists() && lookupSnap.data().email) {
      emailToSend = lookupSnap.data().email;
    } else {
      throw new Error("No se encontró ningún usuario registrado con este RUT.");
    }
  }

  // Enviar correo de restablecimiento de contraseña de Firebase
  await sendPasswordResetEmail(auth, emailToSend);
  return emailToSend;
}

/**
 * Cierra la sesión activa.
 */
export async function logoutUser() {
  await signOut(auth);
}

/**
 * Obtiene los datos del perfil desde Firestore para un UID.
 * @param {string} uid
 * @returns {Promise<Object|null>}
 */
export async function getUserProfile(uid) {
  const docRef = doc(db, "usuarios", uid);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data();
  }
  return null;
}

/**
 * Escucha cambios en el estado de autenticación.
 * @param {Function} callback
 */
export function observeAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}
