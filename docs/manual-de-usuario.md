# Manual de uso — Portal de Operaciones GraveCare

Versión del 16-11-2026 · Para el personal de GraveCare (operadores, supervisores y administración).
Describe el portal tal como está publicado en `https://gravecare-ops.web.app`. Si algo en pantalla no coincide con este manual, avisa al administrador.

---

## 1. Lo primero

### 1.1 Cómo entrar
1. Abre `https://gravecare-ops.web.app`.
2. Escribe tu **correo corporativo** y tu **contraseña** y pulsa **«Ingresar a Operaciones →»**.
3. Se abre el portal: menú a la izquierda, tu nombre y tu rol arriba a la derecha.

Si aparece **«Acceso denegado: su cuenta no cuenta con permisos de staff activo»**, tu cuenta existe pero aún no fue habilitada. Pide acceso al dueño.
Si aparece **«Credenciales inválidas»**, revisa el correo y la contraseña.

Para salir, pulsa **«Salir»** (arriba a la derecha). Hazlo siempre si usas un computador o teléfono compartido.

### 1.2 Qué ve cada rol
| Rol | Qué ve en el menú |
|---|---|
| **Operador** | Solo **Mis Trabajos**. El portal no le deja abrir otros módulos. |
| **Supervisor** | Todos los módulos del menú. |
| **Administrador** | Todos los módulos, y es el único que puede entrar a **Gestión de Usuarios**. |

El rol se ve en la insignia junto a tu nombre (OPERADOR, SUPERVISOR, ADMINISTRADOR).

### 1.3 El menú
En el computador el menú está siempre a la izquierda. En el teléfono, pulsa el botón de las tres rayas (☰) para abrirlo; se cierra solo al elegir un módulo. El módulo activo aparece resaltado y su nombre se repite en la barra superior.

### 1.4 Conceptos que se repiten en todo el portal
- **Orden:** la compra de un cliente (un plan o un Spot). Tiene un número, por ejemplo `ORD-…`.
- **Visita:** cada vez que un operador va al cementerio. Un **Plan 12** tiene 12 visitas (una al mes), un **Plan 6** tiene 6 (cada 2 meses), un **Plan 4** tiene 4 (cada 3 meses) y un **Spot** tiene 1 sola.
- **Fecha de la visita:**
  - **Fecha real:** la que se programó (en Planificación u Órdenes) o, en un **Spot**, la que el cliente eligió al contratar.
  - **Fecha tentativa:** solo en los planes; es una proyección según la fecha de inicio y la frecuencia del plan. No está guardada: se calcula en pantalla y se reemplaza cuando alguien programa la fecha real.
  - **Sin fecha:** la visita no tiene fecha. No se inventa ninguna.
- **Solo se muestran órdenes pagadas.** Una orden que el cliente no terminó de pagar no aparece en ningún módulo.
- **Insignia «PRUEBA»:** marca las órdenes de prueba (integración). No son servicios reales.

### 1.5 El camino de una visita (de principio a fin)
```
Orden pagada ──► Se programa la fecha ──► Se asigna un operador ──► Operador hace la visita en terreno
     (cliente)     (Planificación / Órdenes)    (Órdenes / Planificación)        y envía el informe (Mis Trabajos)
                                                                                         │
                         Visita completada ◄── Supervisor aprueba ◄── «Pendiente Revisión» ◄┘
                         (queda en Terminadas)       └─ si rechaza, vuelve al operador con el motivo
```
Una visita solo cuenta como **terminada** cuando tiene operador, informe aprobado y estado completado.

---

## 2. Mis Trabajos
**Para qué sirve:** es la pantalla del operador. Muestra solo **sus** visitas asignadas, pendientes de hacer, y desde aquí se envía el informe de cada visita.
**Quién lo ve:** todos los roles.

### Qué hay en pantalla
- **Sepulturas Programadas:** mapa con la ubicación de tus trabajos. El marcador **rojo** son las coordenadas exactas de la sepultura; el **naranjo** es una ubicación aproximada (el cementerio). Si una visita no tiene ubicación, un aviso bajo el mapa lo indica.
- **Listado de Asignaciones Pendientes:** una fila por visita, con:
  - **N° Orden / Visita** y una etiqueta con el avance, por ejemplo `3/12`.
  - **Difunto / Sepultura**, **Cementerio** y **Servicio** (el plan).
  - **Fecha Programada** (dd-mm-aaaa). Dice «Por coordinar» si aún no hay fecha.
  - **Estado:** botón verde («Asignado» u otro estado de la visita) o rojo («Rechazada»).
  - **Acciones:** **Reportar** (o **Corregir informe** si fue rechazado).
- **Buscador:** escribe parte del nombre del difunto, del cliente, del cementerio o del número de visita para filtrar.

### Cómo usarlo
1. Revisa tu lista. Una visita aparece aquí solo cuando tiene **fecha programada y está asignada a ti**.
2. Pulsa el **estado** de una fila para leer las **observaciones o indicaciones del cliente** (por ejemplo, qué flores prefiere). Cierra con **«Entendido»**.
3. Cuando estés en el cementerio, pulsa **Reportar**. Se abre la captura del informe (ver sección 3).
4. Si una visita aparece en **rojo («Rechazada»)**, pulsa el estado para leer el **motivo del rechazo**, y luego **Corregir informe** para arreglarlo y volver a enviarlo.

Cuando un informe se envía, la visita sale de tu lista y queda «Pendiente Revisión» hasta que un supervisor la apruebe.

---

## 3. Captura del informe en terreno (pantalla de «Reportar»)
**Para qué sirve:** registrar lo que se hizo en la sepultura, con fotos georreferenciadas. Se abre desde **Reportar** o **Corregir informe** en Mis Trabajos.

### Pasos
1. Revisa arriba los datos de la visita: **cliente/titular, ser querido y ubicación de la sepultura**.
2. **Geolocalización:** el teléfono pide permiso de ubicación. Acepta. Si el GPS tarda o falla, pulsa **«Actualizar GPS»**. **«Google Maps»** abre el punto en el mapa para comprobarlo.
3. Marca las **Labores Ejecutadas** (limpieza profunda de lápida y placa, retiro de maleza y hojas secas, ornamentación con flores frescas, riego y perfilado de terreno, limpieza y pulido de piezas de bronce).
4. Escribe, si corresponde, **observaciones del especialista** (algo que el cliente deba saber).
5. Carga las **4 fotografías obligatorias**, con **«Tomar / Subir Foto»**:
   1. **Estado inicial** (antes de trabajar)
   2. **Finalizado**
   3. **Ornamentación**
   4. **Vista panorámica**
   Cada foto se marca como lista y el contador avanza («0 de 4 listas»). El ícono del basurero permite cambiar una foto.
6. Pulsa **«Terminar Informe y Enviar a Auditoría»**.

> Sin las 4 fotografías no se puede emitir el informe: la pantalla avisa «debe cargar las 4 fotografías obligatorias».

Al enviar aparece **«Informe de Visita … enviado a revisión exitosamente»** y la visita pasa a **Pendiente Revisión**.

**Si el informe fue rechazado**, arriba aparece **«Este informe fue rechazado por supervisión. Corrígelo y vuelve a enviarlo»**. Corrige lo que indica el motivo (fotos, limpieza, etc.) y envía de nuevo.

**Consejos de terreno:** toma las fotos con buena luz y desde el sitio exacto; no uses fotos antiguas, el informe lleva ubicación y fecha y el supervisor las compara con el registro.

---

## 4. Todos los Trabajos
**Para qué sirve:** ver **todas** las visitas pendientes de todos los operadores, en un solo listado, y marcar una como completada.
**Quién lo ve:** supervisor y administrador.

### Qué hay en pantalla
- Título «Todos los Trabajos Activos (Por Visitas)» y un contador «Mostrando N visita(s) pendiente(s)».
- **Buscador** y filtro **Todos los Cementerios**.
- Botón **«Ver Órdenes Terminadas»** (lleva al módulo de terminadas).
- Columnas: **N° Orden / Visita** (con «Visita 3 de 12»), **Cliente / Titular**, **Ser Querido (Difunto)**, **Cementerio y Ubicación**, **Plan Contratado**, **Fecha Programada**, **Estado** (con aviso si está atrasada) y **Acciones**.

### Cómo usarlo
1. Filtra por cementerio o busca por cliente, difunto o número de orden.
2. Para cerrar una visita, pulsa **«Completar Visita»** y confirma.
3. El portal solo deja completar una visita que **ya tiene operador asignado y su informe registrado**. Si falta algo, muestra el motivo («Asigna un operador y registra su informe primero»).
4. Al completar la última visita de un plan aparece «Plan concluido en su totalidad» y la orden pasa a *Terminadas*.

> Completar una visita escribe solo esa visita: completar la 2 no marca la 1.

---

## 5. Órdenes de Servicios Terminadas
**Para qué sirve:** archivo de las visitas ya ejecutadas y verificadas, con su informe.
**Quién lo ve:** supervisor y administrador.

### Cómo usarlo
1. Usa el **buscador** (cliente, difunto, N° de orden u operador) y el filtro de **cementerio**.
2. El contador indica «Mostrando N servicio(s) terminado(s)».
3. Cada fila muestra orden y visita, cliente, ser querido, cementerio, plan, **fecha ejecutada**, estado, **operador** e **informe**.
4. Pulsa **«Ver Informe»** para abrir el **Informe de Servicio Realizado**: datos del servicio, **coordenadas GPS**, observaciones del operador, fecha de ejecución, estado «APROBADO» y las **4 fotografías** (estado inicial, finalizado, ornamentación, vista panorámica). Si una foto no existe aparece «Sin fotografía registrada». Cierra con **«Cerrar Informe»**.
5. **«Volver a Trabajos Activos»** regresa al listado de pendientes.

Este módulo es solo de consulta: no se edita nada aquí.

---

## 6. Planificación & Gantt
**Para qué sirve:** ver en el tiempo las visitas de todos los clientes, **programar o cambiar fechas** y asignar operadores. Tiene dos vistas.
**Quién lo ve:** supervisor y administrador.

### 6.1 Filtros y navegación (arriba)
- **Cementerio**, **Operador** y **Control**:
  - **Atrasadas** (más de 3 días)
  - **Sin operador**
  - **Próximas a vencer** (7 días)
  - **Sin fecha (históricas)**
- **Escala:** Día, Semana, Mes o Año.
- Botones **Anterior**, **Hoy** y **Siguiente** para moverte en el tiempo; el rótulo central muestra el rango visible.

### 6.2 Vista «Carta Gantt»
Cada cliente es una fila. En la primera columna ves **cliente, sepultura y operador**, la **fecha de la visita** («Fecha: dd-mm-aaaa») y un botón **«Cambiar fecha»** (o **«Asignar fecha»** si no tiene).

En el cronograma, cada visita es una tarjeta de color:
| Color | Significado |
|---|---|
| Verde — **Realizada** | La visita ya se hizo. |
| Amarillo — **Por Realizar** | Visita programada pendiente. |
| Amarillo — **Tentativa** | Fecha proyectada por el plan; aún no hay fecha real. |
| Violeta — **Asignado** | Tiene operador asignado. |
| Celeste — **En ejecución** | El operador está en ello. |
| Naranjo — **Reprogramada** | Se cambió la fecha de una visita ya asignada. |
| Azul — **Pendiente Revisión** | El operador envió el informe; espera al supervisor. |
| Rojo — **Rechazada** | El informe fue rechazado y vuelve al operador. |

**Cómo cambiar la fecha de una visita** (tres formas):
1. **Botón «Cambiar fecha»** en la columna del cliente: abre el modal «Detalles de Programación».
2. **Doble clic** en la tarjeta amarilla: abre el mismo modal.
3. **Un clic** en la tarjeta (queda seleccionada, aparece la barra verde «Haz clic en el casillero de la nueva fecha») y luego un clic en el día nuevo. **«Cancelar»** deja todo como estaba.

En el modal «Detalles de Programación» ves el cliente, eliges la **fecha** y el **operador para esa visita** y pulsas **Guardar**. Cambiar la fecha de una visita no mueve las demás.

### 6.3 Vista «Tabla de Clientes»
Una fila por cliente con: **Plan / Visita**, **Operador Asignado (individual)**, **Contratación**, **Término**, **Monto Pagado**, **Realizadas**, **Pendientes**, **Última Visita**, **Próxima Visita** y **Cementerio**. El operador se cambia directamente desde la lista desplegable de cada fila.

### Consejos
- Una visita **sin fecha no puede asignarse** a un operador y por lo tanto no aparece en su Mis Trabajos. Programa primero la fecha.
- En un **Spot**, la fecha que eligió el cliente ya viene cargada: solo la cambias si hay que reprogramar.

---

## 7. Órdenes de Servicio (Asignación de Órdenes)
**Para qué sirve:** repartir cada visita pendiente entre los operadores, fijar su fecha y estado.
**Quién lo ve:** supervisor y administrador.

### Qué hay en pantalla
- **Filtros:** zona o eje (Santiago Norte, Poniente, Sur, Rancagua–Machalí), cementerio, estado (Pendiente / Asignado) y **control** (atrasadas, sin operador, próximas a vencer, sin fecha).
- **Listado:** ID de orden y visita, difunto, cliente, sepultura, plan, **fecha estimada** (en gris si es tentativa), estado y **operador asignado**.
- Botón **Asignar** en cada fila.

### Cómo asignar un operador
1. Pulsa **Asignar** en la visita.
2. En la ventana «Asignar Operador» elige:
   - **Operador** (o «Sin asignar» para quitarlo),
   - **Fecha de ejecución** (obligatoria para asignar),
   - **Estado de la visita:** Pendiente, Asignado, En ejecución, Completada o Reprogramada.
3. Pulsa **Confirmar**.

Reglas que aplica el portal:
- Si la visita **no tiene fecha**, avisa **«Programa primero la fecha de esta visita antes de asignarle un operador»**.
- Cambiar la fecha de una visita ya asignada o en ejecución la deja automáticamente en **Reprogramada**.
- Solo se permiten transiciones de estado válidas (por ejemplo no se puede volver de Completada a Pendiente); si no, muestra el error.
- Una visita **terminada** (con informe aprobado) deja de aparecer aquí.

---

## 8. Mapa de Operaciones
**Para qué sirve:** ver en un mapa **dónde están los trabajos pendientes**.
**Quién lo ve:** supervisor y administrador.

### Qué hay en pantalla
- Cuatro contadores: **Informes / Visitas pendientes**, **Órdenes con trabajos activos**, **Cementerios con trabajos** y **Geolocalizadas en mapa**.
- **Mapa Operativo de Trabajos No Realizados:** un marcador por ubicación. Si varias visitas están en el mismo punto, se agrupan.
- **Detalle de Informes y Visitas Pendientes:** listado con difunto/sepultura, visita/informe, cementerio, cliente, operador asignado, **coordenadas GPS** y estado, con buscador.

### Cómo usarlo
Úsalo para planificar rutas: agrupa visitas del mismo cementerio y confirma qué trabajos no tienen coordenadas. Una visita sin coordenadas aparece en el listado pero no en el mapa.

---

## 9. Revisión de Informes
**Para qué sirve:** que el supervisor valide cada informe antes de certificarlo al cliente.
**Quién lo ve:** supervisor y administrador.

### Qué hay en pantalla
Un **panel de supervisión** con tres pestañas y su contador: **Pendientes**, **Aprobados** y **Rechazados**. Cada informe es una tarjeta con la visita, fecha de captura y estado. En los rechazados, un desplegable **«Motivo del Rechazo»**.

### Cómo revisar
1. En **Pendientes**, abre un informe. Verás:
   - **Información del servicio:** titular, difunto, cementerio, ubicación, operador y fecha de ejecución.
   - **Geolocalización (GPS)** con acceso a **Google Maps**.
   - Las **4 evidencias fotográficas**.
   - **Labores ejecutadas** y **observaciones técnicas** del operador.
2. Decide:
   - **«Aprobar y Certificar»** → confirma y el informe queda **Aprobado & Certificado**; la visita pasa a completada.
   - **«Rechazar Informe»** → elige el **motivo** de la lista:
     - Fotografías incompletas, borrosas o que no corresponden al sitio
     - Falta evidencia de ornamentación o flores frescas
     - Limpieza insuficiente en lápida o maleza pendiente
     - Ubicación/GPS discordante con el registro
     - Discrepancia con los requerimientos del cliente
     - Otro motivo técnico (especifícalo)
     
     Agrega, si quieres, **instrucciones para el operador** y pulsa **«Enviar Rechazo»**. El informe vuelve al operador (aparece en rojo en su Mis Trabajos con el motivo).

**Buena práctica:** escribe un motivo claro y accionable; es lo único que verá el operador para corregir.

---

## 10. Gastos e Ingresos (Control Contable y Tributario)
**Para qué sirve:** llevar el libro contable, el IVA mensual (Formulario 29) y los respaldos tributarios.
**Quién lo ve:** supervisor y administrador (en la práctica, finanzas es del administrador).

### 10.1 Resumen y período
- Elige **mes y año** en «Período Tributario».
- Tarjetas: **Ingresos Netos**, **Gastos Deducibles (Neto)**, **Balance IVA Acumulado**, **Resultado Operacional** e **IVA del mes (F29)** («A Pagar» o remanente), con el detalle débito/crédito.
- Gráfico de **evolución de ingresos y gastos** (netos) y tabla de **Liquidación Mensual de IVA** (Mes, Débito, Crédito, F29).

### 10.2 De dónde vienen los movimientos
Columna **Origen**:
- **Webpay:** los **ingresos** de las órdenes pagadas se cargan solos (neto = bruto ÷ 1,19, con su IVA débito). Solo cuentan órdenes con pago **Confirmado**; las de prueba y los pagos de Oneclick solo inscritos (sin cobro) no se contabilizan.
- **Manual:** lo que registras tú (gastos, ingresos manuales, notas de crédito).

### 10.3 Registrar un comprobante o movimiento
1. (Opcional) **Subir Factura (XML / PDF)** para precargar datos.
2. Completa el formulario:
   - **Flujo contable:** Gasto/Egreso o Ingreso/Venta.
   - **Documento tributario (DTE):** factura afecta (IVA 19%), factura exenta, boleta de honorarios (retención 15,25%), boleta electrónica de venta, nota de crédito electrónica o comprobante/voucher.
   - **N° folio, RUT y razón social de la contraparte, fecha de emisión.**
   - **Categoría operacional** (Flores y Plantas, Insumos de Limpieza, Herramientas, Combustible y Traslado, Servicios Básicos, Honorarios Terreno, Venta de Planes, Servicios Spot, Otros Gastos).
   - **Clasificación tributaria (F22):** gasto aceptado/deducible, inversión/activo fijo o gasto rechazado.
   - **Monto neto**; el IVA (19%) y el total bruto se calculan solos.
3. Pulsa **«Registrar Movimiento en el Libro Contable»**.

### 10.4 Notas de crédito
Sirven para compensar una **boleta electrónica de venta** (por ejemplo al devolver dinero).
- Desde la fila de la boleta, pulsa **«Registrar nota de crédito»**, o elige «Nota de Crédito Electrónica» en el formulario y la **boleta de referencia**.
- Datos: folio de la nota, fecha, monto, **código de referencia** (**1** anula el documento, **3** corrige montos), **medio de devolución** (Reversa Transbank o Transferencia bancaria) y **motivo** (obligatorio). Opcionales: folio SII de la boleta, visitas contratadas/ejecutadas, término del servicio.
- El portal **no deja guardar** si: falta la boleta o no es una boleta de venta; el folio está repetido; la fecha es anterior a la de la boleta; el monto no es un entero mayor que cero; o **la suma de las notas supera el monto de la boleta** (indica cuánto queda por compensar).
- **Avisos (se puede guardar igual):** si pasaron más de 6 meses entre la boleta y la nota, o más de 30 días desde el término del servicio, el IVA podría no ser recuperable: consúltalo con tu contador.
- Una nota **no se edita**: si hay un error se compensa con otra nota. La nota se registra como importe **negativo** del mes de su fecha.

### 10.5 Tabla de movimientos y filtros
- Filtra por **tipo de flujo**, **categoría** y rango **Desde / Hasta**; **«Limpiar Filtros»** los borra.
- Cada fila muestra fecha, DTE/folio, contraparte y RUT, categoría, neto, IVA o retención, total, origen y respaldo.
- Acciones por fila:
  - **«+ Cargar Factura/Boleta»** o **«Cambiar DTE»:** adjunta el documento (XML o PDF) como respaldo.
  - **«Registrar nota de crédito»:** solo en boletas con saldo por compensar.
  - **«Eliminar»:** solo para movimientos de origen **Manual**, y con confirmación. **No se puede eliminar una boleta que tiene notas de crédito.** Los movimientos Webpay no se eliminan.

> Nunca subas ni compartas documentos fuera del portal. Los folios y RUT que ves aquí son datos reales de clientes.

---

## 11. Clientes
**Para qué sirve:** directorio de clientes, sus planes y el avance de cada servicio.
**Quién lo ve:** supervisor y administrador.

### Cómo se ve
Un cliente = una fila (agrupados por **RUT**). Columnas: **Cliente/Titular, Nombre del ser querido, RUT, Contacto, Ubicación/Cementerio, Plan, Suscripción, Ramos adicionales, Estado del servicio, Fecha de registro y Acciones**.
- Si el cliente tiene **varios servicios**, la fila dice «N servicios» y el botón **«Ver servicios»** despliega una línea por servicio (y **«Ocultar servicios»** lo pliega). También se despliega con un clic en la fila.
- **Estado del servicio:** `V3/12` (va en la visita 3 de 12, en amarillo) o `Completado (12/12)` (en verde).
- **Buscador:** cliente, difunto, RUT o correo. Filtro por **cementerio**. El botón **↻** actualiza la lista.

### Importante
- El botón **«Borrar»** está **deshabilitado por seguridad**: muestra «El borrado de clientes está deshabilitado… Si necesitas eliminarlo, solicítalo al administrador». No se elimina ningún dato.
- Los datos personales (RUT, correo, teléfono) son confidenciales: no los copies ni los envíes por chat.

---

## 12. Gestión de Usuarios
**Para qué sirve:** definir quién del equipo usa el portal y con qué nivel de acceso.
**Quién lo ve:** **solo administrador**. Si otro rol entra, aparece «Acceso restringido».

### Roles
- **Operador:** solo terreno e informes (solo ve Mis Trabajos).
- **Supervisor:** control de calidad y aprobación.
- **Administrador:** acceso total y finanzas.

### Alta de un colaborador (paso a paso)
1. **Primero, en Firebase Authentication:** crea la cuenta del colaborador (correo y contraseña) y copia su **UID**. *Este paso lo hace el administrador técnico, desde la consola de Firebase.*
2. En **«Registrar Miembro Staff»** completa **Nombre y Apellido, Correo Electrónico, UID de Firebase Auth** y **Rol**.
3. Pulsa **«Guardar Miembro»**. Aparece «Colaborador registrado correctamente».
4. **Para que pueda entrar**, la cuenta además debe estar habilitada con permiso de staff activo (lo que el login pide). Si al ingresar ve «Acceso denegado», pide al dueño que active ese permiso.

### Cambiar rol o dar de baja
- En la tabla de **Colaboradores** (nombre, rol, estado, acción) puedes **cambiar el rol** de otra persona y **activar o desactivar** su acceso (pide confirmación).
- **No puedes cambiar tu propio rol ni desactivar tu propia cuenta de administrador** (protección contra quedarse sin acceso).

---

## 13. Preguntas frecuentes
**«No veo mis visitas en Mis Trabajos».** Una visita aparece solo si tiene **fecha programada**, está **asignada a ti** y no está terminada. Pide a un supervisor que revise fecha y operador en Órdenes de Servicio o Planificación.

**«Una visita dice “Sin fecha”».** No tiene fecha guardada. En planes, ponla con **Asignar fecha** (Planificación) o en **Asignar** (Órdenes). En un Spot debería venir la fecha que eligió el cliente; si no, es una orden antigua: asígnala a mano.

**«No puedo enviar el informe».** Faltan fotos: las 4 son obligatorias. Revisa también que el navegador tenga permiso de cámara y ubicación.

**«El informe volvió en rojo».** Fue rechazado: pulsa el estado para ver el motivo y luego **Corregir informe**.

**«No puedo completar una visita desde Todos los Trabajos».** Debe tener operador asignado y informe registrado.

**«No aparece una orden nueva».** Solo se muestran órdenes **pagadas**. Verifica que el pago esté confirmado.

**«Cambié algo y no lo veo».** Recarga la página con **Ctrl + F5** (en el teléfono, cierra y abre el portal). Después de una actualización del portal, el navegador puede mostrar la versión anterior hasta una hora.

**«Me aparece “Acceso denegado”».** Tu cuenta aún no tiene el permiso de staff activo. Pide acceso al dueño.

---

## 14. Resumen de módulos por rol
| Módulo | Operador | Supervisor | Administrador |
|---|:-:|:-:|:-:|
| Mis Trabajos (y captura de informe) | ✔ | ✔ | ✔ |
| Todos los Trabajos | — | ✔ | ✔ |
| Órdenes de Servicios Terminadas | — | ✔ | ✔ |
| Planificación & Gantt | — | ✔ | ✔ |
| Órdenes de Servicio (asignación) | — | ✔ | ✔ |
| Mapa de Operaciones | — | ✔ | ✔ |
| Revisión de Informes | — | ✔ | ✔ |
| Gastos e Ingresos | — | ✔ | ✔ |
| Clientes | — | ✔ | ✔ |
| Gestión de Usuarios | — | — | ✔ |

> Nota: hoy el portal restringe la vista según el rol solo en el menú y en Gestión de Usuarios. La seguridad real de los datos la dan las reglas de Firestore y el permiso de staff activo, que se administran desde el proyecto de la web.
