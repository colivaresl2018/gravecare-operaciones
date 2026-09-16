/**
 * Control de acceso y privilegios por rol — GraveCare Operaciones
 */
import { observeAuthState, logoutUser } from "./auth.js";
import { db } from "./firebaseConfig.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export const ROLES_STAFF = ["operador", "supervisor", "administrador"];

// Matriz de permisos por página
export const PERMISOS_PAGINAS = {
  "portal.html": ["operador", "supervisor", "administrador"],
  "mis-trabajos.html": ["operador", "supervisor", "administrador"],
  "informe-captura.html": ["operador", "supervisor", "administrador"],
  "informe-revision.html": ["supervisor", "administrador"],
  "gastos-ingresos.html": ["administrador"],
  "admin-usuarios.html": ["administrador"]
};

export async function getStaffProfile(uid) {
  const snap = await getDoc(doc(db, "staff", uid));
  return snap.exists() ? snap.data() : null;
}

/**
 * Valida autenticación, vigencia de staff y permisos específicos para el módulo actual
 */
export function requireStaffAccess(onReady, paginaActual = null) {
  observeAuthState(async (user) => {
    if (!user) {
      window.location.replace("login.html");
      return;
    }

    try {
      const staffProfile = await getStaffProfile(user.uid);

      // 1. Debe existir en staff y estar activo
      if (!staffProfile || !staffProfile.activo || !ROLES_STAFF.includes(staffProfile.rol)) {
        sessionStorage.setItem("gravecare_ops_denegado", "1");
        await logoutUser();
        window.location.replace("login.html");
        return;
      }

      // 2. Si se especifica la página, validar que el rol tenga privilegios
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
            alert("No tienes los privilegios requeridos para ingresar a este módulo.");
            window.location.replace("portal.html");
            return;
          }
        }
      }

      onReady(user, staffProfile);
    } catch (err) {
      console.error("Error validando permisos de staff:", err);
      window.location.replace("login.html");
    }
  });
}

export function wireLogoutButton(buttonId) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;
  btn.addEventListener("click", async () => {
    await logoutUser();
    window.location.replace("login.html");
  });
}