/* Vista: Ventas y gastos. Congela el costo al vender -- si el producto cambia de costo
 * después, la venta histórica no se recalcula sola. */
(function () {
  let mesActual = new Date().toISOString().slice(0, 7);

  function delMes(lista) { return lista.filter(x => (x.fecha || '').slice(0, 7) === mesActual); }

  function pintar() {
    const ventas = delMes(Datos.activos('ventas'));
    const gastos = delMes(Datos.activos('gastos'));
    const totalVentas = ventas.reduce((s, v) => s + (v.total || 0), 0);
    const totalCosto = ventas.reduce((s, v) => s + (v.costoAlVender || 0), 0);
    const totalGastos = gastos.reduce((s, g) => s + (g.monto || 0), 0);
    const utilidad = totalVentas - totalCosto - totalGastos;

    A.$('#contenido').innerHTML = `
      <div class="cabecera"><h1>Ventas y gastos</h1>
        <div class="acciones">
          <input type="month" id="fz-mes" class="btn" value="${A.esc(mesActual)}">
          <button class="btn primario" onclick="Vistas.finanzas.nuevaVenta()">Nueva venta</button>
          <button class="btn" onclick="Vistas.finanzas.nuevoGasto()">Nuevo gasto</button>
        </div></div>
      <div class="rejilla" style="margin-bottom:16px">
        <div class="dato"><div class="k">Ventas del mes</div><div class="v">${A.plata(totalVentas)}</div></div>
        <div class="dato"><div class="k">Gastos del mes</div><div class="v">${A.plata(totalGastos)}</div></div>
        <div class="dato destaca"><div class="k">Utilidad</div><div class="v">${A.plata(utilidad)}</div></div>
      </div>
      <div class="tarjeta"><h2>Ventas</h2>
        <table><thead><tr><th>Fecha</th><th>Cliente</th><th class="num">Total</th></tr></thead><tbody>
        ${ventas.map(v => `<tr><td>${A.fecha(v.fecha)}</td><td>${A.esc((Datos.obtener('clientes', v.clienteId) || {}).nombre || '—')}</td><td class="num">${A.plata(v.total)}</td></tr>`).join('')}
        </tbody></table>${ventas.length ? '' : '<div class="vacio"><b>Sin ventas este mes</b></div>'}</div>
      <div class="tarjeta"><h2>Gastos</h2>
        <table><thead><tr><th>Fecha</th><th>Concepto</th><th class="num">Monto</th></tr></thead><tbody>
        ${gastos.map(g => `<tr><td>${A.fecha(g.fecha)}</td><td>${A.esc(g.concepto)}</td><td class="num">${A.plata(g.monto)}</td></tr>`).join('')}
        </tbody></table>${gastos.length ? '' : '<div class="vacio"><b>Sin gastos este mes</b></div>'}</div>`;
    A.$('#fz-mes').onchange = e => { mesActual = e.target.value; pintar(); };
  }

  function nuevaVenta() {
    const clientes = Datos.activos('clientes').map(c => ({ v: c.id, t: c.nombre }));
    const productos = Datos.activos('productos').map(p => ({ v: p.id, t: p.nombre }));
    A.preguntar({
      titulo: 'Nueva venta',
      cuerpo: `<div class="formulario">
        ${A.selector('vt-cli', 'Cliente', (clientes[0] || {}).v || '', clientes.length ? clientes : [{ v: '', t: '(no hay clientes)' }])}
        ${A.selector('vt-prod', 'Producto', (productos[0] || {}).v || '', productos.length ? productos : [{ v: '', t: '(no hay productos)' }])}
        ${A.campo('vt-total', 'Total cobrado', 0, { tipo: 'number', signo: '$' })}
        ${A.campo('vt-fecha', 'Fecha', new Date().toISOString().slice(0, 10), { tipo: 'date' })}
      </div>`,
      leer: n => {
        const v = i => (n.querySelector('#' + i) || {}).value || '';
        return { clienteId: v('vt-cli'), productoId: v('vt-prod'), total: A.num(v('vt-total')), fecha: v('vt-fecha') };
      },
      botones: [{ txt: 'Cancelar', valor: null, clase: 'sutil' }, { txt: 'Registrar', valor: 'ok', clase: 'primario' }]
    }).then(({ valor, datos }) => {
      if (!valor) return;
      const p = Datos.obtener('productos', datos.productoId);
      const c = p ? Costos.calcular(p) : null;
      Datos.agregar('ventas', {
        fecha: datos.fecha, clienteId: datos.clienteId, productoId: datos.productoId,
        total: datos.total, costoAlVender: (c && c.completo) ? c.costo : 0, activo: true
      });
      Datos.guardar('venta registrada');
      A.aviso('Venta registrada');
      pintar();
    });
  }

  function nuevoGasto() {
    A.preguntar({
      titulo: 'Nuevo gasto',
      cuerpo: `<div class="formulario">
        ${A.campo('gs-concepto', 'Concepto', '', { ancho: true })}
        ${A.campo('gs-monto', 'Monto', 0, { tipo: 'number', signo: '$' })}
        ${A.campo('gs-fecha', 'Fecha', new Date().toISOString().slice(0, 10), { tipo: 'date' })}
      </div>`,
      leer: n => {
        const v = i => (n.querySelector('#' + i) || {}).value || '';
        return { concepto: v('gs-concepto'), monto: A.num(v('gs-monto')), fecha: v('gs-fecha') };
      },
      botones: [{ txt: 'Cancelar', valor: null, clase: 'sutil' }, { txt: 'Registrar', valor: 'ok', clase: 'primario' }]
    }).then(({ valor, datos }) => {
      if (!valor) return;
      Datos.agregar('gastos', Object.assign({ categoria: '', activo: true }, datos));
      Datos.guardar('gasto registrado');
      A.aviso('Gasto registrado');
      pintar();
    });
  }

  window.Vistas = window.Vistas || {};
  Vistas.finanzas = { pintar, nuevaVenta, nuevoGasto };
})();
