# Entorno local del backoffice (directriz B-1)

El backoffice no tiene emuladores propios: usa los del repo de la web (`C:\Proyectos\Gravecare`), siempre con el proyecto **`demo-gravecare`** (nunca uno real). Nada de esto se publica (vive fuera de `public/`).

## Para el dueño (tus emuladores, sin desplazamiento)
1. En el repo de la web: `npm run local` (abre los emuladores en sus puertos por defecto).
2. En este repo (otra terminal de PowerShell):
   ```powershell
   cd C:\Proyectos\GravecareOpsPortal
   npm install                # solo la primera vez (Playwright, dependencia de desarrollo)
   node scripts/local/sembrar-emulador.mjs     # opcional: staff de prueba y 14 órdenes ficticias
   node scripts/local/servidor-emuladores.mjs
   ```
3. Abre `http://localhost:5050/login-ops.html` e ingresa con el usuario de prueba de `STAFF_PRUEBA` (en `scripts/local/sembrar-emulador.mjs`; solo existe en el emulador).

> Nota: hoy `npm run local` de la web se niega a arrancar si existe `functions/.env` en esa carpeta (N67/N120). En ese caso usa un clon limpio de la web o, solo para el backoffice, los emuladores de Auth/Firestore/Storage sin funciones (ver «Pruebas automáticas»).

## Pruebas automáticas (puertos desplazados, sin tocar los del dueño)
Con `GC_OFFSET=800` los puertos son: sitio del backoffice 5850, Firestore 8880, Auth 9899, Storage 9999.
```powershell
# 1) Emuladores de la web con +800 (desde un clon limpio de la web):
$env:GC_OFFSET=800; npm run local
# 2) En este repo:
$env:GC_OFFSET=800
node scripts/local/sembrar-emulador.mjs
node scripts/local/servidor-emuladores.mjs      # deja esta terminal abierta
npm run test:e2e                                # en otra terminal, con $env:GC_OFFSET=800
```
Alternativa usada el 2026-11-08 (porque la carpeta de la web tenía `functions/.env`): `firebase emulators:start --only auth,firestore,storage --project demo-gravecare` desde una carpeta temporal con un `firebase.json` de puertos +800 y **copias de las reglas publicadas** (`firestore.rules`/`storage.rules` de la rama `docs/ventana-cierre-2` de la web).

## Cómo funciona `servidor-emuladores.mjs`
- Sirve `public/` en `127.0.0.1` con las mismas reescrituras de `firebase.json`.
- Al servir `.html`/`.js` cambia los módulos del SDK de gstatic por envoltorios locales que fuerzan `demo-gravecare` y conectan Auth, Firestore y Storage a los emuladores; Analytics queda inerte. **Las páginas no se modifican**; en Hosting real este servidor no existe, así que no hay nada que desactivar.
- La prueba de navegador comprueba además que ninguna petición sale a servicios reales de Firebase.

## Prueba de navegador de B-3 (notas de crédito)
Usa un `GC_OFFSET` propio (> 0; la prueba se niega con 0), p. ej. 1300: sitio 6350, Firestore 9380, Auth 10399, Storage 10499. Los emuladores deben cargar las reglas de la web **más** la regla aditiva de `docs/entregas/reglas-notasCredito.md`; con las reglas publicadas de la web sin ella, las notas se rechazan.
```powershell
$env:GC_OFFSET=1300
node scripts/local/sembrar-emulador.mjs
node scripts/local/servidor-emuladores.mjs      # deja esta terminal abierta
npm run test:e2e:b3                             # en otra terminal, con $env:GC_OFFSET=1300
```
Es repetible: antes de empezar borra las notas del emulador (con el token «owner», que solo existe en los emuladores).
