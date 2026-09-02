/* Vista: productos. La tabla es la que responde «¿cuánto cobro?» sin abrir nada. */
(function () {
  const CATS = {
    'bordado-costura': 'Bordado y costura',
    'utiles-costura': 'Útiles de costura 3D',
    'juguetes': 'Juguetes y fidgets',
    'personalizados': 'Personalizados 3D',
    'deco': 'Deco 3D',
    'empresas': 'Empresas (B2B)',
    'sin-categoria': 'Sin categoría'
  };
  const OFICIOS = [{ v: 'bordado', t: 'Bordado' }, { v: 'costura', t: 'Costura' }, { v: '3d', t: 'Impresión 3D' }];
  const claseOficio = o => o === 'bordado' ? 'bordado' : o === 'costura' ? 'costura' : 'd3';

  let filtro = '';

  function pintar() {
    const ps = Datos.activos('productos')
      .filter(p => !filtro || (p.nombre + ' ' + p.sku).toLowerCase().includes(filtro.toLowerCase()));

    const todos = Datos.activos('productos');
    const sinPrecio = todos.filter(p => typeof p.precio !== 'number').length;
    const incompletos = todos.filter(p => Costos.queFalta(p)).length;

    const porCat = {};
    ps.forEach(p => (porCat[p.categoria] = porCat[p.categoria] || []).push(p));

    let html = `
      <div class="cabecera">
        <h1>Productos</h1>
        <span class="sub">${ps.length} de ${Datos.activos('productos').length}</span>
        <div class="acciones">
          <input id="buscar" class="btn" style="min-width:200px" placeholder="Buscar…" value="${A.esc(filtro)}">
          <button class="btn primario" onclick="Vistas.productos.nuevo()">Nuevo producto</button>
        </div>
      </div>`;

    if (incompletos) {
      html += `<div class="tarjeta aviso">
        <b>${incompletos} productos no se pueden costear todavía</b> — salen con «—» en las
        columnas de costo y sugerido. A los de 3D les faltan los gramos o las horas de máquina;
        a los de bordado y costura, las horas de trabajo a mano. Mientras falten, esta app
        <b>no inventa un precio sugerido</b>: prefiere decir que no sabe.</div>`;
    }
    if (sinPrecio) {
      html += `<div class="tarjeta">
        <b>${sinPrecio} de ${todos.length} productos no tienen precio de venta.</b>
        Los que sí tienen el costo completo traen un sugerido calculado con tu margen: se pone
        con un click desde la ficha. Es, probablemente, la tarea de mayor retorno pendiente.</div>`;
    }

    Object.keys(CATS).forEach(cat => {
      const lista = porCat[cat];
      if (!lista || !lista.length) return;
      html += `<div class="tarjeta"><h2>${A.esc(CATS[cat])} · ${lista.length}</h2>
        <table><thead><tr>
          <th>SKU</th><th>Producto</th><th>Oficio</th>
          <th class="num">Costo</th><th class="num">Sugerido</th><th class="num">Precio</th><th></th>
        </tr></thead><tbody>`;
      lista.forEach(p => {
        const c = Costos.calcular(p);
        html += `<tr onclick="Vistas.productos.abrir('${A.esc(p.id)}')" style="cursor:pointer">
          <td style="color:var(--apagado);font-size:12.5px">${A.esc(p.sku || '—')}</td>
          <td><b>${A.esc(p.nombre)}</b></td>
          <td><span class="etiqueta ${claseOficio(p.oficio)}">${p.oficio === '3d' ? '3D' : A.esc(p.oficio)}</span></td>
          <td class="num">${c.completo ? A.plata(c.costo) : '—'}</td>
          <td class="num" style="color:var(--pizarra)">${c.sugerido === null ? '—' : A.plata(c.sugerido)}</td>
          <td class="num"><b>${c.precio === null ? '—' : A.plata(c.precio)}</b></td>
          <td>${c.completo && c.alerta ? `<span class="chip ${c.alerta.nivel}">${A.esc(c.alerta.texto)}</span>` : ''}</td>
        </tr>`;
      });
      html += `</tbody></table></div>`;
    });

    if (!ps.length) html += `<div class="tarjeta"><div class="vacio"><b>No hay productos que coincidan</b>Prueba con otra búsqueda.</div></div>`;

    A.$('#contenido').innerHTML = html;
    const b = A.$('#buscar');
    if (b) {
      b.oninput = e => { filtro = e.target.value; pintar(); A.$('#buscar').focus(); };
      if (filtro) { b.focus(); b.setSelectionRange(filtro.length, filtro.length); }
    }
  }

  function abrir(id) {
    const p = Datos.obtener('productos', id);
    if (!p) return;
    const c = Costos.calcular(p);
    const es3d = p.oficio === '3d';

    const desglose = c.lineas.map(l => `<div class="fila">
      <div class="c"><span class="punto" style="background:var(--c-${l.color})"></span>
        <span>${A.esc(l.concepto)}${l.nota ? `<span class="n">${A.esc(l.nota)}</span>` : ''}</span></div>
      <div class="m">${A.plata(l.monto)}</div></div>`).join('') +
      `<div class="fila total"><div class="c"><b>Costo por unidad</b></div><div class="m">${c.completo ? A.plata(c.costo) : '—'}</div></div>
       <div class="fila"><div class="c">Margen ×${c.margen} <span class="n">(${A.esc(p.oficio)})</span></div>
         <div class="m" style="color:var(--pizarra)">${c.sugerido === null ? '—' : A.plata(c.sugerido)}</div></div>` +
      (c.falta ? `<p style="margin:10px 0 0;font-size:13px;color:var(--terra)">
        Este costo está incompleto: <b>${A.esc(c.falta)}</b>. Hasta que estén, no hay precio
        sugerido — un cálculo sin su insumo principal es un cero disfrazado de número.</p>` : '');

    const cuerpo = `
      <div class="formulario">
        ${A.campo('p-nombre', 'Nombre', p.nombre, { ancho: true })}
        ${A.campo('p-sku', 'SKU', p.sku)}
        ${A.selector('p-oficio', 'Oficio', p.oficio, OFICIOS)}
        ${A.selector('p-cat', 'Categoría', p.categoria, Object.keys(CATS).map(k => ({ v: k, t: CATS[k] })))}
        ${es3d ? `
          ${A.campo('p-gramos', 'Gramos', p.gramos, { tipo: 'number', paso: '0.1' })}
          ${A.campo('p-horas', 'Horas de máquina', p.horas, { tipo: 'number', paso: '0.01' })}
          ${A.selector('p-material', 'Material', p.material, [{ v: 'PLA', t: 'PLA' }, { v: 'PETG', t: 'PETG' }])}
          ${A.campo('p-post', 'Post-proceso (min)', p.postMin, { tipo: 'number' })}
        ` : `
          ${A.campo('p-horasmano', 'Horas de trabajo a mano', p.horasMano || 0, { tipo: 'number', paso: '0.25' })}
          ${A.campo('p-materiales', 'Costo de materiales', p.costoMateriales || 0, { tipo: 'number' })}
          ${A.campo('p-notamat', 'Qué materiales', p.notaMateriales || '', { ancho: true })}
        `}
        ${A.campo('p-precio', 'Precio de venta', p.precio == null ? '' : p.precio,
                  { tipo: 'number', ph: c.sugerido === null ? 'faltan datos para sugerir' : 'sugerido: ' + c.sugerido })}
        ${A.campo('p-stock', 'Stock', p.stock || 0, { tipo: 'number' })}
      </div>
      <h3 style="font-size:13px;text-transform:uppercase;letter-spacing:.5px;color:var(--pizarra);margin:16px 0 8px">Dónde está la plata</h3>
      <div class="desglose">${desglose}</div>
      ${p.descripcion ? `<p style="color:var(--apagado);font-size:13px;margin-top:14px">${A.esc(p.descripcion)}</p>` : ''}
      ${p.archivoOrigen ? `<p style="color:var(--apagado);font-size:12px">Origen: ${A.esc(p.archivoOrigen)}</p>` : ''}`;

    A.preguntar({
      titulo: p.nombre,
      cuerpo,
      leer: nodo => {
        const v = id => { const e = nodo.querySelector('#' + id); return e ? e.value : undefined; };
        const d = {
          nombre: v('p-nombre'), sku: v('p-sku'), oficio: v('p-oficio'), categoria: v('p-cat'),
          precio: v('p-precio') === '' ? null : A.num(v('p-precio')),
          stock: A.num(v('p-stock'))
        };
        if (v('p-gramos') !== undefined) Object.assign(d, {
          gramos: A.num(v('p-gramos')), horas: A.num(v('p-horas')),
          material: v('p-material'), postMin: A.num(v('p-post'))
        });
        if (v('p-horasmano') !== undefined) Object.assign(d, {
          horasMano: A.num(v('p-horasmano')), costoMateriales: A.num(v('p-materiales')),
          notaMateriales: v('p-notamat')
        });
        return d;
      },
      botones: [
        { txt: 'Cancelar', valor: null, clase: 'sutil' }
      ].concat(c.sugerido === null ? [] : [{ txt: 'Usar el sugerido', valor: 'sugerido' }])
       .concat([{ txt: 'Guardar', valor: 'guardar', clase: 'primario' }])
    }).then(({ valor, datos }) => {
      if (!valor) return;
      if (datos) Object.assign(p, datos);
      if (valor === 'sugerido') {
        const s = Costos.calcular(p).sugerido;
        if (s === null) { A.aviso('Todavía faltan datos para sugerir un precio', 'error'); return; }
        p.precio = s;
        A.aviso('Precio puesto en ' + A.plata(p.precio));
      }
      Datos.guardar('editar producto');
      if (valor === 'guardar') A.aviso('Guardado');
      pintar();
    });
  }

  function nuevo() {
    const p = {
      id: Datos.nuevoId('prod'), sku: '', nombre: 'Producto nuevo', categoria: 'sin-categoria',
      oficio: '3d', material: 'PLA', gramos: 0, horas: 0, colores: 1, postMin: 0,
      precio: null, stock: 0, filamentoId: null, foto: '', descripcion: '',
      extraCosto: 0, extraNota: '', activo: true
    };
    Datos.agregar('productos', p);
    Datos.guardar('nuevo producto');
    pintar();
    abrir(p.id);
  }

  window.Vistas = window.Vistas || {};
  Vistas.productos = { pintar, abrir, nuevo, CATS };
})();
