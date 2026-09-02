/* Ayünka Studio — subir fotos a Supabase.
 *
 * Encargo del 2-sep, punto E: "Supabase solo aparece en config.js; no está implementado.
 * Sin esto, un producto nuevo no puede tener foto." Las fotos actuales son URLs que ya
 * existían, subidas a mano; esto agrega el camino para subir una nueva desde la app.
 *
 * Sin SDK: la clave de Supabase es la "anon key" — publicable, protegida por Row Level
 * Security en el bucket, no por estar en secreto (js/config.js ya lo dice así). Con eso
 * alcanza para hablar directo con la REST de Storage.
 */
(function () {
  'use strict';
  const TIPOS_OK = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  const MAX_BYTES = 8 * 1024 * 1024; // 8 MB — de sobra para una foto de catálogo

  function cfg() {
    const c = (window.AYUNKA_CFG || {}).supabase || {};
    if (!c.url || !c.clave) return null;
    return { url: c.url.replace(/\/+$/, ''), clave: c.clave, bucket: c.bucket || 'archivos' };
  }
  const configurado = () => !!cfg();

  // Mantiene el SKU tal cual (AY-BOR-001), solo saca lo que no es seguro en una URL --
  // las fotos que ya existen usan el SKU en mayúsculas, y hay que seguir esa convención.
  function nombreSeguro(s) {
    return String(s || 'foto').trim().replace(/[^A-Za-z0-9._-]+/g, '-').replace(/(^-|-$)/g, '') || 'foto';
  }

  /** Sube `file` (un Blob/File del navegador) y devuelve la URL pública real. */
  async function subirFoto(file, nombreBase, carpeta) {
    const c = cfg();
    if (!c) throw new Error('Supabase no está configurado (revisa js/config.js)');
    if (!file || typeof file.type !== 'string') throw new Error('no llegó un archivo válido');
    const ext = TIPOS_OK[file.type];
    if (!ext) throw new Error('solo se aceptan fotos JPEG, PNG o WEBP');
    if (file.size > MAX_BYTES) throw new Error('la foto pesa más de 8 MB');

    const ruta = (carpeta || 'catalogo') + '/' + nombreSeguro(nombreBase) + '.' + ext;
    const r = await fetch(c.url + '/storage/v1/object/' + c.bucket + '/' + ruta, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + c.clave, 'Content-Type': file.type, 'x-upsert': 'true' },
      body: file
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      throw new Error('Supabase respondió ' + r.status + (j.message ? ': ' + j.message : ''));
    }
    return c.url + '/storage/v1/object/public/' + c.bucket + '/' + ruta;
  }

  window.Supabase = { configurado, subirFoto, nombreSeguro };
})();
