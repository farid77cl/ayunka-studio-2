/* Ayünka Studio · arranque y navegación. */
(function () {
  const NAV = []; // se llena en la Fase 1, una entrada por vista: {id, label}

  async function arrancar() {
    let db = Datos.leerDisco();
    if (!db) {
      try { db = await Datos.cargarSemilla(); }
      catch (e) { db = Datos.vacia(); }
    }
    Datos.reemplazar(db, 'arranque');
    renderNav();
    window.addEventListener('hashchange', render);
    render();
    if (window.Nube && Nube.configurado()) {
      Nube.conectar(plan => new Promise(resolve => {
        // conflicto: por ahora se resuelve por consola hasta que la Fase 1 tenga UI
        console.warn('Conflicto de sincronización, sin UI todavía:', plan);
        resolve(null);
      }));
    }
  }

  function renderNav() {
    const nav = document.getElementById('nav');
    if (!nav) return;
    nav.innerHTML = NAV.map(v => `<button class="nav" data-id="${v.id}" onclick="location.hash='#/${v.id}'">${A.esc(v.label)}</button>`).join('');
  }

  function render() {
    const id = (location.hash.replace('#/', '') || (NAV[0] || {}).id || '');
    document.querySelectorAll('.nav').forEach(b => b.classList.toggle('activo', b.dataset.id === id));
    const vista = window.Vistas && window.Vistas[id];
    const cont = document.getElementById('contenido');
    if (!cont) return;
    if (vista && vista.pintar) vista.pintar();
    else cont.innerHTML = '<div class="tarjeta"><div class="vacio"><b>Todavía no hay vistas</b>Se agregan en la Fase 1.</div></div>';
  }

  window.App = { NAV, arrancar, render };
  document.addEventListener('DOMContentLoaded', arrancar);
})();
