/* Ayünka Studio · piezas sueltas de interfaz. Nada de lógica de negocio acá. */
(function () {
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  const plata = n => (n === null || n === undefined || !isFinite(n))
    ? '—' : '$' + Math.round(n).toLocaleString('es-CL');

  const num = v => {
    const n = parseFloat(String(v).replace(',', '.').replace(/[^\d.\-]/g, ''));
    return isFinite(n) ? n : 0;
  };

  const fecha = f => {
    if (!f) return '—';
    const d = new Date(f.length === 10 ? f + 'T12:00:00' : f);
    return isNaN(d) ? f : d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  let avisoTimer;
  function aviso(msg, tipo) {
    let e = $('#aviso');
    if (!e) { e = document.createElement('div'); e.id = 'aviso'; document.body.appendChild(e); }
    e.className = 'aviso visible ' + (tipo || '');
    e.textContent = msg;
    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(() => e.classList.remove('visible'), 4200);
  }

  /** Modal genérico. `botones` = [{txt, valor, clase}].
   *  `leer(nodo)` se llama con el modal TODAVÍA en el DOM, justo antes de cerrarlo, para
   *  que quien lo abrió pueda sacar los valores de los campos. Devuelve una promesa con
   *  `{valor, datos}`. */
  function preguntar({ titulo, cuerpo, botones, leer, alAbrir }) {
    return new Promise(resolve => {
      const fondo = document.createElement('div');
      fondo.className = 'modal-fondo';
      fondo.innerHTML = `<div class="modal" role="dialog" aria-modal="true">
        <h2>${esc(titulo)}</h2>
        <div class="modal-cuerpo">${cuerpo}</div>
        <div class="modal-botones"></div></div>`;
      const cont = fondo.querySelector('.modal-botones');
      (botones || [{ txt: 'Entendido', valor: true }]).forEach(b => {
        const el = document.createElement('button');
        el.className = 'btn ' + (b.clase || '');
        el.textContent = b.txt;
        el.onclick = () => {
          let datos = null;
          try { if (leer) datos = leer(fondo); } catch (e) { console.error(e); }
          fondo.remove();
          resolve({ valor: b.valor, datos });
        };
        cont.appendChild(el);
      });
      document.body.appendChild(fondo);
      if (alAbrir) { try { alAbrir(fondo); } catch (e) { console.error(e); } }
      const primero = fondo.querySelector('.modal-cuerpo input, .modal-cuerpo select') || cont.querySelector('button');
      primero && primero.focus();
    });
  }

  const campo = (id, etiqueta, valor, opts = {}) => `
    <label class="campo${opts.ancho ? ' ancho' : ''}">
      <span>${esc(etiqueta)}${opts.nota ? `<i>${esc(opts.nota)}</i>` : ''}</span>
      <input id="${id}" type="${opts.tipo || 'text'}" value="${esc(valor == null ? '' : valor)}"
        ${opts.paso ? `step="${opts.paso}"` : ''} ${opts.ph ? `placeholder="${esc(opts.ph)}"` : ''}>
    </label>`;

  const selector = (id, etiqueta, valor, opciones) => `
    <label class="campo"><span>${esc(etiqueta)}</span><select id="${id}">
      ${opciones.map(o => `<option value="${esc(o.v)}"${o.v === valor ? ' selected' : ''}>${esc(o.t)}</option>`).join('')}
    </select></label>`;

  window.A = window.A || {};
  Object.assign(window.A, { esc, $, $$, plata, num, fecha, aviso, preguntar, campo, selector });
})();
