# DIRECTRIZ DEL PM B-1 (proyecto del BACKOFFICE) — Backoffice listo para el piloto
Se ejecuta en una sesión de Claude Code abierta en `C:\Proyectos\GravecareOpsPortal`, NO en la sesión de la web. Primero crea el `CLAUDE.md` de este repo con el contenido de abajo y guarda esta directriz en `docs/directrices/B1-backoffice-piloto.md`.
Rama: `feat/b1-backoffice-piloto` (push autorizado de esa rama; nunca `main`, nunca `--force`). Reporte en `docs/reportes/B1-backoffice-piloto.md` con la primera línea «REPORTE B-1 (backoffice) — <fecha y hora> — HEAD <hash corto> — rama <rama>», escrita DESPUÉS del último commit.

- **Objetivo:** que el backoffice sea seguro y útil durante el piloto con Transbank en integración: (1) kit mínimo del proyecto; (2) arreglar el botón «Reportar» (N62); (3) mostrar las órdenes de prueba como «PRUEBA» y no sumarlas como ingreso ni contar las no pagadas (N80); (4) sanear la publicación (N9, y dejar fuera del despliegue el `storage.rules` sin confirmar, N83); (5) preparar el release `ops-1` para que lo ejecute el dueño. NO se despliega nada.
- **Contexto:** el backoffice comparte el proyecto Firebase `gravecare-2e8d2` con la web. Lee ~40 alias de campos de `ordenes`; las fotos de los informes viven en Firestore y las lee el portal del cliente. Hoy cuenta como ingreso toda orden con monto > 0 (alimenta F29/F22), y el botón «Reportar» de `mis-trabajos.html:380` apunta a una página inexistente (`revision-informe.html`; la pantalla real es `informe-captura.html` y lee el parámetro `v`, no `visita`).
- **Referencia:** el dueño deja una copia de solo lectura del contrato de datos de la web en `docs/referencia/10-contrato-de-datos.md` (no la modifiques).

## Contenido del CLAUDE.md de este repo (resumen; amplía con el formato del proyecto)
1. No cambiar diseño, textos ni colores existentes. 2. No borrar nada. 3. Todo en español. 4. Contrato de datos con la web: PROHIBIDO renombrar o eliminar colecciones, campos, rutas de Storage o claims; solo cambios aditivos (la web lee `informes`, `ordenes`, `usuarios`). Antes de tocar un campo, verifica quién lo usa. 5. Las reglas de Firestore y Storage NO se publican desde este repo (fuente única: el repo de la web). 6. Despliegues solo los ejecuta el dueño, desde un clon limpio en un tag, con `--project gravecare-2e8d2` y `--only hosting:<destino>`. Nunca sin `--only`. 7. Sin secretos en el repo. 8. Cambios pequeños, un tema por rama. 9. Este proyecto NO modifica el repo de la web; la web NO modifica este.

## Respuestas del dueño (no las vuelvas a preguntar)
1. Las órdenes de prueba se MUESTRAN con la etiqueta «PRUEBA» en las listas de trabajo (para probar planificación y visitas) y NO se suman como ingreso.
2. Texto de la etiqueta: «PRUEBA» (insignia pequeña con el estilo actual).

## Hacer
1. **Línea base (solo lectura):** `docs/entregas/linea-base-backoffice.md`: estructura, páginas, qué colecciones lee y escribe cada una (archivo:línea), destino de Hosting en `firebase.json` y `.firebaserc`, y qué pruebas existen.
2. **N9 y N83:** quita de `firebase.json` los bloques `firestore` y `storage` de ESTE repo (o déjalos apuntando a una copia con un aviso), de modo que un despliegue de este repo no pueda publicar reglas; comprueba con una lectura que no queda ningún objetivo de reglas. No toques el `storage.rules` con cambios sin confirmar: déjalo fuera del despliegue y repórtalo.
3. **N62:** corrige el enlace de «Reportar» (`mis-trabajos.html:380`) hacia la pantalla real y el parámetro correcto; busca otros enlaces rotos con una revisión estática de nombres EXACTOS (Hosting distingue mayúsculas; usa `git ls-files`).
4. **N80:** en `gastos-ingresos.html` (alrededor de las líneas 865 a 872) suma como ingreso SOLO las órdenes con `pagoConfirmado === true` y `modoPago !== "integracion"`. En las listas de trabajo muestra la etiqueta «PRUEBA» cuando `modoPago === "integracion"` y oculta o marca las órdenes sin pago confirmado. Un campo ausente (órdenes antiguas) debe tratarse sin romper ninguna pantalla.
5. **Pruebas:** como no hay emulador en este repo, entrega un entorno local mínimo: páginas servidas en un puerto propio y conectadas a los emuladores del repo de la web (puertos desplazados, módulo inerte fuera de localhost; nunca producción), con datos de prueba (órdenes pagadas, no pagadas y con `modoPago: "integracion"`). Pruebas automáticas de los filtros de N80 y de que el botón de N62 abre la pantalla correcta.
6. **Release `ops-1`:** crea el tag y `docs/entregas/publicar-ops-1.md` y una hoja de una página, en PowerShell, desde un clon limpio, con el comando EXACTO de Hosting para el sitio del backoffice (verifica con `firebase hosting:sites:list` que es `gravecare-ops`), vista previa, verificación por lectura (script que compare el sitio publicado con el tag) y reversa. No despliegues.
7. **Documentación:** backlog propio del repo (N80, N62, N9, N83 y, pendiente, N57: la lista fija de administradores por correo no se toca aquí).

## No hacer
No despliegues; no toques reglas; no renombres campos ni colecciones; no leas `.env`; no escribas en producción; no cambies diseño ni textos fuera de la etiqueta «PRUEBA».

## Criterios de salida
N9, N62 y N80 con pruebas en verde; entorno local mínimo funcionando; tag `ops-1` y procedimiento de publicación con reversa.
