/* Ayünka Studio · arranque y navegación. */
(function () {
  const VISTAS = [
    { id: 'productos',  txt: 'Productos',  cuenta: () => Datos.activos('productos').length },
    { id: 'pedidos',    txt: 'Pedidos',    cuenta: () => Datos.activos('pedidos').filter(p => p.estado !== 'entregado').length },
    { id: 'cola',       txt: 'Cola',       cuenta: null },
    { id: 'cotizar',    txt: 'Cotizar',    cuenta: null },
    { id: 'disenos3d',  txt: 'Personalizados 3D', cuenta: () => Datos.activos('disenos3d').length },
    { id: 'impresora',  txt: 'Historial K2', cuenta: null },
    { id: 'clientes',   txt: 'Clientes',   cuenta: () => Datos.activos('clientes').length },
    { id: 'filamentos', txt: 'Filamentos', cuenta: () => Datos.activos('filamentos').length },
    { id: 'ajustes',    txt: 'Ajustes',    cuenta: null }
  ];

  let actual = 'productos';

  function pintarNav() {
    A.$('#nav').innerHTML = VISTAS.map(v => {
      const n = v.cuenta ? v.cuenta() : null;
      return `<button class="nav${v.id === actual ? ' activo' : ''}" onclick="App.ir('${v.id}')">
        ${A.esc(v.txt)}${n === null ? '' : `<span class="cuenta">${n}</span>`}</button>`;
    }).join('');
  }

  function ir(id) {
    if (!Vistas[id]) return;
    actual = id;
    location.hash = id;
    pintarNav();
    Vistas[id].pintar();
    window.scrollTo(0, 0);
  }

  function pintarPie() {
    const e = A.$('#pie');
    if (!e) return;
    const oscuro = document.documentElement.dataset.tema === 'oscuro';
    e.innerHTML = `<b>v${A.esc(self.AYUNKA_VERSION)}</b><br>${A.esc(Nube.estado())}
      <button class="tema" onclick="App.tema()">${oscuro ? '☾ oscuro' : '☀ claro'}</button>`;
  }

  function tema() {
    const r = document.documentElement;
    const nuevo = r.dataset.tema === 'oscuro' ? 'claro' : 'oscuro';
    r.dataset.tema = nuevo;
    try { localStorage.setItem('ayunka2-tema', nuevo); } catch (e) {}
    pintarPie();
  }

  /* El diálogo que la versión anterior no tenía, y por eso perdió tres semanas. */
  function preguntarConflicto(plan) {
    const lista = o => Object.keys(o.conteos).filter(k => o.conteos[k])
      .map(k => `<li>${A.esc(k)}: ${o.conteos[k]}</li>`).join('') || '<li>vacío</li>';
    return A.preguntar({
      titulo: 'Hay dos versiones distintas de tus datos',
      cuerpo: `<p>${A.esc(plan.porque)}. <b>Nada se toca hasta que elijas.</b></p>
        <div class="comparacion">
          <div><h3>Este equipo</h3><div class="cuando">${A.esc(plan.local.fecha)}</div><ul>${lista(plan.local)}</ul></div>
          <div><h3>La nube</h3><div class="cuando">${A.esc(plan.remoto.fecha)}</div><ul>${lista(plan.remoto)}</ul></div>
        </div>
        <p style="font-size:13px;color:var(--apagado)">
          Se descargó un respaldo de lo que hay en este equipo antes de preguntarte, así que
          cualquiera de las dos opciones se puede deshacer.</p>`,
      botones: [
        { txt: 'Ahora no', valor: null, clase: 'sutil' },
        { txt: 'Que gane la nube', valor: 'bajar' },
        { txt: 'Que gane este equipo', valor: 'subir', clase: 'primario' }
      ]
    }).then(r => r.valor);
  }

  async function conectarNube() {
    if (!Nube.configurado()) { A.aviso('Falta configurar la sincronización'); return; }
    await Nube.conectar(preguntarConflicto);
    pintarPie();
    if (Vistas[actual]) Vistas[actual].pintar();
    pintarNav();
  }

  async function arrancar() {
    let db = Datos.leerDisco();
    if (!db) {
      db = await Datos.cargarSemilla();
      A.aviso('Catálogo inicial cargado: 36 productos reales');
    }
    Object.keys(DB).forEach(k => delete DB[k]);
    Object.assign(DB, db);

    document.addEventListener('db:cambio', e => {
      pintarNav();
      if (e.detail && e.detail.recarga && Vistas[actual]) Vistas[actual].pintar();
    });
    document.addEventListener('nube:estado', pintarPie);

    const inicial = (location.hash || '').replace('#', '');
    ir(VISTAS.some(v => v.id === inicial) ? inicial : 'productos');
    pintarPie();

    if (Nube.configurado()) conectarNube();

    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }

  window.App = { ir, arrancar, conectarNube, pintarPie, tema };
  document.addEventListener('DOMContentLoaded', arrancar);
})();
