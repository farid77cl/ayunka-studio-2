/* Ayünka Studio — lector de ZIP para navegador/Worker.

   Excepción deliberada a la convención de exponer cada módulo en `window` (ver
   `.planning/codebase/CONVENTIONS.md`): este módulo se carga con `importScripts` dentro
   de un Web Worker, donde `window` no existe. Por eso se cuelga de `self` (o de
   `globalThis` si tampoco hay `self`, como en las pruebas de Node bajo `vm`).

   Puerto de `ayunka-studio/pruebas/leer-zip.cjs`: la lógica de contenedor ZIP (buscar
   el End Of Central Directory, recorrer el directorio central, leer la cabecera local
   para saber dónde empiezan los datos) es la misma — cambian solo los primitivos de
   acceso a bytes: `DataView` en vez de `Buffer.readUIntXXLE`, y
   `DecompressionStream('deflate-raw')` en vez de `zlib.inflateRawSync`. Se agrega
   además la comprobación de tamaño descomprimido (offset +24 del registro central) que
   la versión de Node no necesitaba: ahí la memoria la controla el sistema operativo,
   aquí un archivo adversarial podría reventar la memoria del teléfono de Farid antes de
   que el umbral de triángulos de la Fase 2 llegue siquiera a correr.                    */
(function () {
  'use strict';

  var raiz = (typeof self !== 'undefined') ? self : globalThis;

  var FIN_CENTRAL = 0x06054b50;
  var CABECERA_CENTRAL = 0x02014b50;
  var CABECERA_LOCAL = 0x04034b50;
  var LIMITE_DESCOMPRIMIDO = 256 * 1024 * 1024;

  function fallo(causa, detalle) {
    var err = new Error(detalle);
    err.causa = causa;
    err.detalle = detalle;
    return err;
  }

  // Acepta ArrayBuffer o cualquier vista (ArrayBuffer.isView, no `instanceof Uint8Array`
  // — un buffer que viene de otro realm no pasa el instanceof, lección de la Fase 1).
  function normalizar(entrada) {
    if (ArrayBuffer.isView(entrada)) {
      return { buffer: entrada.buffer, base: entrada.byteOffset, largo: entrada.byteLength };
    }
    return { buffer: entrada, base: 0, largo: entrada.byteLength };
  }

  /* listar(arrayBuffer): síncrona. No descomprime ni valida tamaños — solo recorre el
     directorio central y devuelve dónde está cada entrada. */
  function listar(arrayBuffer) {
    var norm = normalizar(arrayBuffer);
    var buffer = norm.buffer, base = norm.base, largo = norm.largo;
    var dv = new DataView(buffer);

    var finOffset = -1;
    var iniBusqueda = base + largo - 22;
    var minimo = base + Math.max(0, largo - 22 - 65535);
    for (var i = iniBusqueda; i >= minimo; i--) {
      if (dv.getUint32(i, true) === FIN_CENTRAL) { finOffset = i; break; }
    }
    if (finOffset === -1) throw fallo('zip_corrupto', 'No se encontro el End Of Central Directory');

    var numEntradas = dv.getUint16(finOffset + 10, true);
    var offset = base + dv.getUint32(finOffset + 16, true);
    var decoder = new TextDecoder('utf-8');
    var entradas = [];

    for (var n = 0; n < numEntradas; n++) {
      if (dv.getUint32(offset, true) !== CABECERA_CENTRAL) {
        throw fallo('zip_corrupto', 'Directorio central corrupto: firma inesperada en la entrada ' + n);
      }
      var metodo = dv.getUint16(offset + 10, true);
      var tamComprimido = dv.getUint32(offset + 20, true);
      var tamDescomprimido = dv.getUint32(offset + 24, true);
      var largoNombre = dv.getUint16(offset + 28, true);
      var largoExtra = dv.getUint16(offset + 30, true);
      var largoComentario = dv.getUint16(offset + 32, true);
      var offsetLocal = base + dv.getUint32(offset + 42, true);
      var nombre = decoder.decode(new Uint8Array(buffer, offset + 46, largoNombre));

      if (dv.getUint32(offsetLocal, true) !== CABECERA_LOCAL) {
        throw fallo('zip_corrupto', 'Cabecera local corrupta para "' + nombre + '"');
      }
      var largoNombreLocal = dv.getUint16(offsetLocal + 26, true);
      var largoExtraLocal = dv.getUint16(offsetLocal + 28, true);
      var inicioDatos = offsetLocal + 30 + largoNombreLocal + largoExtraLocal;

      entradas.push({
        nombre: nombre,
        metodo: metodo,
        tamComprimido: tamComprimido,
        tamDescomprimido: tamDescomprimido,
        inicioDatos: inicioDatos
      });

      offset += 46 + largoNombre + largoExtra + largoComentario;
    }

    return entradas;
  }

  async function inflarRaw(bytes, nombre) {
    try {
      var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      var buf = await new Response(stream).arrayBuffer();
      return new Uint8Array(buf);
    } catch (e) {
      throw fallo('zip_corrupto', 'No se pudo descomprimir "' + nombre + '": ' + e.message);
    }
  }

  /* leerEntrada(arrayBuffer, entrada): asíncrona. El orden es la mitigación — el tamaño
     declarado se comprueba ANTES de tocar los bytes comprimidos, para que una bomba de
     descompresión se corte sin llegar a construir un DecompressionStream. */
  async function leerEntrada(arrayBuffer, entrada) {
    if (entrada.tamDescomprimido > LIMITE_DESCOMPRIMIDO) {
      throw fallo(
        'demasiado_grande',
        'La entrada "' + entrada.nombre + '" declara ' + entrada.tamDescomprimido +
        ' bytes descomprimidos, supera el limite de ' + LIMITE_DESCOMPRIMIDO + ' bytes'
      );
    }

    var buffer = normalizar(arrayBuffer).buffer;
    var datosComprimidos = new Uint8Array(buffer, entrada.inicioDatos, entrada.tamComprimido);

    var resultado;
    if (entrada.metodo === 0) {
      resultado = datosComprimidos.slice();
    } else if (entrada.metodo === 8) {
      resultado = await inflarRaw(datosComprimidos, entrada.nombre);
    } else {
      throw fallo('metodo_no_soportado', 'Metodo ' + entrada.metodo + ' en "' + entrada.nombre + '"');
    }

    // El campo declarado podia mentir hacia abajo: se vuelve a comprobar el tamaño real.
    if (resultado.length > LIMITE_DESCOMPRIMIDO) {
      throw fallo(
        'demasiado_grande',
        'La entrada "' + entrada.nombre + '" descomprimio a ' + resultado.length +
        ' bytes, supera el limite de ' + LIMITE_DESCOMPRIMIDO + ' bytes'
      );
    }

    return resultado;
  }

  /* leerZip(arrayBuffer, filtro): asíncrona. filtro es opcional — undefined = todas las
     entradas, string = solo esa entrada exacta, función (nombre)=>boolean = las que
     devuelvan true. Solo se descomprime lo que pasa el filtro, en serie. */
  async function leerZip(arrayBuffer, filtro) {
    var entradas = listar(arrayBuffer);
    var seleccionadas;

    if (filtro === undefined) {
      seleccionadas = entradas;
    } else if (typeof filtro === 'string') {
      seleccionadas = entradas.filter(function (e) { return e.nombre === filtro; });
    } else if (typeof filtro === 'function') {
      seleccionadas = entradas.filter(function (e) { return filtro(e.nombre); });
    } else {
      throw fallo('zip_corrupto', 'Filtro invalido para leerZip');
    }

    var resultado = {};
    for (var idx = 0; idx < seleccionadas.length; idx++) {
      var entrada = seleccionadas[idx];
      resultado[entrada.nombre] = await leerEntrada(arrayBuffer, entrada);
    }
    return resultado;
  }

  raiz.LectorZip = {
    LIMITE_DESCOMPRIMIDO: LIMITE_DESCOMPRIMIDO,
    listar: listar,
    leerEntrada: leerEntrada,
    leerZip: leerZip
  };
})();
