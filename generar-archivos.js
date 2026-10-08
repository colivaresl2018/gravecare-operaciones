const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
const jsDir = path.join(publicDir, 'js');

if (!fs.existsSync(jsDir)) {
  fs.mkdirSync(jsDir, { recursive: true });
}

// 1. Contenido de public/gastos-ingresos.html
const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Control Contable y Tributario | GraveCare</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"></script>
  <style>
    * { box-sizing: border-box; }
    body { background-color: #f8fafc; padding: 1.5rem; font-family: 'Plus Jakarta Sans', sans-serif; color: #1e293b; margin: 0; }
    .resumen-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
    @media (max-width: 900px) { .resumen-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 600px) { .resumen-grid { grid-template-columns: 1fr; } }
    .card { background: white; padding: 1.25rem; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .resumen-valor { font-size: 1.5rem; font-weight: 700; margin-top: 0.5rem; }
    .form-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; align-items: end; }
    @media (max-width: 900px) { .form-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 600px) { .form-grid { grid-template-columns: 1fr; } }
    .filtros-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 1rem; align-items: end; }
    @media (max-width: 900px) { .filtros-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 600px) { .filtros-grid { grid-template-columns: 1fr; } }
    .campo { display: flex; flex-direction: column; }
    .campo label { margin-bottom: 0.35rem; font-weight: 600; font-size: 0.8rem; color: #475569; }
    .campo input, .campo select { width: 100%; padding: 0.6rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 8px; font-family: inherit; background-color: #ffffff; font-size: 0.9rem; }
    .campo input:focus, .campo select:focus { outline: none; border-color: #002d1a; box-shadow: 0 0 0 3px rgba(0, 45, 26, 0.1); }
    .tax-box { grid-column: 1 / -1; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 10px; padding: 1rem; display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
    .btn-primary { background: #002d1a; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 8px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
    .btn-primary:hover { background: #1a432f; }
    .btn-secondary { background: #e2e8f0; color: #334155; border: none; padding: 0.6rem 1rem; border-radius: 8px; font-weight: 600; cursor: pointer; }
    .table-container { background: white; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    table { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem; }
    th { background: #f8fafc; border-bottom: 1px solid #e2e8f0; color: #475569; padding: 0.85rem 1rem; font-weight: 700; }
    td { padding: 0.85rem 1rem; border-bottom: 1px solid #f1f5f9; }
  </style>
</head>
<body>
  <main id="contenido-principal">
    <div style="margin-bottom: 1.5rem;">
      <h2 style="font-size: 1.5rem; font-weight: 800; color: #0f172a; margin: 0 0 0.25rem 0;">Control Contable y Tributario</h2>
      <p style="font-size: 0.85rem; color: #64748b; margin: 0;">Registro centralizado de compras, ventas, retenciones e IVA con respaldo documental para auditorías del SII.</p>
    </div>

    <section class="resumen-grid">
      <div class="card">
        <p style="font-size: 0.75rem; font-weight: 700; color: #64748b; text-transform: uppercase; margin: 0;">Ingresos Netos</p>
        <p id="resumen-ingresos-neto" class="resumen-valor" style="color: #16a34a;">$ 0</p>
      </div>
      <div class="card">
        <p style="font-size: 0.75rem; font-weight: 700; color: #64748b; text-transform: uppercase; margin: 0;">Gastos Deducibles (Neto)</p>
        <p id="resumen-gastos-neto" class="resumen-valor" style="color: #dc2626;">$ 0</p>
      </div>
      <div class="card">
        <p style="font-size: 0.75rem; font-weight: 700; color: #64748b; text-transform: uppercase; margin: 0;">Balance IVA (Débito - Crédito)</p>
        <p id="resumen-iva" class="resumen-valor" style="color: #0f172a;">$ 0</p>
      </div>
      <div class="card">
        <p style="font-size: 0.75rem; font-weight: 700; color: #64748b; text-transform: uppercase; margin: 0;">Resultado Operacional Neto</p>
        <p id="resumen-balance" class="resumen-valor" style="color: #16a34a;">$ 0</p>
      </div>
    </section>

    <section class="card" style="margin-bottom: 1.5rem;">
      <h3 style="font-size: 0.9rem; font-weight: 700; text-transform: uppercase; color: #334155; margin: 0 0 1rem 0;">Evolución de Ingresos y Gastos (Valores Netos)</h3>
      <div style="position: relative; height: 260px;">
        <canvas id="grafico-comparativo"></canvas>
      </div>
    </section>

    <section class="card" style="margin-bottom: 1.5rem;">
      <h3 style="font-size: 0.9rem; font-weight: 700; text-transform: uppercase; color: #334155; margin: 0 0 1rem 0;">Registro de Comprobante / Movimiento</h3>
      <form id="form-movimiento" class="form-grid">
        <div class="campo">
          <label for="form-tipo">Flujo Contable *</label>
          <select id="form-tipo" required>
            <option value="Gasto">Gasto / Egreso</option>
            <option value="Ingreso">Ingreso / Venta</option>
          </select>
        </div>
        <div class="campo">
          <label for="form-dte">Documento Tributario (DTE) *</label>
          <select id="form-dte" required>
            <option value="Factura Afecta">Factura Electrónica Afecta (IVA 19%)</option>
            <option value="Factura Exenta">Factura Electrónica Exenta</option>
            <option value="Boleta Honorarios">Boleta de Honorarios (Retención 15.25%)</option>
            <option value="Boleta Venta">Boleta Electrónica de Venta</option>
            <option value="Voucher/Comprobante">Comprobante de Pago / Voucher</option>
          </select>
        </div>
        <div class="campo">
          <label for="form-folio">N° Folio / N° Documento *</label>
          <input type="text" id="form-folio" placeholder="Ej: 14502" required>
        </div>
        <div class="campo">
          <label for="form-rut">RUT Contraparte / Proveedor *</label>
          <input type="text" id="form-rut" placeholder="76.123.456-7" required>
        </div>
        <div class="campo">
          <label for="form-concepto">Razón Social / Contraparte *</label>
          <input type="text" id="form-concepto" placeholder="Ej: Vivero Las Flores SpA" required>
        </div>
        <div class="campo">
          <label for="form-fecha">Fecha Emisión *</label>
          <input type="date" id="form-fecha" required>
        </div>
        <div class="campo">
          <label for="form-categoria">Categoría Operacional *</label>
          <select id="form-categoria" required></select>
        </div>
        <div class="campo">
          <label for="form-clasificacion-f22">Clasificación Tributaria (F22) *</label>
          <select id="form-clasificacion-f22" required>
            <option value="Gasto Deducible">Gasto Aceptado / Deducible</option>
            <option value="Activo Fijo">Inversión / Activo Fijo</option>
            <option value="Gasto No Deducible">Gasto Rechazado / No Deducible</option>
          </select>
        </div>
        <div class="campo">
          <label for="form-descripcion">Descripción / Glosa</label>
          <input type="text" id="form-descripcion" placeholder="Detalle adicional del servicio o compra">
        </div>
        <div class="tax-box">
          <div class="campo">
            <label for="form-monto-neto">Monto Neto ($ CLP) *</label>
            <input type="number" id="form-monto-neto" min="0" step="1" placeholder="0" required>
          </div>
          <div class="campo">
            <label for="form-impuesto" id="label-impuesto">IVA (19%)</label>
            <input type="number" id="form-impuesto" min="0" step="1" placeholder="0" required>
          </div>
          <div class="campo">
            <label for="form-total">Total Bruto ($ CLP)</label>
            <input type="number" id="form-total" min="0" step="1" placeholder="0" readonly style="background: #e2e8f0; font-weight: 700; cursor: not-allowed;">
          </div>
        </div>
        <div style="grid-column: 1 / -1; margin-top: 0.5rem;">
          <button id="btn-guardar" type="submit" class="btn-primary">Registrar Movimiento en el Libro Contable</button>
        </div>
      </form>
    </section>

    <section class="card" style="margin-bottom: 1.5rem;">
      <h3 style="font-size: 0.9rem; font-weight: 700; text-transform: uppercase; color: #334155; margin: 0 0 1rem 0;">Filtros de Búsqueda</h3>
      <div class="filtros-grid">
        <div class="campo">
          <label for="filtro-tipo">Tipo de Flujo</label>
          <select id="filtro-tipo">
            <option value="">Todos</option>
            <option value="Gasto">Gasto</option>
            <option value="Ingreso">Ingreso</option>
          </select>
        </div>
        <div class="campo">
          <label for="filtro-categoria">Categoría</label>
          <select id="filtro-categoria"></select>
        </div>
        <div class="campo">
          <label for="filtro-desde">Desde</label>
          <input type="date" id="filtro-desde">
        </div>
        <div class="campo">
          <label for="filtro-hasta">Hasta</label>
          <input type="date" id="filtro-hasta">
        </div>
        <div class="campo">
          <button id="btn-limpiar-filtros" type="button" class="btn-secondary" style="width: 100%;">Limpiar Filtros</button>
        </div>
      </div>
    </section>

    <div class="table-container">
      <div style="overflow-x: auto;">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>DTE / Folio</th>
              <th>Contraparte / RUT</th>
              <th>Categoría</th>
              <th style="text-align: right;">Neto</th>
              <th style="text-align: right;">IVA / Ret.</th>
              <th style="text-align: right;">Total</th>
              <th style="text-align: right;">Origen</th>
              <th style="text-align: right;">Acciones</th>
            </tr>
          </thead>
          <tbody id="tabla-movimientos">
            <tr><td colspan="9" style="text-align: center; padding: 2rem; color: #64748b;">Consolidando datos contables...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </main>

  <script type="module" src="js/gastosIngresos.js?v=20261005_final_v1"></script>
</body>
</html>`;

// 2. Contenido de public/js/gastosIngresos.js
const jsContent = `import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
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
    const esGasto = tipoFlujo.value === "Gasto";
    const categorias = esGasto ? CATEGORIAS_GASTO : CATEGORIAS_INGRESO;
    selectCategoria.innerHTML = categorias.map(c => '<option value="' + c + '">' + c + '</option>').join("");
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

  document.getElementById("form-movimiento").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btnGuardar = document.getElementById("btn-guardar");
    btnGuardar.disabled = true;
    btnGuardar.textContent = "Registrando...";

    try {
      const nuevoMov = {
        tipo: tipoFlujo.value,
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

  // 1. Leer gastos_ingresos
  try {
    const snapGI = await getDocs(collection(db, "gastos_ingresos"));
    snapGI.forEach(d => {
      const data = d.data();
      idsRegistrados.add(d.id);
      if (data.folio) foliosRegistrados.add(String(data.folio).trim());

      unificados.push({
        id: d.id,
        tipo: data.tipo || "Gasto",
        dte: data.dte || "Voucher/Comprobante",
        folio: data.folio || d.id.substring(0, 8),
        contraparte: data.contraparte || data.proveedor || "GraveCare SpA",
        rut: data.rut || "77.126.383-6",
        categoria: data.categoria || "Gastos Operacionales / Varios",
        clasificacionF22: data.clasificacionF22 || "Gasto Deducible",
        neto: Number(data.neto) || 0,
        impuesto: Number(data.impuesto) || 0,
        total: Number(data.total) || 0,
        fecha: normalizarFecha(data.fecha || data.createdAt),
        esDeOrden: data.origen === "Auto (Orden)" || Boolean(data.esDeOrden)
      });
    });
  } catch (e) {
    console.warn("Aviso gastos_ingresos:", e.message);
  }

  // 2. Leer ordenes
  try {
    const snapOrd = await getDocs(collection(db, "ordenes"));
    snapOrd.forEach(d => {
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
      const nombreCliente = titular.nombreCompleto || titular.nombre || titular.nombres || ord.emailCliente || (difunto ? 'Familiar de ' + difunto : "Cliente Web");
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
    snapPagos.forEach(d => {
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

  listaMovimientos = unificados.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  aplicarFiltrosYRenderizar();
}

function aplicarFiltrosYRenderizar() {
  const fTipo = document.getElementById("filtro-tipo").value;
  const fCat = document.getElementById("filtro-categoria").value;
  const fDesde = document.getElementById("filtro-desde").value;
  const fHasta = document.getElementById("filtro-hasta").value;

  const filtrados = listaMovimientos.filter(m => {
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

  tbody.innerHTML = movimientos.map(m => {
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

  tbody.querySelectorAll(".btn-eliminar").forEach(btn => {
    btn.addEventListener("click", async (e) => {
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

  movimientos.forEach(m => {
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

function configurarFiltros() {
  const selectFiltroCat = document.getElementById("filtro-categoria");
  const todasCategorias = [...new Set([...CATEGORIAS_GASTO, ...CATEGORIAS_INGRESO])];
  selectFiltroCat.innerHTML = '<option value="">Todas las categorías</option>' + todasCategorias.map(c => '<option value="' + c + '">' + c + '</option>').join("");

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
  const canvasEl = document.getElementById("grafico-comparativo");
  if (!canvasEl) return;
  const ctx = canvasEl.getContext("2d");
  const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

  const datosIngresos = new Array(12).fill(0);
  const datosGastos = new Array(12).fill(0);

  movimientos.forEach(m => {
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

inicializarFormulario();
configurarFiltros();
cargarMovimientos();
`;

fs.writeFileSync(path.join(publicDir, 'gastos-ingresos.html'), htmlContent, 'utf8');
fs.writeFileSync(path.join(jsDir, 'gastosIngresos.js'), jsContent, 'utf8');

console.log('✓ Archivos creados e integrados con éxito en public/ y public/js/');
