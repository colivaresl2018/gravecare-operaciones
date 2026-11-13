import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

/**
 * Carga, consolida y calcula las métricas contables de Ingresos, Gastos e IVA
 * para el período seleccionado en Gravecare SpA.
 */
async function actualizarPanelContable(db, mesSeleccionado, anioSeleccionado) {
  try {
    let totalIngresosNetos = 0;
    let totalGastosNetos = 0;
    let ivaDebitoTotal = 0;
    let ivaCreditoTotal = 0;

    // 1. Consultar la colección de Gastos e Ingresos manuales / facturas de proveedores
    const snapGastosIngresos = await getDocs(collection(db, "gastos_ingresos"));
    
    snapGastosIngresos.forEach(docSnap => {
      const data = docSnap.data();
      const fechaDoc = data.fecha || ""; // Formato "AAAA-MM-DD"
      
      // Validar si el registro corresponde al año seleccionado (filtro básico por periodo)
      if (fechaDoc && fechaDoc.startsWith(String(anioSeleccionado))) {
        const neto = Number(data.neto || 0);
        const iva = Number(data.iva || data.impuesto || 0);
        const tipoFlujo = (data.tipoFlujo || data.categoria || "").toLowerCase();

        // Identificar si es un ingreso manual o un gasto/egreso
        if (tipoFlujo.includes("ingreso") || tipoFlujo.includes("venta")) {
          totalIngresosNetos += neto;
          ivaDebitoTotal += iva;
        } else {
          // Todo lo demás se trata como gasto deducible / egreso
          totalGastosNetos += neto;
          ivaCreditoTotal += iva;
        }
      }
    });

    // 2. Consultar y sumar automáticamente los ingresos de las Órdenes de Servicio Pagadas
    const snapOrdenes = await getDocs(collection(db, "ordenes"));

    snapOrdenes.forEach(docSnap => {
      const orden = docSnap.data();
      // Verificar si la orden está pagada efectivamente
      const estaPagada = orden.pagoConfirmado === true || 
                         (orden.estado || "").toLowerCase() === "pagado" || 
                         (orden.estado || "").toLowerCase() === "aprobado";

      if (estaPagada) {
        // Extraer la fecha de la orden (creadaEn o fecha de pago)
        let fechaOrdenStr = "";
        if (orden.creadoEn) {
          // Manejar Timestamp de Firestore o string
          const fechaObj = typeof orden.creadoEn.toDate === 'function' ? orden.creadoEn.toDate() : new Date(orden.creadoEn);
          fechaOrdenStr = fechaObj.toISOString();
        }

        // Si pertenece al año seleccionado, se contabiliza
        if (!fechaOrdenStr || fechaOrdenStr.startsWith(String(anioSeleccionado))) {
          const montoTotal = Number(orden.montoTotal || orden.total || orden.monto || 0);
          
          // Desglosar Neto e IVA (19% en Chile) de la orden de servicio
          const netoOrden = Math.round(montoTotal / 1.19);
          const ivaOrden = montoTotal - netoOrden;

          totalIngresosNetos += netoOrden;
          ivaDebitoTotal += ivaOrden;
        }
      }
    });

    // 3. Calcular Resultados Operacionales y Balance de IVA
    const resultadoOperacional = totalIngresosNetos - totalGastosNetos;
    const balanceIvaAcumulado = ivaDebitoTotal - ivaCreditoTotal;

    // 4. Inyectar los valores calculados en los elementos visuales del DOM
    const elIngresos = document.getElementById("txt-ingresos-netos") || document.getElementById("ingresosNetosVal");
    const elGastos = document.getElementById("txt-gastos-netos") || document.getElementById("gastosNetosVal");
    const elBalanceIva = document.getElementById("txt-balance-iva") || document.getElementById("balanceIvaVal");
    const elResultadoOp = document.getElementById("txt-resultado-operacional") || document.getElementById("resultadoOpVal");
    const elIvaMes = document.getElementById("txt-iva-mes") || document.getElementById("ivaMesVal");

    if (elIngresos) elIngresos.textContent = `$${totalIngresosNetos.toLocaleString("es-CL")}`;
    if (elGastos) elGastos.textContent = `$${totalGastosNetos.toLocaleString("es-CL")}`;
    if (elBalanceIva) elBalanceIva.textContent = `$${balanceIvaAcumulado.toLocaleString("es-CL")}`;
    if (elResultadoOp) elResultadoOp.textContent = `$${resultadoOperacional.toLocaleString("es-CL")}`;
    if (elIvaMes) elIvaMes.textContent = `$${(balanceIvaAcumulado >= 0 ? balanceIvaAcumulado : 0).toLocaleString("es-CL")}`;

  } catch (error) {
    console.error("Error al actualizar el panel contable de ingresos y gastos:", error);
  }
}