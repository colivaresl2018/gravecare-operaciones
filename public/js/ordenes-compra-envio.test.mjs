import test from 'node:test';
import assert from 'node:assert/strict';
import {
  estadoEnvio, textoConfirmacion, mensajeErrorEnvio, textoResultado, textoHistorial, enviarOrden, CORREO_COPIA,
} from './ordenes-compra-envio.js';

// Spec 058 (backoffice): envío de la OC por correo. Lógica pura; la llamada real a la función se inyecta (`llamar`).

const ORDEN = { numero: 'OC-0012', estado: 'Emitida', proveedorId: 'p1' };
const PROVEEDOR = { id: 'p1', data: { razonSocial: 'Flores del Sur SpA', activo: true, correo: 'ventas@ejemplo.test' } };

// ---------- T4.1 · estado del botón (CA5, CA6, CA7, R7)
test('estadoEnvio: OC emitida con proveedor activo y correo válido → botón habilitado con ese correo (CA5)', () => {
  const e = estadoEnvio({ orden: ORDEN, proveedor: PROVEEDOR });
  assert.deepEqual(e, { mostrar: true, habilitado: true, motivo: '', correo: 'ventas@ejemplo.test' });
});

test('estadoEnvio: una OC anulada, o en cualquier estado que no sea Emitida, no muestra el botón (CA6)', () => {
  for (const estado of ['Anulada', 'Borrador', '', undefined]) {
    const e = estadoEnvio({ orden: { ...ORDEN, estado }, proveedor: PROVEEDOR });
    assert.equal(e.mostrar, false, String(estado));
    assert.equal(e.habilitado, false);
  }
  assert.equal(estadoEnvio({ orden: null, proveedor: PROVEEDOR }).mostrar, false);
});

test('estadoEnvio: sin proveedorId («Otro proveedor») se muestra deshabilitado con su motivo (CA7)', () => {
  for (const proveedorId of [undefined, '', null]) {
    const e = estadoEnvio({ orden: { ...ORDEN, proveedorId }, proveedor: null });
    assert.equal(e.mostrar, true);
    assert.equal(e.habilitado, false);
    assert.equal(e.motivo, 'Esta orden no tiene un proveedor del maestro; no se puede enviar por correo');
  }
});

test('estadoEnvio: proveedor inexistente o inactivo → deshabilitado con motivo (CA7)', () => {
  const inexistente = estadoEnvio({ orden: ORDEN, proveedor: null });
  assert.equal(inexistente.habilitado, false);
  assert.match(inexistente.motivo, /proveedor/i);
  const inactivo = estadoEnvio({ orden: ORDEN, proveedor: { id: 'p1', data: { ...PROVEEDOR.data, activo: false } } });
  assert.equal(inactivo.habilitado, false);
  assert.match(inactivo.motivo, /ya no está activo|no está activo/i);
});

test('estadoEnvio: proveedor sin correo (ausente, vacío o solo espacios) → «El proveedor no tiene correo registrado» (CA7)', () => {
  for (const correo of [undefined, '', '   ', null]) {
    const e = estadoEnvio({ orden: ORDEN, proveedor: { id: 'p1', data: { ...PROVEEDOR.data, correo } } });
    assert.equal(e.habilitado, false);
    assert.equal(e.motivo, 'El proveedor no tiene correo registrado: agréguelo en Proveedores');
    assert.equal(e.correo, '');
  }
});

test('estadoEnvio: un correo guardado con formato malo no habilita el botón (el servidor también lo rechazaría)', () => {
  const e = estadoEnvio({ orden: ORDEN, proveedor: { id: 'p1', data: { ...PROVEEDOR.data, correo: 'a@b.cl,c@d.cl' } } });
  assert.equal(e.habilitado, false);
  assert.match(e.motivo, /correo/i);
});

test('estadoEnvio: si la lista de proveedores no se pudo leer, avisa y no habilita', () => {
  const e = estadoEnvio({ orden: ORDEN, proveedor: null, proveedoresLeidos: false });
  assert.equal(e.habilitado, false);
  assert.equal(e.motivo, 'No se pudo leer el proveedor; recargue la página.');
});

// ---------- T4.2 · confirmación (CA8, R8)
test('textoConfirmacion nombra la OC, el correo del proveedor y la copia', () => {
  assert.equal(CORREO_COPIA, 'rravellos@gravecare.cl');
  assert.equal(
    textoConfirmacion('OC-0012', 'ventas@ejemplo.test'),
    '¿Enviar la OC-0012 a ventas@ejemplo.test con copia a rravellos@gravecare.cl?',
  );
});

test('textoConfirmacion recorta el correo y no deja saltos de línea', () => {
  const t = textoConfirmacion('OC-0012', '  ventas@ejemplo.test\r\nCc: x@y.cl ');
  assert.doesNotMatch(t, /[\r\n]/);
  assert.match(t, /^¿Enviar la OC-0012 a ventas@ejemplo\.test/);
});

// ---------- T4.3 · errores (CA11, R11)
const errorCon = (code, message = 'texto crudo del servidor con detalles internos') => Object.assign(new Error(message), { code });

test('mensajeErrorEnvio traduce cada código de la función a un mensaje en español, con y sin el prefijo functions/', () => {
  const esperado = {
    unauthenticated: 'Su sesión no tiene permiso para enviar correos. Vuelva a ingresar.',
    'permission-denied': 'Su sesión no tiene permiso para enviar correos. Vuelva a ingresar.',
    'invalid-argument': 'Número de orden no válido.',
    'not-found': 'No se encontró la orden de compra.',
    'already-exists': 'Ya hay un envío en curso para esta orden. Espere un minuto.',
    'resource-exhausted': 'Se alcanzó el límite de envíos. Intente más tarde.',
    unavailable: 'No se pudo enviar el correo. La orden no cambió; intente de nuevo.',
  };
  for (const [codigo, texto] of Object.entries(esperado)) {
    assert.equal(mensajeErrorEnvio(errorCon(codigo)), texto, codigo);
    assert.equal(mensajeErrorEnvio(errorCon(`functions/${codigo}`)), texto, `functions/${codigo}`);
  }
});

test('mensajeErrorEnvio nunca muestra el texto crudo del servidor salvo en failed-precondition', () => {
  for (const codigo of ['internal', 'unknown', 'deadline-exceeded', 'functions/internal', 'not-found', 'unavailable', undefined]) {
    const m = mensajeErrorEnvio(errorCon(codigo, 'SMTP 535 usuario@secreto.cl rechazado'));
    assert.doesNotMatch(m, /SMTP|535|secreto/);
  }
  assert.equal(mensajeErrorEnvio(errorCon('internal')), 'No se pudo enviar. Intente de nuevo.');
  assert.equal(mensajeErrorEnvio(null), 'No se pudo enviar. Intente de nuevo.');
  assert.equal(mensajeErrorEnvio('texto suelto'), 'No se pudo enviar. Intente de nuevo.');
});

test('mensajeErrorEnvio usa el mensaje en español de la función en failed-precondition, recortado y sin saltos de línea', () => {
  assert.equal(
    mensajeErrorEnvio(errorCon('functions/failed-precondition', 'La orden OC-0012 está anulada: no se envía.')),
    'La orden OC-0012 está anulada: no se envía.',
  );
  const largo = mensajeErrorEnvio(errorCon('failed-precondition', `${'a'.repeat(400)}`));
  assert.equal(largo.length <= 200, true);
  assert.doesNotMatch(mensajeErrorEnvio(errorCon('failed-precondition', 'línea 1\r\nlínea 2')), /[\r\n]/);
  assert.equal(mensajeErrorEnvio(errorCon('failed-precondition', '   ')), 'No se pudo enviar: revise la orden y el proveedor.');
});

test('mensajeErrorEnvio entiende los errores propios del módulo (envío en curso y número inválido)', () => {
  assert.equal(mensajeErrorEnvio(errorCon('envio-en-curso')), 'Ya hay un envío en curso para esta orden. Espere un minuto.');
  assert.equal(mensajeErrorEnvio(errorCon('invalid-argument')), 'Número de orden no válido.');
});

// ---------- T4.4 · resultado e historial (CA10, CA12, R10, R12)
test('textoResultado: «Enviada a … con copia a …» y aviso si no quedó registrado', () => {
  const ok = textoResultado({ ok: true, numero: 'OC-0012', para: 'ventas@ejemplo.test', cc: 'rravellos@gravecare.cl', enviadoEl: '2026-11-23T15:30:00.000Z', totalEnvios: 1, registrado: true });
  assert.deepEqual(ok, { tipo: 'ok', texto: 'Enviada a ventas@ejemplo.test con copia a rravellos@gravecare.cl' });
  const sinRegistro = textoResultado({ ok: true, numero: 'OC-0012', para: 'ventas@ejemplo.test', cc: 'rravellos@gravecare.cl', registrado: false });
  assert.equal(sinRegistro.tipo, 'aviso');
  assert.equal(sinRegistro.texto, 'Enviada a ventas@ejemplo.test con copia a rravellos@gravecare.cl. Se envió, pero no quedó registrado en la orden.');
});

test('textoResultado: sin datos de destinatario no inventa nada', () => {
  assert.deepEqual(textoResultado({ ok: true }), { tipo: 'ok', texto: 'Se envió la orden por correo.' });
  assert.deepEqual(textoResultado(null), { tipo: 'ok', texto: 'Se envió la orden por correo.' });
  assert.equal(textoResultado({ ok: true, registrado: false }).tipo, 'aviso');
});

test('textoHistorial: nada sin envíos; el último con su fecha; «(N envíos)» si hay más (CA12)', () => {
  assert.equal(textoHistorial(undefined), '');
  assert.equal(textoHistorial([]), '');
  assert.equal(textoHistorial('no es lista'), '');
  const uno = [{ para: 'ventas@ejemplo.test', cc: 'rravellos@gravecare.cl', enviadoEl: '2026-11-23T15:30:00.000Z', enviadoPor: 'uid-secreto-1' }];
  assert.equal(textoHistorial(uno), 'Enviada a ventas@ejemplo.test el 23-11-2026 12:30');
  const tres = [
    { para: 'a@ejemplo.test', enviadoEl: '2026-11-21T10:00:00.000Z', enviadoPor: 'u1' },
    { para: 'b@ejemplo.test', enviadoEl: '2026-11-22T10:00:00.000Z', enviadoPor: 'u2' },
    { para: 'c@ejemplo.test', enviadoEl: '2026-11-23T15:30:00.000Z', enviadoPor: 'u3' },
  ];
  assert.equal(textoHistorial(tres), 'Enviada a c@ejemplo.test el 23-11-2026 12:30 (3 envíos)');
});

test('textoHistorial nunca muestra el uid de quien envió y tolera datos incompletos', () => {
  const t = textoHistorial([{ para: 'ventas@ejemplo.test', enviadoEl: '2026-11-23T15:30:00.000Z', enviadoPor: 'uid-secreto-1' }]);
  assert.doesNotMatch(t, /uid-secreto/);
  assert.equal(textoHistorial([{ para: 'ventas@ejemplo.test', enviadoEl: 'fecha rara' }]), 'Enviada a ventas@ejemplo.test');
  assert.equal(textoHistorial([{ enviadoEl: '2026-11-23T15:30:00.000Z' }]), 'Enviada el 23-11-2026 12:30');
  assert.equal(textoHistorial([null, 5, {}]), '');
});

// ---------- T4.5 · enviarOrden (CA9, R9)
test('enviarOrden llama a la función con EXACTAMENTE { numero } y devuelve su respuesta (CA9)', async () => {
  const llamadas = [];
  const respuesta = { ok: true, numero: 'OC-0101', para: 'ventas@ejemplo.test', cc: 'rravellos@gravecare.cl', registrado: true };
  const r = await enviarOrden({ numero: 'OC-0101', llamar: async (datos) => { llamadas.push(datos); return respuesta; } });
  assert.deepEqual(llamadas, [{ numero: 'OC-0101' }]);
  assert.deepEqual(Object.keys(llamadas[0]), ['numero']);
  assert.equal(r, respuesta);
});

test('enviarOrden con un número inválido no llama a la función y falla con invalid-argument', async () => {
  let llamadas = 0;
  for (const numero of ['OC-1', 'oc-0001', '../x', '', undefined, null, 12, { numero: 'OC-0001' }, 'OC-0001 ']) {
    await assert.rejects(enviarOrden({ numero, llamar: async () => { llamadas += 1; } }), (e) => e.code === 'invalid-argument');
  }
  assert.equal(llamadas, 0);
});

test('enviarOrden: una segunda llamada mientras la primera sigue en curso no vuelve a llamar (envio-en-curso)', async () => {
  let liberar;
  let llamadas = 0;
  const lenta = () => { llamadas += 1; return new Promise((res) => { liberar = res; }); };
  const primera = enviarOrden({ numero: 'OC-0201', llamar: lenta });
  await assert.rejects(enviarOrden({ numero: 'OC-0201', llamar: lenta }), (e) => e.code === 'envio-en-curso');
  assert.equal(llamadas, 1);
  // otra orden distinta sí puede enviarse en paralelo
  const otra = enviarOrden({ numero: 'OC-0202', llamar: async () => ({ ok: true }) });
  assert.deepEqual(await otra, { ok: true });
  liberar({ ok: true });
  assert.deepEqual(await primera, { ok: true });
});

test('enviarOrden permite volver a enviar tras un éxito y tras un error (siempre libera el indicador)', async () => {
  let n = 0;
  await enviarOrden({ numero: 'OC-0301', llamar: async () => { n += 1; return { ok: true }; } });
  await enviarOrden({ numero: 'OC-0301', llamar: async () => { n += 1; return { ok: true }; } });
  await assert.rejects(enviarOrden({ numero: 'OC-0301', llamar: async () => { n += 1; throw errorCon('unavailable'); } }), (e) => e.code === 'unavailable');
  await enviarOrden({ numero: 'OC-0301', llamar: async () => { n += 1; return { ok: true }; } });
  assert.equal(n, 4);
});
