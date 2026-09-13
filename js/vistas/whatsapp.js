/* Vista: WhatsApp — los textos de atención, listos para copiar. Portado de
 * negocio/ayunka-studio/js/whatsapp.js -- mismos mensajes y etiquetas (contenido de
 * negocio ya decidido, no se reescribe), presentación con el sistema visual nuevo. n8n
 * no toca WhatsApp: no hay API conectada, esto es copiar/pegar a mano. */
(function () {
  const KEY = 'ayunka-wsp-cfg';
  const DEF = { plazo: '', envio: '', retiro: '' };
  const cargar = () => { try { return Object.assign({}, DEF, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { return Object.assign({}, DEF); } };
  const guardarCfg = c => { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {} };

  const AUTO = [
    { id: 'bienvenida', tope: 200, titulo: 'Mensaje de bienvenida', cuando: 'Sale solo la primera vez que alguien te escribe (o tras 14 días sin hablar)',
      texto: '¡Hola! 🌿 Gracias por escribir a Ayünka 💛 Cuéntame qué te gustó y te paso precio y plazo al tiro. El banderín de nombre es $5.000 por letra (5 letras = $25.000). Respondo de 9 a 19 h ✨',
      nota: 'El precio va aquí a propósito: todas las consultas de julio preguntaban precio.' },
    { id: 'bienvenida-corta', tope: 200, titulo: 'Bienvenida — versión corta', cuando: 'Por si la app te corta la de arriba',
      texto: '¡Hola! 🌿 Gracias por escribir a Ayünka 💛 Cuéntame qué te gustó y te paso precio y plazo. Banderín de nombre: $5.000 por letra. Respondo de 9 a 19 h ✨' },
    { id: 'ausencia', tope: 200, titulo: 'Mensaje de ausencia', cuando: 'Prográmalo de 19:00 a 09:00',
      texto: '¡Hola! 🌿 Gracias por escribir 💛 Ahora no estoy conectada, pero mañana temprano te respondo. Déjame el nombre y los colores que quieres y te llego con el presupuesto listo ✨',
      nota: 'No dice solo "te respondo mañana": pide algo.' }
  ];
  const RAPIDAS = [
    { atajo: 'banderin', titulo: 'Precio del banderín', texto: () => `El banderín de nombre en tela va así 🌿\n\n$5.000 por letra. Un nombre de 5 letras queda en $25.000.\n¿Quieres un bordado extra? $5.000 más.\n\nCada letra la coso en su propia tela, en los colores que elijas 💛\nCuéntame el nombre y te lo armo ✨` },
    { atajo: 'plazo', titulo: 'Cuánto demora', usa: ['plazo'], texto: c => `Lo hago a pedido, así que me tomo ${c.plazo || '___'} días hábiles desde que confirmas 🌿\nSi lo necesitas para una fecha, dime cuál y te digo al tiro si llego 💛` },
    { atajo: 'envio', titulo: 'Envío y retiro', usa: ['envio', 'retiro'], texto: c => `Te lo puedo enviar a todo Chile por ${c.envio || '___'} 📦\nEl despacho lo pagas tú y sale una vez que esté listo.\nSi estás en ${c.retiro || '___'}, también puedes retirarlo 🌿` },
    { atajo: 'pedir', titulo: 'Cómo se pide', texto: () => `Para dejarlo andando necesito tres cosas 🌿\n1. El nombre tal como quieres que se lea\n2. Los colores o el estilo que te gusta\n3. Si lo necesitas para una fecha\n\nCon eso te confirmo el total y el plazo 💛` },
    { atajo: 'gracias', titulo: 'Después de entregar', texto: () => `¡Gracias a ti! 💛 Cualquier cosa me escribes.\nSi te gusta cómo quedó, una foto o una historia etiquetándome me ayuda muchísimo 🌿\n@Ayunka.Borda.Crea` }
  ];
  const ETIQUETAS = [
    ['Nuevo', 'Escribió y no le has respondido', 'Esta es la lista que revisas primero. Más de un día aquí y se enfría'],
    ['Cotizado', 'Le pasaste precio y plazo', 'La pelota está en su cancha. A los 3 días, un "¿alcanzaste a verlo?" recupera harto'],
    ['Confirmado', 'Dijo que sí', 'Va a la lista de trabajo'],
    ['En proceso', 'Lo estás haciendo', 'Aquí ves cuánto tienes encima antes de prometer plazos nuevos'],
    ['Por entregar', 'Listo, esperando entrega o pago', 'Lo que no puede quedarse olvidado'],
    ['Entregado', 'Cerrado', 'De aquí salen los clientes a los que ofreces algo nuevo']
  ];

  function bloque(id, titulo, cuando, texto, tope, nota) {
    const n = [...texto].length;
    const cuenta = tope ? `<span class="chip ${n <= tope ? 'ok' : 'bajo'}">${n} / ${tope} caracteres</span>` : '';
    return `<div class="tarjeta" style="margin-bottom:10px">
      <div class="row" style="justify-content:space-between;align-items:flex-start">
        <div><b>${A.esc(titulo)}</b><div style="font-size:12.5px;color:var(--apagado)">${A.esc(cuando)}</div></div>${cuenta}
      </div>
      <pre id="wsp_${id}" style="white-space:pre-wrap;font-family:inherit;font-size:13.5px;background:var(--panel2);border-radius:var(--r-campo);padding:10px;margin:10px 0">${A.esc(texto)}</pre>
      ${nota ? `<p style="font-size:12px;color:var(--apagado);margin:0 0 8px">${A.esc(nota)}</p>` : ''}
      <button class="btn chico" onclick="Vistas.whatsapp.copiar('wsp_${id}')">Copiar</button>
    </div>`;
  }

  function pintar() {
    const c = cargar();
    const faltan = ['plazo', 'envio', 'retiro'].filter(k => !c[k]);
    A.$('#contenido').innerHTML = `
      <div class="cabecera"><h1>WhatsApp</h1><span class="sub">textos listos para copiar y pegar</span></div>
      ${faltan.length ? `<div class="tarjeta aviso"><b>Faltan ${faltan.length} dato(s) tuyo(s).</b> Las respuestas de plazo y envío quedan con huecos hasta que los llenes abajo.</div>` : ''}
      <div class="tarjeta"><h2>Tus datos</h2>
        <div class="formulario">
          ${A.campo('wsp-plazo', 'Plazo en días hábiles', c.plazo, { ph: 'por ejemplo: 5 a 7' })}
          ${A.campo('wsp-envio', 'Costo del envío', c.envio, { ph: 'por ejemplo: $4.500 por Starken' })}
          ${A.campo('wsp-retiro', 'Dónde se puede retirar', c.retiro, { ph: 'por ejemplo: Renca' })}
        </div>
        <button class="btn primario" onclick="Vistas.whatsapp.guardar()">Guardar</button>
      </div>
      <h2 style="font-size:16px;margin:18px 0 8px">Mensajes automáticos</h2>
      <p style="font-size:12.5px;color:var(--apagado);margin:0 0 10px">Ajustes ⋮ → Herramientas para la empresa → Mensaje de bienvenida / de ausencia</p>
      ${AUTO.map(a => bloque(a.id, a.titulo, a.cuando, a.texto, a.tope, a.nota)).join('')}
      <h2 style="font-size:16px;margin:18px 0 8px">Respuestas rápidas</h2>
      <p style="font-size:12.5px;color:var(--apagado);margin:0 0 10px">Herramientas para la empresa → Respuestas rápidas → + · el atajo va sin la barra</p>
      ${RAPIDAS.map(r => bloque('r-' + r.atajo, '/' + r.atajo + ' — ' + r.titulo, r.usa ? ('usa: ' + r.usa.join(' y ')) : '—', r.texto(c), 0)).join('')}
      <h2 style="font-size:16px;margin:18px 0 8px">Etiquetas</h2>
      <div class="tarjeta"><p style="font-size:12.5px;color:var(--apagado);margin:0 0 10px">Una sola etiqueta por chat.</p>
        ${ETIQUETAS.map(([n, cuando, para]) => `<div style="padding:8px 0;border-top:1px solid var(--borde)"><b>${A.esc(n)}</b> — ${A.esc(cuando)}<div style="font-size:12px;color:var(--apagado)">${A.esc(para)}</div></div>`).join('')}
      </div>`;
  }

  function guardar() {
    const v = i => { const e = document.getElementById(i); return e ? e.value.trim() : ''; };
    guardarCfg({ plazo: v('wsp-plazo'), envio: v('wsp-envio'), retiro: v('wsp-retiro') });
    A.aviso('Datos guardados');
    pintar();
  }

  async function copiar(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const txt = el.textContent;
    try { await navigator.clipboard.writeText(txt); A.aviso('Copiado -- pégalo en WhatsApp'); }
    catch (e) {
      const r = document.createRange(); r.selectNodeContents(el);
      const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
      A.aviso('Seleccionado: mantén apretado y Copiar');
    }
  }

  window.Vistas = window.Vistas || {};
  Vistas.whatsapp = { pintar, guardar, copiar };
})();
