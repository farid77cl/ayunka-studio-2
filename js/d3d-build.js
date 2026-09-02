/* Ayünka Studio — Diseño 3D · modelo del proyecto, compilación y exportación.

   Un PROYECTO es una base opcional más una pila de capas. Cada capa es texto, una
   figura de la biblioteca o una imagen vectorizada; da lo mismo cuál, porque todas
   terminan siendo contornos y se tratan igual. Eso es lo que permite armar un llavero,
   una letra con nombre o un recuerdo de nacimiento sin código distinto para cada uno.

   `compilar()` no toca Three.js a propósito: convierte el proyecto en SÓLIDOS
   (contornos + desde qué z hasta qué z + color + a qué pieza pertenecen). Así se puede
   probar fuera del navegador, que es donde se agarran los errores de verdad.        */
(function () {
  'use strict';

  const uid = () => 'c' + Math.random().toString(36).slice(2, 9);

  /* ---------- colores (slots del CFS de la K2 Combo) — misma paleta que css/app.css,
     el CFS viene cargado con filamento de estos 4 colores de marca ---------- */
  const COLORES = [
    { i: 1, nombre: 'Color 1', hex: '#CB5A52' },  // --coral
    { i: 2, nombre: 'Color 2', hex: '#ECE6DA' },  // --crema
    { i: 3, nombre: 'Color 3', hex: '#5F7C8E' },  // --pizarra
    { i: 4, nombre: 'Color 4', hex: '#C27A4E' }   // --terra
  ];

  /* ---------- fábrica de capas ---------- */
  function capaTexto(txt, extra) {
    return Object.assign({
      id: uid(), tipo: 'texto', nombre: txt || 'Texto', visible: true, color: 2,
      txt: txt || 'Texto', fuente: 'poppins', mm: 10, align: 'centro', espaciado: 0, interlinea: 1.25,
      x: 0, y: 0, z: 0, rot: 0, escalaX: 1, escalaY: 1, altura: 1.2, modo: 'relieve', prof: 1
    }, extra || {});
  }
  function capaFigura(fig, extra) {
    return Object.assign({
      id: uid(), tipo: 'figura',
      nombre: ((window.D3DFormas && window.D3DFormas.FIGURAS[fig] || {}).label) || fig || 'Figura',
      visible: true, color: 3, figura: fig || 'estrella', params: {},
      x: 0, y: 0, z: 0, rot: 0, ancho: 15, alto: 15, altura: 1.2, modo: 'relieve', prof: 1
    }, extra || {});
  }
  function capaImagen(figs, nombre, extra) {
    return Object.assign({
      id: uid(), tipo: 'imagen', nombre: nombre || 'Imagen', visible: true, color: 1,
      figs: figs || [], x: 0, y: 0, z: 0, rot: 0, ancho: 30, alto: 30, altura: 1.2, modo: 'relieve', prof: 1
    }, extra || {});
  }

  /* ---------- proyecto ---------- */
  function proyectoVacio(extra) {
    return Object.assign({
      v: 1, id: uid(), nombre: 'Diseño nuevo', tipo: 'libre', creado: new Date().toISOString(),
      base: { origen: 'figura', figura: 'rrect', params: { redondeo: 0.18 }, txt: 'A', fuente: 'poppins',
              ancho: 60, alto: 30, grosor: 3, color: 1, margen: 4 },
      capas: [],
      argolla: { activa: false, d: 4.5, x: 0, y: 0 },
      montaje: { activa: false, d: 4.5 },
      led: { modo: 'ninguno', muro: 3, alto: 18, fondo: 2, holgura: 0.3, cable: 6 },
      bed: { x: 350, y: 350, z: 350 }
    }, extra || {});
  }

  const PRESETS = {
    llavero: () => {
      const p = proyectoVacio({ nombre: 'Llavero publicitario', tipo: 'llavero' });
      p.base.ancho = 65; p.base.alto = 28; p.base.grosor = 3;
      p.argolla = { activa: true, d: 4.5, x: -26, y: 0 };
      p.capas = [capaTexto('AYÜNKA', { nombre: 'Marca o texto principal', mm: 9, y: 4, x: 4, color: 2 }),
                 capaTexto('+56 9 8542 1490', { nombre: 'Teléfono o segunda línea', mm: 4.5, y: -5, x: 4, color: 2, altura: 1 })];
      return p;
    },
    'llavero-foto': () => {
      const p = proyectoVacio({ nombre: 'Llavero con imagen', tipo: 'llavero-foto' });
      p.base.figura = 'circulo'; p.base.ancho = 40; p.base.alto = 40; p.base.grosor = 3;
      p.argolla = { activa: true, d: 4.5, x: 0, y: 16 };
      return p; // la imagen la agrega Farid desde «Subir imagen»
    },
    'letra-nombre': () => {
      const p = proyectoVacio({ nombre: 'Letra con nombre', tipo: 'letra' });
      // La letra ES la base: se extruye gruesa y se imprime apoyada sobre su cara
      // trasera, igual que las que se venden como decoración de pieza.
      p.base = { origen: 'texto', txt: 'L', fuente: 'poppins', figura: 'rrect', params: {},
                 ancho: 90, alto: 90, grosor: 35, color: 1, margen: 4 };
      p.capas = [capaTexto('Lorena', { nombre: 'Nombre', fuente: 'pacifico', mm: 32, altura: 5, color: 2, y: -14 })];
      return p;
    },
    'caja-luz': () => {
      const p = proyectoVacio({ nombre: 'Caja de luz LED', tipo: 'caja-luz' });
      p.base.ancho = 180; p.base.alto = 90; p.base.grosor = 2.4; p.base.color = 2;
      p.led = { modo: 'caja', muro: 3, alto: 22, fondo: 2, holgura: 0.3, cable: 6 };
      p.capas = [capaTexto('AYÜNKA', { nombre: 'Texto', mm: 34, color: 1, altura: 1.6 })];
      return p;
    },
    'letrero-nombre': () => {
      const p = proyectoVacio({ nombre: 'Letrero con nombre', tipo: 'letrero' });
      p.base.ancho = 160; p.base.alto = 60; p.base.grosor = 3;
      p.montaje = { activa: true, d: 4.5 };
      p.capas = [capaTexto('Lorena', { nombre: 'Nombre', fuente: 'dancing', mm: 34, color: 2, altura: 1.6 })];
      return p;
    },
    recuerdo: () => {
      const p = proyectoVacio({ nombre: 'Recuerdo de nacimiento', tipo: 'recuerdo' });
      p.base.figura = 'nube'; p.base.ancho = 150; p.base.alto = 105; p.base.grosor = 3; p.base.color = 3;
      p.capas = [
        capaTexto('María', { nombre: 'Nombre', fuente: 'pacifico', mm: 20, y: 16, color: 2, altura: 1.6 }),
        capaTexto('27·05·2026', { nombre: 'Fecha', mm: 8, y: -2, color: 2 }),
        capaTexto('3,4 kg · 51 cm', { nombre: 'Peso y talla', mm: 6.5, y: -13, color: 2 }),
        capaFigura('estrella', { ancho: 14, alto: 14, x: -52, y: 26, color: 4 }),
        capaFigura('luna', { ancho: 20, alto: 22, x: 54, y: 24, color: 4 })
      ];
      return p;
    },
    libre: () => proyectoVacio()
  };
  const PRESETS_INFO = [
    { id: 'llavero', label: 'Llavero publicitario', desc: 'Placa con tu marca y argolla' },
    { id: 'llavero-foto', label: 'Llavero con imagen', desc: 'Sube un logo o dibujo y se vuelve 3D' },
    { id: 'letra-nombre', label: 'Letra con nombre', desc: 'Letra gruesa con el nombre en cursiva al frente' },
    { id: 'letrero-nombre', label: 'Letrero con nombre', desc: 'Placa para colgar en la pared' },
    { id: 'caja-luz', label: 'Caja de luz LED', desc: 'Frente difusor + marco para la tira LED' },
    { id: 'recuerdo', label: 'Recuerdo de nacimiento', desc: 'Nube con nombre, fecha y adornos' },
    { id: 'libre', label: 'Desde cero', desc: 'Una placa vacía y agregas lo que quieras' }
  ];

  /* ---------- resolver capas a contornos ---------- */
  async function figsDeCapa(capa) {
    const G = window.D3DFormas;
    let figs = [];
    if (capa.tipo === 'texto') {
      if (!String(capa.txt || '').trim()) return [];
      figs = await window.D3DFuentes.contornos(capa.txt, {
        fuente: capa.fuente, mm: +capa.mm || 10, align: capa.align,
        espaciado: +capa.espaciado || 0, interlinea: +capa.interlinea || 1.25
      });
    } else if (capa.tipo === 'figura') {
      figs = G.figura(capa.figura, +capa.ancho || 15, +capa.alto || 15, capa.params);
    } else if (capa.tipo === 'imagen') {
      if (!capa.figs || !capa.figs.length) return [];
      figs = G.encajar(capa.figs, +capa.ancho || 30, +capa.alto || 30);
    }
    if (!figs.length) return [];
    // escalaX/escalaY dejan estirar el texto sin tocar su tamaño nominal (letras
    // condensadas o altas). En figuras e imágenes el estirado va por ancho/alto.
    return G.transformar(figs, {
      x: +capa.x || 0, y: +capa.y || 0, rot: +capa.rot || 0,
      sx: capa.escalaX != null ? (+capa.escalaX || 1) : 1,
      sy: capa.escalaY != null ? (+capa.escalaY || 1) : 1
    });
  }

  async function figsDeBase(p) {
    const G = window.D3DFormas, b = p.base;
    if (!b || b.origen === 'ninguna') return [];
    if (b.origen === 'imagen') {
      if (!b.figs || !b.figs.length) return [];
      return G.encajar(b.figs, +b.ancho || 60, +b.alto || 60);   // un logo no se deforma
    }
    if (b.origen === 'texto') {
      if (!String(b.txt || '').trim()) return [];
      const figs = await window.D3DFuentes.contornos(b.txt, { fuente: b.fuente, mm: +b.alto || 60, align: 'centro' });
      return figs; // la letra manda su propio tamaño; no se deforma para encajar
    }
    return G.figura(b.figura, +b.ancho || 60, +b.alto || 30, b.params);
  }

  /* ---------- compilar ---------- */
  async function compilar(p) {
    const G = window.D3DFormas;
    const avisos = [], solidos = [], bom = [];
    const b = p.base || {};
    const grosor = Math.max(0.4, +b.grosor || 3);

    let baseFigs = await figsDeBase(p);
    const hayBase = baseFigs.length > 0;

    // capas visibles, resueltas en paralelo
    const capas = (p.capas || []).filter(c => c.visible !== false);
    const resueltas = await Promise.all(capas.map(async c => ({ capa: c, figs: await figsDeCapa(c) })));

    /* Huecos y grabados en la base.
       El grabado se hace SIN booleanas: la base se corta en franjas horizontales y en
       las de arriba se abre el hueco con la forma de la capa. Es la misma técnica de
       la caja de luz, y además deja las contraformas apoyadas en el fondo del grabado
       en vez de sueltas, que es la ventaja de grabar en lugar de calar.            */
    if (hayBase) {
      const bb = G.bboxDe(baseFigs);
      const pasantes = [];
      if (p.argolla && p.argolla.activa) {
        const r = Math.max(0.5, (+p.argolla.d || 4.5) / 2);
        pasantes.push(G.elipse(r, r, 32, +p.argolla.x || 0, +p.argolla.y || 0));
      }
      if (p.montaje && p.montaje.activa) {
        const r = Math.max(0.5, (+p.montaje.d || 4.5) / 2);
        const mx = bb.w / 2 - Math.max(8, bb.w * 0.08), my = bb.h / 2 - Math.max(8, bb.h * 0.12);
        pasantes.push(G.elipse(r, r, 28, -mx, my), G.elipse(r, r, 28, mx, my));
      }
      const caladas = resueltas.filter(r => modoDe(r.capa) === 'calado' && r.figs.length);
      // Van el contorno Y sus contraformas: al anidarlos, el centro de la «o» queda
      // como isla de material dentro del hueco, que es lo fiel al diseño. Sin esto el
      // agujero se comía la letra entera y el aviso de «se caen» mentía.
      for (const r of caladas) for (const f of r.figs) { pasantes.push(f.outer); for (const h of (f.holes || [])) pasantes.push(h); }
      if (caladas.length) {
        const sueltas = caladas.reduce((a, r) => a + r.figs.reduce((n, f) => n + f.holes.length, 0), 0);
        if (sueltas) avisos.push('Al calar hay ' + sueltas + ' contraforma(s) (el centro de la «o», por ejemplo) que quedan sueltas y se van a caer. Cámbialas a grabado, que sí las deja apoyadas.');
      }

      const anillosBase = baseFigs.map(f => f.outer).concat(baseFigs.reduce((a, f) => a.concat(f.holes), []));
      const conPasantes = pasantes.length ? G.anidar(anillosBase.concat(pasantes)) : baseFigs;

      const grabadas = resueltas.filter(r => modoDe(r.capa) === 'grabado' && r.figs.length);
      if (!grabadas.length) {
        solidos.push({ pieza: 'principal', nombre: 'Base', figs: conPasantes, z0: 0, alt: grosor, color: +b.color || 1 });
      } else {
        // cada grabado quita material desde (grosor - prof) hasta arriba
        const desde = new Map();
        for (const r of grabadas) {
          const prof = Math.min(grosor - 0.2, Math.max(0.2, +r.capa.prof || 1));
          desde.set(r, Math.max(0, grosor - prof));
        }
        const cortes = [...new Set([0, grosor].concat([...desde.values()]))].sort((x, y) => x - y);
        for (let i = 0; i < cortes.length - 1; i++) {
          const a = cortes[i], z = cortes[i + 1];
          if (z - a < 0.01) continue;
          const huecosAqui = [];
          for (const [r, d] of desde) if (d <= a + 1e-6) for (const f of r.figs) {
            huecosAqui.push(f.outer);
            for (const h of (f.holes || [])) huecosAqui.push(h);   // la isla del centro de la «o»
          }
          const anillos = conPasantes.map(f => f.outer).concat(conPasantes.reduce((acc, f) => acc.concat(f.holes), []));
          solidos.push({
            pieza: 'principal', nombre: i === 0 ? 'Base' : 'Base (grabada)',
            figs: huecosAqui.length ? G.anidar(anillos.concat(huecosAqui)) : conPasantes,
            z0: a, alt: z - a, color: +b.color || 1
          });
        }
      }
      baseFigs = conPasantes;
    }

    /* Relieves. `z` deja subirlos o hundirlos respecto de la cara de la base, que es
       lo que hace falta cuando la base es una letra de 40 mm y el nombre tiene que
       quedar metido en su cara y no flotando arriba de todo. */
    const zCara = hayBase ? grosor : 0;
    for (const { capa, figs } of resueltas) {
      const modo = modoDe(capa);
      if (!figs.length || modo === 'calado' || modo === 'grabado') continue;
      const alt = Math.max(0.2, +capa.altura || 1.2);
      const z0 = zCara + (+capa.z || 0);
      if (z0 + alt <= 0.001) { avisos.push('«' + (capa.nombre || 'una capa') + '» quedó bajo la mesa con esa altura Z. Súbela.'); continue; }
      solidos.push({ pieza: 'principal', nombre: capa.nombre || 'Capa', figs, z0: Math.max(0, z0), alt: z0 < 0 ? alt + z0 : alt, color: +capa.color || 2, capaId: capa.id });
      if (alt < 0.6) avisos.push('«' + (capa.nombre || 'una capa') + '» tiene ' + alt + ' mm de relieve: con boquilla 0.4 son 3 capas y casi no se nota. Sube a 0.8 mm o más.');
      if (hayBase && (+capa.z || 0) === 0 && fueraDeLaBase(G, figs, baseFigs)) {
        avisos.push('«' + (capa.nombre || 'una capa') + '» se sale del contorno de la base: esa parte queda al aire y necesitará soportes. Muévela adentro o bájala con la altura Z.');
      }
    }

    if (!solidos.length) avisos.push('Todavía no hay nada que imprimir: activa la base o agrega una capa.');

    /* ---------- caja de luz ---------- */
    const led = p.led || {};
    if (led.modo === 'caja' && hayBase) {
      const muro = Math.max(1.2, +led.muro || 3);
      const altoCaja = Math.max(6, +led.alto || 22);
      const fondo = Math.max(0.8, +led.fondo || 2);
      const holgura = Math.max(0, +led.holgura || 0.3);

      // La caja usa solo el contorno exterior de la base (los huecos interiores del
      // frente no tienen por qué atravesar la caja).
      const exts = baseFigs.map(f => f.outer);
      if (exts.length > 1) avisos.push('El frente tiene ' + exts.length + ' piezas sueltas; la caja se hace con la más grande.');
      const ext = exts.slice().sort((a, b2) => Math.abs(G.area(b2)) - Math.abs(G.area(a)))[0];

      const interior = G.contraerSeguro(ext, muro);
      if (!interior) {
        avisos.push('El marco de ' + muro + ' mm no cabe en esa forma. Baja el grosor del muro o agranda el diseño.');
      } else {
        // Marco: anillo entre el borde exterior y el interior.
        solidos.push({ pieza: 'caja', nombre: 'Marco', figs: [{ outer: ext, holes: [interior] }], z0: 0, alt: altoCaja, color: +b.color || 1 });
        // Reborde donde apoya el frente, para que no se hunda hacia adentro.
        const apoyo = G.contraerSeguro(ext, muro + 2.5);
        if (apoyo) solidos.push({ pieza: 'caja', nombre: 'Apoyo del frente', figs: [{ outer: interior, holes: [apoyo] }], z0: altoCaja - grosor - holgura, alt: grosor + holgura, color: +b.color || 1 });
        // Tapa trasera con salida de cable.
        const dCable = Math.max(2, +led.cable || 6);
        const bbE = G.bbox(ext);
        const tapaHueco = G.elipse(dCable / 2, dCable / 2, 24, 0, bbE.y1 + dCable);
        solidos.push({ pieza: 'tapa', nombre: 'Tapa trasera', figs: G.anidar([G.contraerSeguro(ext, holgura) || ext, tapaHueco]), z0: 0, alt: fondo, color: +b.color || 1 });

        const perim = perimetro(ext);
        bom.push('Tira LED de ' + Math.ceil(perim / 10) + ' cm aprox. (el contorno interior mide ' + (perim / 10).toFixed(1) + ' cm)');
        bom.push('Fuente de poder acorde a la tira (5 V USB o 12 V según la que uses)');
        bom.push('Cable e interruptor de paso · la salida del cable queda abajo, de ' + dCable + ' mm');
        avisos.push('El frente se imprime aparte, en PLA blanco o translúcido: 2 paredes y 15-20 % de relleno para que la luz se reparta pareja.');
      }
    } else if (led.modo === 'difusion') {
      bom.push('Tira LED a elección, pegada por detrás');
      avisos.push('Modo difusión: no se agrega geometría. Imprime la pieza en PLA blanco o translúcido con 2 paredes y poco relleno, y pega la tira LED por detrás.');
    }

    const bbTot = G.bboxDe(solidos.reduce((a, s) => a.concat(s.figs), []));
    const altMax = solidos.reduce((a, s) => Math.max(a, s.z0 + s.alt), 0);
    const bed = p.bed || { x: 350, y: 350, z: 350 };
    if (bbTot.w > bed.x || bbTot.h > bed.y) avisos.push('El diseño mide ' + bbTot.w.toFixed(0) + '×' + bbTot.h.toFixed(0) + ' mm y no cabe en la bandeja de ' + bed.x + '×' + bed.y + ' mm.');

    return { solidos, avisos, bom, dims: { ancho: bbTot.w, alto: bbTot.h, espesor: altMax }, piezas: piezasDe(solidos), colores: coloresDe(solidos) };
  }

  // Compatibilidad: los diseños guardados antes usaban `calado: true`.
  function modoDe(capa) { return capa.modo || (capa.calado ? 'calado' : 'relieve'); }

  /* ¿Se sale la capa del contorno de la base? Se mira por muestreo (unos 40 puntos
     por figura): con textos de miles de puntos, comprobarlos todos en cada recálculo
     dejaba el lienzo pegado. */
  function fueraDeLaBase(G, figs, baseFigs) {
    if (!baseFigs || !baseFigs.length) return false;
    let fuera = 0, total = 0;
    for (const f of figs) {
      const n = f.outer.length, paso = Math.max(1, Math.floor(n / 40));
      for (let i = 0; i < n; i += paso) {
        total++;
        const pt = f.outer[i];
        let dentro = false;
        for (const bf of baseFigs) {
          if (G.dentro(pt, bf.outer) && !(bf.holes || []).some(h => G.dentro(pt, h))) { dentro = true; break; }
        }
        if (!dentro) fuera++;
      }
    }
    return total > 0 && fuera / total > 0.08;   // un pelín afuera no es problema
  }

  function perimetro(pts) { let l = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; l += Math.hypot(b[0] - a[0], b[1] - a[1]); } return l; }
  function piezasDe(solidos) { return [...new Set(solidos.map(s => s.pieza))]; }
  function coloresDe(solidos) { return [...new Set(solidos.map(s => s.color))].sort((a, b) => a - b); }

  /* ---------- sólidos → Three.js ---------- */
  function shapeDe(fig) {
    const THREE = window.THREE;
    const s = new THREE.Shape(fig.outer.map(p => new THREE.Vector2(p[0], p[1])));
    for (const h of (fig.holes || [])) s.holes.push(new THREE.Path(h.map(p => new THREE.Vector2(p[0], p[1]))));
    return s;
  }
  function geometriaDe(solido) {
    const THREE = window.THREE;
    const shapes = solido.figs.map(shapeDe);
    const geo = new THREE.ExtrudeGeometry(shapes, { depth: solido.alt, bevelEnabled: false, curveSegments: 12 });
    geo.translate(0, 0, solido.z0);
    return geo;
  }
  function hexDe(i, paleta) { const c = (paleta || COLORES).find(c2 => c2.i === i); return c ? c.hex : '#888888'; }

  /* Devuelve un THREE.Group. `filtroPieza` permite ver solo una pieza (el frente, el marco…). */
  function aThree(compilado, opts) {
    const THREE = window.THREE; opts = opts || {};
    const g = new THREE.Group();
    for (const s of compilado.solidos) {
      if (opts.pieza && s.pieza !== opts.pieza) continue;
      let geo; try { geo = geometriaDe(s); } catch (e) { console.warn('No pude extruir', s.nombre, e); continue; }
      const mat = new THREE.MeshPhongMaterial({ color: new THREE.Color(hexDe(s.color, opts.paleta)), shininess: 18, flatShading: false });
      const m = new THREE.Mesh(geo, mat);
      m.userData = { pieza: s.pieza, color: s.color, nombre: s.nombre, capaId: s.capaId || null };
      g.add(m);
    }
    return g;
  }

  /* ---------- exportar STL binario ----------
     Propio y no el STLExporter de los ejemplos de Three: son 30 líneas, se puede
     probar fuera del navegador y quita una dependencia de CDN más.                 */
  function stlDeGeometrias(geos) {
    let total = 0;
    const prep = geos.map(g => {
      const pos = g.getAttribute('position');
      const idx = g.getIndex();
      const n = idx ? idx.count / 3 : pos.count / 3;
      total += n;
      return { pos, idx, n };
    });
    const buf = new ArrayBuffer(84 + total * 50);
    const dv = new DataView(buf);
    const enc = 'Ayunka Studio - Diseno 3D';
    for (let i = 0; i < enc.length; i++) dv.setUint8(i, enc.charCodeAt(i));
    dv.setUint32(80, total, true);
    let o = 84;
    const ax = [0, 0, 0], bx = [0, 0, 0], cx = [0, 0, 0];
    for (const { pos, idx, n } of prep) {
      for (let t = 0; t < n; t++) {
        for (let k = 0; k < 3; k++) {
          const vi = idx ? idx.getX(t * 3 + k) : t * 3 + k;
          const dst = k === 0 ? ax : k === 1 ? bx : cx;
          dst[0] = pos.getX(vi); dst[1] = pos.getY(vi); dst[2] = pos.getZ(vi);
        }
        const ux = bx[0] - ax[0], uy = bx[1] - ax[1], uz = bx[2] - ax[2];
        const vx = cx[0] - ax[0], vy = cx[1] - ax[1], vz = cx[2] - ax[2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
        dv.setFloat32(o, nx, true); dv.setFloat32(o + 4, ny, true); dv.setFloat32(o + 8, nz, true);
        dv.setFloat32(o + 12, ax[0], true); dv.setFloat32(o + 16, ax[1], true); dv.setFloat32(o + 20, ax[2], true);
        dv.setFloat32(o + 24, bx[0], true); dv.setFloat32(o + 28, bx[1], true); dv.setFloat32(o + 32, bx[2], true);
        dv.setFloat32(o + 36, cx[0], true); dv.setFloat32(o + 40, cx[1], true); dv.setFloat32(o + 44, cx[2], true);
        dv.setUint16(o + 48, 0, true);
        o += 50;
      }
    }
    return { buffer: buf, triangulos: total };
  }

  /* Agrupa los sólidos y devuelve [{nombre, buffer, triangulos}].
     - 'color': un archivo por color, que es lo que pide el CFS de la K2 Combo
     - 'pieza': un archivo por pieza física (frente, marco, tapa)
     - 'todo' : un solo archivo                                                     */
  function exportarSTL(compilado, modo, nombreBase) {
    const nb = (nombreBase || 'diseno').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'diseno';
    const grupos = new Map();
    for (const s of compilado.solidos) {
      const k = modo === 'pieza' ? s.pieza : modo === 'todo' ? 'todo' : (s.pieza + '-color' + s.color);
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k).push(s);
    }
    const out = [];
    for (const [k, ss] of grupos) {
      const geos = [];
      for (const s of ss) { try { geos.push(geometriaDe(s)); } catch (e) { console.warn('No pude extruir', s.nombre, e); } }
      if (!geos.length) continue;
      const r = stlDeGeometrias(geos);
      out.push({ nombre: nb + (k === 'todo' ? '' : '-' + k) + '.stl', buffer: r.buffer, triangulos: r.triangulos, clave: k });
      geos.forEach(g => g.dispose && g.dispose());
    }
    return out;
  }

  window.D3DBuild = {
    COLORES, PRESETS, PRESETS_INFO, proyectoVacio, capaTexto, capaFigura, capaImagen,
    compilar, figsDeCapa, figsDeBase, aThree, geometriaDe, exportarSTL, stlDeGeometrias, hexDe, uid, modoDe
  };
})();
