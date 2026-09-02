/* Ayünka Studio · el motor de costos.
 *
 * Esto es lo que ningún producto del mercado hace y por eso se construye: modela los DOS
 * oficios de Ayünka con estructuras de costo distintas y márgenes distintos, en la misma
 * ficha.
 *
 *   · 3D      → la máquina es el costo: filamento, luz, amortización de la K2, y el
 *               tiempo de preparación y post-proceso de la persona. Margen ×3,5.
 *   · Bordado → la persona es el costo: horas de trabajo a mano más materiales.
 *     Costura   Margen ×2,55 el bordado y ×2 la costura.
 *
 * Todo devuelve un desglose, no solo un número: si el precio sorprende, se tiene que poder
 * ver en qué línea está la plata.
 */
(function () {

  const N = (v, d = 0) => (typeof v === 'number' && isFinite(v)) ? v : d;

  function precioGramo(prod, params) {
    const fil = prod.filamentoId && Datos.obtener('filamentos', prod.filamentoId);
    if (fil && N(fil.gramosRollo) > 0) return N(fil.precioRollo) / N(fil.gramosRollo);
    const rollo = (prod.material === 'PETG') ? N(params.precioPETG, 20000) : N(params.precioPLA, 15000);
    return rollo / 1000;
  }

  /** Costo de amortizar la impresora, por hora de máquina. */
  function amortizacionHora(params) {
    const horasVida = N(params.amortAnos, 3) * N(params.diasAno, 300) * N(params.horasDia, 8);
    return horasVida > 0 ? N(params.costoImpresora, 0) / horasVida : 0;
  }

  function margen(prod, params) {
    const m = (params.margenes || {});
    return N(m[prod.oficio], N(m['3d'], 3.5));
  }

  /**
   * Calcula el costo de una unidad y el precio sugerido.
   * @returns {{lineas: Array<{concepto:string, monto:number, nota?:string}>,
   *            costo:number, margen:number, sugerido:number,
   *            precio:number|null, utilidad:number|null, margenReal:number|null}}
   */
  function calcular(prod, params) {
    params = params || DB.params || {};
    /* Cada concepto lleva SIEMPRE el mismo color, y ese color se repite en el punto de la
       lista, en la barra y en el porcentaje. Es lo que hace que el desglose se lea de un
       vistazo en vez de tener que ir leyendo etiqueta por etiqueta. */
    const COLOR = {
      'Filamento': 'material', 'Merma': 'material', 'Materiales': 'material',
      'Electricidad': 'luz',
      'Amortización de la K2': 'maquina',
      'Preparación': 'mano', 'Post-proceso': 'mano', 'Trabajo a mano': 'mano',
      'Empaque': 'otros', 'Extra': 'otros', 'Fallas': 'otros'
    };
    const lineas = [];
    const add = (concepto, monto, nota) => {
      if (monto) lineas.push({ concepto, monto, nota, color: COLOR[concepto] || 'otros' });
    };

    if (prod.oficio === '3d') {
      const gr = N(prod.gramos), hr = N(prod.horas);
      const pg = precioGramo(prod, params);
      const merma = N(params.merma, 0.08);

      add('Filamento', gr * pg, `${gr} g a $${Math.round(pg * 1000).toLocaleString('es-CL')}/kg`);
      add('Merma', gr * pg * merma, `${Math.round(merma * 100)}% de material perdido`);
      add('Electricidad', hr * N(params.consumoKw, 0.14) * N(params.kwh, 202),
          `${hr.toFixed(2)} h a ${N(params.consumoKw, 0.14)} kW`);
      add('Amortización de la K2', hr * amortizacionHora(params),
          `$${Math.round(amortizacionHora(params)).toLocaleString('es-CL')} por hora de máquina`);
      add('Preparación', (N(params.minPrep, 6) / 60) * N(params.manoObraHora, 4000),
          `${N(params.minPrep, 6)} min`);
      add('Post-proceso', (N(prod.postMin) / 60) * N(params.manoObraHora, 4000),
          prod.postMin ? `${prod.postMin} min` : '');
    } else {
      const h = N(prod.horasMano);
      add('Trabajo a mano', h * N(params.manoObraHora, 4000),
          `${h} h a $${N(params.manoObraHora, 4000).toLocaleString('es-CL')}/h`);
      add('Materiales', N(prod.costoMateriales), prod.notaMateriales || '');
    }

    add('Empaque', N(params.empaque, 350));
    add('Extra', N(prod.extraCosto), prod.extraNota || '');

    const subtotal = lineas.reduce((s, l) => s + l.monto, 0);
    const falla = subtotal * N(params.tasaFalla, 0.10);
    add('Fallas', falla, `${Math.round(N(params.tasaFalla, 0.10) * 100)}% histórico`);

    const costo = subtotal + falla;
    const mrg = margen(prod, params);
    const sugerido = Math.round(costo * mrg / 100) * 100;   // a la centena
    const precio = (typeof prod.precio === 'number') ? prod.precio : null;

    /* Un cálculo al que le falta el insumo principal no es un cálculo: es cero disfrazado
       de número. Antes de comparar nada, decimos qué falta. Un producto de bordado sin
       horas de trabajo daba "cuesta $385, cóbralo a $1.000" y marcaba el precio real de
       $25.000 como "2400% sobre el cálculo" — una alarma falsa que enseña a ignorar las
       alarmas. */
    const falta = queFalta(prod);

    return {
      lineas, costo, margen: mrg, precio,
      completo: !falta,
      falta,
      sugerido: falta ? null : sugerido,
      utilidad: (precio === null || falta) ? null : precio - costo,
      margenReal: (precio === null || !costo || falta) ? null : precio / costo,
      alerta: alertaPrecio(precio, falta ? null : sugerido, falta)
    };
  }

  /** Qué le falta a una ficha para que su costo signifique algo. */
  function queFalta(prod) {
    if (prod.oficio === '3d') {
      if (!N(prod.gramos) && !N(prod.horas)) return 'faltan los gramos y las horas';
      if (!N(prod.gramos)) return 'faltan los gramos';
      if (!N(prod.horas)) return 'faltan las horas de máquina';
      return null;
    }
    if (!N(prod.horasMano) && !N(prod.costoMateriales)) return 'faltan las horas de trabajo';
    if (!N(prod.horasMano)) return 'faltan las horas de trabajo';
    return null;
  }

  /** Semáforo honesto: no dice "sube el precio", dice qué tan lejos está del cálculo.
   *  Y si el cálculo está incompleto, lo dice en vez de inventar una comparación. */
  function alertaPrecio(precio, sugerido, falta) {
    if (falta) return { nivel: 'falta', texto: falta };
    if (precio === null) return { nivel: 'falta', texto: 'sin precio' };
    if (!sugerido) return null;
    const r = precio / sugerido;
    if (r < 0.8) return { nivel: 'bajo', texto: `${Math.round((1 - r) * 100)}% bajo el cálculo` };
    if (r > 1.25) return { nivel: 'alto', texto: `${Math.round((r - 1) * 100)}% sobre el cálculo` };
    return { nivel: 'ok', texto: 'en línea con el cálculo' };
  }

  /** Cuánto cuesta y cuánto vale un pedido entero. */
  function calcularPedido(pedido) {
    let costo = 0, total = 0, faltanPrecios = 0;
    (pedido.lineas || []).forEach(l => {
      const p = l.productoId ? Datos.obtener('productos', l.productoId) : null;
      const c = p ? calcular(p).costo : 0;
      costo += c * N(l.cantidad, 0);
      if (typeof l.precioUnit === 'number') total += l.precioUnit * N(l.cantidad, 0);
      else faltanPrecios++;
    });
    const abonado = N(pedido.abono);
    return {
      costo, total: faltanPrecios ? null : total, faltanPrecios,
      utilidad: faltanPrecios ? null : total - costo,
      abonado, saldo: faltanPrecios ? null : total - abonado
    };
  }

  /** Horas de máquina que faltan por producir en un pedido. */
  function horasPedido(pedido) {
    return (pedido.lineas || []).reduce((s, l) => {
      const p = l.productoId ? Datos.obtener('productos', l.productoId) : null;
      return s + (p ? N(p.horas) * N(l.cantidad) : 0);
    }, 0);
  }

  window.Costos = { calcular, calcularPedido, horasPedido, amortizacionHora, precioGramo, margen, queFalta };
})();
