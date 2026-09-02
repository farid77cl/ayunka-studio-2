/* Ayünka Studio — Diseño 3D · texto a contornos.

   Usa opentype.js para leer TTF de verdad, no las typeface.json de Three: así hay
   cursivas (que es lo que pide un nombre en un letrero) y la ñ y los acentos salen
   bien, que en Chile no es opcional.

   Los TTF se guardan en IndexedDB la primera vez. Sin eso, al quedarse sin internet
   la app deja de poder escribir texto, y el texto es casi todo el producto.        */
(function () {
  'use strict';

  const CDN = 'https://cdn.jsdelivr.net/gh/google/fonts@main/';
  const OPENTYPE = 'https://cdn.jsdelivr.net/npm/opentype.js@1.3.4/dist/opentype.min.js';

  // Todas OFL/Apache: se pueden usar en productos que se venden.
  const FUENTES = [
    { id: 'poppins',    label: 'Poppins negrita',   grupo: 'Palo seco', file: 'ofl/poppins/Poppins-Bold.ttf' },
    { id: 'montserrat', label: 'Montserrat negrita',grupo: 'Palo seco', file: 'ofl/montserrat/Montserrat%5Bwght%5D.ttf' },
    { id: 'bebas',      label: 'Bebas (alta y fina)',grupo: 'Palo seco',file: 'ofl/bebasneue/BebasNeue-Regular.ttf' },
    { id: 'fredoka',    label: 'Fredoka redondeada',grupo: 'Redondeada',file: 'ofl/fredoka/Fredoka%5Bwdth,wght%5D.ttf' },
    { id: 'baloo',      label: 'Baloo gordita',     grupo: 'Redondeada',file: 'ofl/baloo2/Baloo2%5Bwght%5D.ttf' },
    { id: 'pacifico',   label: 'Pacifico',          grupo: 'Cursiva',   file: 'ofl/pacifico/Pacifico-Regular.ttf' },
    { id: 'dancing',    label: 'Dancing Script',    grupo: 'Cursiva',   file: 'ofl/dancingscript/DancingScript%5Bwght%5D.ttf' },
    { id: 'greatvibes', label: 'Great Vibes (fina)',grupo: 'Cursiva',   file: 'ofl/greatvibes/GreatVibes-Regular.ttf' },
    { id: 'lobster',    label: 'Lobster',           grupo: 'Cursiva',   file: 'ofl/lobster/Lobster-Regular.ttf' },
    { id: 'robotoslab', label: 'Roboto Slab',       grupo: 'Con serifa',file: 'apache/robotoslab/RobotoSlab%5Bwght%5D.ttf' },
    { id: 'playfair',   label: 'Playfair Display',  grupo: 'Con serifa',file: 'ofl/playfairdisplay/PlayfairDisplay%5Bwght%5D.ttf' },
    { id: 'luckiest',   label: 'Luckiest Guy',      grupo: 'Divertida', file: 'apache/luckiestguy/LuckiestGuy-Regular.ttf' },
    { id: 'titanone',   label: 'Titan One (gorda)', grupo: 'Divertida', file: 'ofl/titanone/TitanOne-Regular.ttf' },
    { id: 'righteous',  label: 'Righteous',         grupo: 'Divertida', file: 'ofl/righteous/Righteous-Regular.ttf' }
  ];
  const POR_DEFECTO = 'poppins';

  /* ---------- caché de archivos en IndexedDB ---------- */
  const DBN = 'ayunka-d3d-fuentes', STORE = 'ttf';
  let _db = null;
  function abrir() {
    return new Promise((res, rej) => {
      if (_db) return res(_db);
      if (!('indexedDB' in window)) return rej(new Error('no-idb'));
      const r = indexedDB.open(DBN, 1);
      r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE); };
      r.onsuccess = () => { _db = r.result; res(_db); };
      r.onerror = () => rej(r.error);
    });
  }
  async function guardado(id) {
    try {
      const db = await abrir();
      return await new Promise(res => { const r = db.transaction(STORE).objectStore(STORE).get(id); r.onsuccess = () => res(r.result || null); r.onerror = () => res(null); });
    } catch (e) { return null; }
  }
  async function guardar(id, buf) {
    try { const db = await abrir(); const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(buf, id); } catch (e) {}
  }

  /* ---------- carga ---------- */
  function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error(src)); document.head.appendChild(s); }); }
  async function ensureOpentype() { if (!window.opentype) await loadScript(OPENTYPE); if (!window.opentype) throw new Error('No se pudo cargar el lector de fuentes'); return window.opentype; }

  const cache = {};
  function def(id) { return FUENTES.find(f => f.id === id) || FUENTES.find(f => f.id === POR_DEFECTO); }

  async function cargar(id) {
    id = (def(id) || {}).id;
    if (cache[id]) return cache[id];
    const ot = await ensureOpentype();
    let buf = await guardado(id);
    if (!buf) {
      const r = await fetch(CDN + def(id).file);
      if (!r.ok) throw new Error('No se pudo descargar la fuente ' + def(id).label);
      buf = await r.arrayBuffer();
      guardar(id, buf);
    }
    const font = ot.parse(buf.slice(0)); // slice: opentype se queda con el buffer y romperia el cacheado
    cache[id] = font;
    return font;
  }
  function cargada(id) { return !!cache[(def(id) || {}).id]; }

  /* ---------- comandos de opentype → contornos ---------- */
  function aplanar(commands, tol) {
    const contornos = [];
    let act = null, cx = 0, cy = 0;
    const push = (x, y) => { act.push([x, y]); cx = x; cy = y; };
    const pasos = (len) => Math.max(2, Math.min(48, Math.ceil(len / tol)));

    for (const c of commands) {
      if (c.type === 'M') { if (act && act.length >= 3) contornos.push(act); act = []; push(c.x, c.y); }
      else if (!act) continue;
      else if (c.type === 'L') push(c.x, c.y);
      else if (c.type === 'Q') {
        const n = pasos(Math.hypot(c.x1 - cx, c.y1 - cy) + Math.hypot(c.x - c.x1, c.y - c.y1));
        const x0 = cx, y0 = cy;
        for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t;
          push(u * u * x0 + 2 * u * t * c.x1 + t * t * c.x, u * u * y0 + 2 * u * t * c.y1 + t * t * c.y); }
      }
      else if (c.type === 'C') {
        const n = pasos(Math.hypot(c.x1 - cx, c.y1 - cy) + Math.hypot(c.x2 - c.x1, c.y2 - c.y1) + Math.hypot(c.x - c.x2, c.y - c.y2));
        const x0 = cx, y0 = cy;
        for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t;
          push(u*u*u*x0 + 3*u*u*t*c.x1 + 3*u*t*t*c.x2 + t*t*t*c.x, u*u*u*y0 + 3*u*u*t*c.y1 + 3*u*t*t*c.y2 + t*t*t*c.y); }
      }
      else if (c.type === 'Z') { if (act.length >= 3) contornos.push(act); act = null; }
    }
    if (act && act.length >= 3) contornos.push(act);
    return contornos;
  }

  /* Devuelve las figuras (en mm) de un texto de una o varias líneas.
     `mm` es la altura nominal de la letra; alineación izquierda/centro/derecha.
     El resultado queda centrado en el origen para que encaje con el resto del motor. */
  async function contornos(texto, opts) {
    opts = opts || {};
    const font = await cargar(opts.fuente);
    const G = window.D3DFormas;
    const mm = +opts.mm || 10;
    const lineas = String(texto == null ? '' : texto).split('\n');
    const interlinea = (opts.interlinea != null ? +opts.interlinea : 1.25) * mm;
    const espaciado = (+opts.espaciado || 0);   // tracking extra en mm
    const align = opts.align || 'centro';

    // opentype trabaja en unidades de la fuente; se pide el path a `mm` de tamaño y
    // sale ya en milímetros, con la línea base en y=0 y la Y hacia abajo.
    const porLinea = lineas.map(linea => {
      let cmds = [];
      if (espaciado) {
        // con tracking hay que ir letra por letra: getPath no expone separación
        let x = 0;
        for (const ch of Array.from(linea)) {
          const p = font.getPath(ch, x, 0, mm);
          cmds = cmds.concat(p.commands);
          x += font.getAdvanceWidth(ch, mm) + espaciado;
        }
        return { cmds, ancho: Math.max(0, x - espaciado) };
      }
      const p = font.getPath(linea, 0, 0, mm);
      return { cmds: p.commands, ancho: font.getAdvanceWidth(linea, mm) };
    });

    const anchoMax = Math.max(0, ...porLinea.map(l => l.ancho));
    const tol = Math.max(0.05, mm * 0.012); // ~1% del tamaño: suave sin inflar el STL
    let todos = [];
    porLinea.forEach((l, i) => {
      const dx = align === 'izquierda' ? 0 : align === 'derecha' ? (anchoMax - l.ancho) : (anchoMax - l.ancho) / 2;
      const dy = i * interlinea;
      // Y invertida: en la fuente crece hacia abajo, en el modelo hacia arriba.
      aplanar(l.cmds, tol).forEach(c => todos.push(c.map(p => [p[0] + dx, -(p[1] + dy)])));
    });
    if (!todos.length) return [];
    return G.centrar(G.anidar(todos));
  }

  function lista() { return FUENTES.map(f => ({ id: f.id, label: f.label, grupo: f.grupo })); }
  function grupos() {
    const g = {};
    for (const f of FUENTES) (g[f.grupo] = g[f.grupo] || []).push({ id: f.id, label: f.label });
    return g;
  }

  window.D3DFuentes = { lista, grupos, cargar, cargada, contornos, POR_DEFECTO, FUENTES };
})();
