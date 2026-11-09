// Verificación por LECTURA del sitio publicado gravecare-ops contra un commit o tag (directriz B-1/B-2).
// Solo hace GET de archivos estáticos públicos; no lee datos ni usa credenciales.
//
//   node scripts/verificar-sitio-publicado.mjs ops-2            (compara con el tag ops-2)
//   node scripts/verificar-sitio-publicado.mjs main https://gravecare-ops.web.app
//
// Sale con código 1 si algún archivo publicado difiere del commit indicado.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const ref = process.argv[2] || 'HEAD';
const sitio = (process.argv[3] || 'https://gravecare-ops.web.app').replace(/\/$/, '');
const git = (...a) => execFileSync('git', a, { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
const sha = (b) => createHash('sha256').update(b).digest('hex').slice(0, 12);

// Mismas exclusiones que firebase.json (hosting.ignore): archivos ocultos y node_modules.
const archivos = git('ls-tree', '-r', '--name-only', ref, '--', 'public').toString('utf8').split('\n')
  .filter(Boolean).filter((p) => !p.split('/').some((s) => s.startsWith('.')) && !p.includes('node_modules/'));

let distintos = 0, faltan = 0;
for (const ruta of archivos) {
  const local = git('show', `${ref}:${ruta}`);
  const url = `${sitio}/${ruta.replace(/^public\//, '')}`;
  let r;
  try { r = await fetch(url, { cache: 'no-store' }); } catch (e) { console.log(`✗ ${ruta}: sin respuesta (${e.message})`); faltan++; continue; }
  if (r.status !== 200) { console.log(`✗ ${ruta}: HTTP ${r.status}`); faltan++; continue; }
  const publicado = Buffer.from(await r.arrayBuffer());
  // git guarda LF; se compara normalizando finales de línea en archivos de texto.
  const norm = (b) => (/\.(html|js|mjs|css|json|txt|svg)$/.test(ruta) ? Buffer.from(b.toString('utf8').replace(/\r\n/g, '\n')) : b);
  if (sha(norm(local)) !== sha(norm(publicado))) { console.log(`≠ ${ruta}: repo ${sha(norm(local))} · publicado ${sha(norm(publicado))}`); distintos++; }
}
console.log(`\n${archivos.length} archivos de public/ en ${ref} · ${distintos} distintos · ${faltan} sin publicar o con error · sitio ${sitio}`);
process.exit(distintos || faltan ? 1 : 0);
