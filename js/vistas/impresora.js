/* Vista: historial de la K2. No es un monitor en vivo — se trae el historial que la
 * impresora ya guardó (de golpe con el archivo, o directo si está al alcance) y se
 * proponen los gramos y horas reales para el catálogo. Nunca se aplica solo: siempre
 * hay una tabla y un click de por medio (SUPERVISION.md, punto 4). */
(function () {
  let propuestas = [];
  let resumen = null;
  const CLAVE_IP = 'ayunka2-imp-ip';

  // Revisión del 3-sep: en https, fetch('http://...') no rechaza -- se cuelga para
  // siempre, y el catch de traerDeIp() nunca corre. Farid apretó el botón y no pasó nada
  // durante 33 s. Por eso esto se decide ANTES de intentar nada, no adentro de un catch.
  const esHttps = () => (typeof location !== 'undefined') && location.protocol === 'https:';

  function pintar() {
    propuestas = []; resumen = null;
    let ipGuardada = '';
    try { ipGuardada = localStorage.getItem(CLAVE_IP) || ''; } catch (e) {}

    A.$('#contenido').innerHTML = `
      <div class="cabecera"><h1>Historial de la K2</h1>
        <span class="sub">gramos y horas reales, de la propia impresora</span></div>

      <div class="tarjeta">
        <p style="font-size:13.5px;color:var(--pizarra);margin:0 0 14px">
          Trae el historial de dos formas — el resultado es el mismo:</p>
        ${esHttps() ? `<div class="tarjeta aviso" style="margin-bottom:10px">
          <b>Esta página va por https — no puede llamar al http de la K2.</b> El navegador
          lo bloquea siempre, no es un error de la app. Dos salidas reales:
          <b>suelta el archivo del historial</b> abajo, o <b>abre esta app por http en el
          PC</b> (en la misma red que la impresora) para usar "Traer de la impresora".</div>` : ''}
        <div class="row" style="margin-bottom:10px">
          <input id="imp-ip" class="btn" style="min-width:220px" placeholder="IP de la K2, ej. 192.168.100.90:4408" value="${A.esc(ipGuardada)}">
          <button class="btn" onclick="Vistas.impresora.traerDeIp()">Traer de la impresora</button>
        </div>
        <div id="imp-zona" class="soltar">
          <div class="t">Suelta acá el historial (JSON)</div>
          <div class="s">de Moonraker, o el resumen ya hecho — o haz click para buscarlo</div>
          <input type="file" id="imp-archivo" accept=".json" hidden>
        </div>
      </div>
      <div id="imp-resultado"></div>`;

    const ipEl = A.$('#imp-ip');
    ipEl.addEventListener('input', () => { try { localStorage.setItem(CLAVE_IP, ipEl.value.trim()); } catch (e) {} });

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
    try { localStorage.setItem(CLAVE_IP, ip); } catch (e) {}

    if (esHttps()) {
      A.$('#imp-resultado').innerHTML = `<div class="tarjeta aviso" style="border-color:var(--malo)">
        <b>No lo intento: esta página va por https.</b> El navegador bloquea la llamada al
        http de la K2 siempre — reintentarlo no cambia nada. Suelta el archivo del historial,
        o abre esta app por http en un equipo de la misma red que la impresora.</div>`;
      return;
    }

    A.aviso('Consultando la K2…');
    // Un fetch a la red local puede quedarse colgado para siempre si no hay nadie del otro
    // lado (Revisión del 3-sep). Con esto, a los 8 s se corta solo y avisa, en vez de
    // dejar el botón mudo.
    const control = new AbortController();
    const corte = setTimeout(() => control.abort(), 8000);
    try {
      const r = await fetch('http://' + ip + '/server/history/list?limit=500', { signal: control.signal });
      if (!r.ok) throw new Error('la impresora respondió ' + r.status);
      procesar(await r.json());
    } catch (e) {
      const esCorte = e.name === 'AbortError';
      A.$('#imp-resultado').innerHTML = `<div class="tarjeta aviso" style="border-color:var(--malo)">
        <b>No se pudo conectar con la impresora.</b> ${esCorte ? 'No respondió en 8 segundos.' : A.esc(e.message || String(e))}<br>
        <span style="font-size:12.5px">Revisa que la IP sea la de la red 192.168.100.x (no la
        192.168.1.x del resto de la casa) y que la K2 esté encendida. Si nada de eso ayuda,
        suelta el archivo del historial en su lugar.</span></div>`;
    } finally {
      clearTimeout(corte);
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
    const hayDosTasas = Math.abs(r.tasaFalloMaterial - r.tasaFalloReal) > 0.0005;
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
          <div class="dato ${difiereTasa ? 'destaca' : ''}"><div class="k">Tasa de fallo</div>
            <div class="v">${(r.tasaFalloMaterial * 100).toFixed(1)}%</div>
            <div class="n">contando todo · Ajustes dice ${(tasaAjustes * 100).toFixed(0)}%</div></div>
        </div>
        ${hayDosTasas ? `<p style="font-size:12.5px;color:var(--pizarra);margin:12px 0 0">
          <b>${(r.tasaFalloMaterial * 100).toFixed(1)}% contando todo</b> · <b>${(r.tasaFalloReal * 100).toFixed(1)}% sin los
          cancelados en los primeros 10 minutos</b> — esos casi siempre son una decisión
          (se vio que iba mal, se cambió de idea), no una falla real. Elige con cuál te
          quedas: cambia todos los costos 3D.</p>
        <div class="row" style="margin-top:10px">
          <button class="btn" onclick="Vistas.impresora.usarTasa('cruda')">Usar ${(r.tasaFalloMaterial * 100).toFixed(1)}% (contando todo)</button>
          <button class="btn" onclick="Vistas.impresora.usarTasa('real')">Usar ${(r.tasaFalloReal * 100).toFixed(1)}% (sin los cancelados temprano)</button>
        </div>` : (difiereTasa ? `<div class="row" style="margin-top:12px">
          <button class="btn" onclick="Vistas.impresora.usarTasa('cruda')">Usar ${(r.tasaFalloMaterial * 100).toFixed(1)}% en Ajustes</button>
        </div>` : '')}
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
      // Si el valor que trae el historial ya es el que está guardado, no hay nada que
      // aplicar -- aplicar la fila y después "Aplicar todas" no debe pisar datosAnteriores
      // con el valor que la propia app acaba de escribir (bug encontrado en la revisión
      // del 2-sep de v2.6.0). `prop.cambiaReal` se calculó al soltar el archivo y queda
      // viejo después de la primera aplicación -- por eso se recalcula aquí, contra el
      // valor ACTUAL del producto, no contra el que tenía cuando se leyó el historial.
      if (prod.gramos === prop.gramosReales && prod.horas === prop.horasReales) continue;
      const eraBlanco = !prod.gramos && !prod.horas;
      const cambioDeVerdad = !eraBlanco &&
        (Math.abs(N(prod.gramos, 0) - prop.gramosReales) > Impresora.DIF_GRAMOS ||
         Math.abs(N(prod.horas, 0) - prop.horasReales) > Impresora.DIF_HORAS);
      // Solo se guarda la PRIMERA vez que se pisa un valor real -- si ya había uno
      // guardado, no se toca, o dos aplicaciones seguidas terminan guardando el valor
      // nuevo en vez del original.
      if (cambioDeVerdad && !prod.datosAnteriores) {
        prod.datosAnteriores = { gramos: prod.gramos, horas: prod.horas };
      }
      prod.gramos = prop.gramosReales;
      prod.horas = prop.horasReales;
      prod.origenDatos = 'historial-k2';
      n++;
    }
    Datos.guardar('gramos y horas del historial de la K2');
    A.aviso(n + ' producto(s) actualizado(s) con datos reales');
    pintarResultado(); // sin esto los totales de arriba quedan viejos hasta cambiar de vista
  }

  // `cual`: 'cruda' (cuenta todo lo que no completó) o 'real' (sin los cancelados antes de
  // los 10 min). Nunca se elige un número solo por el código -- la persona decide.
  function usarTasa(cual) {
    if (!resumen) return;
    const tasa = cual === 'real' ? resumen.tasaFalloReal : resumen.tasaFalloMaterial;
    DB.params.tasaFalla = tasa;
    Datos.guardar('tasa de fallas desde el historial de la K2 (' + cual + ')');
    A.aviso('Tasa de fallas puesta en ' + (tasa * 100).toFixed(1) + '%');
    pintarResultado();
  }

  window.Vistas = window.Vistas || {};
  Vistas.impresora = { pintar, traerDeIp, aplicarUna, aplicarTodas, usarTasa };
})();
