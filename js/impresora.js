/* Ayünka Studio — historial de la K2, no monitor en vivo.
 *
 * La idea es de Farid: no hace falta que la impresora esté conectada todo el rato. Ella
 * misma guarda su historial; se va a buscar cuando se pueda y se recupera todo lo que
 * hizo mientras nadie miraba. Ahí están los gramos y las horas REALES de cada trabajo —
 * los dos números que la cotización pide a mano y que no se pueden deducir de la
 * geometría (SUPERVISION.md). La propia máquina es la fuente de verdad de su costo.
 *
 * Dos formatos de entrada, un mismo resultado:
 *  - El crudo de Moonraker (`GET /server/history/list`), si la impresora está al alcance.
 *  - El resumen ya hecho (`../historial-impresion.json`), si no.
 * Los dos se normalizan a lo mismo: {archivo, veces, horasReales, gramosReales} por pieza,
 * más un resumen con los mismos totales.
 *
 * Solo PROPONE. No escribe nada en el catálogo por su cuenta — eso lo hace la vista,
 * después de que una persona lo aprueba (SUPERVISION.md, punto 4).
 */
(function () {
  'use strict';

  // PLA de 1,75 mm: gramos por milímetro de filamento extruido. La misma constante que
  // ya usaba el flujo de n8n del repo anterior contra estos mismos datos.
  const G_POR_MM = 2.98 / 1000;

  const N = v => (typeof v === 'number' && isFinite(v)) ? v : 0;

  /* ---------- Moonraker crudo: GET /server/history/list ---------- */
  function normalizarMoonraker(datos) {
    const jobs = (datos && datos.result && datos.result.jobs) || (Array.isArray(datos) ? datos : []);
    const porArchivo = new Map();
    for (const j of jobs) {
      if (!j || !j.filename) continue;
      if (!porArchivo.has(j.filename)) porArchivo.set(j.filename, []);
      porArchivo.get(j.filename).push(j);
    }
    const piezas = [];
    let trabajos = 0, horasImpresas = 0, gramosImpresos = 0, horasPerdidas = 0, gramosPerdidos = 0, fallidos = 0;
    for (const [archivo, js] of porArchivo) {
      trabajos += js.length;
      const ok = js.filter(j => j.status === 'completed');
      const malos = js.filter(j => j.status !== 'completed');
      fallidos += malos.length;
      for (const j of malos) {
        horasPerdidas += N(j.print_duration) / 3600;
        gramosPerdidos += N(j.filament_used) * G_POR_MM;
      }
      if (ok.length) {
        const horas = ok.reduce((s, j) => s + N(j.print_duration), 0) / 3600 / ok.length;
        const gramos = ok.reduce((s, j) => s + N(j.filament_used) * G_POR_MM, 0) / ok.length;
        horasImpresas += horas * ok.length;
        gramosImpresos += gramos * ok.length;
        piezas.push({ archivo, veces: ok.length, horasReales: +horas.toFixed(3), gramosReales: Math.round(gramos * 10) / 10 });
      }
    }
    return {
      piezas,
      resumen: {
        trabajos, horasImpresas: +horasImpresas.toFixed(3), gramosImpresos: Math.round(gramosImpresos),
        horasPerdidas: +horasPerdidas.toFixed(3), gramosPerdidos: Math.round(gramosPerdidos),
        tasaFalloMaterial: trabajos ? +(fallidos / trabajos).toFixed(4) : 0
      }
    };
  }

  /* ---------- El resumen ya hecho (historial-impresion.json) ---------- */
  function normalizarResumen(datos) {
    const piezas = (datos.piezas || []).map(p => ({
      archivo: p.archivo, veces: N(p.veces), horasReales: N(p.horas_reales), gramosReales: N(p.gramos_reales)
    }));
    const r = datos.resumen || {};
    return {
      piezas,
      resumen: {
        trabajos: N(r.trabajos), horasImpresas: N(r.horas_impresas), gramosImpresos: N(r.gramos_impresos),
        horasPerdidas: N(r.horas_perdidas), gramosPerdidos: N(r.gramos_perdidos),
        tasaFalloMaterial: N(r.tasa_fallo_material)
      }
    };
  }

  /** Detecta el formato y normaliza. Lanza si no reconoce ninguno de los dos. */
  function normalizar(datos) {
    if (datos && Array.isArray(datos.piezas)) return normalizarResumen(datos);
    if (datos && ((datos.result && Array.isArray(datos.result.jobs)) || Array.isArray(datos))) return normalizarMoonraker(datos);
    throw new Error('No reconozco este archivo: ni es el historial de Moonraker ni el resumen ya hecho.');
  }

  /* ---------- raíz del nombre de archivo, para emparejar ---------- */
  function raiz(archivo) {
    let n = String(archivo || '');
    n = n.replace(/\.gcode$/i, '');
    n = n.replace(/_gcode_plate_\d+$/i, '');
    n = n.replace(/_PLA_\d+h\d+m(\d+s)?$/i, '');
    n = n.replace(/\.(stl|3mf|step|stp)$/i, '');
    return n.trim();
  }
  function slug(s) {
    return String(s || '').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, ' ').trim();
  }

  /**
   * Empareja cada pieza del historial con un producto del catálogo.
   * Prioridad: 1) archivoOrigen exacto, 2) archivoOrigen por raíz (mismo archivo, otro
   * corte/sufijo), 3) por parecido del nombre (solo si el producto no tiene archivoOrigen).
   * Nunca aplica nada — devuelve propuestas para que una persona decida.
   */
  // Umbral de "esto es un cambio de verdad" — por debajo es ruido de redondeo, no vale
  // avisar (SUPERVISION.md, cambio decidido por Farid el 2-sep).
  const DIF_GRAMOS = 0.5;
  const DIF_HORAS = 1 / 60; // 1 minuto

  function emparejar(piezas, productos) {
    return piezas.map(pieza => {
      const raizPieza = raiz(pieza.archivo);
      let prod = productos.find(p => p.archivoOrigen === pieza.archivo);
      let origen = prod ? 'por archivo' : null;

      if (!prod) {
        prod = productos.find(p => p.archivoOrigen && raiz(p.archivoOrigen) === raizPieza);
        if (prod) origen = 'por archivo';
      }

      if (!prod) {
        const sPieza = slug(raizPieza);
        if (sPieza) {
          prod = productos.find(p => !p.archivoOrigen && p.nombre && slug(p.nombre).includes(sPieza.split(' ')[0]) && sPieza.split(' ')[0].length >= 4);
          if (prod) origen = 'por parecido';
        }
      }

      const gramosAntes = prod ? N(prod.gramos) : 0;
      const horasAntes = prod ? N(prod.horas) : 0;
      const enBlanco = !gramosAntes && !horasAntes;
      const cambiaReal = !!prod && !enBlanco &&
        (Math.abs(gramosAntes - pieza.gramosReales) > DIF_GRAMOS || Math.abs(horasAntes - pieza.horasReales) > DIF_HORAS);

      return {
        archivo: pieza.archivo, veces: pieza.veces, horasReales: pieza.horasReales, gramosReales: pieza.gramosReales,
        productoId: prod ? prod.id : null, productoSku: prod ? prod.sku : null, productoNombre: prod ? prod.nombre : null,
        origenDatos: origen,
        gramosAntes, horasAntes, enBlanco, cambiaReal
      };
    });
  }

  window.Impresora = { normalizar, normalizarMoonraker, normalizarResumen, raiz, emparejar, G_POR_MM, DIF_GRAMOS, DIF_HORAS };
})();
