# Reglas de Firestore propuestas para «Órdenes de compra» (spec 055)

**Estado:** propuesta. **No se publica desde este repo** (regla de oro 5): la fuente única de las reglas es el repo de la web (`gravecare`, `firestore.rules`). Este documento se entrega para que la sesión del repo de la web las revise, las pruebe con emuladores (`tests/reglas/`, CA1, CA2, CA3 y CA9 de la spec 055) y las publique con su release. **Hasta entonces la pantalla «Órdenes de compra» carga con un aviso de permiso denegado y no guarda nada.**

Funciones que ya existen en las reglas publicadas: `esStaff()` (claim `staffActivo`), `esAdministrador()` y `esDueno()` (`staff/{uid}.dueno == true`).

## Qué escribe la pantalla (contrato exacto)

Todo se escribe dentro de **transacciones** del SDK (`runTransaction`): la lectura siempre va antes que las escrituras. Nada se borra.

| Documento | Operación | Campos |
|---|---|---|
| `materiales/{codigo}` | `create` (si ya existe, la pantalla avisa «El código ya existe» sin escribir) | `codigo`, `descripcion`, `tipo`, `unidad`, `precioUnitario`, `activo`, `creadoEl` (texto ISO), `creadoPor` (uid) |
| `materiales/{codigo}` | `update` | solo `descripcion`, `tipo`, `unidad`, `precioUnitario`, `activo` (retirar = `activo: false`) |
| `ordenesCompra/{numero}` | `create` (en la misma transacción que el contador) | `numero`, `fecha`, `fechaEntrega`, `proveedor` {`razonSocial`, `rut`, `contacto`, `telefono`, `direccion`}, `condicionesPago`, `lugarEntrega`, `lineas` [{`codigo`, `descripcion`, `unidad`, `cantidad`, `precioUnitario`, `valor`}], `neto`, `iva`, `total`, `estado` = `Emitida`, `creadaEl` (texto ISO), `creadaPor` (uid) |
| `ordenesCompra/{numero}` | `update` (anular) | solo `estado` (`Emitida` → `Anulada`), `anuladaEl` (texto ISO), `anuladaPor` (uid), `motivoAnulacion` |
| `contadores/ordenesCompra` | `create` la primera vez y `update` después | solo `ultimo` (entero que sube de uno en uno) |

`anuladaPor` es un campo que agregó el backoffice sobre la spec (R5 solo nombra `anuladaEl` y `motivoAnulacion`): deja constancia de quién anuló. Si la web prefiere no guardarlo, se quita en `ordenes-compra-db.js` y en la prueba.

## Propuesta de reglas

```
// Spec 055: maestro de materiales. Staff con claim lee. El código (id) es único: se crea una sola vez; nunca se borra.
match /materiales/{codigo} {
  allow read: if esStaff();
  allow create: if esStaff()
    && codigo.matches('^[A-Z0-9-]{2,20}$')
    && !codigo.matches('^RAM-(STD|PRE|DLX|ADS|ADP)$')      // códigos reservados: el precio de los ramos sale de valores_ramos/compra
    && request.resource.data.keys().hasOnly(['codigo', 'descripcion', 'tipo', 'unidad', 'precioUnitario', 'activo', 'creadoEl', 'creadoPor'])
    && request.resource.data.codigo == codigo
    && request.resource.data.descripcion is string && request.resource.data.descripcion.size() > 0
    && request.resource.data.tipo in ['Insumo', 'Arreglo floral', 'Servicio']
    && request.resource.data.unidad is string && request.resource.data.unidad.size() > 0 && request.resource.data.unidad.size() <= 10
    && request.resource.data.precioUnitario is int && request.resource.data.precioUnitario >= 0
    && request.resource.data.activo is bool
    && request.resource.data.creadoPor == request.auth.uid;
  allow update: if esStaff()
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['descripcion', 'tipo', 'unidad', 'precioUnitario', 'activo'])
    && request.resource.data.descripcion is string && request.resource.data.descripcion.size() > 0
    && request.resource.data.tipo in ['Insumo', 'Arreglo floral', 'Servicio']
    && request.resource.data.precioUnitario is int && request.resource.data.precioUnitario >= 0
    && request.resource.data.activo is bool;
  allow delete: if false;
}

// Spec 055: órdenes de compra. Una OC emitida es inmutable (R7): solo puede pasar de Emitida a Anulada, con motivo, y solo la anula el dueño
// (decisión 5 de la spec, propuesta). El número sale del contador y la orden nace en la misma transacción que lo avanza.
match /ordenesCompra/{numero} {
  allow read: if esStaff();
  allow create: if esStaff()
    && numero.matches('^OC-[0-9]{4,}$')
    && request.resource.data.numero == numero
    && request.resource.data.estado == 'Emitida'
    && request.resource.data.creadaPor == request.auth.uid
    && request.resource.data.lineas is list && request.resource.data.lineas.size() >= 1
    && request.resource.data.proveedor.razonSocial is string && request.resource.data.proveedor.razonSocial.size() > 0
    && request.resource.data.total == request.resource.data.neto + request.resource.data.iva
    && getAfter(/databases/$(database)/documents/contadores/ordenesCompra).data.ultimo == int(numero[3:]);
  allow update: if esDueno()
    && resource.data.estado == 'Emitida'
    && request.resource.data.estado == 'Anulada'
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['estado', 'anuladaEl', 'anuladaPor', 'motivoAnulacion'])
    && request.resource.data.motivoAnulacion is string && request.resource.data.motivoAnulacion.size() > 0
    && request.resource.data.anuladaPor == request.auth.uid;
  allow delete: if false;
}

// Spec 055: contador de números de OC. Solo sube de uno en uno (R4); nunca se borra ni se retrocede.
match /contadores/ordenesCompra {
  allow read: if esStaff();
  allow create: if esStaff() && request.resource.data.keys().hasOnly(['ultimo']) && request.resource.data.ultimo == 1;
  allow update: if esStaff() && request.resource.data.keys().hasOnly(['ultimo']) && request.resource.data.ultimo == resource.data.ultimo + 1;
  allow delete: if false;
}
```

## Para quien las pruebe y las publique (repo de la web)

- Es una **propuesta**: la sesión de la web decide la redacción final y la prueba con emuladores. Puntos a revisar: que `int(numero[3:])` y `getAfter` funcionen dentro de la transacción de emisión, y si las cotas de los textos (descripción, unidad) se quieren más o menos estrictas.
- Si se prefiere que cualquier staff anule (en vez de solo el dueño), se cambia `esDueno()` por `esStaff()` en el `update` de `ordenesCompra`; la pantalla ya limita el botón «Anular» al dueño y se ajusta en una línea (`puedeAnular`).
- Pruebas mínimas que la spec pide: CA1 (staff crea material), CA2 (código repetido rechazado), CA3 (cliente no lee ni escribe), CA9 (OC emitida inmutable: solo anular con motivo).
- La pantalla sigue funcionando igual con cualquier redacción que respete la tabla de campos de arriba.
- Después de publicar las reglas, un tag nuevo del backoffice no es necesario: la pantalla ya habrá quedado en Hosting. Se prueba con el dueño: crear un material, emitir una OC de prueba, imprimirla y anularla.
