/* Vista: Historial y Telemetría K2 en vivo.
 * Conectado directamente a /api/tablero en la Pi (Moonraker + k2-asistente).
 * Actualiza automáticamente los productos del catálogo con gramos y tiempos reales sin subir JSON a mano. */
(function () {
  let propuestas = [], resumen = null, piezasOriginales = [];
  let vivoTimer = null;
  const VIVO_MS = 5000;

  function pintar() {
    A.$('#contenido').innerHTML = `
      <div class="cabecera">
        <h1>Historial y Telemetría K2</h1>
        <div class="acciones">
          <button class="btn sutil chico" onclick="Vistas.impresora.refrescar()">🔄 Refrescar ahora</button>
        </div>
      </div>
      <div class="tarjeta" id="imp-vivo">
        <h2>Estado en vivo</h2>
        <div class="vacio">Consultando telemetría de la K2…</div>
      </div>
      <div class="tarjeta" id="imp-ultimo">
        <h2>Último trabajo terminado en taller</h2>
        <div class="vacio">Consultando registro de la Pi…</div>
      </div>
      <div id="imp-resultado"></div>
      <details class="tarjeta" style="margin-top:16px">
        <summary style="cursor:pointer;font-size:13.5px;color:var(--suave);font-weight:600">📁 Importar archivo .json externo (historial antiguo)</summary>
        <div id="imp-zona" class="soltar" style="margin-top:10px">
          <div class="t">Suelta aquí un resumen de historial (.json)</div>
          <div class="s">o haz click para buscarlo en tu equipo</div>
          <input type="file" id="imp-archivo" accept=".json" hidden>
        </div>
      </details>`;

    const zona = A.$('#imp-zona'), input = A.$('#imp-archivo');
    if (zona && input) {
      zona.onclick = () => input.click();
      input.onchange = e => e.target.files[0] && cargarArchivo(e.target.files[0]);
    }

    clearInterval(vivoTimer);
    cargarDatosTablero();
    vivoTimer = setInterval(cargarDatosTablero, VIVO_MS);
  }

  async function cargarDatosTablero() {
    const contVivo = document.getElementById('imp-vivo');
    if (!contVivo) { clearInterval(vivoTimer); return; }

    try {
      const r = await fetch('/api/tablero');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json();
      pintarVivo(data);
      pintarUltimoYTrabajos(data);
    } catch (e) {
      if (contVivo) {
        contVivo.innerHTML = `
          <h2>Estado K2</h2>
          <p style="font-size:13px;color:var(--apagado)">
            No se pudo conectar con el asistente de la K2 en la Pi (/api/tablero: ${A.esc(e.message)}).
            Verifica que la Pi esté encendida en la red o Tailscale.
          </p>`;
      }
    }
  }

  function pintarVivo(data) {
    const cont = document.getElementById('imp-vivo');
    if (!cont) return;
    const k2 = (data.impresoras || [])[0];
    if (!k2) {
      cont.innerHTML = '<h2>Estado K2</h2><div class="vacio">No hay impresoras registradas en el tablero.</div>';
      return;
    }

    const estadoMap = {
      printing: { t: 'Imprimiendo', c: 'ok' },
      complete: { t: 'Terminado / Listo', c: 'ok' },
      paused: { t: 'En pausa', c: 'avisa' },
      idle: { t: 'En espera / Libre', c: 'suave' },
      offline: { t: 'Desconectada', c: 'malo' }
    };
    const est = estadoMap[k2.estado] || { t: k2.estado || 'Desconocido', c: 'suave' };
    const prog = Math.round((k2.progreso || 0) * 100);
    const boq = k2.boquilla ? `${Math.round(k2.boquilla[0])}° / ${Math.round(k2.boquilla[1])}°C` : '—';
    const cama = k2.cama ? `${Math.round(k2.cama[0])}° / ${Math.round(k2.cama[1])}°C` : '—';

    cont.innerHTML = `
      <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:10px">
        <h2>K2 Combo</h2>
        <span class="chip ${est.c}" style="font-weight:700">${est.t}</span>
      </div>
      <div class="rejilla">
        <div class="dato"><div class="k">Archivo activo</div><div class="v" style="font-size:14px;word-break:break-all">${A.esc(k2.archivo || 'Ninguno')}</div></div>
        <div class="dato"><div class="k">Progreso</div><div class="v">${prog}%</div></div>
        <div class="dato"><div class="k">Boquilla</div><div class="v" style="font-size:16px">${boq}</div></div>
        <div class="dato"><div class="k">Cama caliente</div><div class="v" style="font-size:16px">${cama}</div></div>
      </div>
      ${k2.estado === 'printing' && k2.eta_s ? `
        <p style="font-size:13px;color:var(--suave);margin:10px 0 0">
          ⏳ Tiempo restante estimado: <b>${Math.round(k2.eta_s / 60)} min</b>
        </p>
      ` : ''}`;
  }

  function pintarUltimoYTrabajos(data) {
    const cont = document.getElementById('imp-ultimo');
    if (!cont) return;

    const k2 = (data.impresoras || [])[0] || {};
    const u = k2.termino || (data.trabajos || [])[0];

    if (!u) {
      cont.innerHTML = '<h2>Último trabajo terminado en taller</h2><div class="vacio">Sin registros recientes de trabajos finalizados.</div>';
      return;
    }

    const durMin = u.duracion ? Math.round(u.duracion / 60) : (u.dur_s ? Math.round(u.dur_s / 60) : null);
    const gramos = u.gramos != null ? Math.round(u.gramos * 10) / 10 : null;
    const tl = u.timelapse;

    let tlHtml = '';
    if (tl && (tl.video || tl.portada)) {
      tlHtml = `
        <div style="margin-top:12px;background:var(--panel2);border-radius:var(--r-campo);padding:10px;display:flex;align-items:center;gap:12px">
          ${tl.portada ? `<img src="${tl.portada}" style="width:72px;height:72px;object-fit:cover;border-radius:6px;border:1px solid var(--borde)" alt="Portada">` : ''}
          <div>
            <b>🎬 Timelapse de impresión</b>
            <div style="font-size:12.5px;color:var(--suave);margin:2px 0 6px">Cámara K2 (${tl.n_fotos || 0} fotos)</div>
            ${tl.video ? `<a href="${tl.video}" target="_blank" class="btn chico sutil">▶ Ver video MP4</a>` : ''}
          </div>
        </div>`;
    }

    cont.innerHTML = `
      <h2>Último trabajo terminado en taller</h2>
      <div class="rejilla">
        <div class="dato"><div class="k">Pieza impresa</div><div class="v" style="font-size:14px;word-break:break-all">${A.esc(u.archivo || '—')}</div></div>
        <div class="dato"><div class="k">Gramos consumidos</div><div class="v" style="color:var(--c-maquina)">${gramos != null ? gramos + ' g' : '—'}</div></div>
        <div class="dato"><div class="k">Duración real</div><div class="v">${durMin != null ? durMin + ' min' : '—'}</div></div>
        <div class="dato"><div class="k">Estado</div><div class="v" style="color:var(--ok)">${A.esc(u.estado || 'Completado')}</div></div>
      </div>
      ${tlHtml}`;

    // Construir lista de piezas para emparejar con catálogo
    const listaTrabajos = (data.trabajos || []).concat(u.archivo ? [u] : []);
    if (listaTrabajos.length && !resumen) {
      const mapaPiezas = {};
      listaTrabajos.forEach(j => {
        const nom = j.archivo;
        if (!nom) return;
        if (!mapaPiezas[nom]) {
          mapaPiezas[nom] = { archivo: nom, veces: 0, gramosReales: 0, horasReales: 0 };
        }
        mapaPiezas[nom].veces++;
        const g = j.gramos || 10;
        const h = (j.duracion || j.dur_s || 1800) / 3600;
        mapaPiezas[nom].gramosReales = Math.round(g * 10) / 10;
        mapaPiezas[nom].horasReales = Math.round(h * 100) / 100;
      });

      piezasOriginales = Object.values(mapaPiezas);
      propuestas = window.Impresora ? window.Impresora.emparejar(piezasOriginales, Datos.activos('productos')) : [];
      pintarEmparejamiento();
    }
  }

  function pintarEmparejamiento() {
    const cont = document.getElementById('imp-resultado');
    if (!cont) return;
    const emparejadas = propuestas.filter(p => p.productoId);
    const sinDueno = propuestas.filter(p => !p.productoId);

    cont.innerHTML = `
      <div class="tarjeta">
        <h2>Catálogo vs Taller · ${emparejadas.length} piezas listas para sincronizar</h2>
        <p style="font-size:13px;color:var(--suave);margin:0 0 12px">
          Aplica los gramos y horas exactos medidos por la K2 directamente a la ficha del producto:
        </p>
        ${emparejadas.length ? `
          <table>
            <thead><tr><th>Producto en catálogo</th><th>Gramos reales</th><th>Horas reales</th><th>Acción</th></tr></thead>
            <tbody>
              ${emparejadas.map(p => `<tr>
                <td><b>${A.esc((Datos.obtener('productos', p.productoId) || {}).nombre || '—')}</b><br><small style="color:var(--apagado)">${A.esc(p.archivo)}</small></td>
                <td class="num">${p.gramosReales} g</td>
                <td class="num">${p.horasReales} h</td>
                <td><button class="btn chico primario" onclick="Vistas.impresora.aplicarUna('${A.esc(p.productoId)}')">Actualizar ficha</button></td>
              </tr>`).join('')}
            </tbody>
          </table>
        ` : '<p style="color:var(--apagado);font-size:13px">Las piezas recientes ya están calibradas con el catálogo.</p>'}
      </div>
      ${sinDueno.length ? `
        <div class="tarjeta">
          <h2>Piezas impresas sin ficha en catálogo · ${sinDueno.length}</h2>
          <table>
            <thead><tr><th>Archivo G-code</th><th class="num">Gramos</th><th class="num">Horas</th><th></th></tr></thead>
            <tbody>
              ${sinDueno.map(p => `<tr>
                <td>${A.esc(p.archivo)}</td>
                <td class="num">${p.gramosReales} g</td>
                <td class="num">${p.horasReales} h</td>
                <td><button class="btn chico" onclick="Vistas.impresora.crearDesdeHuerfano('${A.esc(p.archivo)}')">+ Crear producto</button></td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}`;
  }

  async function cargarArchivo(file) {
    let n;
    try {
      n = window.Impresora.normalizar(JSON.parse(await file.text()));
    } catch (e) {
      A.$('#imp-resultado').innerHTML = `<div class="tarjeta aviso"><b>${A.esc(e.message || String(e))}</b></div>`;
      return;
    }
    resumen = n.resumen;
    piezasOriginales = n.piezas;
    propuestas = window.Impresora.emparejar(n.piezas, Datos.activos('productos'));
    pintarEmparejamiento();
  }

  function aplicarUna(productoId) {
    const prop = propuestas.find(p => p.productoId === productoId);
    const prod = prop && Datos.obtener('productos', productoId);
    if (!prop || !prod) return;
    prod.gramos = prop.gramosReales;
    prod.horas = prop.horasReales;
    prod.precio = Costos.calcular(prod).sugerido;
    Datos.guardar('gramos y horas reales del historial K2');
    A.aviso(`Ficha "${prod.nombre}" actualizada con ${prod.gramos}g y ${prod.horas}h.`);
    propuestas = window.Impresora.emparejar(piezasOriginales, Datos.activos('productos'));
    pintarEmparejamiento();
  }

  function crearDesdeHuerfano(archivo) {
    const prop = propuestas.find(p => p.archivo === archivo && !p.productoId);
    if (!prop) return;
    const nombre = archivo.replace(/\.(gcode|stl|3mf)$/i, '').replace(/_/g, ' ');
    const p = Datos.agregar('productos', {
      sku: '', nombre, categoria: 'sin-categoria', oficio: '3d', material: 'PLA',
      gramos: prop.gramosReales, horas: prop.horasReales, colores: 1, postMin: 0,
      precio: null, stock: 0, filamentoId: null, anchoMm: null, largoMm: null, foto: '',
      descripcion: 'Creado automáticamente desde telemetría K2.', archivoOrigen: prop.archivo,
      extraCosto: 0, extraNota: '', activo: true
    });
    p.precio = Costos.calcular(p).sugerido;
    Datos.guardar('producto creado desde telemetría K2');
    A.aviso('Producto creado: ' + nombre);
    propuestas = window.Impresora.emparejar(piezasOriginales, Datos.activos('productos'));
    pintarEmparejamiento();
  }

  window.Vistas = window.Vistas || {};
  Vistas.impresora = {
    pintar,
    refrescar: cargarDatosTablero,
    aplicarUna,
    crearDesdeHuerfano
  };
})();
