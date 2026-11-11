// Regla: asignar un operador exige una fecha (la que muestra Órdenes de Servicio),
// y Mis Trabajos muestra SIEMPRE las visitas asignadas, con esa misma fecha o «Por coordinar».
// Prueba estática sobre el código de las páginas (sin navegador ni Firebase).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (f) => readFileSync(join(RAIZ, 'public', f), 'utf8');

test('Órdenes de Servicio: asignar un operador exige fecha en la visita', () => {
  const src = leer('ordenes.html');
  assert.match(src, /opSeleccionado !== "Sin asignar" && !itemEditando\.tieneFechaGuardada/);
  assert.match(src, /Programa primero la fecha de esta visita antes de asignarle un operador\./);
  // la guarda va antes de cualquier escritura de la asignación en Firestore
  assert.ok(src.indexOf('!itemEditando.tieneFechaGuardada') < src.indexOf('operadoresPorVisita.${itemEditando.claveVisita}'));
});

test('Mis Trabajos: usa la misma fecha que Órdenes de Servicio (fechaGuardadaVisita primero)', () => {
  const src = leer('mis-trabajos.html');
  assert.match(src, /import \{ fechaGuardadaVisita \} from "\.\/js\/fechas-visita\.js"/);
  assert.match(src, /const fProg = fechaGuardadaVisita\(d, claveVisita\) \|\| fechasGuardadas\[idx\] \|\| fechasGuardadas\[0\] \|\| null;/);
});

test('Mis Trabajos: una visita asignada siempre se lista, aunque no tenga fecha', () => {
  const src = leer('mis-trabajos.html');
  assert.doesNotMatch(src, /if \(!fProg\) continue;/);
  assert.match(src, /if \(!f\) return "Por coordinar";/);
});

test('«Sin asignar» siempre se permite (liberar una visita no depende de la fecha)', () => {
  assert.match(leer('ordenes.html'), /opSeleccionado !== "Sin asignar" &&/);
});

test('Órdenes de Servicio: la fecha de la visita se puede cambiar desde su casilla', () => {
  const src = leer('ordenes.html');
  assert.match(src, /<input type="date" value="\$\{valorFechaInput\(item\.fechaEstimada\)\}" onchange="window\.cambiarFechaVisita\(/);
  assert.match(src, /import \{ fechaGuardadaVisita, guardarFechaVisitaEnOrden \} from "\.\/js\/fechas-visita\.js"/);
  assert.match(src, /window\.cambiarFechaVisita = async function\(idVisitaCompleto, valor\)/);
  // la escritura pasa por el helper aislado (solo fechasPorVisita y punteros), nunca por el arreglo completo
  assert.match(src, /await guardarFechaVisitaEnOrden\(\{ actualizar: updateDoc/);
  // lectura de fechasProgramadas sigue existiendo; lo que no puede existir es escribirla
  assert.doesNotMatch(src, /updateDoc\([^;]*fechasProgramadas/);
});
