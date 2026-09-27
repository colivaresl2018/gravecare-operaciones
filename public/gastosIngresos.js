import {
  collection,
  getDocs,
  addDoc,
  doc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
import { app, db, auth } from "./firebaseConfig.js";
import { requireStaffAccess } from "./portal-common.js";

// Reutilizamos la MISMA app inicializada en firebaseConfig.js (donde vive la
// sesión autenticada). NO se llama a initializeApp() aquí — esa era la causa
// del error "Missing or insufficient permissions": crear una segunda
// instancia de Firebase sin sesión activa.
const storage = getStorage(app, "gs://gravecare-2e8d2.firebasestorage.app");

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
      selectCategoria.selectedIndex = 0;
    }
  }

  tipoFlujo.addEventListener("change", actualizarCategorias);
  actualizarCategorias();

  const hoy = new Date().toISOString().split("T")[0];
  document.getElementById("form-fecha").value = hoy;

  // Cálculo automático de IVA / Retención (conservado de tu versión más reciente)
  const selectDte = document.getElementById("form-dte");
  const inputNeto = document.getElementById("form-monto-neto");
  const inputImpuesto = document.getElementById("form-impuesto");
  const inputTotal = document.getElementById("form-total");
  const labelImpuesto = document.getElementById("label-impuesto");

  function recalcularValores() {
    const neto = Math.round(parseFloat(inputNeto.value) || 0);
    const dte = selectDte.value;
    let impuesto = 0;
    let total = neto;

    if (dte === "Factura Afecta") {
      labelImpuesto.textContent = "IVA Débito/Crédito (19%)";
      impuesto = Math.round(neto * 0.19);
      total = neto + impuesto;
    } else if (dte === "Boleta Honorarios") {
      labelImpuesto.textContent = "Retención SII (15.25%)";
      impuesto = Math.round(neto * 0.1525);
      total = neto - impuesto;
    } else {
      labelImpuesto.textContent = "Impuesto / Retención ($ 0)";
      impuesto = 0;
      total = neto;
    }

    inputImpuesto.value = impuesto;
    inputTotal.value = total;
  }

  if (selectDte) selectDte.addEventListener("change", recalcularValores);
  if (inputNeto) inputNeto.addEventListener("input", recalcularValores);

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

  // ============ DIAGNÓSTICO TEMPORAL — quitar una vez resuelto ============
  console.group("🔍 DIAGNÓSTICO gastos_ingresos");
  try {
    console.log("Archivo cargado: VERSIÓN FUSIONADA (fix Firebase + calculadora IVA)");
    console.log("auth.currentUser:", auth.currentUser);
    console.log("UID:", auth.currentUser?.uid);
    console.log("Email:", auth.currentUser?.email);
    console.log("app.options.projectId:", app.options.projectId);

    if (auth.currentUser) {
      const tokenResult = await auth.currentUser.getIdTokenResult();
      console.log("Token claims:", tokenResult.claims);

      try {
        const res = await fetch(
          `https://firestore.googleapis.com/v1/projects/${app.options.projectId}/databases/(default)/documents/gastos_ingresos`,
          { headers: { Authorization: `Bearer ${tokenResult.token}` } }
        );
        const bodyText = await res.text();
        console.log("REST directo — STATUS:", res.status);
        console.log("REST directo — BODY:", bodyText);
      } catch (restErr) {
        console.log("REST directo — FALLÓ LA PETICIÓN EN SÍ:", restErr);
      }
    } else {
      console.warn("⚠️ auth.currentUser es null — el usuario NO está autenticado según este objeto auth.");
    }
  } catch (diagErr) {
    console.log("Error dentro del bloque de diagnóstico:", diagErr);
  }
  console.groupEnd();
  // ============ FIN DIAGNÓSTICO TEMPORAL ============

  try {
    const snap = await getDocs(collection(db, "gastos_ingresos"));
    listaMovimientos = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    listaMovimientos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    aplicarFiltrosYRenderizar();
  } catch (err) {
    console.error("Error cargando movimientos:", err);
    console.error("Error CODE:", err.code);
    console.error("Error MESSAGE:", err.message);
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
