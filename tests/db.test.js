'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function cargarDb() {
  const c = { console, Date, Math, JSON, Promise, URL, setTimeout };
  c.window = c;
  c.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  c.document = { createElement: () => ({}), body: {} };
  vm.createContext(c);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'db.js'), 'utf8'), c, { filename: 'js/db.js' });
  return c.window.Datos;
}
const semilla = () => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'datos', 'semilla.json'), 'utf8'));

test('la semilla real pasa la validacion', () => {
  const r = cargarDb().validarSemilla(semilla());
  assert.equal(r.ok, true, JSON.stringify(r));
});

test('una semilla con un id repetido se rechaza (habria cazado el bug de 3d_001..005)', () => {
  const s = semilla();
  s.productos.push(Object.assign({}, s.productos[0], { nombre: 'Otro' }));
  const r = cargarDb().validarSemilla(s);
  assert.equal(r.ok, false);
  assert.match(r.errores.join(' '), /repetido/);
  assert.match(r.errores.join(' '), new RegExp(s.productos[0].id));
});

test('rechaza nombre que no es texto y colecciones que no son arreglos', () => {
  const s = semilla();
  s.productos[1].nombre = 5;
  s.clientes = {};
  const r = cargarDb().validarSemilla(s);
  assert.equal(r.ok, false);
  assert.ok(r.errores.length >= 2);
});

test('copia previa a sincronizar: queda DENTRO de la app, una sola, sin descargar nada', () => {
  const mem = {};
  const c = { console, Date, Math, JSON, Promise, URL, setTimeout };
  c.window = c;
  c.localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
  let clics = 0;
  c.document = { createElement: () => ({ click() { clics++; } }), body: {} };
  vm.createContext(c);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'db.js'), 'utf8'), c, { filename: 'js/db.js' });
  const D = c.window.Datos;
  assert.equal(D.leerCopiaPrevia(), null);
  // lo que hace nube.js: escribir UNA clave con la copia armada
  c.localStorage.setItem(D.CLAVE_COPIA, JSON.stringify(D.armarCopiaPrevia({ productos: [{ id: 'a' }] })));
  c.localStorage.setItem(D.CLAVE_COPIA, JSON.stringify(D.armarCopiaPrevia({ productos: [{ id: 'a' }, { id: 'b' }] })));
  const cp = D.leerCopiaPrevia();
  assert.equal(cp.db.productos.length, 2, 'la segunda reemplaza a la primera');
  assert.ok(cp.fecha);
  assert.equal(Object.keys(mem).filter(k => k === 'ayunka-db-antes-de-sincronizar').length, 1);
  assert.equal(clics, 0, 'guardar la copia no descarga ningun archivo');
  assert.equal(D.CLAVE_COPIA, 'ayunka-db-antes-de-sincronizar');
});

test('app.js no manda postMessage con destino "*"', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
  assert.equal(/postMessage\([^)]*['"]\*['"]/.test(src), false);
  assert.ok(/postMessage\('ir-a-taller',\s*window\.location\.origin\)/.test(src));
});
