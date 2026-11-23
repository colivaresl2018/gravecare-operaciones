# Hoja de despliegue — backoffice `ops-planserv-13` (catálogo oficial de cementerios en «Rutas y feriados»)

> **NO DESPLEGAR.** Esta hoja queda marcada como no desplegar. Los nombres de cementerios que describe ya no son los oficiales. Sustituida por [`publicar-ops-planserv-14.md`](publicar-ops-planserv-14.md).

**Preparada:** 2026-11-23 · **Commit:** `ca390da` (merge del [PR #17](https://github.com/colivaresl2018/gravecare-operaciones/pull/17), ya fusionado en `main`) · **Tag:** `ops-planserv-13` · **Objetivo:** Hosting `gravecare-ops` (proyecto `gravecare-2e8d2`).
**Esta hoja solo prepara.** No se ha desplegado nada; lo ejecuta el dueño con su visto bueno.

## Qué publica
Respecto de lo que está en vivo hoy (que es **exactamente** `ops-planserv-12` = `3adb767`, confirmado por el dueño), el tag cambia **6 archivos** de `public/` y no agrega ni quita ninguno (106 archivos en ambos tags):

| Archivo | Cambio |
|---|---|
| `public/rutas-feriados.html` | la lista de cementerios usa el catálogo oficial; módulos con `?v=cfg3` y `?v=cfg2` |
| `public/js/config-planificacion.js` | lista oficial de 17, unión con órdenes y rutas sin duplicados por alias; asignar con alias reutiliza el documento existente |
| `public/js/config-planificacion.test.mjs` | pruebas de lo anterior |
| `public/js/config-vistas.js` | la tabla muestra el nombre oficial; casillas y botones siguen usando el nombre guardado |
| `public/js/config-vistas.test.mjs` | prueba de lo anterior |
| `public/js/ubicacion-trabajo.js` | nombre oficial primero en las 17 entradas del catálogo (mismos alias) |

No hay cambios de reglas, de funciones ni de datos en este despliegue. Tampoco escribe nada nuevo en `rutas` por sí solo: solo cambia lo que ocurre cuando alguien asigna una ruta.

## Requisitos previos
- [x] **PR #17 fusionado** en `main` (`ca390da`) y tag `ops-planserv-13` subido a origin.
- [x] **Suite en verde:** `node --test tests/*.test.mjs public/js/*.test.mjs` → 792 pasan, 0 fallan (en la rama del PR, `d794401`, que tiene el mismo contenido que `ca390da`).
- [ ] **Revisión de duplicados en la colección `rutas`** (Firestore, solo lectura). Pendiente: no hay `rutas.json`. La captura de producción muestra 9 rutas sin repetidos; falta confirmar con el export completo, porque la pantalla no muestra documentos que el código oculte.
- [ ] **Visto bueno del dueño** para publicar.

## Antes (respaldo de lo vigente)
1. En la consola de Firebase → Hosting → sitio `gravecare-ops`: anotar la **versión vigente** y su hora (punto de reversa de la consola).
2. El estado anterior queda **en el tag `ops-planserv-12`** (`3adb767`). No hace falta copiar archivos: solo no borrar ese tag.

## Despliegue (desde el clon limpio, nunca desde la carpeta de trabajo)
```powershell
cd C:\Despliegue\GravecareOps
git fetch --all --tags
git checkout ops-planserv-13
git status --short                      # debe salir vacío
git log --oneline -1                    # debe mostrar ca390da
```
```powershell
firebase deploy --only hosting:gravecare-ops --project gravecare-2e8d2
```
Nunca sin `--only`, nunca sin `--project`. Este despliegue **no** toca funciones ni reglas.

## Después (verificación por lectura)
```powershell
node scripts\verificar-sitio-publicado.mjs ops-planserv-13
```
Debe decir **0 distintos y 0 sin publicar**. Esperado: **106 archivos**. Si hay diferencias, no seguir con la prueba de lectura y avisar.
Después de publicar, abrir el portal con **Ctrl+F5**: los módulos llevan `?v=cfg3` y `?v=cfg2`, así que el navegador no debería usar copias viejas.

## Prueba de lectura (sin escribir en Firestore)
1. Portal → **Rutas y feriados** → pestaña «Rutas por cementerio».
2. Esperado: **17 filas** con nombres oficiales. Las 9 que ya tienen ruta (Activa) conservan su eje y su día. Las 8 restantes aparecen como «Sin ruta»: Parque Canaán de Pudahuel, Cementerio Católico de Recoleta, Parque Sendero San Bernardo, Cementerio Católico de Maipú, Parque del Recuerdo Padre Hurtado, Cementerio Municipal N° 2 (Baquedano), Parque Jardín Rancagua y Sendero Rancagua.
3. No asignar rutas de prueba en producción: esa acción escribe en `rutas`. Si se quiere probar, hacerlo en una decisión aparte del dueño.

## Reversa (si algo falla)
- **Rápida:** consola de Firebase → Hosting → `gravecare-ops` → historial de versiones → **Revertir** a la versión anotada en «Antes».
- **Por tag:** repetir el despliegue desde `C:\Despliegue\GravecareOps` con `git checkout ops-planserv-12` y el mismo comando con `--only hosting:gravecare-ops`; verificar con `node scripts\verificar-sitio-publicado.mjs ops-planserv-12`.
- Los datos no se revierten: el despliegue no escribe datos. Si alguien asignó rutas con la versión nueva, esas rutas quedan guardadas; el código anterior las sigue leyendo porque los campos no cambian.

## Notas
- `ops-planserv-12` apunta a `3adb767` (PR #16, impresión de OC en PDF). `ops-planserv-13` apunta a `ca390da` (merge del PR #17).
- Pendiente fuera de este despliegue: las matrices de planificación solo reconocen el nombre guardado o el id de la ruta. Un pedido con un alias distinto no encuentra su ruta. Requiere tocar `public/js/rutas-planificacion.js` en otra tarea.
