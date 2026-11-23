# Hoja de despliegue — backoffice `ops-planserv-15` (nueva versión de caché para «Rutas y feriados»)

**Preparada:** 2026-11-23 · **Commit:** merge del [PR #20](https://github.com/colivaresl2018/gravecare-operaciones/pull/20) sobre `main` (**aún no fusionado**; se anota al crear el tag) · **Tag:** `ops-planserv-15` (**aún no creado**) · **Objetivo:** Hosting `gravecare-ops` (proyecto `gravecare-2e8d2`).
**Esta hoja solo prepara.** No se ha desplegado nada ni se ha creado el tag. Lo ejecuta el dueño con su visto bueno.

## Por qué
Los despliegues 13 y 14 usan la misma URL `config-planificacion.js?v=cfg3`, y el servidor manda `max-age=3600`. Un navegador que cargó el 13 seguía mostrando los nombres anteriores en «Rutas y feriados». Esta versión sube la URL a `?v=cfg4`, así que el navegador pide el archivo nuevo.

## Qué publica
Respecto de lo que está en vivo hoy (`ops-planserv-14` = `94ddc48`), el tag cambia **2 archivos** de `public/`, sin agregar ni quitar ninguno (106 en ambos tags):

| Archivo | Cambio |
|---|---|
| `public/rutas-feriados.html` | importa `config-planificacion.js?v=cfg4` (antes `cfg3`) |
| `public/js/config-planificacion.js` | importa `ubicacion-trabajo.js?v=cfg4` |

No hay cambios de datos, de reglas ni de funciones. Tampoco hay cambios en los documentos de `rutas`.

## Requisitos previos
- [ ] **PR #20 fusionado** en `main`.
- [ ] **Tag `ops-planserv-15`** sobre el commit de fusión del PR #20, subido a origin.
- [x] **Suite en verde:** `node --test tests/*.test.mjs public/js/*.test.mjs` → 795 pasan, 0 fallan (rama `fix/rutas-cache-cfg4`).
- [x] **Revisión de duplicados en `rutas`:** 17 documentos, 17 cementerios, 0 repetidos (export del 23-nov).
- [ ] **Visto bueno del dueño** para publicar.

## Antes (respaldo de lo vigente)
1. En la consola de Firebase → Hosting → sitio `gravecare-ops`: anotar la **versión vigente** y su hora.
2. El estado anterior queda **en el tag `ops-planserv-14`** (`94ddc48`). No hace falta copiar archivos: solo no borrar ese tag.

## Despliegue (desde el clon limpio, nunca desde la carpeta de trabajo)
```powershell
cd C:\Despliegue\GravecareOps
git fetch --tags origin
git checkout ops-planserv-15
git status --short                      # debe salir vacío
git describe --tags                     # debe mostrar ops-planserv-15
(git ls-files public).Count             # debe dar 106
```
```powershell
firebase deploy --only hosting:gravecare-ops --project gravecare-2e8d2
```
Nunca sin `--only`, nunca sin `--project`. Este despliegue **no** toca funciones ni reglas.

## Después (verificación por lectura)
```powershell
node scripts\verificar-sitio-publicado.mjs ops-planserv-15
```
Debe decir **0 distintos y 0 sin publicar**. Esperado: **106 archivos**.

Luego abrir «Rutas y feriados» con **Ctrl+Shift+R**. Esperado: **17 filas** con los nombres oficiales de la lista (9 con ruta, 8 «Sin ruta»).

## Reversa (si algo falla)
- **Rápida:** consola de Firebase → Hosting → `gravecare-ops` → historial de versiones → **Revertir** a la versión anotada en «Antes».
- **Por tag:** repetir el despliegue desde `C:\Despliegue\GravecareOps` con `git checkout ops-planserv-14` y el mismo comando con `--only hosting:gravecare-ops`; verificar con `node scripts\verificar-sitio-publicado.mjs ops-planserv-14`.
- Los datos no se revierten: el despliegue no escribe datos.
