# Reporte — Spot: la fecha que elige el cliente al contratar no aparecía

2026-11-16 · Rama `fix/spot-fecha-del-cliente` (sobre `ops-19`). Pedido directo del dueño. No se desplegó nada. Sin secretos, correos ni RUT.

## 1. Qué pasaba
En Órdenes de Servicio (y Planificación) las visitas Spot mostraban «Sin fecha». La web guarda la fecha que elige el cliente en la orden (`fechaProgramada` AAAA-MM-DD y `fechaServicio` DD/MM/AAAA), pero el backoffice solo leía `fechasPorVisita.V1` (fecha real puesta por el staff) o una fecha tentativa del plan, y Spot no tiene tentativa. Resultado: la fecha elegida al comprar nunca se veía.

## 2. Qué cambió (solo lógica, sin cambios visuales)
`public/js/fechas-tentativas.js`: `fechaVisitaConOrigen` ahora, para la visita 1 de un plan Spot sin fecha real, devuelve la fecha elegida por el cliente como fecha **real** (no tentativa). Orden de preferencia: `fechasPorVisita.V1` → `fechaProgramada` → `fechaServicio`. Solo se acepta una fecha de calendario válida. En planes de varias visitas `fechaProgramada` es un puntero a la próxima visita y no se usa. Como Órdenes y Planificación usan esta función, ambas se corrigen a la vez. Mis Trabajos y Todos los Trabajos ya leían `fechaProgramada`.
No se escribe nada en Firestore. Si el staff cambia la fecha, se guarda en `fechasPorVisita.V1` y esa gana.

## 3. Pruebas
5 pruebas nuevas en `tests/fechas-tentativas.test.mjs` (fechaProgramada, fechaServicio, la real gana, fechas inválidas, planes de varias visitas no se afectan). `node --test tests/ public/js/`: 353 de 353. No probado en navegador con datos reales.

## 4. Límites
- Órdenes Spot antiguas que no tengan ni `fechaProgramada` ni `fechaServicio` seguirán sin fecha (no se inventa).
- Los módulos se sirven con la caché de Hosting (hasta 1 h): tras desplegar, recargar con Ctrl+F5.

## 5. Despliegue y reversa
Solo Hosting del backoffice desde un clon limpio en el tag `ops-20`. Reversa: volver al tag `ops-19` y repetir el despliegue.
