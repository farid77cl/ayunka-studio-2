/* Ayünka Studio — perfil-reglas: traduce (metas de taller + material + geometría medida
 * en la Fase 3) a valores concretos de proceso de Creality Print, cada uno con su "por
 * qué" en castellano sin jerga. Corre en el hilo principal (no dentro del Worker: no hay
 * cómputo pesado que lo justifique, a diferencia de perfil-medidas.js).
 *
 * Las reglas viven como DATOS — un array plano `REGLAS` que se filtra por familia — no
 * como una cadena de `if` por combinación de metas (REGLA-06). Los 3 pares de metas que
 * se pelean entre sí (todos contra "rapidez", ninguno entre sí) son otra tabla de datos,
 * `PARES_EN_CONFLICTO`, con 5 posiciones fijas por par en vez de una interpolación
 * numérica continua.
 *
 * Contratos completos: `.planning/phases/04-metas-y-motor-de-reglas/04-RESEARCH.md`
 * (mapa de metas → claves, diseño del control de balance, diferencia por material) y
 * `04-UI-SPEC.md` (el patrón de copy de `porqueEnPaso` y el Component 5 de estado vacío).
 * El contrato ejecutable es `ayunka-studio/pruebas/perfil-reglas.prueba.cjs`.
 */
(function () {
  'use strict';

  var raiz = (typeof self !== 'undefined') ? self : globalThis;

  // ---------- constantes con su porqué ----------

  // Ancho de línea de una pared con boquilla 0.4 mm; divisor del clamp de `wall_loops`.
  // Es el único número de este módulo que NO es [ASSUMED]: sale directo del
  // `initial_layer_line_width` / `inner_wall_line_width` reales de `llaveros.json`.
  var ANCHO_LINEA_PARED_MM = 0.4;

  // Cuántas paredes proponer cuando `grosorMinimo` es `null` (sin dato de geometría
  // medida) — Pitfall 4 de 04-RESEARCH.md: no reventar, proponer un valor razonable.
  var WALL_LOOPS_SIN_DATO = 4;

  // [ASSUMED] — PETG tolera peor la velocidad agresiva antes de perder adhesión entre
  // capas que PLA. Se aplica SOLO a las claves de velocidad que salen de una tabla de
  // conflicto (el extremo "rapidez") y a las claves propias de la familia `rapidez`,
  // NUNCA a los valores base de otra familia (ej. `outer_wall_speed` de
  // `terminacion_pared` siempre vale 50 en su regla base), para que el piso de D-12 en
  // PLA quede exacto en 50 sin importar qué otras metas estén activas.
  var FACTOR_VELOCIDAD_MATERIAL = { PLA: 1, PETG: 0.75 };

  var FAMILIAS = ['resolucion', 'terminacion_pared', 'resistencia', 'rapidez'];

  // Claves cuyo nombre termina en "_speed": las 7 claves de velocidad del módulo. Se usa
  // para decidir a cuáles aplicar FACTOR_VELOCIDAD_MATERIAL cuando salen de una tabla de
  // conflicto (layer_height y wall_loops/sparse_infill_density NO son velocidad, no
  // llevan factor aunque salgan de una tabla).
  function esClaveDeVelocidad(clave) {
    return typeof clave === 'string' && clave.slice(-6) === '_speed';
  }

  function velocidadConFactor(base, material) {
    var factor = FACTOR_VELOCIDAD_MATERIAL[material] !== undefined ? FACTOR_VELOCIDAD_MATERIAL[material] : 1;
    return Math.round(base * factor);
  }

  // ---------- REGLAS: una entrada por clave, agrupadas por familia ----------
  //
  // NO se incluyen `seam_position`, `seam_slope_type`, `enable_arc_fitting` ni
  // `prime_tower_rib_wall` aunque estén en el `llaveros.json` real de Farid: son
  // preferencia personal suya para esa pieza puntual, no la receta generalizable de
  // ninguna meta (Pitfall 1 de 04-RESEARCH.md). No agregarlas después creyendo que
  // faltan — falta a propósito.
  var REGLAS = [
    // ---- familia: resolucion ----
    {
      clave: 'layer_height',
      familia: 'resolucion',
      valor: function () { return 0.10; },
      porque: function (geometria) {
        if (geometria && Array.isArray(geometria.grabados) && geometria.grabados.length > 0) {
          return 'Se puso en 0.10 mm porque pediste máxima resolución: tu detalle más fino mide ' +
            geometria.grabados[0].valor.toFixed(2) + ' mm.';
        }
        return 'Se puso en 0.10 mm porque pediste máxima resolución: es la capa más fina que aguanta bien la boquilla de la K2.';
      },
    },
    {
      clave: 'initial_layer_print_height',
      familia: 'resolucion',
      valor: function () { return 0.08; },
      porque: function () {
        return 'Se dejó la primera capa en 0.08 mm para que agarre bien la plancha sin perder la resolución del resto de la pieza.';
      },
    },
    {
      clave: 'line_width',
      familia: 'resolucion',
      valor: function () { return 0.32; },
      porque: function () {
        return 'Se angostó la línea a 0.32 mm para que los bordes finos salgan definidos, en línea con la máxima resolución pedida.';
      },
    },

    // ---- familia: terminacion_pared ----
    {
      clave: 'wall_generator',
      familia: 'terminacion_pared',
      valor: function () { return 'arachne'; },
      porque: function () {
        return 'Se activó el generador de paredes que se adapta al grosor real de cada tramo, para que la terminación quede pareja.';
      },
    },
    {
      clave: 'outer_wall_speed',
      familia: 'terminacion_pared',
      valor: function () { return 50; },
      porque: function () {
        return 'Se bajó la velocidad de la pared exterior a 50 mm/s: menos vibración, más prolijidad visible.';
      },
    },
    {
      clave: 'top_surface_speed',
      familia: 'terminacion_pared',
      valor: function () { return 60; },
      porque: function () {
        return 'Se bajó a 60 mm/s la velocidad de la última capa de arriba, para que quede lisa.';
      },
    },
    {
      clave: 'top_surface_line_width',
      familia: 'terminacion_pared',
      valor: function () { return 0.32; },
      porque: function () {
        return 'Se dejó en 0.32 mm el ancho de línea de la superficie de arriba, para que el planchado la cubra bien.';
      },
    },
    {
      clave: 'ironing_type',
      familia: 'terminacion_pared',
      valor: function () { return 'top'; },
      porque: function () {
        return 'Se activó el planchado solo arriba: mejora la terminación visible sin gastar tiempo de más en el resto de la pieza.';
      },
    },
    {
      clave: 'ironing_flow',
      familia: 'terminacion_pared',
      dependeDe: ['ironing_type'],
      valor: function (geometria, material) { return material === 'PETG' ? '25%' : '33%'; },
      porque: function (geometria, material) {
        return 'Se calibró el flujo de la pasada extra en ' + (material === 'PETG' ? '25%' : '33%') +
          ' para ' + (material || 'PLA') + ', así alisa sin rebalsar material.';
      },
    },
    {
      clave: 'ironing_speed',
      familia: 'terminacion_pared',
      valor: function () { return 100; },
      porque: function () {
        return 'Se fijó en 100 mm/s la velocidad de la pasada extra: lo bastante lento para que alise bien la superficie.';
      },
    },

    // ---- familia: resistencia ----
    // Los NOMBRES de estas 4 claves vienen de la wiki de OrcaSlicer cruzada con el
    // linaje confirmado de Creality Print, no de un export real de Farid — Assumption
    // A1 de 04-RESEARCH.md [ASSUMED], pendiente de confirmar contra un export real en
    // el plan 04-07 (puerta de cierre de la fase).
    {
      clave: 'wall_loops',
      familia: 'resistencia',
      // Clamp físico de la pieza a partir del tramo más delgado medido en la Fase 3 —
      // NO es un conflicto de metas, nunca dispara una tarjeta de conflicto (Pitfall 3
      // de 04-RESEARCH.md). Decir "esto no se puede imprimir" es trabajo de la Fase 5,
      // acá solo se propone la mejor cantidad de paredes físicamente razonable.
      valor: function (geometria) {
        var grosor = geometria && geometria.grosorMinimo;
        if (!grosor || !Number.isFinite(grosor.valor)) return WALL_LOOPS_SIN_DATO;
        var bruto = Math.floor(grosor.valor / ANCHO_LINEA_PARED_MM);
        return Math.min(4, Math.max(1, bruto));
      },
      porque: function (geometria) {
        var grosor = geometria && geometria.grosorMinimo;
        if (!grosor || !Number.isFinite(grosor.valor)) {
          return 'Se dejaron 4 paredes: no hay un tramo medido de la pieza para calcular algo más preciso.';
        }
        return 'Se calcularon a partir del tramo más delgado que se midió, de ' + grosor.valor.toFixed(2) +
          ' mm: es lo que esa pared aguanta sin quedar hueca.';
      },
    },
    {
      clave: 'sparse_infill_density',
      familia: 'resistencia',
      valor: function () { return '35%'; },
      porque: function () {
        return 'Se dejó el relleno interno en 35%: buen equilibrio entre resistencia y gasto de filamento.';
      },
    },
    {
      clave: 'top_shell_layers',
      familia: 'resistencia',
      valor: function () { return 5; },
      porque: function () {
        return 'Se pusieron 5 capas sólidas arriba para que la pieza no quede porosa por el techo.';
      },
    },
    {
      clave: 'bottom_shell_layers',
      familia: 'resistencia',
      valor: function () { return 4; },
      porque: function () {
        return 'Se pusieron 4 capas sólidas abajo para que la base no quede porosa.';
      },
    },

    // ---- familia: rapidez ----
    // Solo las claves que ninguna otra meta posee — las disputadas (outer_wall_speed,
    // top_surface_speed, ironing_type, layer_height, wall_loops, sparse_infill_density)
    // viven en PARES_EN_CONFLICTO, no acá, porque ya tienen dueño en otra familia
    // (Pitfall 5: doble dueño de una clave = resultado que depende del orden de
    // iteración, sin ninguna tarjeta de conflicto que avise). Todas [ASSUMED] — no hay
    // piso empírico de Farid para velocidades "rápidas" todavía (D-13) — y todas con
    // FACTOR_VELOCIDAD_MATERIAL aplicado y redondeadas a entero.
    {
      clave: 'inner_wall_speed',
      familia: 'rapidez',
      valor: function (geometria, material) { return velocidadConFactor(200, material); }, // [ASSUMED]
      porque: function (geometria, material) {
        return 'Se subió la velocidad de las paredes internas a ' + velocidadConFactor(200, material) +
          ' mm/s: ahí no se nota tanto y se gana tiempo real de impresión.';
      },
    },
    {
      clave: 'internal_solid_infill_speed',
      familia: 'rapidez',
      valor: function (geometria, material) { return velocidadConFactor(250, material); }, // [ASSUMED]
      porque: function (geometria, material) {
        return 'Se subió la velocidad del relleno sólido interno a ' + velocidadConFactor(250, material) +
          ' mm/s: es la zona que menos afecta el resultado final visible.';
      },
    },
    {
      clave: 'initial_layer_speed',
      familia: 'rapidez',
      valor: function (geometria, material) { return velocidadConFactor(50, material); }, // [ASSUMED]
      porque: function (geometria, material) {
        return 'Se subió la velocidad de la primera capa a ' + velocidadConFactor(50, material) +
          ' mm/s para no perder tanto tiempo al empezar la impresión.';
      },
    },
    {
      clave: 'initial_layer_infill_speed',
      familia: 'rapidez',
      valor: function (geometria, material) { return velocidadConFactor(50, material); }, // [ASSUMED]
      porque: function (geometria, material) {
        return 'Se subió la velocidad del relleno de la primera capa a ' + velocidadConFactor(50, material) +
          ' mm/s, misma lógica que el resto de la primera capa.';
      },
    },
  ];

  // ---------- PARES_EN_CONFLICTO: exactamente 3, ni uno más ----------
  //
  // Respuesta a D-08: rapidez es la única meta que quiere mover en sentido contrario
  // claves que ya son de otra familia; resolución, terminación de pared y resistencia
  // no comparten ninguna clave entre sí. Cada `tabla` tiene 5 posiciones FIJAS (arrays
  // literales, no una `lerp()` evaluada en cada render — 04-UI-SPEC.md: "no hay
  // interpolación numérica continua"). `porqueEnPaso` sigue el patrón de copy exacto de
  // 04-UI-SPEC.md: "Con esto: {qué cambia, en criollo} pero {qué se sacrifica, en
  // criollo}." — sin nombrar ninguna clave interna.
  var PARES_EN_CONFLICTO = [
    {
      id: 'resolucion_vs_rapidez',
      izquierda: 'resolucion',
      derecha: 'rapidez',
      tabla: {
        layer_height: [0.10, 0.14, 0.18, 0.24, 0.30],
      },
      porqueEnPaso: function (paso) {
        var frases = [
          'Con esto: se ve el detalle más fino que puede dar la impresora, pero es la opción más lenta de imprimir.',
          'Con esto: sigue notándose el detalle chico, pero baja un poco la resolución para ganar algo de tiempo.',
          'Con esto: un punto intermedio entre detalle y velocidad, ni lo mejor de uno ni de otro.',
          'Con esto: se gana bastante velocidad, pero el detalle chico ya casi no se nota.',
          'Con esto: es lo más rápido posible, pero se pierde el detalle fino por completo.',
        ];
        return frases[paso];
      },
    },
    {
      id: 'terminacion_pared_vs_rapidez',
      izquierda: 'terminacion_pared',
      derecha: 'rapidez',
      tabla: {
        outer_wall_speed: [50, 90, 130, 180, 220],
        top_surface_speed: [60, 90, 120, 160, 200],
        ironing_type: ['top', 'top', 'top', 'no', 'no'],
      },
      porqueEnPaso: function (paso) {
        var frases = [
          'Con esto: la pared exterior y el techo quedan lo más prolijos posible, pero es la opción más lenta.',
          'Con esto: sigue el planchado activo y la pared se ve bien, pero ya se nota algo más de velocidad.',
          'Con esto: un balance entre terminación y velocidad, con el planchado todavía prendido.',
          'Con esto: se gana harta velocidad, pero se apaga el planchado y el techo ya no queda tan liso.',
          'Con esto: es lo más rápido posible, pero la terminación de pared y techo se resiente notoriamente.',
        ];
        return frases[paso];
      },
    },
    {
      id: 'resistencia_vs_rapidez',
      izquierda: 'resistencia',
      derecha: 'rapidez',
      tabla: {
        wall_loops: [4, 3, 3, 2, 2],
        sparse_infill_density: ['35%', '25%', '20%', '15%', '10%'],
      },
      porqueEnPaso: function (paso) {
        var frases = [
          'Con esto: la pieza queda lo más resistente posible, pero es la opción más lenta de imprimir.',
          'Con esto: sigue bastante resistente, pero baja un poco el relleno para ganar velocidad.',
          'Con esto: un punto intermedio entre resistencia y velocidad.',
          'Con esto: se gana bastante velocidad, pero la pieza queda notoriamente menos resistente.',
          'Con esto: es lo más rápido posible, pero la pieza queda con la mínima resistencia razonable.',
        ];
        return frases[paso];
      },
    },
  ];

  // ---------- RANGOS: rango físicamente razonable por clave, para el saneo de la Task 2 ----------
  var RANGOS = {
    layer_height: { tipo: 'numero', min: 0.04, max: 0.6 },
    initial_layer_print_height: { tipo: 'numero', min: 0.04, max: 0.6 },
    line_width: { tipo: 'numero', min: 0.1, max: 1.2 },
    top_surface_line_width: { tipo: 'numero', min: 0.1, max: 1.2 },
    outer_wall_speed: { tipo: 'numero', min: 1, max: 1000 },
    top_surface_speed: { tipo: 'numero', min: 1, max: 1000 },
    ironing_speed: { tipo: 'numero', min: 1, max: 1000 },
    inner_wall_speed: { tipo: 'numero', min: 1, max: 1000 },
    internal_solid_infill_speed: { tipo: 'numero', min: 1, max: 1000 },
    initial_layer_speed: { tipo: 'numero', min: 1, max: 1000 },
    initial_layer_infill_speed: { tipo: 'numero', min: 1, max: 1000 },
    wall_loops: { tipo: 'entero', min: 1, max: 10 },
    top_shell_layers: { tipo: 'entero', min: 0, max: 20 },
    bottom_shell_layers: { tipo: 'entero', min: 0, max: 20 },
    sparse_infill_density: { tipo: 'porcentaje', min: 0, max: 100 },
    ironing_flow: { tipo: 'porcentaje', min: 0, max: 100 },
    ironing_type: { tipo: 'opcion', opciones: ['no', 'top', 'topmost', 'all'] },
    wall_generator: { tipo: 'opcion', opciones: ['classic', 'arachne'] },
  };

  // ---------- helpers de tipo, compartidos por evaluar/sanearValor ----------

  function normalizarSet(valor) {
    if (valor instanceof Set) return valor;
    return new Set(valor || []);
  }

  // `instanceof Map` falla cuando el objeto viene de OTRO realm de JS (ej. la suite de
  // pruebas carga este módulo con `vm.createContext`: su `Map` global es un constructor
  // distinto al de este archivo aunque ambos se llamen "Map"). Se detecta por duck
  // typing (tiene `.get`/`.forEach`) y se reconstruye con `new Map(valor)`, que SÍ
  // funciona cruzando el límite de realm porque solo necesita que `valor` sea iterable
  // de pares `[clave, entrada]` — un Map de cualquier realm lo es.
  function normalizarMap(valor) {
    if (valor && typeof valor.get === 'function' && typeof valor.forEach === 'function') {
      return new Map(valor);
    }
    return new Map();
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function extraerNumero(entrada) {
    if (typeof entrada === 'number') return entrada;
    if (typeof entrada === 'string') return Number(entrada.trim().replace('%', ''));
    return NaN;
  }

  // ---------- evaluar: el evaluador genérico, sin una rama por combinación ----------
  //
  // (metasActivas, material, geometria, balances, correcciones) => null | resultado.
  // Defensivo como medir() de perfil-medidas.js: normaliza cada entrada antes de usarla.
  function evaluar(metasActivas, material, geometria, balances, correcciones) {
    material = material || 'PLA';
    geometria = geometria || {};
    balances = normalizarMap(balances);
    correcciones = normalizarMap(correcciones);
    var metas = normalizarSet(metasActivas);

    // Primera línea de lógica, antes de tocar nada más (Pitfall 6): cero metas marcadas
    // no es un perfil "por defecto", es ninguna decisión de Farid todavía.
    if (metas.size === 0) return null;

    var valores = {};
    var porques = {};

    for (var i = 0; i < REGLAS.length; i++) {
      var regla = REGLAS[i];
      if (metas.has(regla.familia)) {
        valores[regla.clave] = regla.valor(geometria, material, metas);
        porques[regla.clave] = regla.porque(geometria, material, metas);
      }
    }

    var conflictos = [];
    for (var j = 0; j < PARES_EN_CONFLICTO.length; j++) {
      var par = PARES_EN_CONFLICTO[j];
      if (!(metas.has(par.izquierda) && metas.has(par.derecha))) continue;

      var pasoCrudo = balances.has(par.id) ? Number(balances.get(par.id)) : 0;
      var paso = Number.isFinite(pasoCrudo) ? clamp(Math.round(pasoCrudo), 0, 4) : 0;

      var clavesTabla = Object.keys(par.tabla);
      for (var k = 0; k < clavesTabla.length; k++) {
        var claveTabla = clavesTabla[k];
        var valorTabla = par.tabla[claveTabla][paso];
        // La tabla PISA el valor base de la regla — es el punto donde se resuelve la
        // pelea entre metas, y por eso nunca queda en silencio (Pitfall 5). Solo las
        // claves de velocidad llevan el factor por material; layer_height (mm) y
        // wall_loops/sparse_infill_density (cantidad/relleno) no son velocidad.
        if (esClaveDeVelocidad(claveTabla) && typeof valorTabla === 'number') {
          valorTabla = velocidadConFactor(valorTabla, material);
        }
        valores[claveTabla] = valorTabla;
        porques[claveTabla] = par.porqueEnPaso(paso);
      }

      conflictos.push({
        id: par.id,
        izquierda: par.izquierda,
        derecha: par.derecha,
        paso: paso,
        claves: clavesTabla,
        porque: par.porqueEnPaso(paso),
      });
    }

    // Correcciones al final (D-11): una corrección manual pisa cualquier valor, venga de
    // una regla base o de una tabla de conflicto, y borra su "por qué" (D-10: pasa a ser
    // decisión de Farid, no de la regla). Esto resuelve la Open Question #1 de
    // 04-RESEARCH.md en el sentido que la propia investigación recomienda: el valor
    // escrito a mano manda sobre el control de balance para ESA clave, y el balance
    // sigue gobernando las demás claves del par (no se "apaga" el control entero).
    var editadas = [];
    var fueraDeRango = [];
    correcciones.forEach(function (entrada, clave) {
      var saneado = sanearValor(clave, entrada);
      valores[clave] = saneado.valor;
      porques[clave] = null;
      editadas.push(clave);
      if (saneado.fueraDeRango) fueraDeRango.push({ clave: clave, motivo: saneado.motivo });
    });

    // Avisos (D-09): qué otras claves visibles podrían necesitar revisión manual por la
    // edición hecha. Sin duplicados: si dos ediciones apuntan a la misma clave
    // relacionada, queda una sola entrada (la primera).
    var clavesVisibles = new Set(Object.keys(valores));
    var vistas = new Set();
    var avisos = [];
    for (var e = 0; e < editadas.length; e++) {
      var claveEditada = editadas[e];
      var relacionadas = relacionadosDe(claveEditada, clavesVisibles);
      for (var r = 0; r < relacionadas.length; r++) {
        var relacionada = relacionadas[r];
        if (vistas.has(relacionada)) continue;
        vistas.add(relacionada);
        avisos.push({ clave: relacionada, porCulpaDe: claveEditada });
      }
    }

    return {
      valores: valores,
      porques: porques,
      conflictos: conflictos,
      editadas: editadas,
      avisos: avisos,
      fueraDeRango: fueraDeRango,
    };
  }

  // ---------- relacionadosDe: lookup sobre la misma tabla REGLAS, sin grafo aparte ----------
  //
  // (claveEditada, clavesVisibles) => string[]. Devuelve las claves de REGLAS que (a) no
  // son ella misma, (b) están en clavesVisibles, y (c) o comparten familia con ella, o la
  // declaran en su `dependeDe`.
  function relacionadosDe(claveEditada, clavesVisibles) {
    var visibles = clavesVisibles instanceof Set ? clavesVisibles : new Set(clavesVisibles || []);

    var reglaEditada = null;
    for (var i = 0; i < REGLAS.length; i++) {
      if (REGLAS[i].clave === claveEditada) { reglaEditada = REGLAS[i]; break; }
    }
    if (!reglaEditada) return [];

    var resultado = [];
    for (var j = 0; j < REGLAS.length; j++) {
      var candidata = REGLAS[j];
      if (candidata.clave === claveEditada) continue;
      if (!visibles.has(candidata.clave)) continue;
      var mismaFamilia = candidata.familia === reglaEditada.familia;
      var declaraDependencia = Array.isArray(candidata.dependeDe) && candidata.dependeDe.indexOf(claveEditada) !== -1;
      if (mismaFamilia || declaraDependencia) resultado.push(candidata.clave);
    }
    return resultado;
  }

  // ---------- sanearValor: la guarda V5 que perfil-export.js no tiene ----------
  //
  // (clave, entrada) => { valor, fueraDeRango, motivo }. Nunca devuelve NaN, null,
  // undefined ni Infinity — perfil-export.js lanza excepción ante eso y un ajuste
  // perdido puede arruinar una impresión en la K2. Sanear NO es bloquear (D-11): toda
  // clave sigue siendo editable sin excepción, esto solo acomoda el valor al rango
  // físico y lo dice — ningún campo queda de solo lectura.
  function sanearValor(clave, entrada) {
    var rango = RANGOS[clave];
    // Clave no gobernada por este módulo: no se inventan restricciones sobre lo que no
    // se conoce, se deja pasar tal cual.
    if (!rango) return { valor: entrada, fueraDeRango: false, motivo: null };

    if (rango.tipo === 'opcion') {
      if (rango.opciones.indexOf(entrada) !== -1) {
        return { valor: entrada, fueraDeRango: false, motivo: null };
      }
      return {
        valor: rango.opciones[0],
        fueraDeRango: true,
        motivo: 'Esa opción no existe para este ajuste, lo dejé en "' + rango.opciones[0] + '".',
      };
    }

    if (rango.tipo === 'porcentaje') {
      var numPct = extraerNumero(entrada);
      if (!Number.isFinite(numPct)) {
        return { valor: rango.min + '%', fueraDeRango: true, motivo: 'Eso no es un número, lo dejé en ' + rango.min + '%.' };
      }
      var fueraPct = numPct < rango.min || numPct > rango.max;
      var clampeadoPct = Math.round(clamp(numPct, rango.min, rango.max));
      return {
        valor: clampeadoPct + '%',
        fueraDeRango: fueraPct,
        motivo: fueraPct ? 'Lo dejé en ' + clampeadoPct + '%: fuera de ese rango no tiene sentido para esta pieza.' : null,
      };
    }

    if (rango.tipo === 'entero') {
      var numEnt = Number(entrada);
      if (!Number.isFinite(numEnt)) {
        return { valor: rango.min, fueraDeRango: true, motivo: 'no es un número' };
      }
      var redondeado = Math.round(numEnt);
      var fueraEnt = redondeado < rango.min || redondeado > rango.max;
      return {
        valor: clamp(redondeado, rango.min, rango.max),
        fueraDeRango: fueraEnt,
        motivo: fueraEnt ? 'Lo dejé en ' + clamp(redondeado, rango.min, rango.max) + ': fuera de ese rango no tiene sentido físico.' : null,
      };
    }

    // tipo 'numero'
    var numFlot = Number(entrada);
    if (!Number.isFinite(numFlot)) {
      return { valor: rango.min, fueraDeRango: true, motivo: 'no es un número' };
    }
    var fueraFlot = numFlot < rango.min || numFlot > rango.max;
    return {
      valor: clamp(numFlot, rango.min, rango.max),
      fueraDeRango: fueraFlot,
      motivo: fueraFlot ? 'Lo dejé en ' + clamp(numFlot, rango.min, rango.max) + ': fuera de ese rango la K2 no lo hace bien.' : null,
    };
  }

  raiz.PerfilReglas = {
    FAMILIAS: FAMILIAS,
    REGLAS: REGLAS,
    PARES_EN_CONFLICTO: PARES_EN_CONFLICTO,
    RANGOS: RANGOS,
    evaluar: evaluar,
    relacionadosDe: relacionadosDe,
    sanearValor: sanearValor,
  };
})();
