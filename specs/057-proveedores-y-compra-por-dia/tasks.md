# Tareas — Spec 057

Cada tarea sigue el orden **prueba primero → verla fallar → implementar → verla pasar**. Una tarea = un commit en español (`feat(spec-057): …`), con los archivos agregados por nombre. Estado inicial: todas pendientes.

## Fase 0 — Preparación

- [ ] **T0.1** Crear la rama `feat/057-proveedores-compra-dia` desde `feat/ordenes-compra` y confirmar que la línea base está en verde (`node --test tests/ public/js/`, 638 pruebas).
  - Hecho: rama creada; baseline pasa; anotado en el reporte.
- [ ] **T0.2** Confirmar con el dueño las decisiones 1, 3, 4 y 5 si cambian respecto de lo aprobado (la spec ya tiene las recomendaciones).
  - Hecho: respuesta del dueño registrada en `spec.md` §13.

## Fase 1 — Módulos puros (sin DOM ni Firebase)

- [ ] **T1.1** Prueba `validarRut`: formatos con y sin puntos, dígito `K`, dígito verificador incorrecto, vacío, espacios.
  - Archivo: `public/js/proveedores.test.mjs`. Implementación: `public/js/proveedores.js`.
  - Hecho: prueba en rojo y luego verde. CA-P2.
- [ ] **T1.2** Prueba `validarProveedor`: razón social vacía o > 120, contacto > 80, teléfono con letras, dirección > 200, condición fuera de lista, `activo` no booleano.
  - Hecho: prueba verde. Base de CA-P1.
- [ ] **T1.3** Prueba `opcionesProveedores`: solo activos, orden por razón social en español, incluye «Otro proveedor».
  - Hecho: prueba verde. CA-O2 (el quitado no aparece).
- [ ] **T1.4** Prueba `datosDeProveedor` y `condicionPorDefecto`.
  - Hecho: prueba verde. CA-O1.
- [ ] **T1.5** Prueba `diaListo`: cementerio sin eje, sin día de ruta, ramo sin valor (`faltantes`), día sin visitas, día completo.
  - Archivo: `public/js/compra-dia.test.mjs`. Implementación: `public/js/compra-dia.js`.
  - Hecho: prueba verde. CA-B1, CA-B6, R-R2.
- [ ] **T1.6** Prueba `idBorrador`: formato `AAAA-MM-DD-slug`, sin tildes, máximo 60, misma entrada → mismo id.
  - Hecho: prueba verde. CA-B3 (parte pura).
- [ ] **T1.7** Prueba `borradorDesdeDia` con tres visitas (Standard, Premium y Spot con adicional) y precios de `valores_ramos`: cantidades = suma de `ramosDeVisita`, códigos `RAM-*`, totales R6 (neto, IVA con redondeo, total), sin precio inventado.
  - Hecho: prueba verde. CA-B2.

## Fase 2 — Escrituras con transacciones simuladas

- [ ] **T2.1** Prueba `crearProveedor`: RUT nuevo crea proveedor y bloqueo; RUT con bloqueo activo rechaza con `codigo-existe`; RUT con bloqueo liberado se permite.
  - Archivo: `public/js/proveedores-db.test.mjs`. Implementación: `public/js/proveedores-db.js`.
  - Hecho: verde. CA-P1, CA-P3.
- [ ] **T2.2** Prueba `editarProveedor` con cambio de RUT: bloquea el nuevo, libera el anterior, no borra nada; cambio a un RUT ocupado se rechaza.
  - Hecho: verde. CA-P3.
- [ ] **T2.3** Prueba `cambiarActivoProveedor`: solo cambia `activo` y los campos de autor; quitar no borra.
  - Hecho: verde. CA-P4, CA-P6 (parte cliente).
- [ ] **T2.4** Prueba `emitirOrden` con `proveedorId`: si el proveedor no está activo, rechaza «El proveedor ya no está activo; elige otro» y no consume número. Si está activo, guarda `proveedorId` y el snapshot.
  - Archivo: `public/js/ordenes-compra-db.test.mjs` (ampliado). Implementación: `public/js/ordenes-compra-db.js` (parámetro `proveedorId` y `extra`).
  - Hecho: verde. CA-O4, R-O3. Las pruebas de la 055 siguen verdes.
- [ ] **T2.5** Prueba `emitirDesdeBorrador`: borrador `Borrador` → nace `OC-NNNN` y el borrador queda con `emitidoComo` en la misma transacción; borrador ya emitido rechaza; contador sube una vez.
  - Hecho: verde. CA-B5.
- [ ] **T2.6** Prueba `crearBorradorDia`: primera vez crea con `estado: 'Borrador'` y sin número; segunda vez devuelve `existe: true` y no escribe; no toca `contadores/ordenesCompra`.
  - Hecho: verde. CA-B3, CA-B4.
- [ ] **T2.7** Prueba de simulación de snapshot: cambiar un proveedor en el maestro después de emitir no cambia la OC ni su impresión.
  - Hecho: verde. CA-O3.

## Fase 3 — Pantalla de proveedores y desplegable

- [ ] **T3.1** Prueba de página: `public/ordenes-compra.html` tiene `tab-proveedores`, `panel-proveedores` y `oc-razon-select`; el portal no cambia salvo lo previsto.
  - Archivo: `tests/ordenes-compra-pagina.test.mjs`.
  - Hecho: verde (en rojo antes).
- [ ] **T3.2** Prueba de vistas: `htmlFilasProveedores` y `htmlOpcionesProveedores` escapan `<b>` en razón social, contacto y dirección.
  - Archivo: `public/js/ordenes-compra-vistas.test.mjs`. Implementación en `ordenes-compra-vistas.js`.
  - Hecho: verde. CA-O5.
- [ ] **T3.3** Implementar la pestaña «Proveedores» en `ordenes-compra.html` y el controlador (alta, edición, quitar y reactivar con confirmación). Sin cambiar clases ni textos existentes; textos nuevos en español claro.
  - Hecho: pruebas de T1–T2 y T3.1–T3.2 verdes; diff fuera de `<script>` revisado.
- [ ] **T3.4** Desplegable de razón social en el formulario de OC: al elegir, rellena RUT, dirección, contacto, teléfono y condición (sin guardar).
  - Hecho: prueba de UI con Firestore simulado. CA-O1, CA-O2.
- [ ] **T3.5** Emisión muestra y guarda el snapshot y `proveedorId`; la impresión usa el snapshot.
  - Hecho: CA-O3 visual y de simulación.

## Fase 4 — Botón de día listo y borradores

- [ ] **T4.1** Prueba de página: `public/rutas-feriados.html` tiene la sección «Días de programación» dentro de `panel-rutas`, con su tabla y botón; las tablas existentes no cambian.
  - Archivo: `tests/rutas-feriados-pagina.test.mjs`.
  - Hecho: verde (en rojo antes).
- [ ] **T4.2** Controlador: calcula los días con `construirFilasPlanificacion` + `construirListaCompra` + `leerValoresRamos` + `rutas`; muestra estado y motivos; botón deshabilitado con el motivo cuando no está listo (CA-B1).
  - Hecho: prueba de UI con datos ficticios. CA-B1, CA-B6.
- [ ] **T4.3** Al pulsar «Crear orden de compra» en un día listo: `crearBorradorDia` y navegación a `ordenes-compra.html?borrador=<id>`. Pulsar dos veces no duplica (botón deshabilitado durante la escritura).
  - Hecho: CA-B2, CA-B3 en navegador con simulación.
- [ ] **T4.4** En «Órdenes de compra», lista de borradores pendientes y precarga por `?borrador=` (líneas, fecha y proveedor vacío para elegir). «Emitir» usa `emitirDesdeBorrador`.
  - Hecho: CA-B5 en navegador con simulación.
- [ ] **T4.5** Permiso denegado al crear borrador o al emitir: aviso con el texto de `textoErrorOC` (sin decir «no se guardó» si sí se guardó).
  - Hecho: prueba de UI.

## Fase 5 — Reglas y contrato (repo de la web)

- [ ] **T5.1** Redactar `docs/referencia/reglas-propuestas-057.md` con las reglas de `proveedores`, `proveedoresRut`, `ordenesCompraBorradores` y el campo opcional `proveedorId` (plan §5).
  - Hecho: documento revisado; pruebas que pide, listadas.
- [ ] **T5.2** Preparar el texto de las filas nuevas para `docs/10-contrato-de-datos.md` (web) y la lista de pruebas de reglas que la sesión de la web debe escribir (CA-P5, CA-P6, CA-B4, bloqueo de RUT).
  - Hecho: entregado al dueño para pasarlo a la sesión de la web. No se modifica el repo de la web desde aquí.

## Fase 6 — Regresión, validación y reporte

- [ ] **T6.1** `node --test tests/ public/js/` en verde (638 previas + las nuevas). Sin dependencias nuevas; `npm audit` sin altas nuevas.
  - Hecho: resultado citado en el reporte.
- [ ] **T6.2** Revisión de seguridad del PR: escape de todo dato mostrado, RUT de prueba generados (sin RUT reales), sin secretos, `git diff --cached --name-only` revisado antes de cada commit, commits por nombre.
  - Hecho: checklist completo.
- [ ] **T6.3** Validación en localhost con emuladores de la web (`GC_OFFSET=700`) y usuario de staff de prueba: pasos 1 a 5 de la spec §9.
  - Hecho: resultados por paso en el reporte. Si las reglas no están publicadas en el emulador, se indica.
- [ ] **T6.4** Reporte `docs/reportes/ordenes-proveedores-dia.md` (spec 057): qué se hizo, pruebas, qué no se probó, plan de despliegue (tag, `found N files`, `--only hosting:gravecare-ops`, lo ejecuta el dueño) y reversa.
  - Hecho: reporte entregado. Sin desplegar ni abrir PR sin aprobación.
