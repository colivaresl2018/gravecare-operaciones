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
  try {
    const snap = await getDoc(doc(db, "staff", uid));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    console.warn("Aviso al obtener perfil de staff:", err);
    return null;
  }
}

/**
 * Valida autenticación, vigencia de staff y permisos específicos para el módulo actual
 */
export function requireStaffAccess(onReady, paginaActual = null) {
  // Si está dentro de un iframe (como mis-trabajos.html cargado en portal.html),
  // NO debe expulsar la ventana superior hacia login.
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
      const esAdminMaestro = emailLower === "colivaresl@hotmail.com" || emailLower === "admin@gravecare.cl";

      let staffProfile = await getStaffProfile(user.uid);

      if (esAdminMaestro) {
        staffProfile = {
          nombre: "Christian Olivares",
          email: emailLower,
          rol: "administrador",
          activo: true
        };
      }

      if (!staffProfile || !staffProfile.activo || !ROLES_STAFF.includes(staffProfile.rol)) {
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