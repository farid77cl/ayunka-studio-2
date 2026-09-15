# Bitácora — Ayünka Studio 2 (reescritura)

## Sesión 1 — Reescritura completa desde cero (Fases 0-7) · 2026-09-13

### Lo que se hizo
- Se borró por completo el repo local anterior de Ayünka Studio 2, a pedido explícito de Farid ("empezar desde cero"), tras varias rondas en que se insistió en parchar en vez de reescribir.
- Se inventarió a fondo qué hace la app v1 (`negocio/ayunka-studio/`) y la Studio 2 anterior, mirando código, logs y bitácoras, para no perder ninguna función ya validada.
- Se escribió `docs/superpowers/plans/ROADMAP.md`, el plan maestro en 8 fases, y se ejecutaron las 8 completas en una sola sesión:
  - **Fase 0** — fundación: `index.html`, `js/db.js` (modelo de datos + migraciones), `js/nube.js` (sincronización Firestore documento-por-ficha), `js/ui.js`, `css/app.css` ("Acuarela Silvestre"), `js/app.js`.
  - **Fase 1** — las 9 vistas núcleo: Ajustes, Clientes, Filamentos, Productos, Pedidos, Cotizar, Cola, Ventas y gastos, Pendientes, más `js/costos.js` (motor de costeo por oficio).
  - **Fase 2** — generador 3D: bolsillo NFC (círculo de 13.5mm de radio, no cuadrado), pausa de impresión, verificador de G-code ("compuerta 7") verificado contra dos archivos reales de referencia, exportador 3MF con `negative_part`.
  - **Fase 3** — generador de perfiles de impresión: 8 de 9 archivos de la v1 resultaron sin dependencias y se portaron verbatim; solo la vista se reescribió.
  - **Fase 4** — cotización en PDF real (jsPDF), portado de la v1.
  - **Fase 5** — vista WhatsApp con los textos de atención, portados verbatim (contenido de negocio ya decidido, no se reescribe).
  - **Fase 6** — Historial K2: empareja piezas del historial de impresión con productos del catálogo, propone gramos/horas reales, crea productos desde piezas huérfanas, y muestra estado en vivo leyendo Firestore.
  - **Fase 7** — Bandejas mixtas: arma una bandeja que mezcla piezas de pedidos de clientes distintos, algo que ni la v1 ni ningún competidor hace.
- Cada fase se verificó de verdad, no solo que compilara: Playwright contra la app real servida con `python -m http.server`, con datos falsos pero realistas, revisando la salida en pantalla.
- Se escribió `agente/k2-puente.js` (Node.js), el puente WebSocket-K2 → Firestore, marcado explícitamente como no verificado contra hardware real.

### Decisiones
- **No parchar, reescribir de cero.** Farid lo pidió varias veces y se le dio la razón después de patrones repetidos de solo arreglar partes sueltas cuando el problema era estructural.
- **Portar verbatim lo que ya funciona y está decidido** (Perfiles, PDF, WhatsApp, K2), reescribir solo lo que tenía bugs o le faltaba diseño. Evitó re-litigar decisiones de negocio ya tomadas (textos, tarifas, paleta).
- **El repo viejo de GitHub (`farid77cl/ayunka-studio-2`, hasta el 12-sep) se deja intacto como archivo** — es la referencia de qué ya se probó que funciona.
- **Bandejas mixtas necesitaba una decisión de modelo de datos sin respuesta obvia en el código**: cómo representar el tamaño físico de una pieza. Se le preguntó a Farid en vez de inventar — eligió agregar ancho/largo (mm) opcionales al producto, en vez de un conteo aproximado "piezas por bandeja" o prescindir de la geometría.
- **El bolsillo NFC es un círculo de 13.5mm de radio, no un cuadrado de 27×27**, corregido tras inspeccionar el 3MF real verificado.

### Errores y cómo se resolvieron
- El verificador de G-code (heredado de una sesión anterior a esta reescritura) tenía tres bugs ya corregidos antes de portarlo: confundía la capa sólida del piso con las capas huecas; muestreaba por el punto de destino de cada segmento en vez del punto medio (una línea de puente larga daba falso positivo); y calculaba el radio de búsqueda del tamaño completo de la pieza en vez de un valor fijo razonable.
- `index.html` cargaba three.js/opentype.js con `defer` en el `<head>` mientras el resto de scripts corría sin `defer` en el `<body>` — se ejecutaban en el orden equivocado. Se sacó `defer` y se movieron los `<script>` de CDN al principio del `<body>`.
- Playwright: `.fill()` sobre inputs con `onchange` (no `oninput`) no dispara el handler sin un `.blur()` explícito después — se aplicó en todos los tests de líneas editables.
- Historial K2: la vista se registró como `Vistas.impresoravista` pero el ítem de navegación usa el id `impresora` — `app.js` busca `Vistas[id]`, así que la vista nunca se pintaba. Se corrigió el nombre del objeto y los `onclick` que lo referenciaban.

### Archivos creados o modificados
- Todo el repo es nuevo: `index.html`, `css/app.css`, `js/*.js`, `js/vistas/*.js`, `agente/` (puente K2 + README propio), `docs/superpowers/plans/` (ROADMAP y planes por fase).
- Ver `git log` para el detalle completo, un commit por pieza funcional.

### Pendiente
- [ ] Envíos por Chilexpress: bloqueado en la clave de `developers.wschilexpress.com` — nada más que programar hasta que Farid la consiga.
- [ ] Migrar los datos reales (productos, filamentos, clientes, pedido de LIDCAR) al modelo nuevo — hoy la app parte con `datos/semilla.json` vacío.
- [ ] Configurar Firebase real en `js/config.js` (hoy todo en blanco) para que la sincronización funcione fuera de pruebas locales.
- [ ] Falta un `README.md` en la raíz y por carpeta, como en el resto de los repos del negocio (regla no opcional del `CLAUDE.md` de `negocio/`).

---

## Sesión 3 — Auditoría completa contra el ROADMAP y la K2 real, en el taller · 2026-09-15

### Lo que se hizo
- Se auditaron las 8 fases del ROADMAP contra el sitio publicado, con Playwright real
  (no solo lectura de código): crear cliente/producto/pedido, generar llavero con NFC,
  descargar y verificar `.creality_printer`/PDF con herramientas independientes de
  Python, correr el verificador de G-code contra los dos gcode de referencia. Detalle
  completo en `negocio/.planning/REVISION-STUDIO-2-2026-09-15.md`.
- Con Farid físicamente al lado de la K2 (mismo `192.168.100.x`), se probó
  `agente/k2-puente.js --debug` contra la impresora real por primera vez.

### Decisiones
- Con el mensaje real capturado, se corrigió `interpretar()`: los nombres de campo
  adivinados (`totalLayer`, `percent`/`progress`, `state` como texto) no coincidían con
  ninguno reales (`TotalLayer`, `printProgress`, `state` como código numérico). El mapeo
  de códigos de estado (0/4/5) sale del proyecto de referencia externo
  `3dg1luk43/ha_creality_ws` — solo el código 1 ("imprimiendo") quedó confirmado en vivo;
  los demás no se probaron a propósito, para no arriesgar el trabajo real en curso.

### Errores y cómo se resolvieron
- `interpretar()` encadenaba candidatos con `||`, que trata `0` como ausente — si la capa
  real fuera 0 nunca se habría leído. Se cambió a un `primero()` que solo descarta `null`.

### Archivos creados o modificados
- `agente/k2-puente.js` — `interpretar()` con los nombres de campo reales y el mapeo de
  estados, verificado de nuevo con `npm run debug` contra la K2 real tras el cambio.

### Pendiente
- [ ] Confirmar los códigos de estado 0/4/5 (preparando/detenida/pausada) contra la K2
  real cuando corresponda naturalmente (no forzar una pausa solo para probarlo).
- Los 4 hallazgos nuevos de la auditoría (precio sugerido exige guardar dos veces,
  Cotizar no se refresca solo, botón de WhatsApp en Cotizar no existe en pantalla,
  ventana horaria de la K2 en Cola nunca implementada) y los mensajes de WhatsApp de
  "pedido confirmado"/"listo para retiro" que nunca existieron: detalle y contexto
  completo en `negocio/.planning/REVISION-STUDIO-2-2026-09-15.md`.
- Envíos Chilexpress, datos reales, Firebase y READMEs: sigue todo abierto (ver arriba).

---

## Sesión 2 — Publicación en GitHub y bitácora · 2026-09-14

### Lo que se hizo
- Se subió el repo reescrito a GitHub como `farid77cl/ayunka-studio-2`, rama `main`.
- Se creó esta bitácora.

### Decisiones
- El repo viejo (`farid77cl/ayunka-studio-2`, historial hasta el 12-sep) se renombró a `farid77cl/ayunka-studio-2-archivo` en vez de borrarse, para conservar el nombre `ayunka-studio-2` (y así la URL de GitHub Pages) para el repo nuevo. Decisión de Farid entre tres opciones planteadas.
- Se usó HTTPS para el push en vez de SSH: la verificación de host SSH falló en esta máquina/entorno y HTTPS con el token de `gh` funcionó sin fricción.
- La rama local se renombró de `master` a `main` antes de subir, para que coincida con la convención del repo viejo y de GitHub Pages.

### Errores y cómo se resolvieron
- `gh repo create ... --push` falló con "Host key verification failed" al intentar por SSH. Se cambió el remoto a `https://github.com/farid77cl/ayunka-studio-2.git` y el push funcionó usando la autenticación por token que ya tenía `gh`.

### Archivos creados o modificados
- `sesion-log.md` — esta bitácora.

### Pendiente
- [x] Activar GitHub Pages en el repo nuevo — hecho el 15-sep, `https://farid77cl.github.io/ayunka-studio-2/` en vivo (y se apagó el de la v1 vieja, que quedaba encima).
- [ ] Lo que quedó pendiente de la Sesión 1 sigue todo abierto salvo el agente K2, ya probado en la Sesión 3 (envíos bloqueados, datos reales sin migrar, READMEs por carpeta). Firebase se reemplazó por Supabase en la Sesión 4 — ver ahí los pasos que le faltan a Farid.

---

## Sesión 4 — Firebase se retira, Supabase queda como único backend · 2026-09-15

### Lo que se hizo
- Se decidió (con Farid, actuando yo como si fuera el CTO) dejar de usar Firebase/Firestore
  del todo y consolidar en Supabase, que ya se usaba para storage y para el pipeline de
  redes sociales con n8n — un solo proveedor en vez de dos resolviendo el mismo problema.
- Se creó el schema Postgres `ayunka` (dedicado, no `public`) en el proyecto real
  `ncuvdpydwnepbysadoux`, vía la API de Supabase: 12 tablas (una por colección de
  `Datos.COLECCIONES`, más `espacios` y `impresora_estado`), RLS habilitado con policy para
  cuentas autenticadas, grants sin `anon`, y Realtime activado sobre las 12 tablas.
- Se reescribió `js/nube.js` completo manteniendo la misma API pública que ya usaban
  `app.js`/`ajustes.js` (mismo diseño: documento raíz por espacio, diff antes de subir,
  resolución de conflicto por fecha) — solo cambió el motor de abajo, de Firestore a
  Supabase (`@supabase/supabase-js@2`, cargado igual que antes con `import()` dinámico).
  El listener en vivo (antes `onSnapshot`) ahora es `postgres_changes` de Supabase Realtime.
- Se migró `agente/k2-puente.js` (el puente K2 → nube, probado hoy en la Sesión 3) de
  `firebase-admin` a `@supabase/supabase-js` con la `service_role` key.
- Se probó en vivo, sirviendo la app localmente con Playwright: la vista Ajustes carga sin
  errores, el SDK de Supabase se conecta al proyecto real, y un intento de login con
  credenciales inventadas llegó de verdad a la API de Supabase y volvió el error esperado
  ("Invalid login credentials") mostrado limpio en pantalla, sin ninguna excepción de JS.

### Decisiones
- **Schema dedicado (`ayunka`), no prefijo en `public`.** El mismo proyecto Supabase ya
  tiene tablas `tr_*` de otro proyecto de Farid completamente distinto (parece un tracker de
  relatos/lecturas) — usar un schema propio evita cualquier choque, a cambio de un paso
  manual de Farid (exponer el schema en el dashboard, ver Pendiente).
- **"Documento por fila" (jsonb), no normalización relacional completa.** Se mantiene la
  misma forma que tenía Firestore (cada ficha es un objeto plano guardado en una columna
  `ficha jsonb`) en vez de partir cada colección en columnas/tablas relacionadas de verdad.
  Es una migración de plataforma, no un rediseño de datos — normalizar después no exige
  otra migración de proveedor, porque ya queda en Postgres.
- **Solo `k2-puente.js` sigue vivo** como agente de la K2. `negocio/impresora/agente-k2.js`
  (la otra implementación, vía Moonraker) queda intacto en su repo pero documentado como
  reemplazado — dos agentes escribiendo el mismo dato ya había causado una duplicación
  real (ver Sesión 3).
- **No se tocó `ayunka-studio` (v1)**, que se queda con Firestore hasta que esta v2 la
  reemplace del todo — migrar sus datos reales es un trabajo aparte, más riesgoso, y no
  hacía falta para esta pasada.

### Archivos creados o modificados
- `js/nube.js` — reescritura completa (Firestore → Supabase).
- `js/config.js` — bloque `firebase` fuera, `supabase.url`/`clave` reales adentro.
- `js/vistas/ajustes.js`, `js/vistas/impresoravista.js` — referencias/comentarios
  actualizados.
- `agente/k2-puente.js`, `agente/package.json`, `agente/config.example.json`,
  `agente/README.md` — todo migrado a Supabase.

### Pendiente
- [ ] **Farid tiene que hacer 3 cosas a mano** antes de que la sincronización funcione de
  verdad (no las puedo hacer yo, no hay herramienta para esto):
  1. Exponer el schema `ayunka`: Project Settings → Data API → "Exposed schemas" → agregarlo.
  2. Crear el usuario de Supabase Auth (Authentication → Users → Add user) con el correo y
     clave que se van a usar en Ajustes.
  3. Sacar la `service_role` key (Project Settings → API) para `agente/config.json`.
- [ ] Una vez hecho lo anterior, probar de punta a punta: conectar desde Ajustes, crear un
  cliente/producto/pedido real, y confirmar que llega a las tablas y que Realtime lo
  refleja en una segunda pestaña/dispositivo.
