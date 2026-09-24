/* Ayünka Studio — 3MF de una plantilla, con el ARMAZÓN que trae la propia plantilla
 * (cabeceras de Creality, perfil de la variante, pausa). Las piezas van en el orden del
 * JSON: part id 1..N, y el negative_part último con el id más alto — Creality reconoce el
 * bolsillo por su número (trampa 1 de la skill llavero-nfc-desde-3mf).
 *
 * Reutiliza D3D3MF.zip (ZIP sin comprimir) y D3D3MF.unzip; la extrusión es propia (abajo). */
(function () {
  'use strict';
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const f = n => (Math.round(n * 1e4) / 1e4).toString();
  const hex = n => { let s = ''; for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 16).toString(16); return s; };
  const uuid = i => i.toString(16).padStart(8, '0') + '-' + hex(4) + '-' + hex(4) + '-' + hex(4) + '-' + hex(12);
  const sinTildes = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

  // ------------------------------------------------------------------ extrusión conforme
  // No se usa THREE.ExtrudeGeometry para el ARCHIVO: su earcut, con los huecos alineados en
  // grilla del QR, tiende puentes colineales con otros bordes y deja la tapa con aristas que
  // atraviesan vértices (T) -> malla no-manifold (76 aristas sueltas en SOFÍA con QR). Aquí
  // la tapa sale de earcut, se botan los triángulos de área cero y cada triángulo que tenga
  // un vértice de la figura en medio de una arista se parte en abanico desde su centroide.
  // Las paredes salen de los anillos tal cual, como extruir() del Python.
  const area2 = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
  const areaAnillo = r => { let s = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]); return s / 2; };
  function enMedio(p, a, b) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 1e-9 || Math.abs(area2(a, b, p)) / L > 1e-7) return false;
    const t = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / (L * L);
    return t > 1e-9 && t < 1 - 1e-9;
  }
  function tapa(anillos) {
    const T = window.THREE;
    const v2 = r => r.map(p => new T.Vector2(p[0], p[1]));
    const pts = anillos.reduce((a, r) => a.concat(r), []);
    const caras = T.ShapeUtils.triangulateShape(v2(anillos[0]), anillos.slice(1).map(v2));
    const out = [];
    for (const [i, j, k] of caras) {
      const A = pts[i], B = pts[j], C = pts[k];
      if (Math.abs(area2(A, B, C)) < 1e-10) continue;
      const bx = [Math.min(A[0], B[0], C[0]) - 1e-6, Math.max(A[0], B[0], C[0]) + 1e-6, Math.min(A[1], B[1], C[1]) - 1e-6, Math.max(A[1], B[1], C[1]) + 1e-6];
      const borde = [];
      for (const [u, w] of [[i, j], [j, k], [k, i]]) {
        borde.push(u);
        const medio = [];
        pts.forEach((p, n) => {
          if (n !== u && n !== w && p[0] >= bx[0] && p[0] <= bx[1] && p[1] >= bx[2] && p[1] <= bx[3] && enMedio(p, pts[u], pts[w])) medio.push(n);
        });
        medio.sort((a, b) => Math.hypot(pts[a][0] - pts[u][0], pts[a][1] - pts[u][1]) - Math.hypot(pts[b][0] - pts[u][0], pts[b][1] - pts[u][1]));
        borde.push(...medio);
      }
      if (borde.length === 3) { out.push([i, j, k]); continue; }
      const c = pts.length;
      pts.push([(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3]);
      for (let q = 0; q < borde.length; q++) out.push([c, borde[q], borde[(q + 1) % borde.length]]);
    }
    return { pts, tris: out };
  }
  /** Figuras -> { verts, tris } cerrada, tapas mirando hacia afuera. */
  function extruir(figs, z0, z1) {
    const verts = [], tris = [];
    for (const f of figs) {
      const anillos = [f.outer].concat(f.holes || []).map(r => r.slice());
      if (areaAnillo(anillos[0]) < 0) anillos[0].reverse();                 // exterior antihorario
      for (let h = 1; h < anillos.length; h++) if (areaAnillo(anillos[h]) > 0) anillos[h].reverse();   // huecos horario
      const n = anillos.reduce((a, r) => a + r.length, 0);
      const t = tapa(anillos);
      const base = verts.length, m = t.pts.length;
      for (const p of t.pts) verts.push([p[0], p[1], z0]);
      for (const p of t.pts) verts.push([p[0], p[1], z1]);
      for (const [a, b, c] of t.tris) {
        const [p, q, r] = area2(t.pts[a], t.pts[b], t.pts[c]) > 0 ? [a, b, c] : [a, c, b];
        tris.push([base + m + p, base + m + q, base + m + r]);   // arriba, antihorario visto desde +z
        tris.push([base + r, base + q, base + p]);               // abajo
      }
      let off = 0;
      for (const r of anillos) {
        for (let i = 0; i < r.length; i++) {
          const a = base + off + i, b = base + off + (i + 1) % r.length;
          tris.push([a, b, b + m], [a, b + m, a + m]);
        }
        off += r.length;
      }
      if (off !== n) throw new Error('anillos inconsistentes');
    }
    return { verts, tris };
  }

  function espejar(figs) {
    const m = r => r.map(p => [-p[0], p[1]]);
    return figs.map(g => ({ outer: m(g.outer), holes: (g.holes || []).map(m) }));
  }

  /** Título interno y nombre de archivo, desde el patrón `archivo` de la plantilla. */
  function nombres(plantilla, comp) {
    const pat = plantilla.archivo || (plantilla.nombre + ' - {variante} {NOMBRE}');
    const texto = (plantilla.parametros || []).find(p => p.tipo === 'texto');
    const NOMBRE = texto && comp.info[texto.id] ? comp.info[texto.id].texto : '';
    const conQR = (plantilla.parametros || []).some(p => p.tipo === 'telefono-qr' && comp.info[p.id]);
    const base = pat.replace('{variante}', comp.variante).replace('{NOMBRE}', NOMBRE).replace(/\s+/g, ' ');
    return {
      titulo: base.replace('{ QR}', '').trim(),
      archivo: sinTildes(base.replace('{ QR}', conQR ? ' QR' : '')).replace(/[\\/:*?"<>|]+/g, '').trim() + '.3mf'
    };
  }

  function exportar(plantilla, comp) {
    const G = window.Plantillas.geo;
    const variante = plantilla.variantes.find(v => v.id === comp.variante);
    const arm = plantilla.armazon3mf;
    const { titulo, archivo } = nombres(plantilla, comp);
    const partes = [], objetos = [], componentes = [];

    comp.piezas.forEach((pz, k) => {
      const id = k + 1;
      const figs = pz.espejoX ? espejar(pz.figs) : pz.figs;
      const alt = pz.z[1] - pz.z[0];
      const e = extruir(figs, pz.z[0], pz.z[1]);
      const m = { verts: e.verts, tris: e.tris };
      const vs = m.verts.map(p => '    <vertex x="' + f(p[0]) + '" y="' + f(p[1]) + '" z="' + f(p[2]) + '"/>').join('\n');
      const ts = m.tris.map(t => '    <triangle v1="' + t[0] + '" v2="' + t[1] + '" v3="' + t[2] + '"/>').join('\n');
      objetos.push('  <object id="' + id + '" p:UUID="' + uuid(id) + '" type="model">\n  <mesh>\n   <vertices>\n' + vs +
        '\n   </vertices>\n   <triangles>\n' + ts + '\n   </triangles>\n  </mesh>\n  </object>');
      componentes.push('    <component p:path="/3D/Objects/object_1.model" objectid="' + id + '" p:UUID="' + uuid(id) +
        '" transform="1 0 0 0 1 0 0 0 1 0 0 0"/>');
      partes.push({ id, nombre: pz.nombre, subtipo: pz.subtipo, extrusor: pz.extrusor,
        triangulos: m.tris.length, esperado: G.area(pz.figs) * alt });
    });

    const ms = ['<?xml version="1.0" encoding="UTF-8"?>', '<config>', '  <object id="100">',
      '    <metadata key="name" value="' + esc(titulo) + '"/>', '    <metadata key="extruder" value="1"/>'];
    for (const p of partes) {
      ms.push('    <part id="' + p.id + '" subtype="' + p.subtipo + '">',
        '      <metadata key="name" value="' + esc(p.nombre) + '"/>',
        '      <metadata key="matrix" value="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1"/>',
        '      <metadata key="extruder" value="' + p.extrusor + '"/>',
        '      <mesh_stat edges_fixed="0" degenerate_facets="0" facets_removed="0" facets_reversed="0" backwards_edges="0"/>',
        '    </part>');
    }
    ms.push('  </object>', '</config>', '');

    const perfil = Object.assign({}, variante.perfil, { filament_colour: comp.filamentos.slice() });
    const generado = {
      objetos: arm.objetoCabecera.split('{{TITULO}}').join(esc(titulo)) + '<resources>\n' + objetos.join('\n') + '\n </resources>\n <build/>\n</model>\n',
      modelo: arm.modeloPlantilla.split('{{TITULO}}').join(esc(titulo)).replace('{{COMPONENTES}}', componentes.join('\n')),
      piezas: ms.join('\n'),
      perfil: JSON.stringify(perfil, null, 4)
    };
    const enc = new TextEncoder();
    const archivos = arm.entradas.map(e => ({ nombre: e.nombre, datos: enc.encode(e.genera ? generado[e.genera] : e.texto) }));
    return { datos: window.D3D3MF.zip(archivos), nombreArchivo: archivo, titulo, partes };
  }

  /** Compuerta sobre el archivo YA ESCRITO: se relee el zip, no se confía en las variables. */
  function verificar(datos, plantilla) {
    const problemas = [];
    const z = window.D3D3MF.unzip(datos);
    const txt = n => z[n] ? new TextDecoder().decode(z[n]) : '';
    const ms = txt('Metadata/model_settings.config');
    const ps = [...ms.matchAll(/<part id="(\d+)" subtype="(\w+)">[\s\S]*?<metadata key="extruder" value="(\d+)"\/>/g)]
      .map(m => ({ id: +m[1], subtipo: m[2], extrusor: +m[3] }));
    if (!ps.length) problemas.push('No hay piezas en model_settings.config.');
    if (ps.some((p, i) => p.id !== i + 1)) problemas.push('Los part id no son 1..N contiguos.');
    const esperaNeg = plantilla.piezas.some(p => p.subtipo === 'negative_part');
    const neg = ps.filter(p => p.subtipo === 'negative_part');
    if (esperaNeg && (neg.length !== 1 || neg[0].id !== ps.length || neg[0].extrusor !== 0)) {
      problemas.push('El bolsillo del chip no es el único negative_part con el id más alto: el llavero saldría macizo.');
    }
    const comps = [...txt('3D/3dmodel.model').matchAll(/<component [^>]*objectid="(\d+)"/g)].map(m => +m[1]);
    if (comps.join() !== ps.map(p => p.id).join()) problemas.push('Los componentes no apuntan a las mallas en orden.');
    const objs = (txt('3D/Objects/object_1.model').match(/<object id=/g) || []).length;
    if (objs !== ps.length) problemas.push('Hay ' + objs + ' mallas para ' + ps.length + ' piezas.');
    if (plantilla.pausa) {
      const m = txt('Metadata/custom_gcode_per_layer.xml').match(/top_z="([\d.]+)"[^>]*gcode="PAUSE"/);
      if (!m || Math.abs(+m[1] - plantilla.pausa.topZ) > 1e-6) problemas.push('La pausa no está en z=' + plantilla.pausa.topZ + '.');
    }
    try {
      const perfil = JSON.parse(txt('Metadata/project_settings.config'));
      const maxExt = Math.max(...ps.map(p => p.extrusor));
      if (perfil.filament_colour.length !== maxExt) problemas.push('El perfil trae ' + perfil.filament_colour.length + ' carretes y las piezas usan ' + maxExt + '.');
    } catch (e) { problemas.push('El perfil no se puede leer.'); }
    return { ok: !problemas.length, problemas };
  }

  window.Plantilla3MF = { exportar, verificar, nombres, extruir, espejar };
})();
