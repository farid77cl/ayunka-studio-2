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
