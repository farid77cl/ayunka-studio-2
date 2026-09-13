/* Ayünka Studio — el motor de costos de los dos oficios.
 *
 * 3D: filamento + merma + electricidad + amortización de la máquina + mano de obra de
 * preparación + costo extra. Bordado/costura: horas de trabajo a mano + materiales +
 * costo extra. Un producto incompleto (sin gramos/horas) devuelve costo null -- nunca
 * un número inventado. "Un cálculo incompleto dice que no sabe."
 */
(function () {
  const N = v => (typeof v === 'number' && isFinite(v)) ? v : null;

  function precioFilamentoKg(producto) {
    if (producto.filamentoId) {
      const f = Datos.obtener('filamentos', producto.filamentoId);
      if (f) return f.precioKg || 0;
    }
    const generico = Datos.activos('filamentos').filter(f => (f.material || 'PLA') === (producto.material || 'PLA'));
    if (generico.length === 1) return generico[0].precioKg || 0;
    return (DB.params.precioFilamentoGenerico || {})[producto.material || 'PLA'] || 15000;
  }

  function queFalta(producto) {
    const falta = [];
    if (producto.oficio === '3d') {
      if (N(producto.gramos) === null) falta.push('gramos');
      if (N(producto.horas) === null) falta.push('horas de máquina');
    } else {
      if (N(producto.horasTrabajo) === null) falta.push('horas de trabajo a mano');
    }
    return falta;
  }

  function calcular(producto) {
    const params = DB.params || {};
    const faltan = queFalta(producto);
    if (faltan.length) {
      return { costo: null, sugerido: null, precio: producto.precio ?? null, completo: false, faltan, lineas: [], alerta: null };
    }

    const lineas = [];
    if (producto.oficio === '3d') {
      const gramos = N(producto.gramos), horas = N(producto.horas);
      const precioKg = precioFilamentoKg(producto);
      const material = gramos * (precioKg / 1000);
      lineas.push({ concepto: 'Filamento', monto: material, nota: `${gramos} g a $${precioKg.toLocaleString('es-CL')}/kg`, color: 'material' });
      const merma = material * (N(params.mermaPct) ?? 0.08);
      lineas.push({ concepto: 'Merma', monto: merma, nota: Math.round((N(params.mermaPct) ?? 0.08) * 100) + '% de material perdido', color: 'material' });
      const luz = horas * 0.14 * (N(params.kwh) ?? 202);
      lineas.push({ concepto: 'Electricidad', monto: luz, nota: `${horas.toFixed(2)} h a 0.14 kW`, color: 'luz' });
      const amort = horas * ((N(params.precioMaquina) ?? 900000) / ((N(params.amortizacionAnios) ?? 3) * 365 * 24));
      lineas.push({ concepto: 'Amortización de la K2', monto: amort, nota: '$' + Math.round(amort / horas) + ' por hora de máquina', color: 'maquina' });
      const prep = (N(producto.postMin) ?? 0) / 60 * (N(params.manoObraHora) ?? 4000);
      if (prep) lineas.push({ concepto: 'Preparación', monto: prep, nota: (producto.postMin) + ' min', color: 'mano' });
      if (N(producto.extraCosto)) lineas.push({ concepto: producto.extraNota || 'Extra', monto: N(producto.extraCosto), color: 'otros' });
      const fallas = (material + merma + luz + amort + prep) * (N(params.tasaFalla) ?? 0.129);
      lineas.push({ concepto: 'Fallas', monto: fallas, nota: Math.round((N(params.tasaFalla) ?? 0.129) * 100) + '% histórico', color: 'otros' });
    } else {
      const horas = N(producto.horasTrabajo);
      const mano = horas * (N(params.manoObraHora) ?? 4000);
      lineas.push({ concepto: 'Mano de obra', monto: mano, nota: horas.toFixed(2) + ' h', color: 'mano' });
      if (N(producto.extraCosto)) lineas.push({ concepto: producto.extraNota || 'Materiales', monto: N(producto.extraCosto), color: 'material' });
    }

    const costo = lineas.reduce((s, l) => s + l.monto, 0);
    const m = margen(producto, params);
    const sugerido = Math.round(costo * m / 100) * 100;
    const precio = typeof producto.precio === 'number' ? producto.precio : null;
    let alerta = null;
    if (precio !== null && precio < costo) alerta = { nivel: 'bajo', texto: 'bajo costo' };
    return { costo, sugerido, precio, completo: true, faltan: [], lineas, margen: m, alerta };
  }

  function margen(producto, params) {
    const m = (params && params.margenes) || {};
    const defaults = { '3d': 3.5, bordado: 2.55, costura: 2 };
    return m[producto.oficio] || defaults[producto.oficio] || 2;
  }

  function calcularPedido(pedido) {
    let costo = 0, total = 0, faltanPrecios = 0;
    (pedido.lineas || []).forEach(l => {
      const p = l.productoId ? Datos.obtener('productos', l.productoId) : null;
      const c = p ? calcular(p) : null;
      if (c && c.completo) costo += c.costo * (l.cantidad || 0);
      if (typeof l.precioUnit === 'number') total += l.precioUnit * (l.cantidad || 0);
      else faltanPrecios++;
    });
    const abonado = N(pedido.abono) || 0;
    const envio = N(pedido.costoEnvio) || 0;
    if (faltanPrecios) return { costo, total: null, faltanPrecios, utilidad: null, abonado, saldo: null };
    total += envio;
    return { costo, total, faltanPrecios, utilidad: total - costo, abonado, saldo: total - abonado };
  }

  function horasPedido(pedido) {
    return (pedido.lineas || []).reduce((s, l) => {
      const p = l.productoId ? Datos.obtener('productos', l.productoId) : null;
      if (!p || p.oficio !== '3d' || N(p.horas) === null) return s;
      return s + p.horas * (l.cantidad || 0);
    }, 0);
  }

  window.Costos = { calcular, calcularPedido, horasPedido, margen, queFalta, precioFilamentoKg };
})();
