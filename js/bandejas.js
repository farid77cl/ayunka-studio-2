/* Ayünka Studio — empaquetado de bandejas mixtas. Nadie en el mercado arma bandejas
 * mezclando pedidos de clientes distintos (investigado el 1-sep-2026): esto es una
 * primera versión, con un empaquetado por filas (shelf packing), no un slicer -- alcanza
 * para decidir qué entra junto, pero la placa real se sigue armando en el slicer antes
 * de imprimir. Solo empaqueta piezas cuyo producto tiene ancho/largo cargado. */
(function () {
  'use strict';
  const BED = { x: 260, y: 260 };
  const MARGEN = 6;
  // Zona de la torre de purga de la K2, medida en la skill llavero-nfc-desde-3mf del repo negocio.
  const EXCLUSION = { x0: 18, y0: 220, x1: 78, y1: 260 };

  function seSolapa(a, b) { return !(a.x1 <= b.x0 || a.x0 >= b.x1 || a.y1 <= b.y0 || a.y0 >= b.y1); }

  function empacar(piezas, opts) {
    opts = opts || {};
    const bed = opts.bed || BED, margen = opts.margen != null ? opts.margen : MARGEN, exclusion = opts.exclusion || EXCLUSION;
    const anchoUtil = bed.x - margen, altoUtil = bed.y - margen;
    const ordenadas = piezas.slice().sort((a, b) => b.largoMm - a.largoMm);
    let x = margen, y = margen, altoFila = 0;
    const ubicadas = [], sinEspacio = [];
    ordenadas.forEach(p => {
      if (p.anchoMm > anchoUtil - margen || p.largoMm > altoUtil - margen) { sinEspacio.push(p); return; }
      if (x + p.anchoMm > anchoUtil) { x = margen; y += altoFila + margen; altoFila = 0; }
      let caja = { x0: x, y0: y, x1: x + p.anchoMm, y1: y + p.largoMm };
      if (seSolapa(caja, exclusion)) {
        y = exclusion.y1 + margen; altoFila = 0;
        caja = { x0: x, y0: y, x1: x + p.anchoMm, y1: y + p.largoMm };
      }
      if (caja.y1 > altoUtil || seSolapa(caja, exclusion)) { sinEspacio.push(p); return; }
      ubicadas.push(Object.assign({}, p, caja));
      x += p.anchoMm + margen;
      altoFila = Math.max(altoFila, p.largoMm);
    });
    return { ubicadas, sinEspacio };
  }

  function itemsDePedidos(pedidoIds) {
    const piezas = [], sinMedida = [];
    pedidoIds.forEach(pedidoId => {
      const pedido = Datos.obtener('pedidos', pedidoId);
      if (!pedido) return;
      const cliente = (Datos.obtener('clientes', pedido.clienteId) || {}).nombre || '—';
      (pedido.lineas || []).forEach(linea => {
        if (!linea.productoId) return;
        const prod = Datos.obtener('productos', linea.productoId);
        if (!prod || prod.oficio !== '3d') return;
        const cantidad = Math.max(1, linea.cantidad || 1);
        if (prod.anchoMm > 0 && prod.largoMm > 0) {
          for (let i = 0; i < cantidad; i++) {
            piezas.push({ pedidoId, cliente, productoId: prod.id, nombre: prod.nombre, anchoMm: prod.anchoMm, largoMm: prod.largoMm });
          }
        } else {
          sinMedida.push({ pedidoId, cliente, productoId: prod.id, nombre: prod.nombre, cantidad });
        }
      });
    });
    return { piezas, sinMedida };
  }

  window.Bandejas = { BED, MARGEN, EXCLUSION, empacar, itemsDePedidos };
})();
