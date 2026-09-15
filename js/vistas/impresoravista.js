/* Vista: Historial K2. Trae el historial (por archivo), propone gramos/horas reales, y
 * muestra el estado EN VIVO si el agente local ya está empujando a Supabase (Fase 6). */
(function () {
  let propuestas = [], resumen = null, piezasOriginales = [];
  let vivoTimer = null;
  const VIVO_MS = 10000; // cada cuánto se refresca sola el estado en vivo

  function pintar() {
    A.$('#contenido').innerHTML = `
      <div class="cabecera"><h1>Historial K2</h1></div>
      <div class="tarjeta" id="imp-vivo"><h2>Estado en vivo</h2><div class="vacio">Consultando…</div></div>
      <div class="tarjeta">
        <div id="imp-zona" class="soltar">
          <div class="t">Suelta aquí el resumen del historial</div><div class="s">o haz click para buscarlo (.json)</div>
          <input type="file" id="imp-archivo" accept=".json" hidden>
        </div>
      </div>
      <div id="imp-resultado"></div>`;
    const zona = A.$('#imp-zona'), input = A.$('#imp-archivo');
    zona.onclick = () => input.click();
    input.onchange = e => e.target.files[0] && cargarArchivo(e.target.files[0]);
    clearInterval(vivoTimer);
    pintarVivo();
    vivoTimer = setInterval(pintarVivo, VIVO_MS);
  }

  async function pintarVivo() {
    const cont = document.getElementById('imp-vivo');
    // ya no estamos en esta vista (se navegó a otra parte) -- deja de refrescar sola
    if (!cont) { clearInterval(vivoTimer); return; }
    if (!Nube.encendida() || !Nube.leerImpresoraViva) {
      cont.innerHTML = '<h2>Estado en vivo</h2><p style="font-size:13px;color:var(--apagado)">Sin sincronización, no hay estado en vivo -- prende la nube en Ajustes.</p>';
      return;
    }
    const est = await Nube.leerImpresoraViva();
    cont.innerHTML = est
      ? `<h2>Estado en vivo</h2><div class="rejilla">
          <div class="dato"><div class="k">Estado</div><div class="v" style="font-size:18px">${A.esc(est.estado || '—')}</div></div>
          ${est.capaActual != null ? `<div class="dato"><div class="k">Capa</div><div class="v">${est.capaActual}/${est.capaTotal || '—'}</div></div>` : ''}
          ${est.progreso != null ? `<div class="dato"><div class="k">Progreso</div><div class="v">${Math.round(est.progreso)}%</div></div>` : ''}
        </div>`
      : `<h2>Estado en vivo</h2><p style="font-size:13px;color:var(--apagado)">Todavía no hay datos -- falta que el agente local esté corriendo (ver <code>agente/README.md</code>).</p>`;
  }

  async function cargarArchivo(file) {
    let n;
    try { n = window.Impresora.normalizar(JSON.parse(await file.text())); }
    catch (e) { A.$('#imp-resultado').innerHTML = `<div class="tarjeta aviso"><b>${A.esc(e.message || String(e))}</b></div>`; return; }
    resumen = n.resumen; piezasOriginales = n.piezas;
    propuestas = window.Impresora.emparejar(n.piezas, Datos.activos('productos'));
    pintarResultado();
  }

  function pintarResultado() {
    const r = resumen;
    const emparejadas = propuestas.filter(p => p.productoId), sinDueno = propuestas.filter(p => !p.productoId);
    A.$('#imp-resultado').innerHTML = `
      <div class="tarjeta"><h2>Lo que dice el historial</h2>
        <div class="rejilla">
          <div class="dato"><div class="k">Trabajos</div><div class="v">${r.trabajos}</div></div>
          <div class="dato"><div class="k">Horas impresas</div><div class="v">${r.horasImpresas.toFixed(1)}</div></div>
          <div class="dato"><div class="k">Tasa de fallo</div><div class="v">${(r.tasaFalloMaterial * 100).toFixed(1)}%</div></div>
        </div></div>
      <div class="tarjeta"><h2>Piezas que se pueden actualizar · ${emparejadas.length}</h2>
        ${emparejadas.length ? `<table><thead><tr><th>Producto</th><th>Archivo</th><th class="num">Gramos</th><th class="num">Horas</th><th></th></tr></thead><tbody>
          ${emparejadas.map(p => `<tr><td><b>${A.esc((Datos.obtener('productos', p.productoId) || {}).nombre || '—')}</b></td>
            <td style="color:var(--apagado);font-size:12px">${A.esc(p.archivo)}</td><td class="num">${p.gramosReales}</td><td class="num">${p.horasReales}</td>
            <td><button class="btn chico" onclick="Vistas.impresora.aplicarUna('${A.esc(p.productoId)}')">Aplicar</button></td></tr>`).join('')}
          </tbody></table>` : '<p style="color:var(--apagado);font-size:13px">Ninguna.</p>'}
      </div>
      ${sinDueno.length ? `<div class="tarjeta"><h2>Sin producto en el catálogo · ${sinDueno.length}</h2>
        <table><thead><tr><th>Archivo</th><th class="num">Veces</th><th class="num">Gramos</th><th class="num">Horas</th><th></th></tr></thead><tbody>
          ${sinDueno.map(p => `<tr><td>${A.esc(p.archivo)}</td><td class="num">${p.veces}</td><td class="num">${p.gramosReales}</td><td class="num">${p.horasReales}</td>
            <td><button class="btn chico" onclick="Vistas.impresora.crearDesdeHuerfano('${A.esc(p.archivo)}')">Crear producto</button></td></tr>`).join('')}
        </tbody></table></div>` : ''}`;
  }

  function aplicarUna(productoId) {
    const prop = propuestas.find(p => p.productoId === productoId);
    const prod = prop && Datos.obtener('productos', productoId);
    if (!prop || !prod) return;
    prod.gramos = prop.gramosReales; prod.horas = prop.horasReales;
    Datos.guardar('gramos y horas del historial de la K2');
    A.aviso('Producto actualizado');
    propuestas = window.Impresora.emparejar(piezasOriginales, Datos.activos('productos'));
    pintarResultado();
  }

  function crearDesdeHuerfano(archivo) {
    const prop = propuestas.find(p => p.archivo === archivo && !p.productoId);
    if (!prop) return;
    const nombre = archivo.replace(/\.(gcode|stl|3mf)$/i, '').replace(/_/g, ' ');
    const p = Datos.agregar('productos', { sku: '', nombre, categoria: 'sin-categoria', oficio: '3d', material: 'PLA',
      gramos: prop.gramosReales, horas: prop.horasReales, colores: 1, postMin: 0, precio: null, stock: 0, filamentoId: null,
      anchoMm: null, largoMm: null, foto: '', descripcion: 'Creado desde Historial K2.', archivoOrigen: prop.archivo, extraCosto: 0, extraNota: '', activo: true });
    p.precio = Costos.calcular(p).sugerido;
    Datos.guardar('producto creado desde Historial K2');
    A.aviso('Creado: ' + nombre);
    propuestas = window.Impresora.emparejar(piezasOriginales, Datos.activos('productos'));
    pintarResultado();
  }

  window.Vistas = window.Vistas || {};
  Vistas.impresora = { pintar, aplicarUna, crearDesdeHuerfano };
})();
