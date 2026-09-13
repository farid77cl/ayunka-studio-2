/* Vista: Cola. Horas comprometidas contra la ventana real de la K2. */
(function () {
  function diasPara(f) {
    if (!f) return null;
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const d = new Date(f + 'T12:00:00');
    return Math.round((d - hoy) / 86400000);
  }

  function pintar() {
    const abiertos = Datos.activos('pedidos').filter(p => p.estado !== 'entregado');
    const cap = DB.params.capacidadDiaH || 13;
    const horasTotal = abiertos.reduce((s, p) => s + Costos.horasPedido(p), 0);

    let h = `<div class="cabecera"><h1>Cola</h1><span class="sub">${abiertos.length} pedidos abiertos</span></div>
      <div class="rejilla" style="margin-bottom:16px">
        <div class="dato"><div class="k">Horas comprometidas</div><div class="v">${horasTotal.toFixed(1)} h</div>
          <div class="n">de ${cap} h/día</div></div>
        <div class="dato"><div class="k">Pedidos abiertos</div><div class="v">${abiertos.length}</div></div>
      </div>
      <div class="tarjeta"><h2>Por entrega</h2>
        <table><thead><tr><th>Pedido</th><th>Entrega</th><th class="num">Horas</th><th></th></tr></thead><tbody>`;

    abiertos.slice().sort((a, b) => (a.entrega || '') < (b.entrega || '') ? -1 : 1).forEach(p => {
      const cliente = (Datos.obtener('clientes', p.clienteId) || {}).nombre || '—';
      const horas = Costos.horasPedido(p);
      const d = diasPara(p.entrega);
      // Ventana real de la K2: 8:00-21:00 (13h/día), no iniciar una pieza de 6h o más
      // después de las 10:00 -- si a un pedido le quedan pocos días y muchas horas, no alcanza.
      const diasNecesarios = Math.ceil(horas / cap);
      const noAlcanza = d !== null && d >= 0 && diasNecesarios > d + 1;
      h += `<tr><td><b>${A.esc(cliente)}</b></td><td>${A.fecha(p.entrega)}</td>
        <td class="num">${horas.toFixed(1)}</td>
        <td>${noAlcanza ? '<span class="chip bajo">no alcanza</span>' : (d !== null && d <= 1 ? '<span class="chip alto">urgente</span>' : '')}</td></tr>`;
    });
    h += `</tbody></table>${abiertos.length ? '' : '<div class="vacio"><b>Sin pedidos abiertos</b></div>'}</div>`;
    A.$('#contenido').innerHTML = h;
  }

  window.Vistas = window.Vistas || {};
  Vistas.cola = { pintar };
})();
