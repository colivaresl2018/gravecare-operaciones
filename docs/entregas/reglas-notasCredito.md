# Regla de Firestore para `notasCredito` (B-3) — se publica desde el repo de la WEB, no desde este

Este repo **no publica reglas** (regla de oro 5; `firebase.json` solo tiene `hosting`). B-3 usa una colección nueva, `notasCredito`. Como las reglas actuales de la web terminan en `match /{document=**} { allow read, write: if false; }`, **sin esta regla el staff no puede crear ni leer notas** (la página sigue funcionando como antes, pero «Registrar» una nota falla con «permission-denied»).

## Regla propuesta (aditiva; va en `firestore.rules` del repo de la web, junto a `gastos_ingresos` y antes del bloqueo por defecto)
```
    // B-3 (backoffice): notas de crédito. Solo staff con claim lee y crea. Nadie actualiza ni borra:
    // una nota se anula con otra nota (trazabilidad). Los datos bancarios del cliente NO se guardan aquí.
    match /notasCredito/{docId} {
      allow read, create: if esStaff();
      allow update, delete: if false;
    }
```
- `esStaff()` es la función que ya existe en esas reglas (claim `staffActivo`). No cambia ninguna regla existente.
- Comprobada en emuladores (`tests/e2e/b3-notas-credito.e2e.mjs`): el staff crea (200), actualizar y borrar dan 403, y sin sesión no se lee.

## Orden de publicación (lo hace el dueño)
1. **Primero** la regla, desde el repo de la web (rama aparte; el PM/dueño la integra allá).
2. **Después** el Hosting del backoffice (`ops-3`, ver `publicar-ops-3.md`).
Si se publicara el Hosting antes, el libro contable carga igual (la lectura de `notasCredito` está protegida con `try/catch` y solo deja un aviso en la consola), pero guardar una nota fallaría.

## Reversa
Quitar el bloque `match /notasCredito/...` y publicar de nuevo las reglas desde la web. Los documentos ya guardados en `notasCredito` quedan (son aditivos); no afectan a ninguna otra colección.
