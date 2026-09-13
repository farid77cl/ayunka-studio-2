/* Ayünka Studio — perfil-descarga: arma todo lo que necesita el botón "Descargar" de la
   pestaña Perfiles (Fase 6) — el nombre del archivo que va a ver Farid (D-01/D-02), qué
   cambió respecto de su perfil real de llaveros (D-03) y el `.creality_printer` completo,
   listo para importar en Creality Print.

   Lógica pura: **ni una sola referencia a `document`, a `Blob` ni a `URL`** — el disparo de
   la descarga (crear el anchor, hacer click, revocar el object URL) vive en `js/perfil.js`
   (plan 06-03). Así esta suite se prueba entera fuera del navegador.

   El perfil contra el que se compara es `process/llaveros.json`: es el único perfil de
   proceso real que existe en el repo y el que ya usa `perfil-export.prueba.cjs` como prueba
   de oro. El preset de sistema "0.20mm Standard" no existe como archivo en ninguna parte —
   inventar sus valores sería la misma adivinanza bien redactada que ya le costó cara a este
   proyecto una vez (sesión 29). Cambiar la base después es una línea: `diferencias()` acepta
   cualquier perfil como segundo argumento.

   Contrato ejecutable: ayunka-studio/pruebas/perfil-descarga.prueba.cjs.               */
(function () {
  'use strict';

  // El nombre EXACTO de un preset de sistema de Creality Print — FORMATO.md §4. El
  // proyecto apunta a un solo dialecto (la K2 0.4mm de Farid) a propósito, no a una lista
  // de impresoras.
  var INHERITS_K2 = '0.20mm Standard @Creality K2 0.4 nozzle';

  var EXTENSION = '.creality_printer';

  // Los 20 ajustes reales del perfil "llaveros" de Farid, extraídos de
  // process/llaveros.json dentro de .planning/referencia/Creality K2 0.4 nozzle.creality_printer
  // (generados con un script que lee el bundle real, nunca transcritos a mano — mismo
  // método que ayunka-studio/js/perfil-impresora-k2.js). En orden alfabético, todos como
  // string porque así los guarda Creality Print. Las 4 claves de resistencia
  // (wall_loops, sparse_infill_density, top_shell_layers, bottom_shell_layers) NO están
  // acá porque Farid nunca las tocó en su perfil real — no se inventa un "antes" para
  // ellas (Pitfall 4 de 06-RESEARCH.md).
  var AJUSTES_LLAVEROS = {
    enable_arc_fitting: '0',
    initial_layer_infill_speed: '35',
    initial_layer_line_width: '0.4',
    initial_layer_print_height: '0.08',
    initial_layer_speed: '35',
    inner_wall_line_width: '0.4',
    inner_wall_speed: '120',
    internal_solid_infill_speed: '150',
    ironing_flow: '33%',
    ironing_speed: '100',
    ironing_type: 'top',
    layer_height: '0.12',
    line_width: '0.32',
    outer_wall_speed: '50',
    prime_tower_rib_wall: '0',
    seam_position: 'back',
    seam_slope_type: 'external',
    top_surface_line_width: '0.32',
    top_surface_speed: '60',
    wall_generator: 'arachne'
  };

  // Las 4 metas del motor de reglas (js/perfil.js, array METAS), en el mismo orden. El
  // orden de ESTE objeto es el que manda en el nombre del archivo — no el orden en que
  // Farid tocó los chips en pantalla. Mismo insumo, mismo nombre, siempre.
  var SEGMENTOS_META = {
    resolucion: 'resolucion',
    terminacion_pared: 'terminacion',
    resistencia: 'resistencia',
    rapidez: 'rapidez'
  };

  // Copiado LITERAL de js/d3d-3mf.js línea 210 — a propósito, no un normalizador propio.
  // Dos slugs distintos en el mismo proyecto es una fuente de bugs de "por qué este
  // nombre sí y el otro no". Los acentos se conservan en minúscula: es la decisión que ya
  // tomó el código existente, no un descuido a arreglar acá.
  function slug(texto) {
    return String(texto || '')
      .toLowerCase().replace(/[^a-z0-9áéíóúñ]+/gi, '-').replace(/(^-|-$)/g, '');
  }

  // Arma el nombre del archivo que Farid va a ver: el nombre del 3MF que soltó (D-02, sin
  // pedirle nada nuevo), slugificado, más las metas que activó, en el orden fijo de
  // SEGMENTOS_META. Sin metas activas no queda guion colgante. Un nombre que se
  // slugifica a vacío (por ejemplo "   .3mf") cae en "perfil": un nombre de archivo no
  // puede empezar con un punto.
  function nombreDeArchivo(nombre3mf, metasActivas) {
    var sinExtension = String(nombre3mf || '').replace(/\.3mf$/i, '');
    var base = slug(sinExtension) || 'perfil';

    var segmentos = Object.keys(SEGMENTOS_META).filter(function (clave) {
      return !!metasActivas && metasActivas.has(clave);
    }).map(function (clave) {
      return SEGMENTOS_META[clave];
    });

    return [base].concat(segmentos).join('-') + EXTENSION;
  }

  // El mismo nombre sin EXTENSION: es el `name`, el `print_settings_id` que Farid ve en el
  // desplegable de Creality Print, y la ruta process/<esto>.json dentro del bundle.
  function nombreDePerfil(nombreArchivo) {
    var nombre = String(nombreArchivo || '');
    return nombre.slice(-EXTENSION.length) === EXTENSION
      ? nombre.slice(0, -EXTENSION.length)
      : nombre;
  }

  // Compara los valores propuestos por el motor de reglas contra `perfilBase` (por
  // defecto AJUSTES_LLAVEROS, el perfil real de Farid). Textifica SIEMPRE antes de
  // comparar con la misma función que produce el JSON descargado (Pitfall 3 de
  // 06-RESEARCH.md): sin esto, 0.12 (número) y "0.12" (string) se ven distintos en
  // JavaScript y la pantalla de Farid mostraría un cambio que no existe.
  // Para las claves que llaveros.json no tiene, `antes` queda en null — nunca se rellena
  // con un valor por defecto de Creality inventado (Pitfall 4).
  function diferencias(valoresPropuestos, perfilBase) {
    if (typeof window === 'undefined' || !window.PerfilExport || typeof window.PerfilExport.valorATexto !== 'function') {
      throw new Error('diferencias necesita window.PerfilExport: hay que cargar js/perfil-export.js antes que js/perfil-descarga.js');
    }
    var base = perfilBase || AJUSTES_LLAVEROS;
    var resultado = [];

    Object.keys(valoresPropuestos || {}).forEach(function (clave) {
      var despues = window.PerfilExport.valorATexto(valoresPropuestos[clave], clave);
      var esNuevo = !(clave in base);
      var antes = esNuevo ? null : base[clave];

      if (esNuevo || antes !== despues) {
        resultado.push({ clave: clave, antes: antes, despues: despues, esNuevo: esNuevo });
      }
    });

    return resultado;
  }

  // Arma el .creality_printer completo delegando en window.PerfilExport.construirBundle:
  // no reimplementa nada del dialecto ni del ZIP, ese módulo ya valida los nombres contra
  // Zip Slip y ya serializa las 26 claves. No pasa `fecha`: el default de construirBundle
  // (new Date()) es lo correcto para un bundle recién generado.
  function armarBundle(valores, nombreArchivo) {
    if (typeof window === 'undefined' || !window.PerfilImpresoraK2 || typeof window.PerfilImpresoraK2.bytes !== 'function') {
      throw new Error('armarBundle necesita window.PerfilImpresoraK2: hay que cargar js/perfil-impresora-k2.js antes que js/perfil-descarga.js');
    }
    if (typeof window === 'undefined' || !window.PerfilExport || typeof window.PerfilExport.construirBundle !== 'function') {
      throw new Error('armarBundle necesita window.PerfilExport: hay que cargar js/perfil-export.js antes que js/perfil-descarga.js');
    }

    return window.PerfilExport.construirBundle({
      valores: valores,
      nombre: nombreDePerfil(nombreArchivo),
      inherits: INHERITS_K2,
      impresora: {
        nombre: window.PerfilImpresoraK2.NOMBRE,
        contenido: window.PerfilImpresoraK2.bytes()
      }
    });
  }

  window.PerfilDescarga = {
    INHERITS_K2: INHERITS_K2,
    EXTENSION: EXTENSION,
    AJUSTES_LLAVEROS: AJUSTES_LLAVEROS,
    SEGMENTOS_META: SEGMENTOS_META,
    slug: slug,
    nombreDeArchivo: nombreDeArchivo,
    nombreDePerfil: nombreDePerfil,
    diferencias: diferencias,
    armarBundle: armarBundle
  };
})();
