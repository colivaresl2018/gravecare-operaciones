# Reglas de Firestore propuestas para «Proveedores y compra por día» (spec 057)

**Estado:** propuesta. **No se publica desde este repo** (regla de oro 5): la fuente única de las reglas es el repo de la web (`gravecare`, `firestore.rules`). Este documento se entrega para que la sesión del repo de la web las revise, las pruebe con emuladores (`tests/reglas/`) y las publique con su release. **Hasta entonces, en producción:** la pestaña «Proveedores» carga con un aviso de permiso denegado y no guarda nada; los borradores del día no se pueden crear; y **emitir una orden de compra elegida de la lista de proveedores falla**, porque la regla actual de `ordenesCompra` acepta solo las claves listadas y `proveedorId` no está (emitir con «Otro proveedor (escribir)» sigue funcionando como hoy).

Esta propuesta parte del texto **actual** de `firestore.rules` de la web (bloque de la spec 055) y respeta su estilo. Usa `esStaff()`, `esDueno()` y `esAdministrador()`, que ya existen.

## Qué escribe el backoffice (contrato exacto)

Todo va dentro de **transacciones** (`runTransaction`: la lectura siempre antes que las escrituras). **Nada se borra.**

| Documento | Operación | Campos |
|---|---|---|
| `proveedores/{id}` (id automático de Firestore) | `create` (junto con su `proveedoresRut`) | `razonSocial`, `rut` (formateado `12.345.678-5`), `contacto`, `telefono`, `direccion`, `condicionesPago` (`Transferencia`, `Factura a 30 días`, `Contado`, `Otro`), `activo` (bool), `creadoEl`, `creadoPor` (uid), `actualizadoEl`, `actualizadoPor` (uid) |
| `proveedores/{id}` | `update` (editar) | solo `razonSocial`, `rut`, `contacto`, `telefono`, `direccion`, `condicionesPago`, `actualizadoEl`, `actualizadoPor` |
| `proveedores/{id}` | `update` (quitar / reactivar) | solo `activo`, `actualizadoEl`, `actualizadoPor` (la pantalla limita estos botones al dueño) |
| `proveedoresRut/{rutNormalizado}` (p. ej. `12345678-5`, sin puntos, `K` en mayúscula) | `create` o `update` (reserva) | `proveedorId`, `liberado` = `false`, `actualizadoEl` |
| `proveedoresRut/{rutNormalizado}` | `update` (liberar el RUT anterior al cambiarlo) | `proveedorId` (el mismo), `liberado` = `true`, `actualizadoEl` |
| `ordenesCompraBorradores/{AAAA-MM-DD}` | `create` (si ya existe, la pantalla no escribe y abre el existente) | `fechaDia` (= id), `lineas` [{`codigo`, `descripcion`, `unidad`, `cantidad`, `precioUnitario`, `valor`}], `neto`, `iva`, `total`, `estado` = `Borrador`, `creadoEl`, `creadoPor` |
| `ordenesCompraBorradores/{AAAA-MM-DD}` | `update` (al emitir, en la misma transacción que la OC) | solo `emitidoComo` (`OC-NNNN`) |
| `ordenesCompra/{numero}` | `create` | **igual que hoy, más `proveedorId` opcional** (id del proveedor del maestro) |

Notas del diseño:

- **RUT único sin consultas en la transacción:** el documento `proveedoresRut/{rutNormalizado}` hace de candado. Crear un proveedor lee el candado; si existe y no está `liberado`, la pantalla rechaza con «Ya existe un proveedor con ese RUT.». Las reglas **no pueden** consultar por RUT, solo por id: por eso el candado.
- **Snapshot en la OC:** la emisión relee el proveedor dentro de la transacción y guarda en `ordenesCompra.proveedor` una copia de `razonSocial`, `rut`, `contacto`, `telefono` y `direccion`. Un proveedor quitado (`activo: false`) o inexistente se rechaza en la pantalla («El proveedor ya no está activo; elige otro.»).
- **El borrador no tiene número:** no toca `contadores/ordenesCompra`. El número nace solo al emitir, con la regla de la 055 sin cambios.

## Propuesta de reglas

```
// Spec 057: validación del maestro de proveedores.
function proveedor057Valido(d) {
  return d.razonSocial is string && d.razonSocial.size() > 0 && d.razonSocial.size() <= 120
    && d.rut is string && d.rut.size() >= 9 && d.rut.size() <= 12
    && d.contacto is string && d.contacto.size() <= 80
    && d.telefono is string && d.telefono.size() <= 30
    && d.direccion is string && d.direccion.size() <= 200
    && d.condicionesPago in ['Transferencia', 'Factura a 30 días', 'Contado', 'Otro']
    && d.activo is bool;
}

// Spec 057: proveedores. Nunca se borran: «quitar» es activo:false. El RUT único lo garantiza proveedoresRut.
match /proveedores/{id} {
  allow read: if esStaff();
  allow create: if esStaff()
    && request.resource.data.keys().hasOnly(['razonSocial', 'rut', 'contacto', 'telefono', 'direccion', 'condicionesPago',
                                              'activo', 'creadoEl', 'creadoPor', 'actualizadoEl', 'actualizadoPor'])
    && proveedor057Valido(request.resource.data)
    && request.resource.data.creadoEl is string
    && request.resource.data.creadoPor == request.auth.uid
    && request.resource.data.actualizadoPor == request.auth.uid
    // el RUT queda reservado en el mismo commit y apunta a este proveedor
    && existsAfter(/databases/$(database)/documents/proveedoresRut/$(request.resource.data.rut.replace('[.]', '')))
    && getAfter(/databases/$(database)/documents/proveedoresRut/$(request.resource.data.rut.replace('[.]', ''))).data.proveedorId == id;
  allow update: if esStaff()
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['razonSocial', 'rut', 'contacto', 'telefono', 'direccion',
                                                                          'condicionesPago', 'activo', 'actualizadoEl', 'actualizadoPor'])
    && proveedor057Valido(request.resource.data)
    && request.resource.data.actualizadoPor == request.auth.uid
    // quitar o reactivar (cambiar «activo») solo lo hace el dueño
    && (request.resource.data.activo == resource.data.activo || esDueno())
    // cambiar el RUT exige haber reservado el nuevo en el mismo commit
    && (request.resource.data.rut == resource.data.rut
        || getAfter(/databases/$(database)/documents/proveedoresRut/$(request.resource.data.rut.replace('[.]', ''))).data.proveedorId == id);
  allow delete: if false;
}

// Spec 057: candado de RUT. El id es el RUT sin puntos, con guion y K en mayúscula. Nunca se borra: se libera con liberado:true.
match /proveedoresRut/{rutNormalizado} {
  allow read: if esStaff();
  allow create: if esStaff()
    && rutNormalizado.matches('^[0-9]{7,8}-[0-9K]$')
    && request.resource.data.keys().hasOnly(['proveedorId', 'liberado', 'actualizadoEl'])
    && request.resource.data.liberado == false
    && request.resource.data.proveedorId is string
    && request.resource.data.actualizadoEl is string
    && existsAfter(/databases/$(database)/documents/proveedores/$(request.resource.data.proveedorId));
  allow update: if esStaff()
    && request.resource.data.keys().hasOnly(['proveedorId', 'liberado', 'actualizadoEl'])
    && request.resource.data.actualizadoEl is string
    && (
      // reservar un RUT que estaba liberado
      (resource.data.liberado == true && request.resource.data.liberado == false
        && existsAfter(/databases/$(database)/documents/proveedores/$(request.resource.data.proveedorId)))
      // liberar el RUT propio (solo su proveedor, cuando se le cambia el RUT)
      || (resource.data.liberado == false && request.resource.data.liberado == true
        && request.resource.data.proveedorId == resource.data.proveedorId)
    );
  allow delete: if false;
}

// Spec 057: borradores de orden de compra por día. Un borrador por día (id = fecha). No llevan número ni tocan el contador.
match /ordenesCompraBorradores/{dia} {
  allow read: if esStaff();
  allow create: if esStaff()
    && dia.matches('^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
    && request.resource.data.keys().hasOnly(['fechaDia', 'lineas', 'neto', 'iva', 'total', 'estado', 'creadoEl', 'creadoPor'])
    && request.resource.data.fechaDia == dia
    && request.resource.data.estado == 'Borrador'
    && request.resource.data.lineas is list && request.resource.data.lineas.size() >= 1
    && request.resource.data.neto is int && request.resource.data.iva is int && request.resource.data.total is int
    && request.resource.data.total == request.resource.data.neto + request.resource.data.iva
    && request.resource.data.creadoEl is string
    && request.resource.data.creadoPor == request.auth.uid;
  // Solo se marca como emitido, una vez, y en el mismo commit en que nace la OC.
  allow update: if esStaff()
    && !('emitidoComo' in resource.data)
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['emitidoComo'])
    && request.resource.data.emitidoComo is string
    && request.resource.data.emitidoComo.matches('^OC-[0-9]{4,}$')
    && existsAfter(/databases/$(database)/documents/ordenesCompra/$(request.resource.data.emitidoComo));
  allow delete: if false;
}

// Spec 057: en la regla EXISTENTE de ordenesCompra, el único cambio es agregar 'proveedorId' a la lista de claves del create:
//   request.resource.data.keys().hasOnly(['numero', 'fecha', 'fechaEntrega', 'proveedor', 'proveedorId', 'condicionesPago', 'lugarEntrega',
//                                          'lineas', 'neto', 'iva', 'total', 'estado', 'creadaEl', 'creadaPor'])
// y, opcionalmente, exigir que si viene proveedorId exista el proveedor:
//   && (!('proveedorId' in request.resource.data) || exists(/databases/$(database)/documents/proveedores/$(request.resource.data.proveedorId)))
```

## Para quien las pruebe y las publique (repo de la web)

- Es una **propuesta**: la sesión de la web decide la redacción final. Puntos a revisar con emuladores: que `String.replace('[.]', '')` (regex) normalice bien el RUT dentro de la ruta del documento, que `existsAfter`/`getAfter` funcionen dentro de la transacción de creación y edición, y que el `update` de `ordenesCompraBorradores` con `existsAfter` de la OC funcione en la transacción de emisión. Si alguna construcción no se puede expresar, la alternativa es quitar esa condición: la **barrera real mínima** es `esStaff()` + `hasOnly` + `delete: false`.
- Si se prefiere que cualquier staff quite o reactive proveedores, se quita la condición `esDueno()` del `update`; la pantalla ya limita esos botones al dueño y se ajusta en una línea (`puedeAnular` en `ordenes-compra.html`).
- **El campo `proveedorId` es un cambio de reglas sobre una colección existente (`ordenesCompra`)**: es aditivo y opcional, no cambia ningún campo ni tipo existente (regla de oro 9), pero hay que publicarlo antes de que alguien emita con un proveedor de la lista.
- **Pruebas mínimas** (de la spec 057):
  - CA-P5 / R-S: staff con claim crea y edita proveedores; un cliente (sin claim) no lee ni escribe `proveedores`, `proveedoresRut` ni `ordenesCompraBorradores`.
  - CA-P6: no existe `delete` en ninguna de las tres colecciones nuevas.
  - RUT único: crear un segundo proveedor con un RUT reservado y no liberado se rechaza; con RUT liberado se acepta; liberar el candado de otro proveedor se rechaza.
  - CA-B4: crear un borrador no cambia `contadores/ordenesCompra` (la prueba comprueba que el contador sigue igual tras la creación).
  - CA-B5: marcar `emitidoComo` solo funciona una vez y solo junto a la OC `OC-NNNN`.
  - La OC con `proveedorId` se acepta; con una clave ajena sigue rechazándose.
- **Contrato de datos** (`docs/10-contrato-de-datos.md` del repo de la web): agregar las filas de `proveedores`, `proveedoresRut`, `ordenesCompraBorradores` y el campo opcional `proveedorId` de `ordenesCompra`, con los campos de la tabla de arriba; y anotar que `valores_ramos/compra` y `rutas` son **solo lectura** para el backoffice en esta spec.
- Después de publicar las reglas no hace falta un tag nuevo del backoffice: la pantalla ya habrá quedado en Hosting. Se prueba con el dueño: crear un proveedor de prueba, intentar repetir su RUT (debe rechazar), emitir una OC de prueba eligiéndolo, y crear el borrador de un día listo desde «Rutas y feriados».
