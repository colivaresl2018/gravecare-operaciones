import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, doc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAthgIWiVPDuscljVjQRAX-vIeUYLbrSC0",
  authDomain: "gravecare-2e8d2.firebaseapp.com",
  projectId: "gravecare-2e8d2",
  storageBucket: "gravecare-2e8d2.firebasestorage.app",
  messagingSenderId: "160012946248",
  appId: "1:160012946248:web:8c3e73100f1e92c485c17d"
};

const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

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

function normalizarFecha(val) {
  if (!val) return new Date().toISOString().split("T")[0];
  if (typeof val === "string") {
    if (val.length >= 10 && val.includes("-")) return val.substring(0, 10);
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
    return val;
  }
  if (val && typeof val.toDate === "function") {
    return val.toDate().toISOString().split("T")[0];
  }
  if (val instanceof Date) {
    return val.toISOString().split("T")[0];
  }
  return new Date().toISOString().split("T")[0];
}

function inicializarFormulario() {
  const tipoFlujo = document.getElementById("form-tipo");
  const selectCategoria = document.getElementById("form-categoria");

  function actualizarCategorias() {
    const esGasto = (tipoFlujo.value || "").toLowerCase().includes("gasto");
    const categorias = esGasto ? CATEGORIAS_GASTO : CATEGORIAS_INGRESO;
    selectCategoria.innerHTML = categorias.map(function(c) {
      return '<option value="' + c + '">' + c + '</option>';
    }).join("");
    if (selectCategoria.options.length > 0) selectCategoria.selectedIndex = 0;
  }

  tipoFlujo.addEventListener("change", actualizarCategorias);
  actualizarCategorias();

  document.getElementById("form-fecha").value = new Date().toISOString().split("T")[0];

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

  selectDte.addEventListener("change", recalcularValores);
  inputNeto.addEventListener("input", recalcularValores);

  document.getElementById("form-movimiento").addEventListener("submit", async function(e) {
    e.preventDefault();
    const btnGuardar = document.getElementById("btn-guardar");
    btnGuardar.disabled = true;
    btnGuardar.textContent = "Registrando...";

    try {
      const nuevoMov = {
        tipo: tipoFlujo.value.includes("Gasto") ? "Gasto" : "Ingreso",
        dte: selectDte.value,
        folio: document.getElementById("form-folio").value.trim(),
        rut: document.getElementById("form-rut").value.trim(),
        contraparte: document.getElementById("form-concepto").value.trim(),
        fecha: document.getElementById("form-fecha").value,
        categoria: selectCategoria.value,
        clasificacionF22: document.getElementById("form-clasificacion-f22").value,
        descripcion: document.getElementById("form-descripcion").value.trim(),
        neto: parseFloat(inputNeto.value) || 0,
        impuesto: parseFloat(inputImpuesto.value) || 0,
        total: parseFloat(inputTotal.value) || 0,
        origen: "Manual",
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, "gastos_ingresos"), nuevoMov);
      alert("✓ Movimiento registrado correctamente.");
      document.getElementById("form-movimiento").reset();
      document.getElementById("form-fecha").value = new Date().toISOString().split("T")[0];
      actualizarCategorias();
      btnGuardar.disabled = false;
      btnGuardar.textContent = "Registrar Movimiento en el Libro Contable";
      await cargarMovimientos();

    } catch (err) {
      console.error("Error al registrar:", err);
      alert("Error: " + err.message);
      btnGuardar.disabled = false;
      btnGuardar.textContent = "Registrar Movimiento en el Libro Contable";
    }
  });
}

async function cargarMovimientos() {
  const tbody = document.getElementById("tabla-movimientos");
  tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 2rem; color: #64748b;">Consolidando datos contables...</td></tr>';

  const unificados = [];
  const foliosRegistrados = new Set();
  const idsRegistrados = new Set();

  function procesarDocGastoIngreso(d, defaultTipo) {
    const data = d.data();
    idsRegistrados.add(d.id);
    if (data.folio) foliosRegistrados.add(String(data.folio).trim());

    // Determinar si es Gasto o Ingreso de forma robusta
    let tipo = defaultTipo || "Gasto";
    const rawTipo = String(data.tipo || data.tipoFlujo || "").toLowerCase();
    if (rawTipo.includes("ingreso") || rawTipo.includes("venta")) {
      tipo = "Ingreso";
    } else if (rawTipo.includes("gasto") || rawTipo.includes("egreso") || rawTipo.includes("compra")) {
      tipo = "Gasto";
    }

    // Normalizar montos (neto, impuesto y total)
    let total = Number(data.total || data.totalBruto || data.montoTotal || data.monto || data.valor || 0);
    let neto = Number(data.neto || data.montoNeto || data.monto_neto || data.totalNeto || 0);
    let impuesto = Number(data.impuesto || data.iva || data.retencion || 0);

    if (neto === 0 && total > 0) {
      if (data.dte === "Factura Afecta") {
        neto = Math.round(total / 1.19);
        impuesto = total - neto;
      } else {
        neto = total;
      }
    } else if (total === 0 && neto > 0) {
      total = neto + impuesto;
    }

    unificados.push({
      id: d.id,
      tipo: tipo,
      dte: data.dte || "Voucher/Comprobante",
      folio: data.folio || d.id.substring(0, 8),
      contraparte: data.contraparte || data.proveedor || data.razonSocial || data.cliente || "GraveCare SpA",
      rut: data.rut || data.rutProveedor || "77.126.383-6",
      categoria: data.categoria || "Gastos Operacionales / Varios",
      clasificacionF22: data.clasificacionF22 || "Gasto Deducible",
      neto: neto,
      impuesto: impuesto,
      total: total,
      fecha: normalizarFecha(data.fecha || data.fechaEmision || data.createdAt),
      esDeOrden: data.origen === "Auto (Orden)" || Boolean(data.esDeOrden)
    });
  }

  // 1. Leer gastos_ingresos
  try {
    const snapGI = await getDocs(collection(db, "gastos_ingresos"));
    snapGI.forEach(function(d) {
      procesarDocGastoIngreso(d, null);
    });
  } catch (e) {
    console.warn("Aviso gastos_ingresos:", e.message);
  }

  // 1.b Leer coleccion alternativa 'gastos' si existe
  try {
    const snapGastos = await getDocs(collection(db, "gastos"));
    snapGastos.forEach(function(d) {
      if (!idsRegistrados.has(d.id)) {
        procesarDocGastoIngreso(d, "Gasto");
      }
    });
  } catch (e) {
    // Si no existe, no interrumpe
  }

  // 2. Leer ordenes (Ingresos Webpay)
  try {
    const snapOrd = await getDocs(collection(db, "ordenes"));
    snapOrd.forEach(function(d) {
      const ord = d.data();
      const numOrden = String(ord.numeroOrden || d.id).trim();

      if (foliosRegistrados.has(numOrden) || idsRegistrados.has(d.id)) return;

      const totalBruto = Number(ord.precioNumerico || ord.montoTotal || ord.valores?.total || ord.monto || 0);
      if (totalBruto <= 0 && !ord.transbankToken && !ord.buyOrder) return;

      foliosRegistrados.add(numOrden);
      idsRegistrados.add(d.id);

      const montoFinal = totalBruto || 38990;
      const neto = Math.round(montoFinal / 1.19);
      const iva = montoFinal - neto;

      const titular = ord.titular || {};
      const difunto = ord.difunto?.nombre || [ord.difunto?.nombres, ord.difunto?.apellidoPaterno].filter(Boolean).join(" ") || ord.nombreFallecido || "";
      const nombreCliente = titular.nombreCompleto || titular.nombre || titular.nombres || ord.emailCliente || (difunto ? ("Familiar de " + difunto) : "Cliente Web");
      const rutCliente = titular.rut || titular.rutDni || ord.rut || "S/I";
      const fechaRaw = ord.createdAt || ord.creadoEl || ord.fechaCreacion || ord.fecha;

      unificados.push({
        id: d.id,
        tipo: "Ingreso",
        dte: "Venta Webpay/Online",
        folio: numOrden,
        contraparte: nombreCliente,
        rut: rutCliente,
        categoria: "Planes y Suscripciones",
        clasificacionF22: "Ingreso Operacional",
        neto: neto,
        impuesto: iva,
        total: montoFinal,
        fecha: normalizarFecha(fechaRaw),
        esDeOrden: true
      });
    });
  } catch (e) {
    console.warn("Aviso ordenes:", e.message);
  }

  // 3. Leer pagos
  try {
    const snapPagos = await getDocs(collection(db, "pagos"));
    snapPagos.forEach(function(d) {
      const pago = d.data();
      const txFolio = String(pago.buyOrder || pago.transactionId || pago.numeroOrden || d.id).trim();

      if (foliosRegistrados.has(txFolio) || idsRegistrados.has(d.id)) return;

      const montoPago = Number(pago.monto || pago.amount || 0);
      if (montoPago > 0) {
        foliosRegistrados.add(txFolio);
        idsRegistrados.add(d.id);

        const neto = Math.round(montoPago / 1.19);
        const iva = montoPago - neto;

        unificados.push({
          id: d.id,
          tipo: "Ingreso",
          dte: "Venta Webpay/Online",
          folio: txFolio,
          contraparte: pago.datosCliente?.nombre || pago.email || "Cliente Webpay",
          rut: pago.datosCliente?.rut || "S/I",
          categoria: "Planes y Suscripciones",
          clasificacionF22: "Ingreso Operacional",
          neto: neto,
          impuesto: iva,
          total: montoPago,
          fecha: normalizarFecha(pago.fecha || pago.createdAt),
          esDeOrden: true
        });
      }
    });
  } catch (e) {
    console.warn("Aviso pagos:", e.message);
  }

  listaMovimientos = unificados.sort(function(a, b) {
    return new Date(b.fecha) - new Date(a.fecha);
  });
  aplicarFiltrosYRenderizar();
}

function aplicarFiltrosYRenderizar() {
  const fTipo = document.getElementById("filtro-tipo").value;
  const fCat = document.getElementById("filtro-categoria").value;
  const fDesde = document.getElementById("filtro-desde").value;
  const fHasta = document.getElementById("filtro-hasta").value;

  const filtrados = listaMovimientos.filter(function(m) {
    if (fTipo && m.tipo !== fTipo) return false;
    if (fCat && m.categoria !== fCat) return false;
    if (fDesde && m.fecha < fDesde) return false;
    if (fHasta && m.fecha > fHasta) return false;
    return true;
  });

  renderTabla(filtrados);
  calcularResumen(filtrados);
  actualizarGrafico(filtrados);
}

function renderTabla(movimientos) {
  const tbody = document.getElementById("tabla-movimientos");

  if (movimientos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 2rem; color: #64748b;">No se encontraron movimientos registrados con los filtros aplicados.</td></tr>';
    return;
  }

  tbody.innerHTML = movimientos.map(function(m) {
    const esGasto = m.tipo === "Gasto";
    const colorMonto = esGasto ? "color: #dc2626;" : "color: #16a34a;";
    const signo = esGasto ? "-" : "+";

    const badgeTipo = '<span style="font-size: 0.7rem; font-weight: 700; padding: 0.2rem 0.5rem; border-radius: 4px; background: ' + (esGasto ? '#fee2e2' : '#dcfce7') + '; color: ' + (esGasto ? '#991b1b' : '#166534') + ';">' + m.tipo.toUpperCase() + '</span>';

    const celdaAcciones = m.esDeOrden
      ? '<span style="font-size: 0.75rem; color: #94a3b8; font-style: italic;">Auto (Orden)</span>'
      : '<button type="button" data-id="' + m.id + '" class="btn-eliminar" style="background: none; border: none; color: #dc2626; cursor: pointer; font-size: 0.8rem; font-weight: 600;">Eliminar</button>';

    return '<tr>' +
      '<td>' + m.fecha + '</td>' +
      '<td>' + badgeTipo + '<br><strong style="font-size:0.8rem;">' + m.dte + '</strong><br><span style="font-size:0.75rem; color: #64748b;">N° ' + m.folio + '</span></td>' +
      '<td><strong>' + m.contraparte + '</strong><br><span style="font-size: 0.75rem; color: #64748b;">RUT: ' + m.rut + '</span></td>' +
      '<td>' + m.categoria + '<br><span style="font-size: 0.7rem; background: #f1f5f9; padding: 0.1rem 0.3rem; border-radius: 3px;">' + (m.clasificacionF22 || 'N/A') + '</span></td>' +
      '<td style="text-align: right; font-family: monospace;">$ ' + (m.neto || 0).toLocaleString("es-CL") + '</td>' +
      '<td style="text-align: right; font-family: monospace; color: #64748b;">$ ' + (m.impuesto || 0).toLocaleString("es-CL") + '</td>' +
      '<td style="text-align: right; font-family: monospace; font-weight: 700; ' + colorMonto + '">' + signo + ' $ ' + (m.total || 0).toLocaleString("es-CL") + '</td>' +
      '<td style="text-align: right; font-size: 0.75rem; color: #64748b;">' + (m.esDeOrden ? 'Webpay' : 'Manual') + '</td>' +
      '<td style="text-align: right;">' + celdaAcciones + '</td>' +
    '</tr>';
  }).join("");

  tbody.querySelectorAll(".btn-eliminar").forEach(function(btn) {
    btn.addEventListener("click", async function(e) {
      const id = e.target.getAttribute("data-id");
      if (confirm("¿Estás seguro de eliminar este registro contable manual?")) {
        try {
          await deleteDoc(doc(db, "gastos_ingresos", id));
          await cargarMovimientos();
        } catch (err) {
          alert("No se pudo eliminar: " + err.message);
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

  movimientos.forEach(function(m) {
    if (m.tipo === "Ingreso") {
      ingresosNeto += (m.neto || 0);
      ivaDebito += (m.impuesto || 0);
    } else {
      gastosNeto += (m.neto || 0);
      if (m.dte === "Factura Afecta") {
        ivaCredito += (m.impuesto || 0);
      }
    }
  });

  const balanceIva = ivaDebito - ivaCredito;
  const resultadoNeto = ingresosNeto - gastosNeto;

  document.getElementById("resumen-ingresos-neto").textContent = "$ " + ingresosNeto.toLocaleString("es-CL");
  document.getElementById("resumen-gastos-neto").textContent = "$ " + gastosNeto.toLocaleString("es-CL");

  const elIva = document.getElementById("resumen-iva");
  elIva.textContent = "$ " + balanceIva.toLocaleString("es-CL");
  elIva.style.color = balanceIva > 0 ? "#dc2626" : "#16a34a";

  const elBalance = document.getElementById("resumen-balance");
  elBalance.textContent = "$ " + resultadoNeto.toLocaleString("es-CL");
  elBalance.style.color = resultadoNeto >= 0 ? "#16a34a" : "#dc2626";
}

function actualizarGrafico(movimientos) {
  const canvasEl = document.getElementById("grafico-comparativo");
  if (!canvasEl) return;
  const ctx = canvasEl.getContext("2d");
  const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

  const datosIngresos = new Array(12).fill(0);
  const datosGastos = new Array(12).fill(0);

  movimientos.forEach(function(m) {
    if (!m.fecha) return;
    const mesIdx = new Date(m.fecha).getMonth();
    if (!isNaN(mesIdx) && mesIdx >= 0 && mesIdx < 12) {
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

function configurarFiltros() {
  const selectFiltroCat = document.getElementById("filtro-categoria");
  const todasCategorias = [...new Set([...CATEGORIAS_GASTO, ...CATEGORIAS_INGRESO])];
  selectFiltroCat.innerHTML = '<option value="">Todas las categorías</option>' + todasCategorias.map(function(c) {
    return '<option value="' + c + '">' + c + '</option>';
  }).join("");

  document.getElementById("filtro-tipo").addEventListener("change", aplicarFiltrosYRenderizar);
  document.getElementById("filtro-categoria").addEventListener("change", aplicarFiltrosYRenderizar);
  document.getElementById("filtro-desde").addEventListener("change", aplicarFiltrosYRenderizar);
  document.getElementById("filtro-hasta").addEventListener("change", aplicarFiltrosYRenderizar);

  document.getElementById("btn-limpiar-filtros").addEventListener("click", function() {
    document.getElementById("filtro-tipo").value = "";
    document.getElementById("filtro-categoria").value = "";
    document.getElementById("filtro-desde").value = "";
    document.getElementById("filtro-hasta").value = "";
    aplicarFiltrosYRenderizar();
  });
}

inicializarFormulario();
configurarFiltros();
cargarMovimientos();