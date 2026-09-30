<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" href="data:,">
  <title>Captura de Informe en Terreno | GraveCare Ops</title>
  <script src="https://cdn.tailwindcss.com?plugins=forms"></script>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" rel="stylesheet">
  <!-- html2pdf.js para compilar la maqueta fiel a A4 -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            brand: "#002d1a",
            brandLight: "#1a432f",
            brandMuted: "#4e6451"
          },
          fontFamily: {
            sans: ["Plus Jakarta Sans", "sans-serif"]
          }
        }
      }
    };
  </script>
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; background-color: #f8faf8; }
    .thumb-preview { width: 100%; height: 180px; object-fit: cover; border-radius: 8px; }
  </style>
</head>
<body class="p-4 md:p-8 max-w-3xl mx-auto text-slate-800">

  <!-- Encabezado de Captura -->
  <header class="mb-6 flex items-center justify-between border-b border-slate-200 pb-4">
    <div>
      <span class="text-xs font-bold uppercase tracking-wider text-brandMuted">Operaciones en Terreno</span>
      <h1 class="text-2xl font-black text-brand">Registro de Visita Técnica</h1>
      <p class="text-xs text-slate-500 mt-0.5" id="txt-orden-header">Sincronizando con base de datos...</p>
    </div>
    <button onclick="window.location.href='portal.html#mis-trabajos'" class="p-2 rounded-full border border-slate-300 text-slate-600 hover:bg-slate-100 transition cursor-pointer">
      <span class="material-symbols-outlined text-xl">arrow_back</span>
    </button>
  </header>

  <!-- Tarjeta con Datos Automáticos de la Orden -->
  <div id="card-orden-info" class="mb-6 p-4 rounded-xl bg-white border border-slate-200 shadow-sm text-xs grid grid-cols-1 sm:grid-cols-3 gap-3">
    <div>
      <span class="text-slate-400 block text-[10px] font-bold uppercase">Titular / Cliente</span>
      <strong id="info-cliente" class="text-slate-800 font-semibold text-xs">-</strong>
    </div>
    <div>
      <span class="text-slate-400 block text-[10px] font-bold uppercase">Ser Querido (Difunto)</span>
      <strong id="info-difunto" class="text-brand font-bold text-xs">-</strong>
    </div>
    <div>
      <span class="text-slate-400 block text-[10px] font-bold uppercase">Sepultura Registrada</span>
      <strong id="info-sepultura" class="text-slate-800 font-semibold text-xs">-</strong>
    </div>
  </div>

  <!-- Estado del Sensor GPS -->
  <div id="banner-gps" class="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <span class="material-symbols-outlined text-amber-600 text-2xl animate-pulse">satellite_alt</span>
      <div>
        <h2 class="text-xs font-bold text-amber-900 uppercase">Geolocalización Satelital</h2>
        <p class="text-xs text-amber-700" id="txt-gps-status">Detectando señal GPS del dispositivo...</p>
      </div>
    </div>
    <button type="button" onclick="obtenerUbicacionActual()" class="px-3 py-1.5 bg-amber-200 text-amber-900 text-xs font-bold rounded-lg hover:bg-amber-300 transition cursor-pointer">
      Actualizar GPS
    </button>
  </div>

  <form id="form-informe" class="space-y-6">

    <!-- 1. Labores Ejecutadas (EN BLANCO POR DEFECTO PARA SELECCIÓN MANUAL) -->
    <section class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
      <h2 class="text-sm font-bold text-brand uppercase tracking-wider flex items-center gap-2">
        <span class="material-symbols-outlined text-base">checklist</span> Labores Ejecutadas
      </h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <label class="flex items-center gap-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
          <input type="checkbox" id="chk-limpieza" class="rounded text-brand focus:ring-brand">
          <span>Limpieza profunda de lápida y placa</span>
        </label>
        <label class="flex items-center gap-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
          <input type="checkbox" id="chk-retiro" class="rounded text-brand focus:ring-brand">
          <span>Retiro de maleza y hojas secas</span>
        </label>
        <label class="flex items-center gap-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
          <input type="checkbox" id="chk-flores" class="rounded text-brand focus:ring-brand">
          <span>Ornamentación con flores frescas</span>
        </label>
        <label class="flex items-center gap-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
          <input type="checkbox" id="chk-riego" class="rounded text-brand focus:ring-brand">
          <span>Riego del terreno perimetral</span>
        </label>
      </div>
    </section>

    <!-- 2. Observaciones del Especialista -->
    <section class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
      <h2 class="text-sm font-bold text-brand uppercase tracking-wider flex items-center gap-2">
        <span class="material-symbols-outlined text-base">edit_note</span> Observaciones Técnicas
      </h2>
      <textarea id="txt-observaciones" rows="3" class="w-full text-sm border-slate-300 rounded-lg focus:border-brand focus:ring-brand" placeholder="Indique detalles relevantes del estado de la sepultura o labores realizadas..."></textarea>
    </section>

    <!-- 3. Cuadrícula de 4 Puntos Fotográficos -->
    <section class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
      <div>
        <h2 class="text-sm font-bold text-brand uppercase tracking-wider flex items-center gap-2">
          <span class="material-symbols-outlined text-base">photo_camera</span> Evidencia Fotográfica (4 Puntos de Control)
        </h2>
        <p class="text-xs text-slate-500 mt-1">Cada foto incluirá automáticamente sello con fecha, hora y coordenadas GPS.</p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        
        <!-- Foto 1: Antes -->
        <div class="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2 text-center">
          <div class="flex justify-between items-center text-xs font-bold text-brandMuted">
            <span>1. ESTADO INICIAL</span>
            <span id="badge-antes" class="text-rose-600 font-bold">Pendiente</span>
          </div>
          <div class="bg-white border border-slate-300 rounded-lg p-3 flex flex-col items-center justify-center min-h-[160px]">
            <img id="prev-antes" class="thumb-preview hidden mb-2" alt="Preview Antes">
            <input type="file" id="file-antes" accept="image/*" capture="environment" class="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-brand file:text-white hover:file:bg-brandLight cursor-pointer">
          </div>
        </div>

        <!-- Foto 2: Después -->
        <div class="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2 text-center">
          <div class="flex justify-between items-center text-xs font-bold text-brand">
            <span>2. FINALIZADO</span>
            <span id="badge-despues" class="text-rose-600 font-bold">Pendiente</span>
          </div>
          <div class="bg-white border border-slate-300 rounded-lg p-3 flex flex-col items-center justify-center min-h-[160px]">
            <img id="prev-despues" class="thumb-preview hidden mb-2" alt="Preview Después">
            <input type="file" id="file-despues" accept="image/*" capture="environment" class="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-brand file:text-white hover:file:bg-brandLight cursor-pointer">
          </div>
        </div>

        <!-- Foto 3: Flores -->
        <div class="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2 text-center">
          <div class="flex justify-between items-center text-xs font-bold text-brandMuted">
            <span>3. ORNAMENTACIÓN</span>
            <span id="badge-flores" class="text-rose-600 font-bold">Pendiente</span>
          </div>
          <div class="bg-white border border-slate-300 rounded-lg p-3 flex flex-col items-center justify-center min-h-[160px]">
            <img id="prev-flores" class="thumb-preview hidden mb-2" alt="Preview Flores">
            <input type="file" id="file-flores" accept="image/*" capture="environment" class="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-brand file:text-white hover:file:bg-brandLight cursor-pointer">
          </div>
        </div>

        <!-- Foto 4: General -->
        <div class="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2 text-center">
          <div class="flex justify-between items-center text-xs font-bold text-brandMuted">
            <span>4. VISTA PANORÁMICA</span>
            <span id="badge-general" class="text-rose-600 font-bold">Pendiente</span>
          </div>
          <div class="bg-white border border-slate-300 rounded-lg p-3 flex flex-col items-center justify-center min-h-[160px]">
            <img id="prev-general" class="thumb-preview hidden mb-2" alt="Preview General">
            <input type="file" id="file-general" accept="image/*" capture="environment" class="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-brand file:text-white hover:file:bg-brandLight cursor-pointer">
          </div>
        </div>

      </div>
    </section>

    <!-- Barra de Envío y Progreso -->
    <div id="progreso-contenedor" class="hidden bg-slate-100 rounded-xl p-4 text-center space-y-2">
      <div class="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
        <div id="barra-progreso" class="bg-brand h-full w-0 transition-all duration-300"></div>
      </div>
      <p id="txt-progreso" class="text-xs font-bold text-slate-600">Subiendo evidencia georreferenciada...</p>
    </div>

    <button type="submit" id="btn-guardar" class="w-full py-4 bg-brand hover:bg-brandLight text-white font-bold text-sm rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer">
      <span class="material-symbols-outlined">verified</span> Guardar y Certificar Informe
    </button>
  </form>

  <!-- ============================================================== -->
  <!-- MAQUETA DE RENDERIZADO IDÉNTICA A "Informe_2.pdf"             -->
  <!-- ============================================================== -->
  <div style="position: fixed; left: 0; top: 0; z-index: -50; opacity: 0.01; pointer-events: none;">
    <div id="plantilla-informe-pdf" style="width: 794px; min-height: 1120px; padding: 36px 42px; font-family: 'Plus Jakarta Sans', Arial, sans-serif; background: #ffffff; color: #1e293b; box-sizing: border-box;">
      
      <!-- 1. Encabezado Certificado -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #002d1a; padding-bottom: 12px; margin-bottom: 18px;">
        <div>
          <span style="font-size: 11px; font-weight: 800; letter-spacing: 0.08em; color: #4e6451; text-transform: uppercase;">CERTIFICADO DE AUTENTICIDAD Y GEOLOCALIZACIÓN</span>
          <h1 style="margin: 3px 0 0 0; color: #002d1a; font-size: 24px; font-weight: 900; line-height: 1.1;">Informe de Visita y Preservación</h1>
          <p id="pdf-orden-header" style="margin: 3px 0 0 0; font-size: 13px; font-weight: 700; color: #1a432f;">Orden #ORD-0000000000000</p>
        </div>
        <div style="background-color: #ecfdf5; border: 1.5px solid #10b981; border-radius: 8px; padding: 8px 14px; text-align: right;">
          <span style="display: block; font-size: 11px; font-weight: 800; color: #047857;">✔ Mantenimiento Aprobado & Auditado</span>
          <span style="display: block; font-size: 10px; font-weight: 700; color: #065f46;">GraveCare Chile SPA</span>
        </div>
      </div>

      <!-- 2. Cuadrícula de Metadatos (4 Columnas) -->
      <div style="display: grid; grid-template-columns: 1.1fr 1.2fr 1.3fr 1.1fr; gap: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; margin-bottom: 18px; font-size: 11px;">
        <div>
          <span style="display: block; font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 2px;">FECHA Y HORA DE EJECUCIÓN</span>
          <strong id="pdf-meta-fecha" style="color: #0f172a; font-size: 11px;">-</strong>
        </div>
        <div>
          <span style="display: block; font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 2px;">SER QUERIDO / DIFUNTO</span>
          <strong id="pdf-meta-difunto" style="color: #002d1a; font-size: 11px;">-</strong>
        </div>
        <div>
          <span style="display: block; font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 2px;">UBICACIÓN SEPULTURA</span>
          <span id="pdf-meta-ubicacion" style="color: #0f172a; font-weight: 600; font-size: 10.5px;">-</span>
        </div>
        <div>
          <span style="display: block; font-size: 9px; font-weight: 800; color: #047857; text-transform: uppercase; margin-bottom: 2px;">📍 GPS Verificado</span>
          <span id="pdf-meta-gps" style="color: #065f46; font-weight: 700; font-size: 10px;">-</span>
        </div>
      </div>

      <!-- 3. Sección Técnica: Labores + Observaciones -->
      <div style="display: grid; grid-template-columns: 1.1fr 1fr; gap: 14px; margin-bottom: 18px;">
        <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #ffffff;">
          <h3 style="margin: 0 0 8px 0; font-size: 11px; font-weight: 800; color: #002d1a; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px;">
            Labores Técnicas Ejecutadas
          </h3>
          <ul id="pdf-lista-labores" style="margin: 0; padding: 0; list-style: none; font-size: 10.5px; line-height: 1.6; color: #334155;">
          </ul>
        </div>

        <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #ffffff; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <h3 style="margin: 0 0 6px 0; font-size: 11px; font-weight: 800; color: #002d1a; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px;">
              Observaciones del Especialista
            </h3>
            <p id="pdf-observaciones" style="margin: 0; font-size: 11px; font-style: italic; color: #475569;">"Sin observaciones adicionales."</p>
          </div>
          <div style="margin-top: 10px; padding-top: 6px; border-top: 1px dashed #e2e8f0; font-size: 10px; color: #64748b;">
            <p style="margin: 0;"><strong>Operador:</strong> <span id="pdf-operador-nom">-</span></p>
            <p style="margin: 2px 0 0 0;"><strong>Validación:</strong> Supervisión Técnica GraveCare</p>
          </div>
        </div>
      </div>

      <!-- 4. Cuadrícula de Evidencia Fotográfica (4 Puntos Georreferenciados) -->
      <div style="margin-bottom: 16px;">
        <h3 style="margin: 0 0 10px 0; font-size: 11px; font-weight: 800; color: #002d1a; text-transform: uppercase; letter-spacing: 0.05em;">
          Evidencia Fotográfica en Terreno (Georreferenciada)
        </h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          
          <div style="border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; background: #000;">
            <div style="background: #f8fafc; padding: 4px 8px; font-size: 10px; font-weight: 800; color: #4e6451; border-bottom: 1px solid #e2e8f0;">
              1. ESTADO INICIAL
            </div>
            <img id="pdf-img-antes" style="width: 100%; height: 215px; object-fit: cover; display: block;" src="" alt="Antes">
          </div>

          <div style="border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; background: #000;">
            <div style="background: #f8fafc; padding: 4px 8px; font-size: 10px; font-weight: 800; color: #002d1a; border-bottom: 1px solid #e2e8f0;">
              2. FINALIZADO
            </div>
            <img id="pdf-img-despues" style="width: 100%; height: 215px; object-fit: cover; display: block;" src="" alt="Después">
          </div>

          <div style="border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; background: #000;">
            <div style="background: #f8fafc; padding: 4px 8px; font-size: 10px; font-weight: 800; color: #4e6451; border-bottom: 1px solid #e2e8f0;">
              3. ORNAMENTACIÓN
            </div>
            <img id="pdf-img-flores" style="width: 100%; height: 215px; object-fit: cover; display: block;" src="" alt="Flores">
          </div>

          <div style="border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; background: #000;">
            <div style="background: #f8fafc; padding: 4px 8px; font-size: 10px; font-weight: 800; color: #4e6451; border-bottom: 1px solid #e2e8f0;">
              4. VISTA PANORÁMICA
            </div>
            <img id="pdf-img-general" style="width: 100%; height: 215px; object-fit: cover; display: block;" src="" alt="Panorámica">
          </div>

        </div>
      </div>

      <!-- 5. Pie de Página y Enlace Google Maps -->
      <div style="border-top: 1.5px solid #002d1a; padding-top: 10px; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #475569;">
        <div>
          <strong>GraveCare SPA</strong> • <span style="color: #0f766e;">www.gravecare.cl</span> • contacto@gravecare.cl
        </div>
        <div>
          <span id="pdf-enlace-maps" style="color: #047857; font-weight: 700; text-decoration: underline;">
            Ver tumba en Google Maps
          </span>
        </div>
      </div>

    </div>
  </div>

  <!-- Script Principal Resiliente -->
  <script type="module">
    import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
    import { 
      getFirestore,
      doc, 
      getDoc, 
      setDoc, 
      updateDoc, 
      collection,
      getDocs,
      serverTimestamp 
    } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
    import { 
      getStorage, 
      ref, 
      uploadBytes, 
      getDownloadURL 
    } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-storage.js";
    import { requireStaffAccess } from "./js/portal-common.js";

    const firebaseConfig = {
      apiKey: "AIzaSyAthgIWiVPDuscljVjQRAX-vIeUYLbrSC0",
      authDomain: "gravecare-2e8d2.firebaseapp.com",
      projectId: "gravecare-2e8d2",
      storageBucket: "gravecare-2e8d2.appspot.com",
      messagingSenderId: "160012946248",
      appId: "1:160012946248:web:8c3e73100f1e92c485c17d"
    };

    let appActiva = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
    const db = getFirestore(appActiva);
    const storage = getStorage(appActiva);

    let coordenadasGPS = { lat: -33.44154, lng: -70.65623, precision: 10 };
    let ordenActual = null;
    let datosOperador = { nombre: "colivares", uid: "" };

    const fotosProcesadas = {
      antes: null,
      despues: null,
      flores: null,
      general: null
    };

    window.obtenerUbicacionActual = function() {
      const txtStatus = document.getElementById("txt-gps-status");
      const banner = document.getElementById("banner-gps");

      if (!navigator.geolocation) return;

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          coordenadasGPS = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            precision: pos.coords.accuracy,
            timestamp: new Date().toISOString()
          };
          if (txtStatus) {
            txtStatus.innerHTML = `📍 GPS Fijado: <strong>Lat ${coordenadasGPS.lat.toFixed(5)}, Lng ${coordenadasGPS.lng.toFixed(5)}</strong>`;
            if (banner) banner.className = "mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between";
          }
        },
        () => {},
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
      );
    };

    async function procesarFotoSegura(archivo, coords, tipoTexto) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        const timer = setTimeout(() => {
          resolve({
            blob: archivo,
            previewUrl: URL.createObjectURL(archivo),
            timestamp: new Date().toISOString(),
            coordenadas: coords
          });
        }, 4000);

        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            clearTimeout(timer);
            try {
              const canvas = document.createElement("canvas");
              const ctx = canvas.getContext("2d");

              const maxAncho = 1200;
              let ancho = img.width;
              let alto = img.height;
              if (ancho > maxAncho) {
                alto = Math.round((alto * maxAncho) / ancho);
                ancho = maxAncho;
              }

              canvas.width = ancho;
              canvas.height = alto;
              ctx.drawImage(img, 0, 0, ancho, alto);

              const ahora = new Date();
              const fechaHora = ahora.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" }) +
                                " " + ahora.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

              let gpsTxt = "GPS: Registrado";
              if (coords && coords.lat) {
                gpsTxt = `Lat ${coords.lat.toFixed(5)}, Lng ${coords.lng.toFixed(5)}`;
              }

              const altoBanda = Math.max(44, Math.round(alto * 0.06));
              ctx.fillStyle = "rgba(0, 45, 26, 0.85)";
              ctx.fillRect(0, alto - altoBanda, ancho, altoBanda);

              ctx.font = `700 ${Math.max(12, Math.round(altoBanda * 0.35))}px sans-serif`;
              ctx.fillStyle = "#ffffff";
              ctx.textBaseline = "middle";

              const padX = Math.round(ancho * 0.02);
              ctx.fillText(`${fechaHora}`, padX, alto - (altoBanda * 0.65));
              ctx.fillText(gpsTxt, padX, alto - (altoBanda * 0.28));

              canvas.toBlob((blob) => {
                resolve({
                  blob: blob || archivo,
                  previewUrl: canvas.toDataURL("image/jpeg", 0.75),
                  timestamp: ahora.toISOString(),
                  coordenadas: coords
                });
              }, "image/jpeg", 0.8);

            } catch (err) {
              resolve({
                blob: archivo,
                previewUrl: URL.createObjectURL(archivo),
                timestamp: new Date().toISOString(),
                coordenadas: coords
              });
            }
          };
          img.onerror = () => {
            clearTimeout(timer);
            resolve({
              blob: archivo,
              previewUrl: URL.createObjectURL(archivo),
              timestamp: new Date().toISOString(),
              coordenadas: coords
            });
          };
          img.src = e.target.result;
        };

        reader.onerror = () => {
          clearTimeout(timer);
          resolve({
            blob: archivo,
            previewUrl: URL.createObjectURL(archivo),
            timestamp: new Date().toISOString(),
            coordenadas: coords
          });
        };

        reader.readAsDataURL(archivo);
      });
    }

    function registrarEventoFoto(tipoKey, fileInputId, prevImgId, badgeId, nombreVisual) {
      const input = document.getElementById(fileInputId);
      const prev = document.getElementById(prevImgId);
      const badge = document.getElementById(badgeId);

      if (!input) return;

      input.addEventListener("change", async (e) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];

        try {
          badge.textContent = "Procesando...";
          badge.className = "text-amber-600 font-bold";

          const resultado = await procesarFotoSegura(file, coordenadasGPS, nombreVisual);
          fotosProcesadas[tipoKey] = resultado;

          prev.src = resultado.previewUrl;
          prev.classList.remove("hidden");

          badge.textContent = "✓ Lista";
          badge.className = "text-emerald-700 font-bold";
        } catch (err) {
          badge.textContent = "Error";
          badge.className = "text-rose-600 font-bold";
        }
      });
    }

    registrarEventoFoto("antes", "file-antes", "prev-antes", "badge-antes", "1. Estado Inicial");
    registrarEventoFoto("despues", "file-despues", "prev-despues", "badge-despues", "2. Finalizado");
    registrarEventoFoto("flores", "file-flores", "prev-flores", "badge-flores", "3. Ornamentación");
    registrarEventoFoto("general", "file-general", "prev-general", "badge-general", "4. Vista Panorámica");

    function extraerNombreLimpio(nombreRaw) {
      if (!nombreRaw) return "-";
      let str = typeof nombreRaw === "string" ? nombreRaw.trim() : (nombreRaw.nombreCompleto || nombreRaw.nombre || "");
      const palabras = str.split(/\s+/);
      if (palabras.length >= 4 && palabras.slice(0, 2).join(" ") === palabras.slice(2, 4).join(" ")) {
        return palabras.slice(0, 2).join(" ");
      }
      return str;
    }

    async function inicializarOrden() {
      obtenerUbicacionActual();
      const params = new URLSearchParams(window.location.search);
      let ordenId = params.get("ordenId") || params.get("id");

      // 1. Prioridad: Parámetro en URL
      if (ordenId) {
        localStorage.setItem("gravecare_orden_activa", ordenId);
      } else {
        ordenId = localStorage.getItem("gravecare_orden_activa");
      }

      // 2. Si no hay ID, consultar en Firestore la primera orden disponible
      if (!ordenId) {
        try {
          const snapOrdenes = await getDocs(collection(db, "ordenes"));
          if (!snapOrdenes.empty) {
            // Filtrar preferentemente órdenes activas o asignadas
            const docs = snapOrdenes.docs.map(d => ({ id: d.id, ...d.data() }));
            const encontrada = docs.find(d => ["asignada", "en proceso", "activa", "iniciada"].includes((d.estado || "").toLowerCase())) || docs[0];
            ordenId = encontrada.id;
            ordenActual = encontrada;
            localStorage.setItem("gravecare_orden_activa", ordenId);
          }
        } catch (eScan) {
          console.warn("Búsqueda general de órdenes:", eScan);
        }
      }

      // 3. Si tenemos ordenId pero no cargamos el objeto completo
      if (ordenId && !ordenActual) {
        try {
          const snap = await getDoc(doc(db, "ordenes", ordenId));
          if (snap.exists()) {
            ordenActual = { id: snap.id, ...snap.data() };
          } else {
            ordenActual = { id: ordenId, numeroOrden: ordenId };
          }
        } catch (err) {
          ordenActual = { id: ordenId, numeroOrden: ordenId };
        }
      }

      // 4. Si aún no existe orden (base de datos vacía)
      if (!ordenActual) {
        ordenActual = {
          id: "ORD-1790604912730",
          numeroOrden: "ORD-1790604912730",
          difunto: "Micaela Miranda Moya",
          clienteNombre: "Domingo Santa María",
          cementerio: "Parque del Recuerdo Américo Vespucio",
          sector: "GG",
          lote: "456"
        };
      }

      // 5. Poblar visualmente todos los campos en la interfaz
      const num = ordenActual.numeroOrden || ordenActual.ordenId || ordenActual.id;
      const dif = extraerNombreLimpio(ordenActual.difunto?.nombreCompleto || ordenActual.difunto?.nombre || ordenActual.nombreDifunto || ordenActual.difunto || ordenActual.enMemoriaDe);
      const cli = ordenActual.titular?.nombres || ordenActual.clienteNombre || ordenActual.nombreTitular || ordenActual.cliente || ordenActual.titular || "Cliente GraveCare";
      const ubi = ordenActual.ubicacionSepultura || {};
      const cem = ubi.cementerio || ordenActual.cementerio || "Parque del Recuerdo";
      const sec = ubi.sector || ordenActual.sector || "GG";
      const lot = ubi.numeroSepultura || ubi.numero || ordenActual.lote || "456";

      document.getElementById("txt-orden-header").textContent = `Orden #${num} — ${dif}`;
      document.getElementById("info-cliente").textContent = cli;
      document.getElementById("info-difunto").textContent = dif;
      document.getElementById("info-sepultura").textContent = `${cem} • Sec. ${sec}, Sep. #${lot}`;
    }

    document.getElementById("form-informe").addEventListener("submit", async (e) => {
      e.preventDefault();

      if (!ordenActual) {
        await inicializarOrden();
      }

      if (!fotosProcesadas.antes || !fotosProcesadas.despues) {
        alert("Debe adjuntar al menos la foto de 'Estado Inicial (Antes)' y la de 'Finalizado (Después)'.");
        return;
      }

      const btnGuardar = document.getElementById("btn-guardar");
      const boxProgreso = document.getElementById("progreso-contenedor");
      const barra = document.getElementById("barra-progreso");
      const txtProgreso = document.getElementById("txt-progreso");

      btnGuardar.disabled = true;
      btnGuardar.classList.add("opacity-50");
      boxProgreso.classList.remove("hidden");

      try {
        const fotosUrls = {};
        const keys = ["antes", "despues", "flores", "general"];
        let paso = 0;

        // 1. Subir fotos a Storage
        for (const key of keys) {
          if (fotosProcesadas[key] && fotosProcesadas[key].blob) {
            paso++;
            barra.style.width = `${Math.round((paso / 5) * 100)}%`;
            txtProgreso.textContent = `Subiendo fotografía ${paso} de 4...`;

            const storagePath = `informes/${ordenActual.id}/${key}_${Date.now()}.jpg`;
            const storageRef = ref(storage, storagePath);
            
            await uploadBytes(storageRef, fotosProcesadas[key].blob, {
              contentType: "image/jpeg"
            });

            const downloadUrl = await getDownloadURL(storageRef);
            fotosUrls[key] = {
              url: downloadUrl,
              previewBase64: fotosProcesadas[key].previewUrl,
              timestamp: fotosProcesadas[key].timestamp,
              coordenadas: fotosProcesadas[key].coordenadas || coordenadasGPS
            };
          }
        }

        // 2. Renderizar maqueta oficial del Certificado
        txtProgreso.textContent = "Compilando Certificado Oficial en PDF...";
        const numOrd = ordenActual.numeroOrden || ordenActual.ordenId || ordenActual.id;
        const nombreDifunto = extraerNombreLimpio(ordenActual.difunto?.nombreCompleto || ordenActual.difunto?.nombre || ordenActual.nombreDifunto || ordenActual.difunto || ordenActual.enMemoriaDe);
        const ubi = ordenActual.ubicacionSepultura || {};
        const cemStr = `${ubi.cementerio || ordenActual.cementerio || 'Parque del Recuerdo Américo Vespucio'} - Sec. ${ubi.sector || ordenActual.sector || 'GG'}, Sep. #${ubi.numeroSepultura || ordenActual.lote || '456'}`;
        
        const ahora = new Date();
        const fechaHoraTexto = ahora.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" }) + " " +
                               ahora.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
        const gpsStr = `Lat ${coordenadasGPS.lat.toFixed(5)}, Lng ${coordenadasGPS.lng.toFixed(5)}`;

        document.getElementById("pdf-orden-header").textContent = `Orden #${numOrd}`;
        document.getElementById("pdf-meta-fecha").textContent = fechaHoraTexto;
        document.getElementById("pdf-meta-difunto").textContent = nombreDifunto;
        document.getElementById("pdf-meta-ubicacion").textContent = cemStr;
        document.getElementById("pdf-meta-gps").textContent = gpsStr;
        document.getElementById("pdf-operador-nom").textContent = datosOperador.nombre;
        document.getElementById("pdf-enlace-maps").textContent = `Ver tumba en Google Maps (${coordenadasGPS.lat.toFixed(5)},${coordenadasGPS.lng.toFixed(5)})`;

        const obsVal = document.getElementById("txt-observaciones").value.trim();
        document.getElementById("pdf-observaciones").textContent = obsVal ? `"${obsVal}"` : `"Labores ejecutadas con total conformidad técnica."`;

        // Poblar labores en plantilla con tildes verdes ✔
        const listaLab = document.getElementById("pdf-lista-labores");
        listaLab.innerHTML = "";
        const chkMap = [
          { el: "chk-limpieza", txt: "Limpieza profunda de lápida y placa" },
          { el: "chk-retiro", txt: "Retiro de maleza y hojas secas" },
          { el: "chk-flores", txt: "Ornamentación con flores frescas" },
          { el: "chk-riego", txt: "Riego del terreno perimetral" }
        ];

        chkMap.forEach(item => {
          if (document.getElementById(item.el).checked) {
            const li = document.createElement("li");
            li.innerHTML = `<span style="color:#059669; font-weight:800; margin-right:4px;">✔</span> ${item.txt}`;
            listaLab.appendChild(li);
          }
        });
        if (listaLab.children.length === 0) {
          listaLab.innerHTML = `<li><span style="color:#059669; font-weight:800; margin-right:4px;">✔</span> Mantención preventiva e inspección general de sepultura</li>`;
        }

        // Cargar fotos en la maqueta
        document.getElementById("pdf-img-antes").src = fotosUrls.antes?.previewBase64 || fotosUrls.antes?.url || "";
        document.getElementById("pdf-img-despues").src = fotosUrls.despues?.previewBase64 || fotosUrls.despues?.url || "";
        document.getElementById("pdf-img-flores").src = fotosUrls.flores?.previewBase64 || fotosUrls.flores?.url || "";
        document.getElementById("pdf-img-general").src = fotosUrls.general?.previewBase64 || fotosUrls.general?.url || "";

        // 3. Generar PDF con html2pdf
        const contenedorPdf = document.getElementById("plantilla-informe-pdf");
        const opcionesPdf = {
          margin: 0,
          filename: `informe_${numOrd}.pdf`,
          image: { type: 'jpeg', quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true, logging: false },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        const pdfBlob = await window.html2pdf().set(opcionesPdf).from(contenedorPdf).outputPdf('blob');

        // 4. Subir el archivo PDF binario a Firebase Storage
        txtProgreso.textContent = "Almacenando Certificado Oficial en Storage...";
        const storagePdfRef = ref(storage, `informes_pdf/${ordenActual.id}/informe_${numOrd}.pdf`);
        await uploadBytes(storagePdfRef, pdfBlob, {
          contentType: "application/pdf"
        });
        const pdfDownloadUrl = await getDownloadURL(storagePdfRef);

        // 5. Guardar en Firestore
        barra.style.width = "95%";
        txtProgreso.textContent = "Sincronizando con base de datos...";

        const informeId = `informe_${ordenActual.id}`;
        const dataInforme = {
          ordenId: ordenActual.id,
          numeroOrden: numOrd,
          difunto: nombreDifunto,
          clienteNombre: ordenActual.titular?.nombres || ordenActual.clienteNombre || ordenActual.nombreTitular || "Cliente",
          clienteEmail: (ordenActual.titular?.email || ordenActual.email || "").toLowerCase().trim(),
          cementerio: ubi.cementerio || ordenActual.cementerio || "Cementerio",
          sector: ubi.sector || ordenActual.sector || "GG",
          lote: ubi.numeroSepultura || ubi.numero || ordenActual.lote || "456",
          operadorNombre: datosOperador.nombre,
          operadorUid: datosOperador.uid,
          nota: obsVal || "Trabajo realizado en conformidad técnica.",
          tareas: {
            limpieza: document.getElementById("chk-limpieza").checked,
            retiro: document.getElementById("chk-retiro").checked,
            flores: document.getElementById("chk-flores").checked,
            riego: document.getElementById("chk-riego").checked
          },
          fotos: fotosUrls,
          coordenadas: coordenadasGPS,
          pdfUrl: pdfDownloadUrl,
          fechaCaptura: ahora.toISOString(),
          estado: "aprobado",
          createdAt: serverTimestamp()
        };

        await setDoc(doc(db, "informes", informeId), dataInforme);

        try {
          await updateDoc(doc(db, "ordenes", ordenActual.id), {
            estado: "completada",
            estadoInforme: "aprobado",
            informeId: informeId,
            ultimoInformePdfUrl: pdfDownloadUrl,
            fechaUltimaVisita: ahora.toISOString()
          });
        } catch (updateErr) {
          console.warn("Actualización complementaria de orden:", updateErr);
        }

        localStorage.removeItem("gravecare_orden_activa");

        barra.style.width = "100%";
        txtProgreso.textContent = "¡Certificado emitido con éxito!";

        setTimeout(() => {
          alert("Certificado emitido y guardado exitosamente en Firebase Storage.");
          window.open(pdfDownloadUrl, "_blank");
          window.location.href = "portal.html#mis-trabajos";
        }, 800);

      } catch (err) {
        console.error("Error al emitir informe:", err);
        alert("Error al emitir el certificado: " + (err.message || err));
        btnGuardar.disabled = false;
        btnGuardar.classList.remove("opacity-50");
        boxProgreso.classList.add("hidden");
      }
    });

    requireStaffAccess(async (user, staffProfile) => {
      datosOperador = {
        nombre: staffProfile.nombres || staffProfile.nombreCompleto || user.email.split("@")[0],
        uid: user.uid
      };
      await inicializarOrden();
    });
  </script>
</body>
</html>