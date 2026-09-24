/* Carga la app en Node para probarla: baja las MISMAS libs que usa index.html (misma CDN,
 * misma versión) a tests/.cache/ la primera vez, y corre los scripts de la app en un vm
 * con un `window` mínimo. Sin npm install. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.join(__dirname, '..');
const CACHE = path.join(__dirname, '.cache');
const LIBS = [
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/opentype.js/1.3.4/opentype.min.js',
  'https://cdn.jsdelivr.net/npm/clipper-lib@6.4.2/clipper.js',
  'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js'
];
const SCRIPTS = ['js/ui.js', 'js/d3dformas.js', 'js/d3dbuild.js', 'js/d3d3mf.js',
  'js/plantillamotor.js', 'js/plantilla3mf.js'];

async function lib(url) {
  fs.mkdirSync(CACHE, { recursive: true });
  const f = path.join(CACHE, url.replace(/[^a-z0-9.]+/gi, '_'));
  if (!fs.existsSync(f)) {
    const r = await fetch(url);
    if (!r.ok) throw new Error('No pude bajar ' + url + ': ' + r.status);
    fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
  }
  return fs.readFileSync(f, 'utf8');
}

let ctx = null;
async function cargarApp() {
  if (ctx) return ctx;
  const c = { console, TextEncoder, TextDecoder, setTimeout, clearTimeout, Math, Date,
    Uint8Array, Uint32Array, Float32Array, ArrayBuffer, DataView, Promise, URL };
  c.window = c; c.self = c; c.globalThis = c;
  c.navigator = { userAgent: 'node' };
  c.document = { querySelector: () => null, querySelectorAll: () => [], addEventListener() {} };
  vm.createContext(c);
  for (const u of LIBS) vm.runInContext(await lib(u), c, { filename: u });
  for (const s of SCRIPTS) {
    const f = path.join(RAIZ, s);
    if (fs.existsSync(f)) vm.runInContext(fs.readFileSync(f, 'utf8'), c, { filename: s });
  }
  // las fuentes y plantillas se leen del disco, con rutas relativas a la raíz de la app
  c.cargarBytesLocal = async rel => {
    const b = fs.readFileSync(path.join(RAIZ, rel));
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  };
  ctx = c;
  return c;
}

function plantilla(id) {
  return JSON.parse(fs.readFileSync(path.join(RAIZ, 'plantillas', id + '.json'), 'utf8'));
}
function catalogo() {
  return JSON.parse(fs.readFileSync(path.join(RAIZ, 'plantillas', 'catalogo.json'), 'utf8'));
}

module.exports = { cargarApp, plantilla, catalogo, RAIZ };
