/* node --test "tests/*.test.js"  ·  Motor de plantillas y 3MF. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargarApp, plantilla, catalogo } = require('./cargar');

const MOCHILA = plantilla('mochila-nfc-v3');
async function motor() { const c = await cargarApp(); return c; }
async function componer(variante, valores) {
  const c = await motor();
  return c.Plantillas.componer(MOCHILA, variante, valores, { cargarBytes: c.cargarBytesLocal });
}
const pieza = (r, id) => r.piezas.find(p => p.id === id);
const plano = x => JSON.parse(JSON.stringify(x));   // los objetos del vm son de otro realm
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

// ------------------------------------------------------------------ teléfono / QR
test('normalizarTelefono acepta espacios y guiones y rechaza lo que no es +569 y 8 dígitos', async () => {
  const P = (await motor()).Plantillas;
  assert.equal(P.normalizarTelefono('+56 9 1234-5678'), '+56912345678');
  assert.equal(P.normalizarTelefono('(+569) 8765.4321'), '+56987654321');
  assert.equal(P.normalizarTelefono('+5621234567'), null);
  assert.equal(P.normalizarTelefono('912345678'), null);
});

test('con teléfono: placa blanca + QR v2-Q de 25 módulos de 1,3 mm dentro de la placa', async () => {
  const c = await motor(), G = c.Plantillas.geo;
  const r = await componer('nino', { nombre: 'MATEO', telefono: '+56 9 1234 5678' });
  assert.deepEqual(plano(r.piezas.map(p => p.id)), ['cuerpo', 'acento', 'rev_claro', 'rev_oscuro', 'contorno', 'nombre', 'chip']);
  const q = r.info.telefono;
  assert.equal(q.carga, 'tel:+56912345678');
  assert.equal(q.modulos, 25); assert.equal(q.modulo, 1.3); assert.equal(q.ec, 'Q');
  assert.ok(Math.abs(q.lado - 29 * 1.3) < 1e-9);
  const claro = pieza(r, 'rev_claro').figs, oscuro = pieza(r, 'rev_oscuro').figs;
  const texto = MOCHILA.piezas.find(p => p.id === 'rev_oscuro').figsSi.telefono;
  const modulos = G.diferencia(oscuro, texto);
  assert.ok(G.area(G.diferencia(modulos, claro)) < 1e-3, 'los módulos quedan sobre la placa blanca');
  assert.ok(G.area(modulos) > 200 && G.area(modulos) < 0.75 * G.area(claro), 'área de módulos ' + G.area(modulos));
  assert.ok(pieza(r, 'rev_oscuro').espejoX && pieza(r, 'rev_claro').espejoX, 'el reverso se espeja al exportar');
});

test('sin teléfono: no hay placa del QR y el reverso lleva el logo NFC; teléfono malo = error en su campo', async () => {
  const r = await componer('nino', { nombre: 'MATEO', telefono: '' });
  assert.ok(!pieza(r, 'rev_claro'));
  assert.deepEqual(plano(pieza(r, 'rev_oscuro').figs), MOCHILA.piezas.find(p => p.id === 'rev_oscuro').figs);
  await assert.rejects(componer('nino', { nombre: 'MATEO', telefono: '+56 2 2345 678' }), e => e.usuario && e.campo === 'telefono');
});

// ------------------------------------------------------------------ colores y carretes
test('extrusores según la paleta: niño 4 carretes, niña 3 (el nombre comparte el rosado del fondo)', async () => {
  const n = await componer('nino', { nombre: 'MATEO' });
  assert.deepEqual(plano(n.filamentos), MOCHILA.variantes.find(v => v.id === 'nino').filamentos);
  assert.deepEqual(plano(n.piezas.map(p => p.extrusor)), [1, 3, 2, 2, 4, 0]);
  const a = await componer('nina', { nombre: 'SOFIA' });
  assert.equal(a.filamentos.length, 3);
  assert.equal(pieza(a, 'nombre').extrusor, pieza(a, 'cuerpo').extrusor);
  assert.equal(pieza(a, 'cuerpo').nombre, 'cuerpo (fondo ROSADO)');
});

test('paletaCarretes: filamento N -> color, nombre y para qué piezas', async () => {
  const P = (await motor()).Plantillas;
  const r = await componer('nino', { nombre: 'MATEO' });
  const pal = P.paletaCarretes(MOCHILA, r);
  assert.deepEqual(plano(pal.map(x => [x.n, x.nombre])), [[1, 'AZUL'], [2, 'NEGRO'], [3, 'BLANCO'], [4, 'AMARILLO']]);
  assert.ok(pal[1].usos.includes('relieve bordes y textos'));
});

test('la plantilla trae su ayuda «Después de descargar» con los 3 pasos de la mochila', () => {
  const ins = MOCHILA.instrucciones;
  assert.equal(ins.titulo, 'Después de descargar');
  assert.equal(ins.pasos.length, 3);
  assert.match(ins.pasos[0], /Creality Print/);
  assert.match(ins.pasos[1], /PAUSA/); assert.match(ins.pasos[1], /2,6 mm/); assert.match(ins.pasos[1], /25 mm/);
  assert.match(ins.pasos[2], /NFC Tools/); assert.match(ins.pasos[2], /Número de teléfono/);
});

// ------------------------------------------------------------------ parámetros genéricos (plantilla de juguete)
const JUGUETE = {
  formato: 'plantilla/1', id: 'juguete', nombre: 'Juguete', ordenRoles: ['fondo', 'marca'],
  variantes: [{ id: 'a', nombre: 'A', colores: { fondo: '#111111', marca: '#FFFFFF' }, filamentos: ['#111111', '#FFFFFF'], perfil: {} }],
  nombresColor: { '#111111': 'NEGRO', '#FFFFFF': 'BLANCO', '#FF0000': 'ROJO' },
  piezas: [
    { id: 'base', nombre: 'base ({color})', rol: 'fondo', z: [0, 2], figs: [{ outer: [[-10, -5], [10, -5], [10, 5], [-10, 5]], holes: [] }] },
    { id: 'argolla', nombre: 'argolla ({color})', rol: 'marca', z: [2, 3], soloSi: 'argolla', figs: [{ outer: [[-9, -1], [-7, -1], [-7, 1], [-9, 1]], holes: [] }] }
  ],
  parametros: [
    { id: 'argolla', tipo: 'interruptor', etiqueta: 'Con argolla' },
    { id: 'marca', tipo: 'color', etiqueta: 'Color de la marca', rol: 'marca', opciones: [{ hex: '#FFFFFF' }, { hex: '#FF0000' }, { hex: '#111111' }] }
  ]
};

test('interruptor: apaga y prende una pieza soloSi', async () => {
  const P = (await motor()).Plantillas;
  assert.deepEqual(plano((await P.componer(JUGUETE, 'a', {})).piezas.map(p => p.id)), ['base']);
  assert.deepEqual(plano((await P.componer(JUGUETE, 'a', { argolla: true })).piezas.map(p => p.id)), ['base', 'argolla']);
});

test('color de una lista: cambia el color de un rol; si cambia la cantidad de carretes, error claro', async () => {
  const P = (await motor()).Plantillas;
  const r = await P.componer(JUGUETE, 'a', { argolla: true, marca: '#FF0000' });
  assert.deepEqual(plano(r.filamentos), ['#111111', '#FF0000']);
  assert.equal(r.piezas[1].nombre, 'argolla (ROJO)');
  await assert.rejects(P.componer(JUGUETE, 'a', { argolla: true, marca: '#111111' }), e => e.usuario && /carretes/.test(e.message));
});

// ------------------------------------------------------------------ todas las plantillas del catálogo
test('cada plantilla del catálogo: formato, negativo último, variantes con perfil y paso a paso', () => {
  for (const it of catalogo().plantillas) {
    const p = plantilla(it.id);
    assert.equal(p.formato, 'plantilla/1', it.id);
    const iNeg = p.piezas.findIndex(x => x.subtipo === 'negative_part');
    assert.ok(iNeg === -1 || iNeg === p.piezas.length - 1, it.id + ': negativo último');
    for (const v of p.variantes) {
      assert.ok(v.perfil && Array.isArray(v.perfil.filament_colour), it.id + '/' + v.id + ': perfil');
      assert.deepEqual(plano(v.perfil.filament_colour), v.filamentos, it.id + '/' + v.id + ': carretes del perfil');
    }
    assert.ok(p.instrucciones && p.instrucciones.pasos.length, it.id + ': instrucciones');
    for (const q of p.parametros) assert.ok(['texto', 'telefono-qr', 'interruptor', 'color'].includes(q.tipo), q.tipo);
  }
});

test('borrador: sin nombre todavía, compone solo las piezas fijas (para la vista previa)', async () => {
  const c = await motor();
  const r = await c.Plantillas.componer(MOCHILA, 'neutra', { nombre: '' }, { cargarBytes: c.cargarBytesLocal, borrador: true });
  assert.equal(pieza(r, 'nombre').figs.length, 0);
  assert.equal(r.info.nombre, undefined);
  assert.ok(r.faltan.includes('nombre'));
  await assert.rejects(componer('neutra', { nombre: '' }), e => e.usuario && e.campo === 'nombre');
});
