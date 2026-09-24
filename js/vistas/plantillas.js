/* Vista: Plantillas. Una pantalla simple que se arma SOLA desde el JSON de la plantilla:
 * variante (botones) → parámetros (texto, teléfono-QR, interruptor, color) → vista 3D en
 * vivo → Descargar 3MF → «Después de descargar». Agregar una plantilla = sumar su JSON a
 * plantillas/catalogo.json (ver plantillas/README.md); esta vista no se toca. */
(function () {
  const est = { catalogo: null, plantillas: {}, p: null, variante: null, valores: {}, comp: null, gen: 0, error: null, timer: null };
  const visor = { renderer: null, escena: null, camara: null, grupo: null, rotX: -0.35, rotY: 0, metaY: 0, arrastre: null, vivo: false };

  const esc = s => A.esc(s);
  const $ = s => document.querySelector(s);

  async function json(ruta) {
    const r = await fetch(ruta, { cache: 'no-cache' });
    if (!r.ok) throw new Error('No pude cargar ' + ruta + ' (' + r.status + ')');
    return r.json();
  }

  async function pintar() {
    parar();
    A.$('#contenido').innerHTML = `<div class="cabecera"><h1>Plantillas</h1><span class="sub">Pedido en un minuto: modelo, nombre, descargar.</span></div>
      <div id="pl-catalogo"></div><div id="pl-editor"><div class="tarjeta"><div class="vacio">Cargando el catálogo…</div></div></div>`;
    try {
      if (!est.catalogo) est.catalogo = await json('plantillas/catalogo.json');
      const lista = est.catalogo.plantillas || [];
      if (lista.length > 1) {
        $('#pl-catalogo').innerHTML = `<div class="tarjeta"><div class="row">${lista.map(it =>
          `<button class="btn" data-pl="${esc(it.id)}" onclick="Vistas.plantillas.abrir('${esc(it.id)}')">${esc(it.nombre || it.id)}</button>`).join('')}</div></div>`;
      }
      await abrir((est.p && est.p.id) || lista[0].id);
    } catch (e) {
      $('#pl-editor').innerHTML = `<div class="tarjeta aviso"><b>No se pudo abrir el catálogo.</b> ${esc(e.message)}</div>`;
    }
  }

  async function abrir(id) {
    const it = est.catalogo.plantillas.find(x => x.id === id);
    if (!est.plantillas[id]) est.plantillas[id] = await json('plantillas/' + it.archivo);
    const cambio = !est.p || est.p.id !== id;
    est.p = est.plantillas[id];
    if (cambio) { est.variante = est.p.variantes[0].id; est.valores = {}; }
    document.querySelectorAll('[data-pl]').forEach(b => b.classList.toggle('primario', b.dataset.pl === id));
    pintarEditor();
    recalcular(0);
  }

  // ------------------------------------------------------------------ formulario
  function campoDe(p) {
    const v = est.valores[p.id];
    const err = `<div class="pl-error" id="pl-err-${esc(p.id)}"></div>`;
    if (p.tipo === 'texto') {
      return `<label class="campo"><span>${esc(p.etiqueta)}</span>
        <input id="pl-${esc(p.id)}" data-param="${esc(p.id)}" type="text" autocomplete="off" maxlength="${p.maxLargo || 40}"
          value="${esc(v || '')}" placeholder="${esc(p.ejemplo || '')}">${err}</label>`;
    }
    if (p.tipo === 'telefono-qr') {
      return `<label class="campo"><span>${esc(p.etiqueta)}<i>opcional</i></span>
        <input id="pl-${esc(p.id)}" data-param="${esc(p.id)}" data-reverso="1" type="tel" autocomplete="off"
          value="${esc(v || '')}" placeholder="${esc(p.ph || '')}">${err}</label>`;
    }
    if (p.tipo === 'interruptor') {
      return `<label class="pl-check"><input type="checkbox" data-param="${esc(p.id)}" ${v ? 'checked' : ''}> ${esc(p.etiqueta)}</label>${err}`;
    }
    if (p.tipo === 'color') {
      const nom = hex => (est.p.nombresColor || {})[hex] || hex;
      return `<label class="campo"><span>${esc(p.etiqueta)}</span><select data-param="${esc(p.id)}">
        <option value="">Como la paleta</option>${(p.opciones || []).map(o =>
          `<option value="${esc(o.hex)}"${v === o.hex ? ' selected' : ''}>${esc(o.nombre || nom(o.hex))}</option>`).join('')}</select>${err}</label>`;
    }
    return '';
  }

  function muestra(hex) { return `<span class="pl-muestra" style="background:${esc(hex)}"></span>`; }

  function pintarEditor() {
    const p = est.p;
    $('#pl-editor').innerHTML = `
      <div class="pl-rejilla">
        <div class="tarjeta pl-panel">
          <h2>${esc(p.nombre)}</h2>
          <div class="pl-variantes" role="group" aria-label="Modelo">
            ${p.variantes.map(v => `<button type="button" class="btn pl-variante${v.id === est.variante ? ' primario' : ''}" data-variante="${esc(v.id)}">
              ${muestra(v.colores[(p.ordenRoles || [])[0]] || v.filamentos[0])}${esc(v.nombre)}</button>`).join('')}
          </div>
          <div class="pl-campos">${(p.parametros || []).map(campoDe).join('')}</div>
          <div class="pl-estado" id="pl-estado"></div>
          <button class="btn primario pl-descargar" id="pl-descargar" disabled>Descargar 3MF</button>
          <details class="pl-ayuda" id="pl-ayuda"></details>
        </div>
        <div class="tarjeta pl-vista">
          <div id="pl-lienzo" class="pl-lienzo" aria-label="Vista 3D"></div>
          <div class="pl-pie"><span>Arrastra para girar</span>
            <button type="button" class="btn sutil chico" id="pl-girar">Ver ${visor.metaY ? 'la cara' : 'el reverso'}</button></div>
        </div>
      </div>`;

    $('#pl-editor').querySelectorAll('[data-variante]').forEach(b => b.onclick = () => {
      est.variante = b.dataset.variante;
      $('#pl-editor').querySelectorAll('[data-variante]').forEach(x => x.classList.toggle('primario', x === b));
      recalcular(0);
    });
    $('#pl-editor').querySelectorAll('[data-param]').forEach(el => {
      const leer = () => { est.valores[el.dataset.param] = el.type === 'checkbox' ? el.checked : el.value; };
      el.addEventListener(el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'input', () => { leer(); recalcular(300); });
      el.addEventListener('focus', () => girarA(el.dataset.reverso ? Math.PI : 0));
    });
    $('#pl-descargar').onclick = descargar;
    $('#pl-girar').onclick = () => girarA(visor.metaY ? 0 : Math.PI);
    montarVisor($('#pl-lienzo'));
    pintarAyuda();
  }

  function pintarAyuda() {
    const el = $('#pl-ayuda'), ins = est.p.instrucciones;
    if (!el) return;
    if (!ins) { el.style.display = 'none'; return; }
    const pal = est.comp ? Plantillas.paletaCarretes(est.p, est.comp) : [];
    const tel = est.comp && Object.values(est.comp.info).find(i => i && i.telefono);
    el.innerHTML = `<summary>${esc(ins.titulo || 'Después de descargar')}</summary>
      <ol>${ins.pasos.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
      ${pal.length ? `<div class="pl-paleta"><b>Carretes para este pedido</b>${pal.map(c =>
        `<div class="pl-carrete">${muestra(c.hex)}<span><b>Filamento ${c.n}</b> · ${esc(c.nombre)}</span>
          <i>${esc(c.usos.join(', '))}</i></div>`).join('')}</div>` : ''}
      ${tel ? `<p class="pl-nota">Número para grabar en el chip: <b>${esc(tel.telefono)}</b></p>` : ''}`;
  }

  // ------------------------------------------------------------------ cálculo en vivo
  function recalcular(espera) {
    clearTimeout(est.timer);
    const estado = $('#pl-estado');
    if (estado) estado.innerHTML = '<span class="pl-calc">Calculando…</span>';
    est.timer = setTimeout(async () => {
      const gen = ++est.gen;
      const btn = $('#pl-descargar');
      if (btn) btn.disabled = true;
      document.querySelectorAll('.pl-error').forEach(e => e.textContent = '');
      let comp = null, error = null;
      try {
        comp = await Plantillas.componer(est.p, est.variante, est.valores, { borrador: true });
      } catch (e) {
        error = e;
        // la vista previa sigue mostrando lo fijo aunque el nombre no quepa
        try { comp = await Plantillas.componer(est.p, est.variante, sinCampo(e.campo), { borrador: true }); } catch (e2) { comp = null; }
      }
      if (gen !== est.gen || !$('#pl-estado')) return;
      est.comp = error ? null : comp;
      est.error = error;
      if (comp) dibujar(comp);
      pintarEstado(comp, error);
      pintarAyuda();
    }, espera);
  }
  function sinCampo(id) { const v = Object.assign({}, est.valores); if (id) v[id] = ''; return v; }

  function pintarEstado(comp, error) {
    const btn = $('#pl-descargar'), estado = $('#pl-estado');
    if (error) {
      if (!error.usuario) console.error(error);
      const donde = error.campo && document.getElementById('pl-err-' + error.campo);
      if (donde) { donde.textContent = error.message; estado.innerHTML = ''; }
      else estado.innerHTML = `<span class="pl-malo">${esc(error.message)}</span>`;
      btn.disabled = true;
      return;
    }
    const falta = comp.faltan && comp.faltan.length;
    btn.disabled = !!falta;
    const m = est.p.medidas;
    const txt = Object.values(comp.info).filter(i => i && i.cap).map(i =>
      `«${esc(i.texto)}» a ${String(i.cap).replace('.', ',')} mm${i.fuente ? ' (letra condensada)' : ''}`);
    const qr = Object.values(comp.info).find(i => i && i.telefono);
    estado.innerHTML = falta
      ? `<span class="pl-suave">Escribe el ${esc(est.p.parametros.find(p => p.id === comp.faltan[0]).etiqueta.toLowerCase())} para descargar.</span>`
      : `<span class="pl-ok">Listo</span> ${txt.join(' · ')}${qr ? ' · QR ' + esc(qr.telefono) : ''}` +
        (m ? `<span class="pl-suave"> · ${String(m.ancho).replace('.', ',')} × ${String(m.alto).replace('.', ',')} × ${String(m.espesor).replace('.', ',')} mm</span>` : '');
  }

  function descargar() {
    if (!est.comp || est.error) return;
    try {
      const r = Plantilla3MF.exportar(est.p, est.comp);
      const v = Plantilla3MF.verificar(r.datos, est.p);
      if (!v.ok) { A.aviso('No descargué: ' + v.problemas.join(' '), 'error'); return; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([r.datos], { type: 'model/3mf' }));
      a.download = r.nombreArchivo;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      A.aviso('3MF descargado: ' + r.nombreArchivo);
      const ay = $('#pl-ayuda'); if (ay) ay.open = true;
    } catch (e) {
      console.error(e);
      A.aviso('No se pudo armar el 3MF: ' + e.message, 'error');
    }
  }

  // ------------------------------------------------------------------ vista 3D (propia, sin OrbitControls)
  function montarVisor(el) {
    const T = window.THREE;
    const w = el.clientWidth || 420, h = el.clientHeight || 420;
    visor.renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    visor.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    visor.renderer.setSize(w, h, false);   // el tamaño en pantalla lo manda el CSS, no el canvas
    el.appendChild(visor.renderer.domElement);
    visor.escena = new T.Scene();
    visor.camara = new T.PerspectiveCamera(32, w / h, 1, 1000);
    visor.camara.position.set(0, 0, 150);
    visor.escena.add(new T.HemisphereLight(0xffffff, 0x8a8478, 0.75));
    const sol = new T.DirectionalLight(0xffffff, 0.65);
    sol.position.set(-40, 60, 120);
    visor.escena.add(sol);
    const contra = new T.DirectionalLight(0xffffff, 0.35);
    contra.position.set(30, -40, -120);
    visor.escena.add(contra);
    visor.grupo = new T.Group();
    visor.escena.add(visor.grupo);

    const c = visor.renderer.domElement;
    c.style.touchAction = 'none';
    c.addEventListener('pointerdown', e => { visor.arrastre = { x: e.clientX, y: e.clientY, rx: visor.rotX, ry: visor.rotY }; c.setPointerCapture(e.pointerId); });
    c.addEventListener('pointermove', e => {
      if (!visor.arrastre) return;
      visor.rotY = visor.arrastre.ry + (e.clientX - visor.arrastre.x) * 0.01;
      visor.rotX = Math.max(-1.4, Math.min(1.4, visor.arrastre.rx + (e.clientY - visor.arrastre.y) * 0.01));
      visor.metaY = visor.rotY;
    });
    c.addEventListener('pointerup', () => { visor.arrastre = null; });
    visor.observador = new ResizeObserver(ajustarTamano);
    visor.observador.observe(el);
    visor.vivo = true;
    requestAnimationFrame(cuadro);
  }
  function ajustarTamano() {
    const el = $('#pl-lienzo');
    if (!el || !visor.renderer) return;
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    visor.renderer.setSize(w, h, false); visor.camara.aspect = w / h; visor.camara.updateProjectionMatrix();
  }
  function cuadro() {
    if (!visor.vivo) return;
    if (!document.body.contains(visor.renderer.domElement)) { parar(); return; }
    if (!visor.arrastre) visor.rotY += (visor.metaY - visor.rotY) * 0.15;
    visor.grupo.rotation.set(visor.rotX, visor.rotY, 0);
    visor.renderer.render(visor.escena, visor.camara);
    requestAnimationFrame(cuadro);
  }
  function parar() {
    visor.vivo = false;
    if (visor.observador) { visor.observador.disconnect(); visor.observador = null; }
    if (visor.renderer) { visor.renderer.dispose(); visor.renderer = null; }
  }
  function girarA(y) {
    // al lado más cercano: si ya dio vueltas, no desenrolla todo
    const vueltas = Math.round((visor.rotY - y) / (2 * Math.PI));
    visor.metaY = y + vueltas * 2 * Math.PI;
    const b = $('#pl-girar');
    if (b) b.textContent = 'Ver ' + (y ? 'la cara' : 'el reverso');
  }

  function dibujar(comp) {
    const T = window.THREE;
    if (!visor.grupo) return;
    visor.grupo.children.slice().forEach(m => { visor.grupo.remove(m); m.geometry.dispose(); m.material.dispose(); });
    const alto = Math.max(...comp.piezas.map(p => p.z[1]));
    comp.piezas.forEach((pz, i) => {
      if (pz.subtipo === 'negative_part' || !pz.figs.length) return;
      // la misma malla que va al archivo: lo que se ve es lo que se imprime
      const m = Plantilla3MF.extruir(pz.espejoX ? Plantilla3MF.espejar(pz.figs) : pz.figs, pz.z[0] - alto / 2, pz.z[1] - alto / 2);
      const pos = new Float32Array(m.tris.length * 9);
      m.tris.forEach((t, k) => t.forEach((v, j) => pos.set(m.verts[v], k * 9 + j * 3)));
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.BufferAttribute(pos, 3));
      geo.computeVertexNormals();
      // en el 3MF la pieza que viene después manda donde se pisan (el QR sobre su placa,
      // lo a ras sobre el cuerpo): aquí igual, con un empujón de profundidad por orden
      const mat = new T.MeshStandardMaterial({ color: new T.Color(pz.color), roughness: 0.55, metalness: 0.02,
        polygonOffset: i > 0, polygonOffsetFactor: -i, polygonOffsetUnits: -4 * i });
      visor.grupo.add(new T.Mesh(geo, mat));
    });
  }

  window.Vistas = window.Vistas || {};
  Vistas.plantillas = { pintar, abrir, _estado: () => est };
})();
