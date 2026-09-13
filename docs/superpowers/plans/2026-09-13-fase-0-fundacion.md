# Fase 0 · Fundación — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Levantar, en el repo nuevo y vacío `ayunka-studio-2`, el modelo de datos, la
sincronización y el sistema visual -- la base sobre la que se construyen las Fases 1-7 de
`ROADMAP.md`.

**Architecture:** PWA vanilla JS, sin build ni framework. Un documento por ficha en
Firestore, ids estables con fecha, migraciones que corren siempre, la nube nunca gana en
silencio. Estos patrones ya se probaron hoy (12-sep) en el repo que se borró -- se
reconstruyen fieles a ese diseño, no se reinventan ni se copian a ciegas.

**Tech Stack:** HTML/CSS/JS vanilla. Firebase Firestore (SDK modular vía `import()`
dinámico, sin build). Sin dependencias nuevas.

**Spec:** `docs/superpowers/plans/ROADMAP.md` (Fase 0).

## Global Constraints

- Sin build, sin framework, sin dependencias nuevas.
- Español en comentarios y textos de cara al cliente, sin `**` ni `##`.
- Paleta "Acuarela Silvestre": crema `#ECE6DA`, carbón `#2F3A40`, coral `#CB5A52`, rosa
  `#E39B96`, pizarra `#5F7C8E`, terracota `#C27A4E`, niebla `#9FB6C4`, mostaza `#D2A14E`.
- Cada tarea termina con una verificación real corriendo la app en un navegador headless
  (Playwright contra `python -m http.server`), no solo revisando que el código no tenga
  errores de sintaxis.

---

### Task 1: Esqueleto — `index.html`, `js/version.js`, `js/config.js`, `sw.js`

**Files:**
- Create: `index.html`, `js/version.js`, `js/config.js`, `sw.js`, `manifest.webmanifest`

**Interfaces:**
- Produces: `window.AYUNKA_VERSION` (string), `window.AYUNKA_CFG` (objeto con `firebase`,
  `espacio`, `supabase` -- valores en blanco por ahora, se llenan en la Fase 0 más
  adelante cuando haya proyecto de Firebase).

- [ ] **Step 1: Crear `js/version.js`**

```js
window.AYUNKA_VERSION = '0.1.0';
```

- [ ] **Step 2: Crear `js/config.js`**

```js
/* Ayünka Studio · configuración pública. SOLO valores públicos -- el correo y la clave
   de acceso NUNCA van acá, viven solo en localStorage de cada equipo. */
window.AYUNKA_CFG = {
  firebase: { apiKey: '', authDomain: '', projectId: '', storageBucket: '', messagingSenderId: '', appId: '' },
  espacio: 'ayunka',
  supabase: { url: '', clave: '', bucket: 'archivos' }
};
```

- [ ] **Step 3: Crear `index.html`** con el esqueleto de navegación (barra lateral vacía por
ahora, se llena en la Fase 1) y los `<script>` en orden de dependencia:

```html
<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ayünka Studio</title>
<link rel="manifest" href="manifest.webmanifest">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;650;700&family=Sacramento&display=swap">
<link rel="stylesheet" href="css/app.css">
</head>
<body>
<div id="app" class="app">
  <div class="lateral">
    <div class="marca"><span class="marca-nombre">Ayünka</span><small>STUDIO</small></div>
    <nav id="nav"></nav>
    <div class="pie-lateral" id="pie-lateral"></div>
  </div>
  <div class="principal"><div id="contenido"></div></div>
</div>
<script src="js/version.js"></script>
<script src="js/config.js"></script>
<script src="js/ui.js"></script>
<script src="js/db.js"></script>
<script src="js/nube.js"></script>
<script src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 4: Crear `sw.js` mínimo** (red primero para JS/CSS, sin cachear nada todavía --
se suma la lista de assets en Fase 1 cuando haya algo que cachear):

```js
const CACHE = 'ayunka-studio-v' + '1';
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => self.clients.claim());
self.addEventListener('fetch', e => {}); // red primero por defecto: no interceptar
```

- [ ] **Step 5: Crear `manifest.webmanifest` mínimo**

```json
{ "name": "Ayünka Studio", "short_name": "Ayünka", "start_url": "./", "display": "standalone", "background_color": "#F7F4EE", "theme_color": "#CB5A52" }
```

- [ ] **Step 6: Verificar que sirve sin errores** (aunque `js/ui.js`, `js/db.js`, `js/nube.js`,
`js/app.js` todavía no existan -- Playwright debe reportar 4 errores 404 de scripts, no
errores de sintaxis):

```bash
cd /c/Users/farid/Git/ayunka-studio-2 && python -m http.server 8790 &
```

```python
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(); page = b.new_page()
    page.goto('http://localhost:8790/', wait_until='networkidle', timeout=10000)
    print(page.title())
    b.close()
```

Esperado: el título imprime "Ayünka Studio" (el `<title>` se lee aunque los scripts fallen).

- [ ] **Step 7: Commit**

```bash
cd /c/Users/farid/Git/ayunka-studio-2
git add index.html js/version.js js/config.js sw.js manifest.webmanifest
git commit -m "feat: esqueleto de la app -- index.html, config publico, version, service worker minimo"
```

---

### Task 2: `js/ui.js` — piezas de interfaz reusables

**Files:**
- Create: `js/ui.js`

**Interfaces:**
- Produces: `window.A = { esc, $, $$, plata, num, fecha, aviso, preguntar, campo, selector }`.

- [ ] **Step 1: Escribir `js/ui.js`** (reconstruido fiel al patrón probado hoy: escape HTML,
formateo de plata en CLP, fecha en español, un toast que se llama `toast` no `aviso` --
la lección de hoy es que dos cosas con el mismo nombre y CSS distinto se pisan, así que
el nombre de la clase CSS y el de la función quedan DISTINTOS a propósito):

```js
/* Ayünka Studio · piezas sueltas de interfaz. Nada de lógica de negocio acá.

   OJO -- lección del 12-sep: la clase CSS del toast flotante se llama .toast, NUNCA
   .aviso, aunque la función de abajo se llame aviso(). Si algún día una tarjeta de
   advertencia en línea también se llama "aviso" en CSS, van a chocar y una de las dos
   queda invisible sin ningún error. Ya pasó una vez. */
(function () {
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  const plata = n => (n === null || n === undefined || !isFinite(n))
    ? '—' : '$' + Math.round(n).toLocaleString('es-CL');

  const num = v => {
    const n = parseFloat(String(v).replace(',', '.').replace(/[^\d.\-]/g, ''));
    return isFinite(n) ? n : 0;
  };

  const fecha = f => {
    if (!f) return '—';
    const d = new Date(f.length === 10 ? f + 'T12:00:00' : f);
    return isNaN(d) ? f : d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  let avisoTimer;
  function aviso(msg, tipo) {
    let e = $('#toast');
    if (!e) { e = document.createElement('div'); e.id = 'toast'; document.body.appendChild(e); }
    e.className = 'toast visible ' + (tipo || '');
    e.textContent = msg;
    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(() => e.classList.remove('visible'), 4200);
  }

  function preguntar({ titulo, cuerpo, botones, leer, alAbrir }) {
    return new Promise(resolve => {
      const fondo = document.createElement('div');
      fondo.className = 'modal-fondo';
      fondo.innerHTML = `<div class="modal" role="dialog" aria-modal="true">
        <h2>${esc(titulo)}</h2>
        <div class="modal-cuerpo">${cuerpo}</div>
        <div class="modal-botones"></div></div>`;
      const cont = fondo.querySelector('.modal-botones');
      let cerrado = false;
      const cerrar = valor => {
        if (cerrado) return;
        cerrado = true;
        let datos = null;
        try { if (leer) datos = leer(fondo); } catch (e) { console.error(e); }
        document.removeEventListener('keydown', alTecla);
        fondo.remove();
        resolve({ valor, datos });
      };
      (botones || [{ txt: 'Entendido', valor: true }]).forEach(b => {
        const el = document.createElement('button');
        el.className = 'btn ' + (b.clase || '');
        el.textContent = b.txt;
        el.onclick = () => cerrar(b.valor);
        cont.appendChild(el);
      });
      const alTecla = e => { if (e.key === 'Escape') cerrar(null); };
      document.addEventListener('keydown', alTecla);
      fondo.addEventListener('click', e => { if (e.target === fondo) cerrar(null); });
      document.body.appendChild(fondo);
      if (alAbrir) { try { alAbrir(fondo); } catch (e) { console.error(e); } }
      const primero = fondo.querySelector('.modal-cuerpo input, .modal-cuerpo select') || cont.querySelector('button');
      primero && primero.focus();
    });
  }

  const campo = (id, etiqueta, valor, opts = {}) => `
    <label class="campo${opts.ancho ? ' ancho' : ''}${opts.signo ? ' con-signo' : ''}">
      <span>${esc(etiqueta)}${opts.nota ? `<i>${esc(opts.nota)}</i>` : ''}</span>
      <input id="${id}" type="${opts.tipo || 'text'}" value="${esc(valor == null ? '' : valor)}"
        ${opts.paso ? `step="${opts.paso}"` : ''} ${opts.ph ? `placeholder="${esc(opts.ph)}"` : ''}>
      ${opts.signo ? `<span class="signo">${esc(opts.signo)}</span>` : ''}
      ${opts.unidad ? `<span class="unidad">${esc(opts.unidad)}</span>` : ''}
    </label>`;

  const selector = (id, etiqueta, valor, opciones) => `
    <label class="campo"><span>${esc(etiqueta)}</span><select id="${id}">
      ${opciones.map(o => `<option value="${esc(o.v)}"${o.v === valor ? ' selected' : ''}>${esc(o.t)}</option>`).join('')}
    </select></label>`;

  window.A = window.A || {};
  Object.assign(window.A, { esc, $, $$, plata, num, fecha, aviso, preguntar, campo, selector });
})();
```

- [ ] **Step 2: Verificar en consola del navegador**

```python
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(); page = b.new_page()
    errs = []
    page.on('pageerror', lambda e: errs.append(str(e)))
    page.goto('http://localhost:8790/', wait_until='networkidle', timeout=10000)
    r = page.evaluate("""() => ({
        plata: A.plata(12345), fecha: A.fecha('2026-09-13'), esc: A.esc('<b>x</b>')
    })""")
    print('errores:', errs)
    print(r)
    b.close()
```

Esperado: `errores: []` (los 404 de db.js/nube.js/app.js siguen, pero esos no son
`pageerror`, son fallos de red normales), `plata` da `'$12.345'`, `fecha` da
`'13 sept 2026'`, `esc` da `'&lt;b&gt;x&lt;/b&gt;'`.

- [ ] **Step 3: Commit**

```bash
cd /c/Users/farid/Git/ayunka-studio-2
git add js/ui.js
git commit -m "feat: js/ui.js -- escape, formato de plata/fecha, toast, modal generico, campos de formulario"
```

---

### Task 3: `js/db.js` — modelo de datos y migraciones

**Files:**
- Create: `js/db.js`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `window.DB` (objeto mutable), `window.Datos = { CLAVE, ESQUEMA, COLECCIONES,
  nuevoId, vacia, migrar, leerDisco, guardar, cargarSemilla, reemplazar,
  descargarRespaldo, obtener, agregar, quitar, activos, resumen }`. Estos nombres los usan
  TODAS las vistas de la Fase 1 -- no cambiarlos sin actualizar el ROADMAP.

- [ ] **Step 1: Escribir `js/db.js`**

```js
/* Ayünka Studio · el estado del negocio y cómo se guarda.
 *
 * Reglas de esta capa:
 *  1. Una colección = una lista de fichas con `id` estable. El `id` NUNCA se reusa ni se
 *     renumera -- llevan fecha delante para que además queden ordenables.
 *  2. Nada se borra de verdad: se marca `activo:false`.
 *  3. `_v` es la versión del esquema. Las migraciones corren SIEMPRE que entren datos,
 *     vengan del disco o de la nube -- nunca solo al abrir la página.
 */
(function () {
  const CLAVE = 'ayunka-db';
  const ESQUEMA = 1;

  const COLECCIONES = ['productos', 'filamentos', 'clientes', 'pedidos', 'ventas',
                       'gastos', 'bandejas', 'cotizaciones', 'disenos3d', 'movimientos'];

  function nuevoId(prefijo) {
    const d = new Date(), z = n => String(n).padStart(2, '0');
    const sello = `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}`;
    const azar = Math.random().toString(36).slice(2, 6);
    return (prefijo ? prefijo + '-' : '') + sello + '-' + azar;
  }

  function vacia() {
    const d = { _v: ESQUEMA, _actualizado: 0, _semilla: true, params: {} };
    COLECCIONES.forEach(c => d[c] = []);
    return d;
  }

  const MIGRACIONES = {
    1: db => {
      COLECCIONES.forEach(c => { if (!Array.isArray(db[c])) db[c] = []; });
      if (!db.params || typeof db.params !== 'object') db.params = {};
    }
  };

  function migrar(db) {
    if (!db || typeof db !== 'object') return vacia();
    let desde = db._v || 0;
    for (let v = desde + 1; v <= ESQUEMA; v++) {
      try { MIGRACIONES[v] && MIGRACIONES[v](db); }
      catch (e) { console.error('Migración a v' + v + ' falló', e); }
    }
    db._v = ESQUEMA;
    COLECCIONES.forEach(c => { if (!Array.isArray(db[c])) db[c] = []; });
    if (!db.params) db.params = {};
    return db;
  }

  function leerDisco() {
    try {
      const crudo = localStorage.getItem(CLAVE);
      if (!crudo) return null;
      return migrar(JSON.parse(crudo));
    } catch (e) {
      console.error('No se pudo leer la base local', e);
      return null;
    }
  }

  function guardar(motivo) {
    DB._actualizado = Date.now();
    DB._semilla = false;
    try {
      localStorage.setItem(CLAVE, JSON.stringify(DB));
    } catch (e) {
      A.aviso('No se pudo guardar: el navegador está sin espacio.', 'error');
      return false;
    }
    if (window.Nube && Nube.guardarPronto) Nube.guardarPronto(motivo);
    document.dispatchEvent(new CustomEvent('db:cambio', { detail: { motivo } }));
    return true;
  }

  function descargarRespaldo(sufijo) {
    try {
      const txt = JSON.stringify(DB, null, 1);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' }));
      const d = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
      a.download = `ayunka-respaldo-${d}${sufijo ? '-' + sufijo : ''}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      return true;
    } catch (e) { console.error(e); return false; }
  }

  async function cargarSemilla() {
    const r = await fetch('./datos/semilla.json', { cache: 'no-store' });
    const s = await r.json();
    const db = vacia();
    db.params = s.params || {};
    COLECCIONES.forEach(c => { if (Array.isArray(s[c])) db[c] = s[c]; });
    db._semilla = true;
    db._actualizado = 0;
    return migrar(db);
  }

  function reemplazar(nueva, motivo) {
    const m = migrar(nueva);
    Object.keys(DB).forEach(k => delete DB[k]);
    Object.assign(DB, m);
    try { localStorage.setItem(CLAVE, JSON.stringify(DB)); } catch (e) {}
    document.dispatchEvent(new CustomEvent('db:cambio', { detail: { motivo, recarga: true } }));
  }

  function obtener(col, id) { return (DB[col] || []).find(x => x.id === id) || null; }
  function agregar(col, ficha) {
    if (!ficha.id) ficha.id = nuevoId(col.slice(0, 3));
    DB[col].push(ficha);
    return ficha;
  }
  function quitar(col, id) {
    const f = obtener(col, id);
    if (f) f.activo = false;
    return f;
  }
  function activos(col) { return (DB[col] || []).filter(x => x.activo !== false); }

  const DB = vacia();
  window.DB = DB;
  window.Datos = {
    CLAVE, ESQUEMA, COLECCIONES,
    nuevoId, vacia, migrar, leerDisco, guardar, cargarSemilla, reemplazar,
    descargarRespaldo, obtener, agregar, quitar, activos,
    resumen: db => {
      const o = {};
      COLECCIONES.forEach(c => o[c] = (db[c] || []).length);
      return o;
    }
  };
})();
```

- [ ] **Step 2: Verificar con datos falsos, sin ningún archivo `semilla.json` todavía**

```python
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(); page = b.new_page()
    errs = []
    page.on('pageerror', lambda e: errs.append(str(e)))
    page.goto('http://localhost:8790/', wait_until='networkidle', timeout=10000)
    r = page.evaluate("""() => {
        const p1 = Datos.agregar('productos', { nombre: 'Llavero de prueba', activo: true });
        Datos.guardar('prueba');
        const leido = JSON.parse(localStorage.getItem(Datos.CLAVE));
        const p2 = Datos.obtener('productos', p1.id);
        Datos.quitar('productos', p1.id);
        return { idGenerado: p1.id, quedoEnLocalStorage: !!leido, productoEncontrado: !!p2, activosTrasQuitar: Datos.activos('productos').length };
    }""")
    print('errores:', errs)
    print(r)
    b.close()
```

Esperado: `errores: []`, `idGenerado` empieza con `pro-` y trae fecha, `quedoEnLocalStorage:
True`, `productoEncontrado: True`, `activosTrasQuitar: 0` (quitar marca inactivo, no
borra -- pero `Datos.activos` ya no lo cuenta).

- [ ] **Step 3: Commit**

```bash
cd /c/Users/farid/Git/ayunka-studio-2
git add js/db.js
git commit -m "feat: js/db.js -- modelo de datos, migraciones, guardado local"
```

---

### Task 4: `css/app.css` — sistema visual

**Files:**
- Create: `css/app.css`

- [ ] **Step 1: Escribir `css/app.css`** con los tokens y componentes base: variables de
paleta (`--crema`, `--carbon`, `--coral`, `--rosa`, `--pizarra`, `--terra`, `--niebla`,
`--mostaza`, más las de superficie/texto/dato), `.app`/`.lateral`/`.principal`,
`.tarjeta`/`.tarjeta.aviso` (con `border-color` y `background`, NUNCA `opacity`/`position`
-- esas van solo en `.toast`), `.btn`/`.btn.primario`/`.btn.sutil`/`.btn.chico`, tablas
sin cebra, `.etiqueta`/`.chip`, `.rejilla`/`.dato`, `.campo`/`.formulario`,
`.desglose` con `.punto` de color fijo por concepto, `.toast` (flotante, con
`opacity`/`position:fixed`, nombre DISTINTO de `.tarjeta.aviso` a propósito),
`.modal-fondo`/`.modal`. Reconstruir fiel al sistema probado hoy (12-sep): radios `--r-caja:
12px`, `--r-campo: 8px`, `--r-pill: 6px`; tipografía `--texto-fuente: 'Outfit',
'Segoe UI', system-ui, sans-serif`; números con `font-variant-numeric: tabular-nums`; casi
cero sombras (solo el modal); mayúsculas solo en etiquetas chicas, nunca en texto que se lee.

(El archivo completo tiene ~500 líneas -- quien ejecute esta tarea escribe cada bloque de
componente y lo prueba visualmente antes de seguir al siguiente, no todo de una vez a
ciegas. Empezar por tokens + estructura + tarjeta + botón, verificar que se ve bien,
seguir con tabla + campo + formulario, verificar, terminar con toast + modal + desglose.)

- [ ] **Step 2: Verificar visualmente** -- levantar el server, cargar `http://localhost:8790/`,
sacar una captura de pantalla con Playwright (`page.screenshot(path=...)`) y mirarla:
confirmar que la barra lateral tiene el crema/blanco correcto, la tipografía Outfit carga
(no cae a system-ui por un typo en el nombre de la fuente), y no hay elementos rotos.

- [ ] **Step 3: Commit**

```bash
cd /c/Users/farid/Git/ayunka-studio-2
git add css/app.css
git commit -m "feat: css/app.css -- sistema visual Acuarela Silvestre"
```

---

### Task 5: `js/app.js` — arranque y navegación

**Files:**
- Create: `js/app.js`

**Interfaces:**
- Consumes: `Datos.leerDisco`, `Datos.cargarSemilla`, `Datos.migrar`, `window.Vistas` (se
  llena en la Fase 1 -- por ahora un objeto vacío está bien, la navegación no revienta
  aunque no haya vistas todavía).
- Produces: nada que otras tareas consuman -- es la capa más externa.

- [ ] **Step 1: Escribir `js/app.js`** con: arranque (`leerDisco()` o `cargarSemilla()` si no
hay nada local, aplicar migraciones), render de la barra de navegación (lee un array
`NAV` con `{id, label}` -- vacío por ahora, se llena en Fase 1), ruteo por `location.hash`,
llamada a `Nube.conectar` si hay configuración guardada. NO hace falta que haya vistas
reales todavía -- solo que la estructura de navegación no truene con `NAV` vacío.

```js
/* Ayünka Studio · arranque y navegación. */
(function () {
  const NAV = []; // se llena en la Fase 1, una entrada por vista: {id, label}

  async function arrancar() {
    let db = Datos.leerDisco();
    if (!db) {
      try { db = await Datos.cargarSemilla(); }
      catch (e) { db = Datos.vacia(); }
    }
    Datos.reemplazar(db, 'arranque');
    renderNav();
    window.addEventListener('hashchange', render);
    render();
    if (window.Nube && Nube.configurado()) {
      Nube.conectar(plan => new Promise(resolve => {
        // conflicto: por ahora se resuelve por consola hasta que la Fase 1 tenga UI
        console.warn('Conflicto de sincronización, sin UI todavía:', plan);
        resolve(null);
      }));
    }
  }

  function renderNav() {
    const nav = document.getElementById('nav');
    if (!nav) return;
    nav.innerHTML = NAV.map(v => `<button class="nav" data-id="${v.id}" onclick="location.hash='#/${v.id}'">${A.esc(v.label)}</button>`).join('');
  }

  function render() {
    const id = (location.hash.replace('#/', '') || (NAV[0] || {}).id || '');
    document.querySelectorAll('.nav').forEach(b => b.classList.toggle('activo', b.dataset.id === id));
    const vista = window.Vistas && window.Vistas[id];
    const cont = document.getElementById('contenido');
    if (!cont) return;
    if (vista && vista.pintar) vista.pintar();
    else cont.innerHTML = '<div class="tarjeta"><div class="vacio"><b>Todavía no hay vistas</b>Se agregan en la Fase 1.</div></div>';
  }

  window.App = { NAV, arrancar, render };
  document.addEventListener('DOMContentLoaded', arrancar);
})();
```

- [ ] **Step 2: Verificar que arranca sin datos previos (primera vez) y sin semilla.json
(todavía no existe -- debe caer a `Datos.vacia()` sin reventar)**

```python
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(); page = b.new_page()
    errs = []
    page.on('pageerror', lambda e: errs.append(str(e)))
    page.goto('http://localhost:8790/', wait_until='networkidle', timeout=10000)
    page.wait_for_timeout(500)
    r = page.evaluate("() => ({ tieneDB: !!window.DB, colecciones: Datos.resumen(DB) })")
    print('errores:', errs)
    print(r)
    b.close()
```

Esperado: `errores: []`, `tieneDB: True`, `colecciones` con todas las colecciones en 0.

- [ ] **Step 3: Commit**

```bash
cd /c/Users/farid/Git/ayunka-studio-2
git add js/app.js
git commit -m "feat: js/app.js -- arranque, migra o carga semilla, navegacion vacia lista para la Fase 1"
```

---

### Task 6: `js/nube.js` — sincronización con Firestore

**Files:**
- Create: `js/nube.js`

**Interfaces:**
- Produces: `window.Nube = { cfg, configurado, encendida, guardarCfg, apagar, conectar,
  guardarPronto, estado, correo, visto, forzarSubida }`.

- [ ] **Step 1: Escribir `js/nube.js`**, reconstruido fiel a las 4 reglas probadas hoy: la
nube nunca gana en silencio (conflicto se muestra, decide una persona), un equipo con
datos reales que se conecta por primera vez SUBE, respaldo a disco antes de la primera
sincronización, se sube apenas hay sesión sin esperar una edición. Un documento por
ficha en `negocios/{espacio}/{coleccion}/{id}`.

(Contenido idéntico en diseño al `js/nube.js` de hoy -- ~250 líneas, funciones: `cfg`,
`configurado`, `guardarCfg`, `apagar`, `bajarTodo`, `subirTodo`, `subirCambios`,
`guardarPronto`, `hayDatosReales`, `planear`, `aplicarRemoto`, `conectar`,
`leerImpresoraViva`, `forzarSubida`. Quien ejecute esta tarea la escribe completa
siguiendo ese mismo diseño -- no hay ambigüedad de producto acá, ya está resuelto.)

- [ ] **Step 2: Verificar SIN conectar de verdad a Firestore** (no hay proyecto todavía --
`AYUNKA_CFG.firebase` está vacío): confirmar que `Nube.configurado()` da `false` con la
config vacía, y que `Datos.guardar()` no revienta aunque `Nube.guardarPronto` exista y se
llame (debe no hacer nada porque `st.lista` es `false`).

```python
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(); page = b.new_page()
    errs = []
    page.on('pageerror', lambda e: errs.append(str(e)))
    page.goto('http://localhost:8790/', wait_until='networkidle', timeout=10000)
    r = page.evaluate("""() => {
        const antes = Nube.configurado();
        Datos.agregar('clientes', { nombre: 'Cliente de prueba', activo: true });
        Datos.guardar('prueba nube'); // no debe reventar aunque Nube exista
        return { configuradaSinClave: antes, encendida: Nube.encendida() };
    }""")
    print('errores:', errs)
    print(r)
    b.close()
```

Esperado: `errores: []`, `configuradaSinClave: False`, `encendida: False`.

- [ ] **Step 3: Commit**

```bash
cd /c/Users/farid/Git/ayunka-studio-2
git add js/nube.js
git commit -m "feat: js/nube.js -- sincronizacion Firestore, documento por ficha, la nube nunca gana en silencio"
```

---

### Task 7: cierre de la Fase 0

- [ ] **Step 1:** correr Task 1-6 Steps de verificación una vez más seguidos, de punta a
punta, contra el server recién levantado -- confirmar que no hay errores acumulados de
integración entre archivos.
- [ ] **Step 2:** parar el servidor de prueba (`kill` el proceso de `python -m http.server`).
- [ ] **Step 3:** push a un remoto cuando Farid decida dónde publicar este repo (ver la nota
en `ROADMAP.md`, "Qué NO se reescribe") -- mientras tanto, los commits quedan locales.
- [ ] **Step 4:** avisar que la Fase 0 está lista y pasar a escribir el plan detallado de la
Fase 1 (las 9 vistas núcleo), siguiendo el mismo patrón de esta skill.
