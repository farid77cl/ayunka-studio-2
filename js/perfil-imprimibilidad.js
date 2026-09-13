/* Ayünka Studio — perfil-imprimibilidad: decide si la pieza se puede imprimir tal como se
 * pide, comparando el detalle más fino y la pared más delgada que ya midió la Fase 3
 * contra un umbral con margen de seguridad sobre la boquilla de la K2. Es la pregunta que
 * ninguna otra parte de la app responde todavía.
 *
 * Los números que usa (DIAMETRO_BOQUILLA_MM, MARGEN_SEGURIDAD) están documentados junto a
 * su declaración, más abajo.
 *
 * Módulo aparte de perfil-medidas.js porque la Fase 3 mide, no juzga: entrega números
 * crudos de geometría sin opinar sobre si sirven. Módulo aparte también del motor de
 * reglas de la Fase 4 (perfil-reglas.js, Pitfall 2 de 05-RESEARCH.md): ese asume que la
 * pieza SÍ se puede imprimir y solo decide cuántas paredes caben; este responde la
 * pregunta anterior. Los dos leen el mismo `resultado` de la Fase 3, cada uno por su
 * cuenta, sin referenciarse entre sí en ninguna dirección.
 *
 * Contrato completo: .planning/phases/05-decir-que-no-cuando-corresponde/05-RESEARCH.md.
 * El contrato ejecutable es ayunka-studio/pruebas/perfil-imprimibilidad.prueba.cjs.
 */
(function () {
  'use strict';

  var raiz = (typeof self !== 'undefined') ? self : globalThis;

  // Diámetro pelado de la boquilla de la K2 de Farid. Confirmado por el nombre real del
  // bundle de referencia (.planning/referencia/Creality K2 0.4 nozzle.creality_printer) y
  // por .planning/PROJECT.md — ojo que NO vive en CLAUDE.md pese a cómo lo citan los
  // CONTEXT.md de las fases 3, 4 y 5 (desvío de referencia detectado en 05-RESEARCH.md).
  var DIAMETRO_BOQUILLA_MM = 0.4;

  // D-02: margen de seguridad, no comparación exacta contra el diámetro pelado. 2.5 es el
  // punto medio del rango 2x-3x que cita la práctica FDM real para el ancho mínimo de
  // pared imprimible — es un número [ASSUMED], no una norma oficial, y es la PRIMERA
  // constante a ajustar si la impresión física de VERIF-01 (Fase 6) no coincide con el
  // veredicto.
  var MARGEN_SEGURIDAD = 2.5;

  // Umbral real de la comparación — nunca DIAMETRO_BOQUILLA_MM sola (Pitfall 1: comparar
  // contra el diámetro pelado en vez del umbral con margen). Da 1.0 mm con los valores de
  // arriba.
  var UMBRAL_MM = DIAMETRO_BOQUILLA_MM * MARGEN_SEGURIDAD;

  // ---------- evaluar: el veredicto geométrico, síncrono y puro ----------
  //
  // (resultado) => null | { problemas, umbralMM, boquillaMM, aproximado }.
  //
  // `resultado` es el contrato de salida de perfil-medidas.js: { grosorMinimo, grabados,
  // avisoMedicion }. No muta esa entrada: cada problema que se agrega es un objeto NUEVO,
  // con su `ubicacion` copiada, nunca una referencia al `resultado` recibido.
  //
  // Tres reglas que no se rompen acá, cada una respondiendo a un pitfall real de
  // 05-RESEARCH.md:
  // 1. La comparación siempre es contra UMBRAL_MM, jamás contra el diámetro pelado de la
  //    boquilla directo.
  // 2. Una medición aproximada (resultado.avisoMedicion presente) marca el veredicto como
  //    aproximado, nunca lo apaga — es justo el caso donde más falta hace ser cauteloso.
  // 3. Este módulo no se acopla con el motor de reglas de la Fase 4 en ninguna dirección:
  //    ese decide cuántas paredes caben asumiendo que la pieza se puede imprimir, este
  //    responde la pregunta anterior.
  function evaluar(resultado) {
    if (!resultado) return null;

    var problemas = [];

    if (Array.isArray(resultado.grabados) && resultado.grabados.length > 0) {
      agregarSiBajoUmbral(problemas, 'detalle', resultado.grabados[0]);
    }
    agregarSiBajoUmbral(problemas, 'pared', resultado.grosorMinimo);

    if (problemas.length === 0) return null;

    return {
      problemas: problemas,
      umbralMM: UMBRAL_MM,
      boquillaMM: DIAMETRO_BOQUILLA_MM,
      aproximado: !!resultado.avisoMedicion
    };
  }

  // Empuja un problema nuevo a `problemas` si `entrada.valor` es un número finito Y está
  // bajo UMBRAL_MM. El guard de número finito no es paranoia decorativa (T-05-T2 del
  // threat_model): sin él, un valor raro que venga de un 3MF que Farid no escribió se
  // convierte en un valor sin sentido, visible en la pantalla del taller.
  function agregarSiBajoUmbral(problemas, tipo, entrada) {
    if (!entrada || typeof entrada.valor !== 'number' || !isFinite(entrada.valor)) return;
    if (entrada.valor >= UMBRAL_MM) return;
    problemas.push({
      tipo: tipo,
      valor: entrada.valor,
      ubicacion: Array.isArray(entrada.ubicacion) ? entrada.ubicacion.slice() : null
    });
  }

  raiz.PerfilImprimibilidad = {
    DIAMETRO_BOQUILLA_MM: DIAMETRO_BOQUILLA_MM,
    MARGEN_SEGURIDAD: MARGEN_SEGURIDAD,
    UMBRAL_MM: UMBRAL_MM,
    evaluar: evaluar
  };
})();
