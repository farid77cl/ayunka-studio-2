# Plantillas simples · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un catálogo de plantillas de llavero (la primera: mochila NFC v3) con una pantalla
simple — variante → parámetros → 3D en vivo → Descargar 3MF — armada desde el JSON de la plantilla.

**Architecture:** Python exporta la parte fija (geometría 2D por pieza + armazón del 3MF +
perfil por variante) a `plantillas/<id>.json`. En el navegador, `plantillamotor.js` calcula lo
variable (texto ajustado a una zona, QR) con Clipper y opentype; `plantilla3mf.js` extruye y
escribe el 3MF con el armazón. La vista se arma desde `parametros`.

**Tech Stack:** JS vanilla, three.js r128 (cdnjs), opentype.js 1.3.4 (cdnjs), clipper-lib 6.4.2
y qrcode-generator 1.4.4 (jsdelivr), `node --test` para las pruebas (Node ≥ 18, sin npm install:
el test baja las mismas libs de la CDN a `tests/.cache/`). Python 3.12 + shapely en `negocio/`.

**Spec:** `docs/superpowers/specs/2026-09-24-plantillas-simples-design.md`

## Global Constraints

- Código 100 % propio. Nada copiado de sitios de terceros.
- Scripts externos solo de cdnjs.cloudflare.com o cdn.jsdelivr.net/npm/ con versión fija.
- El `negative_part` va último con el id más alto; pausa `top_z` = 2.6 para la mochila.
- Trazo mínimo 0,64 mm; rendija mínima entre letras 0,7 mm; QR módulo ≥ 1,1 mm, zona blanca 2 módulos, EC ≥ M.
- Teléfono: `+569` y 8 dígitos (se aceptan espacios, guiones, paréntesis y puntos).
- En `negocio` solo se toca `stl/mochila-nfc/generar_mochila.py` y su README, sin commit; su CLI y su compuerta no cambian.
- Commits en español, estilo `feat: …`/`test: …`, terminados en `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`. Sin push.

---

### Task 1: Exportar la plantilla desde Python

**Files:**
- Modify: `negocio/stl/mochila-nfc/generar_mochila.py` (extraer `_cara_fija()` de `cara()`, sumar `exportar_plantilla()` y el flag `--exportar-plantilla RUTA`)
- Modify: `negocio/stl/mochila-nfc/README.md` (una sección)
- Create: `plantillas/mochila-nfc-v3.json`, `plantillas/catalogo.json`, `fuentes/Fredoka-Bold.ttf`, `fuentes/Fredoka-Bold-Condensed.ttf`, `fuentes/OFL.txt`

**Interfaces:**
- Produces: el JSON `plantilla/1` del spec. Piezas en orden: `cuerpo`, `acento`, `rev_claro` (soloSi telefono), `rev_oscuro` (figsSi telefono), `contorno`, `nombre` (figs vacías), `chip` (negative_part).

- [ ] **Step 1: Regresión antes de tocar** — `python generar_mochila.py --nombre MATEO --version nino --salida <scratch>/antes.3mf --sin-png`; guardar un hash de los vértices de `object_1.model`.
- [ ] **Step 2: Extraer `_cara_fija(cuerpo)`** (acento, detalles+textos, zona del nombre) sin cambiar números; `cara()` la llama.
- [ ] **Step 3: Regresión después** — mismo comando a `despues.3mf`; el hash de vértices debe ser idéntico. Si no, deshacer.
- [ ] **Step 4: `exportar_plantilla(destino)`** — genera MATEO/niño a un temporal con `generar()` (así la compuerta 5 corre), toma de ahí el armazón (entradas del zip, cabecera de `object_1.model`, `3dmodel.model` con `{{COMPONENTES}}`/`{{TITULO}}`), el perfil de cada variante con `_settings()`, y la geometría fija ya `prep`-eada (simplify 0,012 ∩ cuerpo) trasladada a las coordenadas finales. Para el reverso con QR: `reverso()` con `tel:+56900000000` → placa blanca, texto reubicado, centro/módulo del QR (assert v2-Q, 25 módulos).
- [ ] **Step 5:** `python generar_mochila.py --exportar-plantilla ../../../ayunka-studio-2/plantillas/mochila-nfc-v3.json` y revisar tamaños/claves.
- [ ] **Step 6: Commit** (solo ayunka-studio-2): `feat(plantillas): catálogo con la mochila NFC v3 exportada desde Python`.

### Task 2: Motor — texto ajustado a una zona

**Files:**
- Create: `js/plantillamotor.js`, `tests/cargar.js` (carga libs de CDN a `tests/.cache/` y los scripts de la app en un `vm`), `tests/plantillas.test.js`
- Modify: `.gitignore` (`tests/.cache/`)

**Interfaces:**
- Produces: `window.Plantillas = { componer(plantilla, varianteId, valores, opts) → Promise<{ piezas: [{ id, nombre, subtipo, rol, color, extrusor, z:[z0,z1], espejoX, figs }], avisos: [], info: { nombre: { cap, fuente } } }>, normalizarTelefono(s) → string|null, geo: { union, offset, diferencia, interseccion, area, perdidaFina } }`. `opts.cargarBytes(url) → Promise<ArrayBuffer>` (por defecto `fetch`). Error de usuario: `throw Object.assign(new Error(msg), { usuario: true })`.

- [ ] **Step 1: Test que falla** — `componer(mochila, 'nino', { nombre: 'MATEO' })`: la pieza `nombre` tiene figuras; `info.nombre.cap` entre 8 y 11; nombre+0,8 dentro de la zona; `nombre ∩ contorno` = 0 mm²; `perdidaFina` ≤ 8 % en cada pieza.
- [ ] **Step 2:** correr `node --test "tests/*.test.js"` → FAIL (`Plantillas` no existe).
- [ ] **Step 3: Implementar** texto → anillos (opentype, curvas aplanadas) → unión Clipper (NonZero) → tracking/rendija ≥ 0,7 → tildes subidas → engrosado de piezas finas → bucle de `cap` con la regla normal/condensada → ojos de letra → borde (sticker) a la pieza `borde.pieza`.
- [ ] **Step 4:** tests PASS. Sumar casos: `MAXIMILIANO` cabe (condensada, cap < 5); `MAXIMILIANO JOSÉ` lanza error de usuario «no cabe»; `SOFÍA` → la tilde queda a ≥ 0,7 de la I.
- [ ] **Step 5: Commit** `feat(plantillas): motor que ajusta el nombre a la zona con trazo mínimo`.

### Task 3: Motor — teléfono QR, interruptor y color

**Files:** Modify `js/plantillamotor.js`, `tests/plantillas.test.js`

- [ ] **Step 1: Tests que fallan** — `normalizarTelefono('+56 9 1234-5678') === '+56912345678'`; `'+5621234567'` → null; con teléfono aparece `rev_claro`, y `rev_oscuro` usa `figsSi.telefono` + módulos: 25×25 módulos de 1,3 mm, lado 37,7 con zona blanca, dentro de `rev_claro`; sin teléfono no hay `rev_claro`. Plantilla de juguete (en el test) con `interruptor` y `color`: el interruptor apaga una pieza `soloSi`, el color cambia `color` de un rol.
- [ ] **Step 2:** FAIL. **Step 3:** implementar (qrcode-generator `qrcode(2,'Q')`, módulos unidos con Clipper, rombos de soldadura en diagonales). **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(plantillas): QR del teléfono en el reverso y parámetros on/off y color`.

### Task 4: 3MF con el armazón de la plantilla

**Files:** Create `js/plantilla3mf.js`; Modify `tests/plantillas.test.js`

**Interfaces:**
- Consumes: `componer()`; `D3DBuild.geometriaDe({ figs, z0, alt })`; `D3D3MF.mallaDe(geos)`, `D3D3MF.zip(archivos)`.
- Produces: `window.Plantilla3MF = { exportar(plantilla, varianteId, compuesto, titulo) → { datos: Uint8Array, nombreArchivo, partes: [{ id, nombre, subtipo, extrusor, volumen, esperado }] }, verificar(datos) → { ok, problemas } }`.

- [ ] **Step 1: Test que falla** — MATEO/niño contra `Mochila NFC 65 - nino MATEO v3.3mf` (ruta por `MOCHILA_V3`, por defecto `../negocio/stl/mochila-nfc/`): mismos nombres/subtipos/extrusores de `model_settings.config`; negativo último con id máximo; bolsillo X,Y ±13,5 y Z 2,0–2,4; `custom_gcode_per_layer.xml` con `top_z="2.6"` y `PAUSE`; `project_settings.config` idéntico (JSON profundo); `|volumen − área×alto| / esperado < 1e-3` en cada parte; con QR, 7 partes y negativo id 7.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. Reportar volúmenes contra el v3.
- [ ] **Step 5: Commit** `feat(plantillas): 3MF con perfil, pausa y part ids del armazón`.

### Task 5: Pantalla

**Files:** Create `js/vistas/plantillas.js`; Modify `index.html` (3 scripts + 2 libs CDN), `js/app.js` (entrada «Plantillas»), `css/app.css` (visor)

- [ ] **Step 1:** catálogo (`plantillas/catalogo.json`) → con una sola plantilla abre directo; botones por variante; inputs desde `parametros`; visor three.js con giro por arrastre; recalcula con 250 ms de pausa al escribir; errores de usuario en línea, no en toast; botón Descargar 3MF (deshabilitado si hay error) que corre `Plantilla3MF.verificar` antes de bajar.
- [ ] **Step 2: Verificar en navegador** (Playwright vía npx, servidor estático): niño/MATEO, MAXIMILIANO, SOFÍA, QR con `+56 9 1234 5678`, teléfono inválido, descarga; capturas al scratchpad; el 3MF bajado pasa el mismo verificador de Node.
- [ ] **Step 3: Commit** `feat(plantillas): pantalla simple armada desde el catálogo`.

### Task 6: Cierre

- [ ] README de plantillas (cómo agregar una) en `plantillas/README.md`; bitácora en `sesion-log.md`; ROADMAP una línea.
- [ ] `superpowers:verification-before-completion`: correr `node --test "tests/*.test.js"` completo y releer la salida antes de informar.
- [ ] Commit `docs: plantillas simples — cómo agregar una plantilla y bitácora`.
