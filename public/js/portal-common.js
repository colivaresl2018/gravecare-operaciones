/**
 * Control de acceso y privilegios por rol — GraveCare Operaciones
 */
import { observeAuthState, logoutUser } from "./auth.js";
import { db } from "./firebaseConfig.js";
import { doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export const ROLES_STAFF = ["operador", "supervisor", "administrador", "admin"];

// Matriz de permisos por página
export const PERMISOS_PAGINAS = {
  "portal.html": ["operador", "supervisor", "administrador", "admin"],
  "mis-trabajos.html": ["operador", "supervisor", "administrador", "admin"],
  "todos-los-trabajos.html": ["supervisor", "administrador", "admin"],
  "informe-captura.html": ["operador", "supervisor", "administrador", "admin"],
  "informe-revision.html": ["supervisor", "administrador", "admin"],
  "gastos-ingresos.html": ["administrador", "admin"],
  "admin-usuarios.html": ["administrador", "admin"]
};

export async function getStaffProfile(uid, email = "") {
  try {
    // 1. Búsqueda directa por UID
    if (uid) {
      const snap = await getDoc(doc(db, "staff", uid));
      if (snap.exists()) return snap.data();
    }

    // 2. Búsqueda de respaldo por Email si el UID no coincide
    if (email) {
      const cleanEmail = email.toLowerCase().trim();
      const q = query(collection(db, "staff"), where("email", "==", cleanEmail));
      const snapQ = await getDocs(q);
      if (!snapQ.empty) {
        return snapQ.docs[0].data();
      }
    }

    return null;
  } catch (err) {
    console.warn("Aviso al obtener perfil de staff:", err);
    return null;
  }
}

/**
 * Valida autenticación, vigencia de staff y permisos específicos para el módulo actual
 */
export function requireStaffAccess(onReady, paginaActual = null) {
  const dentroDeIframe = window.self !== window.top;

  observeAuthState(async (user) => {
    if (!user) {
      if (!dentroDeIframe) {
        window.location.replace("login-ops.html");
      } else {
        console.log("Módulo en iframe: esperando sincronización con sesión principal...");
      }
      return;
    }

    try {
      const emailLower = (user.email || "").toLowerCase().trim();
      
      // Administradores con acceso maestro directo
      const administradoresMaestros = [
        "colivaresl@hotmail.com",
        "admin@gravecare.cl",
        "contacto@gravecare.cl",
        "rravellos@gmail.com"
      ];

      const esAdminMaestro = administradoresMaestros.includes(emailLower);

      let staffProfile = await getStaffProfile(user.uid, emailLower);

      // Si es un admin maestro y no se encontró doc en Firestore, o para asegurar rol pleno:
      if (esAdminMaestro) {
        staffProfile = {
          nombre: staffProfile?.nombre || (emailLower.includes("ravellos") ? "Raúl Ravellos" : "Christian Olivares"),
          email: emailLower,
          rol: "administrador",
          activo: true,
          valor: true
        };
      }

      if (!staffProfile || !staffProfile.activo || !ROLES_STAFF.includes(staffProfile.rol)) {
        console.warn("Acceso denegado a staff para usuario:", emailLower, staffProfile);
        if (!dentroDeIframe) {
          sessionStorage.setItem("gravecare_ops_denegado", "1");
          await logoutUser();
          window.location.replace("login-ops.html");
        }
        return;
      }

      try {
        await user.getIdToken(true);
      } catch (e) {}

      if (paginaActual && PERMISOS_PAGINAS[paginaActual]) {
        const rolesPermitidos = PERMISOS_PAGINAS[paginaActual];
        if (!rolesPermitidos.includes(staffProfile.rol)) {
          const mainContent = document.getElementById("contenido-principal");
          const accessDenied = document.getElementById("acceso-denegado");
          if (mainContent && accessDenied) {
            mainContent.classList.add("hidden");
            accessDenied.classList.remove("hidden");
            return;
          } else {
            if (!dentroDeIframe) {
              alert("No tienes privilegios para este módulo.");
              window.location.replace("portal.html");
            }
            return;
          }
        }
      }

      // Ejecutar la carga real del módulo
      onReady(user, staffProfile);

    } catch (err) {
      console.error("Error validando staff:", err);
      if (!dentroDeIframe) {
        window.location.replace("login-ops.html");
      }
    }
  });
}

export function wireLogoutButton(buttonId) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;
  btn.addEventListener("click", async () => {
    await logoutUser();
    window.top.location.replace("login-ops.html");
  });
}