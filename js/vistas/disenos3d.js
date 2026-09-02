/* Vista: Personalizados 3D. De un preset (llavero, letra con nombre, letrero, caja de luz,
 * recuerdo de nacimiento…) a un archivo listo para la K2, sin abrir otra herramienta.
 *
 * El motor (D3DFormas, D3DFuentes, D3DBuild, D3D3MF) es el mismo que ya generó los 19
 * diseños que trae la semilla — se portó del repo anterior, no se reescribió (PLAN.md,
 * Fase 4-bis). Esta vista es deliberadamente simple: elegir preset, poner los textos,
 * generar. El editor completo (arrastrar, rotar, agregar capas sueltas) es design3d.js
 * en el repo anterior y todavía no se portó — se nota en "Desde cero", que por ahora no
 * está en la lista de presets porque sin el editor no hay con qué llenarlo.
 *
 * Los gramos y las horas NUNCA se inventan acá, igual que en Cotizar: el diseño se genera
 * y se guarda como producto sin precio, hasta que alguien lo mida imprimiendo o laminando. */
(function () {
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

  let proyecto = null;
  let compilado = null;

  function pintar() {
    proyecto = null; compilado = null;
    const presets = D3DBuild.PRESETS_INFO.filter(p => p.id !== 'libre');
    A.$('#contenido').innerHTML = `
      <div class="cabecera"><h1>Personalizados 3D</h1>
        <span class="sub">de un nombre a un archivo listo para la K2</span></div>
      <div class="tarjeta">
        <p style="font-size:13.5px;color:var(--pizarra);margin:0 0 14px">
          Elige qué se hace. Después se piden los textos y se genera el archivo — el mismo
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
    compilado = null;
    pintarForm();
  }

  // Todo campo de texto editable del proyecto: la letra base (si la base es texto) y
  // cada capa de tipo texto. Genérico a propósito — sirve para cualquier preset sin
  // tener que escribir un formulario distinto por cada uno.
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

  function pintarForm() {
    const campos = camposTexto();
    A.$('#d3d-resultado').innerHTML = `
      <div class="tarjeta"><h2>${A.esc(proyecto.nombre)}</h2>
        <div class="formulario">
          ${campos.length
            ? campos.map((c, i) => A.campo('d3d-txt-' + i, c.label, c.ref[c.campo], { ancho: true })).join('')
            : '<p style="font-size:13px;color:var(--apagado)">Este diseño no tiene texto para cambiar — se genera tal cual.</p>'}
        </div>
        <div class="row" style="margin-top:6px">
          <button class="btn primario" onclick="Vistas.disenos3d.generar()">Generar</button>
          <button class="btn sutil" onclick="Vistas.disenos3d.pintar()">Elegir otro</button>
        </div>
      </div>
      <div id="d3d-generado"></div>`;
  }

  async function generar() {
    const campos = camposTexto();
    campos.forEach((c, i) => {
      const e = document.getElementById('d3d-txt-' + i);
      if (e) c.ref[c.campo] = e.value;
    });
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
          Creality Print, igual que en Cotizar. Queda guardado sin precio hasta que se midan.</p>
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
  Vistas.disenos3d = { pintar, elegir, generar, descargar, guardar };
})();
