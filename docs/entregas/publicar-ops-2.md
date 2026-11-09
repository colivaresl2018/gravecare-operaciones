# Publicar el backoffice — release `ops-2` (lo ejecuta el dueño)

> Reemplaza al release `ops-1` de B-1, que nunca se creó: B-2 fija el primer tag como `ops-2`.
> Objetivo único: **Hosting del sitio `gravecare-ops`**. Este repo no puede publicar reglas (`firebase.json` solo tiene `hosting`; lo comprueba `tests/firebase-json-sin-reglas.test.mjs`).

## 0. Antes (una vez integrada la rama)
1. PR `feat/b2-pagadas` → `main` con las pruebas en verde (`npm test`) y revisado por el dueño. Merge en GitHub.
2. Crear el tag sobre el commit de `main` ya integrado (desde la carpeta de trabajo, en PowerShell):
   ```powershell
   cd C:\Proyectos\GravecareOpsPortal
   git fetch origin
   git diff --stat origin/main feat/b2-pagadas     # vacío: main tiene exactamente lo revisado
   git tag -a ops-2 origin/main -m "ops-2: B-2 (N80, N83, N192, N193) y B-1 (N62, PRUEBA, entorno local)"
   git push origin ops-2
   ```
3. **Punto de reversa:** en la consola de Firebase → Hosting → sitio `gravecare-ops` → historial de versiones, anotar la versión vigente (fecha e ID).
   - Ojo (hallazgo BO-6): lo publicado hoy **no es este repo**, es una copia del `public/` de la web (`login-ops.html` e `index.html` idénticos a la web; `portal.html` y los módulos en 404). Confirma dónde trabaja hoy el staff antes de reemplazarlo.

## 1. Clon limpio y despliegue (PowerShell)
```powershell
git clone https://github.com/colivaresl2018/gravecare-operaciones.git C:\Despliegue\GravecareOps
cd C:\Despliegue\GravecareOps
git checkout ops-2
git status --short                                        # debe salir vacío
node -e "const c=require('./firebase.json');console.log(Object.keys(c), c.hosting.site)"   # [ 'hosting' ] gravecare-ops
firebase hosting:sites:list --project gravecare-2e8d2     # debe existir gravecare-ops
firebase hosting:channel:deploy ops-2-previa --only gravecare-ops --project gravecare-2e8d2 --expires 2d   # vista previa (opcional)
firebase deploy --only hosting:gravecare-ops --project gravecare-2e8d2
```
- El objetivo es `hosting:gravecare-ops` porque `firebase.json` declara `"site": "gravecare-ops"`. El target `operaciones` de `.firebaserc` **no aplica** (solo sirve si `firebase.json` usara `"target"`).
- `.firebaserc` no tiene `default`: sin `--project` la CLI se detiene.

## 2. Después: verificación por lectura
```powershell
node scripts/verificar-sitio-publicado.mjs ops-2      # 0 distintos y 0 errores
```
El script compara por huella cada archivo de `public/` del tag con lo servido por `https://gravecare-ops.web.app` (solo GET de archivos públicos). Luego, en el navegador: `https://gravecare-ops.web.app/` → login de operaciones; ingresar con un staff real y revisar Órdenes, Planificación y Gastos e Ingresos (el ingreso debe sumar solo las 5 órdenes `Confirmado`).

## 3. Reversa
Consola de Firebase → Hosting → `gravecare-ops` → historial → versión anotada en el paso 0.3 → **Revertir**. (Equivalente CLI: `firebase hosting:clone gravecare-ops:@<ID-de-versión> gravecare-ops:live --project gravecare-2e8d2`.) No afecta datos ni reglas.
