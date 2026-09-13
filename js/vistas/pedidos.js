/* Vista: pedidos. Abono, saldo y horas de máquina comprometidas, atados al catálogo. */
(function () {
  const ESTADOS = [
    { v: 'cotizado', t: 'Cotizado' }, { v: 'confirmado', t: 'Confirmado' },
    { v: 'en-produccion', t: 'En producción' }, { v: 'listo', t: 'Listo' }, { v: 'entregado', t: 'Entregado' }
  ];
  const nombreEstado = v => (ESTADOS.find(e => e.v === v) || {}).t || v;
  const cliente = id => (Datos.obtener('clientes', id) || {}).nombre || '—';

  function pintar() {
    const ps = Datos.activos('pedidos').slice().sort((a, b) => (a.entrega || '') < (b.entrega || '') ? -1 : 1);
    let h = `<div class="cabecera"><h1>Pedidos</h1><span class="sub">${ps.length}</span>
      <div class="acciones"><button class="btn primario" onclick="Vistas.pedidos.nuevo()">Nuevo pedido</button></div></div>
      <div class="tarjeta"><table><thead><tr><th>Cliente</th><th>Entrega</th><th>Estado</th>
        <th class="num">Total</th><th class="num">Abono</th><th class="num">Saldo</th><th></th></tr></thead><tbody>`;
    ps.forEach(p => {
      const c = Costos.calcularPedido(p);
      h += `<tr onclick="Vistas.pedidos.abrir('${A.esc(p.id)}')" style="cursor:pointer">
        <td><b>${A.esc(cliente(p.clienteId))}</b></td>
        <td>${A.fecha(p.entrega)}</td>
        <td><span class="etiqueta">${A.esc(nombreEstado(p.estado))}</span></td>
        <td class="num">${c.total == null ? '<span class="chip falta">faltan precios</span>' : A.plata(c.total)}</td>
        <td class="num">${A.plata(c.abonado)}</td>
        <td class="num"><b>${c.saldo == null ? '—' : A.plata(c.saldo)}</b></td>
        <td><button class="btn chico" onclick="event.stopPropagation(); Vistas.pedidos.registrarPago('${A.esc(p.id)}')">+ Pago</button></td>
      </tr>`;
    });
    h += `</tbody></table>${ps.length ? '' : '<div class="vacio"><b>Sin pedidos todavía</b></div>'}</div>`;
    A.$('#contenido').innerHTML = h;
  }

  let lineasEditando = null;
  function opcionesProducto() {
    return [{ v: '', t: '(sin producto — línea libre)' }].concat(
      Datos.activos('productos').map(x => ({ v: x.id, t: (x.sku ? x.sku + ' · ' : '') + x.nombre })));
  }
  function htmlLineas() {
    const opciones = opcionesProducto();
    const filas = lineasEditando.map((l, i) => {
      const monto = (typeof l.precioUnit === 'number') ? l.precioUnit * (l.cantidad || 0) : null;
      return `<div class="linea-editable" style="display:grid;grid-template-columns:1.6fr 1.1fr 60px 96px 92px 28px;gap:8px;align-items:center;padding:7px 0;border-bottom:1px solid var(--borde)">
        <select onchange="Vistas.pedidos._lineaProducto(${i}, this.value)">
          ${opciones.map(o => `<option value="${A.esc(o.v)}"${o.v === (l.productoId || '') ? ' selected' : ''}>${A.esc(o.t)}</option>`).join('')}
        </select>
        <input type="text" placeholder="Descripción" value="${A.esc(l.descripcion || '')}" onchange="Vistas.pedidos._lineaCampo(${i}, 'descripcion', this.value)">
        <input type="number" min="1" value="${l.cantidad || 1}" onchange="Vistas.pedidos._lineaCampo(${i}, 'cantidad', this.value)">
        <input type="number" placeholder="precio" value="${l.precioUnit == null ? '' : l.precioUnit}" onchange="Vistas.pedidos._lineaCampo(${i}, 'precioUnit', this.value)">
        <div class="m" style="text-align:right;font-weight:700">${monto === null ? '—' : A.plata(monto)}</div>
        <button type="button" style="border:none;background:none;color:var(--apagado);cursor:pointer" onclick="Vistas.pedidos._lineaQuitar(${i})">✕</button>
      </div>`;
    }).join('');
    return (filas || '<div style="color:var(--apagado);font-size:13px;padding:10px 0">Sin líneas todavía</div>') +
      `<button type="button" class="btn sutil chico" style="margin-top:8px" onclick="Vistas.pedidos._lineaAgregar()">+ Agregar línea</button>`;
  }
  function calcularEnEdicion() {
    const abono = A.num((document.getElementById('pd-abono') || {}).value);
    const c = Costos.calcularPedido({ lineas: lineasEditando, abono });
    const envio = A.num((document.getElementById('pd-envio') || {}).value);
    if (c.total !== null && envio) { c.total += envio; c.saldo += envio; }
    return c;
  }
  function htmlTotales() {
    const c = calcularEnEdicion();
    const envio = A.num((document.getElementById('pd-envio') || {}).value);
    return `<div class="desglose">
      <div class="fila total"><div class="c"><b>Total</b></div><div class="m">${c.total == null ? 'faltan precios' : A.plata(c.total)}</div></div>
      ${envio ? `<div class="fila"><div class="c">Envío</div><div class="m">${A.plata(envio)}</div></div>` : ''}
      <div class="fila"><div class="c">Costo</div><div class="m" style="color:var(--apagado)">${A.plata(c.costo)}</div></div>
      <div class="fila"><div class="c">Saldo por cobrar</div><div class="m">${c.saldo == null ? '—' : A.plata(c.saldo)}</div></div>
    </div>`;
  }
  function pintarLineas() { const c = document.getElementById('pd-lineas'); if (c) c.innerHTML = htmlLineas(); pintarTotales(); }
  function pintarTotales() { const c = document.getElementById('pd-totales'); if (c) c.innerHTML = htmlTotales(); }
  function _lineaProducto(i, productoId) {
    const l = lineasEditando[i]; if (!l) return;
    l.productoId = productoId || null;
    if (productoId) {
      const p = Datos.obtener('productos', productoId);
      if (p) { l.descripcion = p.nombre; const c = Costos.calcular(p); l.precioUnit = typeof p.precio === 'number' ? p.precio : c.sugerido; }
    }
    pintarLineas();
  }
  function _lineaCampo(i, campo, valor) {
    const l = lineasEditando[i]; if (!l) return;
    if (campo === 'cantidad') l.cantidad = Math.max(1, A.num(valor) || 1);
    else if (campo === 'precioUnit') l.precioUnit = valor === '' ? null : A.num(valor);
    else l[campo] = valor;
    pintarLineas();
  }
  function _lineaAgregar() { lineasEditando.push({ productoId: null, descripcion: '', cantidad: 1, precioUnit: null }); pintarLineas(); }
  function _lineaQuitar(i) { lineasEditando.splice(i, 1); pintarLineas(); }

  function abrir(id) {
    const p = Datos.obtener('pedidos', id);
    if (!p) return;
    lineasEditando = JSON.parse(JSON.stringify(p.lineas || []));
    const clientes = Datos.activos('clientes').map(x => ({ v: x.id, t: x.nombre }));
    A.preguntar({
      titulo: 'Pedido · ' + cliente(p.clienteId),
      cuerpo: `<div class="formulario">
          ${A.selector('pd-cli', 'Cliente', p.clienteId, clientes.length ? clientes : [{ v: '', t: '(no hay clientes)' }])}
          ${A.selector('pd-est', 'Estado', p.estado, ESTADOS)}
          ${A.campo('pd-fecha', 'Fecha del pedido', p.fecha, { tipo: 'date' })}
          ${A.campo('pd-entrega', 'Entrega comprometida', p.entrega, { tipo: 'date' })}
          ${A.campo('pd-abono', 'Abono recibido', p.abono || 0, { tipo: 'number', signo: '$' })}
          ${A.campo('pd-direccion', 'Dirección de entrega', p.direccion || '', { ancho: true })}
          ${A.campo('pd-peso', 'Peso del paquete', p.pesoKg || '', { tipo: 'number', paso: '0.1', unidad: 'kg' })}
          ${A.campo('pd-envio', 'Costo de envío', p.costoEnvio || 0, { tipo: 'number', signo: '$' })}
        </div>
        <h3 style="font-size:13px;text-transform:uppercase;letter-spacing:.5px;color:var(--pizarra);margin:14px 0 8px">Qué lleva</h3>
        <div id="pd-lineas">${htmlLineas()}</div>
        <div id="pd-totales" style="margin-top:10px">${htmlTotales()}</div>
        <label class="campo" style="margin-top:14px"><span>Notas</span><textarea id="pd-notas" rows="3">${A.esc(p.notas || '')}</textarea></label>`,
      alAbrir: n => {
        const abonoEl = n.querySelector('#pd-abono'); if (abonoEl) abonoEl.oninput = pintarTotales;
        const envioEl = n.querySelector('#pd-envio'); if (envioEl) envioEl.oninput = pintarTotales;
      },
      leer: n => {
        const v = i => { const e = n.querySelector('#' + i); return e ? e.value : ''; };
        const lineas = lineasEditando.filter(l => l.productoId || (l.descripcion || '').trim());
        return { clienteId: v('pd-cli'), estado: v('pd-est'), fecha: v('pd-fecha'), entrega: v('pd-entrega'),
                 abono: A.num(v('pd-abono')), notas: v('pd-notas'), direccion: v('pd-direccion'),
                 pesoKg: A.num(v('pd-peso')), costoEnvio: A.num(v('pd-envio')), lineas };
      },
      botones: [{ txt: 'Cancelar', valor: null, clase: 'sutil' }, { txt: 'Guardar', valor: 'ok', clase: 'primario' }]
    }).then(({ valor, datos }) => {
      lineasEditando = null;
      if (!valor) return;
      Object.assign(p, datos);
      Datos.guardar('pedido');
      A.aviso('Pedido guardado');
      pintar();
    });
  }

  function nuevo() {
    const hoy = new Date().toISOString().slice(0, 10);
    const p = Datos.agregar('pedidos', { clienteId: (Datos.activos('clientes')[0] || {}).id || '', fecha: hoy, entrega: hoy,
      estado: 'cotizado', abono: 0, direccion: '', pesoKg: null, costoEnvio: 0, lineas: [], notas: '', activo: true });
    Datos.guardar('nuevo pedido'); pintar(); abrir(p.id);
  }

  function registrarPago(id) {
    const p = Datos.obtener('pedidos', id);
    if (!p) return;
    A.preguntar({
      titulo: 'Registrar pago · ' + cliente(p.clienteId),
      cuerpo: `<div class="formulario">
          ${A.campo('pg-monto', 'Monto recibido', '', { tipo: 'number', signo: '$' })}
          ${A.selector('pg-metodo', 'Método', 'transferencia', [{ v: 'transferencia', t: 'Transferencia' }, { v: 'efectivo', t: 'Efectivo' }, { v: 'otro', t: 'Otro' }])}
        </div>${htmlHistorialPagos(id)}`,
      leer: n => ({ monto: A.num((n.querySelector('#pg-monto') || {}).value), metodo: (n.querySelector('#pg-metodo') || {}).value }),
      botones: [{ txt: 'Cancelar', valor: null, clase: 'sutil' }, { txt: 'Registrar', valor: 'ok', clase: 'primario' }]
    }).then(({ valor, datos }) => {
      if (!valor || !datos.monto) return;
      Movimientos.registrar('pedidos', 'abono', id, datos.monto, 'pago ' + datos.metodo);
      Datos.guardar('pago registrado');
      A.aviso('Pago de ' + A.plata(datos.monto) + ' registrado');
      pintar();
    });
  }
  function htmlHistorialPagos(id) {
    const hist = Movimientos.historialDe('pedidos', id).filter(m => m.campo === 'abono');
    if (!hist.length) return '<p style="font-size:12.5px;color:var(--apagado);margin:14px 0 0">Sin pagos registrados todavía.</p>';
    return `<h3 style="font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:var(--pizarra);margin:16px 0 8px">Pagos ya registrados</h3>
      <table><thead><tr><th>Fecha</th><th>Motivo</th><th class="num">Monto</th></tr></thead><tbody>
        ${hist.map(m => `<tr><td>${A.fecha(m.fecha)}</td><td>${A.esc(m.motivo)}</td><td class="num">${A.plata(m.cambio)}</td></tr>`).join('')}
      </tbody></table>`;
  }

  window.Vistas = window.Vistas || {};
  Vistas.pedidos = { pintar, abrir, nuevo, registrarPago, ESTADOS, _lineaProducto, _lineaCampo, _lineaAgregar, _lineaQuitar };
})();
