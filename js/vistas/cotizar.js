/* Vista: cotizar desde un 3MF.
 *
 * El flujo real de Ayünka: llega un archivo o un logo, se lamina una vez en Creality Print,
 * y de ahí sale todo. Esta pantalla hace la segunda mitad —la aritmética— que hoy se hace
 * a mano y de noche.
 *
 * Se pregunta por LA BANDEJA, no por la pieza: es como sale de Creality Print
 * ("4h54m53s", "146 g") y evita inventar cómo se reparte el tiempo entre piezas. El 3MF ya
 * dice cuántas piezas trae la bandeja, así que lo de cada una es una división.
 */
(function () {
  let lectura = null;
  let datos = { gramosBandeja: null, horasBandeja: null, cantidad: 50, oficio: '3d' };

  function pintar() {
    A.$('#contenido').innerHTML = `
      <div class="cabecera"><h1>Cotizar</h1>
        <span class="sub">desde un 3MF</span></div>

      <div class="tarjeta">
        <div id="zona" class="soltar">
          <div class="t">Suelta aquí un 3MF</div>
          <div class="s">o haz click para buscarlo</div>
          <input type="file" id="archivo" accept=".3mf" hidden>
        </div>
      </div>
      <div id="resultado"></div>`;

    const zona = A.$('#zona'), input = A.$('#archivo');
    zona.onclick = () => input.click();
    input.onchange = e => e.target.files[0] && cargar(e.target.files[0]);
    ['dragenter', 'dragover'].forEach(ev => zona.addEventListener(ev, e => {
      e.preventDefault(); zona.classList.add('encima');
    }));
    ['dragleave', 'drop'].forEach(ev => zona.addEventListener(ev, e => {
      e.preventDefault(); zona.classList.remove('encima');
    }));
    zona.addEventListener('drop', e => {
      const f = e.dataTransfer.files[0];
      if (f) cargar(f);
    });
  }

  async function cargar(file) {
    A.$('#resultado').innerHTML = `<div class="tarjeta"><div class="vacio">Leyendo ${A.esc(file.name)}…</div></div>`;
    try {
      lectura = await Lector3MF.leer3mf(file);
      datos.gramosBandeja = null;
      datos.horasBandeja = lectura.tiempoDeNombre;
      pintarResultado();
    } catch (e) {
      console.error(e);
      A.$('#resultado').innerHTML = `<div class="tarjeta aviso" style="border-color:var(--malo)">
        <b>No pude leer el archivo.</b> ${A.esc(e.message || e)}</div>`;
    }
  }

  function pintarResultado() {
    const L = lectura, p = L.pieza;
    const capa = L.alturaCapa;

    let h = `<div class="tarjeta"><h2>Lo que dice el archivo</h2>
      <div class="rejilla">
        <div class="dato"><div class="k">Piezas en la bandeja</div><div class="v">${L.piezas}</div></div>
        ${p ? `<div class="dato"><div class="k">Medida de la pieza</div>
          <div class="v" style="font-size:16px">${p.medidas[0]} × ${p.medidas[1]} × ${p.medidas[2]}</div>
          <div class="n">mm</div></div>` : ''}
        ${p ? `<div class="dato"><div class="k">Material de la pieza</div><div class="v">${p.volumen} cm³</div>
          <div class="n">${p.cuerpos} cuerpo${p.cuerpos > 1 ? 's' : ''}${p.volumenNegativo ? ` · ${p.volumenNegativo} cm³ de hueco` : ''}</div></div>` : ''}
        ${capa ? `<div class="dato"><div class="k">Altura de capa</div><div class="v">${capa} mm</div></div>` : ''}
        ${L.pausas ? `<div class="dato"><div class="k">Pausa programada</div><div class="v">sí</div>
          <div class="n">${L.zPausa ? 'en z = ' + L.zPausa + ' mm' : ''}</div></div>` : ''}
      </div>
      ${p && p.volumenNegativo ? `<p style="font-size:12.5px;color:var(--pizarra);margin:12px 0 0">
        Trae un hueco de ${p.volumenNegativo} cm³ — si es un llavero NFC, ese es el bolsillo del chip.</p>` : ''}
    </div>

    <div class="tarjeta"><h2>Lo que el archivo no puede decir</h2>
      <p style="font-size:13.5px;color:var(--pizarra);margin:0 0 14px">
        Los gramos y el tiempo <b>no están en un 3MF de proyecto</b>: dependen del relleno, las
        paredes y el perfil. Y no se pueden deducir de la geometría — medido contra tus 11
        productos con datos reales, el caudal va de <b>14 a 43 g/h</b> según la forma, y estimarlo
        se equivoca un 42% en promedio. Así que se lamina <b>una vez</b> en Creality Print y se
        copian los dos números de la bandeja completa.</p>
      <div class="formulario">
        ${A.campo('c-gramos', 'Gramos de la bandeja', datos.gramosBandeja == null ? '' : datos.gramosBandeja,
                  { tipo: 'number', paso: '0.1', unidad: 'g', nota: `las ${L.piezas} piezas` })}
        ${A.campo('c-horas', 'Horas de la bandeja', datos.horasBandeja == null ? '' : datos.horasBandeja,
                  { tipo: 'number', paso: '0.01', unidad: 'h', nota: L.tiempoDeNombre ? 'salió del nombre del archivo' : '4h54m53s = 4,92' })}
        ${A.campo('c-cant', 'Cuántas piezas necesita el cliente', datos.cantidad, { tipo: 'number' })}
      </div>
      <button class="btn primario" onclick="Vistas.cotizar.calcular()">Calcular</button>
    </div>
    <div id="cotizacion"></div>`;

    A.$('#resultado').innerHTML = h;
    if (datos.gramosBandeja != null && datos.horasBandeja != null) calcular();
  }

  function calcular() {
    const v = i => { const e = document.getElementById(i); return e ? e.value : ''; };
    datos.gramosBandeja = A.num(v('c-gramos')) || null;
    datos.horasBandeja = A.num(v('c-horas')) || null;
    datos.cantidad = Math.max(1, A.num(v('c-cant')) || 1);

    if (!datos.gramosBandeja || !datos.horasBandeja) {
      A.$('#cotizacion').innerHTML = `<div class="tarjeta aviso">
        <b>Faltan los gramos o las horas de la bandeja.</b> Sin esos dos números no hay cotización —
        y prefiero decirlo a inventarlos.</div>`;
      return;
    }

    const L = lectura;
    const porBandeja = L.piezas || 1;
    const bandejas = Math.ceil(datos.cantidad / porBandeja);
    const piezasReales = bandejas * porBandeja;
    const gramosPieza = datos.gramosBandeja / porBandeja;
    const horasPieza = datos.horasBandeja / porBandeja;

    // Un producto de mentira para reusar el motor de costos, con el mismo margen y parámetros.
    const ficha = {
      oficio: '3d', material: 'PLA', gramos: gramosPieza, horas: horasPieza,
      colores: 1, postMin: 0, extraCosto: 0, precio: null, filamentoId: null
    };
    const c = Costos.calcular(ficha);
    const precioUnit = c.sugerido;

    // Tramos: el costo fijo por bandeja pesa distinto según cuántas se hagan.
    const tramos = [10, 25, 50, 100, 200].map(n => {
      const b = Math.ceil(n / porBandeja);
      const horas = b * datos.horasBandeja;
      const costo = c.costo * b * porBandeja;
      return { n, bandejas: b, piezas: b * porBandeja, horas, costo,
               unit: Math.round(costo / (b * porBandeja) * Costos.margen(ficha, DB.params) / 100) * 100 };
    });

    const horasTotal = bandejas * datos.horasBandeja;
    const cap = DB.params.capacidadDiaH || 13;
    const dias = Math.ceil(horasTotal / cap);
    const entrega = new Date(Date.now() + dias * 86400000);

    A.$('#cotizacion').innerHTML = `
      <div class="tarjeta"><h2>Cotización · ${datos.cantidad} piezas</h2>
        <div class="rejilla" style="margin-bottom:14px">
          <div class="dato"><div class="k">Precio por unidad</div><div class="v">${A.plata(precioUnit)}</div>
            <div class="n">margen ×${c.margen}</div></div>
          <div class="dato"><div class="k">Total</div><div class="v">${A.plata(precioUnit * datos.cantidad)}</div>
            <div class="n">costo ${A.plata(c.costo * datos.cantidad)}</div></div>
          <div class="dato"><div class="k">Bandejas</div><div class="v">${bandejas}</div>
            <div class="n">${porBandeja} por bandeja${piezasReales > datos.cantidad ? ` · sobran ${piezasReales - datos.cantidad}` : ''}</div></div>
          <div class="dato"><div class="k">Tiempo de máquina</div><div class="v">${horasTotal.toFixed(1)} h</div>
            <div class="n">${dias} día${dias > 1 ? 's' : ''} a ${cap} h/día</div></div>
        </div>
        <p style="font-size:13px;color:var(--pizarra);margin:0">
          Si se parte hoy y la impresora no hace nada más, la entrega realista es el
          <b>${A.fecha(entrega.toISOString().slice(0, 10))}</b>.
          ${L.pausas ? `Ojo: la bandeja lleva <b>pausa programada</b>, así que alguien tiene que estar
          para poner los chips ${bandejas > 1 ? `<b>${bandejas} veces</b>` : 'una vez'}.` : ''}
        </p>
      </div>

      <div class="tarjeta"><h2>Dónde está la plata, por pieza</h2>
        <div class="desglose">
          ${c.lineas.map(l => `<div class="fila">
            <div class="c"><span class="punto" style="background:var(--c-${l.color})"></span>
              <span>${A.esc(l.concepto)}${l.nota ? `<span class="n">${A.esc(l.nota)}</span>` : ''}</span></div>
            <div class="m">${A.plata(l.monto)}</div></div>`).join('')}
          <div class="fila total"><div class="c"><b>Costo</b></div><div class="m">${A.plata(c.costo)}</div></div>
          <div class="fila"><div class="c">Precio sugerido</div><div class="m" style="color:var(--pizarra)">${A.plata(precioUnit)}</div></div>
          <div class="fila"><div class="c">Utilidad por pieza</div><div class="m" style="color:var(--ok)">${A.plata(precioUnit - c.costo)}</div></div>
        </div>
        <p style="font-size:12.5px;color:var(--apagado);margin:10px 0 0">
          ${gramosPieza.toFixed(1)} g y ${(horasPieza * 60).toFixed(0)} min por pieza, repartiendo la
          bandeja de ${datos.gramosBandeja} g y ${datos.horasBandeja} h entre ${porBandeja}.</p>
      </div>

      <div class="tarjeta"><h2>Por cantidad</h2>
        <table><thead><tr><th class="num">Piezas</th><th class="num">Bandejas</th>
          <th class="num">Horas</th><th class="num">Unitario</th><th class="num">Total</th></tr></thead><tbody>
          ${tramos.map(t => `<tr${t.n === datos.cantidad ? ' style="background:#FCFAF6;font-weight:600"' : ''}>
            <td class="num">${t.n}</td><td class="num">${t.bandejas}</td>
            <td class="num">${t.horas.toFixed(1)}</td>
            <td class="num">${A.plata(t.unit)}</td>
            <td class="num">${A.plata(t.unit * t.n)}</td></tr>`).join('')}
        </tbody></table>
        <p style="font-size:12.5px;color:var(--apagado);margin:10px 0 0">
          El unitario casi no baja con la cantidad: en impresión 3D no hay economía de escala real,
          cada pieza cuesta lo mismo de imprimir. Lo que cambia es el tiempo comprometido.</p>
      </div>

      <div class="tarjeta">
        <button class="btn primario" onclick="Vistas.cotizar.guardar()">Guardar como producto</button>
        <span style="color:var(--apagado);font-size:13px;margin-left:10px">
          Queda en el catálogo con sus gramos, horas y precio, listo para meterlo en un pedido.</span>
      </div>`;
  }

  function guardar() {
    const L = lectura;
    const porBandeja = L.piezas || 1;
    const nombre = (L.nombre || 'Pieza').replace(/\.(gcode\.)?3mf$/i, '').replace(/_/g, ' ');
    const p = Datos.agregar('productos', {
      sku: '', nombre, categoria: 'empresas', oficio: '3d', material: 'PLA',
      gramos: +(datos.gramosBandeja / porBandeja).toFixed(1),
      horas: +(datos.horasBandeja / porBandeja).toFixed(3),
      colores: 1, postMin: 0, precio: null, stock: 0, filamentoId: null, foto: '',
      descripcion: `Desde ${L.nombre}. ${porBandeja} por bandeja.` +
                   (L.pausas ? ' Lleva pausa programada para el chip.' : ''),
      archivoOrigen: L.nombre, piezasPorBandeja: porBandeja,
      extraCosto: 0, extraNota: '', activo: true
    });
    p.precio = Costos.calcular(p).sugerido;
    Datos.guardar('producto desde 3MF');
    A.aviso('Guardado en el catálogo: ' + nombre);
  }

  window.Vistas = window.Vistas || {};
  Vistas.cotizar = { pintar, calcular, guardar };
})();
