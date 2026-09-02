/* Ayünka Studio · lector de 3MF.
 *
 * LO QUE ESTE LECTOR SÍ SABE, porque está escrito en el archivo:
 *   · cuántas piezas hay en la bandeja
 *   · la medida real de cada pieza (bbox), aplicando las transformaciones
 *   · el volumen de material: cuerpos positivos menos los negativos (bolsillos)
 *   · la altura de capa, y si hay una pausa programada
 *
 * LO QUE NO SABE, Y NO VA A INVENTAR: los gramos y las horas.
 * No es pereza. Se midió contra los 11 productos de Ayünka que tienen gramos y horas de
 * G-code real: el caudal va de **14 a 43 g/h** según la forma —un fidget de pared delgada
 * tarda el triple por gramo que una repisa maciza— y un modelo lineal se equivoca un 42%
 * en promedio y hasta un 154%. Un presupuesto con ese error no es un presupuesto.
 *
 * Así que los pide: se lamina una vez en Creality Print y se copian los dos números. Todo
 * lo demás —costo, precio, tramos, bandejas, plazo, dónde cae la pausa del chip— lo calcula
 * la app, que es la parte que hoy se hace a mano.
 *
 * Sin dependencias: el ZIP se lee a mano y se infla con DecompressionStream.
 */
(function () {

  /* ---------- ZIP ---------- */

  async function inflar(buf) {
    const ds = new DecompressionStream('deflate-raw');
    const stream = new Blob([buf]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  /** Lee el directorio central del zip y devuelve {nombre: () => Promise<Uint8Array>} */
  async function abrirZip(arrayBuffer) {
    const b = new Uint8Array(arrayBuffer);
    const dv = new DataView(arrayBuffer);
    // buscar el End Of Central Directory hacia atrás
    let eocd = -1;
    for (let i = b.length - 22; i >= Math.max(0, b.length - 66000); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('No parece un archivo 3MF válido (no encontré el índice del ZIP).');
    const nEntradas = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);

    const archivos = {};
    const dec = new TextDecoder();
    for (let i = 0; i < nEntradas; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const metodo = dv.getUint16(p + 10, true);
      const compSize = dv.getUint32(p + 20, true);
      const nLen = dv.getUint16(p + 28, true);
      const eLen = dv.getUint16(p + 30, true);
      const cLen = dv.getUint16(p + 32, true);
      const off = dv.getUint32(p + 42, true);
      const nombre = dec.decode(b.subarray(p + 46, p + 46 + nLen));
      archivos[nombre] = { metodo, compSize, off };
      p += 46 + nLen + eLen + cLen;
    }

    async function leer(nombre) {
      const e = archivos[nombre];
      if (!e) return null;
      const nLen = dv.getUint16(e.off + 26, true);
      const eLen = dv.getUint16(e.off + 28, true);
      const ini = e.off + 30 + nLen + eLen;
      const crudo = b.subarray(ini, ini + e.compSize);
      return e.metodo === 0 ? crudo : await inflar(crudo);
    }
    const texto = async n => { const d = await leer(n); return d ? new TextDecoder().decode(d) : null; };
    return { nombres: Object.keys(archivos), leer, texto };
  }

  /* ---------- geometría ---------- */

  const matriz = t => {
    const v = (t || '').trim().split(/\s+/).map(Number);
    if (v.length < 12) return null;
    return { R: v.slice(0, 9), T: v.slice(9, 12) };
  };
  const aplicar = (p, m) => m ? [
    p[0] * m.R[0] + p[1] * m.R[3] + p[2] * m.R[6] + m.T[0],
    p[0] * m.R[1] + p[1] * m.R[4] + p[2] * m.R[7] + m.T[1],
    p[0] * m.R[2] + p[1] * m.R[5] + p[2] * m.R[8] + m.T[2]
  ] : p;

  function mallasDe(txt) {
    const out = {};
    const re = /<object id="(\d+)"[^>]*>([\s\S]*?)<\/object>/g;
    let m;
    while ((m = re.exec(txt))) {
      const cuerpo = m[2];
      const vs = [], ts = [];
      const rv = /<vertex x="([-\d.eE+]+)" y="([-\d.eE+]+)" z="([-\d.eE+]+)"/g;
      let v; while ((v = rv.exec(cuerpo))) vs.push([+v[1], +v[2], +v[3]]);
      const rt = /<triangle v1="(\d+)" v2="(\d+)" v3="(\d+)"/g;
      let t; while ((t = rt.exec(cuerpo))) ts.push([+t[1], +t[2], +t[3]]);
      if (vs.length && ts.length) out[+m[1]] = { vs, ts };
    }
    return out;
  }

  /** Volumen firmado (mm³) y caja envolvente de una malla ya transformada. */
  function medir(malla, m) {
    let vol = 0;
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    const P = malla.vs.map(p => aplicar(p, m));
    for (const p of P) for (let k = 0; k < 3; k++) {
      if (p[k] < lo[k]) lo[k] = p[k];
      if (p[k] > hi[k]) hi[k] = p[k];
    }
    for (const [i, j, k] of malla.ts) {
      const a = P[i], b = P[j], c = P[k];
      vol += (a[0] * (b[1] * c[2] - b[2] * c[1])
            - a[1] * (b[0] * c[2] - b[2] * c[0])
            + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
    }
    return { vol: Math.abs(vol), lo, hi };
  }

  /* ---------- lectura completa ---------- */

  async function leer3mf(file) {
    const zip = await abrirZip(await file.arrayBuffer());
    const m3 = await zip.texto('3D/3dmodel.model');
    if (!m3) throw new Error('El archivo no trae 3D/3dmodel.model — ¿seguro que es un 3MF?');

    // mallas de todos los archivos de objetos
    const mallas = {};
    for (const n of zip.nombres) {
      if (n.startsWith('3D/Objects/') && n.endsWith('.model')) Object.assign(mallas, mallasDe(await zip.texto(n)));
    }
    Object.assign(mallas, mallasDe(m3));

    /* Subtipos, para restar los negativos (el bolsillo del chip).
       Ojo con esto, que es donde es fácil equivocarse: `model_settings.config` numera las
       partes DESDE 1 DENTRO DE CADA OBJETO. Con 5 llaveros hay 150 partes, cinco veces la
       id 1. Hay que mapear objeto → sus partes en orden, no id → subtipo a secas. */
    const subtipoPorObjeto = {};
    const ms = await zip.texto('Metadata/model_settings.config');
    if (ms) {
      const ro = /<object id="(\d+)"[^>]*>([\s\S]*?)<\/object>/g;
      let o;
      while ((o = ro.exec(ms))) {
        const lista = [];
        const rp = /<part id="(\d+)"[^>]*subtype="([^"]+)"/g;
        let q; while ((q = rp.exec(o[2]))) lista.push(q[2]);
        subtipoPorObjeto[+o[1]] = lista;
      }
    }

    // altura de capa y pausas
    let alturaCapa = null;
    const plate = await zip.texto('Metadata/plate_1.json');
    if (plate) { const m = plate.match(/"layer_height":([\d.]+)/); if (m) alturaCapa = +(+m[1]).toFixed(2); }
    const gcodePausas = await zip.texto('Metadata/custom_gcode_per_layer.xml');
    const pausas = gcodePausas ? (gcodePausas.match(/type="2"|pause/gi) || []).length : 0;
    let zPausa = null;
    if (gcodePausas) { const m = gcodePausas.match(/print_z="([\d.]+)"/); if (m) zPausa = +m[1]; }

    /* Piezas del build.
       Los atributos se sacan de la etiqueta completa, uno por uno. Meterlos todos en una
       sola expresión regular con grupos opcionales falla EN SILENCIO: la transformación
       del componente se perdía y el llavero medía 54 × 54 × 26 en vez de 54 × 60 × 3.
       Un dato mal leído es peor que un error. */
    const attr = (tag, nombre) => (new RegExp(nombre + '="([^"]*)"').exec(tag) || [])[1] || null;

    const piezas = [];
    const reItem = /<item\b[^>]*>/g;
    let it;
    while ((it = reItem.exec(m3))) {
      const oid = +attr(it[0], 'objectid');
      if (!oid) continue;
      const mt = matriz(attr(it[0], 'transform'));
      const bloque = new RegExp('<object id="' + oid + '"[^>]*>([\\s\\S]*?)</object>').exec(m3);
      const comps = [];
      if (bloque) {
        const rc = /<component\b[^>]*>/g;
        let c;
        while ((c = rc.exec(bloque[1]))) {
          const cid = +attr(c[0], 'objectid');
          if (cid) comps.push({ id: cid, m: matriz(attr(c[0], 'transform')) });
        }
      }
      const cuerpos = comps.length ? comps : [{ id: oid, m: null }];

      const subs = subtipoPorObjeto[oid] || [];
      let mas = 0, menos = 0;
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      cuerpos.forEach((c, i) => {
        const malla = mallas[c.id];
        if (!malla) return;
        const r = medir(malla, c.m);           // en el sistema del objeto
        const st = subs[i] || 'normal_part';
        if (/negative/.test(st)) menos += r.vol; else mas += r.vol;
        // La caja del objeto, llevada al sistema de la bandeja: hay que transformar las
        // OCHO esquinas, no dos. Con dos, una rotación de 90° da medidas absurdas —
        // el llavero salía de 54 × 54 × 26 en vez de 54 × 60 × 3.
        const esquinas = [];
        for (let a = 0; a < 2; a++) for (let b2 = 0; b2 < 2; b2++) for (let c2 = 0; c2 < 2; c2++)
          esquinas.push([a ? r.hi[0] : r.lo[0], b2 ? r.hi[1] : r.lo[1], c2 ? r.hi[2] : r.lo[2]]);
        esquinas.forEach(e => {
          const w = aplicar(e, mt);
          for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], w[k]); hi[k] = Math.max(hi[k], w[k]); }
        });
      });
      if (isFinite(lo[0])) {
        piezas.push({
          medidas: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]].map(x => +x.toFixed(2)),
          volumen: +( (mas - menos) / 1000 ).toFixed(2),   // cm³
          volumenNegativo: +(menos / 1000).toFixed(3),
          cuerpos: cuerpos.length
        });
      }
    }

    return {
      nombre: file.name,
      piezas: piezas.length,
      pieza: piezas[0] || null,
      todas: piezas,
      alturaCapa,
      pausas,
      zPausa,
      laminado: zip.nombres.includes('Metadata/slice_info.config'),
      tiempoDeNombre: tiempoDelNombre(file.name)
    };
  }

  /** Creality bautiza el G-code con el tiempo: "...._PLA_4h54m53s.gcode". Si viene, es exacto. */
  function tiempoDelNombre(nombre) {
    const m = /(?:_|\s)(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?\.(?:gcode|3mf)/i.exec(nombre || '');
    if (!m || !(m[1] || m[2] || m[3])) return null;
    const h = (+(m[1] || 0)) * 24 + (+(m[2] || 0)) + (+(m[3] || 0)) / 60 + (+(m[4] || 0)) / 3600;
    return +h.toFixed(3);
  }

  window.Lector3MF = { leer3mf, tiempoDelNombre };
})();
