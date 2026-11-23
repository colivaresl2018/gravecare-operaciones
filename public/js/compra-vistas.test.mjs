import test from 'node:test';
import assert from 'node:assert/strict';
import { construirListaCompra } from './compra-ramos.js';
import { htmlCuerpoCompra, htmlResumenCompra, textosAvisosCompra, htmlFormularioValores } from './compra-vistas.js';

const LUNES = '2026-11-16';
const fila = (extra) => ({ docId: 'o1', cementerio: 'Cementerio A', nivel: 'Standard', ramosAdicionales: 0, terminada: false, esTentativa: false, fechaIso: '2026-11-16', ...extra });
const VALORES = { standard: 10000, premium: 15000, deluxe: 25000, adicionalStandard: 8000, adicionalPremium: 12000 };

test('htmlCuerpoCompra: cada día con visitas muestra su cementerio, las líneas con precio y el total', () => {
  const lista = construirListaCompra([fila({ ramosAdicionales: 1 })], { lunesIso: LUNES, valores: VALORES });
  const html = htmlCuerpoCompra(lista);
  assert.match(html, /Lunes/);
  assert.match(html, /16\/11\/2026/);
  assert.match(html, /Cementerio A/);
  assert.match(html, /1 Ramo Standard/);
  assert.match(html, /\$10\.000/);
  assert.match(html, /1 Ramo Adicional Standard/);
  assert.match(html, /\$8\.000/);
  assert.match(html, /\$18\.000/); // total del día
});

test('htmlCuerpoCompra: sin valor se dice «sin valor» y el total se marca incompleto (no se muestra $0 inventado)', () => {
  const lista = construirListaCompra([fila({ nivel: 'Premium', ramosAdicionales: 1 })], { lunesIso: LUNES, valores: { premium: 15000 } });
  const html = htmlCuerpoCompra(lista);
  assert.match(html, /sin valor/i);
  assert.match(html, /incompleto/i);
  assert.doesNotMatch(html, /\$0\b/);
});

test('htmlCuerpoCompra: los días de lunes a viernes sin visitas aparecen vacíos; sábado y domingo solo si tienen', () => {
  const sinFin = htmlCuerpoCompra(construirListaCompra([fila({})], { lunesIso: LUNES, valores: VALORES }));
  assert.match(sinFin, /Martes/);
  assert.match(sinFin, /Sin visitas/);
  assert.doesNotMatch(sinFin, /Sábado|Domingo/);
  const conSabado = htmlCuerpoCompra(construirListaCompra([fila({ fechaIso: '2026-11-21' })], { lunesIso: LUNES, valores: VALORES }));
  assert.match(conSabado, /Sábado/);
  assert.doesNotMatch(conSabado, /Domingo/);
});

test('htmlCuerpoCompra: un cementerio con HTML se muestra literal (AUD-01)', () => {
  const html = htmlCuerpoCompra(construirListaCompra([fila({ cementerio: '<img src=x onerror=alert(1)>' })], { lunesIso: LUNES, valores: VALORES }));
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img/);
});

test('htmlCuerpoCompra: una lista sin días no rompe', () => {
  assert.equal(typeof htmlCuerpoCompra(construirListaCompra([], { lunesIso: 'x' })), 'string');
});

test('htmlResumenCompra: total de la semana, visitas y ramos; avisa si es incompleto', () => {
  const completa = htmlResumenCompra(construirListaCompra([fila({}), fila({ docId: 'b', nivel: 'Deluxe', fechaIso: '2026-11-17' })], { lunesIso: LUNES, valores: VALORES }));
  assert.match(completa, /\$35\.000/);
  assert.match(completa, /2 visitas/);
  assert.match(completa, /2 ramos|ramos/i);
  assert.doesNotMatch(completa, /incompleto/i);
  const incompleta = htmlResumenCompra(construirListaCompra([fila({})], { lunesIso: LUNES, valores: {} }));
  assert.match(incompleta, /incompleto/i);
});

test('textosAvisosCompra: falta de valores, visitas sin fecha y tentativas', () => {
  const lista = construirListaCompra([fila({ esTentativa: true }), fila({ docId: 'b', fechaIso: null })], { lunesIso: LUNES, valores: {} });
  const t = textosAvisosCompra(lista).join(' | ');
  assert.match(t, /Ramo Standard/);
  assert.match(t, /sin valor/i);
  assert.match(t, /1 visita no tiene fecha/);
  assert.match(t, /1 visita tiene fecha tentativa/);
  assert.deepEqual(textosAvisosCompra(construirListaCompra([fila({})], { lunesIso: LUNES, valores: VALORES })), []);
});

test('htmlFormularioValores: un campo por tipo de ramo, con el valor guardado (o vacío) y su etiqueta', () => {
  const html = htmlFormularioValores({ standard: 10000, premium: null, deluxe: 0, adicionalStandard: null, adicionalPremium: 12000 });
  for (const clave of ['standard', 'premium', 'deluxe', 'adicionalStandard', 'adicionalPremium']) {
    assert.match(html, new RegExp(`data-clave="${clave}"`));
  }
  assert.equal((html.match(/class="valor-input/g) || []).length, 5);
  assert.match(html, /value="10000"/);
  assert.match(html, /value="0"/);
  assert.match(html, /value="12000"/);
  assert.match(html, /Ramo Adicional Premium/);
  assert.equal((html.match(/value=""/g) || []).length, 2); // premium y adicionalStandard sin valor
  assert.match(html, /Sin valor/);
});


// ---- Spec 057: orden de compra por día dentro de «Compra de flores» ----
import { estadoDiasCompra } from './compra-dia.js';

test('htmlCuerpoCompra con órdenes: cada día con visitas trae su acción «Crear orden de compra»; sin órdenes la tabla no cambia (spec 057)', () => {
  const lista = construirListaCompra([
    { fechaIso: '2026-12-01', cementerio: 'Cementerio X', nivel: 'Standard', ramosAdicionales: 0, terminada: false, esTentativa: false },
    { fechaIso: '2026-12-02', cementerio: 'Cementerio Y', nivel: 'Premium', ramosAdicionales: 0, terminada: false, esTentativa: false },
  ], { lunesIso: '2026-11-30', valores: { standard: 10000, premium: null } });
  const rutaDe = (c) => (c === 'Cementerio X' ? { eje: 'Eje 1', diaSemana: 2 } : null);
  const sinOrdenes = htmlCuerpoCompra(lista);
  assert.ok(!sinOrdenes.includes('crear-oc-dia'));
  const estados = estadoDiasCompra(lista, { rutaDe });
  const html = htmlCuerpoCompra(lista, { ordenes: estados, puedeCrear: true });
  assert.match(html, /data-accion="crear-oc-dia" data-fecha="2026-12-01"[^>]*>/);
  assert.ok(!/data-fecha="2026-12-01"[^>]*\sdisabled(?=[\s>])/.test(html), 'martes listo: habilitado');
  assert.match(html, /data-fecha="2026-12-02"[^>]*\sdisabled(?=[\s>])/);
  assert.match(html, /Sin eje y día de ruta: Cementerio Y\./);
  assert.match(html, /Falta el valor de «1 Ramo Premium» en Valores de ramos\./);
  // un día sin visitas no trae botón (lunes)
  assert.ok(!html.includes('data-fecha="2026-11-30"'));
});
