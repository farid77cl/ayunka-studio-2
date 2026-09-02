/* Vista: filamentos. Qué hay, cuánto queda y cuánto cuesta el gramo. */
(function () {
  function pintar() {
    const fs = Datos.activos('filamentos');
    const gramoDe = f => (f.gramosRollo > 0 ? f.precioRollo / f.gramosRollo : 0);
    const totalQueda = fs.reduce((s, f) => s + (f.gramosQuedan || 0), 0);
    const valorQueda = fs.reduce((s, f) => s + (f.gramosQuedan || 0) * gramoDe(f), 0);

    let h = `<div class="cabecera"><h1>Filamentos</h1>
      <span class="sub">${fs.length} rollos</span>
      <div class="acciones"><button class="btn primario" onclick="Vistas.filamentos.nuevo()">Nuevo rollo</button></div></div>
      <div class="rejilla" style="margin-bottom:16px">
        <div class="dato"><div class="k">Material en casa</div><div class="v">${(totalQueda / 1000).toFixed(1)} kg</div>
          <div class="n">repartido en ${fs.length} rollos</div></div>
        <div class="dato"><div class="k">Vale</div><div class="v">${A.plata(valorQueda)}</div>
          <div class="n">a precio de compra</div></div>
      </div>
      <div class="tarjeta"><table><thead><tr>
        <th></th><th>Marca y color</th><th>Material</th>
        <th class="num">Rollo</th><th class="num">$/g</th><th class="num">Queda</th><th></th>
      </tr></thead><tbody>`;

    fs.forEach(f => {
      const pct = f.gramosRollo ? Math.max(0, Math.min(100, (f.gramosQuedan / f.gramosRollo) * 100)) : 0;
      h += `<tr onclick="Vistas.filamentos.abrir('${A.esc(f.id)}')" style="cursor:pointer">
        <td><span style="display:inline-block;width:18px;height:18px;border-radius:5px;border:1px solid var(--borde);background:${A.esc(f.hex || '#ccc')}"></span></td>
        <td><b>${A.esc(f.marca || '—')}</b> · ${A.esc(f.color || '')}</td>
        <td><span class="etiqueta">${A.esc(f.material || 'PLA')}</span></td>
        <td class="num">${A.plata(f.precioRollo)}</td>
        <td class="num">${A.plata(gramoDe(f))}</td>
        <td class="num">${Math.round(f.gramosQuedan || 0)} g</td>
        <td style="width:110px"><div class="barra">
          <div style="width:${pct}%;background:${pct < 20 ? 'var(--malo)' : 'var(--c-luz)'}"></div></div></td>
      </tr>`;
    });

    h += `</tbody></table>${fs.length ? '' : '<div class="vacio"><b>Todavía no hay rollos</b>Agrega uno para que los costos usen su precio real.</div>'}</div>`;
    A.$('#contenido').innerHTML = h;
  }

  function abrir(id) {
    const f = Datos.obtener('filamentos', id);
    if (!f) return;
    A.preguntar({
      titulo: `${f.marca || 'Rollo'} · ${f.color || ''}`,
      cuerpo: `<div class="formulario">
        ${A.campo('f-marca', 'Marca', f.marca)}
        ${A.campo('f-color', 'Color', f.color)}
        ${A.selector('f-mat', 'Material', f.material, [{ v: 'PLA', t: 'PLA' }, { v: 'PETG', t: 'PETG' }, { v: 'TPU', t: 'TPU' }, { v: 'ABS', t: 'ABS' }])}
        ${A.campo('f-hex', 'Color (hex)', f.hex, { tipo: 'color' })}
        ${A.campo('f-precio', 'Precio del rollo', f.precioRollo, { tipo: 'number', signo: '$' })}
        ${A.campo('f-gramos', 'Gramos del rollo', f.gramosRollo, { tipo: 'number', unidad: 'g' })}
        ${A.campo('f-queda', 'Gramos que quedan', f.gramosQuedan, { tipo: 'number', unidad: 'g' })}
      </div>`,
      leer: n => {
        const v = i => { const e = n.querySelector('#' + i); return e ? e.value : ''; };
        return { marca: v('f-marca'), color: v('f-color'), material: v('f-mat'), hex: v('f-hex'),
                 precioRollo: A.num(v('f-precio')), gramosRollo: A.num(v('f-gramos')), gramosQuedan: A.num(v('f-queda')) };
      },
      botones: [{ txt: 'Cancelar', valor: null, clase: 'sutil' },
                { txt: 'Ya no lo tengo', valor: 'quitar' },
                { txt: 'Guardar', valor: 'guardar', clase: 'primario' }]
    }).then(({ valor, datos }) => {
      if (!valor) return;
      if (valor === 'quitar') { Datos.quitar('filamentos', id); A.aviso('Rollo archivado'); }
      else { Object.assign(f, datos); A.aviso('Guardado'); }
      Datos.guardar('filamento');
      pintar();
    });
  }

  function nuevo() {
    const f = Datos.agregar('filamentos', { marca: '', color: '', material: 'PLA', hex: '#cccccc',
      precioRollo: 0, gramosRollo: 1000, gramosQuedan: 1000, activo: true });
    Datos.guardar('nuevo filamento'); pintar(); abrir(f.id);
  }

  window.Vistas = window.Vistas || {};
  Vistas.filamentos = { pintar, abrir, nuevo };
})();
