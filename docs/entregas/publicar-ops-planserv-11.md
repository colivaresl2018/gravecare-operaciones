# Hoja de despliegue — backoffice `ops-planserv-11` (spec 058: correo del proveedor y «Enviar por correo»)

**Preparada:** 2026-11-23 · **Rama:** `feat/058-correo-proveedor-envio-oc` ([PR #15](https://github.com/colivaresl2018/gravecare-operaciones/pull/15), **sin fusionar**) · **Tag:** `ops-planserv-11` · **Objetivo:** Hosting `gravecare-ops` (proyecto `gravecare-2e8d2`).
**Esta hoja solo prepara.** No se ha desplegado ni fusionado nada; lo ejecuta el dueño con su visto bueno.

## Qué publica
Respecto de lo que está en vivo hoy (que es **exactamente** `ops-planserv-10`, comprobado: `node scripts/verificar-sitio-publicado.mjs ops-planserv-10` → 102 archivos, 0 distintos, 0 sin publicar, 2026-11-23), el tag cambia **5 archivos** de `public/` (+ sus pruebas):

| Archivo | Cambio |
|---|---|
| `public/ordenes-compra.html` | campo «Correo electrónico» y columna «Correo» en Proveedores; botón «Enviar por correo» en el modal de la OC |
| `public/js/ordenes-compra-envio.js` | **nuevo** (hoy da 404): lógica pura del envío |
| `public/js/ordenes-compra-vistas.js` | celda «Correo», línea de estado e historial de envíos |
| `public/js/proveedores.js` | validación del correo (misma regex que las reglas) |
| `public/js/proveedores-db.js` | escritura del correo solo si viene o cambió |

No hay cambios de reglas, de funciones ni de datos en este despliegue.

## Requisitos previos (confirmados por la sesión de la web, con aprobación del dueño, 2026-11-23)
- [x] **Reglas de Firestore con `correo` publicadas** y verificadas: 309 líneas, huella `2a51b2ab0cc5ee35`, tag `reglas-proveedor-correo-2026-11-23`. Sin ellas un proveedor con correo no se guarda.
- [x] **Función `enviarOrdenCompraPorCorreo` desplegada y ACTIVE** (Node 22, `us-central1`, secreto `SMTP_OC_PASS` registrado); una llamada anónima devuelve 401 `UNAUTHENTICATED`.
- [ ] **Visto bueno del dueño** para publicar.
- [ ] **Aviso a `rravellos@gravecare.cl`** antes de la prueba real (ver «Prueba real»).

## Antes (respaldo de lo vigente)
1. En la consola de Firebase → Hosting → sitio `gravecare-ops`: anotar la **versión vigente** y su hora (punto de reversa de la consola).
2. El estado anterior queda **en el tag `ops-planserv-10`** (verificado idéntico a lo publicado). No hace falta copiar archivos: solo no borrar ese tag.

## Despliegue (desde el clon limpio, nunca desde la carpeta de trabajo)
```powershell
cd C:\Despliegue\GravecareOps
git fetch --all --tags
git checkout ops-planserv-11
git status --short                      # debe salir vacío
git log --oneline -1                    # anotar el commit
```
```powershell
firebase deploy --only hosting:gravecare-ops --project gravecare-2e8d2
```
Nunca sin `--only`, nunca sin `--project`. Este despliegue **no** toca funciones ni reglas.

## Después (verificación por lectura)
```powershell
node scripts\verificar-sitio-publicado.mjs ops-planserv-11
```
Debe decir **0 distintos y 0 sin publicar** (el repo ya trae este script; solo hace GET de archivos públicos). Esperado: 104 archivos (los 102 de antes + `js/ordenes-compra-envio.js` y su prueba `js/ordenes-compra-envio.test.mjs`). Si hay diferencias, no seguir con la prueba real y avisar.
Después de publicar, abrir el portal con **Ctrl+F5**: los módulos llevan `?v=058`, así que el navegador no debería usar copias viejas.

## Prueba real (la hace el dueño; envía un correo de verdad)
> **La copia sale de verdad a `rravellos@gravecare.cl`.** Avisar a esa persona antes de probar. El remitente es `colivaresl@gravecare.cl` (fijo en el servidor).

1. Portal → Compra de flores → **Proveedores**: crear un proveedor «Prueba» con **el correo del dueño** (no el de un proveedor real).
2. Emitir una orden de compra a ese proveedor; abrirla desde el listado → **«Enviar por correo»** → confirmar el texto «¿Enviar la OC-NNNN a … con copia a rravellos@gravecare.cl?».
3. Esperado: aviso «Enviada a … con copia a …» y la línea del último envío en el modal; llega el correo al dueño y la copia a `rravellos@`.
4. Comprobar los casos que **no** envían: OC con «Otro proveedor» y OC de un proveedor sin correo → botón deshabilitado con el motivo; OC anulada → sin botón.
5. Anular o dejar claramente marcada la OC de prueba y desactivar el proveedor «Prueba» (no se borra nada).

## Reversa (si algo falla)
- **Rápida:** consola de Firebase → Hosting → `gravecare-ops` → historial de versiones → **Revertir** a la versión anotada en «Antes».
- **Por tag:** repetir el despliegue desde `C:\Despliegue\GravecareOps` con `git checkout ops-planserv-10` y el mismo comando con `--only hosting:gravecare-ops`; verificar con `node scripts\verificar-sitio-publicado.mjs ops-planserv-10`.
- Los datos no se revierten: `proveedores.correo` y `ordenesCompra.envios` son campos aditivos que el backoffice anterior ignora. Un correo ya enviado no se puede deshacer.
- Si falla solo el envío (función o correo), no hace falta revertir el sitio: el resto de la pantalla sigue funcionando y el botón avisa en español.

## Notas
- **Tag sobre la rama:** `ops-planserv-11` apunta al último commit de la rama del PR #15 (sin fusionar). El PR trae también los commits de la spec 057 (el PR #14 se fusionó en `feat/ordenes-compra` después de que esa rama llegara a `main`); en vivo ya está la 057 (`ops-planserv-10`). Cuando el dueño fusione el PR, el contenido de `main` coincide con el tag.
- Suite al preparar el tag: `node --test tests/ public/js/` → 760 pasan, 0 fallan.
