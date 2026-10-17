# Plantillas simples (catálogo) · diseño

**Fecha:** 24-sep-2026 · **Rama:** `feat/plantillas-simples` · **Estado:** diseño decidido sin
preguntas a Farid (encargo delegado: "decide con defaults sensatos y anótalos"). Los defaults
tomados están marcados **[default]** para que Farid los pueda revertir.

## Qué problema resuelve

Personalizar un pedido de llavero (hoy: la mochila NFC) exige correr `generar_mochila.py` en
la terminal. Farid quiere hacerlo desde la app en ~1 minuto: elegir modelo, escribir el
nombre, (opcional) el teléfono, ver el 3D, descargar el 3MF. Y quiere que la próxima
plantilla («llavero del auto», «placa de mascota», «llavero publicitario») sea **sumar un
JSON**, no programar otra pantalla.

## Decisión de arquitectura

Tres enfoques considerados:

1. **Portar el generador Python entero a JS** (shapely → Clipper). Descartado: son ~1.000
   líneas de geometría ya validadas contra G-code real; portarlas es duplicar la verdad.
2. **Llamar a Python desde la app** (servidor). Descartado: la app es una PWA estática sin
   backend propio, y Farid la usa también desde el celular.
3. **Elegido: la parte FIJA se exporta desde Python a un JSON; el navegador genera solo lo
   variable.** Python sigue siendo la fuente de verdad del diseño; el JSON es su foto
   versionada. En el navegador solo se calculan el nombre (opentype.js + Clipper) y el QR.

## Unidades

| Archivo | Qué hace | Depende de |
|---|---|---|
| `plantillas/catalogo.json` | Lista de plantillas: `{ id, archivo }` | — |
| `plantillas/<id>.json` | Una plantilla (formato `plantilla/1`, abajo) | — |
| `fuentes/*.ttf` + `OFL.txt` | Fredoka Bold normal y condensada (las mismas del Python) | — |
| `js/plantillamotor.js` | `Plantillas.componer(plantilla, varianteId, valores)` → `{ piezas, avisos, info }`: figuras 2D por pieza, lista para extruir. Sin DOM | Clipper, opentype, qrcode-generator |
| `js/plantilla3mf.js` | `Plantilla3MF.exportar(plantilla, compuesto, titulo)` → bytes del 3MF con el armazón de la plantilla (perfil, pausa, part ids) y `verificar(bytes)` | THREE (solo `ExtrudeGeometry`), `D3D3MF.zip/mallaDe` |
| `js/vistas/plantillas.js` | La pantalla: catálogo arriba, formulario armado desde `parametros`, vista 3D en vivo, botón Descargar 3MF | los dos de arriba |
| `tests/plantillas.test.js` | `node --test`: motor + 3MF contra el v3 de Python | Node ≥ 18 |

Se reutiliza de lo que ya existe: `D3D3MF.zip` (escritor ZIP), `D3D3MF.mallaDe` (malla
soldada), `D3DBuild.geometriaDe` (extrusión three.js). No se reutiliza `D3D3MF.exportar3MF`:
escribe un 3MF sin perfil ni `object_1.model`, y el encargo exige el perfil
`llaveros letra chica v4` igual que el v3.

## Formato `plantilla/1`

```jsonc
{
  "formato": "plantilla/1",
  "id": "mochila-nfc-v3",
  "nombre": "Llavero mochila NFC",
  "origen": "negocio/stl/mochila-nfc/generar_mochila.py --exportar-plantilla",
  "medidas": { "ancho": 65, "alto": 74.5, "espesor": 4.2 },
  "capa": 0.2,
  "variantes": [
    { "id": "nino", "nombre": "Niño",
      "colores": { "fondo": "#2F6FDB", "acento": "#FFFFFF", "contorno": "#111111", "nombre": "#F7C823" },
      "filamentos": ["#2F6FDB", "#111111", "#FFFFFF", "#F7C823"],
      "perfil": { /* Metadata/project_settings.config de esta variante */ } }
  ],
  "nombresColor": { "#2F6FDB": "AZUL" },
  "piezas": [                                  // ORDEN = part id del 3MF (1..N)
    { "id": "cuerpo", "nombre": "cuerpo (fondo {color})", "rol": "fondo", "z": [0, 3.2], "figs": [...] },
    { "id": "rev_claro", "rol": "acento", "z": [0, 0.6], "espejoX": true, "soloSi": "telefono", "figs": [...] },
    { "id": "rev_oscuro", "rol": "contorno", "z": [0, 0.6], "espejoX": true,
      "figs": [...], "figsSi": { "telefono": [...] } },
    { "id": "chip", "subtipo": "negative_part", "z": [2.0, 2.4], "figs": [...] }   // SIEMPRE último
  ],
  "parametros": [
    { "id": "nombre", "tipo": "texto", "etiqueta": "Nombre", "requerido": true, "mayusculas": true,
      "fuentes": ["fuentes/Fredoka-Bold.ttf", "fuentes/Fredoka-Bold-Condensed.ttf"],
      "zona": [...], "capMax": 11, "capMin": 3.8, "trazoMin": 0.64, "rendijaMin": 0.7,
      "tracking": 0.04, "borde": { "mm": 0.8, "pieza": "contorno" }, "pieza": "nombre" },
    { "id": "telefono", "tipo": "telefono-qr", "etiqueta": "Teléfono (QR en el reverso)",
      "patron": "^\\+569\\d{8}$", "prefijo": "tel:", "pieza": "rev_oscuro",
      "qr": { "version": 2, "ec": "Q", "modulo": 1.3, "silencio": 2, "centro": [0, -3.1], "soldadura": 0.46 } }
  ],
  "pausa": { "topZ": 2.6 },
  "armazon3mf": { "entradas": [ { "nombre": "...", "texto": "..." } | { "nombre": "...", "genera": "objetos|modelo|piezas|perfil|pausa" } ],
                  "objetoCabecera": "...", "modeloPlantilla": "...{{COMPONENTES}}..." }
}
```

Figuras: `[{ "outer": [[x,y],...], "holes": [[[x,y],...]] }]`, en mm, **en lectura** (el
reverso también: `espejoX` lo da vuelta al exportar, igual que Python).

### Tipos de parámetro

| tipo | UI | Qué produce |
|---|---|---|
| `texto` | input de texto | Texto en la fuente, ajustado a `zona` (de `capMax` hacia `capMin`, primero la fuente normal; la condensada solo si gana >15 % de altura, la regla del Python), con `borde` opcional (anillo en otra pieza). Rechaza con mensaje claro si no cabe o si algún trazo quedaría bajo `trazoMin` |
| `telefono-qr` | input tel, opcional | QR de `prefijo+teléfono` normalizado, en la versión/EC/módulo declarados; activa `figsSi[id]` y `soloSi: id`. Rechaza lo que no calce `patron` |
| `interruptor` | checkbox | Activa `soloSi` / `figsSi` de su id |
| `color` | selector de una lista | Sobrescribe el color de un `rol` (`{ rol, opciones: [{ hex, nombre }] }`) |

La variante (niño/niña/neutra) no es un parámetro: la declara `variantes` y la pantalla la
muestra siempre como botones.

## Reglas que se heredan del Python (y por qué)

- **El `negative_part` va último y con el id más alto.** Creality lo reconoce por número. El
  motor pone siempre las piezas en el orden del JSON; la exportación Python ya lo dejó último.
- **Pausa en `top_z` = techo del bolsillo + 1 capa (2,6).** Viene del JSON, no se calcula.
- **Perfil por variante** (3 o 4 filamentos cambian la matriz de purga): se exporta ya
  armado desde `_settings()` del Python, no se recalcula en JS.
- **Trazos ≥ 0,64 mm**: se mide como el Python (`perdida_fina`: abrir cada pieza con un disco
  de 0,62 mm y exigir que no pierda más de 8 %); piezas finas (tildes) se engrosan hasta
  0,25 mm antes de medir. Rendija entre letras ≥ 0,7: si no, se sube el tracking.
- **Ojos de letra**: los que no dan 2,4 mm se cierran; los del borde que quedan en menos de
  1 mm² (tras -0,5) se rellenan.

## Defaults tomados sin preguntar

- **[default]** Navegación: una entrada nueva **«Plantillas»** en el menú lateral, al lado de
  «Personalizados 3D». Con una sola plantilla en el catálogo, se abre directo.
- **[default]** La vista 3D gira arrastrando (sin OrbitControls: código propio, 30 líneas).
  Escribir en «Teléfono» gira la vista al reverso; escribir en «Nombre» la vuelve a la cara.
- **[default]** QR v2-Q fijo (`tel:+569XXXXXXXX` son siempre 16 bytes → siempre v2, que es lo
  que `segno` eligió con `boost_error`). El dibujo exacto de módulos puede diferir del de
  segno (otra máscara), ambos son QR válidos.
- **[default]** Sin vCard en la app (el Python la sigue teniendo). YAGNI hasta que Farid la pida.
- **[default]** 3MF sin comprimir (ZIP stored, como `d3d3mf.js`): ~1,3 MB en vez de ~200 KB.
  Creality lo abre igual.
- **[default]** Nombre del archivo: `Mochila NFC 65 - <variante> <NOMBRE sin tildes>[ QR] v3.3mf`,
  el mismo que usa el Python.

## Cómo se agrega una plantilla nueva

1. Diseñarla y validarla en Python (compuerta 5) como la mochila.
2. Agregarle un `--exportar-plantilla` que escriba `plantillas/<id>.json` con el formato de
   arriba (copiar `exportar_plantilla()` de `generar_mochila.py` como molde).
3. Sumar `{ "id": "<id>", "archivo": "<id>.json" }` a `plantillas/catalogo.json`.
4. Si usa una fuente nueva, copiarla a `fuentes/` con su licencia.
5. `node --test "tests/*.test.js"` — el test genérico de plantillas corre sobre **todas** las del
   catálogo (piezas, negativo último, pausa, perfil por variante).

No se programa pantalla: la arma `js/vistas/plantillas.js` desde `parametros`.

## Verificación

- `tests/plantillas.test.js` (node --test): unidades del motor (ajuste de texto, QR,
  interruptor, color) + MATEO/niño contra `Mochila NFC 65 - nino MATEO v3.3mf`: mismas
  piezas, subtipos y extrusores; bolsillo ±13,5 × z 2,0–2,4; `PAUSE top_z=2.6`; perfil
  idéntico; nombre dentro de la zona y sin tocar el contorno; volumen de cada malla = área ×
  alto (detecta triangulaciones rotas).
- En navegador (Playwright): flujo real con MAXIMILIANO, SOFÍA y QR, descarga y capturas.
- **Fuera de alcance aquí:** la compuerta 7 (G-code) la hace Farid cortando en Creality.
