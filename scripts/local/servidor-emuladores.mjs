// Servidor local del backoffice conectado a los EMULADORES de la web (directriz B-1). No se publica: vive fuera de public/.
//
//   PowerShell:  $env:GC_OFFSET=800; node scripts/local/servidor-emuladores.mjs
//   Abre:        http://localhost:<5050 + GC_OFFSET>/login-ops.html
//
// Cómo funciona, sin tocar ninguna página:
// - Sirve public/ en 127.0.0.1 con las mismas reescrituras de firebase.json (/ y /login.html → /login-ops.html).
// - Al servir .html y .js reemplaza los módulos del SDK de gstatic (app, auth, firestore, storage, analytics) por
//   envoltorios locales que (1) fuerzan el proyecto «demo-*» del emulador y (2) conectan Auth, Firestore y Storage a
//   127.0.0.1 con los puertos desplazados. Analytics queda inerte.
// - Fuera de este servidor (Hosting real) las páginas no cambian: el módulo es inerte porque solo existe aquí.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { desplazamiento, proyectoEmulador, puertos } from './puertos.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PUBLIC = join(RAIZ, 'public');
const OFF = desplazamiento();
const PROYECTO = proyectoEmulador();
const P = puertos(OFF);

const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp' };
const REESCRITURAS = { '/': '/login-ops.html', '/login.html': '/login-ops.html' };
const SDK = /https:\/\/www\.gstatic\.com\/firebasejs\/(\d+\.\d+\.\d+)\/firebase-(app|auth|firestore|storage|analytics)\.js/g;

/** Envoltorio de un módulo del SDK: reexporta todo y reemplaza solo las funciones de inicialización. */
export function envoltorio(version, modulo, { proyecto = PROYECTO, p = P } = {}) {
  const real = `https://www.gstatic.com/firebasejs/${version}/firebase-${modulo}.js`;
  const marca = `// Envoltorio local (servidor-emuladores.mjs): ${modulo} ${version} → emulador ${proyecto}\n`;
  switch (modulo) {
    case 'app':
      return marca + `export * from "${real}";
import { initializeApp as _initializeApp } from "${real}";
export function initializeApp(config = {}, ...resto) {
  const local = { ...config, apiKey: "demo-api-key-local", projectId: "${proyecto}", authDomain: "127.0.0.1", storageBucket: "${proyecto}.appspot.com" };
  delete local.measurementId;
  return _initializeApp(local, ...resto);
}
console.info("[entorno local] Firebase apunta a los emuladores del proyecto ${proyecto} (GC_OFFSET=${OFF})");
`;
    case 'auth':
      return marca + `export * from "${real}";
import { getAuth as _getAuth, initializeAuth as _initializeAuth, connectAuthEmulator } from "${real}";
const conectadas = new WeakSet();
function conectar(a) { if (!conectadas.has(a)) { conectadas.add(a); connectAuthEmulator(a, "http://127.0.0.1:${p.auth}", { disableWarnings: true }); } return a; }
export function getAuth(...x) { return conectar(_getAuth(...x)); }
export function initializeAuth(...x) { return conectar(_initializeAuth(...x)); }
`;
    case 'firestore':
      return marca + `export * from "${real}";
import { getFirestore as _getFirestore, initializeFirestore as _initializeFirestore, connectFirestoreEmulator } from "${real}";
const conectadas = new WeakSet();
function conectar(db) { if (!conectadas.has(db)) { conectadas.add(db); connectFirestoreEmulator(db, "127.0.0.1", ${p.firestore}); } return db; }
export function getFirestore(...x) { return conectar(_getFirestore(...x)); }
export function initializeFirestore(...x) { return conectar(_initializeFirestore(...x)); }
`;
    case 'storage':
      return marca + `export * from "${real}";
import { getStorage as _getStorage, connectStorageEmulator } from "${real}";
const conectadas = new WeakSet();
function conectar(s) { if (!conectadas.has(s)) { conectadas.add(s); connectStorageEmulator(s, "127.0.0.1", ${p.storage}); } return s; }
export function getStorage(...x) { return conectar(_getStorage(...x)); }
`;
    case 'analytics':
      return marca + `export const getAnalytics = () => ({});
export const initializeAnalytics = () => ({});
export const logEvent = () => {};
export const isSupported = async () => false;
`;
    default:
      throw new Error('módulo no soportado: ' + modulo);
  }
}

export function reescribirSdk(texto) {
  return texto.replace(SDK, (_, version, modulo) => `/__emuladores__/${version}/firebase-${modulo}.js`);
}

async function responder(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const env = url.pathname.match(/^\/__emuladores__\/(\d+\.\d+\.\d+)\/firebase-(app|auth|firestore|storage|analytics)\.js$/);
  if (env) {
    res.writeHead(200, { 'content-type': TIPOS['.js'], 'cache-control': 'no-store' });
    return res.end(envoltorio(env[1], env[2]));
  }
  const ruta = REESCRITURAS[url.pathname] || decodeURIComponent(url.pathname);
  const archivo = normalize(join(PUBLIC, ruta));
  if (!archivo.startsWith(PUBLIC + sep)) { res.writeHead(403); return res.end('Prohibido'); }
  try {
    const info = await stat(archivo);
    if (!info.isFile()) throw new Error('no es archivo');
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end('No existe: ' + ruta);
  }
  const ext = extname(archivo).toLowerCase();
  const tipo = TIPOS[ext] || 'application/octet-stream';
  let cuerpo = await readFile(archivo);
  if (ext === '.html' || ext === '.js' || ext === '.mjs') cuerpo = reescribirSdk(cuerpo.toString('utf8'));
  res.writeHead(200, { 'content-type': tipo, 'cache-control': 'no-store' });
  res.end(cuerpo);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === normalize(process.argv[1])) {
  const servidor = createServer((req, res) => { responder(req, res).catch((e) => { res.writeHead(500); res.end(String(e.message)); }); });
  servidor.on('error', (e) => {
    console.error(e.code === 'EADDRINUSE' ? `ABORTADO: el puerto ${P.sitio} está ocupado. Usa otro GC_OFFSET. No se detuvo ningún proceso.` : e.message);
    process.exit(1);
  });
  servidor.listen(P.sitio, '127.0.0.1', () => {
    console.log(`Backoffice local: http://localhost:${P.sitio}/login-ops.html`);
    console.log(`Emuladores (${PROYECTO}): Auth 127.0.0.1:${P.auth} · Firestore 127.0.0.1:${P.firestore} · Storage 127.0.0.1:${P.storage}`);
    console.log('Ctrl+C para detener.');
  });
}
