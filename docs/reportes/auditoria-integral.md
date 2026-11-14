# Auditoría integral GraveCare — web, Cloud Functions y portal de operaciones

**Fecha:** 2026-11-14 · **Alcance:** solo lectura. No se modificó código ni datos, no se leyó ningún `.env`, no se ejecutó nada contra Firebase.
**Repos revisados:**
- Web + Functions + reglas: `C:\Proyectos\Gravecare` (rama `release/perfil-y-contrato-unificado`, HEAD `4ddbe56`, árbol de trabajo tal como estaba).
- Portal de operaciones: `C:\Proyectos\GravecareOpsPortal` (worktree `priceless-dirac-8a9741`, base `4c743d4`).

Convenciones del informe: las rutas `W:` son del repo de la web y `O:` del portal de operaciones. No se imprimen RUT, correos ni secretos: donde el código contiene direcciones de correo personales fijas se cita solo el `archivo:línea`.

---

## 1. Resumen ejecutivo

El diseño de fondo es sólido en varios puntos que suelen fallar: el servidor fija el monto (nunca el navegador), los secretos de orden y de activación se guardan como hash y se comparan en tiempo constante, `iniciarOrden` y `consultarOrden` verifican el ID token con `verifyIdToken`, la cuenta de un RUT se decide por Authentication y no por un campo público, las reglas de Firestore ya dependen del claim `staffActivo`, y `SMTP_PASS` y las credenciales de Transbank de producción llegan por Secret Manager sin valores de respaldo en el código.

Aun así hay **1 hallazgo crítico, 6 altos, 11 medios, 7 bajos** y un conjunto de código obsoleto. Lo más importante:

1. **(Crítica) XSS almacenado en el portal de operaciones.** `iniciarOrden` es público y guarda texto libre (nombre del difunto, nombres del titular, sector, patio, N° de sepultura). Varias páginas del backoffice lo interpolan sin escapar en `innerHTML`. Quien ejecuta ese script es una persona de staff con el claim, y desde ahí puede escribir `staff/{uid}`, que el disparador convierte en claim. Es una cadena completa desde un visitante anónimo hasta control total del staff.
2. **(Alta) Cualquier staff puede darse o dar privilegios.** Las reglas permiten a todo usuario con `staffActivo` crear y modificar cualquier `staff/{uid}`; los roles (operador, supervisor, administrador) solo existen en la interfaz. La separación entre quien captura un informe y quien lo aprueba no se hace cumplir en ninguna capa.
3. **(Alta) `crearTransaccionWebpay` no valida sesión ni prueba de acceso a la orden** (spec 028/029 pendiente en este endpoint). Con solo un `ordenId` se puede reemplazar el token de pago de una orden en curso y dejar un pago autorizado huérfano.
4. **(Alta) `rut_lookup` permite que cualquier usuario autenticado cree el registro de un RUT ajeno** apuntando a su uid. `crearCuentaCliente` lo interpreta como «ya existe cuenta» y bloquea el alta del titular real.
5. **(Alta) Integridad del perfil: dos fuentes de verdad.** `perfil.html` reemplaza el mapa `titular` completo y lo lee con `data.titular || data` (todo o nada), mientras el servidor lee solo la raíz de `usuarios/{uid}`. El RUT desaparece de la pantalla de perfil tras el primer guardado y el contrato usa un domicilio desactualizado.
6. **(Alta, condicional) El RUT se toma como identidad sin prueba de titularidad** y, mientras Webpay opere en integración, el «pago» no cuesta nada: cualquiera puede reservar la cuenta de un RUT ajeno.
7. **(Alta, latente) Oneclick** marca la orden como pagada al terminar la inscripción de la tarjeta (no hay cobro) y no valida sesión. Hoy está apagado por una bandera del servidor; no debe encenderse sin rehacerlo.

Código y rutas de autenticación: el uid de la sesión se usa correctamente en el servidor (`ordenes-acceso.js:307`), pero el servidor lo pisa después con `cliente_<rut>` (hallazgo AUD-08) y el front de contratación todavía arma `cliente_<rut>` como respaldo (AUD-08).

### Tabla de hallazgos (por severidad)

| ID | Sev. | Hallazgo | Pilar | Dónde (principal) |
|---|---|---|---|---|
| AUD-01 | **Crítica** | XSS almacenado: datos de `iniciarOrden` sin escapar en el backoffice | 3 / 2 | `W:functions/ordenes-acceso.js:109-146` → `O:ordenes.html:460-480` y otras 8 páginas |
| AUD-02 | Alta | Escalada dentro del staff: reglas sin roles; roles solo en UI | 2 | `W:firestore.rules:70,76-85,103`; `O:js/portal-common.js:12-21`; `O:gastos-ingresos.html:1502` |
| AUD-03 | Alta | `crearTransaccionWebpay` sin sesión ni prueba de la orden | 3 | `W:functions/transbank.js:40-141`; `W:public/resumen-pago.html:821-836` |
| AUD-04 | Alta | `rut_lookup`: creación libre de registros de RUT ajeno | 2 | `W:firestore.rules:49-54` |
| AUD-05 | Alta | Perfil: `titular` pisado y leído todo-o-nada; el servidor ignora `titular` | 1 / 4 | `W:public/perfil.html:230-240,287-305`; `W:functions/ordenes-acceso.js:262-271` |
| AUD-06 | Alta* | Cuenta por RUT sin prueba de titularidad; «pago» gratis en integración | 3 | `W:functions/activacion.js:168-186`; `W:functions/index.js:163-172` |
| AUD-07 | Alta* | Oneclick: inscripción = «pagado»; sin sesión; fugas de error | 3 | `W:functions/oneclick.js:40-172` |
| AUD-08 | Media | El servidor pisa el uid de la sesión con `cliente_<rut>`; respaldo inseguro en el front | 1 | `W:functions/index.js:118,156`; `W:functions/contrato.js:304-306,406`; `W:public/contratacion-plan.html:868`; `W:public/contratacion-Spot.html:839` |
| AUD-09 | Media | Precarga de contratación pierde región, comuna y nombres; región por defecto «Metropolitana» | 4 | `W:public/contratacion-plan.html:481-496,522,912-929`; `W:public/js/nuevaCompra.js:202,237` |
| AUD-10 | Media | `usuarios/{uid}`: el dueño escribe cualquier campo (rol, plan, estado, claves de estado) | 2 | `W:firestore.rules:18-22`; `W:public/registro.html:645-671` |
| AUD-11 | Media | `login-ops.html` (web): todo `@gravecare.cl` y `usuarios.rol` cuentan como staff | 2 | `W:public/login-ops.html:143,166-172` |
| AUD-12 | Media | `requireStaffAccess` sin claim; administradores «maestros» fijos; `admin-usuarios` muestra antes de validar | 2 | `O:js/portal-common.js:64-81`; `O:admin-usuarios.html:273-302` |
| AUD-13 | Media | Enumeración y límites: IP tomada del primer `X-Forwarded-For`; App Check apagado | 3 | `W:functions/cuenta-existente.js:119-122,112-117` |
| AUD-14 | Media | Contraseña mínima de 6 caracteres; cuentas con correo ficticio sin verificar | 3 | `W:functions/activacion.js:15,108,219` |
| AUD-15 | Media | Datos personales y de la orden en `localStorage` | 4 | `W:public/contratacion-plan.html:731-733`; `W:public/resumen-pago.html:553,590,596` |
| AUD-16 | Media | Hosting sin cabeceras de seguridad; scripts de CDN sin SRI; clave de Maps = clave web de Firebase | 3 | `W:firebase.json`; `O:firebase.json`; `O:mapa.html:13` |
| AUD-17 | Media | Informes: lecturas-modificaciones de mapas completos, fotos en base64 duplicadas, atribución fija al dueño | 2 | `O:informe-captura.html:513-540`; `O:informe-revision.html:487,505-530` |
| AUD-18 | Media | Perfil sin validación (región/comuna libres, teléfono, fecha) y sin consentimiento al editar fecha | 4 | `W:public/perfil.html:147-161,287-299` |
| AUD-19 | Baja | Storage `informes/**` con lectura pública; URL de contrato con token que no caduca | 2 | `W:storage.rules:35`; `W:functions/contrato.js:317-325` |
| AUD-20 | Baja | Contrato con precio por defecto 34.990 y lógica de plan duplicada de `tarifas.js` | 3 | `W:functions/contrato.js:42-119,157` |
| AUD-21 | Baja | CORS con `localhost` en producción y sin `Vary: Origin` | 3 | `W:functions/cors.js:6-7,16-22` |
| AUD-22 | Baja | Redirecciones con `TBK_ORDEN_COMPRA` sin codificar; anulación sin sesión | 3 | `W:functions/index.js:267,274-290` |
| AUD-23 | Baja | `setCustomUserClaims` pisa otros claims; el UID de `staff` se escribe a mano | 2 | `W:functions/staffClaims.js:56`; `O:admin-usuarios.html:241-255` |
| AUD-24 | Baja | Mensajes de error internos hacia el navegador (`error.message`, `errText`) | 3 | `W:functions/oneclick.js:103-106,170`; `W:public/resumen-pago.html:837-841` |
| AUD-25 | Baja | `crearCuentaCliente` y `datosActivacion` sin límite de intentos | 3 | `W:functions/index.js:393-420` |
| AUD-26 | Info | Código obsoleto o duplicado a refactorizar | — | ver §4 |
| AUD-27 | Info | Aciertos de diseño que conviene conservar | — | ver §5 |

\* Alta condicionada a configuración de producción que no pude verificar (ver §6).

---

## 2. Detalle de hallazgos

### AUD-01 · Crítica · XSS almacenado en el backoffice desde datos escritos sin sesión

**Qué.** `iniciarOrden` no exige sesión y solo valida longitud del texto: `difunto.nombres` y `apellidoPaterno` hasta 60 caracteres, `titular.nombres` hasta 60, `direccion`, `comuna`, `region` hasta 120, `sector`, `patio` y `numeroSepultura` hasta 40 (`W:functions/ordenes-acceso.js:109-125`), y los guarda tal cual en `ordenes` (`:142-146,285-309`). El portal de operaciones los lee y los inserta con plantillas de texto en `innerHTML` sin escapar:
- `O:public/ordenes.html:460-480` (`${item.difunto}`, `${item.cliente}`, `${item.sepultura}`, `${item.operadorAsignado}`), con los campos armados en `:371-374`.
- `O:public/mis-trabajos.html:370-380` (difunto, sepultura, cementerio) y `:416` (`observaciones`).
- `O:public/todos-los-trabajos.html:396`, `O:public/trabajos-terminados.html:417`, `O:public/clientes.html:416-`, `O:public/planificacion.html:768-,834,979`, `O:public/mapa.html:253`, `O:public/informe-revision.html:293-,432` (`<li>✓ ${l}</li>`), `O:public/admin-usuarios.html:136-165,227`.
- Solo existen ayudantes de escape en `O:public/gastos-ingresos.html:1207` (`esc`) y `O:public/js/ubicacion-trabajo.js:146` (`escaparHtml`), y se usan en muy pocos sitios. La web sí tiene `W:public/js/html-seguro.js`, pero solo `pagos.html` lo importa.

**Por qué importa.** Un visitante anónimo crea una orden con, por ejemplo, un nombre de difunto de menos de 60 caracteres que carga un script remoto. Cuando alguien de staff abre «Órdenes» o «Mis trabajos», el script corre con su sesión y su claim, sin CSP que lo impida (AUD-16). Con esa sesión puede leer clientes y finanzas y escribir `staff/{uidDelAtacante}` con `activo: true`: `onStaffEscrito` (`W:functions/staffClaims.js:100-104`) le otorga el claim `staffActivo` a esa cuenta. Como las reglas no distinguen roles (AUD-02), basta ese claim para todo. El backlog de la web registra el riesgo como N19 «PENDIENTE (auditar)»; el del backoffice no lo menciona.

**Cómo corregir.**
1. Inmediato, en el backoffice: crear `public/js/html-seguro.js` (copia de la web) y envolver con `escaparHtml()` **toda** interpolación de datos de órdenes, contratos, informes y staff en `innerHTML`. Preferir `textContent` / `createElement` cuando no hace falta HTML. Revisar también los `onclick="...('${...}')"` que inyectan ids en atributos.
2. En paralelo, en el servidor (repo de la web): rechazar o normalizar `<`, `>`, comillas y caracteres de control en los textos de `validarEntradaIniciar` (defensa en profundidad; no sustituye al escape en la salida).
3. Añadir CSP (AUD-16) con `script-src` restringido; hoy hay `unsafe-inline` por Tailwind CDN, así que la CSP ayuda pero no basta: el escape es lo que cierra el hallazgo.
4. Prueba automática: un test que renderice cada tabla con `<img src=x onerror=...>` en todos los campos y verifique que no hay nodos `img` / atributos `on*`.

---

### AUD-02 · Alta · Escalada de privilegios dentro del staff; los roles no se hacen cumplir

**Qué.**
- `W:firestore.rules:70`: `allow create, update, delete: if esStaff()` en `staff/{staffId}`. Cualquier persona con `staffActivo` (un operador) puede crear o modificar el documento de cualquier uid, incluido el suyo, y `onStaffEscrito` convierte `activo: true` en claim.
- `W:firestore.rules:76-85`: `gastos`, `pagos`, `gastos_ingresos`, `notasCredito`, `trabajos` y los comprobantes de Storage (`W:storage.rules:82-85`) son accesibles a cualquier staff, aunque la matriz de `O:public/js/portal-common.js:12-21` los reserva a administradores.
- `W:firestore.rules:103`: cualquier staff puede crear y actualizar `informes`, incluido `estado: 'aprobado'`, que es lo que habilita al cliente a verlos (`:92-102`). La separación operador → supervisor no existe fuera de la interfaz.
- En la propia interfaz el rol solo se aplica en `admin-usuarios.html` (`O:public/admin-usuarios.html:290-302`); las demás páginas llaman `exigirStaff` (solo claim): p. ej. `O:public/gastos-ingresos.html:1502` (la matriz dice «administrador») y `O:public/informe-revision.html:597` (la matriz dice «supervisor»).
- `O:public/admin-usuarios.html:273-286`: `inicializarModulo()` muestra el contenido y carga la lista de staff de inmediato, sin esperar la validación de rol.

**Por qué importa.** Un operador cualquiera, o un script en su navegador (AUD-01), puede aprobar sus propios informes, abrir finanzas y notas de crédito, y crear o ascender otras cuentas. El backlog (N41/N49/N52) cubrió que un *cliente* no pueda darse acceso; no cubre la diferencia entre roles de staff.

**Cómo corregir.**
1. Que la Cloud Function que mantiene el claim también publique el rol: `setCustomUserClaims(uid, { ...clavesExistentes, staffActivo, rolStaff })` (ver AUD-23).
2. En las reglas: `esAdmin()` y `esSupervisor()` leyendo `request.auth.token.rolStaff`. `staff` solo escribible por admin; finanzas y comprobantes solo admin; `informes`: crear/actualizar por staff, pero cambiar `estado` a `aprobado`/`rechazado` solo supervisor o admin, validando `request.resource.data.diff(resource.data).affectedKeys()`.
3. En la interfaz: usar el rol del claim (no del documento) en todas las páginas, y que `admin-usuarios.html` no muestre nada hasta validar.
4. Idealmente, mover «aprobar informe» y «gestionar staff» a funciones callable con auditoría (quién, cuándo).

---

### AUD-03 · Alta · `crearTransaccionWebpay` no valida sesión ni prueba de acceso a la orden

**Qué.** El endpoint (`W:functions/transbank.js:40-154`) acepta cualquier POST con un `ordenId` (`:65`) y no llama a `verifyIdToken` ni compara el secreto de acceso (`accesoHash`). El navegador tampoco lo manda: `W:public/resumen-pago.html:821-836` envía solo el id, un monto que el servidor ignora y el código de piloto. No hay límite de intentos. Si la orden ya tuvo un intento sin resultado definitivo y Transbank dice que el token anterior no está autorizado, `resolverIntentoPrevio` lo descarta y se crea otra transacción (`W:functions/webpay-reintento.js:70-85`), que **reemplaza** `transaccionWebpay.token` y `buyOrder` de la orden (`W:functions/transbank.js:123-141`).

**Por qué importa.** Alguien que conozca el id de una orden en curso (viaja en `resumen-pago.html?orden=…`, en `localStorage` y en capturas de pantalla) puede pisar su token mientras la persona está pagando. Cuando vuelve el pago autorizado, `procesarResultadoWebpay` busca la orden por `buyOrder` (`W:functions/index.js:59-69`), no la encuentra, calcula el monto sobre `{}` y termina en `monto_inconsistente` escribiendo sobre un documento nuevo (`:85-95`): el cobro ocurrió y nada lo asocia a la orden; queda en `revisiones_pago` para reembolso manual. Es un vector de sabotaje de pagos. La especificación pedía validar la sesión (specs 028/029) en los endpoints críticos; aquí falta.

**Cómo corregir.**
1. Exigir la prueba de acceso, igual que `validarAccesoCorreo` (`W:functions/correo-relay.js:14-27`): el navegador ya tiene el `acceso` en `sessionStorage` (`resumen-pago.html:551`), que se envía en el cuerpo, y el servidor lo compara con `accesoHash` (`verificarSecreto`). Alternativa o complemento: `Authorization: Bearer` y comparar `uid` con `usuarioId/clienteUid`.
2. Rechazar el reemplazo de un `transaccionWebpay` vigente si fue creado hace menos de, por ejemplo, 10 minutos y no está vencido.
3. Límite por IP y por orden con el mismo `consumirLimite` de `ordenes-acceso.js`.
4. Pruebas: ordenId ajeno sin secreto → 403 con respuesta idéntica a «no existe».

---

### AUD-04 · Alta · `rut_lookup`: cualquier autenticado puede crear el registro de un RUT ajeno

**Qué.** `W:firestore.rules:51`: `allow create: if esStaff() || (esAutenticado() && request.resource.data.uid == request.auth.uid)`. El id del documento (el RUT) no está atado al usuario que lo crea, así que cualquiera con sesión puede crear `rut_lookup/<RUT de otra persona>` con `uid` propio, mientras ese documento no exista. El servidor confía en ese documento: `vinculoDelRut` (`W:functions/activacion.js:59-80`) responde 409 `cuenta_existente` si `rut_lookup.uid` apunta a una cuenta viva. `escribirRutLookupSiLibre` (`W:functions/perfil-rut.js:58-70`) tampoco lo reescribe. El modo «coincidencia» de `verificarCuentaExistente` también lo lee (`cuenta-existente.js:91`). El portal heredado lo hace desde el navegador (`O:public/js/auth.js:107`).

**Por qué importa.** Un cliente puede impedir que el titular real cree su cuenta tras pagar («Ya existe una cuenta para este RUT»), o dejar basura que enrede el vínculo RUT↔cuenta. Precondición: una cuenta cualquiera.

**Cómo corregir.** Nadie debe escribir `rut_lookup` desde el navegador: el servidor ya lo hace (`activacion.js:132-138`, spec 036 R6). Cambiar a `allow create, update, delete: if esStaff()` y dejar la lectura propia como está. Antes, confirmar que ningún HTML activo escribe esa colección (en la web no hay; `O:public/js/auth.js:90-112` no se usa desde ninguna página). Auditar por lectura los `rut_lookup` cuyo `uid` no coincida con la cuenta de `<rut>@gravecare.cl`.

---

### AUD-05 · Alta · Perfil: dos fuentes de verdad y guardado que destruye datos

**Qué.**
1. `W:public/perfil.html:287-305` guarda con `updateDoc(uRef, { fechaNacimiento, titular: { nombreCompleto, telefono, email, fechaNacimiento, pais, region, comuna, direccion } })`. En Firestore, `updateDoc` con un mapa reemplaza **todo** el campo `titular`: se pierden `rut`, `nombres`, `apellidoPaterno`, `apellidoMaterno` y cualquier otro valor que ya estuviera dentro.
2. `W:public/perfil.html:230-240` lee con `const tit = data.titular || data` y luego `tit.rut`, `tit.telefono`, etc. Es todo-o-nada: en cuanto existe `titular` (después del primer guardado), `tit.rut` queda vacío y la pantalla muestra «RUT: No especificado» y el campo RUT vacío; la comuna, región y teléfono de la raíz nunca se usan como respaldo. Solo la fecha tiene respaldo (`:236`).
3. La función correcta ya existe en la web: `combinarPerfil` (`W:public/js/nuevaCompra.js:123-129`, titular gana por campo sobre la raíz), pero `perfil.html` y `contratacion-plan.html:912-929` no la usan.
4. El servidor ignora `titular`: `iniciarOrden` toma `perfil[k]` de la raíz (`W:functions/ordenes-acceso.js:262-271`) y **sobrescribe** lo que el navegador mandó; lo mismo en `W:functions/index.js:124-137` (orden atada) y `estadoCuenta` (`ordenes-acceso.js:322-323`) y `cuenta-existente.js:101`.
5. En el registro, el navegador escribe la raíz (`W:public/registro.html:645-671`), de modo que raíz y `titular` evolucionan por separado.

**Por qué importa (pilares 1 y 4).** Una persona corrige su domicilio en «Perfil»; en la siguiente compra el formulario aparece con el domicilio nuevo (viene de `titular` vía `combinarPerfil`), pero el servidor lo reemplaza con el de la raíz (el antiguo), que es el que termina en `ordenes.titular` y en el PDF del contrato (`W:functions/contrato.js:141-143`). Es un contrato con datos erróneos. Además la propia pantalla de perfil pierde el RUT.

**Cómo corregir.**
1. `perfil.html`: guardar con rutas de campo (`updateDoc(uRef, { 'titular.telefono': …, 'titular.direccion': …, … })`) o `setDoc(..., { merge: true })`, nunca reemplazando el mapa; incluir también `nombres` y `apellidos` si se editan.
2. `perfil.html` y `contratacion-plan.html`: leer con `combinarPerfil(data)` (por campo, titular gana si no está vacío).
3. Servidor: un único `perfilEfectivo(data)` en `functions/` (misma regla que `combinarPerfil`) usado en `iniciarOrden`, `procesarResultadoWebpay`, `estadoCuenta` y `cuenta-existente`.
4. Decidir una sola fuente: o se migra todo a `titular`, o `perfil.html` escribe la raíz. Mientras tanto, la regla «titular sobre raíz, campo a campo» debe estar en un solo módulo compartido.
5. Pruebas (ya hay base en `tests/`): guardar perfil con `titular` previo y verificar que `rut` sigue; comprar con perfil editado y verificar que `ordenes.titular.direccion` es la editada.

---

### AUD-06 · Alta (condicional) · La cuenta de un RUT se concede sin probar que el comprador es su titular

**Qué.** La única prueba que pide el sistema para crear la cuenta `<rut>@gravecare.cl` es una compra pagada con ese RUT: el token de activación va al correo que quien compra escribió en la orden (`W:functions/index.js:163-172`, `W:functions/activacion.js:238-246`) o se usa el secreto de la orden (`activacion.js:168-186`). No hay verificación de que quien escribe el RUT sea su dueño. Con el RUT de otra persona se obtiene su cuenta, y con ella `migrarBorrador` copia al perfil los datos del borrador `cliente_<rut>` (`activacion.js:35-50`), que son los que el comprador escribió. Si el titular real intenta contratar después, `iniciarOrden` responde 409 y le pide iniciar sesión (`ordenes-acceso.js:252-255`) en una cuenta que no controla.

Mientras Webpay opere en integración (`TRANSBANK_ENV` distinto de `production`, `W:functions/pagos-habilitados.js:14-16`), el pago se hace con tarjetas de prueba públicas: el costo para el atacante es cero y las órdenes quedan con `modoPago: 'integracion'` pero igual crean cuenta, contrato y correos. No pude verificar el valor de `TRANSBANK_ENV` ni de `PILOTO_RESTRINGIDO` en producción (§6).

**Cómo corregir.**
- No crear cuenta, token ni perfil cuando `modoPago` sea integración fuera del emulador/QA (o exigir `PILOTO_RESTRINGIDO` con código válido).
- Añadir una verificación de titularidad antes de entregar la cuenta: p. ej. código de un solo uso al teléfono o correo ya asociados al RUT, o confirmación de datos que solo el titular conoce; marcar `identidadVerificada: false` hasta que el equipo valide el primer servicio.
- Que el modo «coincidencia» de `verificarCuentaExistente` (RUT + correo) sea el mínimo para avisar de cuenta existente, en vez de «abierto» (decisión del dueño, `config-contratacion.js:15`; queda documentada como riesgo aceptado, AUD-13).

---

### AUD-07 · Alta (latente) · Oneclick marca la orden como pagada sin cobrar y no valida sesión

**Qué.** `W:functions/oneclick.js:145-159`: al terminar la **inscripción** de la tarjeta (`finish`) con `response_code === 0` escribe `estado: 'Confirmado'`, `pagoConfirmado: true`, `fechaPago`. Inscribir una tarjeta no cobra nada. `iniciarInscripcionOneclick` (`:40-108`) no valida sesión ni acceso a la orden y acepta cualquier `ordenId`; el endpoint de confirmación busca la orden por `tokenWpm`. Además: devuelve `error.message` al navegador (`:103-106`) y lo pone en la URL de redirección (`:170`), imprime el token y el correo en los registros (`:72,126,130`), y usa `process.env.TRANSBANK_API_KEY` y `TRANSBANK_ONECLICK_COMMERCE_CODE` como variables comunes (`:22-28`) en lugar de Secret Manager; su criterio de producción (`NODE_ENV` + código de comercio, `W:functions/entorno-local.js:60-62`) es distinto del de Webpay (`TRANSBANK_ENV`).

**Por qué importa.** Hoy no se explota porque `ONECLICK_HABILITADO` es `false` por defecto (`W:functions/pagos-habilitados.js:17,29`) y ambas funciones responden 403. Si se enciende tal cual, cualquiera podría dejar su orden «Confirmada» (contrato incluido) inscribiendo una tarjeta de prueba o real.

**Cómo corregir.** Antes de habilitar: (1) no tocar `estado`/`pagoConfirmado` en la inscripción; el estado pagado solo cuando se autorice el cobro (`authorize` del Mall); (2) exigir `acceso` o Bearer + límite de intentos; (3) credenciales por `defineSecret`; (4) mismo criterio de entorno que Webpay; (5) errores genéricos y registros sin token ni correo; (6) comparar el monto autorizado con `determinarMontoServidor`, como ya hace Webpay.

---

### AUD-08 · Media · El servidor pisa el uid de la sesión con `cliente_<rut>`; el front arma el mismo identificador de respaldo

**Qué (servidor).**
- `iniciarOrden` guarda `usuarioId`/`clienteUid` con el uid de la sesión verificada (`W:functions/ordenes-acceso.js:307`), lo correcto. Pero al confirmar el pago, si el RUT del titular no tiene cuenta (modo «nuevo»), `procesarResultadoWebpay` reescribe ambos con `cliente_<rut>` (`W:functions/index.js:115-119,156`), y `generarContratoParaOrden` lo repite (`W:functions/contrato.js:304-306,406`). Consecuencia: una persona con sesión que contrata para un tercero (RUT sin cuenta) deja de ver su propia compra; la orden pasa a un identificador que ninguna cuenta puede usar (`firestore.rules:29`).
- El identificador temporal contiene el RUT en claro: aparece en ids de documentos (`usuarios/cliente_<rut>`, subcolecciones), en campos de órdenes y contratos y en el nombre de logs/exportaciones. Hay un respaldo `"cliente_temp"` compartido si el RUT estuviera vacío (`index.js:118`), hoy inalcanzable porque el RUT se valida, pero es un identificador único para todos los casos sin RUT.

**Qué (front).**
- `W:public/contratacion-plan.html:868`: `auth.currentUser?.uid || (clienteEncontradoPorRut ? … : "cliente_" + rutLimpio)`. El respaldo existe aunque no haya sesión.
- `W:public/contratacion-Spot.html:839`: `clienteEncontradoPorRut ? … : "cliente_" + rutLimpio` **sin considerar la sesión**; con sesión iniciada la orden de Spot se arma con `cliente_<rut>`.
- Ese uid viaja en la orden del navegador (`W:public/js/nuevaCompra.js:247-248,352-353`) y queda en `sessionStorage` y `localStorage` (`contratacion-plan.html:724-733`). El servidor lo ignora al crear la orden (usa el token), así que el efecto real es de higiene y de datos personales en almacenamiento, no de pertenencia.

**Cómo corregir.**
- Front: eliminar `usuarioId`/`clienteUid` del objeto de orden del navegador (el servidor es la única fuente) o dejarlos solo si hay sesión; quitar la rama `clienteEncontradoPorRut` (código muerto, ver §4).
- Servidor: no pisar un uid real. Si la orden nació con la sesión de la cuenta A y el titular es otro RUT sin cuenta, conservar `usuarioId = A` y registrar el titular aparte, o crear la vinculación pendiente (`vinculacionCuenta: 'pendiente_de_inicio_de_sesion'`) sin tocar el dueño.
- Reemplazar `cliente_<rut>` por un identificador opaco (`pre_<hash o UUID>`) con un mapa privado RUT→preuid, de modo que el RUT no viaje en ids.

---

### AUD-09 · Media · La precarga con sesión pierde región, comuna y nombres, y asume «Metropolitana de Santiago»

**Qué.** Con sesión, `W:public/contratacion-plan.html:912-929` llama `rellenarFormularioConDatos` con solo `nombreCompleto`, `rut`, `email`, `telefono`, `pais` y `direccion`. La función (`:466-540`) entonces:
- toma `region` de un valor ausente y cae en `"Metropolitana de Santiago"` (`:522`) y deja la comuna vacía (`:523,529-532`): una persona de otra región ve la RM y debe corregir a mano; si no se da cuenta, se contrata con región errónea (la validación del servidor solo comprueba que la comuna pertenezca a la región elegida, `ordenes-acceso.js:122-125`);
- parte el nombre completo por espacios (`:481-496`): «María José González Pérez» queda como nombres «María», paterno «José», materno «González Pérez». El perfil sí trae `nombres`, `apellidoPaterno`, `apellidoMaterno`, pero no se pasan;
- `titularDesdePerfil` y `construirOrdenPlan` también rellenan región con «Metropolitana de Santiago» cuando falta (`W:public/js/nuevaCompra.js:202,237`), de modo que el contrato puede salir con una región asumida.

**Cómo corregir.** Pasar a `rellenarFormularioConDatos` el perfil ya combinado con `combinarPerfil` (incluyendo `nombres`, apellidos, `region`, `comuna`); no asumir región por defecto: dejar el selector sin elegir y pedirla; usar `partirNombre` de `orden-iniciar.js` solo como último recurso.

---

### AUD-10 · Media · `usuarios/{uid}`: el dueño puede escribir cualquier campo, incluidos los de estado

**Qué.** `W:firestore.rules:18-22` permite `read, write` al dueño sin restringir campos, tanto en el documento como en toda subcolección. El navegador escribe `rol: 'cliente'`, `estadoSuscripcion: 'Activo'` y `planNombre` (tomado de `sessionStorage`, con respaldo «Plan 6») en el registro (`W:public/registro.html:645-671`); `W:public/js/auth.js` (obsoleto) y el contrato de datos incluyen `tieneClave`, `cuentaActivada`, `authEmail`, `rutLimpio`, `consentimientoCumple`, `uid`. Cualquier cliente puede cambiarlos desde la consola del navegador. La única decisión de acceso basada en `usuarios.rol` está en `W:public/login-ops.html:166-172` (AUD-11), pero otros consumidores (listados, reportes, correos) pueden confiar en `estadoSuscripcion`/`planNombre`.

**Cómo corregir.** Restringir con `request.resource.data.diff(resource.data).affectedKeys().hasOnly([...campos de contacto editables...])` en `update`, y limitar `create` a los campos de contacto. Pasar al servidor la escritura de `rol`, `estadoSuscripcion`, `planNombre`, `tieneClave`, `cuentaActivada`, `authEmail`, `rutLimpio`, `consentimientoCumple`. Para que el registro siga funcionando, primero hay que mover esas escrituras a `crearCuentaCliente` (ya escribe varias) y recién después cerrar la regla.

---

### AUD-11 · Media · `login-ops.html` de la web: todo `@gravecare.cl` y `usuarios.rol` cuentan como staff

**Qué.** `W:public/login-ops.html:143` considera staff a quien tenga el correo personal del dueño (fijo en el código) **o cualquier correo que termine en `@gravecare.cl`**. Las cuentas de todos los clientes tienen exactamente ese formato (`<rut>@gravecare.cl`). `:166-172` además acepta `usuarios.rol` (escribible por el dueño, AUD-10) en `staff/operador/admin/...`. Si pasa, redirige a `/portal.html`, que no existe en ese sitio (N25 del backlog).

**Por qué importa.** Es control de interfaz, no de datos (las reglas exigen el claim), pero confunde y puede pasar a ser una puerta real si algo del sitio confía en esa pantalla. Además deja una dirección personal fija en el JavaScript público.

**Cómo corregir.** Retirar esta página de la web (el backoffice ya tiene la suya) o reemplazar la lógica por `getIdTokenResult(true)` y `claims.staffActivo === true`, como `O:public/js/acceso-staff.js`. Quitar las direcciones fijas.

---

### AUD-12 · Media · `requireStaffAccess` no comprueba el claim y concede «administrador» a una lista fija de correos

**Qué.** `O:public/js/portal-common.js:50-105` decide el acceso con el documento `staff` (por uid o por correo, `:21-44`) y, si el correo está en una lista fija de cuatro direcciones (`:64-70`, dos personales y dos genéricas del dominio), fabrica un perfil `administrador` aunque no exista documento (`:77-86`). No exige el claim ni `email_verified`. Solo `admin-usuarios.html` lo usa (`:114,290`); las demás páginas usan `exigirStaff` (claim). En `admin-usuarios.html`, además, `inicializarModulo()` muestra el módulo y carga la lista antes de validar (`:273-286`), la comprobación de administrador acepta también dos correos personales fijos (`:295`), e inserta `item.nombre`/`item.email` sin escapar (`:143-144`).

**Por qué importa.** Los datos siguen protegidos por reglas, pero la pantalla de administración de staff queda gobernada por correos fijos y por un documento que cualquier staff puede editar (AUD-02). Si Authentication permite crear cuentas con una de esas direcciones genéricas que aún no exista, la interfaz la trataría como administradora.

**Cómo corregir.** Sustituir `requireStaffAccess` por `exigirStaff` + rol desde el claim (AUD-02); eliminar la lista fija y las comparaciones por correo; escapar la salida; mostrar el módulo solo tras validar.

---

### AUD-13 · Media · Enumeración de cuentas y límites de uso eludibles

**Qué.** `verificarCuentaExistente` en modo «abierto» (por defecto) revela si un RUT tiene cuenta (decisión documentada del dueño: `W:functions/cuenta-existente.js:1-18`, `W:public/js/config-contratacion.js:15`). Además, `iniciarOrden` devuelve 409 `CUENTA_EXISTENTE` para el mismo fin (`ordenes-acceso.js:252-255`). Los límites son por IP (20/h) y por RUT (5/h). `ipDe` toma el **primer** elemento de `X-Forwarded-For` (`cuenta-existente.js:119-122`), que lo controla quien llama (Google agrega la IP real al final). Rotando ese encabezado se evita el límite por IP; solo queda el de 5 por RUT. App Check existe pero está desactivado (`:112-117`, `APP_CHECK_OBLIGATORIO`).

**Cómo corregir.** Usar `req.ip` (que ya usa `ordenes-acceso.js:410`) o el último salto fiable de `X-Forwarded-For`; activar App Check con enforcement en las funciones públicas; si se mantiene «abierto» como decisión de negocio, dejar la aceptación del riesgo registrada y añadir un tope diario global.

---

### AUD-14 · Media · Contraseña mínima de 6 caracteres y cuentas sin verificar

**Qué.** Servidor (`W:functions/activacion.js:15,219`), registro (`W:public/registro.html`, `contrasena.length < 6`) y portal heredado (`O:public/js/auth.js:81`) aceptan 6 caracteres. La cuenta se crea con `emailVerified: false` (`activacion.js:108`) y con correo ficticio, de modo que no hay verificación posterior de correo. Los datos protegidos incluyen RUT, domicilio, contratos y fotos.

**Cómo corregir.** Mínimo 10 caracteres (o política de Firebase Auth con requisitos) en servidor y formulario, bloqueo de claves triviales, y respetar el mensaje de error del servidor.

---

### AUD-15 · Media · Datos personales y de la orden en `localStorage`

**Qué.** La sesión de Auth se limita a la pestaña (spec 027, `browserSessionPersistence`), pero los datos quedan en `localStorage`: `datosContratacion`, `datosTitular` (RUT, correo, teléfono, domicilio), `gravecare_last_order` (`W:public/contratacion-plan.html:731-733`); `gravecare_orden_id` y `gravecare_ultimo_resumen_valido` (la orden completa) (`W:public/resumen-pago.html:553,590,596`). `registro.html` luego los usa para precargar (`localStorage.getItem('gravecare_last_order')`). En un equipo compartido siguen ahí tras cerrar la sesión.

**Cómo corregir.** Pasar todo a `sessionStorage` (ya se usa para el secreto de la orden) y limpiar al cerrar sesión / tras confirmar el pago; no guardar el RUT en claro.

---

### AUD-16 · Media · Sin cabeceras de seguridad, scripts de terceros sin SRI y clave de Maps compartida

**Qué.**
- `W:firebase.json:1-68` y `O:firebase.json:1-17` no definen `headers`: sin `Content-Security-Policy`, sin `frame-ancestors`/`X-Frame-Options` (el portal usa iframes y es clickjackeable), sin `X-Content-Type-Options` ni `Referrer-Policy`.
- Tailwind por `cdn.tailwindcss.com` (sin versión ni SRI) en la web y en 9 páginas del portal, `chart.js` y `pdf.js` y, bajo demanda, `tesseract.js` / `pdfjs-dist` por jsDelivr (`O:public/js/facturaOcr.js:48-61`). Un compromiso de esos CDN ejecuta código en una sesión de staff con claim.
- `O:public/mapa.html:13` carga Google Maps JS con la misma clave que la configuración web de Firebase. No pude verificar si la clave tiene restricciones de referrer ni de API (§6); sin ellas cualquiera puede consumir cuota o facturación.
- El SDK de Firebase está en versiones distintas (`10.7.0` en la web, `10.12.0` en el portal) y la configuración está duplicada en 9 páginas (N179).

**Cómo corregir.** Añadir `headers` con CSP (`default-src 'self'`; scripts solo de gstatic, jsdelivr con versión fija y hash, y Tailwind compilado en el build para eliminar `unsafe-inline`), `frame-ancestors 'self'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`. Compilar Tailwind y servir los scripts desde el sitio. Restringir la clave de Maps por referrer y a las APIs usadas, o crear una clave aparte.

---

### AUD-17 · Media · Informes: actualizaciones destructivas, fotos duplicadas en el documento y atribución fija

**Qué.**
- Captura y revisión leen la orden, modifican `programacionVisitas` completo en memoria y lo escriben de vuelta (`O:public/informe-captura.html:529-540`, `O:public/informe-revision.html:505-530,562-580`; también varias en `planificacion.html`). Dos personas que editan visitas distintas de la misma orden se pisan (se pierde el estado de una visita).
- `O:public/informe-captura.html:513-518` guarda cuatro fotos como data URL dentro del documento y repite dos de ellas (`antes`, `despues`), de modo que son seis cadenas base64 en un documento de Firestore (límite 1 MiB). Hay compresión JPEG 0,65 (`:318`), pero no un tope de tamaño total. Las reglas de Storage para `informes/` (`W:storage.rules:31-41`) existen y no se usan.
- Atribución: `O:public/informe-captura.html:520` termina con el nombre completo del dueño como `operador` si falta el nombre de sesión; `O:public/informe-revision.html:487,544` hace lo mismo con `supervisorNombre`; `O:public/portal.html:368` y `O:public/js/portal-common.js:80` también. Solo se guarda un nombre, no el uid. El informe puede atribuirse a una persona que no lo hizo y el cliente lo ve.

**Cómo corregir.** Actualizar con rutas de campo (`'programacionVisitas.v_2.estado'`) o transacción; subir las fotos a Storage (`informes/{ordenId}/…`) y guardar solo la URL; quitar la duplicación; guardar `operadorUid`/`supervisorUid` del token y no usar nombres de respaldo.

---

### AUD-18 · Media · Perfil: validación y consentimiento de la fecha de nacimiento

**Qué.** `W:public/perfil.html:147-161` usa texto libre para país, región y comuna (el servidor tiene la lista oficial en `W:functions/regiones-comunas.js` y `W:public/js/regiones-comunas.js`); el teléfono y el correo no se validan más allá de `type="email"`; los textos no tienen límite. La fecha de nacimiento usa `<input type="date">` (formato `AAAA-MM-DD`, correcto) y se persiste en la raíz y en `titular`, y se lee con respaldo (`:236`), pero: (a) no se valida que no sea futura ni anterior a 1900 como en el alta (`W:functions/activacion.js:86-96`, spec 038); (b) borrar la fecha guarda `''`; (c) el consentimiento `consentimientoCumple` solo se escribe al registrarse (`activacion.js:122-130`, `registro.html:661`), así que quien agrega su fecha desde «Perfil» no deja constancia; (d) la regla de Firestore acepta cualquier valor (AUD-10).

**Cómo corregir.** Selectores de región y comuna con la lista oficial; reutilizar `validarTelefono` y `fechaNacimientoValida`; registrar el consentimiento al guardar la fecha por primera vez; guardar `deleteField()` en vez de `''` al borrar.

---

### AUD-19 · Baja · Lecturas públicas y enlaces de contrato permanentes

- `W:storage.rules:35` — `informes/{ordenId}/{archivo}`: `allow read: if true`. Las fotos no se pueden listar, pero cualquiera con la ruta las ve y no hay distinción entre informes aprobados y no aprobados. Hoy no se suben fotos a esa ruta (AUD-17): o se elimina la regla o se pasa a lectura autenticada del dueño/staff con URL firmada.
- `W:functions/contrato.js:317-325` — la URL del contrato lleva `firebaseStorageDownloadTokens` fijo y se guarda en la orden y en el contrato. Es un enlace permanente a un PDF con RUT, domicilio, correo y teléfono. Preferible emitir URL firmada de corta vigencia desde una función callable.
- El comentario de `storage.rules:1-5` dice que las reglas están «sincronizadas con gravecare-operaciones/storage.rules»; la directriz del backoffice ya las retiró de ese repo (`legacy/reglas-deprecadas/`). Actualizar el comentario para evitar que alguien «replique» cambios.

### AUD-20 · Baja · Contrato con precio por defecto y lógica de plan duplicada

`W:functions/contrato.js:157` usa `34990` si falta el monto de la orden; un contrato con precio inventado no debería generarse (lanzar `ErrorTarifa` y dejar `contratoEstado: 'error'`). `construirDetalleExactoServicio` (`:42-119`) vuelve a interpretar el plan con `includes("12")`, `includes("4")`, etc., cuando `W:functions/tarifas.js` ya expone `describirPlan`/`planDeOrden`; un nombre como «Plan 12 · 4 ramos» depende del orden de los `if`. Unificar en `tarifas.js`.

### AUD-21 · Baja · CORS

`W:functions/cors.js:6-7` incluye `http://localhost:5000` y `http://localhost:3000` en producción (cualquier aplicación local del usuario en esos puertos puede leer las respuestas de las funciones públicas) y no envía `Vary: Origin`. Dejar los orígenes de localhost solo bajo el emulador (el bloque de `:11-14` ya existe) y añadir `Vary: Origin`.

### AUD-22 · Baja · Redirecciones con parámetros del navegador y anulación sin sesión

`W:functions/index.js:267,274-290` arma `…&orden=${ordenId}` con `TBK_ORDEN_COMPRA` tal como llega (sin `encodeURIComponent`); el destino es fijo, así que no es redirección abierta, pero permite inyectar parámetros en `confirmar-pago.html`. Además, cualquiera que conozca un `buyOrder` u `ordenId` puede marcar una orden **no pagada** como cancelada o con tiempo agotado (`webpay-retorno.js:54-60` protege solo las ya pagadas); el pago posterior la vuelve a confirmar, pero puede confundir al cliente. Codificar los parámetros y exigir `token_ws`/`TBK_TOKEN` válidos para marcar estados.

### AUD-23 · Baja · Claims y alta de staff frágiles

`W:functions/staffClaims.js:56` reemplaza **todos** los custom claims (`{ staffActivo }`), de modo que cualquier otro claim se pierde; combinar con los existentes (`getUser` + `setCustomUserClaims({ ...claims, staffActivo })`). `O:public/admin-usuarios.html:241-255` pide el UID a mano; si no es el uid de Authentication (caso N49), el claim nunca se asigna. Conviene que una función callable cree/valide al usuario y escriba `staff/{uid}` con el uid real.

### AUD-24 · Baja · Mensajes internos hacia el navegador

`W:functions/oneclick.js:103-106` devuelve `error.message` en `details` y `:170` lo concatena a la URL; `W:public/resumen-pago.html:837-841` muestra al usuario el texto crudo de la respuesta (`errText`). En el portal, `err.message` entra en `innerHTML` (`O:public/admin-usuarios.html:227`, `O:public/informe-revision.html:265`). Devolver mensajes genéricos y registrar el detalle solo en el servidor.

### AUD-25 · Baja · Sin límite de intentos en `crearCuentaCliente` y `datosActivacion`

`W:functions/index.js:393-420` no llama a `consumirLimite`. Los secretos son de 192 y 256 bits, así que la fuerza bruta no es viable, pero `datosActivacion` devuelve RUT completo, correo, teléfono y domicilio a quien tenga el token (`W:functions/activacion.js:253-267`). Añadir el mismo límite por IP que usan las demás funciones públicas y registrar solo huellas.

---

## 3. Verificación por pilar

### Pilar 1 · Integridad de datos y rutas de autenticación
- **Órdenes con el uid de la sesión:** correcto en el servidor (`W:functions/ordenes-acceso.js:249-256,307`: solo el uid de un ID token verificado; con una cuenta existente y sin su sesión responde 409). Falla: el servidor lo pisa con `cliente_<rut>` (AUD-08) y el front todavía construye ese identificador (AUD-08).
- **Identificadores en texto plano:** `usuarios/cliente_<rut>` y campos `usuarioId/clienteUid` con el RUT (AUD-08).
- **Prioridad `titular` sobre raíz:** `combinarPerfil` en `nuevaCompra.js` la cumple; `perfil.html`, `contratacion-plan.html` y todo el servidor no (AUD-05, AUD-09).
- **Contratos:** el disparador no toma domicilio de otra fuente (sin dirección y comuna del titular no se genera, `contrato.js:255-259,291-293`), bien; pero hereda el titular de la orden, que viene de la raíz del perfil (AUD-05).

### Pilar 2 · Reglas de Firestore y Storage
- Aislamiento por uid: **cumple** para `usuarios`, `ordenes` (lectura propia; escritura solo staff), `contratos`, `informes` (aprobados y de su orden) y `rut_lookup` (lectura). Colecciones del servidor (`activaciones`, `webpay_retornos`, `limites_verificacion`, `revisiones_pago`, `correos_pendientes`, `mail`) quedan bloqueadas por la regla por defecto, lo que es correcto para el Admin SDK.
- Staff por claim: **cumple** en las reglas; falla la granularidad de roles (AUD-02) y la creación libre en `rut_lookup` (AUD-04), y `usuarios` sin restricción de campos (AUD-10).
- Storage: contratos, comprobantes y facturas solo para staff; fotos con lectura pública (AUD-19).

### Pilar 3 · Cloud Functions
| Función | `verifyIdToken` / prueba de acceso | CORS | Límite | Notas |
|---|---|---|---|---|
| `iniciarOrden` | Opcional (sesión) y decide cuenta existente | cors.js | 20/IP/h | Correcto; guarda el uid solo con ID token verificado |
| `consultarOrden` | Secreto de la orden **o** sesión (uid dueño / correo verificado / staff) | cors.js | 60/IP/h | Respuesta idéntica para «no existe» y «no autorizado» |
| `crearTransaccionWebpay` | **Ninguna** | cors.js | Ninguno | AUD-03 |
| `confirmarTransaccionWebpay` | No aplica (retorno de Transbank, idempotente por token) | n/a | n/a | AUD-22 |
| `enviarCorreoConfirmacion` | Secreto de la orden + orden pagada | cors.js | No | Correcto |
| `crearCuentaCliente` | Token de activación o secreto de orden | cors.js | **Ninguno** | AUD-04, AUD-06, AUD-25 |
| `verificarCuentaExistente` | Pública por diseño | cors.js | IP+RUT (IP eludible) | AUD-13 |
| `generarContratoAlPagar` | Trigger (Admin SDK) | n/a | n/a | No pisa `rut_lookup` con cuenta existente; sí pisa uid (AUD-08) |
| `iniciar/confirmarInscripcionOneclick` | **Ninguna** | cors.js / no | No | AUD-07 (apagado) |
| `verificarDuplicados`, `reenviarCorreosPendientes`, `sincronizarStaffExistente` | Claim `staffActivo` | `cors: true` / callable | n/a | Correcto |
- **Spec 024** (no sobrescribir datos maestros): el trigger respeta cuenta existente y `rut_lookup` ajeno; `escribirPerfilTemporal` solo completa campos vacíos. Pendiente: `migrarBorrador` copia todo el borrador al perfil nuevo sin filtrar campos (`activacion.js:35-50`).
- **Secretos:** `SMTP_PASS` y `TBK_*` por Secret Manager sin valor de respaldo (`correo.js:9-13,89-91`, `webpay-cliente.js:16-19`); `CODIGOS_PILOTO` también y se compara en tiempo constante. Oneclick no (AUD-07). Los valores de integración en `oneclick.js`/`transbank.js` son las constantes públicas del SDK. La clave web de Firebase es pública por diseño; ver AUD-16 para Maps.

### Pilar 4 · Consistencia de interfaz
- `perfil.html` renderiza y persiste la fecha de nacimiento correctamente (formato, raíz y `titular`, lectura con respaldo) pero sin validación ni consentimiento (AUD-18); renderiza y persiste domicilio (`direccion`, `comuna`, `region`, `pais`) en `titular` pero lo **lee** con el esquema todo-o-nada y **reemplaza** el mapa (AUD-05).
- `contratacion-plan.html` renderiza `direccionTitular`, región y comuna con listas oficiales y las manda a `iniciarOrden`; con sesión la precarga pierde región/comuna/nombres (AUD-09) y el servidor sustituye los datos por la raíz del perfil (AUD-05).
- Compartido: `combinarPerfil`/`titularDesdePerfil`/`cargarPerfil` (`nuevaCompra.js`) deberían ser el único camino de lectura de perfil en el navegador.

---

## 4. Código obsoleto, duplicado o muerto a refactorizar

Web (`C:\Proyectos\Gravecare`):
- `functions/contacto.js` (349 líneas): copia antigua de `contrato.js` (`CONTRATO_VERSION = "2026-09-v1"`); ningún módulo la importa. Moverla a `legacy/`.
- `functions/disparador-alta.js` (obsoleto spec 032), `functions/cuenta-existente.js:43-48` (`cuentaActiva`), `functions/activacion.js:189-209` (`sinToken`), `functions/entorno-local.js:64-81` (`crearTransporte`), `functions/correo-respaldo.js` (segundo emisor de correo: confirmar que no duplica envíos con `enviarConfirmacionDeOrden`).
- `public/js/auth.js` (marcado obsoleto, sin importadores).
- Código inalcanzable por `return null` o `if (false &&)`: `buscarClientePorRut` en `contratacion-plan.html:431-464` y `contratacion-Spot.html:545-575` (incluye `getDocs(collection(db, "usuarios"))`, que las reglas rechazarían), `confirmar-pago.html:480-500`, y el bloque de modal `modalRutExiste` que depende de ellas. Intento de borrar `usuarios/cliente_<rut>` desde el navegador en `registro.html:675-681` (las reglas lo rechazan y contradice «el borrador se conserva», spec 001 R7).
- Consultas de compatibilidad con colección `users` inexistente y búsqueda por correo en `usuarios` desde `sepulturas.html:195-200`, `contratos.html:530-532`, `fotos.html:354-356`, `pagos.html:227-229`: las reglas las rechazan; limpiar.
- Lógica de planes triplicada: `contrato.js:42-119`, `tarifas.js` y `public/js/tarifas-publico.js`/`nuevaCompra.js:216-222` (precios por defecto en el navegador).
- Configuración de Firebase literal en 9 páginas (N179); `public/functions/` (carpeta con `node_modules` y `package-lock.json`, el segundo se publica); `functions/.env*` existe localmente (ignorado por git; no se leyó).

Portal de operaciones (`C:\Proyectos\GravecareOpsPortal`):
- `public/gastosIngresos.js` (467 líneas) y `public/js/gastosIngresos.js` (421): dos copias que difieren; `gastos-ingresos.html` debe usar una sola.
- `fix.js` y `generar-archivos.js` en la raíz: generadores que embeben HTML completo (copias de páginas, desactualizadas); mover a `legacy/`.
- `public/js/auth.js`: `registerUser`, `loginUser`, `resetPasswordWithEmail` no los usa ninguna página (solo `observeAuthState`/`logoutUser` desde `portal-common.js`); escriben `usuarios` y `rut_lookup` con otro esquema de cuenta (correo real) distinto del de la web.
- `public/js/*.test.mjs` (10 archivos) se publican en Hosting (BO-1 ya registrado).
- `public/js/portal-common.js` (`requireStaffAccess`, `PERMISOS_PAGINAS`) frente a `acceso-staff.js` (`exigirStaff`): dos mecanismos de acceso; unificar (AUD-12).

---

## 5. Aciertos de diseño que conviene conservar (Info)
- Monto, estado y dueño de la orden los fija el servidor; el cuerpo del navegador se filtra por lista de campos (`ordenes-acceso.js:86-150`).
- Secretos y tokens: 256 y 192 bits, solo se guarda el hash, comparación con `timingSafeEqual`; el token de activación va en el fragmento de la URL, no en la consulta.
- Idempotencia de los retornos de Webpay (`webpay_retornos` por huella del token) y reintento seguro que consulta el estado antes de crear otra transacción.
- Reglas de Firestore con aislamiento por uid, claim `staffActivo` y regla por defecto de bloqueo; `informes` visibles al cliente solo si están aprobados y la orden es suya.
- Registros sin RUT, correo ni IP en claro (huellas), respuestas uniformes ante fallos (`cuenta-existente.js`, `consultarOrden`).
- Falla cerrado en credenciales de producción de Webpay y en la consulta de Authentication.
- Origen de retorno validado contra lista blanca (`piloto.js:64-77`).

---

## 6. Qué no pude verificar
- **Configuración de producción:** valores de `TRANSBANK_ENV`, `PAGOS_HABILITADOS_SERVIDOR`, `PILOTO_RESTRINGIDO`, `ONECLICK_HABILITADO`, `MODO_RUT_EXISTENTE`, `APP_CHECK_OBLIGATORIO`, `CORREO_TRANSPORTE`. De ellos depende que AUD-06 y AUD-07 estén activos hoy.
- **Lo realmente desplegado:** reglas y funciones publicadas frente al repo (el backlog ya advierte de funciones desplegadas sin fuente, N34, p. ej. `onOrdenEscrita`). No consulté Firebase.
- **Configuración de Authentication:** si el registro por correo/clave está habilitado para clientes finales con la clave pública, protección contra enumeración de correos, dominios autorizados, política de contraseñas.
- **Restricciones de la clave de Google Maps/Firebase** en Google Cloud (AUD-16).
- **Datos:** cuántos `rut_lookup` o `staff` están inconsistentes, cuántas órdenes de integración existen en producción, cuántos informes se acercan a 1 MiB.
- **Dependencias:** no corrí `npm audit` (requiere red y modificaría el árbol de bloqueo). Revisar `jspdf ^4.2.1`, `nodemailer ^10`, `transbank-sdk ^6`, `firebase-functions ^7`, SDK web 10.7.0/10.12.0. Node 22 es adecuado.
- **Comportamiento en navegador:** no se ejecutó nada; todo es análisis estático. No reproduje el XSS (AUD-01) ni el pisado del mapa `titular` (AUD-05); ambos se deducen del código y conviene confirmarlos con pruebas en emuladores (puertos desplazados).
- **Páginas y módulos no revisados a fondo:** `confirmar-oneclick.html`, `suscribirme-*.html`, `dashboard.html`, `pagos.html`, `sesion-timeout.js`, `aviso-cuenta.js`, `cementerios-*.js`, `facturaOcr.js` (más allá de las cargas externas), `gastos-ingresos.html` (OCR y notas de crédito), `correo-confirmacion.js`, `mensajes-pago.js`, `transbank-diagnostico.js`.
- **Pruebas existentes:** no ejecuté `node --test` ni las pruebas de emulador de ninguno de los dos repos.

---

## 7. Orden de corrección sugerido
1. **AUD-01** (escape en todo el backoffice + prueba) y **AUD-04** (cerrar creación de `rut_lookup`): son baratos y cierran lo más grave.
2. **AUD-03** (prueba de acceso en `crearTransaccionWebpay`) y **AUD-02** (roles en claim + reglas), con la directriz correspondiente para el repo de la web.
3. **AUD-05** y **AUD-09** (perfil/titular), con pruebas, porque afectan el texto legal del contrato.
4. **AUD-06/AUD-07** antes de pasar Webpay a producción real o de encender Oneclick.
5. Resto (cabeceras, localStorage, límites, validaciones, limpieza de código muerto).

Los cambios sobre reglas, Functions y `public/` de la web pertenecen al repo de la web (directriz W-x vía el PM); los de `public/` del portal son de este repo. Nada de lo anterior se aplicó en esta auditoría.
