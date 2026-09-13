/* Vista: Perfiles. Sube un 3MF, se mide en un Worker, se eligen metas de taller y
 * material, y se descarga un perfil .creality_printer real para la K2. La lógica
 * (PerfilGeometria/PerfilReglas/PerfilImprimibilidad/PerfilExport/PerfilDescarga) es la
 * misma, portada tal cual, de negocio/ayunka-studio/js/perfil-*.js -- acá solo se
 * reescribió la presentación con el sistema visual nuevo. */
(function () {
  const METAS = [
    { clave: 'resolucion', rotulo: 'Resolución' }, { clave: 'terminacion_pared', rotulo: 'Terminación de pared' },
    { clave: 'resistencia', rotulo: 'Resistencia' }, { clave: 'rapidez', rotulo: 'Rapidez' }
  ];
  const AJUSTES = {
    layer_height: { rotulo: 'Altura de capa', unidad: 'mm' }, initial_layer_print_height: { rotulo: 'Altura de la primera capa', unidad: 'mm' },
    line_width: { rotulo: 'Ancho de línea', unidad: 'mm' }, top_surface_line_width: { rotulo: 'Ancho de línea de la cara de arriba', unidad: 'mm' },
    wall_generator: { rotulo: 'Trazado de pared', unidad: '' }, outer_wall_speed: { rotulo: 'Velocidad de la pared de afuera', unidad: 'mm/s' },
    top_surface_speed: { rotulo: 'Velocidad de la cara de arriba', unidad: 'mm/s' }, ironing_type: { rotulo: 'Planchado', unidad: '' },
    ironing_flow: { rotulo: 'Flujo de planchado', unidad: '' }, ironing_speed: { rotulo: 'Velocidad de planchado', unidad: 'mm/s' },
    wall_loops: { rotulo: 'Cantidad de paredes', unidad: '' }, sparse_infill_density: { rotulo: 'Relleno', unidad: '' },
    top_shell_layers: { rotulo: 'Capas sólidas de arriba', unidad: '' }, bottom_shell_layers: { rotulo: 'Capas sólidas de abajo', unidad: '' },
    inner_wall_speed: { rotulo: 'Velocidad de las paredes de adentro', unidad: 'mm/s' }, internal_solid_infill_speed: { rotulo: 'Velocidad del relleno sólido', unidad: 'mm/s' },
    initial_layer_speed: { rotulo: 'Velocidad de la primera capa', unidad: 'mm/s' }, initial_layer_infill_speed: { rotulo: 'Velocidad del relleno de la primera capa', unidad: 'mm/s' }
  };
  const MENSAJES = {
    zip_corrupto: 'Este archivo no se pudo abrir como 3MF. Puede estar dañado.',
    falta_modelo: 'Este ZIP no tiene la pieza adentro (falta 3dmodel.model). ¿Es realmente un 3MF?',
    unidad_desconocida: 'La pieza usa una unidad de medida que no reconozco. Exporta en mm, pulgadas o cm.',
    timeout: 'El análisis está tardando demasiado -- puede que el archivo tenga un problema.'
  };

  let estado = 'idle', resultado = null, causaError = null, nombreArchivo = '', etapa = '';
  let veredicto = null, metasActivas = new Set(), material = 'PLA', balances = new Map(), correcciones = new Map(), propuesta = null;

  function materialesDisponibles() { return ['PLA', 'PETG']; }

  function limpiar() {
    metasActivas = new Set(); balances = new Map(); correcciones = new Map(); propuesta = null; material = materialesDisponibles()[0];
  }

  function recalcular() {
    if (!metasActivas.size) { propuesta = null; return; }
    propuesta = PerfilReglas.evaluar(metasActivas, material, resultado || {}, balances, correcciones);
  }

  function pintar() {
    A.$('#contenido').innerHTML = `<div class="cabecera"><h1>Perfiles</h1><span class="sub">de un 3MF a un perfil real para la K2</span></div><div id="perfil-caja">${cuerpo()}</div>`;
    wire();
  }

  function wire() {
    const caja = document.getElementById('perfil-caja');
    if (!caja) return;
    caja.ondragenter = caja.ondragover = e => { e.preventDefault(); const dz = document.getElementById('perfil-dz'); if (dz) dz.classList.add('encima'); };
    caja.ondragleave = () => { const dz = document.getElementById('perfil-dz'); if (dz) dz.classList.remove('encima'); };
    caja.ondrop = e => { e.preventDefault(); const dz = document.getElementById('perfil-dz'); if (dz) dz.classList.remove('encima'); const f = e.dataTransfer.files[0]; if (f) arrancar(f); };
    const materialEl = document.getElementById('perfil-material');
    if (materialEl) materialEl.onchange = e => { material = e.target.value; recalcular(); repintarCaja(); };
  }

  function repintarCaja() { const c = document.getElementById('perfil-caja'); if (c) { c.innerHTML = cuerpo(); wire(); } }

  function arrancar(file) {
    nombreArchivo = file.name || '';
    if (!/\.3mf$/i.test(nombreArchivo)) { causaError = 'falta_modelo'; estado = 'error'; repintarCaja(); return; }
    estado = 'leyendo'; etapa = 'leyendo'; repintarCaja();
    PerfilGeometria.analizar(file, { onProgreso: e => { etapa = e; repintarCaja(); } }).then(res => {
      resultado = res;
      veredicto = (window.PerfilImprimibilidad && PerfilImprimibilidad.evaluar(res)) || null;
      estado = res.aviso ? 'aviso' : 'listo';
      limpiar();
      repintarCaja();
    }).catch(err => {
      if (err && err.causa === 'cancelado') { estado = 'idle'; repintarCaja(); return; }
      causaError = err && err.causa; estado = 'error'; repintarCaja();
    });
  }

  function cuerpo() {
    if (estado === 'idle') return `
      <div class="tarjeta"><div id="perfil-dz" class="soltar">
        <div class="t">Suelta aquí un 3MF</div><div class="s">o elige el archivo -- se lee en el momento, sin subir nada</div>
        <input type="file" accept=".3mf" hidden id="perfil-file" onchange="Vistas.perfiles._elegido(this)">
      </div><button class="btn primario" style="margin-top:12px" onclick="document.getElementById('perfil-file').click()">Elegir archivo 3MF</button></div>`;

    if (estado === 'leyendo') return `<div class="tarjeta"><div class="vacio"><b>Leyendo ${A.esc(nombreArchivo)}…</b>${A.esc(etapa)}</div></div>`;

    if (estado === 'error') return `<div class="tarjeta aviso"><b>${A.esc(MENSAJES[causaError] || 'No se pudo leer el archivo.')}</b>
      <div class="row" style="margin-top:10px"><button class="btn" onclick="Vistas.perfiles._otro()">Elegir otro archivo</button></div></div>`;

    // estado 'aviso' o 'listo'
    return `
      <div class="tarjeta"><h2>Lo que se midió</h2>
        <div class="rejilla">
          <div class="dato"><div class="k">Triángulos</div><div class="v">${(resultado.triangulos || 0).toLocaleString('es-CL')}</div></div>
          <div class="dato"><div class="k">Unidad</div><div class="v" style="font-size:16px">${A.esc(resultado.unidad || 'mm')}</div></div>
          ${resultado.grosorMinimo ? `<div class="dato"><div class="k">Grosor mínimo</div><div class="v" style="font-size:18px">${resultado.grosorMinimo.valor.toFixed(2)} mm</div></div>` : ''}
        </div>
        ${veredicto && veredicto.avisos && veredicto.avisos.length ? `<div class="tarjeta aviso" style="margin-top:12px">${veredicto.avisos.map(a => `<p style="margin:4px 0;font-size:13px">${A.esc(a)}</p>`).join('')}</div>` : ''}
        <button class="btn sutil" style="margin-top:10px" onclick="Vistas.perfiles._otro()">Elegir otro archivo</button>
      </div>

      <div class="tarjeta"><h2>Metas de taller</h2>
        <div class="row">
          ${METAS.map(m => `<button type="button" class="btn${metasActivas.has(m.clave) ? ' primario' : ''}" onclick="Vistas.perfiles._toggleMeta('${m.clave}')">${A.esc(m.rotulo)}</button>`).join('')}
        </div>
        <div style="margin-top:10px">${A.selector('perfil-material', 'Material', material, materialesDisponibles().map(m => ({ v: m, t: m })))}</div>
      </div>

      ${propuesta ? htmlPropuesta() : (metasActivas.size ? '' : '<div class="tarjeta"><div class="vacio"><b>Elige al menos una meta</b>para ver un perfil propuesto.</div></div>')}`;
  }

  function htmlPropuesta() {
    const claves = Object.keys(propuesta.valores);
    return `
      ${propuesta.conflictos.length ? propuesta.conflictos.map(c => `
        <div class="tarjeta"><h2>${A.esc(c.izquierda)} vs. ${A.esc(c.derecha)}</h2>
          <input type="range" min="0" max="4" value="${c.paso}" style="width:100%" onchange="Vistas.perfiles._moverBalance('${c.id}', this.value)">
          <p style="font-size:13px;color:var(--pizarra);margin:8px 0 0">${A.esc(c.porque)}</p>
        </div>`).join('') : ''}
      <div class="tarjeta"><h2>Perfil propuesto</h2>
        <table><thead><tr><th>Ajuste</th><th class="num">Valor</th></tr></thead><tbody>
          ${claves.map(clave => {
            const info = AJUSTES[clave] || { rotulo: clave, unidad: '' };
            const fuera = (propuesta.fueraDeRango || []).find(f => f.clave === clave);
            return `<tr><td>${A.esc(info.rotulo)}${propuesta.porques[clave] ? `<div style="font-size:12px;color:var(--apagado)">${A.esc(propuesta.porques[clave])}</div>` : ''}</td>
              <td class="num"><input type="text" value="${A.esc(propuesta.valores[clave])}" style="width:90px;text-align:right;border:1px solid var(--borde2);border-radius:6px;padding:4px 6px" onchange="Vistas.perfiles._editarValor('${clave}', this)">
              ${A.esc(info.unidad)}${fuera ? `<div style="font-size:11px;color:var(--terra)">${A.esc(fuera.motivo)}</div>` : ''}</td></tr>`;
          }).join('')}
        </tbody></table>
        <button class="btn primario" style="margin-top:12px" onclick="Vistas.perfiles._descargar()">Descargar perfil (.creality_printer)</button>
      </div>`;
  }

  window.Vistas = window.Vistas || {};
  Vistas.perfiles = {
    pintar,
    _elegido: input => { const f = input.files && input.files[0]; if (f) arrancar(f); },
    _otro: () => { estado = 'idle'; resultado = null; causaError = null; veredicto = null; limpiar(); repintarCaja(); },
    _toggleMeta: clave => { if (metasActivas.has(clave)) metasActivas.delete(clave); else metasActivas.add(clave); recalcular(); repintarCaja(); },
    _moverBalance: (parId, valor) => { balances.set(parId, Number(valor)); recalcular(); repintarCaja(); },
    _editarValor: (clave, input) => { correcciones.set(clave, input.value); recalcular(); repintarCaja(); },
    _descargar: () => {
      if (!propuesta) return;
      try {
        const nombre = PerfilDescarga.nombreDeArchivo(nombreArchivo, metasActivas);
        const bytes = PerfilDescarga.armarBundle(propuesta.valores, nombre);
        const blob = new Blob([bytes], { type: 'application/zip' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = nombre; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        A.aviso('Perfil descargado: ' + nombre);
      } catch (e) {
        A.aviso('No se pudo armar el perfil: ' + (e.message || e), 'error');
      }
    }
  };
})();
