/* Vista: cola de producción.
 *
 * Esta es la pregunta que ningún software del rubro contesta y que con UNA impresora es
 * el cuello de botella real: ¿alcanza el tiempo? Cruza las horas de máquina que compromete
 * cada pedido contra los días que quedan hasta su entrega.
 *
 * La restricción de la K2 está en `plan-de-impresion.md` y sigue siendo cierta: ventana de
 * 8:00 a 21:00 y nunca arrancar una pieza de 6 h después de las 10:00.
 */
(function () {
  const dias = f => {
    if (!f) return null;
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    return Math.round((new Date(f + 'T12:00:00') - hoy) / 86400000);
  };

  function pintar() {
    const cap = DB.params.capacidadDiaH || 13;
    const abiertos = Datos.activos('pedidos')
      .filter(p => p.estado !== 'entregado')
      .sort((a, b) => (a.entrega || '9999') < (b.entrega || '9999') ? -1 : 1);

    let acumulado = 0;
    const filas = abiertos.map(p => {
      const h = Costos.horasPedido(p);
      acumulado += h;
      const d = dias(p.entrega);
      const disponible = d === null ? null : Math.max(0, d) * cap;
      const alcanza = disponible === null ? null : acumulado <= disponible;
      return { p, h, acumulado, d, disponible, alcanza };
    });

    const totalH = acumulado;

    let html = `<div class="cabecera"><h1>Cola de producción</h1>
      <span class="sub">${abiertos.length} pedidos abiertos</span></div>
      <div class="rejilla" style="margin-bottom:16px">
        <div class="dato"><div class="k">Horas por delante</div><div class="v">${totalH.toFixed(1)} h</div>
          <div class="n">${(totalH / cap).toFixed(1)} días a ${cap} h/día</div></div>
        <div class="dato"><div class="k">Capacidad</div><div class="v">${cap} h/día</div>
          <div class="n">ventana de 8:00 a 21:00</div></div>
      </div>`;

    if (!abiertos.length) {
      html += `<div class="tarjeta"><div class="vacio"><b>La cola está vacía</b>
        Cuando haya pedidos abiertos, acá se ve si el tiempo alcanza antes de cada entrega.</div></div>`;
      A.$('#contenido').innerHTML = html;
      return;
    }

    html += `<div class="tarjeta"><h2>¿Alcanza el tiempo?</h2>
      <table><thead><tr><th>Pedido</th><th>Entrega</th>
      <th class="num">Horas</th><th class="num">Acumulado</th><th class="num">Disponible</th><th></th>
      </tr></thead><tbody>`;

    filas.forEach(f => {
      const cli = (Datos.obtener('clientes', f.p.clienteId) || {}).nombre || '—';
      html += `<tr onclick="Vistas.pedidos.abrir('${A.esc(f.p.id)}')" style="cursor:pointer">
        <td><b>${A.esc(cli)}</b><div style="font-size:12px;color:var(--apagado)">${A.esc(f.p.estado)}</div></td>
        <td>${A.fecha(f.p.entrega)}<div style="font-size:12px;color:var(--apagado)">${
          f.d === null ? '' : f.d < 0 ? `atrasado ${-f.d} d` : f.d === 0 ? 'hoy' : `en ${f.d} días`}</div></td>
        <td class="num">${f.h.toFixed(1)}</td>
        <td class="num" style="color:var(--apagado)">${f.acumulado.toFixed(1)}</td>
        <td class="num" style="color:var(--apagado)">${f.disponible === null ? '—' : f.disponible.toFixed(0)}</td>
        <td>${f.alcanza === null ? '' : f.alcanza
              ? '<span class="chip ok">alcanza</span>'
              : '<span class="chip bajo">no alcanza</span>'}</td></tr>`;
    });

    html += `</tbody></table>
      <p style="font-size:12.5px;color:var(--apagado);margin:12px 0 0">
        El acumulado suma las horas de los pedidos que van antes: un pedido puede caber solo
        y no caber en la fila. Las horas salen del catálogo, así que un producto sin horas
        cargadas hace que este cálculo mienta hacia abajo.</p></div>`;

    const sinHoras = Datos.activos('productos').filter(p => p.oficio === '3d' && !p.horas).length;
    if (sinHoras) {
      html += `<div class="tarjeta aviso">
        <b>${sinHoras} productos 3D no tienen horas de máquina cargadas.</b>
        Mientras falten, la cola calcula de menos y el «alcanza» no es confiable.</div>`;
    }

    A.$('#contenido').innerHTML = html;
  }

  window.Vistas = window.Vistas || {};
  Vistas.cola = { pintar };
})();
