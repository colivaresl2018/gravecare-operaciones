import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALCANCES, idDeCementerio, idDeRuta, validarRuta, prepararLoteRutas, validarFeriado, parsearFeriados,
  permisosDeStaff, estaActivo, cementeriosDeOrdenes, filasDeRutas, resumenDeRutas,
  CEMENTERIOS_OFICIALES, gruposDeCatalogo,
} from './config-planificacion.js';
import { CATALOGO_CEMENTERIOS } from './ubicacion-trabajo.js';
import { normalizarNombre } from './rutas-planificacion.js';

// ─── ids de rutas ────────────────────────────────────────────────────────────────────────────────────────────────

test('idDeCementerio: nombre sin tildes ni símbolos, en minúsculas y con guiones', () => {
  assert.equal(idDeCementerio('Parque Canaán de Pudahuel'), 'parque-canaan-de-pudahuel');
  assert.equal(idDeCementerio('Cementerio Municipal N° 1 de Rancagua'), 'cementerio-municipal-n-1-de-rancagua');
  assert.equal(idDeCementerio('  '), '');
  assert.equal(idDeCementerio(null), '');
});

test('idDeRuta: si el cementerio ya tiene documento (por nombre o por id) se reutiliza su id; si no, nace uno nuevo', () => {
  const existentes = [
    { id: 'cem-001', data: { cementerio: 'Parque Canaán de Pudahuel', eje: 'Norte', diaSemana: 2 } },
    { id: 'parque-el-manantial', data: { eje: 'Sur' } },
  ];
  assert.equal(idDeRuta('parque canaan de pudahuel', existentes), 'cem-001'); // mismo nombre sin tildes ni mayúsculas
  assert.equal(idDeRuta('Parque El Manantial', existentes), 'parque-el-manantial'); // coincide con el id
  assert.equal(idDeRuta('Cementerio General de Recoleta', existentes), 'cementerio-general-de-recoleta');
  assert.equal(idDeRuta('', existentes), '');
  assert.equal(idDeRuta('Parque Canaán', null), 'parque-canaan'); // sin existentes
});

// ─── validación de una ruta ──────────────────────────────────────────────────────────────────────────────────────

test('validarRuta: cementerio, eje y día de lunes a viernes; recorta espacios; el día puede venir como texto', () => {
  const r = validarRuta({ cementerio: '  Parque Canaán ', eje: ' Norte ', diaSemana: '3' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.datos, { cementerio: 'Parque Canaán', eje: 'Norte', diaSemana: 3 });
});

test('validarRuta: rechaza lo incompleto o fuera de rango y dice por qué', () => {
  const sinCem = validarRuta({ cementerio: '', eje: 'Norte', diaSemana: 1 });
  assert.equal(sinCem.ok, false);
  assert.match(sinCem.errores.join(' '), /cementerio/i);
  const sinEje = validarRuta({ cementerio: 'X', eje: '   ', diaSemana: 1 });
  assert.equal(sinEje.ok, false);
  assert.match(sinEje.errores.join(' '), /eje/i);
  for (const dia of [0, 6, 7, -1, 1.5, '', null, undefined, 'lunes', '1x']) {
    const r = validarRuta({ cementerio: 'X', eje: 'Norte', diaSemana: dia });
    assert.equal(r.ok, false, `día ${String(dia)} debería rechazarse`);
    assert.match(r.errores.join(' '), /día/i);
  }
  const largo = validarRuta({ cementerio: 'X'.repeat(200), eje: 'E'.repeat(100), diaSemana: 1 });
  assert.equal(largo.ok, false);
  assert.equal(largo.errores.length, 2);
  assert.equal(validarRuta(null).ok, false);
});

test('validarRuta: el eje es texto libre del dueño (no hay una lista de ejes escrita en el código)', () => {
  assert.equal(validarRuta({ cementerio: 'X', eje: 'Eje Poniente 2', diaSemana: 5 }).ok, true);
});

// ─── carga de varios cementerios a un mismo eje y día ────────────────────────────────────────────────────────────

test('prepararLoteRutas: varios cementerios al mismo eje y día, sin repetir (aunque cambie tildes o mayúsculas) y reutilizando ids', () => {
  const existentes = [{ id: 'cem-001', data: { cementerio: 'Parque Canaán de Pudahuel', eje: 'Sur', diaSemana: 4 } }];
  const r = prepararLoteRutas({
    cementerios: ['Parque Canaán de Pudahuel', 'parque canaan de pudahuel', 'Cementerio Metropolitano de Lo Espejo', '  '],
    eje: 'Norte', diaSemana: '2', existentes,
  });
  assert.deepEqual(r.errores, []);
  assert.deepEqual(r.items, [
    { id: 'cem-001', datos: { cementerio: 'Parque Canaán de Pudahuel', eje: 'Norte', diaSemana: 2 } },
    { id: 'cementerio-metropolitano-de-lo-espejo', datos: { cementerio: 'Cementerio Metropolitano de Lo Espejo', eje: 'Norte', diaSemana: 2 } },
  ]);
});

test('prepararLoteRutas: sin cementerios, sin eje o con un día inválido no prepara nada', () => {
  assert.match(prepararLoteRutas({ cementerios: [], eje: 'Norte', diaSemana: 1, existentes: [] }).errores.join(' '), /cementerio/i);
  assert.deepEqual(prepararLoteRutas({ cementerios: [], eje: 'Norte', diaSemana: 1, existentes: [] }).items, []);
  const sinEje = prepararLoteRutas({ cementerios: ['A'], eje: '', diaSemana: 1, existentes: [] });
  assert.deepEqual(sinEje.items, []);
  assert.match(sinEje.errores.join(' '), /eje/i);
  const malDia = prepararLoteRutas({ cementerios: ['A'], eje: 'Norte', diaSemana: 9, existentes: [] });
  assert.deepEqual(malDia.items, []);
  assert.match(malDia.errores.join(' '), /día/i);
});

// ─── feriados ────────────────────────────────────────────────────────────────────────────────────────────────────

test('ALCANCES: nacional y regional', () => {
  assert.deepEqual(ALCANCES, ['nacional', 'regional']);
});

test('validarFeriado: fecha AAAA-MM-DD real, nombre y alcance (nacional por defecto)', () => {
  const r = validarFeriado({ fecha: '2026-12-25', nombre: ' Navidad ', alcance: '' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.datos, { fecha: '2026-12-25', nombre: 'Navidad', alcance: 'nacional' });
  assert.equal(validarFeriado({ fecha: '2026-12-25', nombre: 'X', alcance: 'Regional' }).datos.alcance, 'regional');
});

test('validarFeriado: rechaza fecha inexistente o mal escrita, nombre vacío y alcance desconocido', () => {
  for (const fecha of ['2026-02-30', '2026-13-01', '25-12-2026', '2026-1-1', '', null, 'hoy']) {
    const r = validarFeriado({ fecha, nombre: 'X', alcance: 'nacional' });
    assert.equal(r.ok, false, String(fecha));
    assert.match(r.errores.join(' '), /fecha/i);
  }
  assert.match(validarFeriado({ fecha: '2026-12-25', nombre: ' ', alcance: 'nacional' }).errores.join(' '), /nombre/i);
  assert.match(validarFeriado({ fecha: '2026-12-25', nombre: 'X', alcance: 'comunal' }).errores.join(' '), /alcance/i);
  assert.equal(validarFeriado({ fecha: '2026-12-25', nombre: 'N'.repeat(200), alcance: 'nacional' }).ok, false);
});

test('parsearFeriados: una línea por feriado «fecha | nombre | alcance»; acepta ; o tabulación, dd/mm/aaaa y líneas vacías o con #', () => {
  const texto = [
    '# lista de prueba',
    '2026-12-08 | Inmaculada Concepción',
    '',
    '25/12/2026;Navidad;nacional',
    '2026-12-31\tFeriado bancario\tregional',
    '01-01-2027 | Año Nuevo',
  ].join('\r\n');
  const r = parsearFeriados(texto);
  assert.deepEqual(r.errores, []);
  assert.deepEqual(r.filas.map(({ fecha, nombre, alcance }) => ({ fecha, nombre, alcance })), [
    { fecha: '2026-12-08', nombre: 'Inmaculada Concepción', alcance: 'nacional' },
    { fecha: '2026-12-25', nombre: 'Navidad', alcance: 'nacional' },
    { fecha: '2026-12-31', nombre: 'Feriado bancario', alcance: 'regional' },
    { fecha: '2027-01-01', nombre: 'Año Nuevo', alcance: 'nacional' },
  ]);
  assert.deepEqual(r.filas.map((f) => f.linea), [2, 4, 5, 6]); // número de línea del texto pegado
});

test('parsearFeriados: las líneas con problemas se informan con su número y NO impiden leer las buenas', () => {
  const r = parsearFeriados([
    '2026-12-08 | Inmaculada Concepción',
    'sin separador',
    '2026-02-30 | Fecha imposible',
    '2026-12-25 |',
    '2026-12-25 | Navidad | comunal',
    '2026-12-08 | Repetida',
    '2026-12-26 | Bien',
  ].join('\n'));
  assert.deepEqual(r.filas.map((f) => f.fecha), ['2026-12-08', '2026-12-26']);
  assert.deepEqual(r.errores.map((e) => e.linea), [2, 3, 4, 5, 6]);
  assert.match(r.errores[0].motivo, /separ|fecha/i);
  assert.match(r.errores[4].motivo, /repetid/i);
});

test('parsearFeriados: texto vacío o nulo → sin filas ni errores', () => {
  assert.deepEqual(parsearFeriados(''), { filas: [], errores: [] });
  assert.deepEqual(parsearFeriados(null), { filas: [], errores: [] });
  assert.deepEqual(parsearFeriados('   \n  \n'), { filas: [], errores: [] });
});

// ─── permisos (las reglas de Firestore mandan; esto solo decide qué botones se muestran) ────────────────────────

test('permisosDeStaff: rutas solo para el dueño (dueno === true); feriados solo para administrador o admin', () => {
  assert.deepEqual(permisosDeStaff({ rol: 'administrador', dueno: true }), { editaRutas: true, editaFeriados: true });
  assert.deepEqual(permisosDeStaff({ rol: 'Admin', dueno: false }), { editaRutas: false, editaFeriados: true });
  assert.deepEqual(permisosDeStaff({ rol: ' ADMINISTRADOR ' }), { editaRutas: false, editaFeriados: true });
  assert.deepEqual(permisosDeStaff({ rol: 'supervisor', dueno: true }), { editaRutas: true, editaFeriados: false });
  assert.deepEqual(permisosDeStaff({ rol: 'operador' }), { editaRutas: false, editaFeriados: false });
  for (const raro of [{ dueno: 'true' }, { dueno: 1 }, { dueno: 'si' }]) assert.equal(permisosDeStaff(raro).editaRutas, false); // estricto, como la regla
  assert.deepEqual(permisosDeStaff(null), { editaRutas: false, editaFeriados: false });
  assert.deepEqual(permisosDeStaff(undefined), { editaRutas: false, editaFeriados: false });
});

// ─── activo / inactivo ───────────────────────────────────────────────────────────────────────────────────────────

test('estaActivo: solo activo === false deja de estar activo (los documentos anteriores, sin el campo, siguen activos)', () => {
  assert.equal(estaActivo({ eje: 'Norte' }), true);
  assert.equal(estaActivo({ activo: true }), true);
  assert.equal(estaActivo({ activo: false }), false);
  assert.equal(estaActivo({ activo: 'false' }), true);
  assert.equal(estaActivo(null), true);
});

// ─── cementerios y filas de la tabla de rutas ────────────────────────────────────────────────────────────────────

test('cementeriosDeOrdenes: nombres distintos de las órdenes (ubicación de la sepultura o cementerio), sin vacíos ni repetidos', () => {
  const ordenes = [
    { id: 'a', data: { ubicacionSepultura: { cementerio: 'Parque Canaán de Pudahuel' } } },
    { id: 'b', data: { cementerio: 'Cementerio General de Recoleta' } },
    { id: 'c', data: { cementerio: 'parque canaán de pudahuel' } }, // repetido salvo mayúsculas
    { id: 'd', data: {} },
    { id: 'e', data: { cementerio: '  ' } },
    null,
  ];
  assert.deepEqual(cementeriosDeOrdenes(ordenes), ['Cementerio General de Recoleta', 'Parque Canaán de Pudahuel']);
  assert.deepEqual(cementeriosDeOrdenes(null), []);
});

test('filasDeRutas: une las rutas cargadas con los cementerios de las órdenes; marca activa, inactiva o sin ruta', () => {
  const rutas = [
    { id: 'cem-001', data: { cementerio: 'Parque Canaán de Pudahuel', eje: 'Norte', diaSemana: 2 } },
    { id: 'cementerio-general-de-recoleta', data: { cementerio: 'Cementerio General de Recoleta', eje: 'Centro', diaSemana: 1, activo: false } },
    { id: 'solo-en-rutas', data: { cementerio: 'Cementerio Solo En Rutas', eje: 'Sur', diaSemana: 5 } },
  ];
  const filas = filasDeRutas(rutas, ['parque canaan de pudahuel', 'Cementerio Metropolitano de Lo Espejo', 'Cementerio General de Recoleta']);
  assert.deepEqual(filas.map((f) => [f.nombre, f.estado, f.id, f.eje, f.diaSemana, f.dia]), [
    ['Cementerio General de Recoleta', 'inactiva', 'cementerio-general-de-recoleta', 'Centro', 1, 'Lunes'],
    ['Cementerio Metropolitano de Lo Espejo', 'sin-ruta', '', '', null, ''],
    ['Cementerio Solo En Rutas', 'activa', 'solo-en-rutas', 'Sur', 5, 'Viernes'],
    ['Parque Canaán de Pudahuel', 'activa', 'cem-001', 'Norte', 2, 'Martes'],
  ]);
});

test('filasDeRutas: un documento sin eje o con día inválido se muestra tal cual (el dueño lo corrige), nunca se inventa', () => {
  const filas = filasDeRutas([{ id: 'x', data: { cementerio: 'Cementerio X', diaSemana: 9 } }], []);
  assert.equal(filas.length, 1);
  assert.equal(filas[0].eje, '');
  assert.equal(filas[0].diaSemana, null);
  assert.equal(filas[0].estado, 'activa');
  assert.equal(filasDeRutas(null, null).length, 0);
});

// ─── catálogo oficial de cementerios en la lista de «Rutas y feriados» ───────────────────────────────────────────────

test('catálogo: los 17 cementerios oficiales están en el catálogo, cada uno en una sola entrada, sin entradas sobrantes', () => {
  assert.equal(CEMENTERIOS_OFICIALES.length, 17);
  assert.equal(CATALOGO_CEMENTERIOS.length, 17);
  const entradaDe = (oficial) => CATALOGO_CEMENTERIOS.filter((c) => c.nombres.some((n) => normalizarNombre(n) === normalizarNombre(oficial)));
  for (const oficial of CEMENTERIOS_OFICIALES) assert.equal(entradaDe(oficial).length, 1, `«${oficial}» debe estar en una sola entrada`);
  const usadas = new Set(CEMENTERIOS_OFICIALES.map((o) => CATALOGO_CEMENTERIOS.indexOf(entradaDe(o)[0])));
  assert.equal(usadas.size, 17, 'cada entrada del catálogo corresponde a un cementerio oficial');
});

test('catálogo: el nombre oficial va primero en cada entrada (homologado con la lista de 17)', () => {
  for (const oficial of CEMENTERIOS_OFICIALES) {
    const entrada = CATALOGO_CEMENTERIOS.find((c) => c.nombres.some((n) => normalizarNombre(n) === normalizarNombre(oficial)));
    assert.equal(entrada.nombres[0], oficial);
  }
});

test('gruposDeCatalogo: un grupo por cementerio oficial, con su nombre oficial y todos sus alias', () => {
  const grupos = gruposDeCatalogo();
  assert.deepEqual(grupos.map((g) => g.nombre), CEMENTERIOS_OFICIALES);
  const prado = grupos.find((g) => g.nombre === 'Parque del Prado');
  assert.ok(prado.claves.has('cementerio el prado de puente alto') && prado.claves.has('parque del prado') && prado.claves.has('parque del prado de puente alto'));
});

test('filasDeRutas con el catálogo: los 17 aparecen aunque no tengan orden ni ruta, «sin ruta» y con nombre oficial', () => {
  const filas = filasDeRutas([], [], gruposDeCatalogo());
  assert.equal(filas.length, 17);
  assert.ok(filas.every((f) => f.estado === 'sin-ruta' && f.id === '' && f.nombre === f.etiqueta));
  const orden = (a, b) => a.localeCompare(b, 'es');
  assert.deepEqual(filas.map((f) => f.nombre), [...CEMENTERIOS_OFICIALES].sort(orden));
});

test('filasDeRutas con el catálogo: los alias de las órdenes no duplican cementerios; un cementerio fuera del catálogo sí aparece', () => {
  const ordenes = [
    'Parque del Recuerdo de Huechuraba', 'Cementerio El Prado', 'cementerio general de recoleta',
    'Parque Jardín Las Flores de Machalí', 'Padre Hurtado', 'Cementerio Municipal N° 2 (Baquedano)', 'Cementerio Nuevo Sin Catálogo',
  ];
  const filas = filasDeRutas([], ordenes, gruposDeCatalogo());
  assert.equal(filas.length, 18);
  assert.equal(new Set(filas.map((f) => f.etiqueta)).size, 18, 'ninguna etiqueta se repite');
  assert.equal(filas.filter((f) => f.etiqueta === 'Parque del Recuerdo Américo Vespucio').length, 1);
  assert.equal(filas.find((f) => f.etiqueta === 'Cementerio General de Santiago').nombre, 'Cementerio General de Santiago');
  assert.ok(filas.some((f) => f.nombre === 'Cementerio Nuevo Sin Catálogo' && f.estado === 'sin-ruta'));
});

test('filasDeRutas con el catálogo: los que ya tienen ruta conservan eje, día y estado; un alias no crea otra fila', () => {
  const rutas = [
    { id: 'cem-008', data: { cementerio: 'Cementerio El Prado de Puente Alto', eje: 'Sur Puente Alto', diaSemana: 3 } },
    { id: 'cem-014', data: { cementerio: 'Cementerio Municipal N° 1 de Rancagua', eje: 'Rancagua Centro', diaSemana: 4, activo: false } },
  ];
  const filas = filasDeRutas(rutas, ['Parque del Prado', 'Cementerio Municipal N° 1'], gruposDeCatalogo());
  assert.equal(filas.length, 17);
  const prado = filas.find((f) => f.etiqueta === 'Parque del Prado');
  assert.deepEqual([prado.nombre, prado.id, prado.eje, prado.diaSemana, prado.dia, prado.estado], ['Cementerio El Prado de Puente Alto', 'cem-008', 'Sur Puente Alto', 3, 'Miércoles', 'activa']);
  const rancagua = filas.find((f) => f.etiqueta === 'Cementerio Municipal N° 1 de Rancagua');
  assert.deepEqual([rancagua.id, rancagua.eje, rancagua.dia, rancagua.estado], ['cem-014', 'Rancagua Centro', 'Jueves', 'inactiva']);
  assert.equal(filas.filter((f) => f.estado === 'sin-ruta').length, 15);
});

test('asignar a un cementerio que ya tiene ruta reutiliza su documento (no crea otro con el nombre oficial)', () => {
  const rutas = [{ id: 'cem-008', data: { cementerio: 'Cementerio El Prado de Puente Alto', eje: 'Sur Puente Alto', diaSemana: 3 } }];
  const prado = filasDeRutas(rutas, [], gruposDeCatalogo()).find((f) => f.etiqueta === 'Parque del Prado');
  const lote = prepararLoteRutas({ cementerios: [prado.nombre], eje: 'Sur Puente Alto', diaSemana: '2', existentes: rutas });
  assert.deepEqual(lote.errores, []);
  assert.equal(lote.items[0].id, 'cem-008');
});

test('asignar con un alias escrito a mano («Otro cementerio») no crea un documento nuevo si el cementerio ya tiene ruta', () => {
  const grupos = gruposDeCatalogo();
  const rutas = [{ id: 'cem-008', data: { cementerio: 'Cementerio El Prado de Puente Alto', eje: 'Sur Puente Alto', diaSemana: 3 } }];
  const lote = prepararLoteRutas({ cementerios: ['Parque del Prado de Puente Alto'], eje: 'Sur', diaSemana: '2', existentes: rutas, grupos });
  assert.deepEqual(lote.errores, []);
  assert.deepEqual(lote.items, [{ id: 'cem-008', datos: { cementerio: 'Cementerio El Prado de Puente Alto', eje: 'Sur', diaSemana: 2 } }]);
});

test('asignar con un alias sin documento: el id sale del nombre oficial, así un mismo cementerio nunca tiene dos documentos', () => {
  const grupos = gruposDeCatalogo();
  assert.equal(idDeRuta('Cementerio Municipal N° 1', [], grupos), 'cementerio-municipal-n-1-de-rancagua');
  const lote = prepararLoteRutas({ cementerios: ['Cementerio Municipal N° 1', 'cementerio municipal n 1 de rancagua'], eje: 'Norte', diaSemana: 1, existentes: [], grupos });
  assert.equal(lote.items.length, 1, 'un alias y el nombre oficial del mismo cementerio cuentan una vez');
  assert.equal(lote.items[0].id, 'cementerio-municipal-n-1-de-rancagua');
  assert.equal(lote.items[0].datos.cementerio, 'Cementerio Municipal N° 1');
});

test('sin grupos, idDeRuta y prepararLoteRutas se comportan como antes (nombres que no están en el catálogo)', () => {
  assert.equal(idDeRuta('Cementerio Municipal N° 1', []), 'cementerio-municipal-n-1');
  assert.equal(prepararLoteRutas({ cementerios: ['Cementerio X'], eje: 'Norte', diaSemana: 1, existentes: [] }).items[0].id, 'cementerio-x');
});

test('resumenDeRutas: cuántos cementerios tienen ruta, cuáles no y cuántas rutas están quitadas', () => {
  const filas = [{ estado: 'activa' }, { estado: 'activa' }, { estado: 'inactiva' }, { estado: 'sin-ruta' }];
  assert.deepEqual(resumenDeRutas(filas), { total: 4, activas: 2, inactivas: 1, sinRuta: 1 });
  assert.deepEqual(resumenDeRutas([]), { total: 0, activas: 0, inactivas: 0, sinRuta: 0 });
});
