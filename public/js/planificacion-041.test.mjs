// Spec 041 · planificacion.html: integración de estados y guardado atómico de operadores.
// Prueba estática sobre el HTML (sin navegador). Ejecutar: node --test public/js/planificacion-041.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync('public/planificacion.html', 'utf8').replace(/\r\n/g, '\n');

test('041 · planificación importa la lógica de estados y la persistencia aditiva', () => {
  assert.match(src, /from "\.\/js\/estados-visita\.js"/);
  assert.match(src, /from "\.\/js\/estados-visita-db\.js"/);
});

test('041 · el modal guarda SOLO la clave de la visita en operadoresPorVisita (sin reemplazar el mapa)', () => {
  assert.match(src, /\[`operadoresPorVisita\.\$\{item\.claveVisita\}`\]: opVal/);
  assert.doesNotMatch(src, /operadoresPorVisita: item \? item\.operadoresPorVisita : \{\}/);
});

test('041 · ninguna escritura a Firestore reemplaza operadoresPorVisita completo', () => {
  const llamadas = [...src.matchAll(/updateDoc\(([\s\S]*?)\}\);/g)].map((m) => m[1]);
  assert.ok(llamadas.length > 0);
  for (const l of llamadas) {
    assert.doesNotMatch(l, /(^|[\s,{])operadoresPorVisita:\s*(\{|item\b|\{\s*\.\.\.)/, l.slice(0, 80));
  }
});

test('041 · el cambio de fecha reprograma solo si la visita estaba asignada o en ejecución', () => {
  assert.match(src, /\["asignado", "en_ejecucion"\]\.includes\(item\.estado\)/);
  assert.match(src, /estadoNuevo: "reprogramada"/);
});

test('041 · filtro de control presente y las visitas completadas siguen visibles en el Gantt', () => {
  assert.match(src, /id="filtro-control"/);
  assert.match(src, /cumpleFiltro\(etiquetasDe\(item\), ctrl\)/);
  assert.doesNotMatch(src, /item\.estado === "completada"\) return false/);
});

test('041 · las órdenes sin fecha guardada no se clasifican por las fechas de relleno', () => {
  assert.match(src, /fechaProgramada: item\.tieneFechaGuardada \? item\.proximaVisita : null/);
});

test('041 · cada color del Gantt corresponde a un estado y las pendientes conservan su tarjeta', () => {
  for (const e of ['asignado', 'en_ejecucion', 'completada', 'reprogramada']) assert.match(src, new RegExp(`${e}: \\[`));
  assert.match(src, /item\.estado && item\.estado !== "pendiente"/);
});
