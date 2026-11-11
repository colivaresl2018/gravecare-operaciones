// Modal «Ver Informe» de trabajos-terminados.html: debe mostrar las 4 fotos reales del protocolo, igual que informe-revision.html.
// Ejecutar: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolverFotosInforme, TITULOS_FOTOS } from '../public/js/fotos-informe.js';

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const lee = (p) => readFileSync(join(PUBLIC, p), 'utf8').replace(/\r/g, '');

/** Informe del caso reportado (#ORD-1794357459960709-V1) tal como lo guarda informe-captura.html. */
const informeReportado = {
  informeId: 'ORD-1794357459960709-V1', estado: 'aprobado',
  fotos: { inicial: 'data:image/jpeg;base64,A', finalizado: 'data:image/jpeg;base64,B', ornamentacion: 'data:image/jpeg;base64,C', panoramica: 'data:image/jpeg;base64,D', antes: 'data:image/jpeg;base64,A', despues: 'data:image/jpeg;base64,B' },
};

/** Simula lo que hace el modal: por cada foto resuelta, <img> visible o el texto «Sin fotografía registrada». */
function renderizarModal(inf) {
  const fotos = resolverFotosInforme(inf);
  return fotos.map((f) => (f.url ? `<img alt="${f.titulo}" src="${f.url}">` : '<div>Sin fotografía registrada</div>')).join('');
}

test('el informe con las 4 fotos del protocolo muestra 4 imágenes y ninguna «Sin fotografía registrada»', () => {
  const html = renderizarModal(informeReportado);
  assert.equal((html.match(/<img /g) || []).length, 4);
  assert.doesNotMatch(html, /Sin fotografía registrada/);
  for (const t of TITULOS_FOTOS) assert.ok(html.includes(t), t);
});

test('trabajos-terminados.html: el modal tiene las 4 tarjetas y usa el módulo compartido', () => {
  const h = lee('trabajos-terminados.html');
  assert.match(h, /import \{ resolverFotosInforme \} from "\.\/js\/fotos-informe\.js"/);
  for (let n = 1; n <= 4; n++) {
    assert.match(h, new RegExp(`id="inf-foto-${n}"`));
    assert.match(h, new RegExp(`id="inf-sin-foto-${n}"`));
    assert.match(h, new RegExp(`id="inf-titulo-foto-${n}"`));
  }
  for (const t of ['1. Estado Inicial', '2. Finalizado', '3. Ornamentación', '4. Vista Panorámica']) assert.ok(h.includes(t), t);
  assert.match(h, /resolverFotosInforme\(inf\)/);
});

test('trabajos-terminados.html: ya no lee el esquema antiguo de 2 + 2 fotos directamente', () => {
  const h = lee('trabajos-terminados.html');
  for (const viejo of ['inf-foto-antes-1', 'inf-foto-antes-2', 'inf-foto-despues-1', 'inf-foto-despues-2', 'inf-sin-antes-', 'inf-sin-despues-']) {
    assert.ok(!h.includes(viejo), `quedó ${viejo}`);
  }
  assert.doesNotMatch(h, /let antes1 =/);
  assert.doesNotMatch(h, /Estado Inicial \(Antes\) - 2 Fotografías/);
});

test('la resolución del módulo cubre los mismos campos que informe-revision.html', () => {
  const rev = lee('informe-revision.html');
  for (const campo of ['fotos.inicial', 'fotos.antes', 'inf.fotoInicial', 'fotos.finalizado', 'fotos.despues', 'inf.fotoFinal',
    'fotos.ornamentacion', 'fotos.flores', 'inf.fotoOrnamentacion', 'fotos.panoramica', 'fotos.general', 'inf.fotoPanoramica']) {
    assert.ok(rev.includes(campo), `informe-revision.html ya no usa ${campo}: revisar fotos-informe.js`);
  }
  // Y el módulo, con esos mismos alias, devuelve lo mismo que la pantalla de revisión.
  const viaAlias = resolverFotosInforme({ fotos: { antes: 'a', despues: 'b', flores: 'c', general: 'd' } });
  assert.deepEqual(viaAlias.map((f) => f.url), ['a', 'b', 'c', 'd']);
});
