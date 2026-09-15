# Agente K2 -- puente local (Fase 6)

## Qué hace

Se conecta por WebSocket a la K2 y escribe el estado normalizado en Supabase,
tabla `ayunka.impresora_estado` (una fila por `espacio`) -- la misma que la
vista **Historial K2** de la app ya sabe leer (`Nube.leerImpresoraViva()`).
Con el agente corriendo, esa vista muestra estado/capa/progreso en vivo sin
que la app misma tenga que hablarle a la impresora (la app es una PWA
servida por GitHub Pages, no tiene acceso a la red local de la K2).

Campos que escribe (todos opcionales -- si un mensaje no trae un campo, no
se escribe encima del valor anterior):

- `estado` (texto: `preparando`/`imprimiendo`/`detenida`/`pausada`)
- `capaActual`, `capaTotal` (número)
- `progreso` (número, 0-100)

## Verificado contra la K2 real (15-sep-2026)

`interpretar()` en `k2-puente.js` está probado contra la K2 de Farid de
verdad (hostname `K2-5CDF`, firmware DWIN 1.1.6.7), no a modo de mejor
intento. Detalle completo en `sesion-log.md`, Sesión 3, y en el comentario
arriba de `interpretar()` en el propio archivo. Lo único sin confirmar contra
hardware real son los códigos de estado 0/4/5 (preparando/detenida/pausada)
-- salen del proyecto de referencia
[`3dg1luk43/ha_creality_ws`](https://github.com/3dg1luk43/ha_creality_ws), no
de una prueba propia (no se puede pausar/detener un trabajo real solo para
confirmarlo). Solo el código 1 ("imprimiendo") está confirmado en vivo.

## Puesta en marcha

```bash
cd agente
npm install
cp config.example.json config.json
# edita config.json: IP de la K2, espacio (el mismo que en Ajustes de la app),
# la URL del proyecto de Supabase y la service_role key
```

La `service_role` key se saca desde el dashboard de Supabase (Project
Settings → API → `service_role`, la secreta, nunca la publishable) -- ese
rol bypassa RLS, igual que antes hacía la cuenta de servicio de Firebase.
**No se sube a git** -- `config.json` y cualquier `*.json` de credenciales
quedan fuera del repo (ver `.gitignore`).

```bash
npm run debug   # solo mirar los mensajes crudos, no escribe nada
npm start       # modo real: interpreta y escribe a Supabase
```

Pensado para dejarlo corriendo en el mismo equipo/red que la K2 (por
ejemplo, la Raspberry que ya corre n8n) -- no es parte de la PWA.

## Trampas conocidas

- **La `service_role` key tiene acceso total al proyecto de Supabase**,
  sin pasar por RLS. Guárdala con el mismo cuidado que las otras
  credenciales del negocio (`negocio/credenciales-privadas.txt`).
- **Reconexión con backoff exponencial** (hasta 30s): si la K2 se apaga o
  cambia de IP, el script no se cae, solo reintenta.
- **Las escrituras a Supabase se limitan a una cada 3 segundos** como
  mínimo, para no generar tráfico innecesario si la impresora manda estado
  muy seguido.
- **Reemplaza a `negocio/impresora/agente-k2.js`**, que hacía lo mismo pero
  vía Moonraker HTTP y escribiendo a Firestore. Ese script queda intacto en
  el repo `negocio` como referencia, pero no se usa más -- este es el que
  está verificado y en producción.
