/* Ayünka Studio — serializador del perfil de proceso importable de Creality Print.

   El dialecto exacto está escrito en `.planning/referencia/FORMATO.md` — este
   módulo lo reproduce, no lo adivina. La regla que más falla si se olvida: TODOS
   los valores van como string en el JSON, incluidos los números y los booleanos
   (`"0.12"`, no `0.12`; `"1"`, no `true`). Si se manda un número o un booleano
   nativo, Creality Print no lo reconoce como el mismo ajuste — se comprobó
   abriendo el `process/llaveros.json` real de Farid byte a byte.

   Lógica pura, sin DOM: se puede probar fuera del navegador (ver
   `ayunka-studio/pruebas/perfil-export.prueba.cjs`).                             */
(function () {
  'use strict';

  // Solo-sistema: si vienen en los valores de entrada, se descartan igual.
  const CLAVES_PROHIBIDAS = ['type', 'compatible_printers', 'setting_id', 'is_custom_defined'];

  // Las arma siempre este módulo — no se toman tal cual del llamador aunque
  // vengan en `valores`, porque un perfil con `from` o `version` equivocados
  // se ve bien pero Creality Print lo trata como perfil de sistema.
  const CLAVES_IDENTIDAD = ['base_id', 'from', 'inherits', 'name', 'print_settings_id', 'version'];

  const BASE_ID_POR_DEFECTO = 'GP004';
  const VERSION_POR_DEFECTO = '26.7.1.21';

  // Expande un número en notación exponencial (`1e-7`) a su forma decimal
  // plana (`0.0000001`). Trabaja sobre el texto de `toExponential()` — que ya
  // trae la representación decimal correctamente redondeada — en vez de
  // `toFixed()`, que expone el ruido binario de coma flotante (0.0000000999…).
  function expandirExponencial(n) {
    if (Number.isInteger(n)) return BigInt(n).toString();
    const negativo = n < 0;
    const [mantisa, expTexto] = Math.abs(n).toExponential().split('e');
    const exponente = parseInt(expTexto, 10);
    const [entero, decimales = ''] = mantisa.split('.');
    const digitos = entero + decimales;

    let resultado;
    if (exponente < 0) {
      resultado = '0.' + '0'.repeat(-exponente - 1) + digitos;
    } else if (exponente + 1 >= digitos.length) {
      resultado = digitos + '0'.repeat(exponente + 1 - digitos.length);
    } else {
      resultado = digitos.slice(0, exponente + 1) + '.' + digitos.slice(exponente + 1);
    }
    if (resultado.indexOf('.') !== -1) resultado = resultado.replace(/0+$/, '').replace(/\.$/, '');
    return (negativo ? '-' : '') + resultado;
  }

  function numeroATexto(n) {
    const texto = String(n);
    return /[eE]/.test(texto) ? expandirExponencial(n) : texto;
  }

  function valorATexto(valor, clave) {
    if (valor === null || valor === undefined) {
      throw new Error('El valor de "' + clave + '" es null o undefined: un ajuste perdido puede arruinar una impresion en la K2');
    }
    if (typeof valor === 'number' && !Number.isFinite(valor)) {
      throw new Error('El valor de "' + clave + '" es ' + valor + ': no es un numero valido para un ajuste de la K2');
    }
    if (typeof valor === 'boolean') return valor ? '1' : '0';
    if (typeof valor === 'string') return valor;
    if (typeof valor === 'number') return numeroATexto(valor);
    throw new Error('Tipo de valor no soportado para "' + clave + '": ' + typeof valor);
  }

  /* Convierte el objeto de ajustes ya corregidos por Farid en el texto JSON del
     dialecto de Creality Print. `opciones.nombre` e `inherits` son obligatorios:
     sin ellos el perfil no tiene identidad ni sabe de qué preset de sistema
     parte. `baseId` y `version` traen el valor real de Farid como default. */
  function serializarProceso(valores, opciones) {
    opciones = opciones || {};
    const nombre = opciones.nombre;
    const inherits = opciones.inherits;
    if (!nombre) {
      throw new Error('serializarProceso necesita "nombre" en las opciones: sin el, el perfil no tiene identidad');
    }
    if (!inherits) {
      throw new Error('serializarProceso necesita "inherits" en las opciones: sin el, Creality Print no sabe de que preset de sistema parte');
    }

    const identidad = {
      base_id: opciones.baseId || BASE_ID_POR_DEFECTO,
      from: 'User',
      inherits: inherits,
      name: nombre,
      print_settings_id: nombre,
      version: opciones.version || VERSION_POR_DEFECTO,
    };

    // La identidad pisa lo que venga en `valores` — así un perfil no puede
    // salir con `from: "system"` solo porque el llamador lo trajo por error.
    const combinado = Object.assign({}, valores || {}, identidad);
    for (const prohibida of CLAVES_PROHIBIDAS) delete combinado[prohibida];

    const salida = {};
    for (const clave of Object.keys(combinado).sort()) {
      salida[clave] = valorATexto(combinado[clave], clave);
    }

    // Esta combinación exacta — sangría 4, saltos CRLF, CRLF final — es la que
    // reproduce byte a byte el `process/llaveros.json` real.
    return JSON.stringify(salida, null, 4).replace(/\n/g, '\r\n') + '\r\n';
  }

  // Acepta el contenido del printer/*.json tal como llega — string o
  // Uint8Array/Buffer — sin re-serializarlo nunca. `ArrayBuffer.isView`
  // en vez de `instanceof Uint8Array`: un Buffer creado fuera de este
  // realm (por ejemplo en las pruebas, vía `vm`) no pasa el `instanceof`
  // aunque sea un Uint8Array de verdad.
  function bytesDe(contenido, campo) {
    if (typeof contenido === 'string') return new TextEncoder().encode(contenido);
    if (ArrayBuffer.isView(contenido)) return contenido;
    throw new Error('El contenido de "' + campo + '" debe ser string o Uint8Array, no ' + typeof contenido);
  }

  // AAAAMMDDHHMMSS en hora local, para el bundle_id.
  function fechaATexto(fecha) {
    const pad = n => String(n).padStart(2, '0');
    return '' + fecha.getFullYear() + pad(fecha.getMonth() + 1) + pad(fecha.getDate()) +
      pad(fecha.getHours()) + pad(fecha.getMinutes()) + pad(fecha.getSeconds());
  }

  // `nombre`/`impresora.nombre` se usan para armar rutas dentro del ZIP
  // (`printer/<nombre>.json`, `process/<nombre>.json`). Un nombre con "/",
  // "\" o ".." produce una entrada que escapa del prefijo `printer/`/`process/`
  // (Zip Slip) — se corta aca, antes de que se arme ninguna ruta. No valida
  // valores faltantes/no-string: eso ya lo hacen los checks de campo requerido
  // que corren antes de llamar a esto.
  function validarNombreDeArchivo(valor, campo) {
    if (typeof valor === 'string' && /[\/\\]|\.\./.test(valor)) {
      throw new Error('"' + campo + '" no puede contener "/", "\\" ni "..": ' + JSON.stringify(valor));
    }
  }

  /* Arma el `.creality_printer` completo: el perfil de proceso que corrigió
     Farid, el perfil de impresora que ya trae (sin tocarlo — ver FORMATO.md
     sección 6) y el `bundle_structure.json` que los indexa. Reusa el
     escritor de ZIP de `d3d-3mf.js`, no se escribe otro.

     `opciones.impresora` es obligatorio: un bundle sin `printer/` no está
     confirmado contra ningún archivo real, así que no se inventa esa
     variante. */
  function construirBundle(opciones) {
    opciones = opciones || {};
    if (typeof window === 'undefined' || !window.D3D3MF || typeof window.D3D3MF.zip !== 'function') {
      throw new Error('construirBundle necesita window.D3D3MF: hay que cargar js/d3d-3mf.js antes que js/perfil-export.js');
    }
    const impresora = opciones.impresora;
    if (!impresora) {
      throw new Error('construirBundle necesita "impresora" en las opciones: sin ella el bundle no tiene printer/*.json');
    }
    if (!impresora.nombre) {
      throw new Error('construirBundle necesita "impresora.nombre" en las opciones: es el nombre del preset de impresora');
    }
    if (!impresora.contenido) {
      throw new Error('construirBundle necesita "impresora.contenido" en las opciones: es el contenido del printer/*.json');
    }
    validarNombreDeArchivo(impresora.nombre, 'impresora.nombre');

    const nombre = opciones.nombre;
    validarNombreDeArchivo(nombre, 'nombre');
    const textoProceso = serializarProceso(opciones.valores, {
      nombre: nombre,
      inherits: opciones.inherits,
      baseId: opciones.baseId,
      version: opciones.version,
    });

    const fecha = opciones.fecha || new Date();
    const estructura = {
      bundle_id: impresora.nombre + '_' + fechaATexto(fecha),
      bundle_type: 'printer config bundle',
      filament_config: [],
      printer_config: ['printer/' + impresora.nombre + '.json'],
      printer_preset_name: impresora.nombre,
      process_config: ['process/' + nombre + '.json'],
      version: '',
    };

    const enc = new TextEncoder();
    return window.D3D3MF.zip([
      { nombre: 'printer/' + impresora.nombre + '.json', datos: bytesDe(impresora.contenido, 'impresora.contenido') },
      { nombre: 'process/' + nombre + '.json', datos: enc.encode(textoProceso) },
      { nombre: 'bundle_structure.json', datos: enc.encode(JSON.stringify(estructura)) },
    ]);
  }

  // valorATexto se exporta para que js/perfil-descarga.js (Fase 6) pueda textificar los
  // valores propuestos ANTES de compararlos contra process/llaveros.json: 0.12 (número, del
  // motor de reglas) y "0.12" (string, del perfil real) son distintos en JavaScript, y sin
  // pasar por esta misma función la pantalla de Farid mostraría un cambio que no existe.
  window.PerfilExport = {
    serializarProceso: serializarProceso,
    construirBundle: construirBundle,
    valorATexto: valorATexto,
    CLAVES_PROHIBIDAS: CLAVES_PROHIBIDAS,
    CLAVES_IDENTIDAD: CLAVES_IDENTIDAD,
  };
})();
