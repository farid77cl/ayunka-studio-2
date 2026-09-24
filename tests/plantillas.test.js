/* node --test "tests/*.test.js"  ·  Motor de plantillas y 3MF. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargarApp, plantilla } = require('./cargar');

const MOCHILA = plantilla('mochila-nfc-v3');
async function motor() { const c = await cargarApp(); return c; }
async function componer(variante, valores) {
  const c = await motor();
  return c.Plantillas.componer(MOCHILA, variante, valores, { cargarBytes: c.cargarBytesLocal });
}
const pieza = (r, id) => r.piezas.find(p => p.id === id);
const paramDe = id => MOCHILA.parametros.find(p => p.id === id);

test('MATEO/niño: el nombre sale grande, dentro de su zona con borde, sin tocar el contorno', async () => {
  const c = await motor(), G = c.Plantillas.geo;
  const r = await componer('nino', { nombre: 'MATEO' });
  const nombre = pieza(r, 'nombre').figs;
  assert.ok(nombre.length >= 5, 'una figura por letra');
  assert.ok(r.info.nombre.cap >= 8 && r.info.nombre.cap <= 11, 'cap ' + r.info.nombre.cap);
  const zona = paramDe('nombre').zona;
  const conBorde = G.offset(nombre, 0.8);
  assert.ok(G.area(G.diferencia(conBorde, zona)) < 1e-3, 'nombre + borde dentro de la zona');
  const fijo = MOCHILA.piezas.find(p => p.id === 'contorno').figs;
  assert.ok(G.area(G.interseccion(nombre, fijo)) < 1e-6, 'nombre ∩ contorno fijo = 0');
  const contorno = pieza(r, 'contorno').figs;
  assert.ok(G.area(G.interseccion(nombre, contorno)) < 1e-3, 'nombre ∩ contorno con borde = 0');
  assert.ok(G.area(contorno) > G.area(fijo) + 10, 'el borde del nombre se sumó al contorno');
  for (const f of nombre) assert.ok(G.perdidaFina([f]) <= 0.08, 'trazo fino en una letra');
});

test('MAXIMILIANO cabe con la condensada, más chico', async () => {
  const r = await componer('nino', { nombre: 'Maximiliano' });
  assert.equal(r.info.nombre.fuente, 1, 'condensada');
  assert.ok(r.info.nombre.cap < 6 && r.info.nombre.cap >= 3.8, 'cap ' + r.info.nombre.cap);
  assert.equal(r.info.nombre.texto, 'MAXIMILIANO');
});

test('un nombre que no cabe da un error para la usuaria, no una excepción cruda', async () => {
  await assert.rejects(componer('nino', { nombre: 'MAXIMILIANO JOSÉ' }), e => e.usuario === true && /no cabe/i.test(e.message));
  await assert.rejects(componer('nino', { nombre: '   ' }), e => e.usuario === true);
});

test('SOFÍA: la tilde queda separada de la I por la rendija mínima', async () => {
  const c = await motor(), G = c.Plantillas.geo;
  const r = await componer('nina', { nombre: 'Sofía' });
  const figs = pieza(r, 'nombre').figs;
  assert.equal(r.info.nombre.texto, 'SOFÍA');
  let peor = Infinity;
  for (let i = 0; i < figs.length; i++) for (let j = i + 1; j < figs.length; j++) peor = Math.min(peor, G.distancia([figs[i]], [figs[j]]));
  assert.ok(peor >= 0.7 - 1e-3, 'rendija ' + peor);
});

module.exports = { componer, MOCHILA };
