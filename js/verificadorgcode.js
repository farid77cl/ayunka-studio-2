/* Ayünka Studio — verificador de G-code para la compuerta 7 (skill llavero-nfc-desde-3mf
   del repo negocio). No reemplaza mirar el dibujo de las capas -- confirma lo que se
   puede sacar de texto plano: que exista la pausa, que el perfil no sea el de fábrica, y
   que las extrusiones cerca del centro se detengan durante el bolsillo y reaparezcan
   justo después. Mismo diseño verificado hoy contra G-code real. */
(function () {
  'use strict';

  function lineasPorCapa(texto) {
    const lineas = texto.split('\n');
    const capas = [];
    let actual = null;
    for (let i = 0; i < lineas.length; i++) {
      if (lineas[i].trim() === ';LAYER_CHANGE') {
        if (actual) actual.fin = i;
        const m = (lineas[i + 1] || '').match(/^;:([\d.]+)/);
        actual = { z: m ? parseFloat(m[1]) : null, inicio: i, fin: lineas.length };
        capas.push(actual);
      }
    }
    return { lineas, capas };
  }

  function extrusionesEnCentro(lineas, desde, hasta, centro, radio) {
    let x = 0, y = 0, n = 0;
    for (let i = desde; i < hasta; i++) {
      const l = lineas[i];
      if (!/^G1 /.test(l)) continue;
      const eVal = (l.match(/E(-?[\d.]+)/) || [])[1];
      const mx = l.match(/X(-?[\d.]+)/), my = l.match(/Y(-?[\d.]+)/);
      const x0 = x, y0 = y;
      if (mx) x = parseFloat(mx[1]);
      if (my) y = parseFloat(my[1]);
      if (!eVal || parseFloat(eVal) <= 0) continue;
      if (mx || my) {
        const mx2 = (x0 + x) / 2, my2 = (y0 + y) / 2;
        if (Math.abs(mx2 - centro.x) <= radio && Math.abs(my2 - centro.y) <= radio) n++;
      }
    }
    return n;
  }

  function centroDePieza(lineas, desde, hasta) {
    let inicioObjeto = -1, finObjeto = hasta;
    for (let i = desde; i < hasta; i++) {
      if (/EXCLUDE_OBJECT_START/.test(lineas[i])) { inicioObjeto = i + 1; continue; }
      if (inicioObjeto >= 0 && /EXCLUDE_OBJECT_END/.test(lineas[i])) { finObjeto = i; break; }
    }
    const d = inicioObjeto >= 0 ? inicioObjeto : desde;
    const h = inicioObjeto >= 0 ? finObjeto : hasta;
    let x = 0, y = 0, x1 = Infinity, x2 = -Infinity, y1 = Infinity, y2 = -Infinity;
    for (let i = d; i < h; i++) {
      const l = lineas[i];
      if (!/^G1 /.test(l)) continue;
      const eVal = (l.match(/E(-?[\d.]+)/) || [])[1];
      const mx = l.match(/X(-?[\d.]+)/), my = l.match(/Y(-?[\d.]+)/);
      if (mx) x = parseFloat(mx[1]);
      if (my) y = parseFloat(my[1]);
      if (eVal && parseFloat(eVal) > 0 && (mx || my)) {
        if (x < x1) x1 = x; if (x > x2) x2 = x;
        if (y < y1) y1 = y; if (y > y2) y2 = y;
      }
    }
    if (!isFinite(x1)) return null;
    return { centro: { x: (x1 + x2) / 2, y: (y1 + y2) / 2 }, deObjetoAislado: inicioObjeto >= 0 };
  }

  function verificar(texto, opts) {
    opts = opts || {};
    const hallazgos = [];
    const perfilEsperado = opts.perfilEsperado || null;
    const zBolsilloDesde = opts.zBolsilloDesde != null ? opts.zBolsilloDesde : 0.8;
    const zBolsilloHasta = opts.zBolsilloHasta != null ? opts.zBolsilloHasta : 1.2;

    const perfilMatch = texto.match(/;\s*print_settings_id\s*=\s*([^\n(]+)/);
    const perfil = perfilMatch ? perfilMatch[1].trim() : null;
    if (!perfil) hallazgos.push('No encontré "print_settings_id" -- ¿es un G-code de Creality Print?');
    else if (perfilEsperado && !perfil.includes(perfilEsperado)) hallazgos.push('El perfil usado es "' + perfil + '", no "' + perfilEsperado + '".');
    else if (/^0\.\d+mm Standard$/i.test(perfil)) hallazgos.push('El perfil sigue siendo el de fábrica ("' + perfil + '").');

    const tienePausa = /;PAUSE_PRINT/.test(texto) || /^PAUSE\s*$/m.test(texto);
    if (!tienePausa) hallazgos.push('No encontré ninguna pausa -- sin eso no hay dónde meter el chip.');

    const { lineas, capas } = lineasPorCapa(texto);
    const EPS = 0.01;
    const capasHueco = capas.filter(c => c.z != null && c.z > zBolsilloDesde + EPS && c.z <= zBolsilloHasta + EPS);
    const capaPuente = capas.find(c => c.z != null && c.z > zBolsilloHasta + EPS) || null;

    let centro = opts.centro, deObjetoAislado = null;
    const radio = opts.radio != null ? opts.radio : 10;
    if (!centro) {
      const capaFloor = capas.find(c => c.z != null && Math.abs(c.z - zBolsilloDesde) <= EPS);
      const detectado = capaFloor ? centroDePieza(lineas, capaFloor.inicio, capaFloor.fin) : null;
      if (!detectado) hallazgos.push('No pude ubicar la pieza en la bandeja (falta el piso del bolsillo en z=' + zBolsilloDesde + ').');
      centro = detectado ? detectado.centro : { x: 0, y: 0 };
      deObjetoAislado = detectado ? detectado.deObjetoAislado : null;
    }

    const conteosHueco = capasHueco.map(c => ({ z: c.z, n: extrusionesEnCentro(lineas, c.inicio, c.fin, centro, radio) }));
    const extrusionesPuente = capaPuente ? extrusionesEnCentro(lineas, capaPuente.inicio, capaPuente.fin, centro, radio) : null;

    if (!capasHueco.length) hallazgos.push('No encontré capas entre z=' + zBolsilloDesde + ' y z=' + zBolsilloHasta + '.');
    else {
      const conRelleno = conteosHueco.filter(c => c.n > 0);
      if (conRelleno.length) hallazgos.push('Hay relleno en el centro en z=' + conRelleno.map(c => c.z).join(', ') + ' -- el bolsillo no quedó vacío.');
    }
    if (capasHueco.length && capaPuente == null) hallazgos.push('No encontré la capa del puente.');
    else if (capaPuente && !extrusionesPuente) hallazgos.push('La capa del puente (z=' + capaPuente.z + ') no tiene extrusión en el centro.');

    return { ok: !hallazgos.length, hallazgos,
      detalles: { perfil, tienePausa, capasHueco: conteosHueco, capaPuente: capaPuente && capaPuente.z, extrusionesPuente, centro, radio, deObjetoAislado } };
  }

  window.VerificadorGcode = { verificar, lineasPorCapa, extrusionesEnCentro, centroDePieza };
})();
