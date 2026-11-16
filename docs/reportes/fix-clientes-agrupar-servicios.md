# Gestión de Clientes: un cliente, una fila (servicios desplegables)

**Rama:** `fix/clientes-agrupar-servicios` (sobre `fix/escape-html-backoffice`) · **Página:** `public/clientes.html`

## Qué pasaba
La lista tenía una fila por cada servicio (orden) o ficha. Un cliente con dos servicios, como Ana María Soto Morgado (RUT 15.730.505-0, Plan 4 y Spot), salía dos veces con el mismo RUT y el mismo cementerio.

## Qué cambia
- **Agrupación por RUT normalizado** (solo dígitos y K). Un cliente aparece una sola vez.
  - La fila agrupada muestra nombre del titular, ser querido principal, RUT, contacto, ubicación principal (primer servicio contratado) y comuna.
  - Con **un solo servicio**, la fila se ve igual que antes (plan, suscripción, ramos, estado, fecha y «Borrar»).
  - Con **varios servicios**, la columna Plan muestra «N servicios» con los planes debajo. Las columnas de servicio muestran «—». Al pulsar la fila o «Ver servicios» se despliegan debajo, una línea por servicio, con plan, ser querido, ubicación, suscripción, ramos, estado (V1/4…), fecha de registro y el botón «Borrar» de ese servicio.
- **Sin RUT válido**, cada ficha queda sola (no se mezcla con otras).
- **Una misma orden nunca se cuenta dos veces** dentro de un cliente, aunque llegue por dos fichas.
- El estado del servicio se calcula igual en ambas rutas (con órdenes en `clientes` o sin esa colección): «V<n>/<total>» o «Completado (n/n)». Antes, la ruta de respaldo nunca mostraba «Completado».
- **Import faltante:** esta rama no importaba `./js/nombre-cliente.js` (la página fallaba con `ReferenceError: cargarContratos is not defined` y se quedaba en «Cargando»). Se agrega el mismo import que ya tiene `main` (commit `bce70d4`, idéntico al de la rama `claude/fix-clientes-import-nombre-cliente-4ec845`).
- Filtros y buscador: el cliente aparece si algún servicio coincide con el cementerio, y el buscador revisa nombre, RUT, correo y el ser querido de cualquiera de sus servicios. Al filtrar se muestran todos los servicios del cliente.
- **Sin cambios de diseño:** mismas columnas, clases y textos. El botón «Borrar» conserva su comportamiento (sigue deshabilitado y avisa).
- Lógica pura en `public/js/clientes-agrupar.js` (agrupación, RUT, estado), con pruebas en `public/js/clientes-agrupar.test.mjs`.
- `tests/escape-html-backoffice.test.mjs`: la excepción de HTML generado por la página pasa de `item.estadoServicioHtml` a `s.estadoServicioHtml` (mismo motivo: lo arma `estadoDeServicio` solo con números).

## Pruebas
- `node --test tests/ public/js/`: 339 de 339 en verde.
- Prueba manual con Firebase simulado (datos ficticios, en un entorno de prueba fuera del repo): el cliente con Plan 4 y Spot aparece en una fila con «2 servicios», se despliega y muestra ambos servicios con su «Borrar»; un cliente con un servicio se ve como antes; la búsqueda, el filtro de cementerio y el mensaje «sin resultados» funcionan; el clic en «Borrar» no despliega ni pliega la fila; con dos fichas del mismo RUT la orden compartida se cuenta una vez.
- No se probó en el navegador con datos reales de Firestore.

## Plan de despliegue y reversa
- **Despliegue:** lo ejecuta el dueño desde un clon limpio en tag, con `--project gravecare-2e8d2 --only hosting:gravecare-ops`. Este cambio no toca datos, reglas ni colecciones.
- **Reversa:** volver al tag anterior de `gravecare-ops` y redesplegar con el mismo `--only`. Ningún dato cambia, así que la reversa es inmediata.
