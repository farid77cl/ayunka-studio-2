/* Ayünka Studio — Diseño 3D · motor geométrico.

   Todo en este módulo habla el mismo idioma: un CONTORNO es un array de puntos [x,y]
   en milímetros, cerrado implícitamente. Una FIGURA es {outer:[pts], holes:[[pts]…]}.

   Da igual si viene de una figura paramétrica, de una letra o de una foto que subió
   Farid: al final son contornos, y con eso se dibuja el lienzo 2D y se extruye el 3D.
   Ese es el truco que permite componer cualquier cosa sin casos especiales.

   No depende de Three.js ni del DOM (salvo trazarImagen, que recibe un ImageData).  */
(function () {
  'use strict';

  /* ---------- utilidades de polígono ---------- */

  function area(pts) { // shoelace con signo
    let a = 0;
    for (let i = 0, n = pts.length; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n];
      a += p[0] * q[1] - q[0] * p[1];
    }
    return a / 2;
  }
  function bbox(pts) {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const p of pts) { if (p[0] < x1) x1 = p[0]; if (p[0] > x2) x2 = p[0]; if (p[1] < y1) y1 = p[1]; if (p[1] > y2) y2 = p[1]; }
    return { x1, y1, x2, y2, w: x2 - x1, h: y2 - y1 };
  }
  function bboxDe(figs) {
    let b = null;
    for (const f of figs) {
      const c = bbox(f.outer);
      b = b ? { x1: Math.min(b.x1, c.x1), y1: Math.min(b.y1, c.y1), x2: Math.max(b.x2, c.x2), y2: Math.max(b.y2, c.y2) } : c;
    }
    if (!b) return { x1: 0, y1: 0, x2: 0, y2: 0, w: 0, h: 0 };
    b.w = b.x2 - b.x1; b.h = b.y2 - b.y1; return b;
  }
  function dentro(pt, poly) { // ray casting
    let d = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if (((yi > pt[1]) !== (yj > pt[1])) && (pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi)) d = !d;
    }
    return d;
  }

  // Douglas-Peucker: sin esto una foto de 500px deja contornos de 3.000 puntos y el
  // STL se vuelve inmanejable (y el lienzo 2D va a tirones).
  function simplificar(pts, tol) {
    if (pts.length < 4) return pts;
    const keep = new Uint8Array(pts.length); keep[0] = 1; keep[pts.length - 1] = 1;
    const stack = [[0, pts.length - 1]];
    while (stack.length) {
      const [a, b] = stack.pop();
      let maxD = -1, idx = -1;
      const ax = pts[a][0], ay = pts[a][1], bx = pts[b][0], by = pts[b][1];
      const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
      for (let i = a + 1; i < b; i++) {
        const px = pts[i][0], py = pts[i][1];
        let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const qx = ax + t * dx, qy = ay + t * dy;
        const d = (px - qx) * (px - qx) + (py - qy) * (py - qy);
        if (d > maxD) { maxD = d; idx = i; }
      }
      if (maxD > tol * tol && idx > 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
    }
    const out = [];
    for (let i = 0; i < pts.length; i++) if (keep[i]) out.push(pts[i]);
    return out;
  }

  /* Agrupa contornos sueltos en figuras con huecos, por anidación.
     Profundidad par = sólido, impar = hueco. Así la 'o' de un texto y los 4 hoyos de
     un botón salen bien sin tener que mirar el sentido de giro, que no siempre es
     confiable cuando el contorno viene de una foto. */
  function anidar(contornos) {
    const cs = contornos.filter(c => c && c.length >= 3).map(c => ({ pts: c, box: bbox(c), abs: Math.abs(area(c)) }));
    cs.sort((a, b) => b.abs - a.abs); // grandes primero: un padre siempre va antes que su hijo
    const nivel = new Array(cs.length).fill(0);
    const padre = new Array(cs.length).fill(-1);
    for (let i = 0; i < cs.length; i++) {
      for (let j = 0; j < i; j++) {
        const a = cs[i], b = cs[j];
        if (a.box.x1 >= b.box.x1 && a.box.x2 <= b.box.x2 && a.box.y1 >= b.box.y1 && a.box.y2 <= b.box.y2 && dentro(a.pts[0], b.pts)) {
          if (nivel[j] + 1 > nivel[i]) { nivel[i] = nivel[j] + 1; padre[i] = j; }
        }
      }
    }
    const figs = [], idxFig = new Array(cs.length).fill(-1);
    for (let i = 0; i < cs.length; i++) {
      if (nivel[i] % 2 === 0) { idxFig[i] = figs.length; figs.push({ outer: cs[i].pts, holes: [] }); }
    }
    for (let i = 0; i < cs.length; i++) {
      if (nivel[i] % 2 === 1 && padre[i] >= 0 && idxFig[padre[i]] >= 0) figs[idxFig[padre[i]]].holes.push(cs[i].pts);
    }
    return figs;
  }

  /* ---------- transformaciones ---------- */

  function mapear(figs, fn) {
    return figs.map(f => ({ outer: f.outer.map(fn), holes: (f.holes || []).map(h => h.map(fn)) }));
  }
  function transformar(figs, { x = 0, y = 0, sx = 1, sy = 1, rot = 0, espejoX = false }) {
    const r = rot * Math.PI / 180, cos = Math.cos(r), sin = Math.sin(r);
    const mx = espejoX ? -1 : 1;
    return mapear(figs, p => {
      const px = p[0] * sx * mx, py = p[1] * sy;
      return [px * cos - py * sin + x, px * sin + py * cos + y];
    });
  }
  // Estira las figuras hasta ocupar exacto ancho×alto, sin respetar la proporción.
  // Es lo que se espera al escribir dos medidas: una placa de 65×28 tiene que medir
  // 65×28. Para imágenes se usa `encajar`, porque deformar un logo casi siempre es
  // un error.
  function estirar(figs, ancho, alto) {
    const b = bboxDe(figs);
    if (!b.w || !b.h) return figs;
    const sx = ancho / b.w, sy = alto / b.h;
    const cx = (b.x1 + b.x2) / 2, cy = (b.y1 + b.y2) / 2;
    return mapear(figs, p => [(p[0] - cx) * sx, (p[1] - cy) * sy]);
  }
  // Encaja las figuras dentro de ancho×alto conservando la proporción y centrando.
  function encajar(figs, ancho, alto) {
    const b = bboxDe(figs);
    if (!b.w || !b.h) return figs;
    const s = Math.min(ancho / b.w, alto / b.h);
    const cx = (b.x1 + b.x2) / 2, cy = (b.y1 + b.y2) / 2;
    return mapear(figs, p => [(p[0] - cx) * s, (p[1] - cy) * s]);
  }
  function centrar(figs) {
    const b = bboxDe(figs);
    const cx = (b.x1 + b.x2) / 2, cy = (b.y1 + b.y2) / 2;
    return mapear(figs, p => [p[0] - cx, p[1] - cy]);
  }

  /* Contrae un contorno `d` mm hacia adentro (offset interior por bisectriz).
     Sirve para el marco de una caja de luz: pared exterior menos `d` = pared interior.
     Es exacto en rectángulos y muy fiel en formas convexas; en cóncavos muy cerrados
     puede cruzarse sobre sí mismo, por eso `contraerSeguro` verifica el resultado.  */
  function contraer(pts, d) {
    const n = pts.length; if (n < 3) return pts;
    const haciaIzq = area(pts) > 0; // el interior queda a la izquierda si gira antihorario
    const out = [];
    for (let i = 0; i < n; i++) {
      const p = pts[(i - 1 + n) % n], v = pts[i], q = pts[(i + 1) % n];
      const n1 = normalInt(p, v, haciaIzq), n2 = normalInt(v, q, haciaIzq);
      let bx = n1[0] + n2[0], by = n1[1] + n2[1];
      const len2 = bx * bx + by * by;
      if (len2 < 1e-9) { out.push([v[0] + n1[0] * d, v[1] + n1[1] * d]); continue; }
      let f = 2 / len2;
      if (f > 4) f = 4;  // esquina en punta: se recorta para que no dispare un pico
      out.push([v[0] + bx * d * f, v[1] + by * d * f]);
    }
    return out;
  }
  function normalInt(a, b, haciaIzq) {
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    const ux = dx / l, uy = dy / l;
    return haciaIzq ? [-uy, ux] : [uy, -ux];
  }
  // Contrae y avisa si el resultado dejó de ser válido (se dio vuelta o se cerró).
  function contraerSeguro(pts, d) {
    const a0 = Math.abs(area(pts));
    const r = contraer(pts, d);
    const a1 = area(r), a0s = area(pts);
    if (!r.length || Math.abs(a1) < a0 * 0.04 || (a1 > 0) !== (a0s > 0)) return null;
    return r;
  }

  /* ---------- biblioteca de figuras ----------
     Cada generadora devuelve contornos en unidades cualquiera; `norm` los encaja
     después en una caja 1×1 centrada en el origen. Así al escribir una figura nueva
     no hay que pelear con la escala: se dibuja cómoda y se normaliza sola.         */

  const TAU = Math.PI * 2;
  function polar(n, fn) { const p = []; for (let i = 0; i < n; i++) { const t = i / n * TAU; p.push(fn(t, i)); } return p; }
  function elipse(rx, ry, n, cx, cy) { cx = cx || 0; cy = cy || 0; return polar(n || 64, t => [cx + Math.cos(t) * rx, cy + Math.sin(t) * ry]); }

  function rrectPts(w, h, r, seg) {
    r = Math.max(0, Math.min(r, w / 2, h / 2)); seg = seg || 8;
    if (r <= 0) return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
    const pts = [], cx = w / 2 - r, cy = h / 2 - r;
    const esquinas = [[cx, cy, 0], [-cx, cy, Math.PI / 2], [-cx, -cy, Math.PI], [cx, -cy, Math.PI * 1.5]];
    for (const [ex, ey, a0] of esquinas) for (let i = 0; i <= seg; i++) { const a = a0 + i / seg * (Math.PI / 2); pts.push([ex + Math.cos(a) * r, ey + Math.sin(a) * r]); }
    return pts;
  }

  const FIGURAS = {
    // Las tres primeras son «nativas»: se generan directo en milímetros para que las
    // esquinas redondeadas y los círculos salgan exactos y no estirados.
    rrect:   { label: 'Rectángulo', nativo: true, params: { redondeo: 0.18 },
               gen: (p, w, h) => [rrectPts(w, h, Math.min(w, h) * clamp(p.redondeo, 0, .5), 10)] },
    circulo: { label: 'Círculo', nativo: true, gen: (p, w, h) => { const r = Math.min(w, h) / 2; return [elipse(r, r, 72)]; } },
    ovalo:   { label: 'Óvalo', nativo: true, gen: (p, w, h) => [elipse(w / 2, h / 2, 72)] },
    hexagono:{ label: 'Hexágono', gen: () => [polar(6, t => [Math.cos(t + Math.PI / 6) * 50, Math.sin(t + Math.PI / 6) * 50])] },
    triangulo:{ label: 'Triángulo', gen: () => [polar(3, t => [Math.cos(t + Math.PI / 2) * 50, Math.sin(t + Math.PI / 2) * 50])] },

    corazon: { label: 'Corazón', gen: () => [polar(120, t => {
      const s = Math.sin(t), c = Math.cos(t);
      return [16 * s * s * s, 13 * c - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)];
    })] },

    estrella: { label: 'Estrella', params: { puntas: 5, hundido: 0.48 }, gen: p => {
      const n = Math.max(3, Math.round(p.puntas || 5)), ri = 50 * clamp(p.hundido, .15, .9), pts = [];
      for (let i = 0; i < n * 2; i++) { const r = i % 2 ? ri : 50, a = i / (n * 2) * TAU + Math.PI / 2; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
      return [pts];
    } },

    flor: { label: 'Flor', params: { petalos: 6, centro: 0.3 }, gen: p => {
      const n = Math.max(3, Math.round(p.petalos || 6)), k = clamp(p.centro, .1, .8);
      return [polar(200, t => { const r = 50 * (k + (1 - k) * Math.abs(Math.cos(n * t / 2))); return [Math.cos(t) * r, Math.sin(t) * r]; })];
    } },

    nube: { label: 'Nube', gen: () => {
      // Círculos solapados fusionados por unión de máscara implícita: aquí basta con
      // un contorno metaball, que da el borde blando típico de nube.
      const bolas = [[-32, -4, 24], [-6, 10, 30], [22, 0, 25], [40, -10, 18], [-48, -12, 17]];
      return [polar(220, t => {
        // radio máximo en esa dirección entre todas las bolas (unión aproximada)
        let best = 0;
        for (const [bx, by, br] of bolas) {
          const dx = Math.cos(t), dy = Math.sin(t);
          const b = bx * dx + by * dy, c = bx * bx + by * by - br * br, disc = b * b - c;
          if (disc > 0) { const r = b + Math.sqrt(disc); if (r > best) best = r; }
        }
        return [Math.cos(t) * best, Math.sin(t) * best];
      })];
    } },

    luna: { label: 'Luna', params: { filo: 0.55 }, gen: p => {
      const k = clamp(p.filo, .2, .95);
      const ext = elipse(50, 50, 90);
      const cort = elipse(50 * k * 1.15, 50 * 1.02, 90, 50 * (1 - k) * 1.1, 6);
      // resta 2D por muestreo angular: para cada dirección del borde exterior, si cae
      // dentro del círculo de corte, se desplaza al borde de ese círculo.
      const pts = ext.filter(q => !dentro(q, cort));
      const arco = cort.filter(q => dentro(q, ext)).reverse();
      return [pts.concat(arco)];
    } },

    gota:  { label: 'Gota', gen: () => [polar(120, t => { const r = 50 * (1 - Math.sin(t)) / 1.6 + 18; return [Math.cos(t) * r * .9, Math.sin(t) * r]; })] },
    hoja:  { label: 'Hoja', gen: () => [polar(140, t => { const r = 50 * Math.abs(Math.sin(t)) * (0.6 + 0.4 * Math.abs(Math.cos(t / 2))); return [Math.cos(t) * r * 1.5, Math.sin(t) * r]; }).filter((p, i, a) => i === 0 || Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) > .3)] },
    rayo:  { label: 'Rayo', gen: () => [[[6, 50], [-30, 4], [-4, 4], [-12, -50], [26, -2], [0, -2]]] },
    sol:   { label: 'Sol', params: { rayos: 12 }, gen: p => {
      const n = Math.max(4, Math.round(p.rayos || 12)), pts = [];
      for (let i = 0; i < n * 2; i++) { const r = i % 2 ? 30 : 50, a = i / (n * 2) * TAU; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
      return [pts];
    } },

    huella: { label: 'Huellita', gen: () => {
      const almo = polar(80, t => [Math.cos(t) * 34, Math.sin(t) * 26 - 18]).map(p => [p[0], p[1] - Math.max(0, p[1] + 18) * .35]);
      const dedos = [[-26, 24, 11, 14], [-9, 33, 11, 14], [9, 33, 11, 14], [26, 24, 11, 14]].map(([x, y, rx, ry]) => elipse(rx, ry, 32, x, y));
      return [almo].concat(dedos);
    } },

    oso: { label: 'Osito', gen: () => [elipse(50, 46, 72)].concat([elipse(20, 20, 40, -40, 38), elipse(20, 20, 40, 40, 38)]) },
    conejo: { label: 'Conejito', gen: () => [elipse(42, 40, 72)].concat([
      polar(60, t => [Math.cos(t) * 13 - 20, Math.sin(t) * 34 + 62]), polar(60, t => [Math.cos(t) * 13 + 20, Math.sin(t) * 34 + 62])]) },

    globo: { label: 'Globo', gen: () => {
      const b = polar(80, t => [Math.cos(t) * 40, Math.sin(t) * 48 + 12]);
      return [b.concat([[6, -34], [0, -50], [-6, -34]])];
    } },

    moño: { label: 'Moño', gen: () => {
      const izq = polar(60, t => [Math.cos(t) * 30 - 32, Math.sin(t) * 26]);
      const der = polar(60, t => [Math.cos(t) * 30 + 32, Math.sin(t) * 26]);
      return [izq, der, rrectPts(22, 26, 8, 6)];
    } },

    mariposa: { label: 'Mariposa', gen: () => {
      const ala = s => polar(90, t => { const r = 46 * (0.55 + 0.45 * Math.abs(Math.sin(2 * t))); return [s * (Math.cos(t) * r + 26), Math.sin(t) * r]; });
      return [ala(1), ala(-1), elipse(6, 40, 40)];
    } },

    arcoiris: { label: 'Arco', params: { grosor: 0.35 }, gen: p => {
      const g = clamp(p.grosor, .1, .8), n = 90, ext = [], int = [];
      for (let i = 0; i <= n; i++) { const a = Math.PI * i / n; ext.push([Math.cos(a) * 50, Math.sin(a) * 50]); }
      for (let i = n; i >= 0; i--) { const a = Math.PI * i / n; int.push([Math.cos(a) * 50 * (1 - g), Math.sin(a) * 50 * (1 - g)]); }
      return [ext.concat(int)];
    } },

    etiqueta: { label: 'Etiqueta', gen: () => [[[-50, -30], [30, -30], [50, 0], [30, 30], [-50, 30]]] },
    hueso: { label: 'Huesito', gen: () => {
      const b = rrectPts(70, 22, 11, 6);
      return [b, elipse(17, 17, 40, -38, 12), elipse(17, 17, 40, -38, -12), elipse(17, 17, 40, 38, 12), elipse(17, 17, 40, 38, -12)];
    } },

    carrete: { label: 'Carrete de hilo', gen: () => {
      const cuerpo = rrectPts(46, 60, 4, 4);
      return [cuerpo, rrectPts(74, 14, 5, 4).map(p => [p[0], p[1] + 34]), rrectPts(74, 14, 5, 4).map(p => [p[0], p[1] - 34])];
    } },
    boton: { label: 'Botón', gen: () => {
      const hoyos = [[-16, 16], [16, 16], [-16, -16], [16, -16]].map(([x, y]) => elipse(8, 8, 28, x, y));
      return [elipse(50, 50, 72)].concat(hoyos);
    } },

    /* --- motivos escolares --- */
    lapiz: { label: 'Lápiz', grupo: 'Escolar', gen: () => [[
      [-14, -50], [14, -50], [14, 22], [10, 34], [0, 50], [-10, 34], [-14, 22]]] },

    libro: { label: 'Libro abierto', grupo: 'Escolar', gen: () => {
      const tapa = [[-50, -24], [0, -34], [50, -24], [50, 26], [0, 16], [-50, 26]];
      return [tapa, [[-2.5, -33], [2.5, -33], [2.5, 15], [-2.5, 15]]];  // el lomo
    } },

    manzana: { label: 'Manzana', grupo: 'Escolar', gen: () => {
      const cuerpo = polar(170, t => {
        const dent = 9 * Math.pow(Math.max(0, Math.sin(t)), 14);   // la muesca de arriba
        const r = 43 - dent;
        return [Math.cos(t) * r * 1.04, Math.sin(t) * r];
      });
      const tallo = [[-2.6, 30], [2.6, 30], [3.6, 52], [-1.6, 52]];
      const hoja = polar(40, t => [Math.cos(t) * 13 + 15, Math.sin(t) * 5.5 + 47]);
      return [cuerpo, tallo, hoja];
    } },

    mochila: { label: 'Mochila', grupo: 'Escolar', gen: () => {
      const cuerpo = rrectPts(74, 84, 16, 8);
      const solapa = [[-37, 14], [37, 14], [37, 34], [0, 46], [-37, 34]];
      const asa = [[-13, 40], [13, 40], [13, 50], [-13, 50]];
      return [cuerpo, solapa, asa];
    } },

    regla: { label: 'Regla', grupo: 'Escolar', gen: () => {
      const cuerpo = rrectPts(100, 26, 4, 4);
      const marcas = [];
      for (let i = -4; i <= 4; i++) marcas.push(rrectPts(2.6, i % 2 ? 8 : 13, 1, 2).map(p => [p[0] + i * 10, p[1] + 13 - (i % 2 ? 4 : 6.5)]));
      return [cuerpo].concat(marcas);   // las marcas quedan dentro: salen como huecos
    } },

    pizarra: { label: 'Pizarra', grupo: 'Escolar', gen: () => [rrectPts(100, 72, 5, 5), rrectPts(86, 58, 3, 4)] },

    birrete: { label: 'Birrete', grupo: 'Escolar', gen: () => {
      const tabla = [[0, 40], [54, 16], [0, -8], [-54, 16]];
      const gorro = [[-25, 12], [25, 12], [21, -20], [-21, -20]];
      const cordon = [[46, 14], [51, 14], [51, -18], [46, -18]];
      const borla = elipse(8, 9, 28, 48.5, -26);
      return [tabla, gorro, cordon, borla];
    } },

    campana: { label: 'Campana', grupo: 'Escolar', gen: () => {
      const cuerpo = polar(120, t => {
        const c = Math.cos(t), s = Math.sin(t);
        return [c * (26 + 20 * (1 - s) / 2), s * 34 - 4];
      });
      const falda = [[-44, -30], [44, -30], [44, -40], [-44, -40]];
      const badajo = elipse(8, 8, 26, 0, -46);
      const agarre = elipse(7, 7, 24, 0, 34);
      return [cuerpo, falda, badajo, agarre];
    } },

    bus: { label: 'Bus escolar', grupo: 'Escolar', gen: () => {
      const cuerpo = rrectPts(104, 54, 10, 6).map(p => [p[0], p[1] + 4]);
      const ventanas = [-34, -11, 12].map(x => rrectPts(19, 16, 2, 3).map(p => [p[0] + x, p[1] + 15]));
      const parabrisas = rrectPts(15, 16, 2, 3).map(p => [p[0] + 39, p[1] + 15]);
      const ruedas = [[-30, -26], [30, -26]].map(([x, y]) => elipse(12, 12, 32, x, y));
      return [cuerpo].concat(ventanas, [parabrisas], ruedas);
    } },

    cohete: { label: 'Cohete', grupo: 'Escolar', gen: () => {
      const cuerpo = polar(90, t => {
        const s = Math.sin(t);
        const r = s > 0 ? 20 - 12 * Math.pow(s, 3) : 20;
        return [Math.cos(t) * r, s > 0 ? s * 50 : s * 34];
      });
      const aletas = [[[-20, -14], [-38, -40], [-20, -34]], [[20, -14], [38, -40], [20, -34]]];
      const fuego = [[-11, -34], [11, -34], [0, -52]];
      const ventana = elipse(9, 9, 28, 0, 16);
      return [cuerpo].concat(aletas, [fuego, ventana]);
    } },

    paleta: { label: 'Paleta de pintura', grupo: 'Escolar', gen: () => {
      const cuerpo = polar(140, t => {
        const r = 48 * (1 + 0.12 * Math.cos(3 * t + 1));
        return [Math.cos(t) * r, Math.sin(t) * r * 0.82];
      });
      const pulgar = elipse(11, 9, 30, 17, -12);
      const pozos = [[-24, 14], [-4, 22], [16, 16], [-20, -8]].map(([x, y]) => elipse(7.5, 7.5, 26, x, y));
      return [cuerpo, pulgar].concat(pozos);
    } },

    avion: { label: 'Avión de papel', grupo: 'Escolar', gen: () => [[
      [-50, 34], [50, -2], [-50, -34], [-30, -4], [-50, 34]]] },

    nota: { label: 'Nota musical', grupo: 'Escolar', gen: () => {
      const cabeza = polar(48, t => [Math.cos(t) * 20 - 16, Math.sin(t) * 15 - 30]);
      const palo = [[0, -30], [8, -30], [8, 44], [0, 44]];
      const bandera = [[8, 44], [30, 32], [30, 14], [8, 26]];
      return [cabeza, palo, bandera];
    } },

    tijeras: { label: 'Tijeras', grupo: 'Escolar', gen: () => {
      const hoja = s => [[s * 3, -6], [s * 10, -2], [s * 20, 46], [s * 12, 50], [s * 2, 6]];
      const aro = s => elipse(13, 13, 30, s * 15, -34);
      const aroInt = s => elipse(6.5, 6.5, 24, s * 15, -34);
      const brazo = s => [[s * 2, 0], [s * 9, -4], [s * 19, -26], [s * 11, -30]];
      return [hoja(1), hoja(-1), brazo(1), brazo(-1), aro(1), aroInt(1), aro(-1), aroInt(-1)];
    } }
  };

  function clamp(v, a, b) { v = +v; if (isNaN(v)) v = a; return v < a ? a : v > b ? b : v; }

  // Devuelve la figura ocupando exactamente ancho×alto, centrada en el origen.
  function figura(nombre, ancho, alto, params) {
    const def = FIGURAS[nombre] || FIGURAS.circulo;
    const p = Object.assign({}, def.params || {}, params || {});
    const w = Math.max(0.5, +ancho || 10), h = Math.max(0.5, +alto || 10);
    let contornos;
    try { contornos = def.gen(p, w, h); } catch (e) { contornos = FIGURAS.circulo.gen({}, w, h); }
    const figs = anidar(contornos);
    return def.nativo ? centrar(figs) : estirar(figs, w, h);
  }
  function listaFiguras() {
    return Object.keys(FIGURAS).map(k => ({ id: k, label: FIGURAS[k].label, grupo: FIGURAS[k].grupo || 'Formas y adornos', params: FIGURAS[k].params || null }));
  }
  function gruposFiguras() {
    const g = {};
    for (const f of listaFiguras()) (g[f.grupo] = g[f.grupo] || []).push(f);
    return g;
  }

  /* ---------- vectorizar una imagen ----------
     Se sigue el "borde entre píxeles" (crack following) en vez de marching squares:
     no tiene casos ambiguos y da contornos exactos sobre la retícula, que luego
     Douglas-Peucker suaviza. Lo importante es que un logo con contraformas (una 'O',
     el hueco de una argolla) salga con sus huecos y no como una mancha.            */

  function mascaraDe(imageData, opts) {
    const { width: W, height: H, data } = imageData;
    const modo = (opts && opts.modo) || 'auto';       // auto | luminancia | alfa | color
    const umbral = (opts && opts.umbral != null) ? opts.umbral : 0.5;
    const invertir = !!(opts && opts.invertir);
    const m = new Uint8Array(W * H);

    // ¿la imagen trae transparencia real? entonces manda el alfa (típico de logos PNG)
    let hayAlfa = false;
    if (modo === 'alfa') hayAlfa = true;
    else if (modo === 'auto') { for (let i = 3; i < data.length; i += 4) if (data[i] < 200) { hayAlfa = true; break; } }

    for (let i = 0, p = 0; i < m.length; i++, p += 4) {
      const a = data[p + 3] / 255;
      let v;
      if (hayAlfa) v = a;
      else { const lum = (0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2]) / 255; v = 1 - lum; } // oscuro = sólido
      m[i] = ((v >= umbral) !== invertir) ? 1 : 0;
    }
    return { m, W, H };
  }

  function contornosDeMascara(m, W, H) {
    const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : m[y * W + x];
    // Aristas dirigidas del borde de cada píxel sólido, orientadas de modo que el
    // sólido queda siempre a la derecha del avance.
    const salidas = new Map();
    const key = (x, y) => x * 100000 + y;
    function push(ax, ay, bx, by) {
      const k = key(ax, ay); const arr = salidas.get(k);
      if (arr) arr.push([bx, by]); else salidas.set(k, [[bx, by]]);
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!at(x, y)) continue;
      if (!at(x, y - 1)) push(x, y, x + 1, y);
      if (!at(x + 1, y)) push(x + 1, y, x + 1, y + 1);
      if (!at(x, y + 1)) push(x + 1, y + 1, x, y + 1);
      if (!at(x - 1, y)) push(x, y + 1, x, y);
    }
    const contornos = [];
    for (const [k0, arr0] of salidas) {
      while (arr0.length) {
        const start = [Math.floor(k0 / 100000), k0 % 100000];
        let cur = start, next = arr0.shift();
        const pts = [start];
        let guard = 0;
        while (next && guard++ < 4e6) {
          pts.push(next);
          if (next[0] === start[0] && next[1] === start[1]) break;
          const arr = salidas.get(key(next[0], next[1]));
          if (!arr || !arr.length) break;
          let pick = 0;
          if (arr.length > 1) {
            // Cruce en diagonal (dos manchas que solo se tocan por una esquina).
            // Se toma el giro más cerrado hacia el propio contorno, o sea que se
            // SEPARAN. Unirlas daría un contorno que se toca a sí mismo y la
            // triangulación del extruido se vuelve loca; separadas se imprimen igual,
            // porque el punto de contacto no tiene ancho.
            const dx = next[0] - cur[0], dy = next[1] - cur[1];
            let mejor = -Infinity;
            for (let i = 0; i < arr.length; i++) {
              const ex = arr[i][0] - next[0], ey = arr[i][1] - next[1];
              const cross = dx * ey - dy * ex, dot = dx * ex + dy * ey;
              const score = Math.atan2(cross, -dot);
              if (score > mejor) { mejor = score; pick = i; }
            }
          }
          const sig = arr.splice(pick, 1)[0];
          cur = next; next = sig;
        }
        if (pts.length >= 4) contornos.push(pts);
      }
    }
    return contornos;
  }

  /* imageData → figuras en mm, encajadas en ancho×alto.
     `detalle` (0..1) controla cuánto se simplifica: 1 = fiel, 0 = muy liso.        */
  function trazarImagen(imageData, opts) {
    opts = opts || {};
    const { m, W, H } = mascaraDe(imageData, opts);
    let solidos = 0; for (let i = 0; i < m.length; i++) solidos += m[i];
    if (!solidos) return { figs: [], aviso: 'La imagen quedó vacía con ese umbral. Prueba moviendo el control o invirtiendo.' };
    if (solidos === m.length) return { figs: [], aviso: 'La imagen quedó completamente llena. Baja el umbral o inviértela.' };

    let contornos = contornosDeMascara(m, W, H);
    if (!contornos.length) return { figs: [], aviso: 'No pude encontrar el contorno de la imagen.' };

    // Fuera el ruido: manchitas de menos del 0,05% del área total no son parte del logo.
    const minArea = (W * H) * 0.0005;
    contornos = contornos.filter(c => Math.abs(area(c)) >= minArea);
    if (!contornos.length) return { figs: [], aviso: 'Solo encontré manchas muy chicas. Usa una imagen con más contraste.' };

    const tol = 0.35 + (1 - clamp(opts.detalle != null ? opts.detalle : 0.6, 0, 1)) * 3.5;
    contornos = contornos.map(c => simplificar(c, tol)).filter(c => c.length >= 3);

    // y arriba: la imagen crece hacia abajo, el modelo hacia arriba
    contornos = contornos.map(c => c.map(p => [p[0], H - p[1]]));
    let figs = anidar(contornos);
    if (opts.soloMayor && figs.length > 1) {
      figs.sort((a, b) => Math.abs(area(b.outer)) - Math.abs(area(a.outer)));
      figs = [figs[0]];
    }
    figs = encajar(figs, opts.ancho || 40, opts.alto || 40);
    return { figs, aviso: null, piezas: figs.length };
  }

  window.D3DFormas = {
    area, bbox, bboxDe, dentro, simplificar, anidar, mapear, transformar, encajar, centrar,
    contraer, contraerSeguro, estirar,
    figura, listaFiguras, gruposFiguras, FIGURAS, rrectPts, elipse,
    trazarImagen, mascaraDe, contornosDeMascara
  };
})();
