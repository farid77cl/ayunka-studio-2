/* Vista: historial de la K2. No es un monitor en vivo — se trae el historial que la
 * impresora ya guardó (de golpe con el archivo, o directo si está al alcance) y se
 * proponen los gramos y horas reales para el catálogo. Nunca se aplica solo: siempre
 * hay una tabla y un click de por medio (SUPERVISION.md, punto 4). */
(function () {
  let propuestas = [];
  let resumen = null;

  function pintar() {
    propuestas = []; resumen = null;
    A.$('#contenido').innerHTML = `
      <div class="cabecera"><h1>Historial de la K2</h1>
        <span class="sub">gramos y horas reales, de la propia impresora</span></div>

      <div class="tarjeta">
        <p style="font-size:13.5px;color:var(--pizarra);margin:0 0 14px">
          Trae el historial de dos formas — el resultado es el mismo:</p>
        <div class="row" style="margin-bottom:10px">
          <input id="imp-ip" class="btn" style="min-width:220px" placeholder="IP de la K2, ej. 192.168.100.90:4408">
          <button class="btn" onclick="Vistas.impresora.traerDeIp()">Traer de la impresora</button>
        </div>
        <div id="imp-zona" class="soltar">
          <div class="t">Suelta acá el historial (JSON)</div>
          <div class="s">de Moonraker, o el resumen ya hecho — o haz click para buscarlo</div>
          <input type="file" id="imp-archivo" accept=".json" hidden>
        </div>
        <p style="font-size:12px;color:var(--apagado);margin:10px 0 0">
          Una página servida por <code>https</code> no puede llamar al <code>http</code> de
          la K2 — el navegador lo bloquea, no es un error de la app. Si "Traer de la
          impresora" falla, es exactamente por eso: suelta el archivo en su lugar.</p>
      </div>
      <div id="imp-resultado"></div>`;

    const zona = A.$('#imp-zona'), input = A.$('#imp-archivo');
    zona.onclick = () => input.click();
    input.onchange = e => e.target.files[0] && cargarArchivo(e.target.files[0]);
    ['dragenter', 'dragover'].forEach(ev => zona.addEventListener(ev, e => { e.preventDefault(); zona.classList.add('encima'); }));
    ['dragleave', 'drop'].forEach(ev => zona.addEventListener(ev, e => { e.preventDefault(); zona.classList.remove('encima'); }));
    zona.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) cargarArchivo(f); });
  }

  async function traerDeIp() {
    const ip = (A.$('#imp-ip').value || '').trim();
    if (!ip) { A.aviso('Pon la IP de la impresora'); return; }
    A.aviso('Consultando la K2…');
    try {
      const r = await fetch('http://' + ip + '/server/history/list?limit=500');
      if (!r.ok) throw new Error('la impresora respondió ' + r.status);
      procesar(await r.json());
    } catch (e) {
      A.$('#imp-resultado').innerHTML = `<div class="tarjeta aviso" style="border-color:var(--malo)">
        <b>No se pudo conectar con la impresora.</b> ${A.esc(e.message || String(e))}<br>
        <span style="font-size:12.5px">Es lo esperado si esta página va por <code>https</code> — el
        navegador bloquea llamar al <code>http</code> de la K2. Suelta el archivo del historial en
        su lugar.</span></div>`;
    }
  }

  function cargarArchivo(file) {
    A.$('#imp-resultado').innerHTML = `<div class="tarjeta"><div class="vacio">Leyendo ${A.esc(file.name)}…</div></div>`;
    const fr = new FileReader();
    fr.onload = () => {
      try { procesar(JSON.parse(fr.result)); }
      catch (e) {
        A.$('#imp-resultado').innerHTML = `<div class="tarjeta aviso" style="border-color:var(--malo)">
          <b>No pude leer el archivo.</b> ${A.esc(e.message || String(e))}</div>`;
      }
    };
    fr.readAsText(file);
  }

  function procesar(datosCrudos) {
    let n;
    try { n = Impresora.normalizar(datosCrudos); }
    catch (e) {
      A.$('#imp-resultado').innerHTML = `<div class="tarjeta aviso" style="border-color:var(--malo)">
        <b>${A.esc(e.message || String(e))}</b></div>`;
      return;
    }
    resumen = n.resumen;
    propuestas = Impresora.emparejar(n.piezas, Datos.activos('productos'));
    pintarResultado();
  }

  function pintarResultado() {
    const r = resumen;
    const tasaAjustes = N(DB.params.tasaFalla, 0.10);
    const difiereTasa = Math.abs(r.tasaFalloMaterial - tasaAjustes) > 0.005;
    const emparejadas = propuestas.filter(p => p.productoId);
    const porArchivo = emparejadas.filter(p => p.origenDatos === 'por archivo');
    const porParecido = emparejadas.filter(p => p.origenDatos === 'por parecido');
    const sinDueno = propuestas.filter(p => !p.productoId);

    A.$('#imp-resultado').innerHTML = `
      <div class="tarjeta"><h2>Lo que dice el historial</h2>
        <div class="rejilla">
          <div class="dato"><div class="k">Trabajos</div><div class="v">${r.trabajos}</div></div>
          <div class="dato"><div class="k">Horas impresas</div><div class="v">${r.horasImpresas.toFixed(1)}</div></div>
          <div class="dato"><div class="k">Material impreso</div><div class="v">${(r.gramosImpresos / 1000).toFixed(1)}</div><div class="n">kg</div></div>
          <div class="dato"><div class="k">Material perdido</div><div class="v">${r.gramosPerdidos}</div><div class="n">g en trabajos fallidos</div></div>
          <div class="dato ${difiereTasa ? 'destaca' : ''}"><div class="k">Tasa de fallo real</div>
            <div class="v">${(r.tasaFalloMaterial * 100).toFixed(1)}%</div>
            <div class="n">Ajustes dice ${(tasaAjustes * 100).toFixed(0)}%</div></div>
        </div>
        ${difiereTasa ? `<div class="row" style="margin-top:12px">
          <button class="btn" onclick="Vistas.impresora.usarTasaReal()">Usar ${(r.tasaFalloMaterial * 100).toFixed(1)}% en Ajustes</button>
        </div>` : ''}
      </div>

      <div class="tarjeta"><h2>Piezas que se pueden actualizar · ${porArchivo.length}</h2>
        <p style="font-size:13px;color:var(--pizarra);margin:0 0 12px">
          Emparejadas por el nombre exacto del archivo de origen del producto. Confianza alta.</p>
        ${pintarGrupo(porArchivo, 'por archivo', true)}
      </div>

      ${porParecido.length ? `<div class="tarjeta"><h2>Parecidas, revisar antes · ${porParecido.length}</h2>
        <p style="font-size:13px;color:var(--pizarra);margin:0 0 12px">
          El nombre del archivo se parece al del producto, pero no hay un origen exacto guardado.
          Revisa una por una antes de aplicar.</p>
        ${pintarGrupo(porParecido, 'por parecido', false)}
      </div>` : ''}

      ${sinDueno.length ? `<div class="tarjeta"><h2>Sin producto en el catálogo · ${sinDueno.length}</h2>
        <p style="font-size:13px;color:var(--apagado);margin:0">
          Salieron de la K2 pero no calzan con ningún producto activo — puede ser una prueba,
          un trabajo de un cliente, o un producto que todavía no está cargado.</p>
      </div>` : ''}`;
  }

  // Un grupo (por archivo o por parecido), separado en "se completan" / "cambian un valor
  // que ya estaba" / "sin cambios reales" — nunca mezclados (SUPERVISION.md, 2-sep).
  function pintarGrupo(lista, origen, conBoton) {
    if (!lista.length) return '<p style="color:var(--apagado);font-size:13px">Ninguna.</p>';
    const blanco = lista.filter(p => p.enBlanco);
    const cambia = lista.filter(p => !p.enBlanco && p.cambiaReal);
    const resto = lista.filter(p => !p.enBlanco && !p.cambiaReal);

    const partes = [];
    if (blanco.length) partes.push(`<h3 style="font-size:14px;margin:14px 0 8px">Se completan · ${blanco.length}</h3>${tablaPropuestas(blanco, true)}`);
    if (cambia.length) partes.push(`<h3 style="font-size:14px;margin:14px 0 8px">Cambian un valor que ya estaba · ${cambia.length}</h3>
      <p style="font-size:12px;color:var(--apagado);margin:0 0 8px">Manda la máquina, pero antes de aplicar se ve qué cambia.</p>
      ${tablaPropuestas(cambia, true, true)}`);
    if (resto.length) partes.push(`<p style="font-size:12px;color:var(--apagado);margin:14px 0 0">
      ${resto.length} más ya tienen estos mismos datos — sin cambios reales.</p>`);

    if (conBoton) {
      const detalle = [blanco.length && `${blanco.length} se completan`, cambia.length && `${cambia.length} cambian`, resto.length && `${resto.length} sin cambios`]
        .filter(Boolean).join(', ');
      partes.push(`<div class="row" style="margin-top:12px">
        <button class="btn primario" onclick="Vistas.impresora.aplicarTodas('${origen}')">Aplicar las ${lista.length}${detalle ? ' (' + detalle + ')' : ''}</button>
      </div>`);
    }
    return partes.join('');
  }

  function tablaPropuestas(lista, conAplicar, conAntes) {
    if (!lista.length) return '<p style="color:var(--apagado);font-size:13px">Ninguna.</p>';
    return `<table><thead><tr>
      <th>Producto</th><th>Archivo</th><th class="num">Veces</th>
      ${conAntes ? '<th class="num">Tenía</th>' : ''}
      <th class="num">Gramos reales</th><th class="num">Horas reales</th><th></th>
    </tr></thead><tbody>
      ${lista.map(p => `<tr>
        <td><b>${A.esc(p.productoSku || '')}</b> ${A.esc(p.productoNombre || '')}</td>
        <td style="color:var(--apagado);font-size:12px">${A.esc(p.archivo)}</td>
        <td class="num">${p.veces}</td>
        ${conAntes ? `<td class="num" style="color:var(--apagado)">${p.gramosAntes} g / ${p.horasAntes} h</td>` : ''}
        <td class="num">${p.gramosReales}</td>
        <td class="num">${p.horasReales}</td>
        <td>${conAplicar ? `<button class="btn chico" onclick="Vistas.impresora.aplicarUna('${A.esc(p.productoId)}')">Aplicar</button>` : ''}</td>
      </tr>`).join('')}
    </tbody></table>`;
  }

  function N(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }

  function aplicarUna(productoId) {
    const prop = propuestas.find(p => p.productoId === productoId);
    if (!prop) return;
    aplicar([prop]);
  }

  function aplicarTodas(origen) {
    aplicar(propuestas.filter(p => p.productoId && p.origenDatos === origen));
  }

  function aplicar(lista) {
    if (!lista.length) return;
    let n = 0;
    for (const prop of lista) {
      const prod = Datos.obtener('productos', prop.productoId);
      if (!prod) continue;
      // Si de verdad estaba cambiando un valor que alguien ya había puesto, queda guardado
      // para poder volver atrás — no se pisa en silencio (SUPERVISION.md, 2-sep).
      if (prop.cambiaReal) prod.datosAnteriores = { gramos: prod.gramos, horas: prod.horas };
      prod.gramos = prop.gramosReales;
      prod.horas = prop.horasReales;
      prod.origenDatos = 'historial-k2';
      n++;
    }
    Datos.guardar('gramos y horas del historial de la K2');
    A.aviso(n + ' producto(s) actualizado(s) con datos reales');
    pintarResultado(); // sin esto los totales de arriba quedan viejos hasta cambiar de vista
  }

  function usarTasaReal() {
    if (!resumen) return;
    DB.params.tasaFalla = resumen.tasaFalloMaterial;
    Datos.guardar('tasa de fallas real desde el historial de la K2');
    A.aviso('Tasa de fallas puesta en ' + (resumen.tasaFalloMaterial * 100).toFixed(1) + '%');
    pintarResultado();
  }

  window.Vistas = window.Vistas || {};
  Vistas.impresora = { pintar, traerDeIp, aplicarUna, aplicarTodas, usarTasaReal };
})();
