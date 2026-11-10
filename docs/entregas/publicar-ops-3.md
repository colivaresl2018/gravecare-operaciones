# Publicar el backoffice — release `ops-3` (notas de crédito, directriz B-3; lo ejecuta el dueño)

> Objetivo único: **Hosting del sitio `gravecare-ops`**. No se despliega nada más desde este repo. Mismo procedimiento que `ops-2` (`publicar-ops-2.md`).

## 0. Antes
1. **Regla de Firestore primero** (en el repo de la web): `docs/entregas/reglas-notasCredito.md`. Sin ella no se pueden guardar notas.
2. PR `feat/b3-notas-credito` → `main` con `npm test` en verde, revisado por el dueño. Merge en GitHub.
3. Crear el tag sobre el commit de `main` ya integrado (PowerShell):
   ```powershell
   cd C:\Proyectos\GravecareOpsPortal
   git fetch origin
   git diff --stat origin/main feat/b3-notas-credito     # vacío: main tiene exactamente lo revisado
   git tag -a ops-3 origin/main -m "ops-3: B-3 notas de crédito en Gastos e ingresos"
   git push origin ops-3
   ```
4. **Punto de reversa:** consola de Firebase → Hosting → sitio `gravecare-ops` → historial → anotar la versión vigente (la de `ops-2`): fecha e ID.

## 1. Clon limpio y despliegue (PowerShell)
```powershell
git clone https://github.com/colivaresl2018/gravecare-operaciones.git C:\Despliegue\GravecareOps
cd C:\Despliegue\GravecareOps
git checkout ops-3
git status --short                                        # debe salir vacío
node -e "const c=require('./firebase.json');console.log(Object.keys(c), c.hosting.site)"   # [ 'hosting' ] gravecare-ops
npm test                                                  # opcional: 100 % en verde
firebase hosting:channel:deploy ops-3-previa --only gravecare-ops --project gravecare-2e8d2 --expires 2d   # vista previa (opcional)
firebase deploy --only hosting:gravecare-ops --project gravecare-2e8d2
```
Siempre con `--only hosting:gravecare-ops` y `--project gravecare-2e8d2`.

## 2. Después: verificación
```powershell
node scripts/verificar-sitio-publicado.mjs ops-3      # 0 distintos y 0 errores
```
En el navegador (`https://gravecare-ops.web.app/`, con un staff real) → Gastos e ingresos:
- El libro carga igual que antes (mismos ingresos de las órdenes pagadas) y el tipo de documento ofrece «Nota de Crédito Electrónica».
- En la fila de una boleta aparece «Registrar nota de crédito». **Prueba segura con datos reales:** no registres una nota de verdad; verifica solo que el formulario se abre con la referencia pre-llenada y que el aviso de 6 meses aparece al poner una fecha lejana, y no pulses «Registrar».
- Si registras una nota real, anota que **no se puede editar ni borrar** (solo se anula con otra nota).

## 3. Reversa
1. Hosting: consola de Firebase → Hosting → `gravecare-ops` → historial → versión anotada en 0.4 → **Revertir** (CLI: `firebase hosting:clone gravecare-ops:@<ID-de-versión> gravecare-ops:live --project gravecare-2e8d2`). Vuelve el libro de `ops-2`, sin notas.
2. Datos: las notas ya guardadas permanecen en `notasCredito` (colección aditiva); `ops-2` no la lee y no afecta a ninguna otra colección. No hace falta borrarlas.
3. Regla: se puede dejar publicada (inocua) o quitarla desde el repo de la web.
