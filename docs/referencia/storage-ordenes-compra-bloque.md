# Bloque de reglas de Storage para `Ordenes_Compra/` (referencia, no se publica desde este repo)

**Fuente:** repo de la web (`gravecare`), `storage.rules`, publicado en producción (spec 083). El bucket y las reglas son **compartidos** con la web.
**Por qué importa:** si este repo publicara algún día sus propias `storage.rules` **sin** este bloque, lo **borraría** de producción y las subidas de órdenes de compra fallarían con `storage/unauthorized`. Hoy este repo **no tiene** `storage.rules` ni puede publicarlas (CLAUDE.md, regla 5; `tests/firebase-json-sin-reglas.test.mjs`). Si alguna vez se agregan, deben incluir este bloque **tal cual**, después del de `facturas/`. La prueba `tests/storage-bloque-ordenes-compra.test.mjs` lo exige y toma el texto de este archivo.

```
    match /Ordenes_Compra/{fecha}/{archivo} {
      allow read: if esStaffActivo();
      allow create: if esStaffActivo() && resource == null &&
        fecha.matches('^[0-9]{4}-[0-9]{2}-[0-9]{2}$') &&
        archivo.matches('^[A-Za-z0-9_-]{8,64}[.]pdf$') &&
        request.resource.size <= 5 * 1024 * 1024 &&
        request.resource.contentType == 'application/pdf';
      allow update, delete: if false;
    }
```

Antes de publicar reglas desde cualquier lugar, **comparar con las publicadas** (consola de Firebase → Storage → Reglas).
