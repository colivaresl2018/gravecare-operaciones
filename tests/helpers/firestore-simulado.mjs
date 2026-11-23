/**
 * firestore-simulado.mjs — Firestore en memoria para las pruebas de escrituras (spec 057).
 *
 * Igual que el simulador de ordenes-compra-db.test.mjs: transacciones optimistas (si otra transacción escribió lo que se leyó,
 * se reintenta), lectura obligatoria antes de escribir y ningún borrado. Las rutas son «coleccion/id».
 * No es un módulo de la app: vive en tests/ y no se sirve con el sitio.
 */
export function simuladorFirestore({ inicial = {} } = {}) {
  const almacen = new Map(Object.entries(inicial));
  const version = new Map();
  const escrituras = [];
  let generados = 0;
  const ref = (path) => ({ path, id: path.split('/').pop() });
  const ver = (path) => version.get(path) || 0;

  const refs = {
    ref,
    /** Id generado por Firestore (para documentos nuevos). Cada llamada da un id distinto. */
    nuevoId: (coleccion) => { generados += 1; return ref(`${coleccion}/auto-${generados}`); },
  };

  async function ejecutarTransaccion(fn) {
    for (let intento = 0; intento < 20; intento += 1) {
      const leidos = new Map();
      const pendientes = [];
      let escribio = false;
      const tx = {
        async get(r) {
          if (escribio) throw new Error('Firestore exige leer antes de escribir en una transacción');
          leidos.set(r.path, ver(r.path));
          await Promise.resolve(); // punto de intercalado entre transacciones concurrentes
          const dato = almacen.get(r.path);
          return {
            exists: () => dato !== undefined,
            data: () => (dato === undefined ? undefined : JSON.parse(JSON.stringify(dato))),
          };
        },
        set(r, datos) { escribio = true; pendientes.push({ tipo: 'set', r, datos }); },
        update(r, datos) { escribio = true; pendientes.push({ tipo: 'update', r, datos }); },
      };
      const resultado = await fn(tx);
      if ([...leidos].some(([path, v]) => ver(path) !== v)) continue; // conflicto: se reintenta
      for (const p of pendientes) {
        if (p.tipo === 'update' && !almacen.has(p.r.path)) throw new Error('update de un documento que no existe');
        almacen.set(
          p.r.path,
          p.tipo === 'set'
            ? JSON.parse(JSON.stringify(p.datos))
            : { ...almacen.get(p.r.path), ...JSON.parse(JSON.stringify(p.datos)) },
        );
        version.set(p.r.path, ver(p.r.path) + 1);
        escrituras.push({ tipo: p.tipo, path: p.r.path, datos: p.datos });
      }
      return resultado;
    }
    throw new Error('demasiados reintentos');
  }

  return { almacen, escrituras, refs, ejecutarTransaccion };
}
