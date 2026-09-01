/* Vista: pedidos. Lo que ningún software del rubro trae: abono, saldo y horas de máquina
 * comprometidas, atados al mismo catálogo que calcula los costos. */
(function () {
  const ESTADOS = [
    { v: 'cotizado', t: 'Cotizado' },
    { v: 'confirmado', t: 'Confirmado' },
    { v: 'en-produccion', t: 'En producción' },
    { v: 'listo', t: 'Listo' },
    { v: 'entregado', t: 'Entregado' }
  ];
  const nombreEstado = v => (ESTADOS.find(e => e.v === v) || {}).t || v;
  const cliente = id => (Datos.obtener('clientes', id) || {}).nombre || '—';

  function diasPara(f) {
    if (!f) return null;
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const d = new Date(f + 'T12:00:00');
    return Math.round((d - hoy) / 86400000);
  }

  function pintar() {
    const ps = Datos.activos('pedidos')
      .slice().sort((a, b) => (a.entrega || '') < (b.entrega || '') ? -1 : 1);
    const abiertos = ps.filter(p => p.estado !== 'entregado');

    let porCobrar = 0;
    abiertos.forEach(p => { const c = Costos.calcularPedido(p); if (c.saldo) porCobrar += c.saldo; });
    const horas = abiertos.reduce((s, p) => s + Costos.horasPedido(p), 0);

    let h = `<div class="cabecera"><h1>Pedidos</h1>
      <span class="sub">${abiertos.length} abiertos de ${ps.length}</span>
      <div class="acciones"><button class="btn primario" onclick="Vistas.pedidos.nuevo()">Nuevo pedido</button></div></div>
      <div class="rejilla" style="margin-bottom:16px">
        <div class="dato"><div class="k">Por cobrar</div><div class="v">${A.plata(porCobrar)}</div>
          <div class="n">saldo de los pedidos abiertos</div></div>
        <div class="dato"><div class="k">Horas comprometidas</div><div class="v">${horas.toFixed(1)} h</div>
          <div class="n">${(horas / (DB.params.capacidadDiaH || 13)).toFixed(1)} días de máquina</div></div>
      </div><div class="tarjeta"><table><thead><tr>
        <th>Cliente</th><th>Entrega</th><th>Estado</th>
        <th class="num">Total</th><th class="num">Abono</th><th class="num">Saldo</th><th class="num">Horas</th>
      </tr></thead><tbody>`;

    ps.forEach(p => {
      const c = Costos.calcularPedido(p);
      const d = diasPara(p.entrega);
      const urgente = d !== null && d <= 1 && p.estado !== 'entregado';
      h += `<tr onclick="Vistas.pedidos.abrir('${A.esc(p.id)}')" style="cursor:pointer">
        <td><b>${A.esc(cliente(p.clienteId))}</b>
            <div style="font-size:12px;color:var(--tenue)">${(p.lineas || []).reduce((s, l) => s + (l.cantidad || 0), 0)} piezas</div></td>
        <td>${A.fecha(p.entrega)}${d !== null && p.estado !== 'entregado'
              ? `<div style="font-size:12px;color:${urgente ? 'var(--coral)' : 'var(--tenue)'}">${d < 0 ? `atrasado ${-d} d` : d === 0 ? 'hoy' : d === 1 ? 'mañana' : `en ${d} días`}</div>` : ''}</td>
        <td><span class="etiqueta">${A.esc(nombreEstado(p.estado))}</span></td>
        <td class="num">${c.total === null ? `<span class="chip falta">faltan precios</span>` : A.plata(c.total)}</td>
        <td class="num">${A.plata(c.abonado)}</td>
        <td class="num"><b>${c.saldo === null ? '—' : A.plata(c.saldo)}</b></td>
        <td class="num">${Costos.horasPedido(p).toFixed(1)}</td>
      </tr>`;
    });

    h += `</tbody></table>${ps.length ? '' : '<div class="vacio"><b>Sin pedidos todavía</b>Cuando llegue uno, acá se ve el saldo y cuántas horas de máquina compromete.</div>'}</div>`;
    A.$('#contenido').innerHTML = h;
  }

  function abrir(id) {
    const p = Datos.obtener('pedidos', id);
    if (!p) return;
    const c = Costos.calcularPedido(p);
    const clientes = Datos.activos('clientes').map(x => ({ v: x.id, t: x.nombre }));

    const lineas = (p.lineas || []).map((l, i) => `
      <div class="fila"><div class="c">${A.esc(l.descripcion || '(sin descripción)')}
        <div class="n">${l.cantidad} × ${l.precioUnit == null ? 'precio sin definir' : A.plata(l.precioUnit)}</div></div>
        <div class="m">${l.precioUnit == null ? '—' : A.plata(l.precioUnit * l.cantidad)}</div></div>`).join('');

    A.preguntar({
      titulo: 'Pedido · ' + cliente(p.clienteId),
      cuerpo: `<div class="formulario">
          ${A.selector('pd-cli', 'Cliente', p.clienteId, clientes.length ? clientes : [{ v: '', t: '(no hay clientes)' }])}
          ${A.selector('pd-est', 'Estado', p.estado, ESTADOS)}
          ${A.campo('pd-fecha', 'Fecha del pedido', p.fecha, { tipo: 'date' })}
          ${A.campo('pd-entrega', 'Entrega comprometida', p.entrega, { tipo: 'date' })}
          ${A.campo('pd-abono', 'Abono recibido', p.abono || 0, { tipo: 'number' })}
        </div>
        <h3 style="font-size:13px;text-transform:uppercase;letter-spacing:.5px;color:var(--pizarra);margin:14px 0 8px">Qué lleva</h3>
        <div class="desglose">${lineas || '<div class="fila"><div class="c">Sin líneas</div></div>'}
          <div class="fila total"><div class="c"><b>Total</b></div><div class="m">${c.total === null ? 'faltan precios' : A.plata(c.total)}</div></div>
          <div class="fila"><div class="c">Costo de producción</div><div class="m" style="color:var(--tenue)">${A.plata(c.costo)}</div></div>
          <div class="fila"><div class="c">Utilidad</div><div class="m" style="color:${(c.utilidad || 0) > 0 ? 'var(--ok)' : 'var(--coral)'}">${c.utilidad === null ? '—' : A.plata(c.utilidad)}</div></div>
          <div class="fila"><div class="c">Saldo por cobrar</div><div class="m">${c.saldo === null ? '—' : A.plata(c.saldo)}</div></div>
        </div>
        <label class="campo" style="margin-top:14px"><span>Notas</span>
          <textarea id="pd-notas" rows="3">${A.esc(p.notas || '')}</textarea></label>`,
      leer: n => {
        const v = i => { const e = n.querySelector('#' + i); return e ? e.value : ''; };
        return { clienteId: v('pd-cli'), estado: v('pd-est'), fecha: v('pd-fecha'),
                 entrega: v('pd-entrega'), abono: A.num(v('pd-abono')), notas: v('pd-notas') };
      },
      botones: [{ txt: 'Cancelar', valor: null, clase: 'sutil' },
                { txt: 'Guardar', valor: 'ok', clase: 'primario' }]
    }).then(({ valor, datos }) => {
      if (!valor) return;
      Object.assign(p, datos);
      Datos.guardar('pedido');
      A.aviso('Pedido guardado');
      pintar();
    });
  }

  function nuevo() {
    const hoy = new Date().toISOString().slice(0, 10);
    const p = Datos.agregar('pedidos', {
      clienteId: (Datos.activos('clientes')[0] || {}).id || '', fecha: hoy, entrega: hoy,
      estado: 'cotizado', abono: 0, lineas: [], notas: '', activo: true
    });
    Datos.guardar('nuevo pedido'); pintar(); abrir(p.id);
  }

  window.Vistas = window.Vistas || {};
  Vistas.pedidos = { pintar, abrir, nuevo, ESTADOS };
})();
