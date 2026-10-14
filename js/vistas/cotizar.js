/* Vista: cotizar desde un 3MF o manual. Conectado en vivo con Spoolman y K2. */
(function () {
  let lectura = null;
  let modo = '3mf'; // '3mf' o 'manual'
  let datos = {
    nombrePieza: 'Pieza personalizada',
    gramosBandeja: null,
    horasBandeja: null,
    cantidad: 1,
    filamentoId: null,
    spoolmanId: null,
    oficio: '3d'
  };
  let resultado = null;
  let spoolsCache = null;

  async function obtenerBobinas() {
    if (spoolsCache) return spoolsCache;
    try {
      const r = await fetch('/api/spoolman/spool');
      if (r.ok) {
        const raw = await r.json();
        spoolsCache = raw.filter(s => !s.archived).map(s => {
          const fil = s.filament || {};
          const vendor = (fil.vendor || {}).name || '';
          const mat = fil.material || 'PLA';
          const nom = fil.name || mat;
          const precio = s.price || fil.price || 16000;
          const rem = Math.round(s.remaining_weight != null ? s.remaining_weight : (fil.weight || 1000));
          const hex = fil.color_hex ? '#' + fil.color_hex.replace('#', '') : '#cccccc';
          return {
            id: s.id,
            spoolman: true,
            material: mat,
            marca: vendor,
            nombre: `${vendor ? vendor + ' ' : ''}${nom}`,
            colorHex: hex,
            precioKg: precio,
            gramosQuedan: rem
          };
        });
        return spoolsCache;
      }
    } catch (e) {
      // Fallback a base local
    }
    const locales = Datos.activos('filamentos');
    return locales.map(f => ({
      id: f.id,
      spoolman: false,
      material: f.material || 'PLA',
      marca: f.marca || '',
      nombre: `${f.marca ? f.marca + ' ' : ''}${f.color || f.material || 'PLA'}`,
      colorHex: f.hex || '#cccccc',
      precioKg: f.precioKg || 15000,
      gramosQuedan: f.gramosQuedan != null ? f.gramosQuedan : 1000
    }));
  }

  async function pintar() {
    const bobinas = await obtenerBobinas();
    if (!datos.filamentoId && bobinas.length) {
      datos.filamentoId = bobinas[0].id;
    }

    A.$('#contenido').innerHTML = `
      <div class="cabecera">
        <h1>Cotizar</h1>
        <span class="sub">conectado a Spoolman</span>
      </div>

      <div class="row" style="gap:8px;margin-bottom:14px">
        <button class="btn ${modo === '3mf' ? 'primario' : 'sutil'}" onclick="Vistas.cotizar.cambiarModo('3mf')">📂 Desde archivo 3MF</button>
        <button class="btn ${modo === 'manual' ? 'primario' : 'sutil'}" onclick="Vistas.cotizar.cambiarModo('manual')">✏️ Cotización directa (manual)</button>
      </div>

      ${htmlCotizacionesRecientes()}

      ${modo === '3mf' ? `
        <div class="tarjeta">
          <div id="zona" class="soltar">
            <div class="t">Suelta aquí un 3MF de Creality Print</div>
            <div class="s">o haz click para buscarlo en tu equipo</div>
            <input type="file" id="archivo" accept=".3mf" hidden>
          </div>
        </div>
      ` : `
        <div class="tarjeta">
          <h2>Parámetros de impresión directa</h2>
          <div class="formulario">
            ${A.campo('c-nombre', 'Nombre de la pieza', datos.nombrePieza || '', { ph: 'Ej: Llavero Jack Mask' })}
            ${A.campo('c-gramos', 'Gramos por pieza', datos.gramosBandeja || '', { tipo: 'number', paso: '0.1', unidad: 'g' })}
            ${A.campo('c-horas', 'Horas por pieza (o fracción decimal)', datos.horasBandeja || '', { tipo: 'number', paso: '0.01', unidad: 'h', ph: 'Ej: 0.5 para 30 min' })}
            ${A.campo('c-cant', 'Cantidad de piezas requeridas', datos.cantidad, { tipo: 'number', min: 1 })}
          </div>
          ${htmlSelectorFilamento(bobinas)}
          <button class="btn primario" style="margin-top:12px" onclick="Vistas.cotizar.calcular()">Calcular Cotización</button>
        </div>
      `}
      <div id="resultado"></div>
      <div id="cotizacion"></div>`;

    if (modo === '3mf') {
      const zona = A.$('#zona'), input = A.$('#archivo');
      if (zona && input) {
        zona.onclick = () => input.click();
        input.onchange = e => e.target.files[0] && cargar(e.target.files[0]);
        ['dragenter', 'dragover'].forEach(ev => zona.addEventListener(ev, e => { e.preventDefault(); zona.classList.add('encima'); }));
        ['dragleave', 'drop'].forEach(ev => zona.addEventListener(ev, e => { e.preventDefault(); zona.classList.remove('encima'); }));
        zona.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) cargar(f); });
      }
    }
  }

  function cambiarModo(m) {
    modo = m;
    pintar();
  }

  function htmlSelectorFilamento(bobinas) {
    if (!bobinas || !bobinas.length) {
      return `<p style="color:var(--apagado);font-size:13px">Sin bobinas registradas. Se usará precio estándar $15.000/kg.</p>`;
    }
    const opciones = bobinas.map(b => {
      const marcaTxt = b.marca ? `${b.marca} ` : '';
      const stockTxt = `${b.gramosQuedan} g disponibles`;
      const precioTxt = `$${b.precioKg.toLocaleString('es-CL')}/kg`;
      return `<option value="${b.id}" ${b.id === datos.filamentoId ? 'selected' : ''}>
        ${b.spoolman ? '🧵 [Spoolman #' + b.id + '] ' : ''}${b.nombre} · ${stockTxt} · ${precioTxt}
      </option>`;
    }).join('');

    return `
      <div class="campo" style="margin-top:12px">
        <label for="c-filamento" style="font-size:13px;font-weight:600;margin-bottom:4px;display:block">
          Bobina real en taller (Spoolman):
        </label>
        <select id="c-filamento" class="entrada" style="width:100%;padding:8px" onchange="Vistas.cotizar.cambiarFilamento(this.value)">
          ${opciones}
        </select>
      </div>`;
  }

  function cambiarFilamento(id) {
    datos.filamentoId = id;
    if (resultado) calcular();
  }

  async function cargar(file) {
    A.$('#resultado').innerHTML = `<div class="tarjeta"><div class="vacio">Leyendo ${A.esc(file.name)}…</div></div>`;
    try {
      lectura = await Lector3MF.leer3mf(file);
      datos.nombrePieza = (file.name || 'Pieza').replace(/\.3mf$/i, '');
      datos.gramosBandeja = null;
      datos.horasBandeja = lectura.tiempoDeNombre;
      pintarResultado3MF();
    } catch (e) {
      A.$('#resultado').innerHTML = `<div class="tarjeta aviso"><b>No pude leer el archivo.</b> ${A.esc(e.message || e)}</div>`;
    }
  }

  async function pintarResultado3MF() {
    const L = lectura;
    const bobinas = await obtenerBobinas();
    A.$('#resultado').innerHTML = `
      <div class="tarjeta"><h2>Lo que dice el archivo</h2>
        <div class="rejilla">
          <div class="dato"><div class="k">Piezas en la bandeja</div><div class="v">${L.piezas}</div></div>
          ${L.pausas ? `<div class="dato"><div class="k">Pausa programada</div><div class="v">sí</div></div>` : ''}
        </div>
      </div>
      <div class="tarjeta"><h2>Lo que el archivo no puede decir</h2>
        <p style="font-size:13.5px;color:var(--pizarra);margin:0 0 14px">
          Gramos y horas de la bandeja laminada en Creality Print:
        </p>
        <div class="formulario">
          ${A.campo('c-gramos', 'Gramos de la bandeja completa', datos.gramosBandeja == null ? '' : datos.gramosBandeja, { tipo: 'number', paso: '0.1', unidad: 'g' })}
          ${A.campo('c-horas', 'Horas de la bandeja completa', datos.horasBandeja == null ? '' : datos.horasBandeja, { tipo: 'number', paso: '0.01', unidad: 'h' })}
          ${A.campo('c-cant', 'Cuántas piezas necesita el cliente', datos.cantidad, { tipo: 'number', min: 1 })}
        </div>
        ${htmlSelectorFilamento(bobinas)}
        <button class="btn primario" style="margin-top:12px" onclick="Vistas.cotizar.calcular()">Calcular Cotización</button>
      </div>`;
    if (datos.gramosBandeja != null && datos.horasBandeja != null) calcular();
  }

  async function calcular() {
    const v = i => { const e = document.getElementById(i); return e ? e.value : ''; };
    if (modo === 'manual') {
      datos.nombrePieza = v('c-nombre') || 'Pieza 3D';
      datos.gramosBandeja = A.num(v('c-gramos')) || null;
      datos.horasBandeja = A.num(v('c-horas')) || null;
      datos.cantidad = Math.max(1, A.num(v('c-cant')) || 1);
    } else {
      datos.gramosBandeja = A.num(v('c-gramos')) || null;
      datos.horasBandeja = A.num(v('c-horas')) || null;
      datos.cantidad = Math.max(1, A.num(v('c-cant')) || 1);
    }

    const selFil = document.getElementById('c-filamento');
    if (selFil) datos.filamentoId = selFil.value;

    if (!datos.gramosBandeja || !datos.horasBandeja) {
      A.$('#cotizacion').innerHTML = `<div class="tarjeta aviso"><b>Faltan los gramos o las horas.</b></div>`;
      return;
    }

    const L = modo === '3mf' ? lectura : { piezas: 1, nombre: datos.nombrePieza };
    const porBandeja = (L && L.piezas) || 1;
    const bandejas = Math.ceil(datos.cantidad / porBandeja);
    const gramosPieza = datos.gramosBandeja / porBandeja;
    const horasPieza = datos.horasBandeja / porBandeja;
    const totalGramos = datos.gramosBandeja * (modo === '3mf' ? bandejas : datos.cantidad);

    const bobinas = await obtenerBobinas();
    const bobinaElegida = bobinas.find(b => String(b.id) === String(datos.filamentoId)) || bobinas[0] || {};
    const precioKgReal = bobinaElegida.precioKg || 15000;

    // Ficha de costo con precio real de bobina
    const ficha = {
      oficio: '3d',
      material: bobinaElegida.material || 'PLA',
      gramos: gramosPieza,
      horas: horasPieza,
      extraCosto: 0,
      filamentoId: bobinaElegida.id
    };

    // Calcular con motor de costos asegurando el precio por kg real
    const c = Costos.calcular(ficha);
    // Si la ficha no empató filamentoId local, forzamos recálculo proporcional con precioKgReal
    let costoUnit = c.costo;
    let precioUnit = c.sugerido;
    if (precioKgReal !== 15000 && c.completo) {
      const diffFilamento = gramosPieza * ((precioKgReal - 15000) / 1000);
      costoUnit = Math.round(costoUnit + diffFilamento);
      precioUnit = Math.round(precioUnit + diffFilamento * 2.2);
    }

    const horasTotal = (modo === '3mf' ? bandejas : datos.cantidad) * datos.horasBandeja;
    const cap = DB.params.capacidadDiaH || 13;
    const dias = Math.ceil(horasTotal / cap);
    const entrega = new Date(Date.now() + dias * 86400000);

    // Alerta de stock insuficiente en la bobina elegida
    let alertaStock = '';
    if (bobinaElegida.gramosQuedan != null && totalGramos > bobinaElegida.gramosQuedan) {
      alertaStock = `
        <div class="tarjeta aviso" style="border-left:4px solid var(--avisa);margin-bottom:12px">
          <b>⚠️ Advertencia de stock en taller:</b> Este trabajo consumirá <b>${Math.round(totalGramos)} g</b> y en la bobina seleccionada quedan <b>${bobinaElegida.gramosQuedan} g</b>. Requerirá un rollo adicional o relevo CFS en la K2.
        </div>`;
    }

    resultado = {
      archivoOrigen: datos.nombrePieza,
      cantidad: datos.cantidad,
      piezasPorBandeja: porBandeja,
      bandejas: modo === '3mf' ? bandejas : 1,
      precioUnit,
      costoUnit,
      total: precioUnit * datos.cantidad,
      horasTotal,
      filamentoNombre: bobinaElegida.nombre,
      precioKgUsado: precioKgReal,
      entrega: entrega.toISOString().slice(0, 10),
      lineas: c.lineas,
      llevaPausa: !!(L && L.pausas)
    };

    A.$('#cotizacion').innerHTML = `
      ${alertaStock}
      <div class="tarjeta">
        <h2>Cotización · ${datos.cantidad} ${datos.cantidad === 1 ? 'pieza' : 'piezas'}</h2>
        <div class="rejilla" style="margin-bottom:14px">
          <div class="dato"><div class="k">Precio unitario</div><div class="v">${A.plata(precioUnit)}</div></div>
          <div class="dato"><div class="k">Total cliente</div><div class="v">${A.plata(precioUnit * datos.cantidad)}</div></div>
          <div class="dato"><div class="k">Material presupuestado</div><div class="v" style="font-size:15px">${A.esc(bobinaElegida.nombre || 'PLA')} ($${precioKgReal.toLocaleString('es-CL')}/kg)</div></div>
          <div class="dato"><div class="k">Tiempo máquina</div><div class="v">${horasTotal.toFixed(1)} h</div></div>
        </div>
        <p style="font-size:13px;color:var(--pizarra);margin:0">Entrega estimada: <b>${A.fecha(resultado.entrega)}</b> (${dias} día${dias > 1 ? 's' : ''}).</p>
      </div>

      <div class="tarjeta">
        <h2>Asignar a Cliente y Formalizar</h2>
        ${htmlSelectorClienteCotizacion()}
        <div class="row" style="gap:10px;margin-top:12px;flex-wrap:wrap">
          <button class="btn primario" onclick="Vistas.cotizar.guardarCotizacion()">💾 Guardar Cotización</button>
          <button class="btn sutil" onclick="Vistas.cotizar.compartirWhatsAppDirecto()">📲 Enviar WhatsApp al cliente</button>
        </div>
      </div>`;
  }

  function htmlSelectorClienteCotizacion() {
    const clientes = Datos.activos('clientes').map(c => ({ v: c.id, t: `${c.nombre}${c.contacto ? ' · ' + c.contacto : ''}` }));
    if (!clientes.length) return `<p style="color:var(--apagado);font-size:13px">No hay clientes todavía. Créalos en la pestaña Clientes.</p>`;
    if (!datos.clienteId || !clientes.some(c => c.v === datos.clienteId)) datos.clienteId = clientes[0].v;
    return A.selector('cot-cli', 'Cliente destinatario', datos.clienteId, clientes);
  }

  function htmlCotizacionesRecientes() {
    const cots = Datos.activos('cotizaciones').slice().sort((a, b) => (a.fecha || '') < (b.fecha || '') ? 1 : -1).slice(0, 5);
    if (!cots.length) return '';
    return `<div class="tarjeta"><h2>Cotizaciones recientes</h2>
      <table><thead><tr><th>Cliente</th><th class="num">Total</th><th>Material</th><th>Acciones</th></tr></thead><tbody>
        ${cots.map(c => {
          const cliente = Datos.obtener('clientes', c.clienteId);
          return `<tr>
            <td><b>${A.esc(cliente ? cliente.nombre : '(cliente)')}</b><br><small style="color:var(--apagado)">${A.esc(c.archivoOrigen || 'Pieza')}</small></td>
            <td class="num"><b>${A.plata(c.total)}</b></td>
            <td><small>${A.esc(c.filamentoNombre || 'PLA')}</small></td>
            <td>
              <button class="btn chico" onclick="Vistas.cotizar.verCotizacion('${A.esc(c.id)}')">Ver</button>
              <button class="btn chico" onclick="Vistas.cotizar.enviarPorWhatsapp('${A.esc(c.id)}')">📲 WhatsApp</button>
              ${c.pedidoId ? '<span class="chip ok">pedido</span>' : `<button class="btn chico" onclick="Vistas.cotizar.convertirEnPedido('${A.esc(c.id)}')">+ Pedido</button>`}
            </td>
          </tr>`;
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
    Datos.guardar('nueva cotización con material real');
    A.aviso('Cotización guardada exitosamente.');
    verCotizacion(cot.id);
  }

  function compartirWhatsAppDirecto() {
    if (!resultado) return;
    const clienteId = (document.getElementById('cot-cli') || {}).value;
    const cliente = clienteId ? Datos.obtener('clientes', clienteId) : null;
    const nombreCliente = cliente ? cliente.nombre.split(' ')[0] : '';
    const abonoPct = DB.params.abonoPct != null ? DB.params.abonoPct : 0.5;
    const abono = Math.round(resultado.total * abonoPct / 100) * 100;

    const msg = `¡Hola${nombreCliente ? ' ' + nombreCliente : ''}! 🌿 Te dejo el presupuesto de Ayünka para ${resultado.cantidad} un. de "${resultado.archivoOrigen}":\n\n` +
      `✨ Total: ${A.plata(resultado.total)}\n` +
      `📦 Abono para partir (${Math.round(abonoPct * 100)}%): ${A.plata(abono)} · Saldo contra entrega: ${A.plata(resultado.total - abono)}\n` +
      `⏱️ Entrega estimada: ${A.fecha(resultado.entrega)}\n` +
      `🧵 Material: ${resultado.filamentoNombre || 'PLA Premium'}\n\n` +
      `¿Me confirmas para dejarlo agendado en la impresora? 💛`;

    const tel = ((cliente && cliente.contacto) || '').replace(/[^\d]/g, '');
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  function documentoHTML(cot, cliente) {
    const abonoPct = DB.params.abonoPct != null ? DB.params.abonoPct : 0.5;
    const abono = Math.round(cot.total * abonoPct / 100) * 100;
    return `<!doctype html><html><head><meta charset="utf-8"><title>Cotización Ayünka</title>
      <style>body{font-family:'Outfit',sans-serif;color:#2F3A40;max-width:640px;margin:40px auto;padding:0 20px;background:#F8F4EC}
      .card{background:#fff;border-radius:12px;border:1px solid #E4DCCE;padding:24px}
      table{width:100%;border-collapse:collapse;margin:14px 0}td,th{padding:10px 0;border-bottom:1px solid #E4DCCE;text-align:left}
      td.num,th.num{text-align:right}.total{font-size:20px;font-weight:700;color:#C27A4E}
      .marca{font-size:26px;color:#2F3A40;font-weight:700}
      .btn{background:#C27A4E;color:#fff;border:0;padding:10px 18px;border-radius:8px;font-weight:600;cursor:pointer}
      </style></head><body>
      <div class="card">
        <div class="marca">Ayünka</div>
        <p style="color:#6E7A82;margin:4px 0 16px">Presupuesto formal · ${A.fecha(cot.fecha)} · válido hasta ${A.fecha(cot.validoHasta)}</p>
        <p><b>Cliente:</b> ${A.esc(cliente ? cliente.nombre : '—')}</p>
        <p><b>Material garantizado:</b> ${A.esc(cot.filamentoNombre || 'PLA Premium')}</p>
        <table>
          <tr><th>Descripción</th><th class="num">Cantidad</th><th class="num">Precio unit.</th><th class="num">Total</th></tr>
          <tr><td>${A.esc(cot.archivoOrigen || 'Pieza 3D')}</td><td class="num">${cot.cantidad}</td>
          <td class="num">${A.plata(cot.precioUnit)}</td><td class="num"><b>${A.plata(cot.total)}</b></td></tr>
        </table>
        <p class="total">Total: ${A.plata(cot.total)}</p>
        <p>Abono sugerido (${Math.round(abonoPct * 100)}%): <b>${A.plata(abono)}</b> · Saldo: ${A.plata(cot.total - abono)}</p>
        <p>Fecha estimada de entrega: <b>${A.fecha(cot.entrega)}</b></p>
        <button class="btn" onclick="window.print()">Imprimir / Guardar en PDF</button>
      </div></body></html>`;
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

  function descargarPDF(id) {
    const cot = Datos.obtener('cotizaciones', id);
    if (!cot) { A.aviso('Esa cotización ya no existe', 'error'); return; }
    const cliente = Datos.obtener('clientes', cot.clienteId);
    PDF.genQuotePDF(cot, cliente).catch(e => A.aviso('No se pudo generar el PDF: ' + (e.message || e), 'error'));
  }

  function convertirEnPedido(id) {
    const cot = Datos.obtener('cotizaciones', id);
    if (!cot) { A.aviso('Esa cotización ya no existe', 'error'); return; }
    if (cot.pedidoId) { A.aviso('Ya tiene un pedido', 'error'); return; }
    const p = Datos.agregar('pedidos', {
      clienteId: cot.clienteId, fecha: new Date().toISOString().slice(0, 10), entrega: cot.entrega,
      estado: 'confirmado', abono: 0, direccion: '', pesoKg: null, costoEnvio: 0,
      notas: `Cotización de ${A.fecha(cot.fecha)} · ${cot.filamentoNombre || 'PLA'}`,
      lineas: [{ productoId: null, descripcion: (cot.archivoOrigen || 'Pieza 3D'), cantidad: cot.cantidad, precioUnit: cot.precioUnit }],
      activo: true
    });
    cot.pedidoId = p.id; cot.estado = 'aceptada';
    Datos.guardar('cotización convertida en pedido');
    A.aviso('Pedido formalizado en taller');
    pintar();
  }

  function enviarPorWhatsapp(id) {
    const cot = Datos.obtener('cotizaciones', id);
    if (!cot) return;
    const cliente = Datos.obtener('clientes', cot.clienteId);
    const nombreCliente = cliente ? cliente.nombre.split(' ')[0] : '';
    const abonoPct = DB.params.abonoPct != null ? DB.params.abonoPct : 0.5;
    const abono = Math.round(cot.total * abonoPct / 100) * 100;

    const msg = `¡Hola${nombreCliente ? ' ' + nombreCliente : ''}! 🌿 Te comparto la cotización de Ayünka:\n\n` +
      `✨ Pieza: ${cot.archivoOrigen || 'Impresión 3D'}\n` +
      `🔢 Cantidad: ${cot.cantidad}\n` +
      `💰 Total: ${A.plata(cot.total)} (Abono 50%: ${A.plata(abono)})\n` +
      `🧵 Material: ${cot.filamentoNombre || 'PLA Premium'}\n` +
      `📅 Entrega estimada: ${A.fecha(cot.entrega)}\n\n` +
      `¿Aprobamos para iniciar la producción? 💛`;

    const tel = ((cliente && cliente.contacto) || '').replace(/[^\d]/g, '');
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  window.Vistas = window.Vistas || {};
  Vistas.cotizar = {
    pintar, cambiarModo, cambiarFilamento, calcular,
    guardarCotizacion, compartirWhatsAppDirecto, verCotizacion,
    descargarPDF, convertirEnPedido, enviarPorWhatsapp
  };
})();
