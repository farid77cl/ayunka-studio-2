/* Ayünka Studio · sincronización con Supabase (Postgres, schema "ayunka").
 *
 * Cuatro reglas que no se relajan:
 *  1. La nube nunca gana en silencio. Si hay conflicto, se muestra qué hay de cada lado
 *     -- fecha y conteos -- y decide una persona.
 *  2. Un equipo con datos reales que se conecta por primera vez SUBE. Casi nunca es el
 *     destino: es la fuente.
 *  3. Antes de la primera sincronización se descarga un respaldo al disco. El
 *     localStorage no puede ser a la vez la víctima y la red de seguridad.
 *  4. Se sube apenas hay sesión, sin esperar a que alguien edite algo.
 *
 * Una FILA por ficha (tabla por colección, columna `ficha` jsonb) -- no la base entera en
 * un solo documento. Editar un producto en el PC ya no puede pisar un filamento nuevo del
 * teléfono. `activo` vive dentro de `ficha`, no es columna aparte.
 */
(function () {
  const CFG = 'ayunka-nube-cfg';
  const APAGADA = 'ayunka-nube-apagada';
  const VISTO = 'ayunka-nube-visto';

  const st = { lista: false, aplicando: false, sb: null, base: null,
               canal: null, estado: 'desactivada', correo: null };

  function cfg() {
    if (localStorage.getItem(APAGADA) === 'si') return null;
    let l = null;
    try { l = JSON.parse(localStorage.getItem(CFG) || 'null'); } catch (e) {}
    const sp = (l && l.supabase) || (window.AYUNKA_CFG && AYUNKA_CFG.supabase);
    const espacio = (l && l.espacio) || (window.AYUNKA_CFG && AYUNKA_CFG.espacio) || 'ayunka';
    if (!sp || !sp.url || !sp.clave || !l || !l.correo || !l.clave) return null;
    return { supabase: sp, espacio, correo: l.correo, clave: l.clave };
  }
  const configurado = () => !!cfg();
  const encendida = () => st.lista;

  function guardarCfg(supabase, espacio, correo, clave) {
    localStorage.removeItem(APAGADA);
    localStorage.setItem(CFG, JSON.stringify({ supabase, espacio, correo, clave }));
  }
  function apagar() {
    localStorage.setItem(APAGADA, 'si');
    st.lista = false;
    if (st.canal) { st.sb.removeChannel(st.canal); st.canal = null; }
    nota('desactivada');
  }

  function nota(m) {
    st.estado = m;
    document.dispatchEvent(new CustomEvent('nube:estado', { detail: m }));
  }

  async function bajarTodo(c) {
    const out = { params: {}, _actualizado: 0 };
    const { data: cab } = await st.sb.from('espacios').select().eq('espacio', c.espacio).maybeSingle();
    if (cab) { out.params = cab.params || {}; out._actualizado = cab.actualizado || 0; }
    for (const col of Datos.COLECCIONES) {
      const { data, error } = await st.sb.from(col).select('id,ficha').eq('espacio', c.espacio);
      if (error) throw error;
      out[col] = (data || []).map(r => r.ficha);
    }
    return out;
  }

  async function subirTodo(c, motivo) {
    const { error: eEsp } = await st.sb.from('espacios').upsert({
      espacio: c.espacio, params: DB.params || {}, actualizado: DB._actualizado || Date.now(),
      por_quien: st.correo || '?', motivo: motivo || 'subida completa'
    });
    if (eEsp) throw eEsp;
    for (const col of Datos.COLECCIONES) {
      const filas = (DB[col] || []).map(f => ({ espacio: c.espacio, id: String(f.id), actualizado: DB._actualizado || Date.now(), ficha: f }));
      if (!filas.length) continue;
      const { error } = await st.sb.from(col).upsert(filas);
      if (error) throw error;
    }
    st.base = JSON.parse(JSON.stringify(DB));
  }

  async function subirCambios(c, motivo) {
    if (!st.base) return subirTodo(c, motivo);
    let huboCambios = false;
    for (const col of Datos.COLECCIONES) {
      const antes = new Map((st.base[col] || []).map(f => [String(f.id), JSON.stringify(f)]));
      const filas = [];
      for (const f of (DB[col] || [])) {
        const id = String(f.id);
        if (antes.get(id) !== JSON.stringify(f)) {
          filas.push({ espacio: c.espacio, id, actualizado: DB._actualizado || Date.now(), ficha: f });
        }
        antes.delete(id);
      }
      // Fichas que desaparecieron del todo del arreglo local (no solo activo:false).
      // Datos.quitar() nunca borra del arreglo, así que esto es defensivo -- en la
      // práctica solo Datos.reemplazar() reemplaza el arreglo entero, y ese camino
      // también resetea `st.base`, por lo que esta rama no debería dispararse nunca.
      for (const id of antes.keys()) {
        const { data: fila } = await st.sb.from(col).select('ficha').eq('espacio', c.espacio).eq('id', id).maybeSingle();
        if (fila && fila.ficha) {
          const ficha = Object.assign({}, fila.ficha, { activo: false });
          filas.push({ espacio: c.espacio, id, actualizado: DB._actualizado || Date.now(), ficha });
        }
      }
      if (filas.length) {
        huboCambios = true;
        const { error } = await st.sb.from(col).upsert(filas);
        if (error) throw error;
      }
    }
    if (JSON.stringify(st.base.params) !== JSON.stringify(DB.params) || huboCambios) {
      const { error } = await st.sb.from('espacios').upsert({
        espacio: c.espacio, params: DB.params || {}, actualizado: DB._actualizado || Date.now(),
        por_quien: st.correo || '?', motivo: motivo || 'edición'
      });
      if (error) throw error;
    } else if (!huboCambios) {
      nota('sin cambios que subir'); return;
    }
    st.base = JSON.parse(JSON.stringify(DB));
    nota('guardada en la nube ' + new Date().toLocaleTimeString('es-CL'));
  }

  let timer = null;
  function guardarPronto(motivo) {
    if (!st.lista || st.aplicando) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      const c = cfg(); if (!c) return;
      subirCambios(c, motivo).catch(e => nota('error al guardar: ' + (e.message || e)));
    }, 1500);
  }

  function hayDatosReales(db) {
    if (db._semilla) return false;
    return Datos.COLECCIONES.some(c => (db[c] || []).length > 0) && (db._actualizado || 0) > 0;
  }

  function planear(remoto) {
    const localTiene = hayDatosReales(DB);
    const remotoTiene = Datos.COLECCIONES.some(c => (remoto[c] || []).length > 0);

    if (!remotoTiene) return { accion: 'subir', porque: 'la nube está vacía' };
    if (!localTiene)  return { accion: 'bajar', porque: 'este equipo no tiene datos propios todavía' };

    const tLocal = DB._actualizado || 0, tRemoto = remoto._actualizado || 0;
    if (!localStorage.getItem(VISTO)) {
      return { accion: 'conflicto', porque: 'este equipo tiene datos propios y nunca ha subido',
               sugerido: 'subir', local: resumen(DB, tLocal), remoto: resumen(remoto, tRemoto) };
    }
    if (tLocal > tRemoto) return { accion: 'subir', porque: 'lo de este equipo es más nuevo' };
    if (tRemoto > tLocal) {
      return { accion: 'conflicto', porque: 'la nube tiene algo más nuevo que este equipo',
               sugerido: 'bajar', local: resumen(DB, tLocal), remoto: resumen(remoto, tRemoto) };
    }
    return { accion: 'nada', porque: 'los dos lados están iguales' };
  }

  function resumen(db, t) {
    return { fecha: t ? new Date(t).toLocaleString('es-CL') : 'sin fecha', conteos: Datos.resumen(db) };
  }

  function aplicarRemoto(remoto) {
    st.aplicando = true;
    const db = Datos.vacia();
    db.params = remoto.params || {};
    Datos.COLECCIONES.forEach(c => db[c] = remoto[c] || []);
    db._actualizado = remoto._actualizado || Date.now();
    db._semilla = false;
    Datos.reemplazar(db, 'bajada de la nube');
    st.base = JSON.parse(JSON.stringify(DB));
    st.aplicando = false;
  }

  function suscribirRealtime(c) {
    if (st.canal) st.sb.removeChannel(st.canal);
    let canal = st.sb.channel('ayunka-' + c.espacio);
    const todas = ['espacios', ...Datos.COLECCIONES];
    for (const tabla of todas) {
      canal = canal.on('postgres_changes',
        { event: '*', schema: 'ayunka', table: tabla, filter: 'espacio=eq.' + c.espacio },
        () => { if (!st.aplicando) refrescarDesdeNube(c); });
    }
    canal.subscribe();
    st.canal = canal;
  }

  async function refrescarDesdeNube(c) {
    if (st.aplicando) return;
    try {
      const remoto = await bajarTodo(c);
      if ((remoto._actualizado || 0) > (DB._actualizado || 0)) {
        aplicarRemoto(remoto);
        nota('actualizado desde otro equipo ' + new Date().toLocaleTimeString('es-CL'));
      }
    } catch (e) { /* un fallo de refresco en vivo no es crítico, se reintenta con el próximo cambio */ }
  }

  async function conectar(alConflicto) {
    const c = cfg();
    if (!c) { nota('desactivada'); return; }
    try {
      nota('conectando…');
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      st.sb = createClient(c.supabase.url, c.supabase.clave, { db: { schema: 'ayunka' } });

      const { error: eAuth } = await st.sb.auth.signInWithPassword({ email: c.correo, password: c.clave });
      if (eAuth) {
        nota('no pude entrar: ' + eAuth.message + ' — revisa el correo y la clave en Ajustes');
        return;
      }
      st.correo = c.correo;

      if (!localStorage.getItem(VISTO) && hayDatosReales(DB)) {
        Datos.descargarRespaldo('antes-de-sincronizar');
      }

      nota('comparando…');
      const remoto = await bajarTodo(c);
      const plan = planear(remoto);

      if (plan.accion === 'conflicto') {
        nota('esperando que decidas');
        const eleccion = await alConflicto(plan);
        if (eleccion === 'subir') { st.lista = true; await subirTodo(c, 'elegido por el usuario'); nota('subido lo de este equipo'); }
        else if (eleccion === 'bajar') { aplicarRemoto(remoto); st.lista = true; nota('bajado de la nube'); }
        else { nota('sincronización en pausa — nadie decidió'); return; }
      } else if (plan.accion === 'bajar') {
        aplicarRemoto(remoto); st.lista = true; nota('datos cargados de la nube');
      } else if (plan.accion === 'subir') {
        st.lista = true; await subirTodo(c, 'primera subida');
        nota('tus datos se subieron');
      } else {
        st.lista = true; st.base = JSON.parse(JSON.stringify(DB)); nota('al día');
      }
      localStorage.setItem(VISTO, String(Date.now()));
      suscribirRealtime(c);
    } catch (e) {
      console.error(e);
      nota('error: ' + (e.message || e));
    }
  }

  async function leerImpresoraViva() {
    const c = cfg();
    if (!c || !st.lista || !st.sb) return null;
    try {
      const { data } = await st.sb.from('impresora_estado').select().eq('espacio', c.espacio).maybeSingle();
      if (!data) return null;
      return { estado: data.estado, capaActual: data.capa_actual, capaTotal: data.capa_total, progreso: data.progreso };
    } catch (e) { return null; }
  }

  window.Nube = {
    cfg, configurado, encendida, guardarCfg, apagar, conectar, guardarPronto,
    estado: () => st.estado, correo: () => st.correo,
    visto: () => !!localStorage.getItem(VISTO),
    leerImpresoraViva,
    forzarSubida: async () => { const c = cfg(); if (c && st.lista) { await subirTodo(c, 'forzado'); nota('subido a mano'); } }
  };
})();
