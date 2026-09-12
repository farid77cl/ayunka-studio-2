# Backlog de código de Ayünka Studio 2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar tres huecos concretos y ya verificados contra el código real de `ayunka-studio-2`: el cableado roto de Argolla/Montaje, armar bandejas con varias copias en el generador 3D, y crear un producto directo desde una impresión huérfana de Historial K2.

**Architecture:** Vanilla JS sin build ni framework, siguiendo el patrón ya existente en cada archivo tocado. Nada de esto cambia el modelo de datos (`js/db.js`) ni la sincronización (`js/nube.js`) — se sigue construyendo sobre esa base, que ya se verificó hoy que está bien hecha.

**Tech Stack:** HTML/CSS/JS vanilla, three.js (ya vendorizado en `js/vendor/`), sin librerías nuevas.

**Spec:** No hay spec separada — el contexto y las decisiones están en esta misma sesión de trabajo (ver la sección "Contexto" abajo). Este repo no tiene framework de pruebas (`pruebas/` no existe en Studio 2, a diferencia del repo viejo), así que "test" en este plan significa: un script Playwright que carga la app real en un navegador headless, interactúa, y comprueba el estado — el mismo método usado hoy para verificar el bolsillo NFC y la cotización persistida.

## Contexto

Verificado hoy contra el código real (no contra `.planning/` del repo hermano `negocio`, que está desactualizado):

- **No se reescribe la app.** El modelo de datos, la sincronización y el sistema visual ya están bien hechos.
- Ya se agregó hoy el bolsillo NFC + pausa + verificación automática al generador 3D, y la cotización persistida en Cotizar. No se repiten en este plan.
- El área imprimible real de la K2 es **260×260×260 mm** (ya corregido hoy en `js/d3d-build.js`, era 350).
- La torre de purga, medida en la skill `llavero-nfc-desde-3mf` del repo hermano `negocio`, ocupa aproximadamente **X 18–78 / Y 220–260** con 2 colores (crece con más colores). Este plan usa una zona de exclusión conservadora y explícita, no inventa precisión que no se puede verificar sin cortar.

## Global Constraints

- No agregar dependencias ni paso de build — sigue siendo HTML/JS servido tal cual.
- Todo archivo nuevo o función nueva sigue el idioma y el tono de los comentarios existentes (español, explica el PORQUÉ no el qué).
- Cada tarea termina con una verificación real corriendo la app (Playwright headless contra `python -m http.server`), no solo "el código compila".
- Los ids de `Datos.agregar()` los genera `Datos.nuevoId()` — nunca inventar un id a mano.
- Ninguna tarea de este plan requiere que Farid mida, cronometre o decida algo de negocio primero.

---

### Task 1: Cablear Argolla y Montaje (el bug encontrado hoy)

**Files:**
- Modify: `js/vistas/disenos3d.js` (agregar `wireArgollaMontaje()`, llamarla desde `pintar()`)

**Interfaces:**
- Consumes: `proyecto.argolla` y `proyecto.montaje` (ya existen en `js/d3d-build.js`, `proyectoVacio()`), `cambiarArgolla(campo, valor)` y `cambiarMontaje(campo, valor)` (ya existen en `disenos3d.js`).
- Produces: nada que otras tareas consuman — es un fix aislado.

- [ ] **Step 1: Reproducir el bug con Playwright, antes de tocar nada**

Crear `C:\Users\farid\Git\ayunka-studio-2\docs\superpowers\plans\_check-task1.py` (script de un solo uso, se borra al final de la tarea):

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_page()
    page.goto('http://localhost:8770/', wait_until='networkidle', timeout=20000)
    page.click('text=Personalizados 3D')
    page.click('text=Llavero publicitario')  # preset con argolla activa por defecto
    page.click('summary')
    page.fill('#d3d-arg-d', '6')
    page.locator('#d3d-arg-d').blur()
    d = page.evaluate("Vistas.disenos3d._proyectoActual().argolla.d")
    print('argolla.d después de editar el campo:', d)
    b.close()
```

Correr (con la app servida en 8770, ver Step 4 de esta misma tarea para el comando del server):

```bash
"/c/Users/farid/AppData/Local/Programs/Python/Python312/python" docs/superpowers/plans/_check-task1.py
```

Esperado: imprime `4.5` (el valor original) en vez de `6` — confirma el bug antes de arreglarlo.

- [ ] **Step 2: Escribir el cableado**

En `js/vistas/disenos3d.js`, junto a la función `wireNfc()` que ya existe (agregada hoy), agregar:

```js
  // Mismo hueco que tenía el bolsillo NFC antes de hoy: estos campos no pasan por
  // camposTexto() al generar, así que sin este cableado la edición se pierde en silencio.
  function wireArgollaMontaje() {
    const ad = document.getElementById('d3d-arg-d'), ax = document.getElementById('d3d-arg-x'), ay = document.getElementById('d3d-arg-y');
    if (ad) ad.onchange = () => cambiarArgolla('d', ad.value);
    if (ax) ax.onchange = () => cambiarArgolla('x', ax.value);
    if (ay) ay.onchange = () => cambiarArgolla('y', ay.value);
    const md = document.getElementById('d3d-mon-d');
    if (md) md.onchange = () => cambiarMontaje('d', md.value);
  }
```

Y en `pintar()`, junto a la línea `wireNfc();` que ya existe, agregar `wireArgollaMontaje();` justo después.

- [ ] **Step 3: Correr el mismo script del Step 1 y confirmar que pasa**

Esperado ahora: imprime `6`.

- [ ] **Step 4: Levantar el server y correr una regresión de las 12 vistas**

```bash
cd /c/Users/farid/Git/ayunka-studio-2 && "/c/Users/farid/AppData/Local/Programs/Python/Python312/python" -m http.server 8770 &
```

Con la app servida, correr el script de regresión (navegar las 12 vistas de la barra lateral y capturar errores de consola con `page.on('console', ...)` filtrando `type == 'error'`). Esperado: lista vacía de errores.

- [ ] **Step 5: Borrar el script de un solo uso y commitear**

```bash
rm docs/superpowers/plans/_check-task1.py
cd /c/Users/farid/Git/ayunka-studio-2
git add js/vistas/disenos3d.js
git commit -m "fix(disenos3d): cablear los campos de Argolla y Montaje, se perdían al editarlos"
```

---

### Task 2: Armar bandeja con varias copias en el generador 3D

**Files:**
- Modify: `js/d3d-3mf.js` (nueva función `posicionesBandeja()`, extender `exportar3MF()` con `opts.copias`)
- Modify: `js/vistas/disenos3d.js` (campo "Cuántas copias", pasar `opts.copias` al exportar, mostrar cuántas caben)

**Interfaces:**
- Consumes: `compilado.dims.ancho`, `compilado.dims.alto` (ya existen, devueltos por `D3DBuild.compilar()`), `D3DBuild.proyectoVacio().bed` (ya `{x:260,y:260,z:260}`, corregido hoy).
- Produces:
  - `D3D3MF.posicionesBandeja(anchoPieza, largoPieza, opts)` → `Array<{x:number, y:number}>`, offsets relativos al centro de la bandeja.
  - `D3D3MF.exportar3MF(compilado, nombreBase, opts)` — `opts.copias` (opcional): mismo array de offsets. Sin `opts.copias`, comportamiento IDÉNTICO al de hoy (una sola copia en el origen) — no rompe nada de lo ya construido.

**Decisión de alcance, explícita:** esto NO reproduce el empaquetado óptimo de 20 placas de la skill `llavero-nfc-desde-3mf` (eso está afinado a mano para una medida exacta). Es una grilla simple y conservadora que deja espacio de sobra y evita una zona de exclusión configurable. **Farid tiene que abrir el 3MF en Creality Print y mirarlo antes de cortar** — el aviso en pantalla lo dice explícito, no se promete una bandeja lista para imprimir a ciegas.

- [ ] **Step 1: Escribir `posicionesBandeja()` y su verificación, antes de tocar el exportador**

En `js/d3d-3mf.js`, agregar antes de `window.D3D3MF = {...}`:

```js
  /* ---------- posiciones de bandeja ----------
     Grilla simple y conservadora: NO es el empaquetado óptimo de la skill
     llavero-nfc-desde-3mf (esa está afinada a mano para una medida exacta). Deja margen
     de sobra y evita una zona rectangular (por defecto, la esquina donde vive la torre
     de purga, medida en esa misma skill: X 18-78 / Y 220-260 con 2 colores). Con más
     colores la torre crece -- por eso esto es un punto de partida para revisar en
     Creality Print, no una bandeja lista para imprimir a ciegas. */
  function posicionesBandeja(anchoPieza, largoPieza, opts) {
    opts = opts || {};
    const bed = opts.bed || { x: 260, y: 260 };
    const margen = opts.margen != null ? opts.margen : 6;
    const exclusion = opts.exclusion || { x0: 0, y0: 220, x1: 80, y1: 260 };
    const pasoX = anchoPieza + margen, pasoY = largoPieza + margen;
    const cols = Math.max(1, Math.floor((bed.x - margen) / pasoX));
    const filas = Math.max(1, Math.floor((bed.y - margen) / pasoY));
    const out = [];
    for (let f = 0; f < filas; f++) {
      for (let c = 0; c < cols; c++) {
        // Posición absoluta del CENTRO de la pieza, en coordenadas 0..bed (esquina inferior izquierda = 0,0).
        const xAbs = margen + pasoX * c + anchoPieza / 2;
        const yAbs = margen + pasoY * f + largoPieza / 2;
        const fueraDeBandeja = (xAbs + anchoPieza / 2) > bed.x || (yAbs + largoPieza / 2) > bed.y;
        const dentroExclusion = !(xAbs + anchoPieza / 2 < exclusion.x0 || xAbs - anchoPieza / 2 > exclusion.x1 ||
                                   yAbs + largoPieza / 2 < exclusion.y0 || yAbs - largoPieza / 2 > exclusion.y1);
        if (fueraDeBandeja || dentroExclusion) continue;
        // Offset relativo al centro de la bandeja, porque exportar3MF posiciona cada
        // pieza con su propio origen local ya centrado en (0,0).
        out.push({ x: xAbs - bed.x / 2, y: yAbs - bed.y / 2 });
      }
    }
    return out;
  }
```

Y agregarla al export: `window.D3D3MF = { exportar3MF, zip, unzip, verificarNFC, posicionesBandeja, crc32, mallaDe };`

- [ ] **Step 2: Verificar `posicionesBandeja()` con un script Playwright (función pura, se puede probar sin generar nada)**

Crear `docs/superpowers/plans/_check-task2a.py`:

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_page()
    page.goto('http://localhost:8770/', wait_until='networkidle', timeout=20000)
    r = page.evaluate("""() => {
        const pos = D3D3MF.posicionesBandeja(28, 28); // llavero NFC redondo, ~28mm de lado
        const bed = {x:260, y:260};
        const dentroDeBandeja = pos.every(p =>
            Math.abs(p.x) + 14 <= bed.x/2 + 0.01 && Math.abs(p.y) + 14 <= bed.y/2 + 0.01);
        let sinSolape = true;
        for (let i = 0; i < pos.length; i++) for (let j = i+1; j < pos.length; j++) {
            if (Math.abs(pos[i].x - pos[j].x) < 28 && Math.abs(pos[i].y - pos[j].y) < 28) sinSolape = false;
        }
        const exclusion = {x0:0,y0:220,x1:80,y1:260};
        const sinTocarExclusion = pos.every(p => {
            const xAbs = p.x + bed.x/2, yAbs = p.y + bed.y/2;
            return (xAbs + 14 < exclusion.x0 || xAbs - 14 > exclusion.x1 || yAbs + 14 < exclusion.y0 || yAbs - 14 > exclusion.y1);
        });
        return { cantidad: pos.length, dentroDeBandeja, sinSolape, sinTocarExclusion };
    }""")
    print(r)
    b.close()
```

Correr: `"/c/Users/farid/AppData/Local/Programs/Python/Python312/python" docs/superpowers/plans/_check-task2a.py`

Esperado: `{'cantidad': <un número > 30>, 'dentroDeBandeja': True, 'sinSolape': True, 'sinTocarExclusion': True}`. Si `cantidad` es 0 o cualquiera de los tres booleanos es `False`, hay un error de signo o de escala en la función — no seguir al Step 3 hasta que esto pase.

- [ ] **Step 3: Extender `exportar3MF()` para escribir varias copias**

En `js/d3d-3mf.js`, dentro de `exportar3MF`, ubicar el bloque `<build>` (busca `modelo += ' <build>\n';`) y reemplazar:

```js
    modelo += ' </resources>\n <build>\n';
    for (const c of contenedores) modelo += '  <item objectid="' + c.id + '" transform="1 0 0 0 1 0 0 0 1 0 0 0" printable="1"/>\n';
    modelo += ' </build>\n</model>\n';
```

por:

```js
    modelo += ' </resources>\n <build>\n';
    const copias = (opts.copias && opts.copias.length) ? opts.copias : [{ x: 0, y: 0 }];
    for (const c of contenedores) {
      for (const cp of copias) {
        modelo += '  <item objectid="' + c.id + '" transform="1 0 0 0 1 0 0 0 1 ' + f(cp.x) + ' ' + f(cp.y) + ' 0" printable="1"/>\n';
      }
    }
    modelo += ' </build>\n</model>\n';
```

Y en el `return` final, agregar el conteo real de copias escritas: `copias: copias.length` (junto a `objetos`, `partes`, etc.).

- [ ] **Step 4: Verificar el 3MF con varias copias, leyendo el archivo de vuelta**

Este paso llama a `exportar3MF` directo desde la página (evita depender del botón "Descargar 3MF"), guarda el resultado en `window` para poder bajarlo, y lo verifica con Python **fuera** del navegador — el mismo método usado hoy para el bolsillo NFC.

Crear `docs/superpowers/plans/_check-task2b.py`:

```python
from playwright.sync_api import sync_playwright
import zipfile, re, io

dl = r'C:\Users\farid\AppData\Local\Temp\claude\c--Users-farid-Git-negocio\8b7561df-97ce-48f3-8eed-ee33bffe831a\scratchpad\bandeja-test.3mf'

with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_page(accept_downloads=True)
    errs = []
    page.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    page.goto('http://localhost:8770/', wait_until='networkidle', timeout=20000)
    page.click('text=Personalizados 3D')
    page.click('text=Llavero publicitario')
    page.click('text=Generar')
    page.wait_for_timeout(1500)
    info = page.evaluate("""() => {
        const comp = Vistas.disenos3d._compiladoActual();
        const pos = D3D3MF.posicionesBandeja(comp.dims.ancho, comp.dims.alto);
        const r = D3D3MF.exportar3MF(comp, 'bandeja-test', { copias: pos });
        window.__bandejaTest = r.datos; // Uint8Array, se descarga aparte
        return { copiasCalculadas: pos.length, copiasEnResultado: r.copias, posiciones: pos };
    }""")
    print('errores de consola:', errs)
    print('info:', {k: v for k, v in info.items() if k != 'posiciones'})
    with page.expect_download() as dl_info:
        page.evaluate("""() => {
            const blob = new Blob([window.__bandejaTest]);
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob); a.download = 'bandeja-test.3mf'; a.click();
        }""")
    dl_info.value.save_as(dl)
    b.close()

z = zipfile.ZipFile(dl)
modelo = z.read('3D/3dmodel.model').decode('utf-8')
items = re.findall(r'<item objectid="\d+" transform="([^"]+)"', modelo)
traslaciones = [tuple(t.split()[-3:]) for t in items]
print('cantidad de <item>:', len(items))
print('traslaciones únicas:', len(set(traslaciones)), 'de', len(traslaciones))
xs = [float(t[0]) for t in traslaciones]; ys = [float(t[1]) for t in traslaciones]
print('rango X:', min(xs), max(xs), '· rango Y:', min(ys), max(ys))
```

Correr: `"/c/Users/farid/AppData/Local/Programs/Python/Python312/python" docs/superpowers/plans/_check-task2b.py`

Esperado: `errores de consola: []`; `copiasCalculadas == copiasEnResultado`; la cantidad de `<item>` es igual a `copiasEnResultado` (una pieza en este preset, así que un contenedor → esa cantidad exacta de `<item>`); **todas las traslaciones son únicas** (si hay menos únicas que total, dos piezas quedaron exactamente superpuestas — bug grave, no seguir); el rango de X e Y cae dentro de aproximadamente `-125` a `125` (la mitad de 260, con margen).

- [ ] **Step 5: UI — campo "Cuántas copias" y aviso de cuántas caben**

En `js/vistas/disenos3d.js`, en `pintarGenerado()` (la función que arma la tarjeta "Listo" después de Generar), agregar un campo antes de los botones de descarga:

```js
        <div class="formulario" style="margin-top:10px">
          ${A.campo('d3d-copias', 'Copias en la bandeja', copiasPedidas, { tipo: 'number', unidad: 'piezas' })}
        </div>
```

(agregar `let copiasPedidas = 1;` junto a las otras variables de módulo, arriba del archivo, junto a `let compilado = null;` si existe, o donde estén las demás `let` de estado).

Y en `descargar('3mf')`, antes de llamar a `D3D3MF.exportar3MF`, calcular las posiciones:

```js
      const copiasEl = document.getElementById('d3d-copias');
      const pedidas = copiasEl ? Math.max(1, A.num(copiasEl.value) || 1) : 1;
      const posiciones = pedidas > 1 ? D3D3MF.posicionesBandeja(compilado.dims.ancho, compilado.dims.alto).slice(0, pedidas) : null;
      if (posiciones && posiciones.length < pedidas) {
        A.aviso('En la bandeja caben ' + posiciones.length + ' de las ' + pedidas + ' pedidas — se generaron esas.', 'error');
      }
      const r = D3D3MF.exportar3MF(compilado, nombre, posiciones ? { copias: posiciones } : {});
```

Y en el mensaje de éxito, agregar cuántas copias quedaron: `(r.copias > 1 ? ' · ' + r.copias + ' copias en la bandeja — ábrela en Creality Print y revísala antes de cortar' : '')`.

- [ ] **Step 6: Regresión de las 12 vistas + descarga de una sola copia (comportamiento viejo intacto)**

Repetir el script de regresión del Task 1 Step 4. Además, generar un llavero con "Copias en la bandeja" = 1 y confirmar que el 3MF resultante tiene exactamente 1 `<item>` por pieza — el caso de una sola copia no debe romperse.

- [ ] **Step 7: Borrar los scripts de un solo uso y commitear**

```bash
rm docs/superpowers/plans/_check-task2*.py
cd /c/Users/farid/Git/ayunka-studio-2
git add js/d3d-3mf.js js/vistas/disenos3d.js
git commit -m "feat(disenos3d): armar bandeja con varias copias, grilla conservadora que evita la torre de purga"
```

---

### Task 3: Crear producto desde una impresión huérfana de Historial K2

**Files:**
- Modify: `js/vistas/impresora.js`

**Interfaces:**
- Consumes: `propuestas` (array ya calculado por `Impresora.emparejar()`, cada item con `{archivo, veces, horasReales, gramosReales, productoId, ...}`), `Datos.agregar('productos', {...})`, `Costos.calcular(p)` (mismo patrón que usa `cotizar.js:guardar()` y `productos.js`).
- Produces: nada que otras tareas consuman.

- [ ] **Step 1: Preparar un archivo de historial de prueba con una pieza huérfana garantizada**

Crear `docs/superpowers/plans/_historial-prueba.json`:

```json
{
  "resumen": { "trabajos": 1, "horas_impresas": 2.5, "gramos_impresos": 60, "horas_perdidas": 0, "gramos_perdidos": 0, "tasa_fallo_material": 0.1 },
  "piezas": [
    { "archivo": "PruebaHuerfanaQueNoExiste.stl", "veces": 3, "horas_reales": 0.83, "gramos_reales": 20 }
  ]
}
```

(el nombre del archivo es deliberadamente raro para garantizar que no empareja con ningún producto real de `datos/semilla.json`).

- [ ] **Step 2: Reproducir el estado actual — sin botón, solo un párrafo**

```python
from playwright.sync_api import sync_playwright

fixture = r'C:\Users\farid\Git\ayunka-studio-2\docs\superpowers\plans\_historial-prueba.json'

with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_page()
    page.goto('http://localhost:8770/', wait_until='networkidle', timeout=20000)
    page.click('text=Historial K2')
    page.set_input_files('#imp-archivo', fixture)
    page.wait_for_timeout(800)
    print(page.inner_text('#imp-resultado')[-600:])
    b.close()
```

Esperado hoy: aparece "Sin producto en el catálogo · 1" y nada más — sin botón para crear el producto.

- [ ] **Step 3: Agregar el botón y la función que crea el producto**

En `js/vistas/impresora.js`, ubicar el bloque:

```js
      ${sinDueno.length ? `<div class="tarjeta"><h2>Sin producto en el catálogo · ${sinDueno.length}</h2>
        <p style="font-size:13px;color:var(--apagado);margin:0">
          Salieron de la K2 pero no calzan con ningún producto activo — puede ser una prueba,
          un trabajo de un cliente, o un producto que todavía no está cargado.</p>
      </div>` : ''}`;
```

Reemplazar por:

```js
      ${sinDueno.length ? `<div class="tarjeta"><h2>Sin producto en el catálogo · ${sinDueno.length}</h2>
        <p style="font-size:13px;color:var(--apagado);margin:0 0 10px">
          Salieron de la K2 pero no calzan con ningún producto activo — puede ser una prueba,
          un trabajo de un cliente, o un producto que todavía no está cargado.</p>
        <table><thead><tr><th>Archivo</th><th class="num">Veces</th><th class="num">Gramos</th><th class="num">Horas</th><th></th></tr></thead><tbody>
          ${sinDueno.map(p => `<tr>
            <td>${A.esc(p.archivo)}</td><td class="num">${p.veces}</td>
            <td class="num">${p.gramosReales}</td><td class="num">${p.horasReales}</td>
            <td><button class="btn chico" onclick="Vistas.impresora.crearDesdeHuerfano('${A.esc(p.archivo)}')">Crear producto</button></td>
          </tr>`).join('')}
        </tbody></table>
      </div>` : ''}`;
```

Y agregar, junto a `function aplicar(lista) {...}`:

```js
  // Convierte una pieza huérfana en un producto real, con los gramos y horas que ya
  // salieron medidos de la K2 -- mismo patrón que Vistas.cotizar.guardar() al guardar
  // un producto desde un 3MF cotizado.
  function crearDesdeHuerfano(archivo) {
    const prop = propuestas.find(p => p.archivo === archivo && !p.productoId);
    if (!prop) return;
    const nombre = archivo.replace(/\.(gcode|stl|3mf|step|stp)$/i, '').replace(/_/g, ' ');
    const p = Datos.agregar('productos', {
      sku: '', nombre, categoria: 'sin-categoria', oficio: '3d', material: 'PLA',
      gramos: prop.gramosReales, horas: prop.horasReales,
      colores: 1, postMin: 0, precio: null, stock: 0, filamentoId: null, foto: '',
      descripcion: 'Creado desde Historial K2 (' + prop.veces + ' impresión(es) registradas).',
      archivoOrigen: prop.archivo, extraCosto: 0, extraNota: '', activo: true
    });
    p.precio = Costos.calcular(p).sugerido;
    Datos.guardar('producto creado desde Historial K2');
    A.aviso('Creado: ' + nombre + ' — revísale la categoría y el precio en Productos');
    // Recalcula las propuestas para que este archivo pase de "sin dueño" a "se completa".
    propuestas = Impresora.emparejar(piezasOriginales, Datos.activos('productos'));
    pintarResultado();
  }
```

**`resumen` (la variable de módulo que ya existe en este archivo, línea 7) solo guarda los totales — no las piezas.** Hace falta una variable nueva para poder recalcular después de crear un producto. Agregar junto a las demás `let` de módulo (línea 6-9):

```js
  let piezasOriginales = []; // el array de piezas tal como vino del archivo, para poder re-emparejar sin volver a leerlo
```

Y en la función que carga el archivo (donde hoy dice `resumen = n.resumen;` y `propuestas = Impresora.emparejar(n.piezas, Datos.activos('productos'));`, alrededor de la línea 144-145), agregar la línea `piezasOriginales = n.piezas;` justo antes de esas dos.

Agregar `crearDesdeHuerfano` al export: `Vistas.impresora = { pintar, traerDeIp, aplicarUna, aplicarTodas, usarTasa, crearDesdeHuerfano };`

- [ ] **Step 4: Correr el script del Step 2 de nuevo y confirmar el botón**

Ajustar el script para hacer click y verificar el resultado:

```python
from playwright.sync_api import sync_playwright

fixture = r'C:\Users\farid\Git\ayunka-studio-2\docs\superpowers\plans\_historial-prueba.json'

with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_page()
    errs = []
    page.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    page.goto('http://localhost:8770/', wait_until='networkidle', timeout=20000)
    page.click('text=Historial K2')
    page.set_input_files('#imp-archivo', fixture)
    page.wait_for_timeout(800)
    page.click('text=Crear producto')
    page.wait_for_timeout(500)
    creado = page.evaluate("Datos.activos('productos').find(p => p.archivoOrigen === 'PruebaHuerfanaQueNoExiste.stl')")
    print('errores:', errs)
    print('producto creado:', creado)
    b.close()
```

Esperado: `errores: []` y `producto creado` con `gramos: 20`, `horas: 0.83`, `precio` distinto de `null` (el motor de costos ya le puso un sugerido).

- [ ] **Step 5: Regresión de las 12 vistas**

Repetir el script de regresión del Task 1 Step 4.

- [ ] **Step 6: Borrar los archivos de un solo uso y commitear**

```bash
rm docs/superpowers/plans/_historial-prueba.json
cd /c/Users/farid/Git/ayunka-studio-2
git add js/vistas/impresora.js
git commit -m "feat(impresora): crear un producto directo desde una impresión huérfana de Historial K2"
```

---

## Fuera de este plan — necesitan una decisión de Farid antes de poder escribirse

No están aquí porque escribir tareas de código para ellos hoy sería inventar una decisión de producto que no es mía. Cada uno con la pregunta concreta que lo destraba:

**Generador de perfiles de impresión** (prioridad 1 de Farid según `PROJECT.md` del milestone anterior). No existe nada en Studio 2. Antes de una sola línea:
- ¿El "motor de reglas" del repo viejo (2.237 líneas, 9 archivos) se porta tal cual, o se repiensa? El repo viejo ya no existe en este árbol de trabajo — habría que ir a buscarlo a su propio historial de git.
- ¿Qué formato de perfil importa/exporta: el bundle ZIP de Creality (`.creality_printer`) que ya se investigó en la sesión de la app anterior, u otra cosa?
- ¿Cuál es el primer caso de uso real: ajustar UN perfil existente (`llaveros`) con reglas, o generar perfiles nuevos desde cero para máquinas/materiales distintos?

**Envíos / Chilexpress.** Bloqueado en un dato de Farid, no en una decisión de diseño: hace falta la cuenta y la clave de `developers.wschilexpress.com` (pendiente desde la sesión 13 según `sesion-log.md` del repo `negocio`). Sin eso no hay nada que llamar.

**Textos de WhatsApp automáticos.** El archivo viejo (`whatsapp.js`, 148 líneas) no está en este repo — antes de portar algo hay que decidir: ¿se recupera tal cual del historial de la app anterior, o se reescriben los mensajes ahora que cambió el modelo de datos (pedidos con `clienteId`, abono, saldo)? Es una decisión de tono de marca tanto como de código.

**Puntadas por minuto de la bordadora.** No es una tarea de código todavía — es un número que falta medir (cronometrar la bordadora con un diseño real). Una vez que Farid tenga ese número, agregarlo a `DB.params` y usarlo en `costos.js` para el oficio bordado es una tarea chica de 15-20 minutos, pero programarla antes de tener el número sería adivinar un dato de negocio.
