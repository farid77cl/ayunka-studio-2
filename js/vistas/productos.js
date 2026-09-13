/* Vista: Productos. Catálogo con costo/precio por oficio. */
(function () {
  const CATS = {
    'bordado-costura': 'Bordado y costura', 'personalizados': 'Personalizados 3D',
    'empresas': 'Empresas (B2B)', 'sin-categoria': 'Sin categoría'
  };
  const OFICIOS = [{ v: '3d', t: 'Impresión 3D' }, { v: 'bordado', t: 'Bordado' }, { v: 'costura', t: 'Costura' }];
  const claseOficio = o => o === 'bordado' ? 'bordado' : o === 'costura' ? 'costura' : 'd3';

  function opcionesFilamento() {
    const rollos = Datos.activos('filamentos').map(f => ({ v: f.id, t: (f.material || 'PLA') + ' · ' + (f.marca || '') + (f.color ? ' ' + f.color : '') }));
    return [{ v: '', t: '(genérico, según el material)' }].concat(rollos);
  }

  let filtro = '';

  function pintar() {
    const todos = Datos.activos('productos');
    const ps = todos.filter(p => !filtro || (p.nombre + ' ' + (p.sku || '')).toLowerCase().includes(filtro.toLowerCase()));
    const porCat = {};
    ps.forEach(p => (porCat[p.categoria || 'sin-categoria'] = porCat[p.categoria || 'sin-categoria'] || []).push(p));

    let h = `<div class="cabecera"><h1>Productos</h1><span class="sub">${ps.length} de ${todos.length}</span>
      <div class="acciones">
        <input id="buscar" class="btn" style="min-width:200px" placeholder="Buscar…" value="${A.esc(filtro)}">
        <button class="btn" onclick="Vistas.productos.exportarCatalogoMeta()">Exportar catálogo (Meta)</button>
        <button class="btn primario" onclick="Vistas.productos.nuevo()">Nuevo producto</button>
      </div></div>`;

    Object.keys(CATS).forEach(cat => {
      const lista = porCat[cat];
      if (!lista || !lista.length) return;
      h += `<div class="tarjeta"><h2>${A.esc(CATS[cat])} · ${lista.length}</h2>
        <table><thead><tr><th>SKU</th><th>Producto</th><th>Oficio</th>
          <th class="num">Costo</th><th class="num">Sugerido</th><th class="num">Precio</th></tr></thead><tbody>
        ${lista.map(p => {
          const c = Costos.calcular(p);
          return `<tr onclick="Vistas.productos.abrir('${A.esc(p.id)}')" style="cursor:pointer">
            <td style="color:var(--apagado);font-size:12.5px">${A.esc(p.sku || '—')}</td>
            <td><b>${A.esc(p.nombre)}</b></td>
            <td><span class="etiqueta ${claseOficio(p.oficio)}">${p.oficio === '3d' ? '3D' : A.esc(p.oficio)}</span></td>
            <td class="num">${c.completo ? A.plata(c.costo) : '—'}</td>
            <td class="num" style="color:var(--pizarra)">${c.sugerido == null ? '—' : A.plata(c.sugerido)}</td>
            <td class="num"><b>${c.precio == null ? '—' : A.plata(c.precio)}</b></td></tr>`;
        }).join('')}</tbody></table></div>`;
    });
    if (!ps.length) h += '<div class="tarjeta"><div class="vacio"><b>No hay productos que coincidan</b></div></div>';
    A.$('#contenido').innerHTML = h;
    const b = A.$('#buscar');
    if (b) { b.oninput = e => { filtro = e.target.value; pintar(); A.$('#buscar').focus(); }; if (filtro) b.focus(); }
  }

  function abrir(id) {
    const p = Datos.obtener('productos', id);
    if (!p) return;
    const c = Costos.calcular(p);
    A.preguntar({
      titulo: p.nombre,
      cuerpo: `<div class="formulario">
        ${A.campo('p-nombre', 'Nombre', p.nombre, { ancho: true })}
        ${A.campo('p-sku', 'SKU', p.sku || '')}
        ${A.selector('p-oficio', 'Oficio', p.oficio || '3d', OFICIOS)}
        ${A.selector('p-categoria', 'Categoría', p.categoria || 'sin-categoria', Object.keys(CATS).map(k => ({ v: k, t: CATS[k] })))}
        ${p.oficio === '3d' ? `
          ${A.campo('p-gramos', 'Gramos', p.gramos ?? '', { tipo: 'number', unidad: 'g' })}
          ${A.campo('p-horas', 'Horas de máquina', p.horas ?? '', { tipo: 'number', paso: '0.01', unidad: 'h' })}
          ${A.selector('p-filamento', 'Filamento', p.filamentoId || '', opcionesFilamento())}
          ${A.campo('p-ancho', 'Ancho de la pieza', p.anchoMm ?? '', { tipo: 'number', unidad: 'mm' })}
          ${A.campo('p-largo', 'Largo de la pieza', p.largoMm ?? '', { tipo: 'number', unidad: 'mm' })}
        ` : `${A.campo('p-horastrabajo', 'Horas de trabajo a mano', p.horasTrabajo ?? '', { tipo: 'number', paso: '0.1', unidad: 'h' })}`}
        ${A.campo('p-extra', 'Costo extra', p.extraCosto || 0, { tipo: 'number', signo: '$' })}
        ${A.campo('p-precio', 'Precio de venta', p.precio ?? '', { tipo: 'number', signo: '$' })}
      </div>
      ${p.oficio === '3d' ? '<p style="font-size:12px;color:var(--apagado);margin:-4px 0 10px">Ancho y largo aproximados de la pieza en la placa (mirando desde arriba) -- se usan para armar Bandejas mixtas.</p>' : ''}
      <div class="desglose">
        ${c.completo ? c.lineas.map(l => `<div class="fila"><div class="c"><span class="punto" style="background:var(--c-${l.color})"></span><span>${A.esc(l.concepto)}${l.nota ? `<span class="n">${A.esc(l.nota)}</span>` : ''}</span></div><div class="m">${A.plata(l.monto)}</div></div>`).join('')
          + `<div class="fila total"><div class="c"><b>Costo</b></div><div class="m">${A.plata(c.costo)}</div></div>`
          : `<p style="font-size:13px;color:var(--terra)">Falta: ${(c.faltan || []).join(', ')} -- sin eso no se calcula el costo.</p>`}
      </div>
      ${c.completo ? `<button type="button" class="btn chico" onclick="document.getElementById('p-precio').value=${c.sugerido}">Usar sugerido (${A.plata(c.sugerido)})</button>` : ''}`,
      leer: n => {
        const v = i => { const e = n.querySelector('#' + i); return e ? e.value : ''; };
        const oficio = v('p-oficio');
        const base = { nombre: v('p-nombre'), sku: v('p-sku'), oficio, categoria: v('p-categoria'),
                       extraCosto: A.num(v('p-extra')), precio: v('p-precio') === '' ? null : A.num(v('p-precio')) };
        if (oficio === '3d') return Object.assign(base, { gramos: v('p-gramos') === '' ? null : A.num(v('p-gramos')),
          horas: v('p-horas') === '' ? null : A.num(v('p-horas')), filamentoId: v('p-filamento') || null,
          anchoMm: v('p-ancho') === '' ? null : A.num(v('p-ancho')), largoMm: v('p-largo') === '' ? null : A.num(v('p-largo')) });
        return Object.assign(base, { horasTrabajo: v('p-horastrabajo') === '' ? null : A.num(v('p-horastrabajo')) });
      },
      botones: [{ txt: 'Cancelar', valor: null, clase: 'sutil' }, { txt: 'Guardar', valor: 'ok', clase: 'primario' }]
    }).then(({ valor, datos }) => {
      if (!valor) return;
      Object.assign(p, datos);
      Datos.guardar('producto');
      A.aviso('Producto guardado');
      pintar();
    });
  }

  function nuevo() {
    const p = Datos.agregar('productos', { sku: '', nombre: 'Producto nuevo', categoria: 'sin-categoria', oficio: '3d',
      material: 'PLA', gramos: null, horas: null, colores: 1, postMin: 0, precio: null, stock: 0, filamentoId: null,
      anchoMm: null, largoMm: null, foto: '', descripcion: '', extraCosto: 0, extraNota: '', activo: true });
    Datos.guardar('nuevo producto');
    pintar();
    abrir(p.id);
  }

  function csvCelda(v) {
    const s = String(v == null ? '' : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function exportarCatalogoMeta() {
    const productos = Datos.activos('productos').filter(p => typeof p.precio === 'number');
    if (!productos.length) { A.aviso('No hay productos con precio para exportar', 'error'); return; }
    const columnas = ['id', 'title', 'description', 'availability', 'condition', 'price', 'link', 'image_link', 'brand'];
    const filas = [columnas.join(',')];
    productos.forEach(p => {
      filas.push([csvCelda(p.sku || p.id), csvCelda(p.nombre), csvCelda(p.descripcion || ''), 'in stock', 'new',
        csvCelda(Math.round(p.precio) + ' CLP'), csvCelda('https://wa.me/56985421490?text=' + encodeURIComponent('Hola! Me interesa: ' + p.nombre)),
        csvCelda(p.foto || ''), 'Ayünka'].join(','));
    });
    const blob = new Blob([filas.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'catalogo-meta-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    A.aviso(productos.length + ' productos exportados.');
  }

  window.Vistas = window.Vistas || {};
  Vistas.productos = { pintar, abrir, nuevo, exportarCatalogoMeta, CATS };
})();
