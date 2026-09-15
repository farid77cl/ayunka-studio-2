/* Ayünka Studio · configuración pública. SOLO valores públicos -- el correo y la clave
   de acceso NUNCA van acá, viven solo en localStorage de cada equipo.
   `supabase.clave` es la publishable key (pública, protegida por RLS) -- no confundir con
   la contraseña de la cuenta que se escribe en Ajustes. Las fichas viven en el schema
   Postgres "ayunka" (dedicado, no "public") -- hay que exponerlo en Project Settings > Data
   API > "Exposed schemas" en el proyecto de Supabase. */
window.AYUNKA_CFG = {
  espacio: 'ayunka',
  supabase: { url: 'https://ncuvdpydwnepbysadoux.supabase.co', clave: 'sb_publishable_TXHodoTSMeCCPBvX86UyJQ_FvwUD2sJ', bucket: 'archivos' }
};
