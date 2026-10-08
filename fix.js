const fs = require("fs");
const path = require("path");

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
          <input type="text" id="form-descripcion" placeholder="Detalle adicional">
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

  <script type="module" src="js/gastosIngresos.js?v=2026_final_fix"></script>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, "public", "gastos-ingresos.html"), htmlContent, "utf8");
console.log("OK: public/gastos-ingresos.html generado exitosamente");
