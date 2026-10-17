/* Vista: Filamentos. Inventario de rollos. */
(function () {
  function pintar() {
    const fs = Datos.activos('filamentos');
    A.$('#contenido').innerHTML = `
      <div class="cabecera"><h1>Filamentos</h1><span class="sub">${fs.length}</span>
        <div class="acciones">
          <button class="btn" onclick="Vistas.filamentos.sincronizarSpoolman()">🔄 Sincronizar Spoolman</button>
          <button class="btn primario" onclick="Vistas.filamentos.nuevo()">Nuevo rollo</button>
        </div></div>
      <div class="tarjeta"><table><thead><tr><th></th><th>Material</th><th>Marca / color</th>
        <th class="num">Quedan</th><th class="num">$/g</th><th></th></tr></thead><tbody>
        ${fs.map(f => `<tr onclick="Vistas.filamentos.abrir('${A.esc(f.id)}')" style="cursor:pointer">
          <td><span style="display:inline-block;width:18px;height:18px;border-radius:5px;border:1px solid var(--borde);background:${A.esc(f.hex || '#ccc')}"></span></td>
          <td>${A.esc(f.material || 'PLA')}</td>
          <td>${A.esc(f.marca || '')} ${A.esc(f.color || '')}</td>
          <td class="num">${(f.gramosQuedan || 0).toLocaleString('es-CL')} g</td>
          <td class="num">$${Math.round((f.precioKg || 0) / 1000)}</td>
          <td>${(f.gramosQuedan || 0) < 200 ? '<span class="chip bajo">bajo stock</span>' : ''}</td></tr>`).join('')}
      </tbody></table>${fs.length ? '' : '<div class="vacio"><b>Sin filamentos todavía</b></div>'}</div>`;
  }

  function abrir(id) {
    const f = Datos.obtener('filamentos', id);
    if (!f) return;
    A.preguntar({
      titulo: (f.marca || 'Rollo') + ' ' + (f.color || ''),
      cuerpo: `<div class="formulario">
        ${A.campo('f-material', 'Material', f.material || 'PLA')}
        ${A.campo('f-marca', 'Marca', f.marca || '')}
        ${A.campo('f-color', 'Color', f.color || '')}
        ${A.campo('f-hex', 'Color (hex)', f.hex || '#cccccc')}
        ${A.campo('f-precio', 'Precio del kilo', f.precioKg || 0, { tipo: 'number', signo: '$' })}
        ${A.campo('f-gramos', 'Gramos que quedan', f.gramosQuedan || 0, { tipo: 'number', unidad: 'g' })}</div>`,
      leer: n => {
        const v = i => (n.querySelector('#' + i) || {}).value || '';
        return { material: v('f-material'), marca: v('f-marca'), color: v('f-color'), hex: v('f-hex'),
                 precioKg: A.num(v('f-precio')), gramosQuedan: A.num(v('f-gramos')) };
      },
      botones: [{ txt: 'Cancelar', valor: null, clase: 'sutil' }, { txt: 'Guardar', valor: 'ok', clase: 'primario' }]
    }).then(({ valor, datos }) => {
      if (!valor) return;
      Object.assign(f, datos);
      Datos.guardar('filamento');
      A.aviso('Rollo guardado');
      pintar();
    });
  }

  function nuevo() {
    const f = Datos.agregar('filamentos', { material: 'PLA', marca: '', color: '', hex: '#cccccc', precioKg: 15000, gramosQuedan: 1000, activo: true });
    Datos.guardar('nuevo rollo');
    pintar();
    abrir(f.id);
  }

  async function sincronizarSpoolman() {
    try {
      A.aviso('Consultando Spoolman…');
      const r = await fetch('/api/spoolman/spool');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const bobinas = await r.json();
      let agregados = 0, actualizados = 0;
      bobinas.forEach(b => {
        if (b.archived) return;
        const fil = b.filament || {};
        const vendor = (fil.vendor || {}).name || '';
        const nombre = fil.name || 'PLA';
        const mat = fil.material || 'PLA';
        const hex = fil.color_hex ? '#' + fil.color_hex.replace('#', '') : '#cccccc';
        const precio = b.price || (fil.price) || 16000;
        const gramos = Math.round(b.remaining_weight != null ? b.remaining_weight : (fil.weight || 1000));
        
        let f = Datos.activos('filamentos').find(item => item.spoolmanId === b.id || (item.marca === vendor && item.color === nombre));
        if (f) {
          f.spoolmanId = b.id;
          f.gramosQuedan = gramos;
          f.precioKg = precio;
          actualizados++;
        } else {
          Datos.agregar('filamentos', {
            spoolmanId: b.id,
            material: mat,
            marca: vendor,
            color: nombre,
            hex: hex,
            precioKg: precio,
            gramosQuedan: gramos,
            activo: true
          });
          agregados++;
        }
      });
      Datos.guardar('sincronización con Spoolman');
      A.aviso(`Spoolman: ${agregados} nuevos, ${actualizados} actualizados.`);
      pintar();
    } catch (e) {
      A.aviso('Error al conectar con Spoolman: ' + e.message, 'error');
    }
  }

  window.Vistas = window.Vistas || {};
  Vistas.filamentos = { pintar, abrir, nuevo, sincronizarSpoolman };
})();
