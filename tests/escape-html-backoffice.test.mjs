// AUD-01 (crítico): los datos de Firestore (órdenes, informes, clientes, staff) los escribe el navegador de quien compra
// y NO son de confianza. Toda interpolación de un dato dentro de una plantilla HTML debe pasar por esc().
// Prueba estática: recorre los <script> de cada página, encuentra las plantillas con HTML y falla si alguna
// interpola un dato (item.campo, inf.campo, err.message…) sin esc(), o lo mete en un manejador inline (onclick="f('${…}')").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(RAIZ, 'public');

/** Devuelve las plantillas (`...`) del código con su texto literal y sus interpolaciones, respetando anidación,
 *  comentarios, cadenas y expresiones regulares. */
export function analizarPlantillas(src) {
  const plantillas = [];
  const n = src.length;
  let i = 0;

  function codigo(hastaLlave) {
    let prof = 0;
    let ultimo = '';
    while (i < n) {
      const c = src[i];
      if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
      if (c === '/' && src[i + 1] === '*') { const f = src.indexOf('*/', i + 2); i = f < 0 ? n : f + 2; continue; }
      if (c === '"' || c === "'") {
        i++;
        while (i < n && src[i] !== c && src[i] !== '\n') { if (src[i] === '\\') i++; i++; }
        i++; ultimo = c; continue;
      }
      if (c === '`') { plantilla(); ultimo = '`'; continue; }
      if (c === '/' && (ultimo === '' || '(,=:[!&|?{};'.includes(ultimo))) {
        i++;
        let clase = false;
        while (i < n && src[i] !== '\n') {
          const d = src[i];
          if (d === '\\') { i += 2; continue; }
          if (d === '[') clase = true; else if (d === ']') clase = false; else if (d === '/' && !clase) break;
          i++;
        }
        i++;
        while (i < n && /[a-z]/.test(src[i])) i++;
        ultimo = '/'; continue;
      }
      if (c === '{') prof++;
      if (c === '}') { if (hastaLlave && prof === 0) return; prof--; }
      if (!/\s/.test(c)) ultimo = c;
      i++;
    }
  }

  function plantilla() {
    const inicio = i;
    i++;
    let texto = '';
    const interpolaciones = [];
    while (i < n && src[i] !== '`') {
      if (src[i] === '\\') { texto += src.slice(i, i + 2); i += 2; continue; }
      if (src[i] === '$' && src[i + 1] === '{') {
        i += 2;
        const ini = i;
        codigo(true);
        interpolaciones.push(src.slice(ini, i).trim());
        texto += `\u0000${interpolaciones.length - 1}\u0000`;
        i++;
        continue;
      }
      texto += src[i]; i++;
    }
    i++;
    plantillas.push({ texto, interpolaciones, linea: src.slice(0, inicio).split('\n').length });
  }

  codigo(false);
  return plantillas;
}

/** Scripts en línea (sin src) de una página HTML. */
function scriptsEnLinea(html) {
  const salida = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) if (!/\bsrc\s*=/.test(m[1])) salida.push(m[2]);
  return salida;
}

// Raíces de variables que contienen datos de Firestore, de la URL o de errores.
const RAICES = '(?:item|inf|m|v|s|op|o|c|l|d|x|a|datos|err|msg|orden|cliente|informe|visita|titular|difunto)';
// Una interpolación "desnuda": solo una cadena de propiedades, con un valor por defecto opcional (item.campo || 'x').
const DATO_DESNUDO = new RegExp(
  `^${RAICES}(?:\\??\\.[\\w$]+|\\[[^\\]]+\\])*(?:\\s*\\|\\|\\s*(?:'[^']*'|"[^"]*"|[\\w$.]+))?$`
);

// En un manejador inline solo se admite un valor numérico (un índice o Number(...)): no puede cerrar la cadena ni inyectar JS.
const NUMERICA_SEGURA = /^(?:idx|i|index|Number\([^()]*\))$/;

// Interpolaciones que llevan HTML generado por la propia página (no datos del usuario). Cada una con su motivo.
const PERMITIDAS = new Map([
  ['clientes.html', new Set(['item.estadoServicioHtml'])], // armado en la misma página solo con números (visitas realizadas/total)
]);

function infracciones(archivo) {
  const html = readFileSync(join(PUBLIC, archivo), 'utf8');
  const permitidas = PERMITIDAS.get(archivo) ?? new Set();
  const problemas = [];
  for (const script of scriptsEnLinea(html)) {
    for (const p of analizarPlantillas(script)) {
      if (!p.texto.includes('<')) continue; // no es HTML (mensajes de texto, rutas, etc.)
      p.interpolaciones.forEach((expr, k) => {
        if (DATO_DESNUDO.test(expr) && !permitidas.has(expr)) {
          problemas.push(`${archivo}: \${${expr}} va sin esc() dentro de una plantilla HTML`);
        }
        // Manejador inline con una interpolación: el escape de HTML no protege dentro de JS (la entidad se decodifica antes).
        const marcador = new RegExp(`on[a-z]+\\s*=\\s*"[^"]*\\u0000${k}\\u0000`, 'i');
        if (marcador.test(p.texto) && !NUMERICA_SEGURA.test(expr)) {
          problemas.push(`${archivo}: \${${expr}} está dentro de un manejador inline (on…="…"); usa data-* y this.dataset`);
        }
      });
    }
  }
  return problemas;
}

const PAGINAS = readdirSync(PUBLIC).filter((f) => f.endsWith('.html'));

test('el analizador de plantillas entiende anidación, comentarios, cadenas y expresiones regulares', () => {
  const src = [
    "const a = `<b>${item.nombre}</b>`; // `no es plantilla`",
    "const r = /[&<>\"']/g; const t = `<i>${esc(`<u>${x.y}</u>`)}</i>`;",
    "const s = 'una `cadena`'; const u = `texto ${a ? `<p>${b.c}</p>` : ''}`;",
  ].join('\n');
  const p = analizarPlantillas(src);
  const textos = p.map((x) => x.interpolaciones.join('|'));
  assert.ok(textos.includes('item.nombre'));
  assert.ok(textos.includes('x.y'));
  assert.ok(textos.includes('b.c'));
  assert.equal(p.length, 5, 'encuentra las 5 plantillas (incluidas las anidadas) y ninguna falsa');
});

test('el detector marca los datos sin escapar y deja pasar los escapados', () => {
  for (const malo of ['item.nombre', "item.nombre || 'Sin nombre'", 'inf.ubicacion.sector', 'err.message', 'v["x"]']) {
    assert.ok(DATO_DESNUDO.test(malo), `debería marcar ${malo}`);
  }
  for (const bueno of ['esc(item.nombre)', "esc(item.nombre || 'x')", 'formatearDinero(m.total)', 'item.esPrueba ? INSIGNIA_PRUEBA : ""', 'colorTipo', 'filtrados.length']) {
    assert.ok(!DATO_DESNUDO.test(bueno), `no debería marcar ${bueno}`);
  }
});

test('el analizador no está ciego: encuentra las plantillas HTML de las páginas con tablas', () => {
  const minimo = { 'ordenes.html': 3, 'clientes.html': 3, 'planificacion.html': 5, 'todos-los-trabajos.html': 2, 'trabajos-terminados.html': 2, 'mis-trabajos.html': 2, 'mapa.html': 1, 'informe-revision.html': 3, 'admin-usuarios.html': 2, 'gastos-ingresos.html': 4 };
  for (const [archivo, n] of Object.entries(minimo)) {
    const html = readFileSync(join(PUBLIC, archivo), 'utf8');
    const conHtml = scriptsEnLinea(html).flatMap(analizarPlantillas).filter((p) => p.texto.includes('<') && p.interpolaciones.length > 0);
    assert.ok(conHtml.length >= n, `${archivo}: se esperaban ≥${n} plantillas HTML con datos, se leyeron ${conHtml.length}`);
  }
});

test('hay páginas que revisar', () => {
  assert.ok(PAGINAS.length >= 10, `se esperaban al menos 10 páginas, hay ${PAGINAS.length}`);
});

for (const archivo of PAGINAS) {
  test(`AUD-01: ${archivo} no interpola datos sin escapar en HTML`, () => {
    const problemas = infracciones(archivo);
    assert.deepEqual(problemas, [], `\n${problemas.join('\n')}\n`);
  });
}

test('toda página que usa esc() importa html-seguro.js (o define la suya)', () => {
  for (const archivo of PAGINAS) {
    const html = readFileSync(join(PUBLIC, archivo), 'utf8');
    if (!/\besc\(/.test(html)) continue;
    const importa = html.includes('./js/html-seguro.js');
    const propia = /function esc\(/.test(html);
    assert.ok(importa || propia, `${archivo} llama a esc() sin importarla`);
  }
});

test('los textos que van al menú del operador siguen usando textContent (no HTML)', () => {
  const html = readFileSync(join(PUBLIC, 'mis-trabajos.html'), 'utf8');
  assert.ok(/getElementById\("obs-rechazo-texto"\)\.textContent/.test(html));
});
