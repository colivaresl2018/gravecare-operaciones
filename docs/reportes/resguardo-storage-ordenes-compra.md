# Resguardo de las reglas de Storage de `Ordenes_Compra/` (punto 1 del encargo del 2026-11-26)

**Fecha:** 2026-11-26 · **Rama:** `chore/resguardo-storage-ordenes-compra` (desde `main`, tag `ops-planserv-17`) · **Estado:** listo para revisión. Solo documentación y una prueba: **no cambia el sitio**, no hay nada que desplegar.

## Qué se hizo
En producción ya está publicado el bloque `match /Ordenes_Compra/{fecha}/{archivo}` en `storage.rules` (repo de la web, spec 083). Si este repo publicara algún día sus propias `storage.rules` sin ese bloque, lo borraría y las subidas de órdenes de compra fallarían con `storage/unauthorized`.
- `docs/referencia/storage-ordenes-compra-bloque.md`: el bloque exacto, por qué importa y que hay que comparar con lo publicado antes de publicar reglas desde cualquier lugar.
- `tests/storage-bloque-ordenes-compra.test.mjs` (5 pruebas): cualquier `storage.rules` que exista fuera de `legacy/` debe incluir ese bloque tal cual; hoy no existe ninguno; `firebase.json` sigue sin declarar `storage`; el comprobador detecta un bloque ausente o alterado.

## Hoy
Este repo **no tiene** `storage.rules` ni puede publicarlas (CLAUDE.md regla 5; `tests/firebase-json-sin-reglas.test.mjs`), así que no hay nada que cambiar en reglas. No se publicó ni se tocó ninguna regla.

## Verificado
`node --test tests/ public/js/` → 878 pasan, 0 fallan. Se comprobó que la prueba **falla** si se agrega un `storage.rules` sin el bloque (archivo temporal, ya borrado).
