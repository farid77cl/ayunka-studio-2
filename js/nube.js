/* Ayünka Studio · sincronización con Firestore.
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
 * Un documento POR FICHA -- no la base entera en un solo documento. Editar un producto
 * en el PC ya no puede pisar un filamento nuevo del teléfono.
 */
(function () {
  const CFG = 'ayunka-nube-cfg';
  const APAGADA = 'ayunka-nube-apagada';
  const VISTO = 'ayunka-nube-visto';

  const st = { lista: false, aplicando: false, fs: null, base: null,
               timer: null, estado: 'desactivada', correo: null };

  function cfg() {
    if (localStorage.getItem(APAGADA) === 'si') return null;
    let l = null;
    try { l = JSON.parse(localStorage.getItem(CFG) || 'null'); } catch (e) {}
    const fb = (l && l.firebase) || (window.AYUNKA_CFG && AYUNKA_CFG.firebase);
    const espacio = (l && l.espacio) || (window.AYUNKA_CFG && AYUNKA_CFG.espacio) || 'ayunka';
    if (!fb || !fb.projectId || !l || !l.correo || !l.clave) return null;
    return { firebase: fb, espacio, correo: l.correo, clave: l.clave };
  }
  const configurado = () => !!cfg();
  const encendida = () => st.lista;

  function guardarCfg(firebase, espacio, correo, clave) {
    localStorage.removeItem(APAGADA);
    localStorage.setItem(CFG, JSON.stringify({ firebase, espacio, correo, clave }));
  }
  function apagar() {
    localStorage.setItem(APAGADA, 'si');
    st.lista = false;
    nota('desactivada');
  }

  function nota(m) {
    st.estado = m;
    document.dispatchEvent(new CustomEvent('nube:estado', { detail: m }));
  }

  function raiz(c) { return st.fs.doc(st.db, 'negocios', c.espacio); }

  async function bajarTodo(c) {
    const out = { params: {}, _actualizado: 0 };
    const cab = await st.fs.getDoc(raiz(c));
    if (cab.exists()) {
      const d = cab.data() || {};
      out.params = d.params || {};
      out._actualizado = d.actualizado || 0;
    }
    for (const col of Datos.COLECCIONES) {
      const snap = await st.fs.getDocs(st.fs.collection(raiz(c), col));
      out[col] = snap.docs.map(d => d.data());
    }
    return out;
  }

  async function subirTodo(c, motivo) {
    const lote = [];
    lote.push(st.fs.setDoc(raiz(c), {
      params: DB.params || {},
      actualizado: DB._actualizado || Date.now(),
      porQuien: st.correo || '?',
      motivo: motivo || 'subida completa'
    }, { merge: true }));
    for (const col of Datos.COLECCIONES) {
      for (const f of (DB[col] || [])) {
        lote.push(st.fs.setDoc(st.fs.doc(raiz(c), col, String(f.id)), f));
      }
    }
    await Promise.all(lote);
    st.base = JSON.parse(JSON.stringify(DB));
  }

  async function subirCambios(c, motivo) {
    if (!st.base) return subirTodo(c, motivo);
    const tareas = [];
    for (const col of Datos.COLECCIONES) {
      const antes = new Map((st.base[col] || []).map(f => [String(f.id), JSON.stringify(f)]));
      for (const f of (DB[col] || [])) {
        const id = String(f.id);
        if (antes.get(id) !== JSON.stringify(f)) {
          tareas.push(st.fs.setDoc(st.fs.doc(raiz(c), col, id), f));
        }
        antes.delete(id);
      }
      for (const id of antes.keys()) {
        tareas.push(st.fs.setDoc(st.fs.doc(raiz(c), col, id), { activo: false }, { merge: true }));
      }
    }
    if (JSON.stringify(st.base.params) !== JSON.stringify(DB.params) || tareas.length) {
      tareas.push(st.fs.setDoc(raiz(c), {
        params: DB.params || {}, actualizado: DB._actualizado || Date.now(),
        porQuien: st.correo || '?', motivo: motivo || 'edición'
      }, { merge: true }));
    }
    if (!tareas.length) { nota('sin cambios que subir'); return; }
    await Promise.all(tareas);
    st.base = JSON.parse(JSON.stringify(DB));
    nota('guardada en la nube ' + new Date().toLocaleTimeString('es-CL'));
  }

  function guardarPronto(motivo) {
    if (!st.lista || st.aplicando) return;
    clearTimeout(st.timer);
    st.timer = setTimeout(() => {
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

  async function conectar(alConflicto) {
    const c = cfg();
    if (!c) { nota('desactivada'); return; }
    try {
      nota('conectando…');
      const [appM, authM, fsM] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js'),
        import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js')
      ]);
      const app = appM.initializeApp(c.firebase);
      const auth = authM.getAuth(app);
      try {
        await authM.signInWithEmailAndPassword(auth, c.correo, c.clave);
        st.correo = c.correo;
      } catch (e) {
        nota('no pude entrar: ' + (e.code || e.message) + ' — revisa el correo y la clave en Ajustes');
        return;
      }
      st.fs = fsM;
      st.db = fsM.getFirestore(app);

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
    } catch (e) {
      console.error(e);
      nota('error: ' + (e.message || e));
    }
  }

  async function leerImpresoraViva() {
    const c = cfg();
    if (!c || !st.lista || !st.fs) return null;
    try {
      const snap = await st.fs.getDoc(st.fs.doc(raiz(c), 'impresora', 'k2'));
      return snap.exists() ? snap.data() : null;
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
