# Reglas deprecadas (no desplegar)

Estas copias de `firestore.rules` y `storage.rules` se movieron aquí el 2026-11-07 (auditoría de cierre, brecha B-18).

- **No son la fuente de verdad.** Las reglas de Firestore y Storage del proyecto Firebase compartido viven **solo** en el repo `gravecare` (`firestore.rules` y `storage.rules`).
- `firebase.json` de este repo no las referencia (solo define el sitio de Hosting `gravecare-ops`).
- La extensión `.deprecado` evita que `firebase deploy` o cualquier herramienta las tome como reglas vigentes.
- Se conservan por la regla de no borrar; pueden eliminarse más adelante con aprobación del dueño.
