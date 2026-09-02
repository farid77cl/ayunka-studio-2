/* Vista: Ventas y gastos. El agujero de fondo que señaló SUPERVISION.md (Encargo del
 * 2-sep, punto A): la app sabía cuánto cuesta producir y cuánto habría que cobrar, pero no
 * sabía cuánto se ganó. Responde «¿cómo me fue este mes?».
 *
 * Regla que no se relaja: el costo de una venta se congela al momento de venderla
 * (costoAlVender, por línea: costoUnitAlVender). No se recalcula después — si sube el
 * filamento, lo que se ganó en agosto no cambia.
 */
(function () {
  const N = (v, d = 0) => (typeof v === 'number' && isFinite(v)) ? v : d;

  const METODOS = [
    { v: 'efectivo', t: 'Efectivo' }, { v: 'transferencia', t: 'Transferencia' },
    { v: 'debito', t: 'Débito' }, { v: 'credito', t: 'Crédito' }, { v: 'otro', t: 'Otro' }
  ];
  const CAT_GASTO = [
    { v: 'material', t: 'Material' }, { v: 'insumos', t: 'Insumos' }, { v: 'envio', t: 'Envío' },
    { v: 'marketing', t: 'Marketing' }, { v: 'herramientas', t: 'Herramientas' }, { v: 'otros', t: 'Otros' }
  ];
  const nombreMetodo = v => (METODOS.find(m => m.v === v) || {}).t || v || '—';
  const nombreCat = v => (CAT_GASTO.find(c => c.v === v) || {}).t || v || '—';

  let mesActual = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
  const enMes = (fecha, mes) => (fecha || '').slice(0, 7) === mes;

  function resumenMes(mes) {
    const ventas = Datos.activos('ventas').filter(v => enMes(v.fecha, mes))
      .sort((a, b) => (a.fecha || '') < (b.fecha || '') ? 1 : -1);
    const gastos = Datos.activos('gastos').filter(g => enMes(g.fecha, mes))
      .sort((a, b) => (a.fecha || '') < (b.fecha || '') ? 1 : -1);
    const vendido = ventas.reduce((s, v) => s + N(v.total), 0);
    const costo = ventas.reduce((s, v) => s + N(v.costoAlVender), 0);
    const gastado = gastos.reduce((s, g) => s + N(g.monto), 0);
    return { ventas, gastos, vendido, costo, utilidadBruta: vendido - costo, gastado, neto: vendido - costo - gastado };
  }

  function pintar() {
    const r = resumenMes(mesActual);
    const [anio, mesN] = mesActual.split('-').map(Number);
    const nombreMes = new Date(anio, mesN - 1, 1).toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });

    let h = `<div class="cabecera"><h1>Ventas y gastos</h1>
      <span class="sub">${A.esc(nombreMes)}</span>
      <div class="acciones">
        <input type="month" id="fz-mes" class="btn" value="${A.esc(mesActual)}">
        <button class="btn" onclick="Vistas.finanzas.nuevoGasto()">Nuevo gasto</button>
        <button class="btn primario" onclick="Vistas.finanzas.nuevo()">Nueva venta</button>
      </div></div>
      <div class="rejilla" style="margin-bottom:16px">
        <div class="dato"><div class="k">Vendido</div><div class="v">${A.plata(r.vendido)}</div>
          <div class="n">${r.ventas.length} venta${r.ventas.length === 1 ? '' : 's'}</div></div>
        <div class="dato"><div class="k">Costo real de lo vendido</div>
          <div class="v" style="color:var(--apagado)">${A.plata(r.costo)}</div></div>
        <div class="dato"><div class="k">Gastos</div><div class="v" style="color:var(--terra)">${A.plata(r.gastado)}</div>
          <div class="n">${r.gastos.length} gasto${r.gastos.length === 1 ? '' : 's'}</div></div>
        <div class="dato"><div class="k">Lo que quedó</div>
          <div class="v" style="color:${r.neto >= 0 ? 'var(--ok)' : 'var(--coral)'}">${A.plata(r.neto)}</div>
          <div class="n">vendido − costo real − gastos</div></div>
      </div>`;

    h += `<div class="tarjeta"><h2>Ventas · ${r.ventas.length}</h2>`;
    h += r.ventas.length ? `<table><thead><tr><th>Cliente</th><th>Fecha</th><th>Cómo pagó</th>
        <th class="num">Cobrado</th><th class="num">Costo real</th><th class="num">Ganancia</th>
      </tr></thead><tbody>
        ${r.ventas.map(v => {
          const cli = (Datos.obtener('clientes', v.clienteId) || {}).nombre || '—';
          const ganancia = N(v.total) - N(v.costoAlVender);
          return `<tr onclick="Vistas.finanzas.abrir('${A.esc(v.id)}')" style="cursor:pointer">
            <td><b>${A.esc(cli)}</b>${v.pedidoId ? '<div style="font-size:12px;color:var(--apagado)">de un pedido</div>' : ''}</td>
            <td>${A.fecha(v.fecha)}</td>
            <td>${A.esc(nombreMetodo(v.metodoPago))}</td>
            <td class="num">${A.plata(v.total)}</td>
            <td class="num" style="color:var(--apagado)">${A.plata(v.costoAlVender)}</td>
            <td class="num" style="color:${ganancia >= 0 ? 'var(--ok)' : 'var(--coral)'}"><b>${A.plata(ganancia)}</b></td>
          </tr>`;
        }).join('')}
      </tbody></table>` : `<div class="vacio"><b>Sin ventas este mes</b>Cuando registres una, acá se ve cuánto ganaste de verdad, con el costo real de producirla.</div>`;
    h += `</div>`;

    h += `<div class="tarjeta"><h2>Gastos · ${r.gastos.length}</h2>`;
    h += r.gastos.length ? `<table><thead><tr><th>Categoría</th><th>Fecha</th><th>Nota</th><th class="num">Monto</th></tr></thead><tbody>
        ${r.gastos.map(g => `<tr onclick="Vistas.finanzas.abrirGasto('${A.esc(g.id)}')" style="cursor:pointer">
          <td><span class="etiqueta">${A.esc(nombreCat(g.categoria))}</span></td>
          <td>${A.fecha(g.fecha)}</td>
          <td style="color:var(--apagado);font-size:13px">${A.esc(g.nota || '')}</td>
          <td class="num">${A.plata(g.monto)}</td>
        </tr>`).join('')}
      </tbody></table>` : `<div class="vacio"><b>Sin gastos este mes</b></div>`;
    h += `</div>`;

    A.$('#contenido').innerHTML = h;
    const mesEl = A.$('#fz-mes');
    if (mesEl) mesEl.onchange = e => { mesActual = e.target.value || mesActual; pintar(); };
  }

  /* ---------- venta: líneas editables + costo congelado por línea ---------- */

  let lineasEditando = null;
  let pedidoSeleccionado = null;

  function opcionesProducto() {
    return [{ v: '', t: '(sin producto — línea libre)' }].concat(
      Datos.activos('productos').map(p => ({ v: p.id, t: (p.sku ? p.sku + ' · ' : '') + p.nombre })));
  }

  function htmlLineasVenta() {
    const opciones = opcionesProducto();
    const filas = lineasEditando.map((l, i) => {
      const monto = (typeof l.precioUnit === 'number') ? l.precioUnit * (l.cantidad || 0) : null;
      return `<div class="linea-editable">
        <select onchange="Vistas.finanzas._lineaProducto(${i}, this.value)">
          ${opciones.map(o => `<option value="${A.esc(o.v)}"${o.v === (l.productoId || '') ? ' selected' : ''}>${A.esc(o.t)}</option>`).join('')}
        </select>
        <input type="text" placeholder="Descripción" value="${A.esc(l.descripcion || '')}"
          onchange="Vistas.finanzas._lineaCampo(${i}, 'descripcion', this.value)">
        <input type="number" min="1" value="${l.cantidad || 1}"
          onchange="Vistas.finanzas._lineaCampo(${i}, 'cantidad', this.value)">
        <input type="number" placeholder="precio" value="${l.precioUnit == null ? '' : l.precioUnit}"
          onchange="Vistas.finanzas._lineaCampo(${i}, 'precioUnit', this.value)">
        <div class="m">${monto === null ? '—' : A.plata(monto)}</div>
        <button type="button" class="quitar" title="Quitar línea" onclick="Vistas.finanzas._lineaQuitar(${i})">✕</button>
      </div>`;
    }).join('');
    return (filas || '<div class="vacio-chico">Sin líneas todavía</div>') +
      `<button type="button" class="btn sutil chico agregar-linea" onclick="Vistas.finanzas._lineaAgregar()">+ Agregar línea</button>`;
  }

  function totalesEnEdicion() {
    let total = 0, costo = 0;
    lineasEditando.forEach(l => { total += N(l.precioUnit) * N(l.cantidad, 0); costo += N(l.costoUnitAlVender) * N(l.cantidad, 0); });
    return { total, costo, utilidad: total - costo };
  }

  function htmlTotalesVenta() {
    const c = totalesEnEdicion();
    return `<div class="desglose">
      <div class="fila total"><div class="c"><b>Total cobrado</b></div><div class="m">${A.plata(c.total)}</div></div>
      <div class="fila"><div class="c">Costo real de producirlo</div><div class="m" style="color:var(--apagado)">${A.plata(c.costo)}</div></div>
      <div class="fila"><div class="c">Ganancia</div><div class="m" style="color:${c.utilidad >= 0 ? 'var(--ok)' : 'var(--coral)'}">${A.plata(c.utilidad)}</div></div>
    </div>`;
  }

  function pintarLineasVenta() {
    const cont = document.getElementById('vt-lineas');
    if (cont) cont.innerHTML = htmlLineasVenta();
    const tot = document.getElementById('vt-totales');
    if (tot) tot.innerHTML = htmlTotalesVenta();
  }

  function _lineaProducto(i, productoId) {
    const l = lineasEditando[i]; if (!l) return;
    l.productoId = productoId || null;
    if (productoId) {
      const p = Datos.obtener('productos', productoId);
      if (p) {
        l.descripcion = p.nombre;
        const c = Costos.calcular(p);
        l.precioUnit = (typeof p.precio === 'number') ? p.precio : c.sugerido;
        // El costo se congela AHORA, al elegir el producto para esta venta -- no se
        // vuelve a tocar aunque después cambien los parámetros de costo.
        l.costoUnitAlVender = c.costo;
      }
    } else {
      l.costoUnitAlVender = 0;
    }
    pintarLineasVenta();
  }
  function _lineaCampo(i, campo, valor) {
    const l = lineasEditando[i]; if (!l) return;
    if (campo === 'cantidad') l.cantidad = Math.max(1, A.num(valor) || 1);
    else if (campo === 'precioUnit') l.precioUnit = valor === '' ? null : A.num(valor);
    else l[campo] = valor;
    pintarLineasVenta();
  }
  function _lineaAgregar() {
    lineasEditando.push({ productoId: null, descripcion: '', cantidad: 1, precioUnit: null, costoUnitAlVender: 0 });
    pintarLineasVenta();
  }
  function _lineaQuitar(i) { lineasEditando.splice(i, 1); pintarLineasVenta(); }

  function _desdePedido(pedidoId) {
    const p = pedidoId ? Datos.obtener('pedidos', pedidoId) : null;
    pedidoSeleccionado = p ? p.id : null;
    lineasEditando = !p ? [] : (p.lineas || []).map(l => {
      const prod = l.productoId ? Datos.obtener('productos', l.productoId) : null;
      // El costo se calcula con el motor de costos ACTUAL, al momento de registrar la
      // venta -- no el costo que tenía el producto cuando se armó el pedido.
      const costoUnit = prod ? Costos.calcular(prod).costo : 0;
      return { productoId: l.productoId, descripcion: l.descripcion, cantidad: l.cantidad,
               precioUnit: l.precioUnit, costoUnitAlVender: costoUnit };
    });
    const cliSel = document.getElementById('vt-cli');
    if (cliSel && p) cliSel.value = p.clienteId || '';
    const wrap = document.getElementById('vt-entregado-wrap');
    if (wrap) wrap.style.display = p ? 'flex' : 'none';
    pintarLineasVenta();
  }

  function abrir(id) {
    const v = Datos.obtener('ventas', id);
    if (!v) return;
    lineasEditando = JSON.parse(JSON.stringify(v.lineas || []));
    pedidoSeleccionado = v.pedidoId || null;
    const clientes = Datos.activos('clientes').map(c => ({ v: c.id, t: c.nombre }));
    const pedidosAbiertos = Datos.activos('pedidos').filter(p => p.estado !== 'entregado');
    const puedeVincular = !v.pedidoId && !lineasEditando.length;

    A.preguntar({
      titulo: 'Venta',
      cuerpo: `
        ${puedeVincular ? `<label class="campo ancho"><span>Cargar desde un pedido abierto <i>opcional</i></span>
          <select id="vt-pedido" onchange="Vistas.finanzas._desdePedido(this.value)">
            <option value="">(línea libre)</option>
            ${pedidosAbiertos.map(p => `<option value="${A.esc(p.id)}">${A.esc((Datos.obtener('clientes', p.clienteId) || {}).nombre || '—')} · entrega ${A.esc(A.fecha(p.entrega))}</option>`).join('')}
          </select></label>` : ''}
        <div class="formulario">
          ${A.selector('vt-cli', 'Cliente', v.clienteId, clientes.length ? clientes : [{ v: '', t: '(no hay clientes)' }])}
          ${A.campo('vt-fecha', 'Fecha', v.fecha, { tipo: 'date' })}
          ${A.selector('vt-metodo', 'Cómo se pagó', v.metodoPago || 'efectivo', METODOS)}
        </div>
        <h3 style="font-size:13px;text-transform:uppercase;letter-spacing:.5px;color:var(--pizarra);margin:14px 0 8px">Qué se vendió</h3>
        <div id="vt-lineas" class="lineas-pedido">${htmlLineasVenta()}</div>
        <div id="vt-totales">${htmlTotalesVenta()}</div>
        <label id="vt-entregado-wrap" style="display:${v.pedidoId ? 'flex' : 'none'};align-items:center;gap:8px;font-size:13.5px;margin:14px 0 0">
          <input type="checkbox" id="vt-entregado" checked> Marcar ese pedido como entregado
        </label>
        <label class="campo" style="margin-top:10px"><span>Notas</span>
          <textarea id="vt-notas" rows="2">${A.esc(v.notas || '')}</textarea></label>`,
      leer: n => {
        const val = i => { const e = n.querySelector('#' + i); return e ? e.value : ''; };
        const lineas = lineasEditando.filter(l => l.productoId || (l.descripcion || '').trim());
        const c = totalesEnEdicion();
        const entregadoEl = n.querySelector('#vt-entregado');
        return {
          clienteId: val('vt-cli'), fecha: val('vt-fecha'), metodoPago: val('vt-metodo'),
          pedidoId: pedidoSeleccionado, lineas, total: c.total, costoAlVender: c.costo,
          notas: val('vt-notas'), marcarEntregado: entregadoEl ? entregadoEl.checked : false
        };
      },
      botones: [{ txt: 'Cancelar', valor: null, clase: 'sutil' }, { txt: 'Guardar', valor: 'ok', clase: 'primario' }]
    }).then(({ valor, datos }) => {
      lineasEditando = null; pedidoSeleccionado = null;
      if (!valor) return;
      const { marcarEntregado, ...resto } = datos;
      // Revisión del 3-sep de Cowork: guardar sin líneas dejaba una venta fantasma de $0
      // en la lista, sin avisar. Una venta sin líneas no es una venta.
      if (!resto.lineas.length) {
        A.aviso('Una venta necesita al menos una línea — no se guardó', 'error');
        // Si es una venta recién creada (nunca tuvo líneas), no dejar el borrador vacío
        // dando vueltas en la lista.
        if (!v.lineas || !v.lineas.length) { Datos.quitar('ventas', v.id); Datos.guardar('venta vacía descartada'); }
        pintar();
        return;
      }
      // Revisión del 3-sep de Cowork, punto 6: vender no descontaba nada. Se descuenta
      // SOLO la primera vez que esta venta pasa de "sin líneas" a tener líneas de verdad
      // -- si se reabre una venta YA guardada para corregir algo (la nota, el método de
      // pago), no se vuelve a descontar. Editar la CANTIDAD de una línea de una venta ya
      // guardada no ajusta el stock de nuevo por ahora; queda dicho en la bitácora.
      const esVentaNueva = !v.lineas || !v.lineas.length;
      Object.assign(v, resto);
      if (esVentaNueva) {
        resto.lineas.forEach(l => {
          if (!l.productoId) return;
          const prod = Datos.obtener('productos', l.productoId);
          if (!prod) return;
          // Revisión del 3-sep, punto 1: stock 0 es lo normal acá (casi todo es contra
          // pedido) -- descontar sin que el producto lleve stock de verdad solo deja un
          // "-3" sin sentido. Se pide explícito en la ficha (llevaStock), la excepción.
          if (prod.llevaStock) Movimientos.registrar('productos', 'stock', l.productoId, -N(l.cantidad), 'venta');
          // El filamento sí se consume siempre, lleve stock o no -- una impresión hecha al
          // vuelo gasta el mismo material real. Punto 2: si el producto no tiene rollo
          // elegido a mano, cae al de su material (Movimientos.filamentoDe).
          if (prod.oficio === '3d') {
            const filId = Movimientos.filamentoDe(prod);
            if (filId) Movimientos.registrar('filamentos', 'gramosQuedan', filId,
              -N(prod.gramos) * N(l.cantidad), 'venta de ' + (prod.sku || prod.nombre));
          }
        });
      }
      Datos.guardar('venta');
      if (marcarEntregado && resto.pedidoId) {
        const pedido = Datos.obtener('pedidos', resto.pedidoId);
        if (pedido) { pedido.estado = 'entregado'; Datos.guardar('pedido entregado desde venta'); }
      }
      A.aviso('Venta guardada');
      pintar();
    });
  }

  function nuevo() {
    const hoy = new Date().toISOString().slice(0, 10);
    const v = Datos.agregar('ventas', {
      fecha: hoy, clienteId: (Datos.activos('clientes')[0] || {}).id || '', pedidoId: null,
      metodoPago: 'efectivo', lineas: [], total: 0, costoAlVender: 0, notas: '', activo: true
    });
    Datos.guardar('nueva venta'); pintar(); abrir(v.id);
  }

  /* ---------- gasto ---------- */

  function abrirGasto(id) {
    const g = Datos.obtener('gastos', id);
    if (!g) return;
    A.preguntar({
      titulo: 'Gasto',
      cuerpo: `<div class="formulario">
        ${A.campo('gs-fecha', 'Fecha', g.fecha, { tipo: 'date' })}
        ${A.selector('gs-cat', 'Categoría', g.categoria, CAT_GASTO)}
        ${A.campo('gs-monto', 'Monto', g.monto || 0, { tipo: 'number', signo: '$' })}
        ${A.campo('gs-nota', 'Nota', g.nota || '', { ancho: true })}
      </div>`,
      leer: n => {
        const v = i => { const e = n.querySelector('#' + i); return e ? e.value : ''; };
        return { fecha: v('gs-fecha'), categoria: v('gs-cat'), monto: A.num(v('gs-monto')), nota: v('gs-nota') };
      },
      botones: [{ txt: 'Cancelar', valor: null, clase: 'sutil' }, { txt: 'Guardar', valor: 'ok', clase: 'primario' }]
    }).then(({ valor, datos }) => {
      if (!valor) return;
      Object.assign(g, datos);
      Datos.guardar('gasto');
      A.aviso('Gasto guardado');
      pintar();
    });
  }

  function nuevoGasto() {
    const hoy = new Date().toISOString().slice(0, 10);
    const g = Datos.agregar('gastos', { fecha: hoy, categoria: 'material', monto: 0, nota: '', activo: true });
    Datos.guardar('nuevo gasto'); pintar(); abrirGasto(g.id);
  }

  window.Vistas = window.Vistas || {};
  Vistas.finanzas = { pintar, abrir, nuevo, abrirGasto, nuevoGasto,
    _lineaProducto, _lineaCampo, _lineaAgregar, _lineaQuitar, _desdePedido };
})();
