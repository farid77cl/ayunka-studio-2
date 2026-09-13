/* Vista: Ajustes. Parámetros de costeo y conexión a la nube. */
(function () {
  function pintar() {
    const p = DB.params;
    A.$('#contenido').innerHTML = `
      <div class="cabecera"><h1>Ajustes</h1></div>

      <div class="tarjeta"><h2>Costeo</h2>
        <div class="formulario">
          ${A.campo('aj-kwh', 'Precio de la luz', p.kwh ?? 202, { tipo: 'number', unidad: '$/kWh' })}
          ${A.campo('aj-mano', 'Mano de obra', p.manoObraHora ?? 4000, { tipo: 'number', signo: '$', nota: 'por hora' })}
          ${A.campo('aj-maquina', 'Precio de la máquina', p.precioMaquina ?? 900000, { tipo: 'number', signo: '$' })}
          ${A.campo('aj-amort', 'Amortización', p.amortizacionAnios ?? 3, { tipo: 'number', unidad: 'años' })}
          ${A.campo('aj-merma', 'Merma', Math.round((p.mermaPct ?? 0.08) * 100), { tipo: 'number', unidad: '%' })}
          ${A.campo('aj-falla', 'Tasa de fallas', Math.round((p.tasaFalla ?? 0.129) * 100), { tipo: 'number', unidad: '%' })}
          ${A.campo('aj-capacidad', 'Capacidad de la K2', p.capacidadDiaH ?? 13, { tipo: 'number', unidad: 'h/día' })}
        </div>
        <h3 style="font-size:13px;text-transform:uppercase;letter-spacing:.5px;color:var(--pizarra);margin:14px 0 8px">Márgenes por oficio</h3>
        <div class="formulario">
          ${A.campo('aj-marg-3d', 'Impresión 3D', (p.margenes || {})['3d'] ?? 3.5, { tipo: 'number', paso: '0.05' })}
          ${A.campo('aj-marg-bordado', 'Bordado', (p.margenes || {}).bordado ?? 2.55, { tipo: 'number', paso: '0.05' })}
          ${A.campo('aj-marg-costura', 'Costura', (p.margenes || {}).costura ?? 2, { tipo: 'number', paso: '0.05' })}
        </div>
        <button class="btn primario" onclick="Vistas.ajustes.guardar()">Guardar</button>
      </div>

      <div class="tarjeta"><h2>Sincronización</h2>
        <p style="font-size:13px;color:var(--apagado);margin:0 0 12px">Estado: ${A.esc(Nube.estado())}</p>
        <div class="formulario">
          ${A.campo('aj-correo', 'Correo', '', { tipo: 'email' })}
          ${A.campo('aj-clave', 'Contraseña', '', { tipo: 'password' })}
        </div>
        <button class="btn primario" onclick="Vistas.ajustes.conectar()">Conectar</button>
      </div>

      <div class="tarjeta"><h2>Respaldo</h2>
        <button class="btn" onclick="Datos.descargarRespaldo('manual')">Descargar respaldo</button>
      </div>`;
  }

  function guardar() {
    const v = id => { const e = document.getElementById(id); return e ? e.value : ''; };
    Object.assign(DB.params, {
      kwh: A.num(v('aj-kwh')), manoObraHora: A.num(v('aj-mano')), precioMaquina: A.num(v('aj-maquina')),
      amortizacionAnios: A.num(v('aj-amort')), mermaPct: A.num(v('aj-merma')) / 100,
      tasaFalla: A.num(v('aj-falla')) / 100, capacidadDiaH: A.num(v('aj-capacidad')),
      margenes: { '3d': A.num(v('aj-marg-3d')), bordado: A.num(v('aj-marg-bordado')), costura: A.num(v('aj-marg-costura')) }
    });
    Datos.guardar('ajustes');
    A.aviso('Ajustes guardados');
  }

  function conectar() {
    const correo = (document.getElementById('aj-correo') || {}).value;
    const clave = (document.getElementById('aj-clave') || {}).value;
    if (!correo || !clave) { A.aviso('Escribe correo y clave', 'error'); return; }
    Nube.guardarCfg(AYUNKA_CFG.firebase, AYUNKA_CFG.espacio, correo, clave);
    Nube.conectar(plan => new Promise(resolve => resolve(null))).then(() => pintar());
  }

  window.Vistas = window.Vistas || {};
  Vistas.ajustes = { pintar, guardar, conectar };
})();
