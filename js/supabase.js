/* Ayünka Studio — subir fotos a Supabase.
 *
 * Encargo del 2-sep, punto E, más la especificación del 3-sep en SUPERVISION.md ("Supabase
 * · lo que se hizo el 3-sep y lo que falta programar"): Cowork cerró el bucket `archivos`,
 * que tenía una sola política ALL para anon+authenticated — cualquiera con la clave
 * anónima podía subir, pisar y borrar los 145 archivos. Ahora leer sigue siendo público
 * (`anon`), pero subir/reemplazar/borrar exige estar autenticado de verdad.
 *
 * Por eso esto ya no manda la clave anónima como Bearer: inicia sesión con el correo y la
 * contraseña (los mismos que ya usa la sincronización — misma persona, mismo negocio) y
 * manda el `access_token` de esa sesión. La sesión vive SOLO en memoria, nunca en
 * localStorage junto al resto de la base — si se sincroniza a Firestore, viajaría la
 * sesión completa. Se rehace sola si se pierde (recarga de página, token vencido).
 */
(function () {
  'use strict';
  const TIPOS_OK = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  const MAX_BYTES = 8 * 1024 * 1024; // 8 MB — de sobra para una foto de catálogo
  const CLAVE_CFG = 'ayunka2-supabase-cfg';
  const CLAVE_NUBE = 'ayunka2-nube-cfg'; // de nube.js -- reusa el mismo correo/clave, no los duplica

  function cfg() {
    let guardado = null;
    try { guardado = JSON.parse(localStorage.getItem(CLAVE_CFG) || 'null'); } catch (e) {}
    const pub = (window.AYUNKA_CFG && AYUNKA_CFG.supabase) || {};
    const url = (guardado && guardado.url) || pub.url || '';
    const clave = (guardado && guardado.clave) || pub.clave || '';
    const bucket = (guardado && guardado.bucket) || pub.bucket || 'archivos';
    if (!url || !clave) return null;
    return { url: url.replace(/\/+$/, ''), clave, bucket };
  }
  const configurado = () => !!cfg();

  function guardarCfg(url, clave, bucket) {
    localStorage.setItem(CLAVE_CFG, JSON.stringify({ url, clave, bucket: bucket || 'archivos' }));
  }

  function credencialesDeAcceso() {
    let n = null;
    try { n = JSON.parse(localStorage.getItem(CLAVE_NUBE) || 'null'); } catch (e) {}
    if (!n || !n.correo || !n.clave) return null;
    return { correo: n.correo, clave: n.clave };
  }

  // Sesión de Supabase Auth -- SOLO en memoria (ver el comentario de arriba).
  let sesion = null; // { accessToken, refreshToken, expira }

  async function iniciarSesion(c) {
    const acceso = credencialesDeAcceso();
    if (!acceso) throw new Error('falta el correo y la contraseña de acceso (Ajustes → Sincronización)');
    const r = await fetch(c.url + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { apikey: c.clave, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: acceso.correo, password: acceso.clave })
    });
    const j = await r.json();
    if (!r.ok) throw new Error('no se pudo entrar a Supabase: ' + (j.error_description || j.msg || r.status));
    sesion = { accessToken: j.access_token, refreshToken: j.refresh_token, expira: Date.now() + (Math.max(j.expires_in, 0) - 60) * 1000 };
    return sesion;
  }

  async function renovarSesion(c) {
    if (!sesion || !sesion.refreshToken) return null;
    try {
      const r = await fetch(c.url + '/auth/v1/token?grant_type=refresh_token', {
        method: 'POST', headers: { apikey: c.clave, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: sesion.refreshToken })
      });
      const j = await r.json();
      if (!r.ok) return null;
      sesion = { accessToken: j.access_token, refreshToken: j.refresh_token, expira: Date.now() + (Math.max(j.expires_in, 0) - 60) * 1000 };
      return sesion;
    } catch (e) { return null; }
  }

  async function sesionValida(c) {
    if (sesion && Date.now() < sesion.expira) return sesion;
    const renovada = await renovarSesion(c);
    if (renovada) return renovada;
    return iniciarSesion(c);
  }

  // Mantiene el SKU tal cual (AY-BOR-001), solo saca lo que no es seguro en una URL --
  // las fotos que ya existen usan el SKU en mayúsculas, y hay que seguir esa convención.
  function nombreSeguro(s) {
    return String(s || 'foto').trim().replace(/[^A-Za-z0-9._-]+/g, '-').replace(/(^-|-$)/g, '') || 'foto';
  }

  /** Sube `file` (un Blob/File del navegador) y devuelve la URL pública real. */
  async function subirFoto(file, nombreBase, carpeta) {
    const c = cfg();
    if (!c) throw new Error('Supabase no está configurado (Ajustes → Fotos y archivos)');
    if (!file || typeof file.type !== 'string') throw new Error('no llegó un archivo válido');
    const ext = TIPOS_OK[file.type];
    if (!ext) throw new Error('solo se aceptan fotos JPEG, PNG o WEBP');
    if (file.size > MAX_BYTES) throw new Error('la foto pesa más de 8 MB');

    const s = await sesionValida(c);
    const ruta = (carpeta || 'catalogo') + '/' + nombreSeguro(nombreBase) + '.' + ext;
    const r = await fetch(c.url + '/storage/v1/object/' + c.bucket + '/' + ruta, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + s.accessToken, apikey: c.clave, 'Content-Type': file.type, 'x-upsert': 'true' },
      body: file
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      throw new Error('Supabase respondió ' + r.status + (j.message ? ': ' + j.message : ''));
    }
    return c.url + '/storage/v1/object/public/' + c.bucket + '/' + ruta;
  }

  window.Supabase = { configurado, cfg, guardarCfg, subirFoto, nombreSeguro,
    // expuestos para poder verificar el flujo de sesión de punta a punta sin exponer el
    // estado interno a quien llama por accidente.
    _sesionValida: sesionValida, _sesionActual: () => sesion };
})();
