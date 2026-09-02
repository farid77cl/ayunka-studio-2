/* Ayünka Studio — Diseño 3D · exportar 3MF multicolor.

   El STL no guarda color: es una lista de triángulos y nada más. Por eso una pieza
   pensada en cuatro colores llega al laminador como un bloque de uno solo. El 3MF sí
   lo guarda, y es lo que hay que usar para el CFS de la K2 Combo.

   Se escribe el 3MF con la estructura que usan Creality Print, OrcaSlicer, Bambu
   Studio y PrusaSlicer: un objeto por pieza física y, dentro, un VOLUMEN por color
   con su número de extrusor. Al abrirlo, cada color ya viene asignado a su carrete.

   El ZIP se genera aquí mismo, sin comprimir (método «stored») y sin ninguna
   librería: son cuarenta líneas y evita otra dependencia de CDN, igual que se hizo
   con el exportador de STL.                                                        */
(function () {
  'use strict';
  const esc = window.A.esc; // esta versión no tiene un esc() global suelto, usa el de ui.js

  /* ---------- ZIP ---------- */
  const TABLA = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(b) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < b.length; i++) c = TABLA[(c ^ b[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function zip(archivos) {
    const enc = new TextEncoder();
    const partes = [], central = [];
    let offset = 0;
    for (const a of archivos) {
      const nombre = enc.encode(a.nombre), datos = a.datos;
      const crc = crc32(datos);
      const lh = new Uint8Array(30 + nombre.length);
      const dv = new DataView(lh.buffer);
      dv.setUint32(0, 0x04034b50, true);
      dv.setUint16(4, 20, true); dv.setUint16(6, 0x800, true);  // 0x800 = nombres en UTF-8
      dv.setUint16(8, 0, true);                                  // sin comprimir
      dv.setUint16(10, 0, true); dv.setUint16(12, 0x21, true);   // hora/fecha fijas
      dv.setUint32(14, crc, true);
      dv.setUint32(18, datos.length, true); dv.setUint32(22, datos.length, true);
      dv.setUint16(26, nombre.length, true); dv.setUint16(28, 0, true);
      lh.set(nombre, 30);
      partes.push(lh, datos);

      const ce = new Uint8Array(46 + nombre.length);
      const cv = new DataView(ce.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x800, true); cv.setUint16(10, 0, true);
      cv.setUint16(12, 0, true); cv.setUint16(14, 0x21, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, datos.length, true); cv.setUint32(24, datos.length, true);
      cv.setUint16(28, nombre.length, true);
      cv.setUint32(42, offset, true);
      ce.set(nombre, 46);
      central.push(ce);
      offset += lh.length + datos.length;
    }
    const dirLen = central.reduce((a, c) => a + c.length, 0);
    const fin = new Uint8Array(22);
    const fv = new DataView(fin.buffer);
    fv.setUint32(0, 0x06054b50, true);
    fv.setUint16(8, archivos.length, true); fv.setUint16(10, archivos.length, true);
    fv.setUint32(12, dirLen, true); fv.setUint32(16, offset, true);
    const todo = partes.concat(central, [fin]);
    const total = todo.reduce((a, p) => a + p.length, 0);
    const out = new Uint8Array(total);
    let o = 0;
    for (const p of todo) { out.set(p, o); o += p.length; }
    return out;
  }

  /* ---------- geometría → malla indexada ---------- */
  function mallaDe(geos) {
    const verts = [], tris = [], indice = new Map();
    const clave = (x, y, z) => (Math.round(x * 1e4) / 1e4) + ',' + (Math.round(y * 1e4) / 1e4) + ',' + (Math.round(z * 1e4) / 1e4);
    for (const g of geos) {
      const pos = g.getAttribute('position'), idx = g.getIndex();
      const n = idx ? idx.count : pos.count;
      const tri = [];
      for (let i = 0; i < n; i++) {
        const vi = idx ? idx.getX(i) : i;
        const x = pos.getX(vi), y = pos.getY(vi), z = pos.getZ(vi);
        const k = clave(x, y, z);
        let j = indice.get(k);
        if (j === undefined) { j = verts.length; verts.push([x, y, z]); indice.set(k, j); }
        tri.push(j);
        if (tri.length === 3) {
          // los triángulos degenerados hacen que el laminador se queje de malla rota
          if (tri[0] !== tri[1] && tri[1] !== tri[2] && tri[0] !== tri[2]) tris.push(tri.slice());
          tri.length = 0;
        }
      }
    }
    return { verts, tris };
  }


  /* ---------- 3MF ----------
     `compilado` viene de D3DBuild.compilar. Se agrupa por pieza física (cada una es
     un objeto que el laminador puede mover por separado) y, dentro, por color.     */
  function exportar3MF(compilado, nombreBase, opts) {
    opts = opts || {};
    const B = window.D3DBuild;
    const enc = new TextEncoder();
    const nb = (nombreBase || 'diseno').trim() || 'diseno';

    /* Formato Bambu / Orca / Creality Print: cada color es un OBJETO propio con su
       malla, y un objeto contenedor los junta con <components>. El config asigna el
       extrusor a cada <part>.

       Antes se escribía al estilo PrusaSlicer (una sola malla y los colores como
       rangos de triángulos en <volume firstid lastid>). Es 3MF válido, pero Creality
       Print no lo interpreta: cargaba la pieza entera de un color. */
    const piezas = [...new Set(compilado.solidos.map(s => s.pieza))];
    const hojas = [];        // {id, nombre, extruder, verts, tris}
    const contenedores = []; // {id, nombre, partes:[hoja]}
    let id = 1;

    for (const pieza of piezas) {
      const deLaPieza = compilado.solidos.filter(s => s.pieza === pieza);
      const colores = [...new Set(deLaPieza.map(s => s.color))].sort((a, b) => a - b);
      const partes = [];
      for (const color of colores) {
        const geos = [];
        for (const s of deLaPieza.filter(x => x.color === color)) {
          try { geos.push(B.geometriaDe(s)); } catch (e) { console.warn('No pude extruir', s.nombre, e); }
        }
        if (!geos.length) continue;
        const m = mallaDe(geos);
        geos.forEach(g => g.dispose && g.dispose());
        if (!m.tris.length) continue;
        const hoja = { id: ++id, nombre: 'Color ' + color, extruder: color, verts: m.verts, tris: m.tris };
        hojas.push(hoja); partes.push(hoja);
      }
      if (!partes.length) continue;
      contenedores.push({ id: ++id, nombre: piezas.length > 1 ? (nb + ' · ' + pieza) : nb, partes });
    }

    if (!contenedores.length) return null;

    /* --- 3D/3dmodel.model --- */
    let modelo = '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">\n' +
      ' <metadata name="Application">Ayunka Studio</metadata>\n' +
      ' <metadata name="Title">' + esc(nb) + '</metadata>\n' +
      ' <resources>\n';
    for (const h of hojas) {
      modelo += '  <object id="' + h.id + '" type="model" name="' + esc(h.nombre) + '">\n   <mesh>\n    <vertices>\n';
      const v = [];
      for (const p of h.verts) v.push('     <vertex x="' + f(p[0]) + '" y="' + f(p[1]) + '" z="' + f(p[2]) + '"/>');
      modelo += v.join('\n') + '\n    </vertices>\n    <triangles>\n';
      const t = [];
      for (const q of h.tris) t.push('     <triangle v1="' + q[0] + '" v2="' + q[1] + '" v3="' + q[2] + '"/>');
      modelo += t.join('\n') + '\n    </triangles>\n   </mesh>\n  </object>\n';
    }
    for (const c of contenedores) {
      modelo += '  <object id="' + c.id + '" type="model" name="' + esc(c.nombre) + '">\n   <components>\n';
      for (const h of c.partes) modelo += '    <component objectid="' + h.id + '" transform="1 0 0 0 1 0 0 0 1 0 0 0"/>\n';
      modelo += '   </components>\n  </object>\n';
    }
    modelo += ' </resources>\n <build>\n';
    for (const c of contenedores) modelo += '  <item objectid="' + c.id + '" transform="1 0 0 0 1 0 0 0 1 0 0 0" printable="1"/>\n';
    modelo += ' </build>\n</model>\n';

    /* --- Metadata/model_settings.config ---
       Aquí es donde cada parte recibe su número de extrusor, que es lo que hace que
       el color caiga en el carrete correcto del CFS. */
    let cfg = '<?xml version="1.0" encoding="UTF-8"?>\n<config>\n';
    for (const c of contenedores) {
      cfg += '  <object id="' + c.id + '">\n';
      cfg += '    <metadata key="name" value="' + esc(c.nombre) + '"/>\n';
      cfg += '    <metadata key="extruder" value="' + c.partes[0].extruder + '"/>\n';
      for (const h of c.partes) {
        cfg += '    <part id="' + h.id + '" subtype="normal_part">\n';
        cfg += '      <metadata key="name" value="' + esc(h.nombre) + '"/>\n';
        cfg += '      <metadata key="extruder" value="' + h.extruder + '"/>\n';
        cfg += '      <mesh_stat edges_fixed="0" degenerate_facets="0" facets_removed="0" facets_reversed="0" backwards_edges="0"/>\n';
        cfg += '    </part>\n';
      }
      cfg += '  </object>\n';
    }
    cfg += '</config>\n';

    const tipos = '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n' +
      ' <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\n' +
      ' <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>\n' +
      '</Types>\n';
    const rels = '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n' +
      ' <Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>\n' +
      '</Relationships>\n';

    const datos = zip([
      { nombre: '[Content_Types].xml', datos: enc.encode(tipos) },
      { nombre: '_rels/.rels', datos: enc.encode(rels) },
      { nombre: '3D/3dmodel.model', datos: enc.encode(modelo) },
      { nombre: 'Metadata/model_settings.config', datos: enc.encode(cfg) }
    ]);

    return {
      nombre: nb.toLowerCase().replace(/[^a-z0-9áéíóúñ]+/gi, '-').replace(/(^-|-$)/g, '') + '.3mf',
      datos,
      objetos: contenedores.length,
      partes: hojas.length,
      colores: [...new Set(hojas.map(h => h.extruder))].sort((a, b) => a - b),
      triangulos: hojas.reduce((a, h) => a + h.tris.length, 0)
    };
  }
  function f(n) { return (Math.round(n * 1e4) / 1e4).toString(); }

  window.D3D3MF = { exportar3MF, zip, crc32, mallaDe };
})();
