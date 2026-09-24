/* Ayünka Studio — motor de plantillas (formato plantilla/1, ver
 * docs/superpowers/specs/2026-09-24-plantillas-simples-design.md).
 *
 * La parte FIJA de una plantilla viene hecha en el JSON (exportada desde Python). Aquí
 * solo se calcula lo variable: el texto ajustado a su zona y el QR del teléfono. Sin DOM:
 * se prueba en Node (tests/plantillas.test.js).
 *
 * Geometría: figuras [{ outer:[[x,y]...], holes:[[[x,y]...]] }] en mm. Las operaciones
 * booleanas y los offsets van con Clipper (enteros a 0,1 micra, la misma precisión con
 * que se escribe el 3MF). Las reglas de trazo y rendija son las del generador Python
 * (generar_mochila.py): mismos números, misma forma de medir. */
(function () {
  'use strict';
  const S = 1e4;                      // 1 unidad Clipper = 0,1 micra
  const CL = () => window.ClipperLib;

  // ---------------------------------------------------------------- geometría
  function anillo(pts) { return pts.map(p => ({ X: Math.round(p[0] * S), Y: Math.round(p[1] * S) })); }
  function aPaths(figs) {
    const out = [];
    for (const f of figs || []) {
      const o = anillo(f.outer);
      if (!CL().Clipper.Orientation(o)) o.reverse();
      out.push(o);
      for (const h of f.holes || []) {
        const r = anillo(h);
        if (CL().Clipper.Orientation(r)) r.reverse();
        out.push(r);
      }
    }
    return out;
  }
  function deArbol(arbol) {
    const figs = [];
    const pts = c => c.map(p => [p.X / S, p.Y / S]);
    const visitar = nodo => {
      for (const n of nodo.Childs()) {
        if (n.IsHole()) continue;
        if (n.Contour().length < 3) continue;
        figs.push({ outer: pts(n.Contour()), holes: n.Childs().filter(h => h.Contour().length >= 3).map(h => pts(h.Contour())) });
        for (const h of n.Childs()) visitar(h);
      }
    };
    visitar(arbol);
    return figs;
  }
  function operar(tipo, a, b) {
    const c = new (CL().Clipper)();
    c.StrictlySimple = true;
    c.AddPaths(aPaths(a), CL().PolyType.ptSubject, true);
    if (b) c.AddPaths(aPaths(b), CL().PolyType.ptClip, true);
    const t = new (CL().PolyTree)();
    c.Execute(tipo, t, CL().PolyFillType.pftNonZero, CL().PolyFillType.pftNonZero);
    return deArbol(t);
  }
  const union = (a, b) => operar(CL().ClipType.ctUnion, a, b || []);
  const diferencia = (a, b) => operar(CL().ClipType.ctDifference, a, b);
  const interseccion = (a, b) => operar(CL().ClipType.ctIntersection, a, b);
  function offset(figs, d) {
    if (!figs.length) return [];
    const o = new (CL().ClipperOffset)(2, 0.01 * S);   // 0,01 mm: bajo el simplify 0,012 del Python
    o.AddPaths(aPaths(figs), CL().JoinType.jtRound, CL().EndType.etClosedPolygon);
    const t = new (CL().PolyTree)();
    o.Execute(t, d * S);
    return deArbol(t);
  }
  function areaAnillo(a) {
    let s = 0;
    for (let i = 0, j = a.length - 1; i < a.length; j = i++) s += (a[j][0] + a[i][0]) * (a[j][1] - a[i][1]);
    return Math.abs(s / 2);
  }
  function area(figs) {
    return (figs || []).reduce((t, f) => t + areaAnillo(f.outer) - (f.holes || []).reduce((u, h) => u + areaAnillo(h), 0), 0);
  }
  function bbox(figs) {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const f of figs) for (const p of f.outer) {
      if (p[0] < x1) x1 = p[0]; if (p[0] > x2) x2 = p[0];
      if (p[1] < y1) y1 = p[1]; if (p[1] > y2) y2 = p[1];
    }
    return { x1, y1, x2, y2 };
  }
  function mover(figs, dx, dy) {
    const m = r => r.map(p => [p[0] + dx, p[1] + dy]);
    return figs.map(f => ({ outer: m(f.outer), holes: (f.holes || []).map(m) }));
  }
  /** Fracción del área que se pierde al abrir con un disco de 0,62 mm (perdida_fina del Python). */
  function perdidaFina(figs, r) {
    r = r || 0.31;
    const a = area(figs);
    if (a <= 0) return 0;
    const abierta = offset(offset(figs, -r), r + 0.005);
    return Math.max(0, 1 - area(interseccion(abierta, figs)) / a);
  }
  /** ¿El trazo MÁS grueso mide al menos w? (ancho_local del skill >= w: offset(-w/2) no vacío). */
  function anchoAlMenos(figs, w) { return area(offset(figs, -w / 2 + 1e-4)) > 1e-8; }
  function distPuntoSeg(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const l = dx * dx + dy * dy;
    let t = l ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l : 0;
    t = Math.max(0, Math.min(1, t));
    const x = a[0] + t * dx - p[0], y = a[1] + t * dy - p[1];
    return Math.sqrt(x * x + y * y);
  }
  const anillosDe = figs => figs.reduce((t, f) => t.concat([f.outer], f.holes || []), []);
  /** Distancia mínima entre dos conjuntos de figuras disjuntos (borde contra borde). */
  function distancia(a, b) {
    let d = Infinity;
    const ra = anillosDe(a), rb = anillosDe(b);
    for (const [x, y] of [[ra, rb], [rb, ra]]) {
      for (const r1 of x) for (const p of r1) for (const r2 of y) {
        for (let i = 0, j = r2.length - 1; i < r2.length; j = i++) {
          const v = distPuntoSeg(p, r2[j], r2[i]);
          if (v < d) d = v;
        }
      }
    }
    return d;
  }
  function separadosPorBbox(a, b, m) {
    const A = bbox(a), B = bbox(b);
    return A.x1 - B.x2 >= m || B.x1 - A.x2 >= m || A.y1 - B.y2 >= m || B.y1 - A.y2 >= m;
  }
  /** ¿Todas las rendijas entre piezas miden al menos `minimo`? (_peor_rendija >= minimo).
   *  Si al inflar cada pieza minimo/2 dos se funden, hay una rendija más angosta. */
  function rendijaOk(piezas, minimo) { return offset(piezas, minimo / 2 - 1e-4).length === piezas.length; }

  // ---------------------------------------------------------------- errores para la usuaria
  function errorUsuario(msg, campo) { return Object.assign(new Error(msg), { usuario: true, campo }); }

  // ---------------------------------------------------------------- texto
  const fuentes = {};
  async function fuente(ruta, cargarBytes) {
    if (!fuentes[ruta]) fuentes[ruta] = cargarBytes(ruta).then(b => window.opentype.parse(b));
    return fuentes[ruta];
  }
  async function bytesPorFetch(ruta) {
    const r = await fetch(ruta);
    if (!r.ok) throw new Error('No pude cargar ' + ruta + ' (' + r.status + ')');
    return r.arrayBuffer();
  }

  /** Anillos del texto en mm, línea base en y=0, borde izquierdo en x=0. `cap` es la altura
   *  de la mayúscula (como texto.py). Sin kerning, igual que el Python. */
  function anillosTexto(f, cadena, cap, tracking) {
    const s = cap / f.tables.os2.sCapHeight;
    const anillos = [];
    let x = 0;
    for (const ch of cadena) {
      const g = f.charToGlyph(ch);
      if (ch !== ' ' && (!g || g.index === 0)) throw errorUsuario('La letra «' + ch + '» no está en la fuente.');
      if (ch !== ' ') {
        let act = [], px = 0, py = 0;
        const pt = (u, v) => [x + u * s, -v * s];
        const pasos = (x0, y0, x1, y1) => Math.max(4, Math.min(32, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * s / 0.12)));
        for (const c of g.getPath(0, 0, f.unitsPerEm).commands) {
          if (c.type === 'M') { if (act.length > 2) anillos.push(act); act = [pt(c.x, c.y)]; }
          else if (c.type === 'L') act.push(pt(c.x, c.y));
          else if (c.type === 'Q') {
            const n = pasos(px, py, c.x, c.y);
            for (let i = 1; i <= n; i++) {
              const t = i / n, m = 1 - t;
              act.push(pt(m * m * px + 2 * m * t * c.x1 + t * t * c.x, m * m * py + 2 * m * t * c.y1 + t * t * c.y));
            }
          } else if (c.type === 'C') {
            const n = pasos(px, py, c.x, c.y);
            for (let i = 1; i <= n; i++) {
              const t = i / n, m = 1 - t;
              act.push(pt(m * m * m * px + 3 * m * m * t * c.x1 + 3 * m * t * t * c.x2 + t * t * t * c.x,
                m * m * m * py + 3 * m * m * t * c.y1 + 3 * m * t * t * c.y2 + t * t * t * c.y));
            }
          } else if (c.type === 'Z') { if (act.length > 2) anillos.push(act); act = []; }
          if (c.type !== 'Z') { px = c.x; py = c.y; }
        }
        if (act.length > 2) anillos.push(act);
      }
      x += g.advanceWidth * s + tracking;
    }
    return anillos;
  }
  /** Anillos con cualquier orientación -> figuras limpias, por regla NonZero (TrueType). */
  function figurasDeAnillos(anillos) {
    const c = new (CL().Clipper)();
    c.StrictlySimple = true;
    c.AddPaths(anillos.map(anillo), CL().PolyType.ptSubject, true);
    const t = new (CL().PolyTree)();
    c.Execute(CL().ClipType.ctUnion, t, CL().PolyFillType.pftNonZero, CL().PolyFillType.pftNonZero);
    return deArbol(t);
  }

  /** Engrosa una pieza hasta que un disco de 0,62 no le coma más de `tope` (_sin_tramos_finos),
   *  y antes, si su trazo más grueso no llega al mínimo, la lleva a `objetivo` (engrosar_finos). */
  function engrosar(pieza, p) {
    let q = [pieza];
    if (!anchoAlMenos(q, p.trazoMin)) {
      for (let d = 0.02; d <= 0.4 && !anchoAlMenos(q, p.rendijaMin); d += 0.02) q = offset([pieza], d);
    }
    const base = q;
    for (let d = 0.01; perdidaFina(q) > 0.05 && d <= 0.25 + 1e-9; d += 0.01) q = offset(base, d);
    return q;
  }
  /** Tildes y virgulillas: se suben hasta dejar la rendija mínima con su letra (_subir_marcas). */
  function subirMarcas(piezas, cap, minimo) {
    const esMarca = f => { const b = bbox([f]); return b.y1 > 0.6 * cap && b.y2 > 1.02 * cap; };
    const letras = piezas.filter(f => !esMarca(f));
    const out = letras.slice();
    for (let m of piezas.filter(esMarca)) {
      for (let i = 0; i < 60; i++) {
        const cerca = letras.filter(l => !separadosPorBbox([l], [m], minimo));
        const d = cerca.length ? Math.min(...cerca.map(l => distancia([l], [m]))) : Infinity;
        if (d >= minimo) break;
        m = mover([m], 0, minimo - d + 0.01)[0];
      }
      out.push(m);
    }
    return out;
  }
  /** Una línea de texto imprimible a un cap dado (linea_texto del Python). */
  // Cada letra se engrosa una sola vez por fuente y cap: el tracking solo la mueve.
  const cacheLetras = new WeakMap();
  function letra(f, ch, cap, p) {
    if (!cacheLetras.has(f)) cacheLetras.set(f, new Map());
    const c = cacheLetras.get(f), k = ch + '|' + cap.toFixed(4) + '|' + p.trazoMin + '|' + p.rendijaMin;
    if (!c.has(k)) {
      let piezas = [];
      for (const pz of figurasDeAnillos(anillosTexto(f, ch, cap, 0))) piezas = piezas.concat(engrosar(pz, p));
      c.set(k, { piezas, avance: f.charToGlyph(ch).advanceWidth * cap / f.tables.os2.sCapHeight });
    }
    return c.get(k);
  }
  function lineaTexto(f, cadena, cap, p) {
    let trk = (p.tracking || 0) * cap;
    for (let i = 0; i < 30; i++) {
      let piezas = [], x = 0;
      for (const ch of cadena) {
        const l = letra(f, ch, cap, p);
        if (l.piezas.length) piezas = piezas.concat(mover(l.piezas, x, 0));
        x += l.avance + trk;
      }
      piezas = union(subirMarcas(piezas, cap, p.rendijaMin));
      if (rendijaOk(piezas, p.rendijaMin)) return piezas;
      trk += 0.04;
    }
    return null;
  }
  function dentroDe(figs, zona) { return area(diferencia(figs, zona)) < 1e-4; }

  /** El cap más grande cuya línea (más el halo del borde) cabe en la zona (ajustar del Python). */
  function ajustar(f, cadena, p) {
    const zona = p.zona, zb = bbox(zona), cy = (zb.y1 + zb.y2) / 2;
    const halo = (p.borde && p.borde.mm) || 0;
    let cap = p.capMax;
    while (cap >= p.capMin - 1e-9) {
      let g = lineaTexto(f, cadena, cap, p);
      if (!g) { cap -= 0.1; continue; }
      const b = bbox(g);
      g = mover(g, -(b.x1 + b.x2) / 2, cy - (b.y1 + b.y2) / 2);
      if (dentroDe(halo ? offset(g, halo) : g, zona)) {
        if (Math.max(...g.map(q => perdidaFina([q]))) <= p.perdidaMax) return { figs: g, cap };
        return null;
      }
      const w = b.x2 - b.x1, h = b.y2 - b.y1;
      const k = Math.min((zb.x2 - zb.x1 - 2 * halo) / w, (zb.y2 - zb.y1 - 2 * halo) / h);
      cap = k < 0.97 ? Math.min(cap - 0.1, Math.max(p.capMin, cap * k)) : cap - 0.1;
      cap = Math.round(cap * 1e6) / 1e6;
    }
    return null;
  }

  /** Ojos de letra y borde tipo sticker. Devuelve { letras, borde }. */
  function ojosYBorde(g, p) {
    const ojoMin = p.ojoMin || 0;
    const letras = union(g.map(f => ({ outer: f.outer, holes: (f.holes || []).filter(h => anchoAlMenos([{ outer: h, holes: [] }], ojoMin)) })));
    if (!p.borde) return { letras, borde: [] };
    let sticker = offset(letras, p.borde.mm);
    sticker = sticker.map(f => ({ outer: f.outer, holes: (f.holes || []).filter(h => area(offset([{ outer: h, holes: [] }], -0.5)) > 1.0) }));
    return { letras, borde: diferencia(sticker, letras) };
  }

  async function textoParam(p, valor, cargarBytes) {
    let t = String(valor == null ? '' : valor).replace(/\s+/g, ' ').trim();
    if (p.mayusculas) t = t.toLocaleUpperCase('es-CL');
    if (!t) throw errorUsuario('Escribe el ' + p.etiqueta.toLowerCase() + '.', p.id);
    if (p.maxLargo && t.length > p.maxLargo) throw errorUsuario('Máximo ' + p.maxLargo + ' letras.', p.id);
    const fs = await Promise.all(p.fuentes.map(r => fuente(r, cargarBytes)));
    for (const f of fs) for (const ch of t) {
      if (ch !== ' ' && f.charToGlyph(ch).index === 0) throw errorUsuario('La letra «' + ch + '» no está en la fuente.', p.id);
    }
    const r = fs.map(f => ajustar(f, t, p));
    // la primera fuente manda; la siguiente solo si gana más de un 15 % de altura
    let elegida = -1;
    const pref = p.preferirPrimeraHasta || 0.85;
    if (r[0] && (!r[1] || r[0].cap >= pref * r[1].cap)) elegida = 0;
    else if (r[1]) elegida = 1;
    if (elegida < 0) {
      throw errorUsuario('«' + t + '» no cabe ni con letra condensada de ' + String(p.capMin).replace('.', ',') +
        ' mm. Acórtalo (iniciales, sin segundo nombre).', p.id);
    }
    const { letras, borde } = ojosYBorde(r[elegida].figs, p);
    return { texto: t, cap: Math.round(r[elegida].cap * 10) / 10, fuente: elegida, letras, borde };
  }

  // ---------------------------------------------------------------- teléfono y QR
  function normalizarTelefono(s, patron) {
    const t = String(s == null ? '' : s).replace(/[\s\-().]/g, '');
    return new RegExp(patron || '^\\+569\\d{8}$').test(t) ? t : null;
  }
  function qrFiguras(q, carga) {
    if (q.modulo < 1.1) throw new Error('Plantilla mal hecha: módulo de QR bajo 1,1 mm.');
    if (!/^[MQH]$/.test(q.ec)) throw new Error('Plantilla mal hecha: corrección de QR bajo M.');
    const qr = window.qrcode(q.version, q.ec);
    qr.addData(carga, 'Byte');
    try { qr.make(); } catch (e) { throw errorUsuario('El dato no cabe en el QR.'); }
    const n = qr.getModuleCount(), m = q.modulo, sil = q.silencio;
    if (q.modulos && n !== q.modulos) throw new Error('QR de ' + n + ' módulos, la plantilla espera ' + q.modulos);
    const L = (n + 2 * sil) * m, cx = q.centro[0], cy = q.centro[1];
    const osc = (i, j) => qr.isDark(i, j);
    const figs = [];
    const caja = (x, y) => ({ outer: [[x, y], [x + m, y], [x + m, y + m], [x, y + m]], holes: [] });
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (osc(i, j)) figs.push(caja(cx + (j + sil) * m - L / 2, cy + L / 2 - (i + sil + 1) * m));
    }
    // dos módulos oscuros que se tocan solo por la esquina: se sueldan con un rombo
    const a = q.soldadura || 0;
    if (a) for (let i = 0; i < n - 1; i++) for (let j = 0; j < n - 1; j++) {
      const d1 = osc(i, j) && osc(i + 1, j + 1) && !osc(i, j + 1) && !osc(i + 1, j);
      const d2 = osc(i, j + 1) && osc(i + 1, j) && !osc(i, j) && !osc(i + 1, j + 1);
      if (d1 || d2) {
        const x = cx + (j + sil + 1) * m - L / 2, y = cy + L / 2 - (i + sil + 1) * m;
        figs.push({ outer: [[x - a, y], [x, y - a], [x + a, y], [x, y + a]], holes: [] });
      }
    }
    return { figs: union(figs), info: { modulos: n, modulo: m, lado: L, version: q.version, ec: q.ec } };
  }

  // ---------------------------------------------------------------- componer
  /** Lo que cada parámetro deja activo (para soloSi / figsSi). */
  function activos(plantilla, valores) {
    const a = {};
    for (const p of plantilla.parametros || []) {
      const v = valores[p.id];
      if (p.tipo === 'interruptor') a[p.id] = !!v;
      else if (p.tipo === 'telefono-qr') a[p.id] = !!String(v == null ? '' : v).trim();
      else a[p.id] = v != null && String(v).trim() !== '';
    }
    return a;
  }

  async function componer(plantilla, varianteId, valores, opts) {
    opts = opts || {};
    valores = valores || {};
    const cargarBytes = opts.cargarBytes || bytesPorFetch;
    const variante = plantilla.variantes.find(v => v.id === varianteId) || plantilla.variantes[0];
    const colores = Object.assign({}, variante.colores);
    const act = activos(plantilla, valores);
    const extra = {}, info = {}, avisos = [], faltan = [];
    const sumar = (id, figs) => { extra[id] = (extra[id] || []).concat(figs); };

    for (const p of plantilla.parametros || []) {
      const v = valores[p.id];
      if (p.tipo === 'texto') {
        if (!act[p.id] && (!p.requerido || opts.borrador)) { if (p.requerido) faltan.push(p.id); continue; }
        const r = await textoParam(p, v, cargarBytes);
        sumar(p.pieza, r.letras);
        if (p.borde) sumar(p.borde.pieza, r.borde);
        info[p.id] = { texto: r.texto, cap: r.cap, fuente: r.fuente, fuenteArchivo: p.fuentes[r.fuente] };
      } else if (p.tipo === 'telefono-qr') {
        if (!act[p.id]) continue;
        const tel = normalizarTelefono(v, p.patron);
        if (!tel) throw errorUsuario('El teléfono debe ser un celular chileno: +569 y 8 dígitos.', p.id);
        const q = qrFiguras(p.qr, (p.prefijo || '') + tel);
        sumar(p.pieza, q.figs);
        info[p.id] = Object.assign({ telefono: tel, carga: (p.prefijo || '') + tel }, q.info);
      } else if (p.tipo === 'color') {
        const op = (p.opciones || []).find(o => o.hex === v);
        if (op) colores[p.rol] = op.hex;
      }
    }

    const orden = plantilla.ordenRoles || Object.keys(variante.colores);
    const filamentos = [];
    for (const rol of orden) if (colores[rol] && !filamentos.includes(colores[rol])) filamentos.push(colores[rol]);
    if (filamentos.length !== variante.filamentos.length) {
      throw errorUsuario('Esa combinación de colores cambia la cantidad de carretes (' + filamentos.length +
        ' en vez de ' + variante.filamentos.length + '); elige otra.');
    }
    const nombreColor = hex => (plantilla.nombresColor || {})[hex] || hex;

    const piezas = [];
    for (const pz of plantilla.piezas) {
      if (pz.soloSi && !act[pz.soloSi]) continue;
      let figs = pz.figs || [];
      for (const [k, alt] of Object.entries(pz.figsSi || {})) if (act[k]) figs = alt;
      if (extra[pz.id]) figs = union(figs.concat(extra[pz.id]));
      const negativo = pz.subtipo === 'negative_part';
      const color = negativo ? null : colores[pz.rol];
      piezas.push({
        id: pz.id, subtipo: pz.subtipo || 'normal_part', rol: pz.rol || null, color,
        nombre: (pz.nombre || pz.id).replace('{color}', color ? nombreColor(color) : ''),
        extrusor: negativo ? 0 : filamentos.indexOf(color) + 1,
        z: pz.z.slice(), espejoX: !!pz.espejoX, figs
      });
    }
    if (!piezas.length || piezas[piezas.length - 1].subtipo !== 'normal_part' &&
        piezas.slice(0, -1).some(p => p.subtipo === 'negative_part')) {
      throw new Error('Plantilla mal hecha: el negative_part tiene que ir último.');
    }
    return { plantilla: plantilla.id, variante: variante.id, colores, filamentos, piezas, info, avisos, faltan };
  }

  /** Paleta de carretes para la ayuda: filamento N -> color y para qué se usa. */
  function paletaCarretes(plantilla, compuesto) {
    const nombreColor = hex => (plantilla.nombresColor || {})[hex] || hex;
    return compuesto.filamentos.map((hex, i) => ({
      n: i + 1, hex, nombre: nombreColor(hex),
      usos: compuesto.piezas.filter(p => p.extrusor === i + 1).map(p => p.nombre.replace(/\s*\(.*\)$/, ''))
    }));
  }

  window.Plantillas = {
    componer, paletaCarretes, normalizarTelefono, errorUsuario,
    geo: { union, diferencia, interseccion, offset, area, bbox, mover, perdidaFina, anchoAlMenos, distancia, rendijaOk }
  };
})();
