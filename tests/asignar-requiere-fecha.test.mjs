// Regla: una visita sin fecha programada no se asigna a un operador y no aparece en Mis Trabajos.
// Prueba estática sobre el código de las páginas (sin navegador ni Firebase).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (f) => readFileSync(join(RAIZ, 'public', f), 'utf8');

test('Órdenes de Servicio: asignar un operador exige fecha programada en la visita', () => {
  const src = leer('ordenes.html');
  assert.match(src, /opSeleccionado !== "Sin asignar" && !itemEditando\.tieneFechaGuardada/);
  assert.match(src, /Programa primero la fecha de esta visita antes de asignarle un operador\./);
  // la guarda va antes de cualquier escritura de la asignación en Firestore
  assert.ok(src.indexOf('!itemEditando.tieneFechaGuardada') < src.indexOf('operadoresPorVisita.${itemEditando.claveVisita}'));
});

test('Mis Trabajos: una visita sin fecha programada no se lista', () => {
  const src = leer('mis-trabajos.html');
  assert.match(src, /const fProg = fechasGuardadas\[idx\] \|\| fechasGuardadas\[0\];\r?\n(\s*\/\/[^\r\n]*\r?\n)?\s*if \(!fProg\) continue;/);
  // el filtro va antes de empujar la visita a la lista
  assert.ok(src.indexOf('if (!fProg) continue;') < src.indexOf('fechaProgramada: fProg,'));
});

test('«Sin asignar» siempre se permite (liberar una visita no depende de la fecha)', () => {
  assert.match(leer('ordenes.html'), /opSeleccionado !== "Sin asignar" &&/);
});
