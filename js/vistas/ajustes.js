/* Vista: ajustes. Parámetros de costo, márgenes por oficio, respaldos y sincronización. */
(function () {
  function pintar() {
    const p = DB.params || {};
    const m = p.margenes || {};
    const amort = Costos.amortizacionHora(p);
    const cfg = Nube.cfg();
    const guardado = (() => { try { return JSON.parse(localStorage.getItem('ayunka2-nube-cfg') || '{}'); } catch (e) { return {}; } })();

    A.$('#contenido').innerHTML = `
      <div class="cabecera"><h1>Ajustes</h1>
        <span class="sub">versión ${A.esc(self.AYUNKA_VERSION)}</span></div>

      <div class="tarjeta"><h2>Costos de producción</h2>
        <div class="formulario">
          ${A.campo('a-pla', 'Rollo de PLA', p.precioPLA, { tipo: 'number', signo: '$', nota: '1 kg' })}
          ${A.campo('a-petg', 'Rollo de PETG', p.precioPETG, { tipo: 'number', signo: '$', nota: '1 kg' })}
          ${A.campo('a-kwh', 'Precio del kWh', p.kwh, { tipo: 'number', signo: '$' })}
          ${A.campo('a-kw', 'Consumo de la K2', p.consumoKw, { tipo: 'number', paso: '0.01', unidad: 'kW' })}
          ${A.campo('a-costoimp', 'Lo que costó la impresora', p.costoImpresora, { tipo: 'number', signo: '$' })}
          ${A.campo('a-amort', 'Años para amortizarla', p.amortAnos, { tipo: 'number', unidad: 'años' })}
          ${A.campo('a-dias', 'Días de uso al año', p.diasAno, { tipo: 'number' })}
          ${A.campo('a-horas', 'Horas de uso al día', p.horasDia, { tipo: 'number' })}
          ${A.campo('a-mano', 'Tu hora de trabajo', p.manoObraHora, { tipo: 'number', signo: '$' })}
          ${A.campo('a-prep', 'Preparación por pieza', p.minPrep, { tipo: 'number', unidad: 'min' })}
          ${A.campo('a-empaque', 'Empaque', p.empaque, { tipo: 'number', signo: '$' })}
          ${A.campo('a-merma', 'Merma de material', p.merma, { tipo: 'number', paso: '0.01', nota: '0,08 = 8%' })}
          ${A.campo('a-falla', 'Tasa de fallas', p.tasaFalla, { tipo: 'number', paso: '0.01', nota: '0,10 = 10%' })}
          ${A.campo('a-cap', 'Capacidad al día', p.capacidadDiaH, { tipo: 'number', unidad: 'h' })}
        </div>
        <p style="font-size:12.5px;color:var(--apagado);margin:4px 0 0">
          Con estos números, cada hora de la K2 cuesta <b>${A.plata(amort)}</b> solo en amortización.</p>
      </div>

      <div class="tarjeta"><h2>Márgenes por oficio</h2>
        <p style="font-size:13px;color:var(--apagado);margin:0 0 12px">
          Son distintos a propósito y cada uno tiene su razón: el bordado es tiempo tuyo difícil
          de reemplazar, la costura compite con más oferta, y el 3D deja margen porque la máquina
          trabaja sola.</p>
        <div class="formulario">
          ${A.campo('a-mbor', 'Bordado', m.bordado, { tipo: 'number', paso: '0.05', unidad: '×' })}
          ${A.campo('a-mcos', 'Costura', m.costura, { tipo: 'number', paso: '0.05', unidad: '×' })}
          ${A.campo('a-m3d', 'Impresión 3D', m['3d'], { tipo: 'number', paso: '0.05', unidad: '×' })}
        </div>
      </div>

      <div class="tarjeta"><h2>Negocio</h2>
        <div class="formulario">
          ${A.campo('a-nom', 'Nombre', (p.negocio || {}).nombre)}
          ${A.campo('a-ig', 'Instagram', (p.negocio || {}).ig)}
          ${A.campo('a-tel', 'Teléfono', (p.negocio || {}).telefono)}
          ${A.campo('a-mail', 'Correo', (p.negocio || {}).email)}
        </div>
        <button class="btn primario" onclick="Vistas.ajustes.guardar()">Guardar ajustes</button>
      </div>

      <div class="tarjeta"><h2>Sincronización entre el PC y el teléfono</h2>
        <p id="nube-estado" style="font-size:13px;color:var(--apagado);margin:0 0 12px">
          Estado: ${A.esc(Nube.estado())}</p>
        <div class="formulario">
          ${A.campo('n-correo', 'Correo de acceso', guardado.correo || '', { tipo: 'email', nota: 'no es tu Gmail' })}
          ${A.campo('n-clave', 'Contraseña de acceso', guardado.clave || '', { tipo: 'password' })}
          ${A.campo('n-espacio', 'Espacio', guardado.espacio || (window.AYUNKA_CFG || {}).espacio || 'ayunka')}
        </div>
        <label class="campo ancho"><span>Configuración de Firebase <i>pega el objeto firebaseConfig</i></span>
          <textarea id="n-fb" rows="4" placeholder='{ "apiKey": "…", "projectId": "…", "appId": "…" }'>${
            A.esc(guardado.firebase ? JSON.stringify(guardado.firebase) : JSON.stringify((window.AYUNKA_CFG || {}).firebase || {}))}</textarea></label>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn primario" onclick="Vistas.ajustes.conectar()">Conectar</button>
          <button class="btn" onclick="Nube.forzarSubida().then(()=>A.aviso('Subido'))">Subir ahora</button>
          <button class="btn sutil" onclick="Nube.apagar();A.aviso('Sincronización apagada');Vistas.ajustes.pintar()">Apagar</button>
        </div>
        <p style="font-size:12.5px;color:var(--apagado);margin:10px 0 0">
          El correo y la contraseña se guardan <b>solo en este equipo</b>, nunca en el repositorio.
          Y recuerda: las reglas de <code>firestore.rules</code> hay que <b>publicarlas en la consola</b> —
          cambiar el archivo no publica nada.</p>
      </div>

      <div class="tarjeta"><h2>Catálogo para publicar</h2>
        <p style="font-size:13px;color:var(--pizarra);margin:0 0 12px">
          El precio se pone acá, en Studio, y de acá <b>salen</b> los dos archivos. Nunca se
          editan a mano — la próxima vez que se regeneren, se pisan enteros.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn" onclick="Vistas.ajustes.descargarCatalogoCSV()">Descargar CSV (Meta)</button>
          <button class="btn" onclick="Vistas.ajustes.descargarCatalogoXLSX()">Descargar XLSX (WhatsApp)</button>
        </div>
        <p style="font-size:12.5px;color:var(--apagado);margin:10px 0 0">
          El CSV es para importar de una en business.facebook.com/commerce. El XLSX trae una
          hoja de instrucciones y sirve para cargar a mano desde el celular. Los productos sin
          precio salen con ese campo en blanco: no se inventa un precio.</p>
      </div>

      <div class="tarjeta"><h2>Tus datos</h2>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn" onclick="Datos.descargarRespaldo();A.aviso('Respaldo descargado')">Descargar respaldo</button>
          <button class="btn" onclick="Vistas.ajustes.importar()">Restaurar desde un respaldo</button>
          <button class="btn sutil" onclick="Vistas.ajustes.recargarSemilla()">Volver al catálogo inicial</button>
        </div>
        <p style="font-size:12.5px;color:var(--apagado);margin:10px 0 0">
          El respaldo se descarga como archivo <b>al disco</b>, no al navegador. En la versión
          anterior la única copia de rescate vivía en el mismo lugar que se acababa de pisar.</p>
        <div class="rejilla" style="margin-top:14px">
          ${Datos.COLECCIONES.map(c => `<div class="dato"><div class="k">${A.esc(c)}</div>
            <div class="v">${(DB[c] || []).length}</div></div>`).join('')}
        </div>
      </div>`;
  }

  function guardar() {
    const v = i => { const e = document.getElementById(i); return e ? e.value : ''; };
    const p = DB.params;
    Object.assign(p, {
      precioPLA: A.num(v('a-pla')), precioPETG: A.num(v('a-petg')), kwh: A.num(v('a-kwh')),
      consumoKw: A.num(v('a-kw')), costoImpresora: A.num(v('a-costoimp')),
      amortAnos: A.num(v('a-amort')) || 1, diasAno: A.num(v('a-dias')) || 300,
      horasDia: A.num(v('a-horas')) || 8, manoObraHora: A.num(v('a-mano')),
      minPrep: A.num(v('a-prep')), empaque: A.num(v('a-empaque')),
      merma: A.num(v('a-merma')), tasaFalla: A.num(v('a-falla')),
      capacidadDiaH: A.num(v('a-cap')) || 13
    });
    p.margenes = { bordado: A.num(v('a-mbor')) || 2.55, costura: A.num(v('a-mcos')) || 2, '3d': A.num(v('a-m3d')) || 3.5 };
    p.negocio = Object.assign(p.negocio || {}, {
      nombre: v('a-nom'), ig: v('a-ig'), telefono: v('a-tel'), email: v('a-mail')
    });
    Datos.guardar('ajustes');
    A.aviso('Ajustes guardados');
    pintar();
  }

  function conectar() {
    const v = i => { const e = document.getElementById(i); return e ? e.value : ''; };
    let fb;
    try { fb = JSON.parse(v('n-fb')); } catch (e) { A.aviso('La configuración de Firebase no es un JSON válido', 'error'); return; }
    if (!fb || !fb.projectId) { A.aviso('Falta el projectId de Firebase', 'error'); return; }
    if (!v('n-correo') || !v('n-clave')) { A.aviso('Pon el correo y la contraseña de acceso', 'error'); return; }
    Nube.guardarCfg(fb, v('n-espacio') || 'ayunka', v('n-correo'), v('n-clave'));
    App.conectarNube();
  }

  function importar() {
    const i = document.createElement('input');
    i.type = 'file'; i.accept = '.json';
    i.onchange = e => {
      const fr = new FileReader();
      fr.onload = () => {
        let d;
        try { d = JSON.parse(fr.result); } catch (x) { A.aviso('El archivo no es un JSON válido', 'error'); return; }
        A.preguntar({
          titulo: '¿Restaurar este respaldo?',
          cuerpo: `<p>Reemplaza lo que hay ahora en este equipo. Antes de hacerlo se descarga un
            respaldo de lo actual, por si te equivocaste de archivo.</p>
            <div class="desglose">${Datos.COLECCIONES.map(c =>
              `<div class="fila"><div class="c">${A.esc(c)}</div><div class="m">${(d[c] || []).length}</div></div>`).join('')}</div>`,
          botones: [{ txt: 'Cancelar', valor: null, clase: 'sutil' }, { txt: 'Restaurar', valor: 'ok', clase: 'primario' }]
        }).then(({ valor }) => {
          if (!valor) return;
          Datos.descargarRespaldo('antes-de-restaurar');
          Datos.reemplazar(d, 'restaurado de un archivo');
          A.aviso('Restaurado');
          pintar();
        });
      };
      fr.readAsText(e.target.files[0]);
    };
    i.click();
  }

  function recargarSemilla() {
    A.preguntar({
      titulo: '¿Volver al catálogo inicial?',
      cuerpo: `<p>Reemplaza todo por los 36 productos con SKU, los 6 filamentos y los parámetros
        con los que nació esta versión. <b>Se descarga primero un respaldo de lo actual.</b></p>`,
      botones: [{ txt: 'Cancelar', valor: null, clase: 'sutil' }, { txt: 'Volver al inicial', valor: 'ok', clase: 'primario' }]
    }).then(async ({ valor }) => {
      if (!valor) return;
      Datos.descargarRespaldo('antes-de-volver-al-inicial');
      Datos.reemplazar(await Datos.cargarSemilla(), 'catálogo inicial');
      A.aviso('Catálogo inicial cargado');
      pintar();
    });
  }

  function descargarCatalogoCSV() {
    const csv = Catalogo.generarCSV(Datos.activos('productos'));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'catalogo-meta-importar.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    A.aviso('CSV descargado');
  }

  function descargarCatalogoXLSX() {
    const cats = (window.Vistas.productos && Vistas.productos.CATS) || {};
    const xlsx = Catalogo.generarXLSX(Datos.activos('productos'), cats);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([xlsx.datos], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    a.download = xlsx.nombre;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    A.aviso('XLSX descargado (' + xlsx.filas + ' productos)');
  }

  window.Vistas = window.Vistas || {};
  Vistas.ajustes = { pintar, guardar, conectar, importar, recargarSemilla, descargarCatalogoCSV, descargarCatalogoXLSX };
})();
