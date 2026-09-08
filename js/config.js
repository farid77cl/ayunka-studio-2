/* Ayünka Studio · configuración pública.
 *
 * Acá SOLO van valores públicos. La `apiKey` de Firebase no es un secreto: identifica el
 * proyecto, no autoriza nada — lo que protege los datos son las reglas de `firestore.rules`,
 * y esas hay que PUBLICARLAS en la consola, porque cambiar el archivo no publica nada.
 *
 * El correo y la clave de acceso NUNCA van acá. Viven solo en el localStorage de cada
 * equipo, se escriben en Ajustes, y no entran a git.
 *
 * Por qué están rellenos desde el 8-sep: estaban en blanco, y para usar la nube o subir una
 * foto había que pegar a mano el objeto `firebaseConfig` y la clave de Supabase en Ajustes.
 * La regla del proyecto es explícita: «nunca más pedirle a Farid que copie y pegue JSON o
 * tokens — se equivoca al pegar y se pierde el tiempo». Lo único que queda por escribir en
 * Ajustes es el correo y la contraseña de acceso, que son suyos y no pueden vivir acá.
 */
window.AYUNKA_CFG = {
  /* Proyecto `ayunka-studio` de Firebase. Son los mismos valores que ya estaban publicados
     en el repo de la app anterior (`ayunka-studio/js/config.js`): identifican el proyecto
     en el navegador y nada más. */
  firebase: {
    apiKey: 'AIzaSyB1SD1ZQ0ju2Mwz2S9z_OObVUb8nbPbp1E',
    authDomain: 'ayunka-studio.firebaseapp.com',
    projectId: 'ayunka-studio',
    storageBucket: 'ayunka-studio.firebasestorage.app',
    messagingSenderId: '538442437172',
    appId: '1:538442437172:web:4bfd8965aabfee0a4bb061'
  },
  espacio: 'ayunka',

  /* Almacenamiento de fotos y archivos (Supabase), proyecto `ayunka`.
   *
   * La `clave` es la anónima (`anon`), que está hecha para viajar en el navegador. Que esté
   * acá no abre nada, y se comprobó en la propia base el 8-sep ANTES de escribirla: con el
   * rol `anon`, insertar en el bucket `archivos` responde
   *
   *     new row violates row-level security policy for table "objects"
   *
   * Las cuatro políticas del bucket: LEER para `anon` y `authenticated` —que es lo que hace
   * que la URL de una foto sirva en WhatsApp y en el catálogo de Meta— y SUBIR, REEMPLAZAR
   * y BORRAR solo para `authenticated`. Subir sigue exigiendo el correo y la contraseña de
   * Ajustes, igual que antes.
   *
   * El proyecto también tiene una clave `sb_publishable_…`, el formato nuevo que se rota
   * aparte. No se usó porque la que está probada contra este servidor es la `anon`, y esto
   * no se cambia por una sin probar. */
  supabase: {
    url: 'https://ncuvdpydwnepbysadoux.supabase.co',
    clave: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jdXZkcHlkd25lcGJ5c2Fkb3V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMDQ1NTAsImV4cCI6MjA5Nzc4MDU1MH0.gvboABLIwiWmx2ea5gaI32DGzb6Xoihp7QG0XUPbZgw',
    bucket: 'archivos'
  }
};
