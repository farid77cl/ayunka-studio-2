/* Ayünka Studio — geometría 2D para el generador 3D. Solo lo que necesita el llavero
 * publicitario: rectángulo redondeado, elipse, y texto real vía opentype.js. La fuente
 * se pide a un COMMIT fijo de google/fonts (no a la rama @main que se mueve -- esa
 * trampa ya se pagó una vez en la v1, no se repite). */
(function () {
  'use strict';
  const COMMIT_FUENTES = '809e4d8b8d7e9364a914909bb777679606c178b8';
  const URL_FUENTE = `https://cdn.jsdelivr.net/gh/google/fonts@${COMMIT_FUENTES}/ofl/poppins/Poppins-Bold.ttf`;

  function rectRedondeado(w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    const seg = 8, out = [];
    const esquinas = [[w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, 90], [-w / 2 + r, -h / 2 + r, 180], [w / 2 - r, -h / 2 + r, 270]];
    for (const [cx, cy, a0] of esquinas) {
      for (let i = 0; i <= seg; i++) {
        const a = (a0 + i * 90 / seg) * Math.PI / 180;
        out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
    }
    return { outer: out, holes: [] };
  }

  function elipse(rx, ry, seg, x, y) {
    const out = [];
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      out.push([(x || 0) + rx * Math.cos(a), (y || 0) + ry * Math.sin(a)]);
    }
    return out;
  }

  function bboxDe(figs) {
    let x1 = Infinity, x2 = -Infinity, y1 = Infinity, y2 = -Infinity;
    figs.forEach(f => [f.outer].concat(f.holes || []).forEach(anillo => anillo.forEach(p => {
      if (p[0] < x1) x1 = p[0]; if (p[0] > x2) x2 = p[0];
      if (p[1] < y1) y1 = p[1]; if (p[1] > y2) y2 = p[1];
    })));
    if (!isFinite(x1)) return { w: 0, h: 0, x1: 0, y1: 0, x2: 0, y2: 0 };
    return { w: x2 - x1, h: y2 - y1, x1, y1, x2, y2 };
  }

  // Aplana los comandos de opentype.js (M/L/C/Q/Z) a un polígono, con suficiente
  // resolución para que ExtrudeGeometry no se vea facetado en una letra de 10-30mm.
  function aplanarPath(path) {
    const anillos = []; let actual = [];
    const PASOS_CURVA = 8;
    let x = 0, y = 0;
    for (const c of path.commands) {
      if (c.type === 'M') { if (actual.length) anillos.push(actual); actual = [[c.x, -c.y]]; x = c.x; y = c.y; }
      else if (c.type === 'L') { actual.push([c.x, -c.y]); x = c.x; y = c.y; }
      else if (c.type === 'Q') {
        for (let i = 1; i <= PASOS_CURVA; i++) {
          const t = i / PASOS_CURVA;
          const px = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * c.x1 + t * t * c.x;
          const py = (1 - t) * (1 - t) * y + 2 * (1 - t) * t * c.y1 + t * t * c.y;
          actual.push([px, -py]);
        }
        x = c.x; y = c.y;
      } else if (c.type === 'C') {
        for (let i = 1; i <= PASOS_CURVA; i++) {
          const t = i / PASOS_CURVA, mt = 1 - t;
          const px = mt * mt * mt * x + 3 * mt * mt * t * c.x1 + 3 * mt * t * t * c.x2 + t * t * t * c.x;
          const py = mt * mt * mt * y + 3 * mt * mt * t * c.y1 + 3 * mt * t * t * c.y2 + t * t * t * c.y;
          actual.push([px, -py]);
        }
        x = c.x; y = c.y;
      } else if (c.type === 'Z') { if (actual.length) anillos.push(actual); actual = []; }
    }
    if (actual.length) anillos.push(actual);
    return anillos;
  }

  let fuenteCache = null;
  async function cargarFuente() {
    if (fuenteCache) return fuenteCache;
    fuenteCache = await opentype.load(URL_FUENTE);
    return fuenteCache;
  }

  /** Devuelve un array de {outer, holes} -- una figura por cada contorno cerrado de la
   *  fuente (las letras con agujero, como la O, ya vienen con el agujero como anillo
   *  separado; se anidan por área para saber cuál hueco pertenece a cuál letra). */
  async function textoAFiguras(str, tamanoMm) {
    const fuente = await cargarFuente();
    const escala = tamanoMm / fuente.unitsPerEm;
    const path = fuente.getPath(str, 0, 0, fuente.unitsPerEm);
    const anillos = aplanarPath(path).map(anillo => anillo.map(([x, y]) => [x * escala, y * escala]));
    return anidarPorArea(anillos);
  }

  function area(anillo) {
    let a = 0;
    for (let i = 0; i < anillo.length; i++) {
      const [x1, y1] = anillo[i], [x2, y2] = anillo[(i + 1) % anillo.length];
      a += x1 * y2 - x2 * y1;
    }
    return a / 2;
  }
  function dentro(pt, anillo) {
    let d = false;
    for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
      const [xi, yi] = anillo[i], [xj, yj] = anillo[j];
      if (((yi > pt[1]) !== (yj > pt[1])) && (pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi)) d = !d;
    }
    return d;
  }
  // Agrupa anillos en figuras {outer, holes}: un anillo B es hueco de A si su primer
  // punto cae dentro de A y |área(A)| > |área(B)| (evita que un hueco se declare dueño
  // de otro hueco de área menor).
  function anidarPorArea(anillos) {
    const ordenados = anillos.map(a => ({ pts: a, area: Math.abs(area(a)) })).sort((a, b) => b.area - a.area);
    const figuras = [];
    for (const cand of ordenados) {
      const dueno = figuras.find(f => dentro(cand.pts[0], f.outer));
      if (dueno) dueno.holes.push(cand.pts);
      else figuras.push({ outer: cand.pts, holes: [] });
    }
    return figuras;
  }

  window.G = { rectRedondeado, elipse, bboxDe, textoAFiguras, cargarFuente };
})();
