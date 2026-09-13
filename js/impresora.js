/* Ayünka Studio — historial de la K2: empareja piezas del historial con productos del
 * catálogo, propone gramos/horas reales. Nunca aplica solo -- siempre hay un click de
 * por medio. Mismo diseño ya probado hoy contra datos reales. */
(function () {
  'use strict';
  function N(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : (d || 0); }

  function normalizarResumen(datos) {
    const piezas = (datos.piezas || []).map(p => ({ archivo: p.archivo, veces: N(p.veces), horasReales: N(p.horas_reales), gramosReales: N(p.gramos_reales) }));
    const r = datos.resumen || {};
    const tasa = N(r.tasa_fallo_material);
    return { piezas, resumen: { trabajos: N(r.trabajos), horasImpresas: N(r.horas_impresas), gramosImpresos: N(r.gramos_impresos), tasaFalloMaterial: tasa, tasaFalloReal: tasa } };
  }
  function normalizar(datos) {
    if (datos && Array.isArray(datos.piezas)) return normalizarResumen(datos);
    throw new Error('No reconozco este archivo -- ¿es el resumen del historial de la K2?');
  }

  function raiz(archivo) {
    let n = String(archivo || '');
    n = n.replace(/\.gcode$/i, '').replace(/_PLA_\d+h\d+m(\d+s)?$/i, '').replace(/\.(stl|3mf)$/i, '');
    return n.trim();
  }
  const DIF_GRAMOS = 0.5, DIF_HORAS = 1 / 60;

  function emparejar(piezas, productos) {
    return piezas.map(pieza => {
      const raizPieza = raiz(pieza.archivo);
      let prod = productos.find(p => p.archivoOrigen === pieza.archivo);
      let origen = prod ? 'por archivo' : null;
      if (!prod) { prod = productos.find(p => p.archivoOrigen && raiz(p.archivoOrigen) === raizPieza); if (prod) origen = 'por archivo'; }
      const gramosAntes = prod ? N(prod.gramos) : 0, horasAntes = prod ? N(prod.horas) : 0;
      const enBlanco = !gramosAntes && !horasAntes;
      const cambiaReal = !!prod && !enBlanco && (Math.abs(gramosAntes - pieza.gramosReales) > DIF_GRAMOS || Math.abs(horasAntes - pieza.horasReales) > DIF_HORAS);
      return { archivo: pieza.archivo, veces: pieza.veces, horasReales: pieza.horasReales, gramosReales: pieza.gramosReales,
        productoId: prod ? prod.id : null, origenDatos: origen, gramosAntes, horasAntes, enBlanco, cambiaReal };
    });
  }

  window.Impresora = { normalizar, emparejar, raiz, DIF_GRAMOS, DIF_HORAS };
})();
