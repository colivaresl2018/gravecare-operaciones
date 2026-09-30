import * as fbConf from "./js/firebaseConfig.js";
import { getApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  updateDoc 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

// Resolver app, firestore y storage de manera compatible y segura
const app = getApps().length > 0 ? getApp() : (fbConf.default?.app || null);
const db = fbConf.db || (app ? getFirestore(app) : getFirestore());
const storage = fbConf.storage || (app ? getStorage(app) : getStorage());

function archivoABase64(file) {
  return new Promise((resolve) => {
    if (!file) return resolve('');
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

async function subirFotoStorage(file, ruta) {
  if (!file) return '';
  try {
    const storageRef = ref(storage, ruta);
    await uploadBytes(storageRef, file, { contentType: file.type });
    return await getDownloadURL(storageRef);
  } catch (err) {
    console.warn(`No se pudo subir foto a ${ruta}:`, err);
    return '';
  }
}

const form = document.getElementById('formCaptura');
const btnGuardar = document.getElementById('btnGuardar');
const btnTexto = document.getElementById('btnTexto');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  btnGuardar.disabled = true;
  btnTexto.textContent = "1/4 Subiendo imágenes...";

  const ordenId = document.getElementById('ordenId').value.trim();
  const timestamp = Date.now();
  const informeId = `informe_${ordenId}_${timestamp}`;

  const cliente = document.getElementById('cliente').value.trim();
  const difunto = document.getElementById('difunto').value.trim();
  const operador = document.getElementById('operador').value.trim();
  const cementerio = document.getElementById('cementerio').value.trim();
  const sector = document.getElementById('sector').value.trim();
  const lote = document.getElementById('lote').value.trim();
  const notas = document.getElementById('notas').value.trim() || 'Sin observaciones.';
  const fechaStr = new Date().toLocaleDateString('es-CL');

  const checkboxes = document.querySelectorAll('input[name="labores"]:checked');
  const labores = Array.from(checkboxes).map(cb => cb.value);

  const fAntes = document.getElementById('archivoAntes').files[0];
  const fDespues = document.getElementById('archivoDespues').files[0];
  const fFlores = document.getElementById('archivoFlores').files[0];
  const fPanoramica = document.getElementById('archivoPanoramica').files[0];

  try {
    // 1. Subir fotos a Storage
    console.log("Subiendo imágenes a Storage...");
    const [urlAntes, urlDespues, urlFlores, urlPanoramica] = await Promise.all([
      subirFotoStorage(fAntes, `evidencias/${ordenId}/${informeId}_antes.jpg`),
      subirFotoStorage(fDespues, `evidencias/${ordenId}/${informeId}_despues.jpg`),
      subirFotoStorage(fFlores, `evidencias/${ordenId}/${informeId}_flores.jpg`),
      subirFotoStorage(fPanoramica, `evidencias/${ordenId}/${informeId}_panoramica.jpg`)
    ]);

    btnTexto.textContent = "2/4 Renderizando informe...";

    // 2. Llenar plantilla visible
    document.getElementById('pdf-orden-id').textContent = ordenId;
    document.getElementById('pdf-informe-id').textContent = informeId;
    document.getElementById('pdf-fecha').textContent = fechaStr;
    document.getElementById('pdf-cliente').textContent = cliente;
    document.getElementById('pdf-difunto').textContent = difunto;
    document.getElementById('pdf-operador').textContent = operador;
    document.getElementById('pdf-ubicacion').textContent = `${cementerio} • Sector: ${sector} • Lote: ${lote}`;
    document.getElementById('pdf-observaciones').textContent = notas;

    const listaLabores = document.getElementById('pdf-labores-lista');
    listaLabores.innerHTML = '';
    if (labores.length > 0) {
      labores.forEach(item => {
        const li = document.createElement('li');
        li.textContent = item;
        listaLabores.appendChild(li);
      });
    } else {
      listaLabores.innerHTML = '<li>Visita técnica preventiva (sin labores adicionales).</li>';
    }

    // Convertir imágenes a base64 para evitar errores de render local
    const [b64Antes, b64Despues, b64Flores, b64Pano] = await Promise.all([
      archivoABase64(fAntes),
      archivoABase64(fDespues),
      archivoABase64(fFlores),
      archivoABase64(fPanoramica)
    ]);

    document.getElementById('pdf-foto-antes').src = b64Antes || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><text y="50" font-size="12" fill="gray">Sin foto</text></svg>';
    document.getElementById('pdf-foto-despues').src = b64Despues || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><text y="50" font-size="12" fill="gray">Sin foto</text></svg>';
    document.getElementById('pdf-foto-flores').src = b64Flores || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><text y="50" font-size="12" fill="gray">Sin foto</text></svg>';
    document.getElementById('pdf-foto-panoramica').src = b64Pano || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><text y="50" font-size="12" fill="gray">Sin foto</text></svg>';

    // 3. Compilación a Blob PDF
    btnTexto.textContent = "3/4 Generando PDF binario...";
    const elemento = document.getElementById('plantilla-informe-pdf');
    
    // Configuración robusta para html2pdf
    const opcionesPdf = {
      margin: 10,
      filename: `${informeId}.pdf`,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    console.log("Iniciando compilación PDF...");
    const pdfBlob = await window.html2pdf().set(opcionesPdf).from(elemento).outputPdf('blob');
    console.log("PDF generado con éxito. Tamaño:", pdfBlob.size, "bytes");

    if (!pdfBlob || pdfBlob.size === 0) {
      throw new Error("El archivo PDF generado está vacío.");
    }

    // 4. Subida a Storage
    btnTexto.textContent = "4/4 Subiendo PDF a Storage...";
    const storagePdfRef = ref(storage, `informes_pdf/${ordenId}/${informeId}.pdf`);
    
    console.log("Subiendo PDF a Storage en ruta:", storagePdfRef.fullPath);
    await uploadBytes(storagePdfRef, pdfBlob, {
      contentType: 'application/pdf',
      customMetadata: { ordenId: ordenId, informeId: informeId }
    });

    const urlDescargaPdf = await getDownloadURL(storagePdfRef);
    console.log("URL generada de Storage:", urlDescargaPdf);

    // 5. Guardar metadatos en Firestore
    const payloadInforme = {
      informeId: informeId,
      ordenId: ordenId,
      fechaVisita: fechaStr,
      cliente: cliente,
      difunto: difunto,
      operador: operador,
      cementerio: cementerio,
      sector: sector,
      lote: lote,
      laboresEjecutadas: labores,
      fotosUrls: {
        antes: urlAntes,
        despues: urlDespues,
        flores: urlFlores,
        panoramica: urlPanoramica
      },
      notas: notas,
      pdfUrl: urlDescargaPdf,
      fechaCreacion: new Date()
    };

    await setDoc(doc(db, "informes", informeId), payloadInforme);

    // Actualizar orden
    try {
      await updateDoc(doc(db, "ordenes", ordenId), {
        ultimoInformeId: informeId,
        ultimoInformePdfUrl: urlDescargaPdf,
        fechaUltimaVisita: fechaStr,
        estado: "completada"
      });
    } catch (eOrd) {
      console.warn("No se pudo actualizar la orden directamente (quizás el ID difiere):", eOrd);
    }

    // 6. Éxito
    btnTexto.textContent = "¡Visita e Informe Guardados!";
    document.getElementById('resultadoFinal').classList.remove('hidden');
    const linkPdf = document.getElementById('linkPdfDirecto');
    linkPdf.href = urlDescargaPdf;

  } catch (error) {
    console.error("Error crítico en el proceso:", error);
    alert(`Error al procesar o subir el informe: ${error.message}\nRevisa la consola (F12) para más detalles.`);
    btnGuardar.disabled = false;
    btnTexto.textContent = "Reintentar Guardar";
  }
});