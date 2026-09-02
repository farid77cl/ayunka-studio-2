/* Vista: Pendientes. La primera pestaña — lo que Farid abre para saber qué le toca hacer
 * sin tener que acordarse.
 *
 * Todo se calcula EN VIVO desde la base, nada de listas escritas a mano: si se arregla
 * algo, desaparece solo. Sin barras de progreso ni porcentajes, sin rojo ni signos de
 * exclamación — que falte un dato no es un error, es trabajo pendiente (SUPERVISION.md,
 * encargo del 2-sep).
 */
(function () {
  const N = (v, d = 0) => (typeof v === 'number' && isFinite(v)) ? v : d;

  function sinPrecio() { return Datos.activos('productos').filter(p => typeof p.precio !== 'number'); }
  function sinHorasTextil() { return Datos.activos('productos').filter(p => p.oficio !== '3d' && !N(p.horasMano)); }
  function sinConfirmar() { return Datos.activos('productos').filter(p => p.oficio === 'bordado' && !p.oficioConfirmado); }
  function sin3d() { return Datos.activos('productos').filter(p => p.oficio === '3d' && (!N(p.gramos) || !N(p.horas))); }
  function pedidosAbiertos() { return Datos.activos('pedidos').filter(p => p.estado !== 'entregado'); }
  function pedidosSinPrecio() { return pedidosAbiertos().filter(p => Costos.calcularPedido(p).faltanPrecios > 0); }
  function nubePendiente() { return !Nube.configurado() || !Nube.visto(); }

  function contar() {
    return sinPrecio().length + sinHorasTextil().length + sinConfirmar().length +
      sin3d().length + pedidosSinPrecio().length + (nubePendiente() ? 1 : 0);
  }

  function pintar() {
    const bloques = [
      bloquePrecios(sinPrecio()),
      bloqueHoras(sinHorasTextil()),
      bloqueConfirmar(sinConfirmar()),
      bloque3d(sin3d()),
      bloquePedidos(pedidosSinPrecio()),
      bloqueNube()
    ].filter(Boolean).join('');

    const total = contar();

    A.$('#contenido').innerHTML = `
      <div class="cabecera"><h1>Pendientes</h1>
        <span class="sub">${total ? total + ' por resolver' : 'nada pendiente'}</span></div>
      <div id="pend-impresora"></div>
      ${bloques || `<div class="tarjeta"><div class="vacio">
        <b>No hay nada pendiente</b>Todo lo que esta pantalla puede revisar está al día.</div></div>`}`;
    actualizarImpresoraViva();
  }

  /* El presente de la K2, no solo su pasado (SUPERVISION.md, encargo del 2-sep, punto D).
   * impresora/agente-k2.js empuja el estado a Firestore cada pocos segundos; acá solo se
   * lee, y solo importa un caso: que esté en pausa esperando los chips -- es lo que costó
   * tiempo el 1-sep. Llega un instante después del resto de la pantalla porque es una
   * lectura de red; el resto de Pendientes no espera por esto. */
  function actualizarImpresoraViva() {
    if (!window.Nube || !Nube.encendida || !Nube.encendida()) return;
    Nube.leerImpresoraViva().then(estado => {
      const cont = document.getElementById('pend-impresora');
      if (!cont) return; // se cambió de pantalla mientras tanto
      if (estado && estado.alcanzable && estado.pausado) {
        cont.innerHTML = `<div class="tarjeta aviso">
          <h2>La K2 está en pausa — toca meter los chips</h2>
          <p style="font-size:13px;color:var(--pizarra);margin:0">
            ${A.esc(estado.archivo || '')}${estado.actualizado ? ' · hace ' + haceCuanto(estado.actualizado) : ''}</p>
        </div>`;
      } else {
        cont.innerHTML = '';
      }
    }).catch(() => {});
  }

  function haceCuanto(iso) {
    const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (min < 1) return 'un momento';
    if (min < 60) return min + ' min';
    return Math.round(min / 60) + ' h';
  }

  function nombreProd(p) { return (p.sku ? A.esc(p.sku) + ' · ' : '') + A.esc(p.nombre); }

  function bloquePrecios(lista) {
    if (!lista.length) return '';
    return `<div class="tarjeta"><h2>Precios sin poner · ${lista.length}</h2>
      <p style="font-size:13px;color:var(--pizarra);margin:0 0 12px">
        Sin precio no se puede cargar el catálogo de WhatsApp, y «¿cuánto vale?» es la
        primera pregunta de toda consulta.</p>
      <table><thead><tr><th>Producto</th><th class="num">Sugerido</th><th></th></tr></thead><tbody>
        ${lista.map(p => {
          const c = Costos.calcular(p);
          return `<tr>
            <td style="cursor:pointer" onclick="Vistas.pendientes.abrirProducto('${A.esc(p.id)}')"><b>${nombreProd(p)}</b></td>
            <td class="num">${c.sugerido === null ? `<span class="chip falta">${A.esc(c.falta)}</span>` : A.plata(c.sugerido)}</td>
            <td>${c.sugerido === null ? '' : `<button class="btn chico" onclick="Vistas.pendientes.aceptarSugerido('${A.esc(p.id)}')">Aceptar ${A.plata(c.sugerido)}</button>`}</td>
          </tr>`;
        }).join('')}
      </tbody></table></div>`;
  }

  function bloqueHoras(lista) {
    if (!lista.length) return '';
    return `<div class="tarjeta"><h2>Textiles sin horas de trabajo · ${lista.length}</h2>
      <p style="font-size:13px;color:var(--pizarra);margin:0 0 12px">
        Sin las horas no se puede costear y la app no sugiere precio: sale «—» en toda la
        fila. Basta cronometrar <b>uno de cada tipo</b>, no los ${lista.length}.</p>
      <table><thead><tr><th>Producto</th><th>Oficio</th></tr></thead><tbody>
        ${lista.map(p => `<tr>
          <td style="cursor:pointer" onclick="Vistas.pendientes.abrirProducto('${A.esc(p.id)}')"><b>${nombreProd(p)}</b></td>
          <td>${A.esc(p.oficio)}</td>
        </tr>`).join('')}
      </tbody></table></div>`;
  }

  function bloqueConfirmar(lista) {
    if (!lista.length) return '';
    return `<div class="tarjeta"><h2>Falta separar bordado de costura · ${lista.length}</h2>
      <p style="font-size:13px;color:var(--pizarra);margin:0 0 12px">
        Van con márgenes distintos: bordado ×2,55 y costura ×2. Si están todos como
        bordado, los de costura salen 27% caros.</p>
      <table><thead><tr><th>Producto</th><th></th></tr></thead><tbody>
        ${lista.map(p => `<tr>
          <td style="cursor:pointer" onclick="Vistas.pendientes.abrirProducto('${A.esc(p.id)}')"><b>${nombreProd(p)}</b></td>
          <td class="row" style="justify-content:flex-end;gap:6px">
            <button class="btn chico sutil" onclick="Vistas.pendientes.confirmarOficio('${A.esc(p.id)}', false)">Es bordado</button>
            <button class="btn chico sutil" onclick="Vistas.pendientes.confirmarOficio('${A.esc(p.id)}', true)">Es costura</button>
          </td>
        </tr>`).join('')}
      </tbody></table></div>`;
  }

  function bloque3d(lista) {
    if (!lista.length) return '';
    return `<div class="tarjeta"><h2>Productos 3D sin gramos ni horas · ${lista.length}</h2>
      <p style="font-size:13px;color:var(--pizarra);margin:0 0 12px">
        Mientras falten, la cola de producción calcula de menos y su «alcanza / no alcanza»
        no es confiable. <b>Revisa primero Historial K2</b> — puede que la impresora ya los
        tenga.</p>
      <div class="row" style="margin-bottom:12px">
        <button class="btn" onclick="App.ir('impresora')">Ir a Historial K2</button>
      </div>
      <table><thead><tr><th>Producto</th><th>Falta</th></tr></thead><tbody>
        ${lista.map(p => `<tr>
          <td style="cursor:pointer" onclick="Vistas.pendientes.abrirProducto('${A.esc(p.id)}')"><b>${nombreProd(p)}</b></td>
          <td>${A.esc(Costos.queFalta(p) || '')}</td>
        </tr>`).join('')}
      </tbody></table></div>`;
  }

  function bloquePedidos(lista) {
    if (!lista.length) return '';
    return `<div class="tarjeta"><h2>Pedidos abiertos con líneas sin precio · ${lista.length}</h2>
      <p style="font-size:13px;color:var(--pizarra);margin:0 0 12px">
        Mientras falten, el total y el saldo de ese pedido salen en blanco.</p>
      <table><thead><tr><th>Cliente</th><th>Entrega</th><th class="num">Líneas sin precio</th></tr></thead><tbody>
        ${lista.map(p => {
          const cli = (Datos.obtener('clientes', p.clienteId) || {}).nombre || '—';
          const c = Costos.calcularPedido(p);
          return `<tr style="cursor:pointer" onclick="Vistas.pendientes.abrirPedido('${A.esc(p.id)}')">
            <td><b>${A.esc(cli)}</b></td>
            <td>${A.fecha(p.entrega)}</td>
            <td class="num">${c.faltanPrecios}</td>
          </tr>`;
        }).join('')}
      </tbody></table></div>`;
  }

  function bloqueNube() {
    if (!nubePendiente()) return '';
    const apagada = !Nube.configurado();
    return `<div class="tarjeta"><h2>La nube</h2>
      <p style="font-size:13px;color:var(--pizarra);margin:0 0 12px">
        ${apagada
          ? 'La sincronización está apagada — este equipo es la única copia.'
          : 'La sincronización está configurada, pero este equipo nunca terminó un ciclo completo.'}
        Ese fue exactamente el estado que precedió a la pérdida de datos del 1-sep.</p>
      <div class="row">
        ${apagada
          ? `<button class="btn primario" onclick="App.ir('ajustes')">Ir a Ajustes</button>`
          : `<button class="btn primario" onclick="Vistas.pendientes.sincronizarAhora()">Sincronizar ahora</button>`}
      </div></div>`;
  }

  function abrirProducto(id) { Vistas.productos.abrir(id); }
  function abrirPedido(id) { Vistas.pedidos.abrir(id); }

  function aceptarSugerido(id) {
    const p = Datos.obtener('productos', id);
    if (!p) return;
    const c = Costos.calcular(p);
    if (c.sugerido === null) { A.aviso('Todavía faltan datos para sugerir un precio', 'error'); return; }
    p.precio = c.sugerido;
    Datos.guardar('precio aceptado desde Pendientes');
    A.aviso('Precio puesto en ' + A.plata(p.precio));
    pintar();
  }

  function confirmarOficio(id, esCostura) {
    const p = Datos.obtener('productos', id);
    if (!p) return;
    if (esCostura) p.oficio = 'costura';
    p.oficioConfirmado = true;
    Datos.guardar('oficio confirmado desde Pendientes');
    A.aviso(p.nombre + ' confirmado como ' + (esCostura ? 'costura' : 'bordado'));
    pintar();
  }

  function sincronizarAhora() {
    A.aviso('Conectando con la nube…');
    App.conectarNube().then(pintar);
  }

  window.Vistas = window.Vistas || {};
  Vistas.pendientes = { pintar, contar, abrirProducto, abrirPedido, aceptarSugerido, confirmarOficio, sincronizarAhora };
})();
