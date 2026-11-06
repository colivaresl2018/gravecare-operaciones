// scripts/crear-staff-qa.js — crea (o busca) un usuario de staff de PRUEBA en gravecare-qa y le asigna el claim staffActivo: true.
// SOLO opera sobre el proyecto de QA. Nunca imprime la clave.
//
// Uso (PowerShell, con las credenciales de Firebase CLI / gcloud ya configuradas):
//   $env:CLAVE_QA_STAFF = "<clave de prueba, mínimo 6 caracteres>"
//   $env:NODE_PATH = "C:\Proyectos\Gravecare\node_modules"    # firebase-admin ya instalado en el repo Gravecare
//   node scripts\crear-staff-qa.js                 # solo muestra lo que haría
//   node scripts\crear-staff-qa.js --confirmar     # escribe en QA
//
// Notas:
// - Si el usuario ya existe, no se toca su clave: solo se asigna el claim.
// - El claim se lee en el token al refrescarlo; exigirStaff fuerza ese refresco al entrar.
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

const PROYECTO_QA = 'gravecare-qa';
const EMAIL = 'qa-staff@gravecare.cl';
const confirmar = process.argv.includes('--confirmar');

const enmascarar = (uid) => `${String(uid).slice(0, 4)}****`;

async function main() {
  const clave = process.env.CLAVE_QA_STAFF || '';
  const auth = getAuth(initializeApp({ credential: applicationDefault(), projectId: PROYECTO_QA }, 'crear-staff-qa'));

  let usuario = null;
  try {
    usuario = await auth.getUserByEmail(EMAIL);
  } catch (e) {
    if (e.code !== 'auth/user-not-found') throw e;
  }

  if (!usuario) {
    if (clave.length < 6) {
      console.error('Falta CLAVE_QA_STAFF (mínimo 6 caracteres) para crear el usuario.');
      process.exitCode = 2;
      return;
    }
    console.log(`Haría: crear el usuario ${EMAIL} en ${PROYECTO_QA} y asignarle staffActivo: true.`);
    if (!confirmar) { console.log('Nada escrito. Añade --confirmar para crear y asignar el claim.'); return; }
    usuario = await auth.createUser({ email: EMAIL, password: clave, emailVerified: true, displayName: 'Staff QA (prueba)' });
    console.log(`Usuario creado en ${PROYECTO_QA} (uid ${enmascarar(usuario.uid)}).`);
  } else {
    console.log(`Haría: asignar staffActivo: true al usuario existente ${EMAIL} (uid ${enmascarar(usuario.uid)}) en ${PROYECTO_QA}.`);
    if (!confirmar) { console.log('Nada escrito. Añade --confirmar para asignar el claim.'); return; }
  }

  await auth.setCustomUserClaims(usuario.uid, { staffActivo: true });
  const verificado = (await auth.getUser(usuario.uid)).customClaims || {};
  console.log(`Claims asignados en ${PROYECTO_QA}: staffActivo=${verificado.staffActivo === true}`);
}

main().catch((e) => {
  console.error(`ERROR: ${e && e.code ? e.code : 'desconocido'}. No se muestran datos sensibles.`);
  process.exitCode = 1;
});
