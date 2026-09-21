import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { 
  getFirestore,
  collection, 
  getDocs, 
  addDoc, 
  doc, 
  deleteDoc, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-storage.js";
import { requireStaffAccess } from "./portal-common.js";

const firebaseConfig = {
  apiKey: "AIzaSyAthgIWiVPDuscljVjQRAX-vIeUYLbrSC0",
  authDomain: "gravecare-2e8d2.firebaseapp.com",
  projectId: "gravecare-2e8d2",
  storageBucket: "gravecare-2e8d2.appspot.com",
  messagingSenderId: "160012946248",
  appId: "1:160012946248:web:8c3e73100f1e92c485c17d"
};

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { 
  getFirestore,
  collection, 
  getDocs, 
  addDoc, 
  doc, 
  deleteDoc, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-storage.js";
import { requireStaffAccess } from "./portal-common.js";

const firebaseConfig = {
  apiKey: "AIzaSyAthgIWiVPDuscljVjQRAX-vIeUYLbrSC0",
  authDomain: "gravecare-2e8d2.firebaseapp.com",
  projectId: "gravecare-2e8d2",
  storageBucket: "gravecare-2e8d2.appspot.com",
  messagingSenderId: "160012946248",
  appId: "1:160012946248:web:8c3e73100f1e92c485c17d"
};

let appActiva = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
// Conectamos explícitamente a la base de datos por defecto de tu proyecto en nam5
const db = getFirestore(appActiva, "(default)");
const storage = getStorage(appActiva, "gs://gravecare-2e8d2.appspot.com");

let listaMovimientos = [];
let graficoInstancia = null;

const CATEGORIAS_GASTO = [
  "Insumos y Materiales",
  "Combustible y Movilización",
  "Herramientas y Equipamiento",
  "Honorarios y Subcontratos",
  "Mantenimiento y Reparaciones",
  "Gastos Operacionales / Varios",
  "Administración y Oficina"
];

const CATEGORIAS_INGRESO = [
  "Planes y Suscripciones",
  "Servicios de Mantenimiento Extra",
  "Ornamentación Especial",
  "Otros Ingresos"
];

requireStaffAccess(async (user, staffProfile) => {
  inicializarFormulario();
  await cargarMovimientos();
  configurarFiltros();
}, "gastos-ingresos.html");

function inicializarFormulario() {
  const tipoFlujo = document.getElementById("form-tipo");
  const selectCategoria = document.getElementById("form-categoria");

function actualizarCategorias() {
    const esGasto = tipoFlujo.value === "Gasto";
    const categorias = esGasto ? CATEGORIAS_GASTO : CATEGORIAS_INGRESO;
    selectCategoria.innerHTML = categorias.map(c => `<option value="${c}">${c}</option>`).join("");
    if (selectCategoria.options.length > 0) {
      selectCategoria.selectedIndex = 0; // Selecciona por defecto la primera categoría
    }
  }

  tipoFlujo.addEventListener("change", actualizarCategorias);
  actualizarCategorias();

  const hoy = new Date().toISOString().split("T")[0];
  document.getElementById("form-fecha").value = hoy;

  document.getElementById("form-movimiento").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btnGuardar = document.getElementById("btn-guardar");
    btnGuardar.disabled = true;
    btnGuardar.textContent = "Subiendo respaldo y guardando...";

    try {
      const fileInput = document.getElementById("form-archivo-factura");
      let facturaUrl = "";

      if (fileInput && fileInput.files && fileInput.files[0]) {
        const archivo = fileInput.files[0];
        const anioMes = new Date().toISOString().slice(0, 7);
        const storagePath = `facturas_auditoria/${anioMes}/${Date.now()}_${archivo.name}`;
        
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, archivo);
        facturaUrl = await getDownloadURL(storageRef);
      }

      const nuevoMovimiento = {
        tipo: tipoFlujo.value,
        dte: document.getElementById("form-dte").value,
        folio: document.getElementById("form-folio").value.trim(),
        rut: document.getElementById("form-rut").value.trim(),
        contraparte: document.getElementById("form-concepto").value.trim(),
        fecha: document.getElementById("form-fecha").value,
        categoria: selectCategoria.value,
        clasificacionF22: document.getElementById("form-clasificacion-f22").value,
        descripcion: document.getElementById("form-descripcion").value.trim(),
        neto: parseFloat(document.getElementById("form-monto-neto").value) || 0,
        impuesto: parseFloat(document.getElementById("form-impuesto").value) || 0,
        total: parseFloat(document.getElementById("form-total").value) || 0,
        facturaUrl: facturaUrl,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, "gastos_ingresos"), nuevoMovimiento);

      alert("¡Movimiento registrado y factura guardada con éxito!");
      document.getElementById("form-movimiento").reset();
      document.getElementById("form-fecha").value = new Date().toISOString().split("T")[0];
      actualizarCategorias();

      btnGuardar.disabled = false;
      btnGuardar.textContent = "Registrar Movimiento y Guardar Respaldo";

      await cargarMovimientos();

    } catch (err) {
      console.error("Error al registrar movimiento:", err);
      alert("Error al procesar el registro: " + err.message);
      btnGuardar.disabled = false;
      btnGuardar.textContent = "Registrar Movimiento y Guardar Respaldo";
    }
  });
}

async function cargarMovimientos() {
  const tbody = document.getElementById("tabla-movimientos");
  tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 2rem; color: #64748b;">Cargando registros contables...</td></tr>';

  try {
    const snap = await getDocs(collection(db, "gastos_ingresos"));
    listaMovimientos = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    listaMovimientos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    aplicarFiltrosYRenderizar();
  } catch (err) {
    console.error("Error cargando movimientos:", err);
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 2rem; color: #dc2626;">Error al cargar datos de Firestore: ${err.message}</td></tr>`;
  }
}

function aplicarFiltrosYRenderizar() {
  const filtroTipo = document.getElementById("filtro-tipo").value;
  const filtroCategoria = document.getElementById("filtro-categoria").value;
  const filtroDesde = document.getElementById("filtro-desde").value;
  const filtroHasta = document.getElementById("filtro-hasta").value;

  const filtrados = listaMovimientos.filter(m => {
    if (filtroTipo && m.tipo !== filtroTipo) return false;
    if (filtroCategoria && m.categoria !== filtroCategoria) return false;
    if (filtroDesde && m.fecha < filtroDesde) return false;
    if (filtroHasta && m.fecha > filtroHasta) return false;
    return true;
  });

  renderTabla(filtrados);
  calcularResumen(filtrados);
  actualizarGrafico(filtrados);
}

function renderTabla(movimientos) {
  const tbody = document.getElementById("tabla-movimientos");

  if (movimientos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 2rem; color: #64748b;">No se encontraron movimientos registrados en la base de datos.</td></tr>';
    return;
  }

  tbody.innerHTML = movimientos.map(m => {
    const esGasto = m.tipo === "Gasto";
    const colorMonto = esGasto ? "color: #dc2626;" : "color: #16a34a;";
    const signo = esGasto ? "-" : "+";

    const badgeTipo = `<span style="font-size: 0.7rem; font-weight: 700; padding: 0.2rem 0.5rem; border-radius: 4px; background: ${esGasto ? '#fee2e2' : '#dcfce7'}; color: ${esGasto ? '#991b1b' : '#166534'};">${m.tipo.toUpperCase()}</span>`;

    const linkRespaldo = m.facturaUrl 
      ? `<a href="${m.facturaUrl}" target="_blank" style="color: #0284c7; font-weight: 600; text-decoration: underline;">📄 Ver Factura</a>` 
      : '<span style="color: #94a3b8;">Sin archivo</span>';

    return `
      <tr>
        <td>${m.fecha}</td>
        <td>${badgeTipo}<br><strong style="font-size:0.8rem;">${m.dte}</strong><br><span style="font-size:0.75rem; color: #64748b;">N° ${m.folio}</span></td>
        <td><strong>${m.contraparte}</strong><br><span style="font-size: 0.75rem; color: #64748b;">RUT: ${m.rut}</span></td>
        <td>${m.categoria}<br><span style="font-size: 0.7rem; background: #f1f5f9; padding: 0.1rem 0.3rem; border-radius: 3px;">${m.clasificacionF22 || 'N/A'}</span></td>
        <td style="text-align: right; font-family: monospace;">$ ${(m.neto || 0).toLocaleString("es-CL")}</td>
        <td style="text-align: right; font-family: monospace; color: #64748b;">$ ${(m.impuesto || 0).toLocaleString("es-CL")}</td>
        <td style="text-align: right; font-family: monospace; font-weight: 700; ${colorMonto}">${signo} $ ${(m.total || 0).toLocaleString("es-CL")}</td>
        <td style="text-align: right;">${linkRespaldo}</td>
        <td style="text-align: right;">
          <button type="button" data-id="${m.id}" class="btn-eliminar" style="background: none; border: none; color: #dc2626; cursor: pointer; font-size: 0.8rem; font-weight: 600;">Eliminar</button>
        </td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll(".btn-eliminar").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const id = e.target.getAttribute("data-id");
      if (confirm("¿Estás seguro de eliminar este registro contable?")) {
        try {
          await deleteDoc(doc(db, "gastos_ingresos", id));
          await cargarMovimientos();
        } catch (err) {
          console.error("Error al eliminar:", err);
          alert("No se pudo eliminar el registro.");
        }
      }
    });
  });
}

function calcularResumen(movimientos) {
  let ingresosNeto = 0;
  let gastosNeto = 0;
  let ivaDebito = 0;
  let ivaCredito = 0;

  movimientos.forEach(m => {
    if (m.tipo === "Ingreso") {
      ingresosNeto += (m.neto || 0);
      if (m.dte === "Factura Afecta") ivaDebito += (m.impuesto || 0);
    } else {
      gastosNeto += (m.neto || 0);
      if (m.dte === "Factura Afecta") ivaCredito += (m.impuesto || 0);
    }
  });

  const balanceIva = ivaDebito - ivaCredito;
  const resultadoNeto = ingresosNeto - gastosNeto;

  document.getElementById("resumen-ingresos-neto").textContent = `$ ${ingresosNeto.toLocaleString("es-CL")}`;
  document.getElementById("resumen-gastos-neto").textContent = `$ ${gastosNeto.toLocaleString("es-CL")}`;
  
  const elIva = document.getElementById("resumen-iva");
  elIva.textContent = `$ ${balanceIva.toLocaleString("es-CL")}`;
  elIva.style.color = balanceIva > 0 ? "#dc2626" : "#16a34a";

  const elBalance = document.getElementById("resumen-balance");
  elBalance.textContent = `$ ${resultadoNeto.toLocaleString("es-CL")}`;
  elBalance.style.color = resultadoNeto >= 0 ? "#16a34a" : "#dc2626";
}

function configurarFiltros() {
  const selectFiltroCat = document.getElementById("filtro-categoria");
  const todasCategorias = [...new Set([...CATEGORIAS_GASTO, ...CATEGORIAS_INGRESO])];
  selectFiltroCat.innerHTML = '<option value="">Todas las categorías</option>' + todasCategorias.map(c => `<option value="${c}">${c}</option>`).join("");

  document.getElementById("filtro-tipo").addEventListener("change", aplicarFiltrosYRenderizar);
  document.getElementById("filtro-categoria").addEventListener("change", aplicarFiltrosYRenderizar);
  document.getElementById("filtro-desde").addEventListener("change", aplicarFiltrosYRenderizar);
  document.getElementById("filtro-hasta").addEventListener("change", aplicarFiltrosYRenderizar);

  document.getElementById("btn-limpiar-filtros").addEventListener("click", () => {
    document.getElementById("filtro-tipo").value = "";
    document.getElementById("filtro-categoria").value = "";
    document.getElementById("filtro-desde").value = "";
    document.getElementById("filtro-hasta").value = "";
    aplicarFiltrosYRenderizar();
  });
}

function actualizarGrafico(movimientos) {
  const ctx = document.getElementById("grafico-comparativo").getContext("2d");
  const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  
  const datosIngresos = new Array(12).fill(0);
  const datosGastos = new Array(12).fill(0);

  movimientos.forEach(m => {
    if (!m.fecha) return;
    const mesIdx = new Date(m.fecha).getMonth();
    if (!isNaN(mesIdx)) {
      if (m.tipo === "Ingreso") datosIngresos[mesIdx] += (m.neto || 0);
      if (m.tipo === "Gasto") datosGastos[mesIdx] += (m.neto || 0);
    }
  });

  if (graficoInstancia) graficoInstancia.destroy();

  graficoInstancia = new Chart(ctx, {
    type: "bar",
    data: {
      labels: meses,
      datasets: [
        { label: "Ingresos Netos ($)", data: datosIngresos, backgroundColor: "#16a34a", borderRadius: 4 },
        { label: "Gastos Netos ($)", data: datosGastos, backgroundColor: "#dc2626", borderRadius: 4 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, grid: { color: "#e2e8f0" } },
        x: { grid: { display: false } }
      }
    }
  });
}