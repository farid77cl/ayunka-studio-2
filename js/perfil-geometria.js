/* Ayünka Studio — ciclo de vida del Worker que lee el 3MF (js/perfil-worker.js).
 * Corre en el hilo principal, por eso sigue la convencion window.NOMBRE de
 * .planning/codebase/CONVENTIONS.md (a diferencia de perfil-worker.js, que es la
 * excepcion documentada — ahi no existe `window`).
 *
 * Un Worker nuevo por CADA intento, nunca se reutiliza: terminate() lo deja
 * inservible, y los scripts que carga son propios y diminutos — no hay costo de CDN
 * que amortizar reutilizandolo (02-RESEARCH.md).
 */
(function () {
  'use strict';

  var TIEMPO_LIMITE_MS = 30000;
  // { worker, rechazar, temporizador } o null — un solo analisis a la vez.
  var enVuelo = null;

  function fallo(causa, detalle) {
    var err = new Error(detalle);
    err.causa = causa;
    err.detalle = detalle;
    return err;
  }

  function cancelar() {
    if (!enVuelo) return;
    var actual = enVuelo;
    enVuelo = null;
    if (actual.temporizador) clearTimeout(actual.temporizador);
    try { actual.worker.terminate(); } catch (e) {}
    actual.rechazar(fallo('cancelado', 'cancelado_por_el_usuario'));
  }

  async function analizar(file, opciones) {
    opciones = opciones || {};
    // Soltar un segundo archivo mientras el primero se lee no debe dejar dos Workers
    // vivos: se cancela el anterior antes de crear uno nuevo.
    cancelar();

    var buffer = await file.arrayBuffer();

    var worker;
    try {
      // CON prefijo 'js/': new Worker resuelve relativo al DOCUMENTO (index.html), al
      // reves del importScripts de adentro del propio Worker (que va sin prefijo, ver
      // perfil-worker.js). Dos reglas opuestas a dos lineas de distancia — es donde se
      // equivoca cualquiera que edite uno de los dos archivos mirando al otro.
      worker = new Worker('js/perfil-worker.js');
    } catch (e) {
      throw fallo('zip_corrupto', 'worker_no_disponible');
    }

    return new Promise(function (resolver, rechazar) {
      var temporizador = null;

      function terminar() {
        if (temporizador) { clearTimeout(temporizador); temporizador = null; }
        try { worker.terminate(); } catch (e) {}
        enVuelo = null;
      }

      // Reinicia el reloj de TIEMPO_LIMITE_MS. Se llama al arrancar y con cada mensaje
      // de progreso: un Worker que sigue avisando avance esta vivo — lo que hay que
      // cortar es el que enmudece.
      function reiniciarReloj() {
        if (temporizador) clearTimeout(temporizador);
        temporizador = setTimeout(function () {
          terminar();
          rechazar(fallo('timeout', 'sin_respuesta_en_' + TIEMPO_LIMITE_MS + 'ms'));
        }, TIEMPO_LIMITE_MS);
        if (enVuelo) enVuelo.temporizador = temporizador;
      }

      worker.onmessage = function (e) {
        var msg = e.data;
        if (msg.tipo === 'progreso') {
          reiniciarReloj();
          if (typeof opciones.onProgreso === 'function') {
            // Un error de la interfaz (dentro del callback de Farid) no debe tumbar
            // el analisis que sigue corriendo en el Worker.
            try { opciones.onProgreso(msg.etapa); } catch (e) {}
          }
        } else if (msg.tipo === 'listo') {
          terminar();
          // Lista blanca copiada campo por campo A PROPOSITO (no es resolver(msg)): todo
          // campo nuevo que se agregue al mensaje 'listo' del Worker hay que sumarlo
          // tambien aca, o desaparece en silencio, sin error en ninguna consola. Esta es
          // la unica defensa que va a tener la Fase 4 cuando agregue sus propios campos.
          resolver({
            posiciones: msg.posiciones, indices: msg.indices, triangulos: msg.triangulos,
            vertices: msg.vertices, unidad: msg.unidad, medidas: msg.medidas, aviso: msg.aviso,
            grosorMinimo: msg.grosorMinimo, grabados: msg.grabados, avisoMedicion: msg.avisoMedicion
          });
        } else if (msg.tipo === 'error') {
          terminar();
          rechazar(fallo(msg.causa, msg.detalle));
        }
      };

      // Cubre que importScripts falle por un 404 dentro del Worker: el NetworkError
      // de la Pitfall 2 llega por aca, no por worker.onmessage.
      worker.onerror = function (e) {
        terminar();
        rechazar(fallo('zip_corrupto', 'worker_error: ' + ((e && e.message) || '')));
      };

      // Guardar el estado ANTES del postMessage, para que un cancelar() disparado
      // justo despues de crear el Worker encuentre algo que matar.
      enVuelo = { worker: worker, rechazar: rechazar, temporizador: null };
      reiniciarReloj();

      // El ArrayBuffer se transfiere, no se copia: despues de esto queda vacio en el
      // hilo principal, no volver a usarlo.
      worker.postMessage({ buffer }, [buffer]);
    });
  }

  window.PerfilGeometria = {
    TIEMPO_LIMITE_MS: TIEMPO_LIMITE_MS,
    analizar: analizar,
    cancelar: cancelar
  };
})();
