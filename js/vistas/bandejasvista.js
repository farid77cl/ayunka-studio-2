/* Vista: Bandejas mixtas. Elegir varios pedidos abiertos y armar entre todos una
 * bandeja para la K2, mezclando piezas de clientes distintos. */
(function () {
  const PALETA = ['coral', 'pizarra', 'terra', 'mostaza', 'niebla', 'rosa'];
  let seleccion = new Set();
  let resultado = null;

  function cliente(id) { return (Datos.obtener('clientes', id) || {}).nombre || '—'; }

  function pedidosElegibles() {
    return Datos.activos('pedidos').filter(p => p.estado !== 'entregado')
      .filter(p => (p.lineas || []).some(l => l.productoId && (Datos.obtener('productos', l.productoId) || {}).oficio === '3d'));
  }

  function pintar() {
    const elegibles = pedidosElegibles().sort((a, b) => (a.entrega || '') < (b.entrega || '') ? -1 : 1);
    A.$('#contenido').innerHTML = `
      <div class="cabecera"><h1>Bandejas mixtas</h1><span class="sub">mezcla pedidos de clientes distintos en una sola placa</span></div>
      <div class="tarjeta"><h2>1 · Elige los pedidos</h2>
        ${elegibles.length ? `<table><thead><tr><th></th><th>Cliente</th><th>Entrega</th><th class="num">Piezas 3D</th></tr></thead><tbody>
          ${elegibles.map(p => {
            const n3d = (p.lineas || []).filter(l => l.productoId && (Datos.obtener('productos', l.productoId) || {}).oficio === '3d')
              .reduce((s, l) => s + Math.max(1, l.cantidad || 1), 0);
            return `<tr>
              <td><input type="checkbox" id="bp-${A.esc(p.id)}" ${seleccion.has(p.id) ? 'checked' : ''} onchange="Vistas.bandejas._toggle('${A.esc(p.id)}', this.checked)"></td>
              <td><label for="bp-${A.esc(p.id)}"><b>${A.esc(cliente(p.clienteId))}</b></label></td>
              <td>${A.fecha(p.entrega)}</td><td class="num">${n3d}</td></tr>`;
          }).join('')}</tbody></table>`
          : '<div class="vacio"><b>No hay pedidos abiertos con piezas 3D</b></div>'}
        <button class="btn primario" style="margin-top:12px" ${seleccion.size ? '' : 'disabled'} onclick="Vistas.bandejas.armar()">Armar bandeja con ${seleccion.size} pedido(s)</button>
      </div>
      <div id="bandeja-resultado">${resultado ? htmlResultado() : ''}</div>
      ${htmlHistorial()}`;
  }

  function _toggle(id, marcado) { if (marcado) seleccion.add(id); else seleccion.delete(id); pintar(); }

  function armar() {
    const ids = Array.from(seleccion);
    const { piezas, sinMedida } = Bandejas.itemsDePedidos(ids);
    const { ubicadas, sinEspacio } = Bandejas.empacar(piezas);
    resultado = { pedidoIds: ids, ubicadas, sinEspacio, sinMedida };
    pintar();
  }

  function colorDe(pedidoId, ids) { return PALETA[ids.indexOf(pedidoId) % PALETA.length]; }

  function htmlPreview(r) {
    const bed = Bandejas.BED, escala = 300 / bed.x;
    const px = mm => Math.round(mm * escala);
    const exc = Bandejas.EXCLUSION;
    return `<div style="position:relative;width:${px(bed.x)}px;height:${px(bed.y)}px;background:var(--panel2);border:2px solid var(--borde);border-radius:6px;margin:10px 0">
      <div title="Torre de purga" style="position:absolute;left:${px(exc.x0)}px;top:${px(exc.y0)}px;width:${px(exc.x1 - exc.x0)}px;height:${px(exc.y1 - exc.y0)}px;background:repeating-linear-gradient(45deg,var(--borde),var(--borde) 4px,transparent 4px,transparent 8px)"></div>
      ${r.ubicadas.map(p => `<div title="${A.esc(p.nombre)} · ${A.esc(p.cliente)}" style="position:absolute;left:${px(p.x0)}px;top:${px(p.y0)}px;width:${px(p.anchoMm)}px;height:${px(p.largoMm)}px;background:var(--${colorDe(p.pedidoId, r.pedidoIds)});opacity:.75;border:1px solid var(--carbon);border-radius:3px;font-size:9px;overflow:hidden;padding:1px 3px;color:#fff">${A.esc(p.cliente)}</div>`).join('')}
    </div>`;
  }

  function htmlResultado() {
    const r = resultado;
    const clientesUnicos = Array.from(new Set(r.pedidoIds.map(id => cliente((Datos.obtener('pedidos', id) || {}).clienteId))));
    return `<div class="tarjeta"><h2>2 · Vista previa</h2>
      <p style="font-size:12.5px;color:var(--apagado)">Empaquetado aproximado, no reemplaza el slicer -- verifica ahí antes de imprimir. Clientes: ${A.esc(clientesUnicos.join(', '))}.</p>
      ${htmlPreview(r)}
      <div class="rejilla" style="margin-bottom:6px">
        <div class="dato"><div class="k">Piezas ubicadas</div><div class="v">${r.ubicadas.length}</div></div>
        <div class="dato"><div class="k">Sin espacio</div><div class="v">${r.sinEspacio.length}</div></div>
        <div class="dato"><div class="k">Sin medida cargada</div><div class="v">${r.sinMedida.reduce((s, x) => s + x.cantidad, 0)}</div></div>
      </div>
      ${r.sinEspacio.length ? `<p style="font-size:12.5px;color:var(--terra)">No entraron en esta bandeja: ${r.sinEspacio.map(p => A.esc(p.nombre + ' (' + p.cliente + ')')).join(', ')} -- arma una segunda bandeja con lo que sobra.</p>` : ''}
      ${r.sinMedida.length ? `<p style="font-size:12.5px;color:var(--terra)">Sin ancho/largo cargado, no se pudieron ubicar: ${r.sinMedida.map(p => A.esc(p.nombre + ' ×' + p.cantidad)).join(', ')} -- complétalo en Productos.</p>` : ''}
      <button class="btn primario" ${r.ubicadas.length ? '' : 'disabled'} onclick="Vistas.bandejas.guardar()">Guardar bandeja</button>
    </div>`;
  }

  function guardar() {
    if (!resultado || !resultado.ubicadas.length) return;
    Datos.agregar('bandejas', {
      creada: new Date().toISOString(), pedidoIds: resultado.pedidoIds,
      piezas: resultado.ubicadas.map(p => ({ pedidoId: p.pedidoId, cliente: p.cliente, productoId: p.productoId, nombre: p.nombre, x0: p.x0, y0: p.y0, x1: p.x1, y1: p.y1 })),
      sinEspacio: resultado.sinEspacio.length, estado: 'planificada', activo: true
    });
    Datos.guardar('bandeja mixta guardada');
    A.aviso('Bandeja guardada · ' + resultado.ubicadas.length + ' piezas');
    seleccion = new Set(); resultado = null;
    pintar();
  }

  function eliminar(id) {
    A.preguntar({ titulo: 'Eliminar bandeja', cuerpo: '<p>¿Eliminar esta bandeja guardada? No borra los pedidos.</p>',
      botones: [{ txt: 'Cancelar', valor: null, clase: 'sutil' }, { txt: 'Eliminar', valor: 'ok', clase: 'primario' }] })
      .then(({ valor }) => { if (!valor) return; Datos.quitar('bandejas', id); Datos.guardar('bandeja eliminada'); A.aviso('Bandeja eliminada'); pintar(); });
  }

  function htmlHistorial() {
    const guardadas = Datos.activos('bandejas').slice().sort((a, b) => (b.creada || '') < (a.creada || '') ? -1 : 1);
    if (!guardadas.length) return '';
    return `<div class="tarjeta"><h2>Bandejas guardadas</h2>
      <table><thead><tr><th>Fecha</th><th>Clientes</th><th class="num">Piezas</th><th></th></tr></thead><tbody>
        ${guardadas.map(b => {
          const clientes = Array.from(new Set((b.piezas || []).map(p => p.cliente)));
          return `<tr><td>${A.fecha((b.creada || '').slice(0, 10))}</td><td>${A.esc(clientes.join(', '))}</td>
            <td class="num">${(b.piezas || []).length}</td>
            <td><button class="btn chico" onclick="Vistas.bandejas.eliminar('${A.esc(b.id)}')">Eliminar</button></td></tr>`;
        }).join('')}
      </tbody></table></div>`;
  }

  window.Vistas = window.Vistas || {};
  Vistas.bandejas = { pintar, _toggle, armar, guardar, eliminar };
})();
