/* Ayünka Studio — lector de 3MF ajenos (los que manda un cliente, o Creality Print).
 * A diferencia del escritor de d3d-3mf.js (que solo escribe "stored"), un 3MF real puede
 * venir comprimido con deflate -- se usa DecompressionStream('deflate-raw'), nativo del
 * navegador, sin ninguna librería. */
(function () {
  'use strict';

  async function inflar(bytes) {
    const ds = new DecompressionStream('deflate-raw');
    const stream = new Blob([bytes]).stream().pipeThrough(ds);
    const buf = await new Response(stream).arrayBuffer();
    return new Uint8Array(buf);
  }

  async function unzip(datos) {
    const dv = new DataView(datos.buffer, datos.byteOffset, datos.byteLength);
    // Central directory: buscar la firma desde el final (End Of Central Directory).
    let eocd = -1;
    for (let i = datos.length - 22; i >= 0; i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('zip_corrupto');
    const nEntradas = dv.getUint16(eocd + 10, true);
    let offset = dv.getUint32(eocd + 16, true);
    const out = {};
    for (let n = 0; n < nEntradas; n++) {
      if (dv.getUint32(offset, true) !== 0x02014b50) break;
      const metodo = dv.getUint16(offset + 10, true);
      const compTam = dv.getUint32(offset + 20, true);
      const sinCompTam = dv.getUint32(offset + 24, true);
      const nombreLen = dv.getUint16(offset + 28, true);
      const extraLen = dv.getUint16(offset + 30, true);
      const comentarioLen = dv.getUint16(offset + 32, true);
      const offsetLocal = dv.getUint32(offset + 42, true);
      const nombre = new TextDecoder().decode(datos.subarray(offset + 46, offset + 46 + nombreLen));
      out[nombre] = { offsetLocal, metodo, compTam, sinCompTam };
      offset += 46 + nombreLen + extraLen + comentarioLen;
    }
    const archivos = {};
    for (const nombre of Object.keys(out)) {
      const e = out[nombre];
      const lNombreLen = dv.getUint16(e.offsetLocal + 26, true);
      const lExtraLen = dv.getUint16(e.offsetLocal + 28, true);
      const inicioDatos = e.offsetLocal + 30 + lNombreLen + lExtraLen;
      const crudo = datos.subarray(inicioDatos, inicioDatos + e.compTam);
      archivos[nombre] = e.metodo === 0 ? crudo : await inflar(crudo);
    }
    return archivos;
  }

  function contarPiezas(modeloXml) {
    const items = modeloXml.match(/<item\b[^>]*>/g) || [];
    return items.length || 1;
  }

  function tiempoDeNombre(nombreArchivo) {
    const m = (nombreArchivo || '').match(/_(\d+)h(\d+)m(?:(\d+)s)?/);
    if (!m) return null;
    return +m[1] + (+m[2]) / 60 + (m[3] ? +m[3] / 3600 : 0);
  }

  async function leer3mf(file) {
    let bytes;
    try { bytes = new Uint8Array(await file.arrayBuffer()); }
    catch (e) { throw new Error('No pude leer el archivo.'); }
    let archivos;
    try { archivos = await unzip(bytes); }
    catch (e) { throw new Error('Este archivo no se pudo abrir como 3MF. Puede estar dañado.'); }
    const modeloKey = Object.keys(archivos).find(k => /3dmodel\.model$/i.test(k));
    if (!modeloKey) throw new Error('Este ZIP no tiene la pieza adentro (falta 3dmodel.model). ¿Es realmente un 3MF?');
    const modeloXml = new TextDecoder().decode(archivos[modeloKey]);
    const pausas = Object.keys(archivos).some(k => /custom_gcode_per_layer\.xml$/i.test(k));
    return {
      nombre: file.name,
      piezas: contarPiezas(modeloXml),
      pausas,
      tiempoDeNombre: tiempoDeNombre(file.name)
    };
  }

  window.Lector3MF = { leer3mf, unzip, contarPiezas, tiempoDeNombre };
})();
