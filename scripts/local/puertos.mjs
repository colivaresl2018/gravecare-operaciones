// Puertos del entorno local del backoffice (directriz B-1). Se apoya en los emuladores del repo de la web
// (C:\Proyectos\Gravecare, `npm run local`), que desplazan TODOS sus puertos con GC_OFFSET.
// - GC_OFFSET=0: emuladores del dueño (los que abre `npm run local` sin desplazamiento).
// - GC_OFFSET=800 (u otro): emuladores de pruebas automáticas, sin tocar los del dueño.
// El proyecto del emulador es siempre uno «demo-*»: el SDK nunca puede llegar a un proyecto real.

export const BASE_EMULADORES = { firestore: 8080, auth: 9099, storage: 9199 };
export const BASE_SITIO_BACKOFFICE = 5050; // propio del backoffice; no es un puerto por defecto de la web

export function desplazamiento(env = process.env) {
  const n = Number(env.GC_OFFSET || 0);
  if (!Number.isInteger(n) || n < 0 || n > 50000) throw new Error('GC_OFFSET debe ser un entero entre 0 y 50000');
  return n;
}

export function proyectoEmulador(env = process.env) {
  const p = env.GC_PROYECTO_EMULADOR || 'demo-gravecare';
  if (!/^demo-[a-z0-9-]+$/.test(p)) throw new Error(`El proyecto del emulador debe empezar por «demo-» (recibido «${p}»). Nunca se apunta a un proyecto real.`);
  return p;
}

export function puertos(off) {
  return {
    sitio: BASE_SITIO_BACKOFFICE + off,
    firestore: BASE_EMULADORES.firestore + off,
    auth: BASE_EMULADORES.auth + off,
    storage: BASE_EMULADORES.storage + off,
  };
}
