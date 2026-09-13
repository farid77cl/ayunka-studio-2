# Fase 2 · Generador 3D — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** El generador 3D con las capacidades ya probadas hoy: bolsillo NFC con pausa y
verificación automática, bandejas con varias copias, verificador de G-code (compuerta 7).

**Decisión de alcance, explícita:** la v1 tiene 39 figuras y 14 tipografías (`d3d-formas.js`,
544 líneas; `d3d-fuentes.js`). Reconstruir esa librería completa de geometría paramétrica
de memoria es un trabajo aparte y grande, y no tengo el código fuente exacto a mano para
portarlo fiel (a diferencia de Perfiles/PDF/WhatsApp, que sí existen intactos en
`negocio/ayunka-studio/`, en este caso solo tengo el diseño, no el código). Para no
inventar geometría a ciegas y arriesgar bugs silenciosos, esta fase entrega el generador
con **una forma base (rectángulo redondeado) y texto** -- suficiente para el llavero
publicitario, que es el producto que hoy se vende -- y dejo el resto de la librería de
figuras como trabajo futuro explícito, no a medias.

**Spec:** `ROADMAP.md` (Fase 2).

---

### Task 1: `js/d3dformas.js` — geometría 2D mínima

**Produces:** `window.G = { rectRedondeado(w,h,r), texto(str, opts), elipse(rx,ry,seg,x,y),
anidar(anillos), bboxDe(figs) }`. `texto()` usa Canvas2D (`context.measureText` +
trazo de fuente del sistema rasterizado a contorno -- alternativa simple sin opentype.js:
dibujar el texto en un canvas oculto, leer el path con `Path2D` no es portable; en su
lugar, cada letra se aproxima con rectángulos de un `<canvas>` muestreado a resolución
fina y trazado por marching squares simplificado -- **o**, más simple y confiable para
esta fase, usar el propio contorno de fuente sub-pixel vía `SVGTextElement.getBBox` +
`getPathData` si el navegador lo soporta, con fallback a un rectángulo con el texto
grabado como relieve plano de un solo nivel. Quien ejecute esta tarea prueba ambas y se
queda con la que dé un contorno real en Chromium (Playwright usa Chromium).

- [ ] **Step 1:** Escribir `rectRedondeado`, `elipse`, `anidar`, `bboxDe` (geometría 2D pura,
arrays de puntos `[x,y]`, sin dependencias).
- [ ] **Step 2:** Resolver `texto()` -- probar en el navegador real cuál método da un
contorno navegable por `ExtrudeGeometry` de three.js sin huecos ni auto-intersecciones.
- [ ] **Step 3: Verificar** con un texto corto ("AYÜNKA") que el contorno tenga área > 0 y
no lance excepción al extruir.
- [ ] **Step 4: Commit**

---

### Task 2: `js/d3dbuild.js` — compilar a sólidos + bolsillo NFC

**Produces:** `window.D3DBuild = { proyectoVacio, compilar(proyecto), geometriaDe(solido),
aThree(compilado) }`. Reconstruye EXACTO el diseño ya verificado hoy:
- `proyecto.nfc = { activa, d:27, x:0, y:0, z0:0.8, alt:0.4 }` -- círculo de 27mm, no
  cuadrado (verificado contra un 3MF real el 12-sep).
- `compilar()` agrega un sólido `{ negativo:true, color:0, z0, alt, figs:[circulo] }`
  cuando `nfc.activa`, con el aviso de "capa múltiplo de 0,20" si `alt` no lo es.
- `proyecto.bed = { x:260, y:260, z:260 }` (medida real de la K2, no 350).

- [ ] **Step 1-4:** igual estructura que la sesión anterior (ver los commits de
`js/d3d-build.js` de hoy temprano, antes de borrar la carpeta, como referencia de diseño
-- el archivo en sí ya no existe, se reescribe desde este plan).
- [ ] **Step 5: Verificar** -- generar un llavero con bolsillo NFC activo, confirmar que
`compilado.solidos` trae exactamente un sólido con `negativo:true`, `z0:0.8`, `alt:0.4`.
- [ ] **Step 6: Commit**

---

### Task 3: `js/d3d3mf.js` — exportar 3MF con negative_part, pausa y bandejas

**Produces:** `window.D3D3MF = { exportar3MF(compilado, nombre, opts), posicionesBandeja,
verificarNFC, unzip }`. Mismo diseño ya verificado hoy contra G-code real:
- Un documento por color/parte, `subtype="negative_part"` para el bolsillo.
- `Metadata/custom_gcode_per_layer.xml` con `top_z = techoBolsillo + 0.2`, formato
  `;PAUSE_PRINT` / `PAUSE` (verificado contra `stl/RUDY Automotriz 19 - una placa...gcode`).
- `posicionesBandeja(ancho, largo, opts)` -- grilla conservadora, excluye la esquina de la
  torre de purga (X 18-78, Y 220-260 por defecto).
- `verificarNFC` relee el zip escrito y confirma negative_part + pausa.

- [ ] **Step 1-5:** reconstruir igual al diseño de hoy (ver el resumen técnico de esta
misma conversación: "27mm círculo no cuadrado", "punto medio no punto de llegada",
"radio de búsqueda ~10mm no el tamaño de la pieza").
- [ ] **Step 6: Verificar** contra el mismo par de G-code reales de hoy:
`RUDY Automotriz 19 - una placa_PLA_53m39s.gcode` (debe dar `ok:true`) y
`LIDCAR redondo 15 v4 - SIN BOLSILLO...gcode` (debe dar `ok:false`).
- [ ] **Step 7: Commit**

---

### Task 4: `js/verificadorgcode.js` — compuerta 7

**Produces:** `window.VerificadorGcode = { verificar(texto, opts) }`. Reconstrucción
exacta del módulo de hoy (ya quedó en el ROADMAP con el detalle de formato:
`;LAYER_CHANGE` + `;:<Z>`, centro autodetectado desde `EXCLUDE_OBJECT_START/END` en la
capa del piso del bolsillo).

- [ ] **Step 1-2:** escribir y verificar contra los mismos dos G-code reales.
- [ ] **Step 3: Commit**

---

### Task 5: Vista Personalizados 3D

**Files:** `js/vistas/disenos3d.js`.

- [ ] **Step 1:** Un preset ("Llavero publicitario": rectángulo redondeado + 1-2 líneas de
texto + argolla + bolsillo NFC opcional).
- [ ] **Step 2:** Formulario de texto, campo de copias en bandeja, botones Generar/
Descargar 3MF/Descargar STL, sección de subir G-code para verificar.
- [ ] **Step 3: Verificar** de punta a punta: generar, activar NFC, pedir 3 copias,
descargar, confirmar 3 `<item>` con posiciones únicas; subir el G-code real de RUDY y
confirmar "Pasa la compuerta 7".
- [ ] **Step 4: Commit**

---

### Fuera de esta fase, explícito

- Las 38 figuras restantes de `d3d-formas.js` y las 14 tipografías de `d3d-fuentes.js`
  de la v1 -- se agregan preset por preset cuando haga falta, no todas de una vez.
- Vectorizar una imagen subida (existía en la v1 y en la v2 borrada) -- función aparte,
  no bloquea el llavero publicitario.
- Caja de luz LED -- preset aparte.
