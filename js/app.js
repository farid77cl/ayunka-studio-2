/* Ayünka Studio · arranque y navegación unificada (4 Salones). */
(function () {
  const SALONES = [
    {
      id: 'ventas',
      titulo: 'Ventas',
      icono: '🛍️',
      vistas: [
        { id: 'cotizar', label: 'Cotizador', icono: '🧮' },
        { id: 'pedidos', label: 'Pedidos', icono: '📋' },
        { id: 'pendientes', label: 'Pendientes', icono: '⚡' },
        { id: 'whatsapp', label: 'WhatsApp', icono: '💬' }
      ]
    },
    {
      id: 'catalogo',
      titulo: 'Catálogo & 3D',
      icono: '🎨',
      vistas: [
        { id: 'productos', label: 'Productos', icono: '🏷️' },
        { id: 'plantillas', label: 'Plantillas 3D', icono: '✨' },
        { id: 'disenos3d', label: 'Personalizados', icono: '📐' },
        { id: 'perfiles', label: 'Perfiles K2', icono: '🎛️' }
      ]
    },
    {
      id: 'taller',
      titulo: 'Taller K2',
      icono: '🖨️',
      vistas: [
        { id: 'impresora', label: 'Historial K2', icono: '⏱️' },
        { id: 'cola', label: 'Cola', icono: '⏳' },
        { id: 'bandejas', label: 'Bandejas mixtas', icono: '🍱' }
      ]
    },
    {
      id: 'gestion',
      titulo: 'Gestión',
      icono: '⚙️',
      vistas: [
        { id: 'clientes', label: 'Clientes', icono: '👥' },
        { id: 'filamentos', label: 'Bobinas & Stock', icono: '🧵' },
        { id: 'finanzas', label: 'Finanzas', icono: '💰' },
        { id: 'ajustes', label: 'Ajustes', icono: '☁️' }
      ]
    }
  ];

  const NAV = SALONES.flatMap(s => s.vistas);

  function salonDeVista(vistaId) {
    return SALONES.find(s => s.vistas.some(v => v.id === vistaId)) || SALONES[0];
  }

  async function arrancar() {
    let db = Datos.leerDisco();
    if (!db || !db.productos || db.productos.length === 0) {
      try {
        const s = await Datos.cargarSemilla();
        if (db) {
          db.productos = s.productos || [];
          if (!db.clientes || !db.clientes.length) db.clientes = s.clientes || [];
          if (!db.filamentos || !db.filamentos.length) db.filamentos = s.filamentos || [];
        } else {
          db = s;
        }
        Datos.reemplazar(db, 'semilla inicial');
        Datos.guardar('carga catálogo oficial');
      } catch (e) {
        console.error(e);
        setTimeout(() => A.aviso('Catálogo oficial no cargado: ' + e.message, 'error'), 600);
        if (!db) db = Datos.vacia();
        Datos.reemplazar(db, 'arranque');
      }
    } else {
      Datos.reemplazar(db, 'arranque');
    }
    const btnRet = document.getElementById('btn-retorno-suite');
    if (btnRet) {
      btnRet.addEventListener('click', e => {
        if (window.parent && window.parent !== window) {
          e.preventDefault();
          window.parent.postMessage('ir-a-taller', '*');
        }
      });
    }
    renderNav();
    window.addEventListener('hashchange', render);
    render();
    if (window.Nube && Nube.configurado()) {
      Nube.conectar(plan => new Promise(resolve => {
        console.warn('Conflicto de sincronización:', plan);
        resolve(null);
      }));
    }
  }

  function renderNav() {
    const nav = document.getElementById('nav');
    if (nav) {
      nav.innerHTML = SALONES.map(s => `
        <div class="nav-grupo">
          <div class="nav-grupo-titulo">${s.icono} ${s.titulo}</div>
          <div class="nav-grupo-items">
            ${s.vistas.map(v => `
              <button type="button" class="nav" data-id="${v.id}" onclick="location.hash='#/${v.id}'">
                <span class="nav-ico">${v.icono}</span>
                <span class="nav-txt">${A.esc(v.label)}</span>
              </button>
            `).join('')}
          </div>
        </div>
      `).join('');
    }

    // Bottom Navigation Bar para móviles
    let bottomNav = document.getElementById('bottom-nav');
    if (!bottomNav) {
      bottomNav = document.createElement('nav');
      bottomNav.id = 'bottom-nav';
      bottomNav.className = 'bottom-nav';
      document.body.appendChild(bottomNav);
    }

    const vistaActual = (location.hash.replace('#/', '') || 'cotizar');
    const salonActual = salonDeVista(vistaActual);

    bottomNav.innerHTML = SALONES.map(s => `
      <button type="button" class="bottom-tab ${s.id === salonActual.id ? 'active' : ''}" onclick="Vistas.app.irASalon('${s.id}')">
        <span class="bt-ico">${s.icono}</span>
        <span class="bt-lbl">${s.titulo}</span>
      </button>
    `).join('');
  }

  function irASalon(salonId) {
    const s = SALONES.find(x => x.id === salonId);
    if (s && s.vistas.length) {
      location.hash = `#/${s.vistas[0].id}`;
    }
  }

  function render() {
    const id = (location.hash.replace('#/', '') || 'cotizar');
    const salon = salonDeVista(id);

    // Actualizar estados activos en sidebar y bottom nav
    document.querySelectorAll('.nav').forEach(b => b.classList.toggle('activo', b.dataset.id === id));
    document.querySelectorAll('.bottom-tab').forEach((b, idx) => {
      b.classList.toggle('active', SALONES[idx] && SALONES[idx].id === salon.id);
    });

    // Renderizar subtabs móviles en la parte superior del contenido
    let subnav = document.getElementById('subnav-movil');
    if (!subnav) {
      subnav = document.createElement('div');
      subnav.id = 'subnav-movil';
      subnav.className = 'subnav-movil';
      const principal = document.querySelector('.principal');
      if (principal) principal.insertBefore(subnav, principal.firstChild);
    }
    if (subnav) {
      subnav.innerHTML = `
        <div class="subtabs-scroll">
          <a href="/" class="subtab subtab-retorno" onclick="if(window.parent&&window.parent!==window){event.preventDefault();window.parent.postMessage('ir-a-taller','*');}" style="background:var(--panel2);font-weight:700;color:var(--coral);text-decoration:none">← 🖨️ Taller</a>
          ${salon.vistas.map(v => `
            <button type="button" class="subtab ${v.id === id ? 'active' : ''}" onclick="location.hash='#/${v.id}'">
              ${v.icono} ${A.esc(v.label)}
            </button>
          `).join('')}
        </div>
      `;
    }

    const vista = window.Vistas && window.Vistas[id];
    const cont = document.getElementById('contenido');
    if (!cont) return;
    if (vista && vista.pintar) vista.pintar();
    else cont.innerHTML = '<div class="tarjeta"><div class="vacio"><b>Vista en desarrollo</b></div></div>';
  }

  window.App = { SALONES, NAV, arrancar, render };
  window.Vistas = window.Vistas || {};
  window.Vistas.app = { irASalon };
  document.addEventListener('DOMContentLoaded', arrancar);
})();
