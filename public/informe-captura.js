import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

// Si ya tienes un firebaseConfig.js global puedes importarlo, o definirlo aquí:
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "gravecare-ops.firebaseapp.com",
  projectId: "gravecare-ops",
  storageBucket: "gravecare-ops.appspot.com",
  messagingSenderId: "TU_MESSAGING_SENDER_ID",
  appId: "TU_APP_ID"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const storage = getStorage(app);

// Helper para convertir archivo local a base64 para previsualización inmediata en el DOM del PDF
function archivoABase64(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve('');
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

// Helper para subir archivo a Firebase Storage
async function subirFotoStorage(file, ruta) {
  if (!file) return '';
  const storageRef = ref(storage, ruta);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return await getDownloadURL(storageRef);
}

// Proceso del Formulario
const form = document.getElementById('formCaptura');
const btnGuardar = document.getElementById('btnGuardar');
const btnTexto = document.getElementById('btnTexto');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  btnGuardar.disabled = true;
  btnTexto.textContent = "Procesando evidencias...";

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

  // Obtener labores seleccionadas manualmente
  const checkboxes = document.querySelectorAll('input[name="labores"]:checked');
  const labores = Array.from(checkboxes).map(cb => cb.value);

  // Archivos de fotos
  const fAntes = document.getElementById('archivoAntes').files[0];
  const fDespues = document.getElementById('archivoDespues').files[0];
  const fFlores = document.getElementById('archivoFlores').files[0];
  const fPanoramica = document.getElementById('archivoPanoramica').files[0];

  try {
    // 1. Subir imágenes crudas a Storage para histórico
    btnTexto.textContent = "Subiendo fotografías a Storage...";
    const [urlAntes, urlDespues, urlFlores, urlPanoramica] = await Promise.all([
      subirFotoStorage(fAntes, `evidencias/${ordenId}/${informeId}_antes.jpg`),
      subirFotoStorage(fDespues, `evidencias/${ordenId}/${informeId}_despues.jpg`),
      subirFotoStorage(fFlores, `evidencias/${ordenId}/${informeId}_flores.jpg`),
      subirFotoStorage(fPanoramica, `evidencias/${ordenId}/${informeId}_panoramica.jpg`)
    ]);

    // 2. Cargar datos en la plantilla visual del PDF
    btnTexto.textContent = "Compilando documento PDF...";
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
      listaLabores.innerHTML = '<li>Visita técnica preventiva (sin labores adicionales marcadas).</li>';
    }

    // Convertir a Base64 local para que html2canvas no sufra por CORS durante el render
    const [b64Antes, b64Despues, b64Flores, b64Pano] = await Promise.all([
      archivoABase64(fAntes),
      archivoABase64(fDespues),
      archivoABase64(fFlores),
      archivoABase64(fPanoramica)
    ]);

    document.getElementById('pdf-foto-antes').src = b64Antes;
    document.getElementById('pdf-foto-despues').src = b64Despues;
    document.getElementById('pdf-foto-flores').src = b64Flores;
    document.getElementById('pdf-foto-panoramica').src = b64Pano;

    // 3. Generar PDF como Blob usando html2pdf.js
    const elemento = document.getElementById('plantilla-informe-pdf');
    const opcionesPdf = {
      margin: 10,
      filename: `${informeId}.pdf`,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    const pdfBlob = await window.html2pdf().set(opcionesPdf).from(elemento).outputPdf('blob');

    // 4. Subir el archivo PDF a Firebase Storage
    btnTexto.textContent = "Almacenando PDF en Firebase Storage...";
    const storagePdfRef = ref(storage, `informes_pdf/${ordenId}/${informeId}.pdf`);
    await uploadBytes(storagePdfRef, pdfBlob, {
      contentType: 'application/pdf',
      customMetadata: { ordenId: ordenId, informeId: informeId }
    });

    const urlDescargaPdf = await getDownloadURL(storagePdfRef);

    // 5. Guardar en Firestore (Colección "informes" y actualizar "ordenes")
    btnTexto.textContent = "Sincronizando Firestore...";
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

    // Actualizar puntero en la orden correspondiente
    await updateDoc(doc(db, "ordenes", ordenId), {
      ultimoInformeId: informeId,
      ultimoInformePdfUrl: urlDescargaPdf,
      fechaUltimaVisita: fechaStr,
      estado: "Completada"
    }).catch(err => {
      console.warn("Orden aún no existe en colección 'ordenes', continuando...", err);
    });

    // 6. Mostrar mensaje de éxito y enlace
    btnTexto.textContent = "¡Visita Registrada!";
    document.getElementById('resultadoFinal').classList.remove('hidden');
    const linkPdf = document.getElementById('linkPdfDirecto');
    linkPdf.href = urlDescargaPdf;

  } catch (error) {
    console.error("Error al registrar visita y compilar informe:", error);
    alert(`Ocurrió un error: ${error.message}`);
    btnGuardar.disabled = false;
    btnTexto.textContent = "Reintentar Guardar";
  }
});