# Informe rechazado: vuelve al mismo operador con estado «Rechazado»

**Fecha:** 2026-11-11 · **Rama:** `fix/informe-rechazado-vuelve-al-operador` · **Tag:** `ops-9`

## Qué pasaba
Al rechazar un informe en *Revisión de Informes*, el informe quedaba en `rechazado` y la visita en `rechazada`, y la asignación
del operador no cambiaba. Pero en *Mis Trabajos* la visita seguía mostrándose como «Asignado», sin el motivo, y el botón decía
«Reportar»: el operador no sabía que había sido rechazada ni qué corregir.

## Qué cambia
- **Mis Trabajos** (`public/mis-trabajos.html`): la visita con informe rechazado se muestra con el estado **«Rechazado»** (mismo componente,
  en color rosa), su menú muestra el **motivo del rechazo** y la acción pasa a **«Corregir informe»** (mismo enlace de captura).
- **Captura del informe** (`public/informe-captura.html`): aviso con el motivo del rechazo, con el componente de alerta existente.
- **Regla** (`public/js/informe-rechazado.js`, con pruebas): decide si la visita está rechazada. Manda el informe; si el operador ya
  reenvió el informe corregido (`pendiente_revision`), deja de figurar como rechazada aunque conserve el motivo anterior.
- No cambia ningún campo, colección ni regla de Firestore/Storage (solo lectura de campos existentes). No se borra nada.

## Pruebas
`node --test tests/ public/js/` → 270 pasan, 0 fallan.

## Despliegue y reversa
Solo Hosting de `gravecare-ops`, desde `C:\Despliegue\GravecareOps` en el tag `ops-9`:
`firebase deploy --project gravecare-2e8d2 --only hosting:gravecare-ops`. Reversa: volver a desplegar `ops-8`.
