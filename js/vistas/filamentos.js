/* Vista: Filamentos. Inventario de rollos. */
(function () {
  function pintar() {
    const fs = Datos.activos('filamentos');
    A.$('#contenido').innerHTML = `
      <div class="cabecera"><h1>Filamentos</h1><span class="sub">${fs.length}</span>
        <div class="acciones"><button class="btn primario" onclick="Vistas.filamentos.nuevo()">Nuevo rollo</button></div></div>
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

  window.Vistas = window.Vistas || {};
  Vistas.filamentos = { pintar, abrir, nuevo };
})();
