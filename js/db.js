/* Ayünka Studio · el estado del negocio y cómo se guarda.
 *
 * Reglas de esta capa:
 *  1. Una colección = una lista de fichas con `id` estable. El `id` NUNCA se reusa ni se
 *     renumera -- llevan fecha delante para que además queden ordenables.
 *  2. Nada se borra de verdad: se marca `activo:false`.
 *  3. `_v` es la versión del esquema. Las migraciones corren SIEMPRE que entren datos,
 *     vengan del disco o de la nube -- nunca solo al abrir la página.
 */
(function () {
  const CLAVE = 'ayunka-db';
  const ESQUEMA = 1;

  const COLECCIONES = ['productos', 'filamentos', 'clientes', 'pedidos', 'ventas',
                       'gastos', 'bandejas', 'cotizaciones', 'disenos3d', 'movimientos'];

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

  const MIGRACIONES = {
    1: db => {
      COLECCIONES.forEach(c => { if (!Array.isArray(db[c])) db[c] = []; });
      if (!db.params || typeof db.params !== 'object') db.params = {};
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

  function descargarRespaldo(sufijo, datos) {
    try {
      const txt = JSON.stringify(datos || DB, null, 1);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' }));
      const d = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
      a.download = `ayunka-respaldo-${d}${sufijo ? '-' + sufijo : ''}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      return true;
    } catch (e) { console.error(e); return false; }
  }

  // Copia previa a la primera sincronizacion: vive dentro de la app (una sola, se reemplaza).
  // La escritura la hace nube.js (setItem). Nunca se descarga sola; en Ajustes la Ama decide si la baja.
  const CLAVE_COPIA = 'ayunka-db-antes-de-sincronizar';
  function armarCopiaPrevia(db) { return { fecha: new Date().toISOString(), db }; }
  function leerCopiaPrevia() {
    try { return JSON.parse(localStorage.getItem(CLAVE_COPIA) || 'null'); } catch (e) { return null; }
  }
  function descargarCopiaPrevia() {
    const cp = leerCopiaPrevia();
    return cp ? descargarRespaldo('antes-de-sincronizar', cp.db) : false;
  }

  // La semilla se revisa ANTES de cargarla: ids unicos, nombre en texto, listas donde van listas.
  function validarSemilla(s) {
    const errores = [];
    if (!s || typeof s !== 'object') return { ok: false, errores: ['la semilla no es un objeto'] };
    COLECCIONES.forEach(c => {
      if (s[c] !== undefined && !Array.isArray(s[c])) errores.push(`"${c}" debe ser una lista`);
    });
    ['productos', 'clientes', 'filamentos'].forEach(c => {
      if (!Array.isArray(s[c])) return;
      const vistos = new Set(), rep = new Set();
      s[c].forEach((x, i) => {
        if (!x || typeof x !== 'object') { errores.push(`${c}[${i}] no es una ficha`); return; }
        if (!x.id || typeof x.id !== 'string') errores.push(`${c}[${i}] sin id`);
        else if (vistos.has(x.id)) rep.add(x.id); else vistos.add(x.id);
        if (c === 'productos' && (!x.nombre || typeof x.nombre !== 'string')) errores.push(`${c}[${i}] (${x.id}) sin nombre de texto`);
      });
      rep.forEach(id => errores.push(`${c}: id repetido ${id}`));
    });
    return { ok: errores.length === 0, errores };
  }

  async function cargarSemilla() {
    const urls = ['/studio/datos/semilla.json', './datos/semilla.json', 'datos/semilla.json'];
    let s = null;
    for (const u of urls) {
      try {
        const r = await fetch(u, { cache: 'no-store' });
        if (r.ok) { s = await r.json(); break; }
      } catch (e) {}
    }
    if (!s) throw new Error('No se pudo encontrar semilla.json en ninguna ruta');
    const v = validarSemilla(s);
    if (!v.ok) throw new Error('La semilla no es válida, no se cargó: ' + v.errores.slice(0, 4).join('; '));
    const db = vacia();
    db.params = s.params || {};
    COLECCIONES.forEach(c => { if (Array.isArray(s[c])) db[c] = s[c]; });
    db._semilla = true;
    db._actualizado = 0;
    return migrar(db);
  }

  function reemplazar(nueva, motivo) {
    const m = migrar(nueva);
    Object.keys(DB).forEach(k => delete DB[k]);
    Object.assign(DB, m);
    try { localStorage.setItem(CLAVE, JSON.stringify(DB)); } catch (e) {}
    document.dispatchEvent(new CustomEvent('db:cambio', { detail: { motivo, recarga: true } }));
  }

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
    nuevoId, vacia, migrar, leerDisco, guardar, cargarSemilla, validarSemilla, reemplazar,
    descargarRespaldo, CLAVE_COPIA, armarCopiaPrevia, leerCopiaPrevia, descargarCopiaPrevia, obtener, agregar, quitar, activos,
    resumen: db => {
      const o = {};
      COLECCIONES.forEach(c => o[c] = (db[c] || []).length);
      return o;
    }
  };
})();
