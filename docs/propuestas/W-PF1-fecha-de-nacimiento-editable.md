# Directriz W-PF1 — Fecha de nacimiento editable en el perfil del cliente

2026-11-16 · Para el dueño y el PM, que la llevan al **repo de la web**. Este documento no cambia ningún código.

## 1. Decisión del dueño
En `perfil.html` el cliente **debe poder editar** su fecha de nacimiento aunque ya la haya guardado.

## 2. Diagnóstico (página publicada, `gravecare-2e8d2.web.app/perfil.html`)
No es un fallo: está bloqueada a propósito (spec 048).
- `perfil.html:427` (versión publicada): `campoFecha.disabled = Boolean(fechaNacimientoGuardada); // solo lectura una vez que el titular la completó`.
- Al guardar, la validación de la fecha solo corre si todavía no había una guardada (`perfil.html:462`: `if (!fechaNacimientoGuardada && fechaValor && !fechaNacimientoValida(fechaValor))`).
- Las reglas de Firestore **no** lo impiden: `usuarios/{uid}` permite leer y escribir al propio titular (`firestore.rules:18-19`). No hay que tocar reglas.

La copia del repo en disco (`C:\Proyectos\Gravecare`, rama `release/perfil-y-contrato-unificado`) tiene un `perfil.html` distinto del publicado (sin el texto de consentimiento ni el bloqueo). Quien implemente debe partir de la versión que contiene la spec 048, no de esa copia.

## 3. Cambio propuesto
1. Quitar la línea que deshabilita el campo (`campoFecha.disabled = …`). El campo queda siempre editable.
2. Validar la fecha **siempre** que haya un valor (calendario real, no futura, posterior a 1900) y no solo cuando estaba vacía. Mismo mensaje: «❌ Revisa la fecha de nacimiento: debe existir, no ser futura y ser posterior a 1900».
3. Permitir **borrar** la fecha (dato opcional): si el campo queda vacío, no se escribe una fecha inválida. Decidir si «vaciar» elimina el valor guardado; el texto de la página ya dice que el cliente puede suprimirla en cualquier momento.
4. Mantener el texto de consentimiento tal cual (la autorización es para el saludo de cumpleaños, no para una fecha concreta, así que no hay que pedirla otra vez).
5. Pruebas: (a) con fecha ya guardada, el campo **no** está deshabilitado; (b) una fecha nueva válida se guarda en `usuarios/{uid}.fechaNacimiento` y en `titular.fechaNacimiento`; (c) una fecha inválida no se envía y muestra el aviso; (d) ajustar las pruebas de la spec 048 que exijan el bloqueo (búsqueda en `tests/local/`: ninguna lo comprueba con esas palabras, revisar `fecha-opcional.test.mjs` y `fecha-nacimiento-restaurada.test.mjs`).

## 4. Datos
Sin cambios: se reutilizan `fechaNacimiento` y `titular.fechaNacimiento` de `usuarios/{uid}`. Nada se renombra ni se elimina. La fecha sigue sin copiarse a `ordenes`, `contratos`, `sepulturas` ni `rut_lookup` (spec 038, R6).

## 5. Despliegue (lo hace el dueño, desde un clon limpio en un tag)
Solo Hosting de la web: `--only hosting`. Reversa: volver al tag anterior. No toca Functions ni reglas.

## 6. Verificación
Entrar con una cuenta que ya tenga fecha, abrir «Perfil», cambiar la fecha, guardar y recargar: debe mostrar la fecha nueva. Probar una fecha futura: debe rechazarla.
