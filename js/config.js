/* Ayünka Studio · configuración pública.
 *
 * Acá SOLO van valores públicos. La `apiKey` de Firebase no es un secreto: identifica el
 * proyecto, no autoriza nada — lo que protege los datos son las reglas de `firestore.rules`,
 * y esas hay que PUBLICARLAS en la consola, porque cambiar el archivo no publica nada.
 *
 * El correo y la clave de acceso NUNCA van acá. Viven solo en el localStorage de cada
 * equipo, se escriben en Ajustes, y no entran a git.
 */
window.AYUNKA_CFG = {
  firebase: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: ''
  },
  espacio: 'ayunka',
  // Almacenamiento de fotos y archivos (Supabase). Clave publicable, protegida por RLS.
  supabase: { url: '', clave: '', bucket: 'archivos' }
};
