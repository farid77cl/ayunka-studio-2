/* Ayünka Studio — Diseño 3D · exportar 3MF multicolor, con negative_part para el
   bolsillo NFC, la pausa, y bandejas de varias copias. Mismo diseño verificado el
   12-sep-2026 contra G-code real -- ver los comentarios de cada función para el porqué
   de cada número. Sin librería: el ZIP se escribe acá mismo, "stored" (sin comprimir). */
(function () {
  'use strict';
  const esc = window.A.esc;

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
      dv.setUint16(4, 20, true); dv.setUint16(6, 0x800, true);
      dv.setUint16(8, 0, true);
      dv.setUint16(10, 0, true); dv.setUint16(12, 0x21, true);
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
          if (tri[0] !== tri[1] && tri[1] !== tri[2] && tri[0] !== tri[2]) tris.push(tri.slice());
          tri.length = 0;
        }
      }
    }
    return { verts, tris };
  }

  function exportar3MF(compilado, nombreBase, opts) {
    opts = opts || {};
    const B = window.D3DBuild;
    const enc = new TextEncoder();
    const nb = (nombreBase || 'diseno').trim() || 'diseno';

    const piezas = [...new Set(compilado.solidos.map(s => s.pieza))];
    const hojas = [], contenedores = [];
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
        const negativo = deLaPieza.filter(x => x.color === color).some(x => x.negativo);
        const hoja = { id: ++id, nombre: negativo ? 'Bolsillo NFC' : 'Color ' + color, extruder: color, verts: m.verts, tris: m.tris, negativo };
        hojas.push(hoja); partes.push(hoja);
      }
      if (!partes.length) continue;
      contenedores.push({ id: ++id, nombre: piezas.length > 1 ? (nb + ' · ' + pieza) : nb, partes });
    }
    if (!contenedores.length) return null;

    let modelo = '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">\n' +
      ' <metadata name="Application">Ayunka Studio</metadata>\n' +
      ' <metadata name="Title">' + esc(nb) + '</metadata>\n' +
      ' <resources>\n';
    for (const h of hojas) {
      modelo += '  <object id="' + h.id + '" type="model" name="' + esc(h.nombre) + '">\n   <mesh>\n    <vertices>\n';
      modelo += h.verts.map(p => '     <vertex x="' + f(p[0]) + '" y="' + f(p[1]) + '" z="' + f(p[2]) + '"/>').join('\n') + '\n    </vertices>\n    <triangles>\n';
      modelo += h.tris.map(q => '     <triangle v1="' + q[0] + '" v2="' + q[1] + '" v3="' + q[2] + '"/>').join('\n') + '\n    </triangles>\n   </mesh>\n  </object>\n';
    }
    for (const c of contenedores) {
      modelo += '  <object id="' + c.id + '" type="model" name="' + esc(c.nombre) + '">\n   <components>\n';
      for (const h of c.partes) modelo += '    <component objectid="' + h.id + '" transform="1 0 0 0 1 0 0 0 1 0 0 0"/>\n';
      modelo += '   </components>\n  </object>\n';
    }
    modelo += ' </resources>\n <build>\n';
    const copias = (opts.copias && opts.copias.length) ? opts.copias : [{ x: 0, y: 0 }];
    for (const c of contenedores) for (const cp of copias) {
      modelo += '  <item objectid="' + c.id + '" transform="1 0 0 0 1 0 0 0 1 ' + f(cp.x) + ' ' + f(cp.y) + ' 0" printable="1"/>\n';
    }
    modelo += ' </build>\n</model>\n';

    let cfg = '<?xml version="1.0" encoding="UTF-8"?>\n<config>\n';
    for (const c of contenedores) {
      cfg += '  <object id="' + c.id + '">\n    <metadata key="name" value="' + esc(c.nombre) + '"/>\n    <metadata key="extruder" value="' + c.partes[0].extruder + '"/>\n';
      for (const h of c.partes) {
        cfg += '    <part id="' + h.id + '" subtype="' + (h.negativo ? 'negative_part' : 'normal_part') + '">\n';
        cfg += '      <metadata key="name" value="' + esc(h.nombre) + '"/>\n      <metadata key="extruder" value="' + h.extruder + '"/>\n';
        cfg += '      <mesh_stat edges_fixed="0" degenerate_facets="0" facets_removed="0" facets_reversed="0" backwards_edges="0"/>\n    </part>\n';
      }
      cfg += '  </object>\n';
    }
    cfg += '</config>\n';

    const tipos = '<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n' +
      ' <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\n' +
      ' <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>\n</Types>\n';
    const rels = '<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n' +
      ' <Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>\n</Relationships>\n';

    const archivos = [
      { nombre: '[Content_Types].xml', datos: enc.encode(tipos) },
      { nombre: '_rels/.rels', datos: enc.encode(rels) },
      { nombre: '3D/3dmodel.model', datos: enc.encode(modelo) },
      { nombre: 'Metadata/model_settings.config', datos: enc.encode(cfg) }
    ];

    const bolsillos = compilado.solidos.filter(s => s.negativo);
    let pausaZ = null;
    if (bolsillos.length) {
      const CAPA = 0.2;
      const techo = Math.max(...bolsillos.map(s => s.z0 + s.alt));
      pausaZ = Math.round((techo + CAPA) * 100) / 100;
      const pausas = '<?xml version="1.0" encoding="utf-8"?>\n<custom_gcodes_per_layer>\n<plate>\n<plate_info id="1"/>\n' +
        '<layer top_z="' + pausaZ + '" type="1" extruder="1" color="" extra="" gcode="PAUSE"/>\n<mode value="MultiAsSingle"/>\n</plate>\n</custom_gcodes_per_layer>\n';
      archivos.push({ nombre: 'Metadata/custom_gcode_per_layer.xml', datos: enc.encode(pausas) });
    }

    const datos = zip(archivos);
    return {
      nombre: nb.toLowerCase().replace(/[^a-z0-9áéíóúñ]+/gi, '-').replace(/(^-|-$)/g, '') + '.3mf',
      datos, objetos: contenedores.length, partes: hojas.length,
      colores: [...new Set(hojas.map(h => h.extruder))].sort((a, b) => a - b),
      triangulos: hojas.reduce((a, h) => a + h.tris.length, 0),
      pausaZ, copias: copias.length
    };
  }
  function f(n) { return (Math.round(n * 1e4) / 1e4).toString(); }

  function unzip(datos) {
    const dv = new DataView(datos.buffer, datos.byteOffset, datos.byteLength);
    const out = {};
    let o = 0;
    while (o + 4 <= datos.length && dv.getUint32(o, true) === 0x04034b50) {
      const nombreLen = dv.getUint16(o + 26, true);
      const extraLen = dv.getUint16(o + 28, true);
      const tam = dv.getUint32(o + 22, true);
      const nombre = new TextDecoder().decode(datos.subarray(o + 30, o + 30 + nombreLen));
      const inicioDatos = o + 30 + nombreLen + extraLen;
      out[nombre] = datos.subarray(inicioDatos, inicioDatos + tam);
      o = inicioDatos + tam;
    }
    return out;
  }

  function verificarNFC(exportado) {
    const problemas = [];
    const archivos = unzip(exportado.datos);
    const cfgTxt = archivos['Metadata/model_settings.config'] ? new TextDecoder().decode(archivos['Metadata/model_settings.config']) : '';
    const tieneNegativo = /subtype="negative_part"/.test(cfgTxt);
    if (exportado.pausaZ != null && !tieneNegativo) problemas.push('Se esperaba un negative_part y no está.');
    const pausaTxt = archivos['Metadata/custom_gcode_per_layer.xml'] ? new TextDecoder().decode(archivos['Metadata/custom_gcode_per_layer.xml']) : null;
    let pausaZLeida = null;
    if (exportado.pausaZ != null) {
      if (!pausaTxt) problemas.push('Falta Metadata/custom_gcode_per_layer.xml.');
      else {
        const m = pausaTxt.match(/top_z="([\d.]+)"[^>]*gcode="PAUSE"/);
        pausaZLeida = m ? parseFloat(m[1]) : null;
        if (pausaZLeida == null) problemas.push('No trae un <layer gcode="PAUSE">.');
        else if (Math.abs(pausaZLeida - exportado.pausaZ) > 0.001) problemas.push('La pausa quedó en z=' + pausaZLeida + ', debía ser ' + exportado.pausaZ + '.');
      }
    }
    return { ok: !problemas.length, problemas, tieneNegativo, pausaZ: pausaZLeida };
  }

  function posicionesBandeja(anchoPieza, largoPieza, opts) {
    opts = opts || {};
    const bed = opts.bed || { x: 260, y: 260 };
    const margen = opts.margen != null ? opts.margen : 6;
    const exclusion = opts.exclusion || { x0: 0, y0: 220, x1: 80, y1: 260 };
    const pasoX = anchoPieza + margen, pasoY = largoPieza + margen;
    const cols = Math.max(1, Math.floor((bed.x - margen) / pasoX));
    const filas = Math.max(1, Math.floor((bed.y - margen) / pasoY));
    const out = [];
    for (let f2 = 0; f2 < filas; f2++) for (let c = 0; c < cols; c++) {
      const xAbs = margen + pasoX * c + anchoPieza / 2, yAbs = margen + pasoY * f2 + largoPieza / 2;
      const fuera = (xAbs + anchoPieza / 2) > bed.x || (yAbs + largoPieza / 2) > bed.y;
      const enExclusion = !(xAbs + anchoPieza / 2 < exclusion.x0 || xAbs - anchoPieza / 2 > exclusion.x1 || yAbs + largoPieza / 2 < exclusion.y0 || yAbs - largoPieza / 2 > exclusion.y1);
      if (fuera || enExclusion) continue;
      out.push({ x: xAbs - bed.x / 2, y: yAbs - bed.y / 2 });
    }
    return out;
  }

  window.D3D3MF = { exportar3MF, zip, unzip, verificarNFC, posicionesBandeja, crc32, mallaDe };
})();
