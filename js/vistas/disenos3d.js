/* Vista: Personalizados 3D. De un preset (llavero, letra con nombre, letrero, caja de luz,
 * recuerdo de nacimiento…) a un archivo listo para la K2, sin abrir otra herramienta.
 *
 * El motor (D3DFormas, D3DFuentes, D3DBuild, D3D3MF) es el mismo que ya generó los 19
 * diseños que trae la semilla — se portó del repo anterior, no se reescribió (PLAN.md,
 * Fase 4-bis). Revisión del 3-sep: el motor ya sabía hacer casi todo esto (39 figuras,
 * vectorizar imágenes, relieve/grabado por capa, argolla, caja de luz…) pero la pantalla
 * solo dejaba tocar dos cajas de texto. Esta vista expone lo que ya existe — no inventa
 * nada nuevo del motor — y se queda deliberadamente afuera de portar el editor libre
 * (design3d.js, arrastrar/rotar/agregar capas sueltas): eso es un proyecto aparte.
 *
 * Los gramos y las horas NUNCA se inventan acá, igual que en Cotizar: el diseño se genera
 * y se guarda como producto sin precio, hasta que alguien lo mida imprimiendo o laminando. */
(function () {
  const N = (v, d) => (typeof v === 'number' && isFinite(v)) ? v : (d != null ? d : 0);

  let cargandoThree = null;
  function cargarThree() {
    if (window.THREE) return Promise.resolve();
    if (cargandoThree) return cargandoThree;
    cargandoThree = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
      s.onload = res;
      s.onerror = () => rej(new Error('No se pudo cargar el motor 3D (revisa la conexión)'));
      document.head.appendChild(s);
    });
    return cargandoThree;
  }

  // Qué perfil de impresión pide cada preset -- no es el generador de perfiles (eso vive
  // en perfil-reglas.js del repo anterior, sin portar), pero evita reimprimir por elegir
  // mal la altura de capa o el planchado a mano en Creality Print.
  const PERFIL_HINT = {
    llavero: 'Texto fino en relieve bajo: capa 0,16-0,20 mm, planchado en la cara de arriba.',
    'llavero-foto': 'Depende del detalle de la imagen: si el logo tiene líneas finas, capa 0,12 mm.',
    'letra-nombre': 'Pieza gruesa (35 mm): capas 0,20-0,24 mm está bien, no hace falta más fino.',
    'letrero-nombre': 'Texto cursivo grande: capa 0,16-0,20 mm, planchado en la cara de arriba.',
    'caja-luz': 'El frente difusor necesita planchado parejo para que la luz no se vea a rayas: capa 0,16 mm.',
    recuerdo: 'Detalles chicos (fecha, peso): capa 0,12-0,16 mm.'
  };

  let proyecto = null;
  let compilado = null;
  let imagenOriginal = null; // ImageData del archivo subido, para reprocesar sin pedirlo de nuevo
  let controlesImagen = { umbral: 0.5, invertir: false, detalle: 0.6, soloMayor: true };

  function pintar() {
    proyecto = null; compilado = null; imagenOriginal = null;
    const presets = D3DBuild.PRESETS_INFO.filter(p => p.id !== 'libre');
    A.$('#contenido').innerHTML = `
      <div class="cabecera"><h1>Personalizados 3D</h1>
        <span class="sub">de un nombre a un archivo listo para la K2</span></div>
      <div class="tarjeta">
        <p style="font-size:13.5px;color:var(--pizarra);margin:0 0 14px">
          Elige qué se hace. Después se ajusta la forma, la medida y los textos — el mismo
          motor que armó los ${(Datos.activos('disenos3d') || []).length} diseños que ya
          están guardados.</p>
        <div class="rejilla">
          ${presets.map(p => `<button type="button" class="preset3d" onclick="Vistas.disenos3d.elegir('${p.id}')">
            <b>${A.esc(p.label)}</b><span>${A.esc(p.desc)}</span></button>`).join('')}
        </div>
      </div>
      <div id="d3d-resultado"></div>`;
  }

  function elegir(id) {
    const fab = D3DBuild.PRESETS[id];
    if (!fab) return;
    proyecto = fab();
    compilado = null; imagenOriginal = null;
    controlesImagen = { umbral: 0.5, invertir: false, detalle: 0.6, soloMayor: true };
    pintarForm();
  }

  // Todo campo de texto editable del proyecto: la letra base (si la base es texto) y
  // cada capa de tipo texto. El label es el NOMBRE del campo (Revisión del 3-sep: antes
  // se rotulaba con el propio valor -- "María" en vez de "Nombre" -- y si se borraba para
  // escribir el propio, quedaban cajas vacías sin ninguna pista de cuál era cuál).
  function camposTexto() {
    const campos = [];
    if (proyecto.base && proyecto.base.origen === 'texto') {
      campos.push({ ref: proyecto.base, campo: 'txt', label: 'Letra' });
    }
    (proyecto.capas || []).forEach((c, i) => {
      if (c.tipo === 'texto') campos.push({ ref: c, campo: 'txt', label: c.nombre || ('Texto ' + (i + 1)) });
    });
    return campos;
  }

  // Toda capa (texto, figura o imagen) tiene modo/profundidad -- las tres pueden ir en
  // relieve o grabado, así que las tres aparecen acá.
  function capasConEstilo() {
    return (proyecto.capas || []).map((c, i) => ({ ref: c, indice: i }));
  }

  function pintarForm() {
    const campos = camposTexto();
    const conForma = proyecto.base && proyecto.base.origen === 'figura';
    const esImagen = proyecto.tipo === 'llavero-foto' || (proyecto.capas || []).some(c => c.tipo === 'imagen');

    A.$('#d3d-resultado').innerHTML = `
      <div class="tarjeta"><h2>${A.esc(proyecto.nombre)}</h2>
        ${PERFIL_HINT[proyecto.tipo] ? `<p style="font-size:12.5px;color:var(--apagado);margin:0 0 14px">
          <b>Perfil sugerido:</b> ${A.esc(PERFIL_HINT[proyecto.tipo])} Se elige a mano en Creality Print.</p>` : ''}

        ${conForma ? `<h3 style="font-size:13px;text-transform:uppercase;letter-spacing:.5px;color:var(--pizarra);margin:0 0 8px">Forma</h3>
          <div id="d3d-forma">${htmlSelectorForma()}</div>
          <div class="formulario" style="margin-top:10px">
            ${A.campo('d3d-ancho', 'Ancho', proyecto.base.ancho, { tipo: 'number', unidad: 'mm' })}
            ${A.campo('d3d-alto', 'Alto', proyecto.base.alto, { tipo: 'number', unidad: 'mm' })}
            ${A.campo('d3d-grosor', 'Grosor', proyecto.base.grosor, { tipo: 'number', paso: '0.1', unidad: 'mm' })}
          </div>` : `<div class="formulario">
            ${A.campo('d3d-grosor', 'Grosor', proyecto.base.grosor, { tipo: 'number', paso: '0.1', unidad: 'mm' })}
          </div>`}

        ${campos.length ? `<h3 style="font-size:13px;text-transform:uppercase;letter-spacing:.5px;color:var(--pizarra);margin:16px 0 8px">Textos</h3>
          <div class="formulario">
            ${campos.map((c, i) => A.campo('d3d-txt-' + i, c.label, c.ref[c.campo], { ancho: true })).join('')}
          </div>` : ''}

        ${htmlSeccionImagen()}

        <details class="mas-opciones" id="d3d-mas">
          <summary>Más opciones — tipografía, relieve, argolla y montaje</summary>
          <div id="d3d-tipografia">${htmlSelectorTipografia()}</div>
          <div id="d3d-relieve">${htmlRelieve()}</div>
          ${proyecto.argolla ? `<h3>Argolla</h3><div id="d3d-argolla">${htmlArgolla()}</div>` : ''}
          ${proyecto.montaje ? `<h3>Montaje en pared</h3><div id="d3d-montaje">${htmlMontaje()}</div>` : ''}
          ${proyecto.led && proyecto.led.modo !== 'ninguno' ? `<h3>Caja de luz</h3><div id="d3d-led">${htmlLed()}</div>` : ''}
        </details>

        <div class="row" style="margin-top:16px">
          <button class="btn primario" onclick="Vistas.disenos3d.generar()">Generar</button>
          <button class="btn sutil" onclick="Vistas.disenos3d.pintar()">Elegir otro</button>
        </div>
      </div>
      <div id="d3d-generado"></div>`;

    const grosorEl = document.getElementById('d3d-grosor');
    if (grosorEl) grosorEl.onchange = () => { proyecto.base.grosor = A.num(grosorEl.value) || proyecto.base.grosor; };
    if (conForma) {
      const anchoEl = document.getElementById('d3d-ancho'), altoEl = document.getElementById('d3d-alto');
      if (anchoEl) anchoEl.onchange = () => { proyecto.base.ancho = A.num(anchoEl.value) || proyecto.base.ancho; };
      if (altoEl) altoEl.onchange = () => { proyecto.base.alto = A.num(altoEl.value) || proyecto.base.alto; };
    }
    if (esImagen) wireImagen();
  }

  /* ---------- 1 · la forma: miniaturas de verdad, no nombres en una lista ---------- */
  function svgDeFigura(id, params) {
    let figs;
    try { figs = D3DFormas.figura(id, 40, 40, params || {}); }
    catch (e) { figs = D3DFormas.figura('circulo', 40, 40, {}); }
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    figs.forEach(f => [f.outer].concat(f.holes || []).forEach(c => c.forEach(p => {
      if (p[0] < x1) x1 = p[0]; if (p[0] > x2) x2 = p[0];
      if (p[1] < y1) y1 = p[1]; if (p[1] > y2) y2 = p[1];
    })));
    if (!isFinite(x1)) { x1 = -20; y1 = -20; x2 = 20; y2 = 20; }
    const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2, r = Math.max(x2 - x1, y2 - y1) / 2 * 1.18 || 20;
    const trazo = pts => pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + (-p[1]).toFixed(1)).join(' ') + ' Z';
    const d = figs.map(f => trazo(f.outer) + ' ' + (f.holes || []).map(trazo).join(' ')).join(' ');
    return `<svg viewBox="${(cx - r).toFixed(1)} ${(-cy - r).toFixed(1)} ${(r * 2).toFixed(1)} ${(r * 2).toFixed(1)}">` +
      `<path d="${d}" fill="currentColor" fill-rule="evenodd"/></svg>`;
  }

  function htmlSelectorForma() {
    const grupos = D3DFormas.gruposFiguras();
    const actual = proyecto.base.figura;
    return Object.keys(grupos).map(g => `
      <div class="grupo-figuras"><h3>${A.esc(g)}</h3>
        <div class="figuras-grid">
          ${grupos[g].map(f => `<button type="button" class="figura-mini${f.id === actual ? ' activa' : ''}"
              onclick="Vistas.disenos3d.elegirForma('${f.id}')" title="${A.esc(f.label)}">
              ${svgDeFigura(f.id, f.params)}<span>${A.esc(f.label)}</span></button>`).join('')}
        </div>
      </div>`).join('');
  }

  function elegirForma(id) {
    proyecto.base.figura = id;
    const cont = document.getElementById('d3d-forma');
    if (cont) cont.innerHTML = htmlSelectorForma();
  }

  /* ---------- 3 · tipografía: la palabra en cada fuente, no el nombre de la fuente ---------- */
  let fuentesCSSInyectadas = false;
  function inyectarFuentesCSS() {
    if (fuentesCSSInyectadas) return;
    fuentesCSSInyectadas = true;
    const CDN = 'https://cdn.jsdelivr.net/gh/google/fonts@main/';
    const reglas = D3DFuentes.FUENTES.map(f => `@font-face{font-family:'d3d-${f.id}';src:url('${CDN}${f.file}');font-display:swap;}`).join('');
    const style = document.createElement('style');
    style.textContent = reglas;
    document.head.appendChild(style);
  }

  function objetivosTipografia() {
    // La base solo tiene tipografía propia cuando ELLA es el texto (letra-nombre).
    const out = [];
    if (proyecto.base && proyecto.base.origen === 'texto') out.push({ ref: proyecto.base, id: 'base' });
    (proyecto.capas || []).forEach((c, i) => { if (c.tipo === 'texto') out.push({ ref: c, id: 'c' + i }); });
    return out;
  }

  function htmlSelectorTipografia() {
    const objetivos = objetivosTipografia();
    if (!objetivos.length) return '';
    inyectarFuentesCSS();
    const grupos = D3DFuentes.grupos ? D3DFuentes.grupos() : {};
    return `<h3>Tipografía</h3>` + objetivos.map(o => {
      const texto = (o.ref.txt || 'Abc').slice(0, 16);
      return `<div class="grupo-fuentes" style="margin-bottom:14px">
        <p style="font-size:12.5px;color:var(--apagado);margin:0 0 6px">${o.id === 'base' ? 'Letra' : A.esc(o.ref.nombre || 'Texto')}</p>
        ${Object.keys(grupos).map(g => `<h3>${A.esc(g)}</h3><div class="fuentes-grid">
          ${grupos[g].map(f => `<button type="button" class="fuente-swatch${f.id === o.ref.fuente ? ' activa' : ''}"
              style="font-family:'d3d-${f.id}'" onclick="Vistas.disenos3d.elegirFuente('${o.id}', '${f.id}')">${A.esc(texto)}</button>`).join('')}
          </div>`).join('')}
      </div>`;
    }).join('');
  }

  function elegirFuente(objetivoId, fuenteId) {
    const objetivos = objetivosTipografia();
    const o = objetivos.find(x => x.id === objetivoId);
    if (!o) return;
    o.ref.fuente = fuenteId;
    const cont = document.getElementById('d3d-tipografia');
    if (cont) cont.innerHTML = htmlSelectorTipografia();
  }

  /* ---------- 4 · relieve o grabado, y cuán hondo ---------- */
  function htmlRelieve() {
    const capas = capasConEstilo();
    if (!capas.length) return '';
    return `<h3>Relieve o grabado</h3>` + capas.map(c => `
      <div class="row" style="margin-bottom:8px">
        <span style="font-size:13px;color:var(--suave);min-width:110px">${A.esc(c.ref.nombre || 'Capa')}</span>
        <select onchange="Vistas.disenos3d.cambiarModo(${c.indice}, this.value)">
          <option value="relieve"${c.ref.modo === 'relieve' ? ' selected' : ''}>Relieve (sobresale)</option>
          <option value="grabado"${c.ref.modo === 'grabado' ? ' selected' : ''}>Grabado (hundido)</option>
        </select>
        <input type="number" step="0.1" min="0.2" style="width:80px" value="${c.ref.prof}"
          onchange="Vistas.disenos3d.cambiarProf(${c.indice}, this.value)">
        <span style="font-size:12px;color:var(--apagado)">mm de profundidad</span>
      </div>`).join('');
  }
  function cambiarModo(indice, valor) { const c = proyecto.capas[indice]; if (c) c.modo = valor; }
  function cambiarProf(indice, valor) { const c = proyecto.capas[indice]; if (c) c.prof = A.num(valor) || c.prof; }

  /* ---------- 7 · argolla y montaje ---------- */
  function htmlArgolla() {
    const a = proyecto.argolla;
    return `<label style="display:flex;align-items:center;gap:8px;font-size:13.5px;margin-bottom:8px">
        <input type="checkbox" id="d3d-arg-activa" ${a.activa ? 'checked' : ''} onchange="Vistas.disenos3d.cambiarArgolla('activa', this.checked)">
        Lleva argolla</label>
      <div class="formulario">
        ${A.campo('d3d-arg-d', 'Diámetro', a.d, { tipo: 'number', paso: '0.1', unidad: 'mm' })}
        ${A.campo('d3d-arg-x', 'Posición X (desde el centro)', a.x, { tipo: 'number', unidad: 'mm' })}
        ${A.campo('d3d-arg-y', 'Posición Y (desde el centro)', a.y, { tipo: 'number', unidad: 'mm' })}
      </div>`;
  }
  function cambiarArgolla(campo, valor) {
    proyecto.argolla[campo] = campo === 'activa' ? !!valor : (A.num(valor) || 0);
  }

  function htmlMontaje() {
    const m = proyecto.montaje;
    return `<label style="display:flex;align-items:center;gap:8px;font-size:13.5px;margin-bottom:8px">
        <input type="checkbox" id="d3d-mon-activa" ${m.activa ? 'checked' : ''} onchange="Vistas.disenos3d.cambiarMontaje('activa', this.checked)">
        Lleva agujeros para colgar</label>
      <div class="formulario">${A.campo('d3d-mon-d', 'Diámetro', m.d, { tipo: 'number', paso: '0.1', unidad: 'mm' })}</div>`;
  }
  function cambiarMontaje(campo, valor) {
    proyecto.montaje[campo] = campo === 'activa' ? !!valor : (A.num(valor) || 0);
  }

  /* ---------- caja de luz: las 5 medidas que decían "invisibles" ---------- */
  function htmlLed() {
    const l = proyecto.led;
    return `<div class="formulario">
      ${A.campo('d3d-led-muro', 'Muro', l.muro, { tipo: 'number', paso: '0.1', unidad: 'mm', nota: 'grosor del borde' })}
      ${A.campo('d3d-led-alto', 'Alto de la caja', l.alto, { tipo: 'number', paso: '0.1', unidad: 'mm' })}
      ${A.campo('d3d-led-fondo', 'Fondo', l.fondo, { tipo: 'number', paso: '0.1', unidad: 'mm' })}
      ${A.campo('d3d-led-holgura', 'Holgura de la tira LED', l.holgura, { tipo: 'number', paso: '0.05', unidad: 'mm', nota: 'si la tira no entra, sube esto' })}
      ${A.campo('d3d-led-cable', 'Salida del cable', l.cable, { tipo: 'number', paso: '0.1', unidad: 'mm' })}
    </div>`;
  }
  function cambiarLed() {
    const v = id => { const e = document.getElementById(id); return e ? A.num(e.value) : undefined; };
    ['muro', 'alto', 'fondo', 'holgura', 'cable'].forEach(campo => {
      const val = v('d3d-led-' + campo);
      if (val !== undefined) proyecto.led[campo] = val;
    });
  }

  /* ---------- 5 · subir una imagen ---------- */
  function htmlSeccionImagen() {
    if (proyecto.tipo !== 'llavero-foto' && !(proyecto.capas || []).some(c => c.tipo === 'imagen')) return '';
    const tieneCapa = (proyecto.capas || []).some(c => c.tipo === 'imagen' && c.figs && c.figs.length);
    return `<h3 style="font-size:13px;text-transform:uppercase;letter-spacing:.5px;color:var(--pizarra);margin:16px 0 8px">Imagen</h3>
      <div class="row" style="margin-bottom:10px">
        <input type="file" id="d3d-imagen-archivo" accept="image/*" hidden>
        <button type="button" class="btn sutil chico" onclick="document.getElementById('d3d-imagen-archivo').click()">
          ${tieneCapa ? 'Cambiar imagen' : 'Subir imagen'}</button>
        <span id="d3d-imagen-estado" style="font-size:12px;color:var(--apagado)">${tieneCapa ? '' : 'Sin imagen todavía — el resto se genera igual, solo faltará el dibujo.'}</span>
      </div>
      <div id="d3d-imagen-controles" style="${imagenOriginal ? '' : 'display:none'}">
        <div class="formulario">
          <label class="campo"><span>Umbral <i>qué tan oscuro cuenta como "lleno"</i></span>
            <input type="range" id="d3d-img-umbral" min="0.05" max="0.95" step="0.05" value="${controlesImagen.umbral}"></label>
          <label class="campo"><span>Detalle <i>1 = fiel al original, 0 = muy liso</i></span>
            <input type="range" id="d3d-img-detalle" min="0" max="1" step="0.05" value="${controlesImagen.detalle}"></label>
        </div>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;margin-top:6px">
          <input type="checkbox" id="d3d-img-invertir" ${controlesImagen.invertir ? 'checked' : ''}> Invertir (lo oscuro pasa a ser el hueco)</label>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;margin-top:6px">
          <input type="checkbox" id="d3d-img-solomayor" ${controlesImagen.soloMayor ? 'checked' : ''}> Solo la figura más grande <i style="color:var(--apagado);font-weight:400">(saca manchitas sueltas)</i></label>
      </div>`;
  }

  function wireImagen() {
    const archivo = document.getElementById('d3d-imagen-archivo');
    if (archivo) archivo.onchange = e => { const f = e.target.files[0]; if (f) subirImagen(f); };
    ['d3d-img-umbral', 'd3d-img-detalle'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.oninput = () => {
        controlesImagen.umbral = A.num(document.getElementById('d3d-img-umbral').value);
        controlesImagen.detalle = A.num(document.getElementById('d3d-img-detalle').value);
        procesarImagen();
      };
    });
    ['d3d-img-invertir', 'd3d-img-solomayor'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.onchange = () => {
        controlesImagen.invertir = !!document.getElementById('d3d-img-invertir').checked;
        controlesImagen.soloMayor = !!document.getElementById('d3d-img-solomayor').checked;
        procesarImagen();
      };
    });
  }

  function subirImagen(file) {
    const estado = document.getElementById('d3d-imagen-estado');
    if (estado) estado.textContent = 'Leyendo la imagen…';
    const img = new Image();
    const lector = new FileReader();
    lector.onload = () => {
      img.onload = () => {
        const LADO_MAX = 500; // de sobra para vectorizar; no hace falta la resolución original
        const esc = Math.min(1, LADO_MAX / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * esc));
        canvas.height = Math.max(1, Math.round(img.height * esc));
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        imagenOriginal = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const cont = document.getElementById('d3d-imagen-controles');
        if (cont) cont.style.display = '';
        procesarImagen();
      };
      img.onerror = () => { if (estado) estado.textContent = 'No pude leer esa imagen.'; };
      img.src = lector.result;
    };
    lector.onerror = () => { if (estado) estado.textContent = 'No pude leer ese archivo.'; };
    lector.readAsDataURL(file);
  }

  function procesarImagen() {
    if (!imagenOriginal) return;
    const estado = document.getElementById('d3d-imagen-estado');
    const ancho = N(proyecto.base.ancho, 40) * 0.6, alto = N(proyecto.base.alto, 40) * 0.6; // deja margen dentro de la base
    const r = D3DFormas.trazarImagen(imagenOriginal, Object.assign({ ancho, alto }, controlesImagen));
    if (r.aviso) { if (estado) { estado.textContent = r.aviso; estado.style.color = 'var(--terra)'; } return; }
    if (estado) { estado.textContent = r.piezas + ' forma(s) encontradas.'; estado.style.color = 'var(--apagado)'; }
    let capa = (proyecto.capas || []).find(c => c.tipo === 'imagen');
    const eraNueva = !capa;
    if (!capa) { capa = D3DBuild.capaImagen(r.figs, 'Imagen', { ancho, alto }); proyecto.capas.push(capa); }
    else { capa.figs = r.figs; capa.ancho = ancho; capa.alto = alto; }
    // La primera vez que aparece la capa de imagen, el control de relieve/grabado (que ya
    // se había pintado sin ella) tiene que sumarla.
    if (eraNueva) { const cont = document.getElementById('d3d-relieve'); if (cont) cont.innerHTML = htmlRelieve(); }
  }

  async function generar() {
    const campos = camposTexto();
    campos.forEach((c, i) => {
      const e = document.getElementById('d3d-txt-' + i);
      if (e) c.ref[c.campo] = e.value;
    });
    if (proyecto.led && proyecto.led.modo !== 'ninguno') cambiarLed();
    A.$('#d3d-generado').innerHTML = `<div class="tarjeta"><div class="vacio">Generando…</div></div>`;
    try {
      compilado = await D3DBuild.compilar(proyecto);
      pintarGenerado();
    } catch (e) {
      console.error(e);
      A.$('#d3d-generado').innerHTML = `<div class="tarjeta aviso" style="border-color:var(--malo)">
        <b>No se pudo generar.</b> ${A.esc(e.message || String(e))}</div>`;
    }
  }

  function pintarGenerado() {
    const c = compilado;
    A.$('#d3d-generado').innerHTML = `
      <div class="tarjeta"><h2>Listo</h2>
        <div class="rejilla">
          <div class="dato"><div class="k">Medida</div>
            <div class="v" style="font-size:18px">${c.dims.ancho.toFixed(0)} × ${c.dims.alto.toFixed(0)} × ${c.dims.espesor.toFixed(1)}</div>
            <div class="n">mm</div></div>
          <div class="dato"><div class="k">Piezas</div><div class="v">${c.piezas.length}</div></div>
          <div class="dato"><div class="k">Colores</div><div class="v">${c.colores.length}</div></div>
        </div>
        ${c.avisos && c.avisos.length ? `<div class="tarjeta aviso" style="margin-top:12px">
          ${c.avisos.map(a => `<p style="margin:4px 0;font-size:13px">${A.esc(a)}</p>`).join('')}</div>` : ''}
        ${c.bom && c.bom.length ? `<div style="margin-top:12px">
          <b style="font-size:12.5px;text-transform:uppercase;letter-spacing:.5px;color:var(--pizarra)">Insumos</b>
          <ul style="margin:6px 0 0;padding-left:18px;font-size:13px;color:var(--suave)">
            ${c.bom.map(b => `<li>${A.esc(b)}</li>`).join('')}</ul></div>` : ''}
        <div class="row" style="margin-top:14px">
          <button class="btn primario" onclick="Vistas.disenos3d.descargar('stl')">Descargar STL</button>
          <button class="btn" onclick="Vistas.disenos3d.descargar('3mf')">Descargar 3MF (multicolor)</button>
          <button class="btn sutil" onclick="Vistas.disenos3d.guardar()">Guardar como producto</button>
        </div>
        <p style="font-size:12px;color:var(--apagado);margin-top:10px">
          Los gramos y las horas no se inventan acá: se miden imprimiendo o laminando en
          Creality Print, igual que en Cotizar. Queda guardado sin precio hasta que se midan.
          Las copias y cuántas caben en la bandeja se calculan al laminar, en Creality Print.</p>
      </div>`;
  }

  function descargarBlob(datos, nombre) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([datos]));
    a.download = nombre;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  async function descargar(tipo) {
    if (!compilado) return;
    try { await cargarThree(); } catch (e) { A.aviso(e.message || String(e), 'error'); return; }
    const nombre = proyecto.nombre || 'diseno';
    if (tipo === 'stl') {
      const archivos = D3DBuild.exportarSTL(compilado, 'color', nombre);
      if (!archivos.length) { A.aviso('No hay nada que exportar', 'error'); return; }
      archivos.forEach(a => descargarBlob(a.buffer, a.nombre));
      A.aviso(archivos.length + ' archivo(s) STL descargado(s)');
    } else {
      const r = D3D3MF.exportar3MF(compilado, nombre);
      if (!r) { A.aviso('No hay nada que exportar', 'error'); return; }
      descargarBlob(r.datos, r.nombre);
      A.aviso('3MF descargado: ' + r.objetos + ' pieza(s), ' + r.colores.length + ' color(es)');
    }
  }

  function guardar() {
    if (!compilado) return;
    proyecto.modificado = new Date().toISOString();
    Datos.agregar('disenos3d', proyecto);
    Datos.agregar('productos', {
      sku: '', nombre: proyecto.nombre, categoria: 'personalizados', oficio: '3d', material: 'PLA',
      gramos: 0, horas: 0, colores: compilado.colores.length, postMin: 0, precio: null, stock: 0,
      filamentoId: null, foto: '', descripcion: 'Generado en Personalizados 3D.',
      disenoId: proyecto.id, extraCosto: 0, extraNota: '', activo: true
    });
    Datos.guardar('nuevo diseño 3D');
    A.aviso('Guardado en el catálogo: ' + proyecto.nombre + '. Faltan los gramos y las horas para tener precio.');
  }

  window.Vistas = window.Vistas || {};
  Vistas.disenos3d = {
    pintar, elegir, generar, descargar, guardar,
    elegirForma, elegirFuente, cambiarModo, cambiarProf, cambiarArgolla, cambiarMontaje,
    // Getters de solo lectura, para poder verificar el estado real sin exponerlo a que
    // alguien lo pise por accidente desde afuera (igual que Supabase._sesionActual).
    _proyectoActual: () => proyecto, _compiladoActual: () => compilado,
    _imagenSubida: () => imagenOriginal, _controlesImagen: () => controlesImagen
  };
})();
