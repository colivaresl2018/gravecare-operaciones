/**
 * facturaOcr.js
 * Extracción REAL de datos desde facturas/boletas chilenas (PDF o imagen).
 *
 * Estrategia:
 *  1) Si es PDF: intenta leer el texto nativo con pdf.js (rápido y exacto,
 *     funciona en la mayoría de las facturas electrónicas SII que traen
 *     texto seleccionable).
 *  2) Si el PDF no trae texto (factura escaneada/fotografiada) o si el
 *     archivo es una imagen: renderiza y aplica OCR real con Tesseract.js
 *     (idioma español).
 *  3) El texto resultante se analiza con expresiones regulares ajustadas
 *     al formato típico de DTE chilenos (RUT, Folio, Fecha, Montos).
 *
 * Es una extracción heurística: siempre debe revisarse antes de guardar.
 */

const PDFJS_VERSION = "3.11.174";
const TESSERACT_VERSION = "5";

let pdfjsLibPromise = null;
let tesseractPromise = null;

function cargarScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "true") return resolve();
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", reject);
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => {
      s.dataset.loaded = "true";
      resolve();
    };
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function obtenerPdfjs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = (async () => {
      if (!window.pdfjsLib) {
        await cargarScript(`https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.js`);
      }
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.js`;
      return window.pdfjsLib;
    })();
  }
  return pdfjsLibPromise;
}

async function obtenerTesseract() {
  if (!tesseractPromise) {
    tesseractPromise = (async () => {
      if (!window.Tesseract) {
        await cargarScript(`https://cdn.jsdelivr.net/npm/tesseract.js@${TESSERACT_VERSION}/dist/tesseract.min.js`);
      }
      return window.Tesseract;
    })();
  }
  return tesseractPromise;
}

/** Extrae el texto nativo (seleccionable) de la primera página de un PDF. */
async function extraerTextoPdf(file) {
  const pdfjsLib = await obtenerPdfjs();
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  let textoCompleto = "";
  const paginasARevisar = Math.min(pdf.numPages, 2); // folio/montos casi siempre están en pág. 1-2
  for (let i = 1; i <= paginasARevisar; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    textoCompleto += content.items.map((it) => it.str).join(" ") + "\n";
  }
  return { texto: textoCompleto.trim(), pdf };
}

/** Renderiza la página 1 de un PDF a un canvas de alta resolución para OCR. */
async function renderizarPaginaComoImagen(pdf, escala = 2.5) {
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: escala });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

/** Corre OCR real (Tesseract, español) sobre una imagen, canvas o PDF-imagen. */
async function ocrImagen(origen, onStatus) {
  const Tesseract = await obtenerTesseract();
  const resultado = await Tesseract.recognize(origen, "spa", {
    logger: (m) => {
      if (m.status === "recognizing text" && onStatus) {
        onStatus(`🔍 Aplicando OCR... ${Math.round((m.progress || 0) * 100)}%`);
      }
    },
  });
  return resultado.data.text;
}

/** Normaliza número tipo "1.234.567" o "1234567,50" a Number. */
function parseMontoCLP(str) {
  if (!str) return null;
  const limpio = str.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "");
  const n = parseFloat(limpio);
  return isNaN(n) ? null : Math.round(n);
}

/** Convierte dd/mm/yyyy o dd-mm-yyyy a yyyy-mm-dd (formato <input type="date">). */
function parseFechaCL(str) {
  if (!str) return null;
  const m = str.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (!m) return null;
  let [, d, mo, y] = m;
  if (y.length === 2) y = "20" + y;
  d = d.padStart(2, "0");
  mo = mo.padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

/** Analiza el texto extraído y arma el objeto con los campos del formulario. */
function analizarTextoFactura(textoOriginal) {
  const texto = textoOriginal.replace(/\s+/g, " ").trim();
  const textoUpper = texto.toUpperCase();
  const datos = {
    tipoDte: null,
    folio: null,
    rut: null,
    razonSocial: null,
    fecha: null,
    montoNeto: null,
    iva: null,
    total: null,
  };

  // --- Tipo de documento ---
  if (/BOLETA[S]?\s+DE\s+HONORARIOS/.test(textoUpper)) {
    datos.tipoDte = "Boleta Honorarios";
  } else if (/FACTURA[S]?\s+ELECTR[ÓO]NICA[S]?\s+EXENTA/.test(textoUpper) || /FACTURA\s+EXENTA/.test(textoUpper)) {
    datos.tipoDte = "Factura Exenta";
  } else if (/FACTURA/.test(textoUpper)) {
    datos.tipoDte = "Factura Afecta";
  } else if (/BOLETA/.test(textoUpper)) {
    datos.tipoDte = "Boleta Venta";
  }

  // --- Folio ---
  let m =
    texto.match(/FOLIO\s*N?[°º]?\s*:?\s*(\d{2,10})/i) ||
    texto.match(/N[°º]\s*(\d{2,10})/) ;
  if (m) datos.folio = m[1];

  // --- RUT (primer RUT del documento = normalmente el emisor/proveedor) ---
  m = texto.match(/(\d{1,2}\.?\d{3}\.?\d{3}-[\dkK])/);
  if (m) {
    // Normaliza a formato XX.XXX.XXX-X
    const limpio = m[1].replace(/\./g, "");
    const [cuerpo, dv] = limpio.split("-");
    const cuerpoFmt = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    datos.rut = `${cuerpoFmt}-${dv.toUpperCase()}`;
  }

  // --- Razón Social ---
  // Caso 1: el documento la etiqueta explícitamente.
  m = texto.match(/RAZ[ÓO]N\s+SOCIAL\s*:?\s*([A-ZÁÉÍÓÚÑ0-9&.,\-\s]{4,60})/i);
  if (m) {
    datos.razonSocial = m[1].trim().replace(/\s{2,}/g, " ");
  } else {
    // Caso 2 (muy común en DTE chilenos): el nombre del emisor va suelto al
    // inicio del documento, seguido de la línea "Giro: ...". Tomamos el
    // fragmento de texto antes de la primera aparición de "Giro".
    const idxGiro = texto.search(/\bGIRO\b/i);
    if (idxGiro > 0 && idxGiro < 300) {
      const candidato = texto.slice(0, idxGiro).trim().replace(/\s{2,}/g, " ");
      if (candidato.length >= 4 && candidato.length <= 80) {
        datos.razonSocial = candidato;
      }
    }
  }

  // --- Fecha de emisión ---
  const MESES = {
    enero: "01", febrero: "02", marzo: "03", abril: "04", mayo: "05", junio: "06",
    julio: "07", agosto: "08", septiembre: "09", setiembre: "09", octubre: "10",
    noviembre: "11", diciembre: "12",
  };
  // Formato escrito: "Fecha Emisión 11 de septiembre de 2026"
  m = texto.match(/FECHA\s+EMISI[ÓO]N\s*:?\s*(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+de\s+(\d{4})/i);
  if (m) {
    const [, dia, mesTexto, anio] = m;
    const mesNum = MESES[mesTexto.toLowerCase()];
    if (mesNum) datos.fecha = `${anio}-${mesNum}-${dia.padStart(2, "0")}`;
  }
  // Formato numérico: "Fecha Emisión: 11/09/2026" o "Fecha: 11-09-2026"
  if (!datos.fecha) {
    m =
      texto.match(/FECHA\s+EMISI[ÓO]N\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i) ||
      texto.match(/FECHA\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
    if (m) datos.fecha = parseFechaCL(m[1]);
  }

  // --- Montos: Neto, IVA, Total ---
  m = texto.match(/MONTO\s+NETO\s*\$?\s*([\d.,]+)/i) || texto.match(/\bNETO\s*\$?\s*([\d.,]+)/i);
  if (m) datos.montoNeto = parseMontoCLP(m[1]);

  m = texto.match(/I\.?\s?V\.?\s?A\.?\s*(?:19\s*%)?\s*\$?\s*([\d.,]+)/i);
  if (m) datos.iva = parseMontoCLP(m[1]);

  m = texto.match(/MONTO\s+TOTAL\s*\$?\s*([\d.,]+)/i) || texto.match(/\bTOTAL\s*\$?\s*([\d.,]+)/i);
  if (m) datos.total = parseMontoCLP(m[1]);

  // Si falta el Neto pero hay Total: intenta derivarlo según tipo de documento
  if (datos.montoNeto == null && datos.total != null) {
    if (datos.tipoDte === "Factura Afecta" && datos.iva != null) {
      datos.montoNeto = datos.total - datos.iva;
    } else if (datos.tipoDte === "Boleta Honorarios") {
      // Honorarios: Total ya es líquido; el neto (bruto) se calcula al 100/84.75
      datos.montoNeto = Math.round(datos.total / 0.8475);
    } else {
      datos.montoNeto = datos.total;
    }
  }

  return datos;
}

/**
 * Punto de entrada: recibe un File (PDF o imagen) y devuelve los datos
 * extraídos + el texto crudo usado para el análisis.
 * @param {File} file
 * @param {(mensaje: string) => void} onStatus callback opcional de progreso
 */
export async function extraerDatosFactura(file, onStatus = () => {}) {
  const esPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  let texto = "";

  if (esPdf) {
    onStatus("📄 Leyendo texto del PDF...");
    const { texto: textoNativo, pdf } = await extraerTextoPdf(file);

    if (textoNativo && textoNativo.replace(/\s/g, "").length > 40) {
      texto = textoNativo;
    } else {
      // PDF sin texto seleccionable (escaneado) → OCR real sobre la imagen renderizada
      onStatus("🔍 El PDF no tiene texto seleccionable, aplicando OCR...");
      const canvas = await renderizarPaginaComoImagen(pdf);
      texto = await ocrImagen(canvas, onStatus);
    }
  } else {
    onStatus("🔍 Aplicando OCR a la imagen...");
    texto = await ocrImagen(file, onStatus);
  }

  onStatus("🧠 Analizando datos extraídos...");
  const datos = analizarTextoFactura(texto);
  return { ...datos, textoCrudo: texto };
}
