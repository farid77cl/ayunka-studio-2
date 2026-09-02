/* Vista: clientes. Liviana a propósito: lo que importa es qué le debe cada uno. */
(function () {
  function pintar() {
    const cs = Datos.activos('clientes');
    let h = `<div class="cabecera"><h1>Clientes</h1><span class="sub">${cs.length}</span>
      <div class="acciones"><button class="btn primario" onclick="Vistas.clientes.nuevo()">Nuevo cliente</button></div></div>
      <div class="tarjeta"><table><thead><tr>
        <th>Nombre</th><th>Tipo</th><th>Contacto</th><th class="num">Pedidos</th><th class="num">Saldo</th>
      </tr></thead><tbody>`;

    cs.forEach(c => {
      const peds = Datos.activos('pedidos').filter(p => p.clienteId === c.id);
      const saldo = peds.filter(p => p.estado !== 'entregado')
        .reduce((s, p) => s + (Costos.calcularPedido(p).saldo || 0), 0);
      h += `<tr onclick="Vistas.clientes.abrir('${A.esc(c.id)}')" style="cursor:pointer">
        <td><b>${A.esc(c.nombre)}</b>${c.notas ? `<div style="font-size:12px;color:var(--apagado)">${A.esc(c.notas)}</div>` : ''}</td>
        <td><span class="etiqueta">${A.esc(c.tipo === 'empresa' ? 'Empresa' : 'Persona')}</span></td>
        <td style="color:var(--apagado)">${A.esc(c.contacto || '—')}</td>
        <td class="num">${peds.length}</td>
        <td class="num"><b>${saldo ? A.plata(saldo) : '—'}</b></td></tr>`;
    });

    h += `</tbody></table>${cs.length ? '' : '<div class="vacio"><b>Sin clientes</b>Agrega uno para poder registrar pedidos con abono y saldo.</div>'}</div>`;
    A.$('#contenido').innerHTML = h;
  }

  function abrir(id) {
    const c = Datos.obtener('clientes', id);
    if (!c) return;
    A.preguntar({
      titulo: c.nombre,
      cuerpo: `<div class="formulario">
        ${A.campo('c-nombre', 'Nombre', c.nombre, { ancho: true })}
        ${A.selector('c-tipo', 'Tipo', c.tipo, [{ v: 'persona', t: 'Persona' }, { v: 'empresa', t: 'Empresa' }])}
        ${A.campo('c-contacto', 'Contacto', c.contacto, { ph: 'teléfono, Instagram o correo' })}
        </div>
        <label class="campo"><span>Notas</span><textarea id="c-notas" rows="3">${A.esc(c.notas || '')}</textarea></label>`,
      leer: n => {
        const v = i => { const e = n.querySelector('#' + i); return e ? e.value : ''; };
        return { nombre: v('c-nombre'), tipo: v('c-tipo'), contacto: v('c-contacto'), notas: v('c-notas') };
      },
      botones: [{ txt: 'Cancelar', valor: null, clase: 'sutil' }, { txt: 'Guardar', valor: 'ok', clase: 'primario' }]
    }).then(({ valor, datos }) => {
      if (!valor) return;
      Object.assign(c, datos); Datos.guardar('cliente'); A.aviso('Guardado'); pintar();
    });
  }

  function nuevo() {
    const c = Datos.agregar('clientes', { nombre: 'Cliente nuevo', tipo: 'persona', contacto: '', notas: '', activo: true });
    Datos.guardar('nuevo cliente'); pintar(); abrir(c.id);
  }

  window.Vistas = window.Vistas || {};
  Vistas.clientes = { pintar, abrir, nuevo };
})();
