# INSTRUCCIONES — Nueva pestaña «Planificación» con subpestañas «Planes» y «Spot»

> **Para:** la IA que desarrolla las nuevas páginas del backoffice de GraveCare.
> **Repo:** `gravecare-operaciones` (backoffice). Este repo **no** es el de la web (`gravecare`): no lo modifiques.
> **Estado:** borrador para aprobación del dueño (Christian Olivares). No desplegar.
> **Idioma:** todo en español (código comentado, textos de la pantalla, commits, reporte).

---

## 1. Qué hay que construir

Una pestaña nueva en el menú lateral del backoffice, **«Planificación Planes y Spot»**, que abre una página con dos subpestañas:

- **Planes:** visitas de los servicios con plan (Plan 4, Plan 6, Plan 12). Una fila por visita.
- **Spot:** servicios Spot (1 visita). Una fila por servicio, con la fecha que eligió el cliente.

Es una **pantalla nueva e independiente**. No reemplaza ni modifica la pantalla existente «Planificación & Gantt» (`public/planificacion.html`).

**Decisiones tomadas (si el dueño dice otra cosa, se cambian solo los nombres):**
| Elemento | Valor |
|---|---|
| Página nueva | `public/planificacion-servicios.html` |
| Botón del menú | `id="btn-planificacion-servicios"`, clase `admin-only`, `onclick="cargarModulo('planificacion-servicios')"` |
| Título en el menú | «Planificación Planes y Spot» |
| Icono | `fa-solid fa-calendar-check` |
| Lógica pura (testeable) | `public/js/planificacion-servicios.js` |
| Rama de trabajo | `feat/planificacion-planes-spot` (desde `main`) |

**Modo:** solo lectura. Esta entrega **no escribe** nada en Firestore.

---

## 2. Reglas de oro (no negociables)

1. **Sin cambios de diseño en lo existente.** No tocar `public/planificacion.html`, `public/ordenes.html`, `public/js/*` existentes (salvo lo indicado en §3). Los textos nuevos van en español claro y usan los componentes de alerta que ya existen.
2. **No borrar nada.** Lo que se retire va a `legacy/` y se reporta.
3. **Contrato de datos con la web.** No renombrar ni eliminar colecciones, campos, rutas de Storage ni claims. Solo se **leen** los campos de §4.
4. **Prohibido escribir `fechasProgramadas`** (arreglo antiguo con fechas de relleno). Cualquier escritura de fechas, si algún día se pide, usa `construirActualizacionFecha` de `public/js/fechas-visita.js`, que lo bloquea.
5. **Las reglas de Firestore y Storage no se publican desde este repo.** `firebase.json` solo tiene `hosting`.
6. **Sin secretos** en el código ni en el reporte (claves, tokens, `.env`, correos, RUT). La configuración de Firebase sale de `public/js/entorno.js`.
7. **Órdenes pagadas:** toda página que liste órdenes filtra con `esOrdenPagada` de `public/js/orden-pagada.js` **antes** de listar o contar.
8. **Git:** `git add <archivo>` por nombre, nunca `git add -A` ni `git add .`. Revisar `git diff --cached --name-only` antes de cada commit. Push solo de la rama de trabajo; nunca a `main`; nunca `--force`.
9. **Despliegue:** lo ejecuta solo el dueño. Tú preparas el reporte con el procedimiento.

---

## 3. Integración con el portal (cambio mínimo en `public/portal.html`)

El portal carga cada módulo en un `<iframe id="moduloFrame">` con `cargarModulo(nombre)`, que abre `nombre.html`. Para registrar la pestaña hay que tocar **solo tres lugares** de `public/portal.html`:

1. **Botón del menú**, dentro de la lista `<ul>` del menú, junto a los demás (por ejemplo, después de «Planificación & Gantt»):
   ```html
   <li class="admin-only" style="display: none;">
     <button class="nav-btn" id="btn-planificacion-servicios" onclick="cargarModulo('planificacion-servicios')">
       <i class="fa-solid fa-calendar-check"></i> Planificación Planes y Spot
     </button>
   </li>
   ```
2. **Título del módulo** en el objeto `titulosModulos`:
   ```js
   "planificacion-servicios": { title: "Planificación Planes y Spot", icon: "fa-solid fa-calendar-check" },
   ```
3. Nada más en `portal.html`. No cambiar el resto del menú ni la lógica de roles (`cargarModulo` ya fuerza a los operadores a «Mis Trabajos»).

---

## 4. Datos que se leen (solo lectura)

| Colección | Uso |
|---|---|
| `ordenes` | Una lectura completa, filtrada con `esOrdenPagada`. |
| `contratos` | Respaldo del nombre del cliente (`cargarContratos`, `contratosDeOrden`). |
| `informes` | Evidencia de visitas terminadas (`crearIndiceInformes`). |
| `staff` | Lista de operadores para el filtro (igual que `planificacion.html`). |

**Campos de la orden:**

| Dato | Campo(s) | Nota |
|---|---|---|
| Pagada | `pagoConfirmado`, `estado` | Solo con `esOrdenPagada(orden)`. |
| Tipo de servicio | `tipoServicio` (`'SPOT'` / `'PLAN'`), y si falta, el nombre del plan | Ver regla en §5. |
| Nombre del plan | `servicio.planNombre` o `planNombre` o `plan` | Puede faltar. |
| Fecha del cliente (Spot) | `fechaProgramada` (AAAA-MM-DD) o `fechaServicio` (DD/MM/AAAA) | Usar `fechaSpotDelCliente(orden)`. |
| Fecha real por visita | `fechasPorVisita.V<n>` | Usar `fechaGuardadaVisita(orden, 'V<n>')`. |
| Fecha de la visita (con respaldo) | — | Usar `fechaVisitaConOrigen(orden, n)` de `fechas-tentativas.js`. Devuelve la real si existe, si no la tentativa del plan, si no `null`. |
| Visitas terminadas | `estadosPorVisita`, `programacionVisitas`, `operadoresPorVisita`, informes | Usar `numerosTerminados(orden, {docId, indiceInformes})` y `estadoUnificadoVisita(orden, n, {terminada})`. |
| Operador por visita | `operadoresPorVisita.V<n>` | Si falta: «Sin asignar». |
| Cliente | ver `nombreClienteParaMostrar(orden, contratosDeOrden(mapa, orden, id))` | No leer `usuarios/{uid}` (las reglas no lo permiten al staff). |
| Ser Querido (difunto) | `difunto.nombreCompleto` / `difunto.nombre` / `nombreCompletoDifunto` / `difuntoNombre` | Si falta: «Sin registrar». |
| Cementerio | `ubicacionSepultura.cementerio` o `cementerio` | Si falta: «—». |
| N° de orden | `numeroOrden` o `nOrden` o id del documento | |

---

## 5. Clasificación Planes / Spot

Usar **una sola función** (en `public/js/planificacion-servicios.js`) para clasificar, con este orden:

```js
export function esSpot(orden) {
  const tipo = String(orden?.tipoServicio || '').trim().toUpperCase();
  const plan = String(orden?.servicio?.planNombre || orden?.planNombre || orden?.plan || '').toLowerCase();
  return tipo === 'SPOT' || plan.includes('spot');
}
```

- Si `esSpot` es `true` → pestaña **Spot**.
- Si no → pestaña **Planes**.
- **No** usar el valor por defecto «Plan 4» cuando falta el plan (`planificacion.html` lo hace; aquí no). Una orden pagada sin plan ni tipo aparece en **Planes** con el plan «Sin plan registrado».
- Número de visitas: usar `totalVisitasPlan(plan)` de `fechas-tentativas.js` (Spot 1, Plan 12 → 12, Plan 6 → 6, Plan 4 → 4).

> **Nota:** `ordenes.html` clasifica Spot por `tipoServicio` primero y por nombre después, y `planificacion.html` solo por nombre. La regla de §5 sigue a `ordenes.html`. Si se cambia algo, se cambia en un solo lugar.

---

## 6. Vistas

### 6.1 Subpestañas
- Dos botones tipo pestaña, con el mismo estilo que el selector «Gantt / Tabla de Clientes» de `planificacion.html` (activo: `bg-[#002d1a] text-white`).
- Por defecto se abre **Planes**. Un contador junto a cada pestaña muestra cuántas filas tiene.

### 6.2 Pestaña «Planes»
Una fila **por visita pendiente o programada** (igual que el Gantt, una fila por visita).

Columnas: **Fecha de la visita** · **N° orden** · **Cliente** · **Ser Querido** · **Plan** · **Visita (n de N)** · **Cementerio** · **Operador** · **Estado**.

- La fecha sale de `fechaVisitaConOrigen`. Si es tentativa, mostrar una insignia «Tentativa» (usar el componente que ya usa `ordenes.html` para fechas tentativas, si existe; si no, texto en gris).
- Sin fecha: «Sin fecha programada». **Nunca** inventar fechas ni usar la primera fecha para las demás.
- Orden por defecto: fecha ascendente; las sin fecha al final.
- Filtros: búsqueda libre (cliente, Ser Querido, N° orden), cementerio, operador y estado. Mismo estilo de selects que `planificacion.html`.
- Se muestran las visitas terminadas también (con su estado), igual que en el Gantt.

### 6.3 Pestaña «Spot»
Una fila **por servicio**.

Columnas: **Fecha elegida por el cliente** · **N° orden** · **Cliente** · **Ser Querido** · **Cementerio** · **Operador** · **Estado**.

- La fecha sale de `fechaGuardadaVisita(orden, 'V1')`, que cae en `fechaSpotDelCliente` si no hay `fechasPorVisita.V1`.
- Sin fecha del cliente: «Sin fecha del cliente». No se inventa.
- Orden por defecto: fecha ascendente.
- Filtros: búsqueda libre y cementerio.
- **No** mover la fecha del Spot al día de un eje (ver §10, pregunta 2).

### 6.4 Estados vacíos y errores
- Sin filas: «No hay visitas para mostrar con los filtros actuales.» (texto nuevo, mismo estilo que los existentes).
- Si la carga falla: aviso con botón «Reintentar», igual que `mostrarErrorCarga()` de `planificacion.html`.

---

## 7. Seguridad y escape (AUD-01)

- **Todo** dato de Firestore que se escriba en `innerHTML` pasa por `esc()` de `public/js/html-seguro.js`.
- En botones, no meter datos en `onclick="..."`. Usar `data-*` y leer con `this.dataset`.
- Autenticación: el módulo se abre dentro del portal, pero la página debe cumplir igual la barrera B-13:
  ```js
  import { exigirStaff } from "./js/acceso-staff.js";
  // dentro de onAuthStateChanged(auth, async (user) => { ... })
  if (!(await exigirStaff(auth, user))) return;
  // después, cargar datos
  ```
- Configuración de Firebase: `import { FIREBASE_CONFIG } from "./js/entorno.js";` (nunca claves escritas en el HTML).

---

## 8. Pruebas (obligatorias)

Ejecutar desde la raíz del repo:
```powershell
node --test tests/ public/js/
```

Escribir:

1. **`public/js/planificacion-servicios.test.mjs`** (pruebas unitarias de la lógica pura):
   - `esSpot`: `tipoServicio: 'SPOT'` → Spot; `planNombre: 'Servicio Spot'` → Spot; `Plan 12` → Planes; sin datos → Planes.
   - Plan 12 con inicio conocido → 12 visitas; Plan 4 → 4 visitas con `inicio + 3·n` meses (vía `fechaTentativaVisita`).
   - Spot con `fechaProgramada: '2026-12-05'` → fecha 5 de diciembre, sin desfase de zona horaria.
   - Sin fecha de inicio → sin fechas tentativas (no se usa fecha por defecto).
2. **`tests/planificacion-servicios-paginas.test.mjs`** (estática, sobre el HTML):
   - Importa `exigirStaff` y lo llama dentro de `onAuthStateChanged` antes de cargar datos.
   - Importa `esOrdenPagada` y filtra antes de cualquier `.push(` o de contar.
   - Usa `esc(` en cada interpolación de Firestore dentro de template strings.
   - No contiene `fechasProgramadas` escrito en ningún `updateDoc`/`setDoc`.
   - No contiene el texto `Plan 4` como valor por defecto.
   - No contiene `Tulio Santana` ni otros datos de relleno.
   - No contiene claves ni tokens literales.
   - `portal.html` contiene `btn-planificacion-servicios` y `cargarModulo('planificacion-servicios')`.
3. **Agregar la página a las listas existentes:**
   - `tests/acceso-staff-paginas.test.mjs` → añadir `'planificacion-servicios.html'` en `PAGINAS`.
   - `tests/n80-paginas.test.mjs` → añadir `'planificacion-servicios.html'` en `LISTAS`, y que la página tenga **una sola** lectura de `ordenes`.

---

## 9. Criterios de aceptación

Con datos de prueba (emulador de la web con puertos desplazados, **nunca producción**):

- [ ] Una orden Spot pagada con `tipoServicio: 'SPOT'` y `fechaProgramada: '2026-12-05'` aparece **solo** en Spot, con fecha 05/12/2026.
- [ ] Una orden Plan 12 pagada aparece en Planes con **12 filas**, una por visita, con fecha tentativa mensual desde su inicio.
- [ ] Una orden Plan 4 pagada aparece con 4 filas, fechas `inicio + 3·n` meses.
- [ ] Una orden `iniciada`, `cancelado`, `rechazado` o `vencida` no aparece en ninguna pestaña.
- [ ] Un Spot sin fecha muestra «Sin fecha del cliente». Una visita sin fecha muestra «Sin fecha programada». Nada se inventa.
- [ ] Una orden con `fechasPorVisita.V2` real muestra esa fecha (no la tentativa), sin insignia «Tentativa».
- [ ] Un valor con `<script>` en el nombre del cliente se muestra como texto.
- [ ] El menú muestra la pestaña solo a administradores; un operador no la ve y `cargarModulo` lo redirige a «Mis Trabajos».
- [ ] `public/planificacion.html`, `public/ordenes.html` y el resto de páginas existentes **no cambian** (revisar con `git diff --stat`).
- [ ] `node --test tests/ public/js/` en verde.

---

## 10. Preguntas abiertas para el dueño

Antes de empezar, la IA debe confirmar estas tres (si no hay respuesta, se usa la opción por defecto indicada):

1. **Nombre y lugar de la pestaña.** Por defecto: «Planificación Planes y Spot» como página nueva en el menú. Alternativa: dos pestañas separadas en el menú.
2. **Fecha del Spot y los ejes.** La especificación v5.1 dice que la visita Spot usa la fecha del cliente como ancla, y en un ejemplo la movía al día del eje. **Por defecto:** la fecha del Spot se muestra tal como la eligió el cliente, sin mover al eje.
3. **Vista de Planes.** Por defecto: lista por visita (una fila por visita, como §6.2). Alternativa: una fila por plan con sus visitas en columnas.

**No implementar en esta entrega** las reglas nuevas de la especificación v5.1 (fórmula +30 días con tolerancia ±3, ejes por día de la semana, feriados). Están pendientes de decisión del dueño. Usar siempre `fechas-tentativas.js` para la fecha tentativa, de modo que cuando se apruebe la regla se cambie en un solo lugar.

---

## 11. Entrega

1. Rama `feat/planificacion-planes-spot` desde `main`. Commits en español, por nombre de archivo.
2. Pruebas en verde (`node --test tests/ public/js/`) y pruebas en el navegador con los emuladores de la web (puertos desplazados).
3. Reporte en `docs/reportes/planificacion-planes-spot.md` con el formato del protocolo de la web, que incluya:
   - Resumen, archivos tocados (`git diff --stat`), pruebas ejecutadas y resultado.
   - **Plan de despliegue** (lo ejecuta el dueño, desde un clon limpio en un tag):
     ```powershell
     git clone https://github.com/colivaresl2018/gravecare-operaciones.git C:\Despliegue\GravecareOps
     cd C:\Despliegue\GravecareOps
     git checkout <tag>
     git status --short
     firebase deploy --only hosting:gravecare-ops --project gravecare-2e8d2
     ```
   - **Reversa:** historial de versiones de Hosting del sitio `gravecare-ops` (anotar la versión vigente antes de desplegar).
4. No desplegar, no crear el tag, no hacer push a `main`. Eso lo hace el dueño.

---

## 12. Lo que NO debe hacer

- Modificar `public/planificacion.html` o cualquier página existente más allá de lo indicado en §3.
- Escribir en Firestore (ni `fechasProgramadas`, ni `estado`, ni `pagoConfirmado`).
- Implementar las reglas de la especificación v5.1 (ver §10).
- Cambiar reglas, `firebase.json` o `.firebaserc`.
- Imprimir o guardar claves, correos o RUT en el código o en el reporte.

---

## 13. Referencia exacta de los módulos compartidos (aprendida al integrar la primera entrega)

La primera entrega falló en la integración por usar nombres y firmas supuestos. Lo correcto es:

| Necesidad | Módulo real (en `public/js/`) | Cómo se llama |
|---|---|---|
| Nombre del cliente | `nombre-cliente.js?v=ops13` | `cargarContratos(async () => [[id, datos], …])` (recibe una **función**, no `db`) → `contratosDeOrden(mapa, orden, id)` → `nombreClienteParaMostrar(orden, contratos)` |
| Visitas terminadas | `servicio-terminado.js?v=ops13` | `crearIndiceInformes([[id, datos], …])` (pares con `snap.data()` ya llamado, **no** `snap.docs`) → `numerosTerminados(orden, { docId, indiceInformes })` devuelve un `Set` |
| Estado de la visita | `estado-visita-unificado.js?v=ops13` | `estadoUnificadoVisita(orden, n, { terminada })`; etiquetas de la Gantt en `planificacion-servicios.js` |
| Fecha de la visita | `fechas-tentativas.js` | `fechaVisitaConOrigen(orden, n)` devuelve `{ fecha: Date, tentativa: boolean }` (no `origen`) |
| Fecha real / Spot | `fechas-visita.js` | `fechaGuardadaVisita(orden, 'V<n>')` devuelve `Date`; para Spot V1 cae en la fecha del cliente |

Reglas que se repitieron como error: (1) los módulos de fechas devuelven **`Date`**, no texto: hay que leerlos con `getFullYear/getMonth/getDate`; (2) las pruebas deben usar los módulos reales, no funciones simuladas, o no detectan estos errores; (3) Firebase se importa en la **10.7.0** del resto de las pantallas; (4) el `portal.html` hay que modificarlo (botón y título) o la pantalla no se puede abrir.
