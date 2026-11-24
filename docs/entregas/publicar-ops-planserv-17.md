# Hoja de despliegue — backoffice `ops-planserv-17` (spec 062 Parte B: primera visita según el día de ruta y región en «Rutas y feriados»)

**Preparada:** 2026-11-24 · **PR de la funcionalidad:** [#23](https://github.com/colivaresl2018/gravecare-operaciones/pull/23) (**fusionado**, merge `86c4923` en `main`) · **Tag:** `ops-planserv-17` (anotado, apunta a `86c4923`) · **Objetivo:** Hosting `gravecare-ops` (proyecto `gravecare-2e8d2`).
**Esta hoja solo prepara.** No se ha desplegado nada; lo ejecuta el dueño con su visto bueno.

> **Importante: mientras la función `calcularPrimeraVisitaAlPagar` (repo web) no esté publicada, ninguna orden trae el campo `primeraVisitaTentativa` y las fechas tentativas NO cambian.** Publicar este Hosting solo agrega la lectura del campo y el selector de región; el efecto en las fechas llega recién con la función (último paso del orden de publicación).

## Qué publica
Respecto de lo que está en vivo hoy (que es **exactamente** `ops-planserv-16`, comprobado en lectura el 2026-11-24: `node scripts/verificar-sitio-publicado.mjs ops-planserv-16` → 108 archivos de `public/`, 0 distintos, 0 sin publicar; `ops-planserv-15` en cambio sale con 5 distintos), el tag cambia **10 archivos** de `public/` (ninguno nuevo ni borrado; el tag también tiene 108):

| Archivo | Cambio |
|---|---|
| `public/js/fechas-tentativas.js` | lee `ordenes.primeraVisitaTentativa` (V1 = esa fecha; Vn = V1 + (n−1) × intervalo; `fecha: null` = «Sin fecha»; forma inesperada, Spot o campo ausente = cálculo de siempre) |
| `public/js/config-planificacion.js` | lista cerrada de 16 regiones, validación de `region` en rutas y feriados (obligatoria solo en feriados regionales) |
| `public/js/config-planificacion-db.js` | escribe `region` solo si viene (mismo `merge`) |
| `public/js/config-vistas.js` | muestra la región bajo el cementerio y en «Regional · <región>» |
| `public/rutas-feriados.html` | selector «Región (opcional)» en rutas; selector de región en feriados solo con alcance regional; 4.ª columna en la lista pegada |
| `public/ordenes.html` | solo la versión del import (`?v=pv062`) |
| `public/planificacion.html` | solo la versión del import (`?v=pv062`) |
| `public/js/planificacion-servicios.js` | solo la versión del import (`?v=pv062`) |
| `public/js/config-planificacion.test.mjs`, `public/js/config-planificacion-db.test.mjs` | pruebas ajustadas (se publican igual, están dentro de `public/`) |

No hay cambios de reglas de Firestore ni de Storage, de funciones, de permisos ni de datos en este despliegue. `firebase.json` no cambia.

## Requisitos previos
- [x] PR #23 fusionado; `node --test tests/ public/js/` sobre este código → **873 pasan, 0 fallan** (2026-11-24).
- [x] Probado en emuladores con datos ficticios (dueño y administrador): selector de región en rutas (guarda sin tocar `eje`, `diaSemana` ni `cementerio`), selector de feriado regional (solo con alcance regional y obligatorio), lista pegada con 4.ª columna, y fechas V1 25/11/2026, V2 25/12/2026, V3 25/01/2027 (Plan 12), V2 25/01 (Plan 6) y V2 25/02 (Plan 4), «Sin fecha» con `fecha: null`, cálculo de hoy para Spot y para la orden sin campo; Órdenes de Servicio y Planificación coinciden.
- [ ] **Visto bueno del dueño** para publicar.
- No requiere reglas ni funciones previas: el campo `region` en `rutas` y `feriados` ya es aceptado por las reglas publicadas (no limitan campos).

## Antes (respaldo de lo vigente)
1. En la consola de Firebase → Hosting → sitio `gravecare-ops`: anotar la **versión vigente** y su hora (punto de reversa de la consola).
2. Confirmar que lo vigente sigue siendo `ops-planserv-16` (por si alguien publicó otra cosa desde la verificación):
```powershell
cd C:\Despliegue\GravecareOps
git fetch --all --tags
node scripts\verificar-sitio-publicado.mjs ops-planserv-16     # esperado: 108 archivos · 0 distintos · 0 sin publicar
```
   Si sale con distintos, no seguir y avisar: la lista de «Qué publica» ya no sería exacta.
3. El estado anterior queda **en el tag `ops-planserv-16`**. No hace falta copiar archivos: solo no borrar ese tag.

## Despliegue (desde el clon limpio, nunca desde la carpeta de trabajo)
```powershell
cd C:\Despliegue\GravecareOps
git fetch --all --tags
git checkout ops-planserv-17
git status --short                      # debe salir vacío
git log --oneline -1                    # debe decir 86c4923 (Merge pull request #23 ...)
```
```powershell
firebase deploy --only hosting:gravecare-ops --project gravecare-2e8d2
```
Nunca sin `--only`, nunca sin `--project`. Este despliegue **no** toca funciones ni reglas.

## Después (verificación por lectura)
```powershell
node scripts\verificar-sitio-publicado.mjs ops-planserv-17
```
Debe decir **108 archivos · 0 distintos · 0 sin publicar**. Si hay diferencias, no seguir con la prueba real y avisar.
Después de publicar, abrir el portal con **Ctrl+F5**: los módulos de «Rutas y feriados» llevan `?v=cfg5/cfg2/cfg3` y los de fechas `?v=pv062`, así que el navegador no debería usar copias viejas.

## Prueba real (la hace el dueño)
1. **Como dueño:** portal → «Rutas y feriados» → pestaña «Rutas por cementerio». Debe verse, en «Asignar eje y día», el selector **«Región (opcional)»** con la primera opción «Sin cambiar» y las 16 regiones.
2. **Como administrador:** pestaña «Feriados». Con alcance «Nacional» no se ve selector de región; al elegir **«Regional»** aparece «Región del feriado». Si se intenta guardar un regional sin región, avisa «Falta la región del feriado regional: elígela de la lista.». *(No guardar feriados de prueba en producción: basta con ver el selector y el aviso; el aviso aparece antes de escribir nada.)*
3. **Fechas:** Órdenes de Servicio y Planificación deben verse igual que antes (ninguna orden trae aún el campo): una orden cualquiera conserva las mismas fechas tentativas de ayer.

## Qué debe hacer el dueño después de publicar (orden de la spec 062)
1. **Cargar la región en las 17 rutas** («Rutas y feriados» → «Rutas por cementerio»):
   - **12 con «Región Metropolitana»:** Parque del Recuerdo de Huechuraba · Cementerio General de Recoleta · Cementerio Católico de Recoleta · Parque Canaán de Pudahuel · Cementerio Metropolitano de Lo Espejo · Parque del Recuerdo Cordillera de Puente Alto · Cementerio El Prado de Puente Alto · Parque Sendero de San Bernardo · Parque Sendero de Maipú · Parque El Manantial de Maipú · Cementerio Católico de Maipú · Parque del Recuerdo de Padre Hurtado-Peñaflor.
   - **5 con «Región de O'Higgins»:** Cementerio Municipal N° 1 de Rancagua · Cementerio Municipal N° 2 de Rancagua · Parque Jardín de Rancagua · Parque Jardín Las Flores de Machalí · Parque Sendero de Rancagua.
   - **Cuidado:** el botón «Asignar» exige eje y día y **los reemplaza** en todos los cementerios marcados. Para agregar solo la región sin cambiar eje ni día, usar **«Editar»** en cada fila (precarga su eje y día), elegir la región y asignar; o marcar de una vez solo cementerios que tengan el mismo eje y día. La región vacía («Sin cambiar») nunca borra una región ya cargada.
2. **Cargar `region` en cada feriado regional** (pestaña «Feriados», alcance «Regional»; en la lista pegada: `fecha | nombre | regional | Región Metropolitana`). Los feriados nacionales no llevan región.
3. En el **repo de la web**, correr `scripts/comparar-rutas-catalogo.mjs` hasta que diga **«Sin problemas»**.
4. Recién entonces, publicar la función `calcularPrimeraVisitaAlPagar` por nombre (`docs/entregas/publicar-funcion-062.md` del repo web). Desde ahí las órdenes nuevas de Plan pagadas traerán `primeraVisitaTentativa` y el backoffice mostrará esas fechas.

## Reversa (si algo falla)
- **Rápida:** consola de Firebase → Hosting → `gravecare-ops` → historial de versiones → **Revertir** a la versión anotada en «Antes».
- **Por tag:** repetir el despliegue desde `C:\Despliegue\GravecareOps` con `git checkout ops-planserv-16` y el mismo comando con `--only hosting:gravecare-ops --project gravecare-2e8d2`; verificar con `node scripts\verificar-sitio-publicado.mjs ops-planserv-16`.
- Los datos no se revierten: `rutas.region` y `feriados.region` son campos aditivos que el backoffice anterior ignora; `primeraVisitaTentativa` lo escribe solo la función del servidor y el backoffice anterior también lo ignora.

## Notas
- **El tag apunta al merge `86c4923`**, un commit de `main` que contiene el código de la Parte B. Esta hoja se agrega a `main` en un commit posterior que solo toca `docs/`: `public/` es idéntico al del tag, así que lo publicado coincide con `main`.
- El tag anterior (`ops-planserv-16`) es liviano (sin mensaje); `ops-planserv-17` es anotado.
- Reporte técnico de la funcionalidad: `docs/reportes/spec-062-primera-visita-ruta.md`.
