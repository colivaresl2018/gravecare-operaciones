# Hoja de despliegue — backoffice `ops-planserv-14` (los 17 nombres oficiales de cementerios en «Rutas y feriados»)

**Preparada:** 2026-11-23 · **Commit:** `94ddc48` (merge del [PR #18](https://github.com/colivaresl2018/gravecare-operaciones/pull/18) sobre `main`; incluye `c16ec1f` y, por tanto, los PR #17 y #18) · **Tag:** `ops-planserv-14` (anotado, en origin, apunta a `94ddc48`) · **Objetivo:** Hosting `gravecare-ops` (proyecto `gravecare-2e8d2`).
**Esta hoja solo prepara.** No se ha desplegado nada. Lo ejecuta el dueño con su visto bueno.
**Sustituye a la hoja de `ops-planserv-13`, que está marcada como NO DESPLEGAR.**

## Qué publica
Respecto de lo que está en vivo hoy (`ops-planserv-12` = `3adb767`, confirmado por el dueño), el tag cambia **6 archivos** de `public/` (+ sus pruebas) y no agrega ni quita ninguno (106 archivos en ambos tags). Esos 6 archivos traen la pantalla de «Rutas y feriados» (PR #17) y los nombres oficiales (PR #18):

| Archivo | Cambio |
|---|---|
| `public/rutas-feriados.html` | la lista de cementerios usa el catálogo oficial; módulos con `?v=cfg3` y `?v=cfg2` |
| `public/js/config-planificacion.js` | lista oficial de 17 (`CEMENTERIOS_OFICIALES`), unión con órdenes y rutas sin duplicados por alias; asignar con alias reutiliza el documento existente |
| `public/js/config-planificacion.test.mjs` | pruebas de lo anterior |
| `public/js/config-vistas.js` | la tabla muestra el nombre oficial; casillas y botones siguen usando el nombre guardado |
| `public/js/config-vistas.test.mjs` | prueba de lo anterior |
| `public/js/ubicacion-trabajo.js` | el nombre oficial es el primero en las 17 entradas del catálogo; los nombres antiguos siguen como alias y el orden es el de la lista |

Respecto de `ops-planserv-13` (que no se despliega), el cambio son solo los nombres: `ubicacion-trabajo.js`, `config-planificacion.js` y `config-planificacion.test.mjs`.

No hay cambios de reglas, de funciones ni de datos. Los documentos existentes de `rutas` y sus campos no cambian. El despliegue no escribe nada nuevo en `rutas`; solo cambia lo que ocurre cuando alguien asigna una ruta.

## Nombres que se verán
**Con ruta (9, Activa; eje y día no cambian):**
1. Cementerio El Prado de Puente Alto
2. Cementerio General de Recoleta
3. Cementerio Metropolitano de Lo Espejo
4. Cementerio Municipal N° 1 de Rancagua
5. Parque del Recuerdo Cordillera de Puente Alto
6. Parque del Recuerdo de Huechuraba
7. Parque El Manantial de Maipú
8. Parque Jardín Las Flores de Machalí
9. Parque Sendero de Maipú

**Sin ruta (8):**
1. Cementerio Católico de Recoleta
2. Parque Canaán de Pudahuel
3. Parque Sendero de San Bernardo
4. Cementerio Católico de Maipú
5. Parque del Recuerdo de Padre Hurtado-Peñaflor
6. Cementerio Municipal N° 2 de Rancagua
7. Parque Jardín de Rancagua
8. Parque Sendero de Rancagua

## Requisitos previos
- [x] **PR #17 y PR #18 fusionados** en `main` (`94ddc48`).
- [x] **Tag `ops-planserv-14`** en origin, apunta a `94ddc48` (verificado).
- [x] **Suite en verde:** `node --test tests/*.test.mjs public/js/*.test.mjs` → 795 pasan, 0 fallan (rama `feat/catalogo-nombres-oficiales`, commit `c16ec1f`).
- [ ] **Revisión de duplicados en la colección `rutas`** (Firestore, solo lectura). Pendiente: no hay `rutas.json`. La captura de producción muestra 9 rutas sin repetidos; falta confirmar con el export completo.
- [ ] **Visto bueno del dueño** para publicar.

## Antes (respaldo de lo vigente)
1. En la consola de Firebase → Hosting → sitio `gravecare-ops`: anotar la **versión vigente** y su hora (punto de reversa de la consola).
2. El estado anterior queda **en el tag `ops-planserv-12`** (`3adb767`). No hace falta copiar archivos: solo no borrar ese tag.

## Despliegue (desde el clon limpio, nunca desde la carpeta de trabajo)
```powershell
cd C:\Despliegue\GravecareOps
git fetch --tags origin
git checkout ops-planserv-14
git status --short                      # debe salir vacío
git describe --tags                     # debe mostrar ops-planserv-14
git log --oneline -1                    # debe mostrar 94ddc48
(git ls-files public).Count             # debe dar 106
```
```powershell
firebase deploy --only hosting:gravecare-ops --project gravecare-2e8d2
```
Nunca sin `--only`, nunca sin `--project`. Este despliegue **no** toca funciones ni reglas.

## Después (verificación por lectura)
```powershell
node scripts\verificar-sitio-publicado.mjs ops-planserv-14
```
Debe decir **0 distintos y 0 sin publicar**. Esperado: **106 archivos**. Si hay diferencias, no seguir con la prueba de lectura y avisar.
Después de publicar, abrir el portal con **Ctrl+F5**: los módulos llevan `?v=cfg3` y `?v=cfg2`, así que el navegador no debería usar copias viejas.

## Prueba de lectura (sin escribir en Firestore)
1. Portal → **Rutas y feriados** → pestaña «Rutas por cementerio».
2. Esperado: **17 filas** con los nombres oficiales de la lista anterior. Las 9 con ruta conservan su eje y su día. Las 8 restantes aparecen como «Sin ruta».
3. No asignar rutas de prueba en producción: esa acción escribe en `rutas`. Si se quiere probar, hacerlo en una decisión aparte del dueño.

## Reversa (si algo falla)
- **Rápida:** consola de Firebase → Hosting → `gravecare-ops` → historial de versiones → **Revertir** a la versión anotada en «Antes».
- **Por tag:** repetir el despliegue desde `C:\Despliegue\GravecareOps` con `git checkout ops-planserv-12` y el mismo comando con `--only hosting:gravecare-ops`; verificar con `node scripts\verificar-sitio-publicado.mjs ops-planserv-12`.
  - `ops-planserv-12` es lo que está en vivo hoy. **No** se usa `ops-planserv-13`: nunca se desplegó y su hoja dice NO DESPLEGAR; republicarlo sería publicar algo que nunca estuvo en producción.
- Los datos no se revierten: el despliegue no escribe datos. Si alguien asignó rutas con la versión nueva, esas rutas quedan guardadas; el código anterior las sigue leyendo porque los campos no cambian.

## Notas
- `ops-planserv-12` apunta a `3adb767` (PR #16). `ops-planserv-13` apunta a `ca390da` (PR #17) y no se despliega. `ops-planserv-14` apunta a `94ddc48` (PR #18).
- Pendiente fuera de este despliegue: las matrices de planificación solo reconocen el nombre guardado o el id de la ruta. Un pedido con un alias distinto no encuentra su ruta. Requiere tocar `public/js/rutas-planificacion.js` en otra tarea.
- Pendiente en el repo web (no tocado desde aquí): su copia de referencia `docs/referencias/cementerios.json` aún dice «Parque del Recuerdo de Padre Hurtado», y `functions/cementerios-catalogo.js` tiene nombres antiguos.
