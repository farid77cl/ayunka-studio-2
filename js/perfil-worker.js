/* Ayünka Studio — Worker de lectura de 3MF. Solo mensajeria: cero logica de parseo,
 * que vive en lector-zip.js y lector-3mf.js.
 * 1. NO lleva <script defer> en index.html — se carga con `new Worker(...)` desde
 *    perfil-geometria.js. Que entre al array ASSETS de sw.js lo agrega el plan 05.
 * 2. Aqui no existe `window`: excepcion deliberada a window.NOMBRE de
 *    .planning/codebase/CONVENTIONS.md — un Worker no tiene DOM.
 */
'use strict';

// importScripts resuelve relativo a la URL de este Worker (ya vive en la carpeta de
// scripts), al reves que un <script src="..."> de index.html (relativo al documento).
// Nombres SIN prefijo de carpeta: agregarlo "para que se parezca" a index.html duplica
// el directorio y falla con NetworkError recien la primera vez que corre de verdad
// (02-RESEARCH.md, Pitfall 2) — ninguna comprobacion estatica lo detecta antes.
importScripts('lector-zip.js', 'lector-3mf.js', 'perfil-medidas.js');

// Callback de progreso reutilizado por analizar3MF() y medir(): una sola closure en vez
// de duplicarla en las dos llamadas. analizar3MF() avisa 'leyendo'/'verificando';
// medir() avisa 'midiendo' al empezar y de nuevo cada 2000 origenes procesados, para
// mantener vivo el reloj de 30s de perfil-geometria.js.
function avisar(etapa) { self.postMessage({ tipo: 'progreso', etapa: etapa }); }

self.onmessage = async function (e) {
  var buffer = e && e.data && e.data.buffer;
  // Object.prototype.toString.call en vez de `instanceof ArrayBuffer`: un buffer que
  // viene de otro realm no pasa el instanceof (misma leccion de la Fase 1 que ya
  // documenta lector-zip.js con ArrayBuffer.isView).
  if (Object.prototype.toString.call(buffer) !== '[object ArrayBuffer]') {
    self.postMessage({ tipo: 'error', causa: 'zip_corrupto', detalle: 'sin_buffer' });
    return;
  }
  try {
    var r = await self.Lector3MF.analizar3MF(buffer, { onProgreso: avisar });
    // medir() es sincrono, sin await, y lee r.posiciones/r.indices -- va DESPUES de
    // analizar3MF y ANTES del postMessage de listo, porque esos buffers recien se
    // transfieren ahi (si se transfirieran antes, medir() los encontraria vacios).
    var m = self.PerfilMedidas.medir(r.posiciones, r.indices, { onProgreso: avisar });
    // aviso (Fase 2, solo 'malla_densa') y avisoMedicion (esta tarea) son dos campos
    // separados a proposito: perfil.js linea 109 usa res.aviso como interruptor de
    // estado para la tarjeta "Malla densa", y fusionarlos la mostraria con datos vacios.
    self.postMessage({
      tipo: 'listo', posiciones: r.posiciones, indices: r.indices, triangulos: r.triangulos,
      vertices: r.vertices, unidad: r.unidad, medidas: r.medidas, aviso: r.aviso,
      grosorMinimo: m.grosorMinimo, grabados: m.grabados, avisoMedicion: m.avisoMedicion
    }, [r.posiciones.buffer, r.indices.buffer]);
  } catch (err) {
    // Respaldo 'zip_corrupto': ninguna excepcion sin clasificar sale en silencio.
    self.postMessage({
      tipo: 'error',
      causa: (err && err.causa) || 'zip_corrupto',
      detalle: (err && (err.detalle || err.message)) || 'desconocido'
    });
  }
};
