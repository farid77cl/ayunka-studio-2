/* Vista: Clientes. CRM liviano. */
(function () {
  function pintar() {
    const cs = Datos.activos('clientes');
    A.$('#contenido').innerHTML = `
      <div class="cabecera"><h1>Clientes</h1><span class="sub">${cs.length}</span>
        <div class="acciones"><button class="btn primario" onclick="Vistas.clientes.nuevo()">Nuevo cliente</button></div></div>
      <div class="tarjeta"><table><thead><tr><th>Nombre</th><th>Tipo</th><th>Contacto</th></tr></thead><tbody>
        ${cs.map(c => `<tr onclick="Vistas.clientes.abrir('${A.esc(c.id)}')" style="cursor:pointer">
          <td><b>${A.esc(c.nombre)}</b>${c.notas ? `<div style="font-size:12px;color:var(--apagado)">${A.esc(c.notas)}</div>` : ''}</td>
          <td><span class="etiqueta">${c.tipo === 'empresa' ? 'Empresa' : 'Persona'}</span></td>
          <td>${A.esc(c.contacto || '—')}</td></tr>`).join('')}
      </tbody></table>${cs.length ? '' : '<div class="vacio"><b>Sin clientes todavía</b></div>'}</div>`;
  }

  function abrir(id) {
    const c = Datos.obtener('clientes', id);
    if (!c) return;
    A.preguntar({
      titulo: c.nombre,
      cuerpo: `<div class="formulario">
        ${A.campo('c-nombre', 'Nombre', c.nombre, { ancho: true })}
        ${A.selector('c-tipo', 'Tipo', c.tipo || 'persona', [{ v: 'persona', t: 'Persona' }, { v: 'empresa', t: 'Empresa' }])}
        ${A.campo('c-contacto', 'Contacto (WhatsApp/correo)', c.contacto || '', { ancho: true })}</div>
        <label class="campo"><span>Notas</span><textarea id="c-notas" rows="3">${A.esc(c.notas || '')}</textarea></label>`,
      leer: n => {
        const v = i => (n.querySelector('#' + i) || {}).value || '';
        return { nombre: v('c-nombre'), tipo: v('c-tipo'), contacto: v('c-contacto'), notas: v('c-notas') };
      },
      botones: [{ txt: 'Cancelar', valor: null, clase: 'sutil' }, { txt: 'Guardar', valor: 'ok', clase: 'primario' }]
    }).then(({ valor, datos }) => {
      if (!valor) return;
      Object.assign(c, datos);
      Datos.guardar('cliente');
      A.aviso('Cliente guardado');
      pintar();
    });
  }

  function nuevo() {
    const c = Datos.agregar('clientes', { nombre: 'Cliente nuevo', tipo: 'persona', contacto: '', notas: '', activo: true });
    Datos.guardar('nuevo cliente');
    pintar();
    abrir(c.id);
  }

  window.Vistas = window.Vistas || {};
  Vistas.clientes = { pintar, abrir, nuevo };
})();
