/* Vista: Personalizados 3D. Un preset por ahora (llavero publicitario) -- el resto de la
 * librería de figuras/tipografías de la v1 queda como trabajo futuro explícito. */
(function () {
  let proyecto = null, compilado = null, copiasPedidas = 1;

  function pintar() {
    proyecto = null; compilado = null;
    A.$('#contenido').innerHTML = `
      <div class="cabecera"><h1>Personalizados 3D</h1></div>
      <div class="tarjeta">
        <div class="rejilla">
          ${D3DBuild.PRESETS_INFO.map(p => `<button type="button" class="btn primario" onclick="Vistas.disenos3d.elegir('${p.id}')">${A.esc(p.label)}</button>`).join('')}
        </div>
      </div>
      <div id="d3d-resultado"></div>`;
  }

  function elegir(id) {
    const fab = D3DBuild.PRESETS[id];
    if (!fab) return;
    proyecto = fab();
    compilado = null;
    pintarForm();
  }

  function pintarForm() {
    const textos = (proyecto.capas || []).filter(c => c.tipo === 'texto');
    A.$('#d3d-resultado').innerHTML = `
      <div class="tarjeta"><h2>${A.esc(proyecto.nombre)}</h2>
        <div class="formulario">
          ${textos.map((c, i) => A.campo('d3d-txt-' + i, 'Texto ' + (i + 1), c.txt, {})).join('')}
        </div>
        <label style="display:flex;align-items:center;gap:8px;font-size:13.5px;margin:10px 0">
          <input type="checkbox" id="d3d-nfc-activa" ${proyecto.nfc.activa ? 'checked' : ''}>
          Lleva bolsillo para chip NFC</label>
        <button class="btn primario" onclick="Vistas.disenos3d.generar()">Generar</button>
        <button class="btn sutil" onclick="Vistas.disenos3d.pintar()">Elegir otro</button>
      </div>
      <div id="d3d-generado"></div>`;
  }

  async function generar() {
    const textos = (proyecto.capas || []).filter(c => c.tipo === 'texto');
    textos.forEach((c, i) => { const e = document.getElementById('d3d-txt-' + i); if (e) c.txt = e.value; });
    proyecto.nfc.activa = !!(document.getElementById('d3d-nfc-activa') || {}).checked;
    A.$('#d3d-generado').innerHTML = `<div class="tarjeta"><div class="vacio">Generando…</div></div>`;
    try {
      compilado = await D3DBuild.compilar(proyecto);
      pintarGenerado();
    } catch (e) {
      A.$('#d3d-generado').innerHTML = `<div class="tarjeta aviso"><b>No se pudo generar.</b> ${A.esc(e.message || String(e))}</div>`;
    }
  }

  function pintarGenerado() {
    const c = compilado;
    A.$('#d3d-generado').innerHTML = `
      <div class="tarjeta"><h2>Listo</h2>
        <div class="rejilla">
          <div class="dato"><div class="k">Medida</div><div class="v" style="font-size:18px">${c.dims.ancho.toFixed(0)} × ${c.dims.alto.toFixed(0)} × ${c.dims.espesor.toFixed(1)}</div><div class="n">mm</div></div>
          <div class="dato"><div class="k">Sólidos</div><div class="v">${c.solidos.length}</div></div>
        </div>
        ${c.avisos && c.avisos.length ? `<div class="tarjeta aviso" style="margin-top:12px">${c.avisos.map(a => `<p style="margin:4px 0;font-size:13px">${A.esc(a)}</p>`).join('')}</div>` : ''}
        <div class="formulario" style="margin-top:10px">${A.campo('d3d-copias', 'Copias en la bandeja', copiasPedidas, { tipo: 'number', unidad: 'piezas' })}</div>
        <div class="row" style="margin-top:14px"><button class="btn primario" onclick="Vistas.disenos3d.descargar()">Descargar 3MF</button></div>
        <div class="tarjeta" style="margin-top:12px">
          <h2>Verificar el G-code ya cortado</h2>
          <p style="font-size:12.5px;color:var(--apagado);margin:0 0 10px">Después de cortarlo en Creality Print, sube el .gcode acá.</p>
          <input type="file" id="d3d-gcode-archivo" accept=".gcode" hidden>
          <button class="btn" onclick="document.getElementById('d3d-gcode-archivo').click()">Elegir G-code</button>
          <div id="d3d-gcode-resultado"></div>
        </div>
      </div>`;
    const gcodeInput = document.getElementById('d3d-gcode-archivo');
    if (gcodeInput) gcodeInput.onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      const texto = await f.text();
      const bolsillo = compilado.solidos.find(s => s.negativo);
      const opts = bolsillo ? { zBolsilloDesde: bolsillo.z0, zBolsilloHasta: bolsillo.z0 + bolsillo.alt } : {};
      const r = VerificadorGcode.verificar(texto, opts);
      A.$('#d3d-gcode-resultado').innerHTML = r.ok
        ? `<div class="tarjeta" style="border-color:var(--ok);margin-top:10px"><b style="color:var(--ok)">Pasa la compuerta 7.</b></div>`
        : `<div class="tarjeta aviso" style="margin-top:10px"><b>${r.hallazgos.length} problema(s):</b><ul style="margin:6px 0 0;padding-left:18px">${r.hallazgos.map(h => `<li style="font-size:13px">${A.esc(h)}</li>`).join('')}</ul></div>`;
    };
  }

  function descargarBlob(datos, nombre) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([datos]));
    a.download = nombre;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  function descargar() {
    if (!compilado) return;
    const copiasEl = document.getElementById('d3d-copias');
    const pedidas = copiasEl ? Math.max(1, A.num(copiasEl.value) || 1) : 1;
    copiasPedidas = pedidas;
    let posiciones = null;
    if (pedidas > 1) {
      posiciones = D3D3MF.posicionesBandeja(compilado.dims.ancho, compilado.dims.alto);
      if (posiciones.length < pedidas) A.aviso('En la bandeja caben ' + posiciones.length + ' de las ' + pedidas + ' pedidas.', 'error');
      posiciones = posiciones.slice(0, pedidas);
    }
    const r = D3D3MF.exportar3MF(compilado, proyecto.nombre, posiciones ? { copias: posiciones } : {});
    if (!r) { A.aviso('No hay nada que exportar', 'error'); return; }
    if (r.pausaZ != null) {
      const v = D3D3MF.verificarNFC(r);
      if (!v.ok) { A.aviso('3MF descargado, pero el bolsillo no quedó bien: ' + v.problemas.join(' '), 'error'); descargarBlob(r.datos, r.nombre); return; }
    }
    descargarBlob(r.datos, r.nombre);
    A.aviso('3MF descargado: ' + r.objetos + ' pieza(s)' + (r.copias > 1 ? ' · ' + r.copias + ' copias' : '') + (r.pausaZ != null ? ' · bolsillo NFC con pausa en z=' + r.pausaZ : ''));
  }

  window.Vistas = window.Vistas || {};
  Vistas.disenos3d = { pintar, elegir, generar, descargar, _proyectoActual: () => proyecto, _compiladoActual: () => compilado };
})();
