// html-seguro.js — escape de datos antes de interpolarlos en innerHTML o en atributos (AUD-01).
// Ejecutar: node --test public/js/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escaparHtml, esc } from './html-seguro.js';

test('escapa los cinco caracteres peligrosos y la comilla invertida', () => {
  assert.equal(escaparHtml(`<img src=x onerror="alert('x')">`), '&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;');
  assert.equal(escaparHtml('a & b'), 'a &amp; b');
  assert.equal(escaparHtml('`x`'), '&#96;x&#96;');
});

test('no escapa dos veces lo ya escapado a mano: cada & se convierte una sola vez', () => {
  assert.equal(escaparHtml('&lt;'), '&amp;lt;');
});

test('null, undefined, números y booleanos no rompen ni muestran «undefined»', () => {
  assert.equal(escaparHtml(null), '');
  assert.equal(escaparHtml(undefined), '');
  assert.equal(escaparHtml(0), '0');
  assert.equal(escaparHtml(false), 'false');
});

test('un nombre normal (tildes, ñ, guiones, apóstrofe) se conserva legible', () => {
  assert.equal(escaparHtml('María José Muñoz-Núñez'), 'María José Muñoz-Núñez');
});

test('el resultado no contiene nada que el navegador interprete como etiqueta ni como comilla de atributo', () => {
  const hostil = `"><script src=//x></script><svg/onload=alert(1)>'`;
  const r = escaparHtml(hostil);
  assert.ok(!/[<>"']/.test(r));
});

test('esc es un alias corto de escaparHtml', () => {
  assert.equal(esc('<b>'), escaparHtml('<b>'));
});
