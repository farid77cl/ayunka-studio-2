/* Vista: producción de placas NFC (RUDY, Briones, LIDCAR y las que vengan).
 *
 * No vive en `Datos`/`db.js`: es un archivo aparte (`datos/produccion.json`) que la skill
 * `llavero-nfc-desde-3mf` actualiza cada vez que una pieza avanza de fase — ver
 * `skills/llavero-nfc-desde-3mf/SKILL.md`, sección "Mantener el tablero al día". Guardarlo
 * junto al catálogo (`datos/semilla.json`) habría mezclado dos cosas que cambian por
 * caminos distintos: el catálogo lo edita Farid desde la app, esto lo edita Claude desde
 * el repo.
 */
(function () {
  const RUTA = './datos/produccion.json';
  let datos = null, error = null;

  const ESTADOS = {
    hecho:    { txt: 'cerrado',  color: 'var(--pizarra)' },
    turno:    { txt: 'tu turno', color: 'var(--terra)' },
    problema: { txt: 'problema', color: 'var(--malo)' },
    espera:   { txt: 'en espera', color: 'var(--apagado)' }
  };

  async function pintar() {
    A.$('#contenido').innerHTML = `<div class="cabecera"><h1>Producción</h1>
      <span class="sub">cargando…</span></div>`;
    try {
      const r = await fetch(RUTA, { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      datos = await r.json();
      error = null;
    } catch (e) {
      datos = null;
      error = e;
    }
    render();
  }

  function render() {
    if (!datos) {
      A.$('#contenido').innerHTML = `<div class="cabecera"><h1>Producción</h1></div>
        <div class="tarjeta aviso" style="border-color:var(--malo)">
          <b>No se pudo leer ${A.esc(RUTA)}.</b>
          ${error ? A.esc(error.message || String(error)) : ''}</div>`;
      return;
    }

    A.$('#contenido').innerHTML = `
      <div class="cabecera"><h1>Producción</h1>
        <span class="sub">Dónde va cada placa · actualizado ${A.esc(A.fecha(datos.actualizado))}</span></div>

      <div class="tarjeta" style="margin-bottom:16px">
        <h2>El proceso</h2>
        <div class="fases-rail">
          ${(datos.proceso || []).map(f => `
            <div class="fase-mini${f.compuerta ? ' compuerta' : ''}">
              <span class="n">${String(f.n).padStart(2, '0')}</span>
              <span class="q">${A.esc(f.q)}</span>
              <span class="d">${A.esc(f.dueno)}</span>
            </div>`).join('')}
        </div>
        ${datos.notaProceso ? `<p style="font-size:12.5px;color:var(--apagado);margin:12px 0 0">
          ${A.esc(datos.notaProceso)}</p>` : ''}
      </div>

      ${piezasHtml(datos.piezas || [])}

      <div class="rejilla" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr));margin-top:16px">
        ${datos.abierto ? abiertoHtml(datos.abierto) : ''}
        ${decisionesHtml(datos.decisiones || [])}
      </div>`;
  }

  function piezasHtml(piezas) {
    if (!piezas.length) return '<div class="tarjeta"><div class="vacio">No hay piezas en curso.</div></div>';
    const total = (datos.proceso || []).length || 9;
    let grupoActual = null, html = '';
    for (const p of piezas) {
      if (p.grupo !== grupoActual) {
        grupoActual = p.grupo;
        html += `<div class="grupo-pieza">${A.esc(grupoActual)}</div>`;
      }
      const est = ESTADOS[p.estado] || ESTADOS.espera;
      html += `
        <div class="tarjeta pieza${p.alerta ? ' aviso' : ''}" style="${p.alerta ? 'border-color:var(--malo)' : ''}">
          <div class="pieza-cab">
            <span class="pieza-nombre">${A.esc(p.nombre)}</span>
            <span class="etiqueta" style="color:${est.color}">${A.esc(est.txt)}</span>
          </div>
          <p style="font-size:13.5px;margin:4px 0 10px">${A.esc(p.nota || '')}</p>
          <div class="barra-fases">
            ${Array.from({ length: total }, (_, i) => {
              const n = i + 1;
              let cls = '';
              if (n < p.fase) cls = 'ok';
              else if (n === p.fase) {
                // La fase actual pinta distinto según el estado de la pieza, no solo su
                // número: "hecho" significa que ESTA fase también quedó cerrada (azul,
                // como las anteriores), no que está en curso (naranja).
                if (p.estado === 'hecho') cls = 'ok';
                else if (p.estado === 'problema') cls = 'mal';
                else if (p.estado === 'turno') cls = 'aqui';
                // 'espera' deja la casilla sin pintar: no se ha llegado a intentarla.
              }
              return `<span class="${cls}"></span>`;
            }).join('')}
          </div>
          <div class="pieza-pie"><span>fase <b>${p.fase}</b> de ${total}</span></div>
        </div>`;
    }
    return `<div class="piezas-lista">${html}</div>`;
  }

  function abiertoHtml(a) {
    return `<div class="tarjeta aviso" style="border-color:var(--malo)">
      <h2>${A.esc(a.titulo)}</h2>
      <p>${A.esc(a.texto)}</p>
      ${(a.medidas || []).length ? `<table style="margin-top:10px"><thead><tr>
        <th>Se midió</th><th>Este caso</th><th>Referencia</th>
      </tr></thead><tbody>
        ${a.medidas.map(m => `<tr><td>${A.esc(m.que)}</td><td class="num">${A.esc(m.briones)}</td><td class="num">${A.esc(m.lidcar)}</td></tr>`).join('')}
      </tbody></table>` : ''}
      ${a.pie ? `<p style="font-size:12.5px;color:var(--apagado);margin-top:10px">${A.esc(a.pie)}</p>` : ''}
    </div>`;
  }

  function decisionesHtml(lista) {
    if (!lista.length) return '';
    return `<div class="tarjeta">
      <h2>Decisiones pendientes</h2>
      ${lista.map(d => `<div class="decision-item">
        <b>${A.esc(d.titulo)}</b>
        <span>${A.esc(d.texto)}</span>
      </div>`).join('')}
    </div>`;
  }

  window.Vistas = window.Vistas || {};
  Vistas.produccion = { pintar };
})();
