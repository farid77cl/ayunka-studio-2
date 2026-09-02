/* Ayünka Studio · el estado del negocio y cómo se guarda.
 *
 * Reglas de esta capa, aprendidas a golpes en la versión anterior:
 *
 *  1. Una colección = una lista de fichas con `id` estable. El `id` NUNCA se reusa ni se
 *     renumera: en la app vieja los ids eran 7 caracteres al azar y con dos dispositivos
 *     chocaban. Aquí llevan fecha delante.
 *  2. Nada se borra de verdad: se marca `activo:false`. Lo borrado a mano no vuelve.
 *  3. `_v` es la versión del esquema. Las migraciones corren SIEMPRE que entren datos,
 *     vengan del disco o de la nube — nunca solo al abrir la página.
 */
(function () {
  const CLAVE = 'ayunka2-db';
  const ESQUEMA = 1;

  const COLECCIONES = ['productos', 'filamentos', 'clientes', 'pedidos', 'ventas',
                       'gastos', 'bandejas', 'cotizaciones', 'disenos3d', 'movimientos'];

  // id legible y ordenable: 2026-09-01T2143-a7f3
  function nuevoId(prefijo) {
    const d = new Date(), z = n => String(n).padStart(2, '0');
    const sello = `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}`;
    const azar = Math.random().toString(36).slice(2, 6);
    return (prefijo ? prefijo + '-' : '') + sello + '-' + azar;
  }

  function vacia() {
    const d = { _v: ESQUEMA, _actualizado: 0, _semilla: true, params: {} };
    COLECCIONES.forEach(c => d[c] = []);
    return d;
  }

  /* ---- migraciones ---------------------------------------------------------
     Cada una sube de una versión a la siguiente y tiene que poder correr dos veces
     sin romper nada. Se aplican a lo que venga del disco Y a lo que baje de la nube. */
  const MIGRACIONES = {
    // 0 → 1 : primera versión publicada. Solo rellena lo que falte.
    1: db => {
      COLECCIONES.forEach(c => { if (!Array.isArray(db[c])) db[c] = []; });
      if (!db.params || typeof db.params !== 'object') db.params = {};
      db.productos.forEach(p => {
        if (!('activo' in p)) p.activo = true;
        if (!('oficio' in p)) p.oficio = '3d';
        if (!('categoria' in p)) p.categoria = 'sin-categoria';
      });
    }
  };

  function migrar(db) {
    if (!db || typeof db !== 'object') return vacia();
    let desde = db._v || 0;
    for (let v = desde + 1; v <= ESQUEMA; v++) {
      try { MIGRACIONES[v] && MIGRACIONES[v](db); }
      catch (e) { console.error('Migración a v' + v + ' falló', e); }
    }
    db._v = ESQUEMA;
    COLECCIONES.forEach(c => { if (!Array.isArray(db[c])) db[c] = []; });
    if (!db.params) db.params = {};
    return db;
  }

  function leerDisco() {
    try {
      const crudo = localStorage.getItem(CLAVE);
      if (!crudo) return null;
      return migrar(JSON.parse(crudo));
    } catch (e) {
      console.error('No se pudo leer la base local', e);
      return null;
    }
  }

  function guardar(motivo) {
    DB._actualizado = Date.now();
    DB._semilla = false;
    try {
      localStorage.setItem(CLAVE, JSON.stringify(DB));
    } catch (e) {
      A.aviso('No se pudo guardar: el navegador está sin espacio.', 'error');
      return false;
    }
    if (window.Nube && Nube.guardarPronto) Nube.guardarPronto(motivo);
    document.dispatchEvent(new CustomEvent('db:cambio', { detail: { motivo } }));
    return true;
  }

  /* ---- respaldo FUERA del navegador ----------------------------------------
     La lección del 1-sep: la única copia de rescate vivía en el mismo localStorage
     que se acababa de pisar. Esto descarga un archivo de verdad, al disco. */
  function descargarRespaldo(sufijo) {
    try {
      const txt = JSON.stringify(DB, null, 1);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' }));
      const d = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
      a.download = `ayunka-respaldo-${d}${sufijo ? '-' + sufijo : ''}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      return true;
    } catch (e) { console.error(e); return false; }
  }

  async function cargarSemilla() {
    const r = await fetch('./datos/semilla.json', { cache: 'no-store' });
    const s = await r.json();
    const db = vacia();
    db.params = s.params || {};
    COLECCIONES.forEach(c => { if (Array.isArray(s[c])) db[c] = s[c]; });
    db._semilla = true;
    db._actualizado = 0;              // 0 = nunca editada por una persona
    return migrar(db);
  }

  function reemplazar(nueva, motivo) {
    const m = migrar(nueva);
    Object.keys(DB).forEach(k => delete DB[k]);
    Object.assign(DB, m);
    try { localStorage.setItem(CLAVE, JSON.stringify(DB)); } catch (e) {}
    document.dispatchEvent(new CustomEvent('db:cambio', { detail: { motivo, recarga: true } }));
  }

  // helpers de colección
  function obtener(col, id) { return (DB[col] || []).find(x => x.id === id) || null; }
  function agregar(col, ficha) {
    if (!ficha.id) ficha.id = nuevoId(col.slice(0, 3));
    DB[col].push(ficha);
    return ficha;
  }
  function quitar(col, id) {
    const f = obtener(col, id);
    if (f) f.activo = false;
    return f;
  }
  function activos(col) { return (DB[col] || []).filter(x => x.activo !== false); }

  const DB = vacia();
  window.DB = DB;
  window.Datos = {
    CLAVE, ESQUEMA, COLECCIONES,
    nuevoId, vacia, migrar, leerDisco, guardar, cargarSemilla, reemplazar,
    descargarRespaldo, obtener, agregar, quitar, activos,
    resumen: db => {
      const o = {};
      COLECCIONES.forEach(c => o[c] = (db[c] || []).length);
      return o;
    }
  };
})();
