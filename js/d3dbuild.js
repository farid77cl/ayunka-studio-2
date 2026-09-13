/* Ayünka Studio — compila un proyecto (base + texto + argolla + bolsillo NFC) a sólidos
 * (contornos + z0/alt + color), y esos sólidos a geometría three.js. No toca Three.js al
 * compilar a propósito -- solo geometriaDe()/aThree() lo necesitan. */
(function () {
  'use strict';

  function proyectoVacio(extra) {
    return Object.assign({
      nombre: 'Diseño nuevo',
      base: { ancho: 65, alto: 28, grosor: 3, color: 1 },
      capas: [],
      argolla: { activa: false, d: 4.5, x: -26, y: 0 },
      // Bolsillo para meter un chip NFC a mano durante una pausa de impresión. Círculo
      // de 27mm (no cuadrado, aunque el bounding box sea 27x27 -- verificado el 12-sep
      // contra un 3MF real), entre z=0,80 y z=1,20.
      nfc: { activa: false, d: 27, x: 0, y: 0, z0: 0.8, alt: 0.4 },
      // Medido el 7-sep-2026 contra el perfil de máquina y los límites de Klipper de la K2.
      bed: { x: 260, y: 260, z: 260 }
    }, extra || {});
  }

  function capaTexto(txt, extra) {
    return Object.assign({ tipo: 'texto', txt: txt || 'Texto', mm: 9, x: 0, y: 0, color: 2, altura: 1.2 }, extra || {});
  }

  const PRESETS = {
    llavero: () => {
      const p = proyectoVacio({ nombre: 'Llavero publicitario' });
      p.argolla = { activa: true, d: 4.5, x: -26, y: 0 };
      p.capas = [capaTexto('AYUNKA', { mm: 9, y: 4, x: -18 }), capaTexto('+56 9 8542 1490', { mm: 4.5, y: -5, x: -22, altura: 1 })];
      return p;
    }
  };
  const PRESETS_INFO = [{ id: 'llavero', label: 'Llavero publicitario', desc: 'Placa con tu marca y argolla' }];

  async function compilar(proyecto) {
    const avisos = [], solidos = [];
    const b = proyecto.base;
    const grosor = Math.max(0.4, +b.grosor || 3);
    const rectBase = G.rectRedondeado(b.ancho, b.alto, 3);

    const huecos = [];
    if (proyecto.argolla && proyecto.argolla.activa) {
      const r = Math.max(0.5, (+proyecto.argolla.d || 4.5) / 2);
      huecos.push(G.elipse(r, r, 32, +proyecto.argolla.x || 0, +proyecto.argolla.y || 0));
    }
    const baseConHuecos = huecos.length
      ? [{ outer: rectBase.outer, holes: huecos }]
      : [rectBase];
    solidos.push({ pieza: 'principal', nombre: 'Base', figs: baseConHuecos, z0: 0, alt: grosor, color: +b.color || 1 });

    for (const capa of (proyecto.capas || [])) {
      if (capa.tipo !== 'texto' || !capa.txt) continue;
      const figs = await G.textoAFiguras(capa.txt, +capa.mm || 9);
      const bb = G.bboxDe(figs);
      const dx = (+capa.x || 0) - bb.x1, dy = (+capa.y || 0) - (bb.y1 + bb.y2) / 2;
      const trasladadas = figs.map(f => ({ outer: f.outer.map(([x, y]) => [x + dx, y + dy]), holes: f.holes.map(h => h.map(([x, y]) => [x + dx, y + dy])) }));
      const alt = Math.max(0.4, +capa.altura || 1.2);
      solidos.push({ pieza: 'principal', nombre: capa.txt, figs: trasladadas, z0: grosor, alt, color: +capa.color || 2 });
    }

    if (proyecto.nfc && proyecto.nfc.activa) {
      const r = Math.max(4, (+proyecto.nfc.d || 27) / 2);
      const z0 = Math.max(0, +proyecto.nfc.z0 || 0.8);
      const alt = Math.max(0.2, +proyecto.nfc.alt || 0.4);
      const CAPA = 0.2;
      const fueraDeCapa = Math.abs(alt / CAPA - Math.round(alt / CAPA)) > 0.001;
      if (z0 + alt > grosor - 0.2) {
        avisos.push('El bolsillo NFC no deja al menos 0,2 mm de piso sobre una base de ' + grosor + ' mm.');
      } else if (fueraDeCapa) {
        avisos.push('La profundidad del bolsillo NFC (' + alt + ' mm) no es múltiplo de 0,20 mm -- usa 0,4/0,6/0,8/1,0/1,2.');
      } else {
        solidos.push({ pieza: 'principal', nombre: 'Bolsillo NFC', negativo: true, color: 0,
          figs: [{ outer: G.elipse(r, r, 64, +proyecto.nfc.x || 0, +proyecto.nfc.y || 0), holes: [] }], z0, alt });
        avisos.push('Bolsillo NFC: imprimir a capa 0,20 mm y primera capa 0,20 mm. El 3MF ya trae la pausa.');
      }
    }

    const bbTot = G.bboxDe(solidos.reduce((a, s) => a.concat(s.figs), []));
    const bed = proyecto.bed || { x: 260, y: 260 };
    if (bbTot.w > bed.x || bbTot.h > bed.y) avisos.push('El diseño mide ' + bbTot.w.toFixed(0) + '×' + bbTot.h.toFixed(0) + ' mm y no cabe en la bandeja de ' + bed.x + '×' + bed.y + ' mm.');

    return { solidos, avisos, dims: { ancho: bbTot.w, alto: bbTot.h, espesor: grosor } };
  }

  function shapeDe(fig) {
    const s = new THREE.Shape(fig.outer.map(p => new THREE.Vector2(p[0], p[1])));
    for (const h of (fig.holes || [])) s.holes.push(new THREE.Path(h.map(p => new THREE.Vector2(p[0], p[1]))));
    return s;
  }
  function geometriaDe(solido) {
    const shapes = solido.figs.map(shapeDe);
    const geo = new THREE.ExtrudeGeometry(shapes, { depth: solido.alt, bevelEnabled: false, curveSegments: 12 });
    geo.translate(0, 0, solido.z0);
    return geo;
  }

  const COLORES = { 1: 0xCB5A52, 2: 0xECE6DA, 3: 0x5F7C8E, 4: 0xC27A4E };
  function aThree(compilado) {
    const g = new THREE.Group();
    for (const s of compilado.solidos) {
      let geo; try { geo = geometriaDe(s); } catch (e) { console.warn('No pude extruir', s.nombre, e); continue; }
      const mat = s.negativo
        ? new THREE.MeshPhongMaterial({ color: 0xC0453C, transparent: true, opacity: 0.35, depthWrite: false })
        : new THREE.MeshPhongMaterial({ color: COLORES[s.color] || 0x888888, flatShading: false });
      g.add(new THREE.Mesh(geo, mat));
    }
    return g;
  }

  window.D3DBuild = { PRESETS, PRESETS_INFO, proyectoVacio, capaTexto, compilar, geometriaDe, aThree };
})();
