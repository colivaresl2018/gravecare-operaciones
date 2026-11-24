# Brief para la web — reglas de Firestore de la spec 063 (seguimiento de pago de las órdenes de compra)

- **Para:** la sesión que trabaja en `C:\Proyectos\Gravecare` (repo de la web). Las reglas **no se publican desde el backoffice** (regla de oro 5): las escribe y prueba la web y las publica el dueño.
- **Origen:** spec 063 del backoffice, aprobada por el dueño el 2026-11-23 (`specs/063-pago-ordenes-compra/spec.md`, §4 y §8). Este brief no la reemplaza: fija lo que necesita la regla.
- **Alcance:** solo `match /ordenesCompra/{numero}` → `allow update`. `create`, `delete` (`false`) y las demás colecciones no cambian. Cambio **aditivo**: ningún campo existente se renombra ni elimina.
- **Lo que no debe hacerse:** abrir la escritura de campos comerciales, permitir `Pagada → Anulada`, ni tocar `gastos_ingresos`/`comprobantes_tributarios`. El envío por correo escribe `envios` desde el servidor y no se ve afectado.

## Campos nuevos (todos opcionales)

| Campo | Tipo | Regla |
|---|---|---|
| `estado` | texto | ya existe; ahora admite `Pagada` (`Emitida` \| `Pagada` \| `Anulada`) |
| `facturaNumero` | texto | al pagar: `matches('^[A-Za-z0-9][A-Za-z0-9 ./-]{0,19}$')`; al revertir: `''` |
| `fechaPago` | texto | al pagar: `matches('^[0-9]{4}-[0-9]{2}-[0-9]{2}$')` y `>= resource.data.fecha` (comparación de texto); al revertir: `''` |
| `pagoRegistradoEl` / `pagoRegistradoPor` | texto ISO / uid | al pagar o corregir; `…Por == request.auth.uid` |
| `pagoRevertidoEl` / `pagoRevertidoPor` / `motivoReversionPago` | texto ISO / uid / texto | al revertir; motivo no vacío, `size() <= 500`; `…Por == request.auth.uid` |
| `comentario` | texto | `size() <= 500` (`''` = sin comentario) |
| `comentarioActualizadoEl` / `comentarioActualizadoPor` | texto ISO / uid | cuando viaja `comentario`; `…Por == request.auth.uid` |

La validación fina de fecha real (por ejemplo `2026-02-30`) y de «no futura» la hace el cliente; la regla exige formato y que no sea anterior a `fecha`.

## `allow update` = unión de tres ramas

1. **Anular (sin cambios, spec 055):** `esDueno()`, de `Emitida` a `Anulada`, `affectedKeys` solo `estado`, `anuladaEl`, `anuladaPor`, `motivoAnulacion`.
2. **Pago (nueva):** `esDueno() || esAdministrador()`; estado anterior y nuevo en `{Emitida, Pagada}` y la transición es una de:
   - `Emitida → Pagada`: `facturaNumero` con el formato, `fechaPago` con formato y `>= fecha`, `pagoRegistradoEl is string`, `pagoRegistradoPor == uid`.
   - `Pagada → Pagada` (corrección): igual que arriba.
   - `Pagada → Emitida` (reversión): `facturaNumero == ''`, `fechaPago == ''`, `motivoReversionPago` no vacío y `<= 500`, `pagoRevertidoEl is string`, `pagoRevertidoPor == uid`.
   - `Emitida → Emitida`: solo si únicamente cambia el comentario (cae también en la rama 3; no hace falta duplicarlo).
   - `affectedKeys().hasOnly([...])` con `estado`, `facturaNumero`, `fechaPago`, `pagoRegistradoEl`, `pagoRegistradoPor`, `pagoRevertidoEl`, `pagoRevertidoPor`, `motivoReversionPago`, **`comentario`, `comentarioActualizadoEl`, `comentarioActualizadoPor`** (el panel guarda pago y comentario en una sola escritura atómica; si `comentario` está entre las claves afectadas, debe cumplir la rama 3).
3. **Comentario (nueva):** `esStaff()`; `resource.data.estado != 'Anulada'` y el estado **no cambia**; `affectedKeys().hasOnly(['comentario','comentarioActualizadoEl','comentarioActualizadoPor'])`; `comentario is string && size() <= 500`; `comentarioActualizadoEl is string`; `comentarioActualizadoPor == uid`.

Nunca deben poder cambiar: `numero`, `fecha`, `fechaEntrega`, `proveedor`, `proveedorId`, `condicionesPago`, `lugarEntrega`, `lineas`, `neto`, `iva`, `total`, `creadaEl`, `creadaPor`, `envios`, `anuladaEl`, `anuladaPor`, `motivoAnulacion` (lo asegura la lista cerrada de `affectedKeys`).

## Pruebas de emulador que se piden (puertos desplazados, nunca los del dueño ni producción)

- Cada rol (dueño, administrador, supervisor, staff sin claim, cliente, sin sesión) en cada transición permitida y en cada prohibida.
- `Pagada → Anulada` rechazada; cualquier cambio sobre `Anulada` rechazado (también el comentario).
- Un supervisor puede cambiar solo el comentario (y no el estado ni el pago).
- Escritura combinada pago + comentario aceptada para dueño y administrador; con un campo comercial añadido, rechazada.
- Formatos: factura de 21 caracteres, con caracteres no permitidos o vacía al pagar → rechazada; fecha mal formada o anterior a `fecha` → rechazada; comentario de 501 → rechazado; `…Por` distinto del `uid` → rechazado.
- Reversión sin motivo, o sin vaciar factura y fecha → rechazada.
- Que las pruebas existentes de la spec 055 (anulación, inmutabilidad) sigan en verde.

## Entrega esperada

Rama y PR en el repo de la web con la regla y las pruebas, reporte con resultado de las pruebas y **resumen para el dueño antes de publicar**; publicación solo de reglas (`--only firestore:rules`) por el dueño; aviso al backoffice con el nombre del tag. El backoffice no despliega su Hosting hasta ese aviso.
