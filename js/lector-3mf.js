/* Ayünka Studio — lector de 3MF: geometria, unidades, transformaciones y umbral de
 * triangulos. Consume el ZIP ya descomprimido por lector-zip.js (raiz.LectorZip) y
 * convierte 3D/3dmodel.model en una malla de triangulos plana, ya en milimetros.
 *
 * Mismo patron de namespace que lector-zip.js (raiz = self si existe, si no
 * globalThis): este modulo tambien se carga con importScripts dentro de un Web
 * Worker, donde `window` no existe — excepcion deliberada a la convencion de
 * `window.NOMBRE` de CONVENTIONS.md.
 *
 * ADVERTENCIA para quien lea esto despues: este modulo NO puede usar `DOMParser`.
 * No existe en `WorkerGlobalScope` — es una API atada a `window`/`document`. Ni
 * siquiera el `3MFLoader` oficial de Three.js sirve dentro de un Worker por la
 * misma razon: llama a `new DOMParser()` internamente (ver 02-RESEARCH.md,
 * "CRITICAL: DOMParser is NOT available in Web Workers"). Por eso la extraccion de
 * XML de aqui abajo es manual — un escaneo con expresiones regulares sobre los
 * elementos concretos y planos que necesita 3MF (`<vertex>`, `<triangle>`,
 * `<component>`, `<item>`), no un parser XML general. No "arreglarlo" cambiandolo
 * por `DOMParser`: pasaria todas las pruebas en Node y se rompe recien la primera
 * vez que corre de verdad en el telefono de Farid.
 */
(function () {
  'use strict';

  var raiz = (typeof self !== 'undefined') ? self : globalThis;

  var RUTA_MODELO = '3D/3dmodel.model';
  var UMBRAL_TRIANGULOS = 400000;
  var FACTORES_A_MM = {
    micron: 0.001,
    millimeter: 1,
    centimeter: 10,
    inch: 25.4,
    foot: 304.8,
    meter: 1000
  };

  function fallo(causa, detalle) {
    var err = new Error(detalle);
    err.causa = causa;
    err.detalle = detalle;
    return err;
  }

  // Busca nombre="..." y, si no, nombre='...'. Nunca por posicion: el orden de
  // atributos en un tag XML no esta garantizado. Devuelve undefined si no esta.
  function atributo(tag, nombre) {
    var conDobles = tag.match(new RegExp(nombre + '\\s*=\\s*"([^"]*)"'));
    if (conDobles) return conDobles[1];
    var conSimples = tag.match(new RegExp(nombre + "\\s*=\\s*'([^']*)'"));
    return conSimples ? conSimples[1] : undefined;
  }

  // Ausente o vacio -> identidad (default de la 3MF Core Spec). Si hay string,
  // deben ser 12 numeros finitos o el archivo esta mal formado.
  function parseTransform(str) {
    if (str === undefined || str === null || str.trim() === '') {
      return [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
    }
    var n = str.trim().split(/\s+/).map(Number);
    if (n.length !== 12 || n.some(function (x) { return !isFinite(x); })) {
      throw fallo('zip_corrupto', 'transform_invalido: "' + str + '"');
    }
    return n;
  }

  // 3MF Core Spec, transform fila-mayor de 12 valores m0..m11.
  function aplicarTransform(v, m) {
    return [
      v[0] * m[0] + v[1] * m[3] + v[2] * m[6] + m[9],
      v[0] * m[1] + v[1] * m[4] + v[2] * m[7] + m[10],
      v[0] * m[2] + v[1] * m[5] + v[2] * m[8] + m[11]
    ];
  }

  // Compone de modo que `a` se aplica primero: v_escena = v_local . a . b. El
  // resolver la llama siempre como multiplicarTransform(c.transform, transformAcum)
  // — el componente primero, nunca al reves.
  function multiplicarTransform(a, b) {
    var A = [[a[0], a[1], a[2]], [a[3], a[4], a[5]], [a[6], a[7], a[8]], [a[9], a[10], a[11]]];
    var B = [[b[0], b[1], b[2]], [b[3], b[4], b[5]], [b[6], b[7], b[8]], [b[9], b[10], b[11]]];
    var out = [];
    var i, j;
    for (i = 0; i < 3; i++) {
      for (j = 0; j < 3; j++) {
        out.push(A[i][0] * B[0][j] + A[i][1] * B[1][j] + A[i][2] * B[2][j]);
      }
    }
    for (j = 0; j < 3; j++) {
      out.push(A[3][0] * B[0][j] + A[3][1] * B[1][j] + A[3][2] * B[2][j] + B[3][j]);
    }
    return out;
  }

  // Un p:path de la Extension de Produccion viene con "/" inicial ("/3D/Objects/
  // object_42.model"); las entradas que devuelve LectorZip.listar() no la llevan
  // ("3D/Objects/object_42.model"). Sin esto, la parte externa nunca se encuentra
  // aunque exista en el ZIP.
  function normalizarRuta(p) {
    if (!p) return undefined;
    return p.charAt(0) === '/' ? p.slice(1) : p;
  }

  // Extrae el mapa id -> objeto de UN xml de modelo (el raiz, o una parte externa
  // referenciada por p:path). Factorizado para que ambos casos usen exactamente la
  // misma logica de parseo — antes de este fix solo existia para el archivo raiz,
  // por eso las partes externas de la Extension de Produccion no se leian nunca.
  function extraerObjetos(xml) {
    var objetos = new Map();
    var objRe = /<object\b([^>]*)>([\s\S]*?)<\/object>/g;
    var om;
    while ((om = objRe.exec(xml))) {
      var id = atributo(om[1], 'id');
      var cuerpo = om[2];
      var meshMatch = cuerpo.match(/<mesh>([\s\S]*?)<\/mesh>/);
      if (meshMatch) {
        var vertices = [];
        var vRe = /<vertex\b([^>]*)\/>/g;
        var vm;
        while ((vm = vRe.exec(meshMatch[1]))) {
          vertices.push([Number(atributo(vm[1], 'x')), Number(atributo(vm[1], 'y')), Number(atributo(vm[1], 'z'))]);
        }
        var triangulosObj = [];
        var tRe = /<triangle\b([^>]*)\/>/g;
        var tm;
        while ((tm = tRe.exec(meshMatch[1]))) {
          triangulosObj.push([Number(atributo(tm[1], 'v1')), Number(atributo(tm[1], 'v2')), Number(atributo(tm[1], 'v3'))]);
        }
        objetos.set(id, { tipo: 'mesh', vertices: vertices, triangulos: triangulosObj });
      } else {
        var compMatch = cuerpo.match(/<components>([\s\S]*?)<\/components>/);
        var componentes = [];
        if (compMatch) {
          var cRe = /<component\b([^>]*)\/>/g;
          var cm;
          while ((cm = cRe.exec(compMatch[1]))) {
            componentes.push({
              objectid: atributo(cm[1], 'objectid'),
              // p:path: la Extension de Produccion (Bambu Studio, PrusaSlicer,
              // Creality Print) mueve la malla real a "3D/Objects/object_NN.model"
              // y el <component> del archivo raiz solo trae una referencia con
              // transform propio. Sin path, el componente es local (Core Spec).
              path: normalizarRuta(atributo(cm[1], 'p:path')),
              transform: parseTransform(atributo(cm[1], 'transform'))
            });
          }
        }
        objetos.set(id, { tipo: 'components', componentes: componentes });
      }
      // Cualquier otro atributo o elemento (printable, name, type, <metadata>,
      // colores del compositor propio) se ignora sin producir error a proposito.
    }
    return objetos;
  }

  async function analizar3MF(arrayBuffer, opciones) {
    opciones = opciones || {};
    if (typeof opciones.onProgreso === 'function') opciones.onProgreso('leyendo');

    var entradas;
    try {
      entradas = await raiz.LectorZip.leerZip(arrayBuffer, RUTA_MODELO);
    } catch (e) {
      // zip_corrupto, metodo_no_soportado o demasiado_grande de LectorZip se
      // re-clasifican como zip_corrupto, conservando el codigo original en .detalle.
      throw fallo('zip_corrupto', e.causa || e.message);
    }

    var bytesModelo = entradas[RUTA_MODELO];
    if (!bytesModelo) throw fallo('falta_modelo', 'sin_3dmodel_model');

    var xml = new TextDecoder('utf-8').decode(bytesModelo);

    if (typeof opciones.onProgreso === 'function') opciones.onProgreso('verificando');

    // Unidad: ausente -> millimeter (default de la spec); presente pero desconocida
    // -> se rechaza. Son ramas distintas, nunca la misma.
    var unidad, factor;
    var unitMatch = xml.match(/<model\b[^>]*\bunit\s*=\s*["']([^"']*)["']/i);
    if (!unitMatch) {
      unidad = 'millimeter';
      factor = FACTORES_A_MM.millimeter;
    } else {
      unidad = unitMatch[1];
      if (!(unidad in FACTORES_A_MM)) {
        throw fallo('unidad_desconocida', 'unidad "' + unidad + '"');
      }
      factor = FACTORES_A_MM[unidad];
    }

    // Mapa completo de objetos del archivo raiz ANTES de resolver: las referencias
    // hacia adelante (un <component> que apunta a un <object> definido mas abajo)
    // son legales en 3MF. Las partes externas (p:path) se resuelven de a una, al
    // vuelo, en objetosDe() — la mayoria de los 3MF de Bambu Studio/PrusaSlicer/
    // Creality Print traen varias y no vale la pena leerlas si nadie las referencia.
    var objetosPorArchivo = new Map();
    objetosPorArchivo.set(RUTA_MODELO, extraerObjetos(xml));

    async function objetosDe(ruta) {
      if (objetosPorArchivo.has(ruta)) return objetosPorArchivo.get(ruta);
      var res;
      try {
        res = await raiz.LectorZip.leerZip(arrayBuffer, ruta);
      } catch (e) {
        throw fallo('zip_corrupto', 'parte_externa_no_legible: ' + ruta);
      }
      var bytesParte = res[ruta];
      if (!bytesParte) throw fallo('zip_corrupto', 'parte_externa_faltante: ' + ruta);
      var mapa = extraerObjetos(new TextDecoder('utf-8').decode(bytesParte));
      objetosPorArchivo.set(ruta, mapa);
      return mapa;
    }

    var buildMatch = xml.match(/<build\b[^>]*>([\s\S]*?)<\/build>/);
    if (!buildMatch) throw fallo('falta_modelo', 'sin_build');

    var items = [];
    var iRe = /<item\b([^>]*)\/>/g;
    var im;
    while ((im = iRe.exec(buildMatch[1]))) {
      items.push({ objectid: atributo(im[1], 'objectid'), transform: parseTransform(atributo(im[1], 'transform')) });
    }
    if (items.length === 0) throw fallo('falta_modelo', 'build_vacio');

    var posiciones = [];
    var indices = [];
    var minX = Infinity, minY = Infinity, minZ = Infinity;
    var maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    async function resolver(objectid, transformAcum, pila, archivo) {
      // La clave de ciclo lleva el archivo: el mismo objectid numerico puede existir
      // sin relacion en dos partes externas distintas (cada archivo tiene su propio
      // espacio de ids), asi que "objeto 1 del archivo A" y "objeto 1 del archivo B"
      // son entradas de pila distintas.
      var clave = archivo + '#' + objectid;
      if (pila.has(clave)) {
        throw fallo('zip_corrupto', 'ciclo_componentes: ' + clave);
      }
      var mapaObjetos = await objetosDe(archivo);
      var obj = mapaObjetos.get(objectid);
      if (!obj) {
        throw fallo('zip_corrupto', 'objeto_inexistente: ' + objectid + ' en ' + archivo);
      }
      if (obj.tipo === 'mesh') {
        var base = posiciones.length / 3;
        for (var i = 0; i < obj.vertices.length; i++) {
          var t = aplicarTransform(obj.vertices[i], transformAcum);
          var x = t[0] * factor, y = t[1] * factor, z = t[2] * factor;
          posiciones.push(x, y, z);
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          if (z < minZ) minZ = z;
          if (z > maxZ) maxZ = z;
        }
        for (var j = 0; j < obj.triangulos.length; j++) {
          var tri = obj.triangulos[j];
          indices.push(base + tri[0], base + tri[1], base + tri[2]);
        }
      } else {
        var nuevaPila = new Set(pila);
        nuevaPila.add(clave);
        for (var k = 0; k < obj.componentes.length; k++) {
          var c = obj.componentes[k];
          // c.path es la parte externa que declaro este <component> (Extension de
          // Produccion); sin p:path el componente es local, sigue en el mismo archivo.
          await resolver(c.objectid, multiplicarTransform(c.transform, transformAcum), nuevaPila, c.path || archivo);
        }
      }
    }

    for (var idx = 0; idx < items.length; idx++) {
      await resolver(items[idx].objectid, items[idx].transform, new Set(), RUTA_MODELO);
    }

    if (indices.length === 0) throw fallo('falta_modelo', 'sin_geometria');

    var triangulos = indices.length / 3;
    var medidas = {
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ],
      ancho: maxX - minX,
      largo: maxY - minY,
      alto: maxZ - minZ
    };
    // Nunca truncar ni lanzar por densidad: la decision de seguir es de Farid.
    var aviso = triangulos > UMBRAL_TRIANGULOS ? { tipo: 'malla_densa', triangulos: triangulos } : null;

    return {
      posiciones: Float32Array.from(posiciones),
      indices: Uint32Array.from(indices),
      triangulos: triangulos,
      vertices: posiciones.length / 3,
      unidad: unidad,
      medidas: medidas,
      aviso: aviso
    };
  }

  raiz.Lector3MF = {
    RUTA_MODELO: RUTA_MODELO,
    UMBRAL_TRIANGULOS: UMBRAL_TRIANGULOS,
    FACTORES_A_MM: FACTORES_A_MM,
    analizar3MF: analizar3MF
  };
})();
