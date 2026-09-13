/* Vista: cotizar desde un 3MF. Se pregunta por LA BANDEJA (gramos/horas ya laminados en
 * Creality Print), no por la pieza -- evita inventar cómo se reparte el tiempo. */
(function () {
  let lectura = null;
  let datos = { gramosBandeja: null, horasBandeja: null, cantidad: 50, oficio: '3d' };
  let resultado = null;

  function pintar() {
    A.$('#contenido').innerHTML = `
      <div class="cabecera"><h1>Cotizar</h1><span class="sub">desde un 3MF</span></div>
      ${htmlCotizacionesRecientes()}
      <div class="tarjeta">
        <div id="zona" class="soltar">
          <div class="t">Suelta aquí un 3MF</div><div class="s">o haz click para buscarlo</div>
          <input type="file" id="archivo" accept=".3mf" hidden>
        </div>
      </div>
      <div id="resultado"></div>`;
    const zona = A.$('#zona'), input = A.$('#archivo');
    zona.onclick = () => input.click();
    input.onchange = e => e.target.files[0] && cargar(e.target.files[0]);
    ['dragenter', 'dragover'].forEach(ev => zona.addEventListener(ev, e => { e.preventDefault(); zona.classList.add('encima'); }));
    ['dragleave', 'drop'].forEach(ev => zona.addEventListener(ev, e => { e.preventDefault(); zona.classList.remove('encima'); }));
    zona.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) cargar(f); });
  }

  async function cargar(file) {
    A.$('#resultado').innerHTML = `<div class="tarjeta"><div class="vacio">Leyendo ${A.esc(file.name)}…</div></div>`;
    try {
      lectura = await Lector3MF.leer3mf(file);
      datos.gramosBandeja = null;
      datos.horasBandeja = lectura.tiempoDeNombre;
      pintarResultado();
    } catch (e) {
      A.$('#resultado').innerHTML = `<div class="tarjeta aviso"><b>No pude leer el archivo.</b> ${A.esc(e.message || e)}</div>`;
    }
  }

  function pintarResultado() {
    const L = lectura;
    A.$('#resultado').innerHTML = `
      <div class="tarjeta"><h2>Lo que dice el archivo</h2>
        <div class="rejilla">
          <div class="dato"><div class="k">Piezas en la bandeja</div><div class="v">${L.piezas}</div></div>
          ${L.pausas ? `<div class="dato"><div class="k">Pausa programada</div><div class="v">sí</div></div>` : ''}
        </div></div>
      <div class="tarjeta"><h2>Lo que el archivo no puede decir</h2>
        <p style="font-size:13.5px;color:var(--pizarra);margin:0 0 14px">Los gramos y el tiempo no
          están en un 3MF de proyecto -- se lamina una vez en Creality Print y se copian los dos
          números de la bandeja completa.</p>
        <div class="formulario">
          ${A.campo('c-gramos', 'Gramos de la bandeja', datos.gramosBandeja == null ? '' : datos.gramosBandeja, { tipo: 'number', paso: '0.1', unidad: 'g' })}
          ${A.campo('c-horas', 'Horas de la bandeja', datos.horasBandeja == null ? '' : datos.horasBandeja, { tipo: 'number', paso: '0.01', unidad: 'h' })}
          ${A.campo('c-cant', 'Cuántas piezas necesita el cliente', datos.cantidad, { tipo: 'number' })}
        </div>
        <button class="btn primario" onclick="Vistas.cotizar.calcular()">Calcular</button>
      </div>
      <div id="cotizacion"></div>`;
    if (datos.gramosBandeja != null && datos.horasBandeja != null) calcular();
  }

  function calcular() {
    const v = i => { const e = document.getElementById(i); return e ? e.value : ''; };
    datos.gramosBandeja = A.num(v('c-gramos')) || null;
    datos.horasBandeja = A.num(v('c-horas')) || null;
    datos.cantidad = Math.max(1, A.num(v('c-cant')) || 1);
    if (!datos.gramosBandeja || !datos.horasBandeja) {
      A.$('#cotizacion').innerHTML = `<div class="tarjeta aviso"><b>Faltan los gramos o las horas de la bandeja.</b></div>`;
      return;
    }
    const L = lectura, porBandeja = L.piezas || 1;
    const bandejas = Math.ceil(datos.cantidad / porBandeja);
    const gramosPieza = datos.gramosBandeja / porBandeja, horasPieza = datos.horasBandeja / porBandeja;
    const ficha = { oficio: '3d', material: 'PLA', gramos: gramosPieza, horas: horasPieza, extraCosto: 0 };
    const c = Costos.calcular(ficha);
    const precioUnit = c.sugerido;
    const horasTotal = bandejas * datos.horasBandeja;
    const cap = DB.params.capacidadDiaH || 13;
    const dias = Math.ceil(horasTotal / cap);
    const entrega = new Date(Date.now() + dias * 86400000);

    resultado = { archivoOrigen: L.nombre, cantidad: datos.cantidad, piezasPorBandeja: porBandeja,
      bandejas, precioUnit, costoUnit: c.costo, total: precioUnit * datos.cantidad, horasTotal,
      entrega: entrega.toISOString().slice(0, 10), lineas: c.lineas, llevaPausa: !!L.pausas };

    A.$('#cotizacion').innerHTML = `
      <div class="tarjeta"><h2>Cotización · ${datos.cantidad} piezas</h2>
        <div class="rejilla" style="margin-bottom:14px">
          <div class="dato"><div class="k">Precio por unidad</div><div class="v">${A.plata(precioUnit)}</div></div>
          <div class="dato"><div class="k">Total</div><div class="v">${A.plata(precioUnit * datos.cantidad)}</div></div>
          <div class="dato"><div class="k">Bandejas</div><div class="v">${bandejas}</div></div>
          <div class="dato"><div class="k">Tiempo de máquina</div><div class="v">${horasTotal.toFixed(1)} h</div></div>
        </div>
        <p style="font-size:13px;color:var(--pizarra);margin:0">Entrega realista: <b>${A.fecha(resultado.entrega)}</b>.</p>
      </div>
      <div class="tarjeta"><h2>Guardar y mandarle al cliente</h2>
        ${htmlSelectorClienteCotizacion()}
        <div class="row">
          <button class="btn primario" onclick="Vistas.cotizar.guardarCotizacion()">Guardar cotización</button>
        </div>
      </div>`;
  }

  function htmlSelectorClienteCotizacion() {
    const clientes = Datos.activos('clientes').map(c => ({ v: c.id, t: c.nombre }));
    if (!clientes.length) return `<p style="color:var(--apagado);font-size:13px">No hay clientes todavía.</p>`;
    if (!datos.clienteId || !clientes.some(c => c.v === datos.clienteId)) datos.clienteId = clientes[0].v;
    return A.selector('cot-cli', 'Cliente', datos.clienteId, clientes);
  }

  function htmlCotizacionesRecientes() {
    const cots = Datos.activos('cotizaciones').slice().sort((a, b) => (a.fecha || '') < (b.fecha || '') ? 1 : -1).slice(0, 5);
    if (!cots.length) return '';
    return `<div class="tarjeta"><h2>Cotizaciones recientes</h2>
      <table><thead><tr><th>Cliente</th><th class="num">Total</th><th></th><th></th></tr></thead><tbody>
        ${cots.map(c => {
          const cliente = Datos.obtener('clientes', c.clienteId);
          return `<tr><td><b>${A.esc(cliente ? cliente.nombre : '(cliente borrado)')}</b></td>
            <td class="num"><b>${A.plata(c.total)}</b></td>
            <td><button class="btn chico" onclick="Vistas.cotizar.verCotizacion('${A.esc(c.id)}')">Ver documento</button></td>
            <td>${c.pedidoId ? '<span class="chip ok">ya es pedido</span>' : `<button class="btn chico" onclick="Vistas.cotizar.convertirEnPedido('${A.esc(c.id)}')">Convertir en pedido</button>`}</td></tr>`;
        }).join('')}
      </tbody></table></div>`;
  }

  function guardarCotizacion() {
    if (!resultado) return;
    const clienteId = (document.getElementById('cot-cli') || {}).value;
    if (!clienteId) { A.aviso('No hay cliente elegido', 'error'); return; }
    const hoy = new Date().toISOString().slice(0, 10);
    const dias = DB.params.validezCotizacionDias || 15;
    const validoHasta = new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10);
    const cot = Datos.agregar('cotizaciones', Object.assign({ clienteId, fecha: hoy, validoHasta, estado: 'borrador', activo: true }, resultado));
    Datos.guardar('nueva cotización');
    A.aviso('Cotización guardada, válida hasta ' + A.fecha(validoHasta));
    verCotizacion(cot.id);
  }

  function documentoHTML(cot, cliente) {
    const abonoPct = DB.params.abonoPct != null ? DB.params.abonoPct : 0.5;
    const abono = Math.round(cot.total * abonoPct / 100) * 100;
    return `<!doctype html><html><head><meta charset="utf-8"><title>Cotización</title>
      <style>body{font-family:sans-serif;color:#2F3A40;max-width:640px;margin:40px auto;padding:0 20px}
      table{width:100%;border-collapse:collapse;margin:14px 0}td,th{padding:8px 0;border-bottom:1px solid #E4DCCE;text-align:left}
      td.num,th.num{text-align:right}.total{font-size:19px;font-weight:700}</style></head><body>
      <h1>Ayünka</h1><div>Cotización · ${A.fecha(cot.fecha)} · válida hasta ${A.fecha(cot.validoHasta)}</div>
      <p><b>Cliente:</b> ${A.esc(cliente ? cliente.nombre : '—')}</p>
      <table><tr><th>Descripción</th><th class="num">Cantidad</th><th class="num">Precio unit.</th><th class="num">Total</th></tr>
      <tr><td>${A.esc((cot.archivoOrigen || 'Pieza').replace(/\.3mf$/i, ''))}</td><td class="num">${cot.cantidad}</td>
      <td class="num">${A.plata(cot.precioUnit)}</td><td class="num">${A.plata(cot.total)}</td></tr></table>
      <p class="total">Total: ${A.plata(cot.total)}</p>
      <p>Abono sugerido (${Math.round(abonoPct * 100)}%): ${A.plata(abono)} · Saldo: ${A.plata(cot.total - abono)}</p>
      <p>Entrega estimada: ${A.fecha(cot.entrega)}</p>
      <p><button onclick="window.print()">Imprimir / Guardar como PDF</button></p></body></html>`;
  }

  function verCotizacion(id) {
    const cot = Datos.obtener('cotizaciones', id);
    if (!cot) { A.aviso('Esa cotización ya no existe', 'error'); return; }
    const cliente = Datos.obtener('clientes', cot.clienteId);
    const w = window.open('', '_blank');
    if (!w) { A.aviso('El navegador bloqueó la ventana', 'error'); return; }
    w.document.write(documentoHTML(cot, cliente));
    w.document.close();
  }

  function convertirEnPedido(id) {
    const cot = Datos.obtener('cotizaciones', id);
    if (!cot) { A.aviso('Esa cotización ya no existe', 'error'); return; }
    if (cot.pedidoId) { A.aviso('Ya tiene un pedido', 'error'); return; }
    const p = Datos.agregar('pedidos', {
      clienteId: cot.clienteId, fecha: new Date().toISOString().slice(0, 10), entrega: cot.entrega,
      estado: 'confirmado', abono: 0, direccion: '', pesoKg: null, costoEnvio: 0,
      notas: 'Desde cotización de ' + A.fecha(cot.fecha) + '.',
      lineas: [{ productoId: null, descripcion: (cot.archivoOrigen || 'Pieza').replace(/\.3mf$/i, ''), cantidad: cot.cantidad, precioUnit: cot.precioUnit }],
      activo: true
    });
    cot.pedidoId = p.id; cot.estado = 'aceptada';
    Datos.guardar('cotización convertida en pedido');
    A.aviso('Pedido creado');
    pintar();
  }

  function enviarPorWhatsapp(id) {
    const cot = Datos.obtener('cotizaciones', id);
    if (!cot) return;
    const cliente = Datos.obtener('clientes', cot.clienteId);
    const nombreCliente = cliente ? cliente.nombre.split(' ')[0] : '';
    const msg = `Hola${nombreCliente ? ' ' + nombreCliente : ''}! Te dejo la cotización: ${cot.cantidad} unidades · total ${A.plata(cot.total)}. Entrega estimada: ${A.fecha(cot.entrega)}.`;
    const telefono = ((cliente && cliente.contacto) || '').replace(/[^\d]/g, '');
    window.open('https://wa.me/' + telefono + '?text=' + encodeURIComponent(msg), '_blank');
  }

  window.Vistas = window.Vistas || {};
  Vistas.cotizar = { pintar, calcular, guardarCotizacion, verCotizacion, convertirEnPedido, enviarPorWhatsapp };
})();
