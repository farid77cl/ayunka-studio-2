/* Ayünka Studio — verificador de G-code para la compuerta 7 de la skill
   llavero-nfc-desde-3mf. Lee texto plano, no un binario: funciona con cualquier G-code
   que declare las capas como ;LAYER_CHANGE + ;:<Z> (Creality Print / Bambu / Orca).

   No reemplaza mirar el dibujo de las capas -- solo confirma lo que se puede sacar de
   texto: que exista la pausa, que el perfil no sea el de fábrica, y que las extrusiones
   cerca del centro se detengan durante el bolsillo y reaparezcan justo después. */
(function () {
  'use strict';

  function lineasPorCapa(texto) {
    const lineas = texto.split('\n');
    const capas = []; // { z, inicio, fin } -- índices de línea
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

  // El PUNTO MEDIO de cada trazo de extrusión (no el punto de llegada) dentro del rango de
  // líneas -- una pasada de bridge cruza toda la pieza; medir solo la llegada la pierde
  // casi siempre porque el extremo cae lejos del centro aunque la línea SÍ pase por él.
  // Verificado contra stl/RUDY Automotriz 19 - una placa_PLA_53m39s.gcode: con el punto de
  // llegada, la capa del puente (z=1.4) da 0; con el punto medio, da 53 -- que es lo real.
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
      if (!eVal || parseFloat(eVal) <= 0) continue; // solo extrusión real, no retracción
      if (mx || my) {
        const mx2 = (x0 + x) / 2, my2 = (y0 + y) / 2;
        if (Math.abs(mx2 - centro.x) <= radio && Math.abs(my2 - centro.y) <= radio) n++;
      }
    }
    return n;
  }

  /* Dónde está la pieza en la bandeja, sin que nadie lo escriba a mano -- Creality Print
     pone la pieza donde quiera, así que asumir (0,0) o la posición local del diseño mira
     el lugar equivocado casi siempre. El piso del bolsillo (capaFloor) va sólido a
     propósito, así que sirve para medir: si hay bloques EXCLUDE_OBJECT_START/END (los pone
     Creality Print para poder cancelar una pieza sin tocar las demás), se usa el primero
     -- así no se contamina con la torre de purga, que también extruye en cada capa y
     queda FUERA de esos bloques. Sin esos bloques (gcode de un slicer más simple), se usa
     toda la capa como último recurso -- ahí sí puede mezclarse con la torre de purga. */
  function centroDePieza(lineas, desde, hasta) {
    let inicioObjeto = -1, finObjeto = hasta;
    for (let i = desde; i < hasta; i++) {
      if (/EXCLUDE_OBJECT_START/.test(lineas[i])) { inicioObjeto = i + 1; continue; }
      if (inicioObjeto >= 0 && /EXCLUDE_OBJECT_END/.test(lineas[i])) { finObjeto = i; break; }
    }
    const d = inicioObjeto >= 0 ? inicioObjeto : desde;
    const h = inicioObjeto >= 0 ? finObjeto : hasta;
    let x = 0, y = 0;
    let x1 = Infinity, x2 = -Infinity, y1 = Infinity, y2 = -Infinity;
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
    // El radio NO sale de acá: esto es el tamaño de TODA la pieza, no el del bolsillo --
    // usarlo como radio de búsqueda revisaría casi toda la placa en vez de solo el centro.
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
    if (!perfil) hallazgos.push('No encontré "print_settings_id" en el archivo -- ¿es un G-code de Creality Print?');
    else if (perfilEsperado && !perfil.includes(perfilEsperado)) hallazgos.push('El perfil usado es "' + perfil + '", no "' + perfilEsperado + '" -- revisa que se haya elegido el perfil correcto antes de cortar.');
    else if (/^0\.\d+mm Standard$/i.test(perfil)) hallazgos.push('El perfil sigue siendo el de fábrica ("' + perfil + '") -- no se aplicó el preset con la pausa.');

    const tienePausa = /;PAUSE_PRINT/.test(texto) || /^PAUSE\s*$/m.test(texto);
    if (!tienePausa) hallazgos.push('No encontré ninguna pausa (";PAUSE_PRINT" / "PAUSE") en el archivo -- sin eso no hay dónde meter el chip.');

    const { lineas, capas } = lineasPorCapa(texto);
    const EPS = 0.01;
    // El piso del bolsillo (z == zBolsilloDesde) va SÓLIDO a propósito -- es la base sobre
    // la que se apoya el chip. Las capas huecas son las que van ESTRICTAMENTE arriba del
    // piso y hasta el techo del bolsillo inclusive; el puente es la primera capa después.
    const capasHueco = capas.filter(c => c.z != null && c.z > zBolsilloDesde + EPS && c.z <= zBolsilloHasta + EPS);
    const capaPuente = capas.find(c => c.z != null && c.z > zBolsilloHasta + EPS) || null;

    let centro = opts.centro, radio = opts.radio, deObjetoAislado = null;
    if (!centro) {
      const capaFloor = capas.find(c => c.z != null && Math.abs(c.z - zBolsilloDesde) <= EPS);
      const detectado = capaFloor ? centroDePieza(lineas, capaFloor.inicio, capaFloor.fin) : null;
      if (!detectado) hallazgos.push('No pude ubicar la pieza en la bandeja (no encontré el piso del bolsillo en z=' + zBolsilloDesde + ') -- revisa a mano.');
      centro = detectado ? detectado.centro : { x: 0, y: 0 };
      deObjetoAislado = detectado ? detectado.deObjetoAislado : null;
    }
    if (radio == null) radio = 10;

    const conteosHueco = capasHueco.map(c => ({ z: c.z, n: extrusionesEnCentro(lineas, c.inicio, c.fin, centro, radio) }));
    const extrusionesPuente = capaPuente ? extrusionesEnCentro(lineas, capaPuente.inicio, capaPuente.fin, centro, radio) : null;

    if (!capasHueco.length) hallazgos.push('No encontré ninguna capa entre z=' + zBolsilloDesde + ' y z=' + zBolsilloHasta + ' -- ¿el archivo es de esta pieza?');
    else {
      const conRelleno = conteosHueco.filter(c => c.n > 0);
      if (conRelleno.length) hallazgos.push('Hay relleno en el centro en la(s) capa(s) z=' + conRelleno.map(c => c.z).join(', ') + ' -- el bolsillo no quedó vacío ahí.');
    }

    if (capasHueco.length && capaPuente == null) hallazgos.push('No encontré una capa después del bolsillo para revisar el puente.');
    else if (capaPuente && !extrusionesPuente) hallazgos.push('La capa después del bolsillo (z=' + capaPuente.z + ') no tiene extrusión en el centro -- el puente que debería tapar el hueco no está.');

    return {
      ok: !hallazgos.length, hallazgos,
      detalles: { perfil, tienePausa, capasHueco: conteosHueco, capaPuente: capaPuente && capaPuente.z, extrusionesPuente, centro, radio, deObjetoAislado }
    };
  }

  window.VerificadorGcode = { verificar, lineasPorCapa, extrusionesEnCentro };
})();
