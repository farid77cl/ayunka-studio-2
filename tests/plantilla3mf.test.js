/* node --test "tests/*.test.js"  ·  El 3MF de la app contra el v3 del generador Python.
 * Ruta del v3: MOCHILA_V3 o, por defecto, ../negocio/stl/mochila-nfc/ al lado de este repo. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { cargarApp, plantilla, RAIZ } = require('./cargar');

const MOCHILA = plantilla('mochila-nfc-v3');
const V3 = process.env.MOCHILA_V3 ||
  path.join(RAIZ, '..', 'negocio', 'stl', 'mochila-nfc', 'Mochila NFC 65 - nino MATEO v3.3mf');

/** ZIP -> { nombre: Buffer }, stored o deflate. */
function abrirZip(buf) {
  const out = {};
  let o = 0;
  while (o + 30 <= buf.length && buf.readUInt32LE(o) === 0x04034b50) {
    const metodo = buf.readUInt16LE(o + 8), comp = buf.readUInt32LE(o + 18);
    const nl = buf.readUInt16LE(o + 26), el = buf.readUInt16LE(o + 28);
    const nombre = buf.slice(o + 30, o + 30 + nl).toString('utf8');
    const datos = buf.slice(o + 30 + nl + el, o + 30 + nl + el + comp);
    out[nombre] = metodo === 8 ? zlib.inflateRawSync(datos) : datos;
    o += 30 + nl + el + comp;
  }
  return out;
}
function partes(z) {
  const ms = z['Metadata/model_settings.config'].toString('utf8');
  return [...ms.matchAll(/<part id="(\d+)" subtype="(\w+)">\s*<metadata key="name" value="([^"]*)"\/>[\s\S]*?<metadata key="extruder" value="(\d+)"\/>/g)]
    .map(m => ({ id: +m[1], subtipo: m[2], nombre: m[3], extrusor: +m[4] }));
}
function mallas(z) {
  const xml = z['3D/Objects/object_1.model'].toString('utf8');
  const out = {};
  for (const m of xml.matchAll(/<object id="(\d+)"[^>]*>([\s\S]*?)<\/object>/g)) {
    const v = [...m[2].matchAll(/<vertex x="([^"]+)" y="([^"]+)" z="([^"]+)"\/>/g)].map(a => [+a[1], +a[2], +a[3]]);
    const t = [...m[2].matchAll(/<triangle v1="(\d+)" v2="(\d+)" v3="(\d+)"/g)].map(a => [+a[1], +a[2], +a[3]]);
    out[m[1]] = { v, t };
  }
  return out;
}
function volumen({ v, t }) {
  let s = 0;
  for (const [a, b, c] of t) {
    const [x1, y1, z1] = v[a], [x2, y2, z2] = v[b], [x3, y3, z3] = v[c];
    s += x1 * (y2 * z3 - y3 * z2) - x2 * (y1 * z3 - y3 * z1) + x3 * (y1 * z2 - y2 * z1);
  }
  return s / 6;
}
function caja({ v }) {
  const r = [0, 1, 2].map(k => [Math.min(...v.map(p => p[k])), Math.max(...v.map(p => p[k]))]);
  return r.map(([a, b]) => [Math.round(a * 1e4) / 1e4, Math.round(b * 1e4) / 1e4]);
}

async function exportar(valores, variante) {
  const c = await cargarApp();
  const comp = await c.Plantillas.componer(MOCHILA, variante || 'nino', valores, { cargarBytes: c.cargarBytesLocal });
  const r = c.Plantilla3MF.exportar(MOCHILA, comp);
  return { c, comp, r, z: abrirZip(Buffer.from(r.datos)) };
}

test('MATEO/niño: mismas piezas, subtipos y extrusores que el v3 de Python', { skip: !fs.existsSync(V3) && 'falta ' + V3 }, async () => {
  const { z, r } = await exportar({ nombre: 'MATEO' });
  const v3 = abrirZip(fs.readFileSync(V3));
  assert.deepEqual(JSON.parse(JSON.stringify(partes(z))), partes(v3));
  assert.equal(r.nombreArchivo, 'Mochila NFC 65 - nino MATEO v3.3mf');
});

test('MATEO/niño: perfil idéntico al v3 y pausa en top_z 2.6', { skip: !fs.existsSync(V3) && 'falta ' + V3 }, async () => {
  const { z } = await exportar({ nombre: 'MATEO' });
  const v3 = abrirZip(fs.readFileSync(V3));
  const perfil = JSON.parse(z['Metadata/project_settings.config'].toString('utf8'));
  assert.deepEqual(perfil, JSON.parse(v3['Metadata/project_settings.config'].toString('utf8')));
  assert.ok(perfil.print_settings_id.startsWith('llaveros letra chica v4'));
  const cg = z['Metadata/custom_gcode_per_layer.xml'].toString('utf8');
  assert.deepEqual([...cg.matchAll(/<layer top_z="([\d.]+)"[^>]*gcode="([^"]*)"/g)].map(m => [m[1], m[2]]), [['2.6', 'PAUSE']]);
  for (const n of Object.keys(v3)) assert.ok(z[n], 'falta la entrada ' + n);
});

test('el bolsillo del chip: negative_part último, X/Y ±13,5 y Z 2,0–2,4', async () => {
  const { z } = await exportar({ nombre: 'MATEO' });
  const ps = partes(z), neg = ps.filter(p => p.subtipo === 'negative_part');
  assert.equal(neg.length, 1);
  assert.equal(neg[0].id, Math.max(...ps.map(p => p.id)));
  assert.equal(neg[0].extrusor, 0);
  assert.deepEqual(caja(mallas(z)[neg[0].id]), [[-13.5, 13.5], [-13.5, 13.5], [2, 2.4]]);
  const comp = z['3D/3dmodel.model'].toString('utf8');
  assert.deepEqual([...comp.matchAll(/<component [^>]*objectid="(\d+)"/g)].map(m => +m[1]), ps.map(p => p.id));
});

test('cada malla es cerrada: volumen = área × alto (triangulación que cubre la figura)', async () => {
  for (const val of [{ nombre: 'MATEO' }, { nombre: 'SOFÍA', telefono: '+56912345678' }]) {
    const { r, z } = await exportar(val, 'nina');
    const ms = mallas(z);
    for (const p of r.partes) {
      const vol = volumen(ms[p.id]);
      assert.ok(Math.abs(vol - p.esperado) / p.esperado < 1e-3, p.nombre + ': ' + vol.toFixed(3) + ' vs ' + p.esperado.toFixed(3));
    }
  }
});

test('volúmenes parecidos al v3 (±3 %) en las piezas fijas', { skip: !fs.existsSync(V3) && 'falta ' + V3 }, async () => {
  const { z } = await exportar({ nombre: 'MATEO' });
  const a = mallas(z), b = mallas(abrirZip(fs.readFileSync(V3)));
  for (const id of ['1', '2', '3', '6']) {
    const va = volumen(a[id]), vb = volumen(b[id]);
    assert.ok(Math.abs(va - vb) / vb < 0.03, 'pieza ' + id + ': ' + va.toFixed(2) + ' vs v3 ' + vb.toFixed(2));
  }
});

test('con QR: 7 piezas, el negativo es el id 7, el reverso va espejado en X', async () => {
  const { z, comp } = await exportar({ nombre: 'MATEO', telefono: '+56 9 1234 5678' });
  const ps = partes(z);
  assert.equal(ps.length, 7);
  assert.equal(ps[6].subtipo, 'negative_part'); assert.equal(ps[6].id, 7);
  assert.equal(ps[2].nombre, 'reverso QR fondo (BLANCO)');
  // espejo: la placa del QR está centrada en x=0, así que se mira el texto: la figura en
  // lectura tiene su borde izquierdo en x1; en el archivo tiene que quedar en -x1
  const orig = comp.piezas.find(p => p.id === 'rev_oscuro').figs;
  const xsLect = orig.map(f => Math.min(...f.outer.map(p => p[0])));
  const m = mallas(z)['4'];
  const xsArch = m.v.map(p => p[0]);
  assert.ok(Math.abs(Math.max(...xsArch) + Math.min(...xsLect)) < 1e-3, 'espejo en X');
});

test('verificar() relee el archivo escrito y pilla un negativo que no es el último', async () => {
  const { c, r } = await exportar({ nombre: 'MATEO' });
  assert.equal(c.Plantilla3MF.verificar(r.datos, MOCHILA).ok, true);
  const roto = Buffer.from(r.datos).toString('latin1').replace('subtype="negative_part"', 'subtype="normal_part"');
  const v = c.Plantilla3MF.verificar(Uint8Array.from(Buffer.from(roto, 'latin1')), MOCHILA);
  assert.equal(v.ok, false);
});

test('mallas cerradas y manifold: cada arista la comparten exactamente 2 triángulos (con y sin QR)', async () => {
  const casos = [[{ nombre: 'MATEO' }, 'nino'], [{ nombre: 'SOFÍA', telefono: '+56912345678' }, 'nina'],
    [{ nombre: 'MAXIMILIANO', telefono: '+56987654321' }, 'neutra'], [{ nombre: 'ALEX', telefono: '+56911111111' }, 'neutra']];
  for (const [val, variante] of casos) {
    const { z, r } = await exportar(val, variante);
    const ms = mallas(z);
    for (const p of r.partes) {
      const e = new Map();
      for (const [a, b, c] of ms[p.id].t) for (const [u, v] of [[a, b], [b, c], [c, a]]) {
        const k = u < v ? u + ',' + v : v + ',' + u; e.set(k, (e.get(k) || 0) + 1);
      }
      const malas = [...e.values()].filter(n => n !== 2).length;
      assert.equal(malas, 0, val.nombre + ' / ' + p.nombre + ': ' + malas + ' aristas no compartidas por 2');
    }
  }
});
