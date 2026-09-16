/**
 * Módulo Gastos e Ingresos — Portal de Operaciones GraveCare
 * Acceso restringido a rol "administrador" (ver portal-common.js).
 */
import { db } from "./firebaseConfig.js";
import { requireStaffAccess, wireLogoutButton } from "./portal-common.js";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const COLECCION = "gastos_ingresos";

export const CATEGORIAS = {
  Gasto: ["Sueldos", "Insumos", "Servicios", "Mantenimiento", "Otros"],
  Ingreso: ["Suscripciones", "Servicios Prestados", "Otros"]
};

let movimientos = [];       // cache local de lo que trae Firestore
let usuarioActual = null;   // { uid, email }
let graficoComparativo = null; // instancia de Chart.js

const MESES_LABEL = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
];

// ---------- Utilidades ----------

function formatCLP(monto) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0
  }).format(monto);
}

function formatFechaCorta(fechaISO) {
  const [y, m, d] = fechaISO.split("-");
  return `${d}-${m}-${y}`;
}

function poblarSelectCategoria(selectEl, tipo, incluirTodas = false) {
  selectEl.innerHTML = "";
  if (incluirTodas) {
    const optTodas = document.createElement("option");
    optTodas.value = "";
    optTodas.textContent = "Todas";
    selectEl.appendChild(optTodas);
  }
  const listas = tipo ? CATEGORIAS[tipo] : [...CATEGORIAS.Gasto, ...CATEGORIAS.Ingreso];
  const unicas = [...new Set(listas)];
  unicas.forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    selectEl.appendChild(opt);
  });
}

// ---------- Carga de datos ----------

async function cargarMovimientos() {
  const q = query(collection(db, COLECCION), orderBy("fecha", "desc"));
  const snap = await getDocs(q);
  movimientos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ---------- Filtros ----------

function obtenerFiltros() {
  return {
    tipo: document.getElementById("filtro-tipo").value,       // "" | "Gasto" | "Ingreso"
    categoria: document.getElementById("filtro-categoria").value,
    desde: document.getElementById("filtro-desde").value,      // "" | yyyy-mm-dd
    hasta: document.getElementById("filtro-hasta").value
  };
}

function aplicarFiltros(lista, filtros) {
  return lista.filter((m) => {
    if (filtros.tipo && m.tipo !== filtros.tipo) return false;
    if (filtros.categoria && m.categoria !== filtros.categoria) return false;
    if (filtros.desde && m.fecha < filtros.desde) return false;
    if (filtros.hasta && m.fecha > filtros.hasta) return false;
    return true;
  });
}

// ---------- Render ----------

function renderResumen(lista) {
  const ingresosNetos = lista
    .filter((m) => m.tipo === "Ingreso")
    .reduce((acc, m) => acc + Number(m.montoNeto || m.monto || 0), 0);

  const gastosNetos = lista
    .filter((m) => m.tipo === "Gasto" && m.clasificacionF22 !== "Gasto No Deducible")
    .reduce((acc, m) => acc + Number(m.montoNeto || m.monto || 0), 0);

  const ivaDebito = lista
    .filter((m) => m.tipo === "Ingreso" && m.tipoDTE === "Factura Afecta")
    .reduce((acc, m) => acc + Number(m.impuesto || 0), 0);

  const ivaCredito = lista
    .filter((m) => m.tipo === "Gasto" && m.tipoDTE === "Factura Afecta")
    .reduce((acc, m) => acc + Number(m.impuesto || 0), 0);

  const balanceNeto = ingresosNetos - gastosNetos;
  const balanceIVA = ivaDebito - ivaCredito;

  const elIngresos = document.getElementById("resumen-ingresos-neto") || document.getElementById("resumen-ingresos");
  if (elIngresos) elIngresos.textContent = formatCLP(ingresosNetos);

  const elGastos = document.getElementById("resumen-gastos-neto") || document.getElementById("resumen-gastos");
  if (elGastos) elGastos.textContent = formatCLP(gastosNetos);
  
  const elIva = document.getElementById("resumen-iva");
  if (elIva) {
    elIva.textContent = formatCLP(balanceIVA);
    elIva.style.color = balanceIVA >= 0 ? "var(--color-error)" : "var(--color-success)";
  }

  const elBalance = document.getElementById("resumen-balance");
  if (elBalance) {
    elBalance.textContent = formatCLP(balanceNeto);
    elBalance.style.color = balanceNeto >= 0 ? "var(--color-success)" : "var(--color-error)";
  }
}