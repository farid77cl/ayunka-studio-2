# Bitácora de Ayünka Studio

Lo más nuevo arriba. Formato y reglas en `COMO-REPORTAR.md`.

---

## 2026-09-02 · Arregla el bug que Cowork encontró en el navegador: datosAnteriores se perdía · v2.6.1

**Qué cambió.** Cowork revisó v2.6.0 en un navegador de verdad y encontró un bug real:
`datosAnteriores` (el valor que un producto tenía antes de que la K2 lo pisara) se
sobrescribía cada vez que se aplicaba, no solo la primera. Reproducido exacto: aplicar la
fila individual de `AY-3D-001` (80 g / 2,6 h → 75,2 g / 2,515 h, guarda `datosAnteriores:
{80, 2.6}`) y después "Aplicar las 11" en bloque volvía a evaluar la propuesta —que ya
estaba vieja, calculada contra el valor de ANTES de la primera aplicación— y terminaba
guardando `datosAnteriores: {75.2, 2.515}`: el valor nuevo, no el original. Dos clicks
seguidos borraban justo lo que la función existe para proteger.

`aplicar()` en `js/vistas/impresora.js` ahora recalcula contra el valor VIVO del producto en
vez de confiar en `prop.cambiaReal` (que quedó viejo tras la primera aplicación): si el
producto ya tiene exactamente el valor que trae el historial, no toca nada (evita
reprocesar); y `datosAnteriores` solo se escribe si el producto no lo tiene ya, nunca se
pisa una segunda vez.

**Cómo sé que funciona.** Reproduje el caso exacto de Cowork contra la semilla real: apliqué
la fila individual de `AY-3D-001` (80/2,6 → 75,2/2,515, `datosAnteriores` queda en 80/2,6),
después "Aplicar las 11" en bloque, y un tercer aplicar más por si acaso. Las tres veces
`datosAnteriores` se quedó en `{gramos: 80, horas: 2.6}` — nunca cambió. Un producto que ya
coincidía con el historial (`AY-3D-002`) tampoco quedó con `datosAnteriores` tras aplicarlo
dos veces. 6 de 6 verificaciones. Re-corrí también los dos tests de v2.5.0 y v2.6.0 contra
el código actual (10/10 y 18/18): nada se rompió.

**Lo que NO pude verificar.** Sin navegador acá, no vi el bug reproducirse visualmente antes
del arreglo, solo lo reproduje con el código real por consola/Node — igual que el resto de
esta pestaña.

**Lo que NO quedó.** Nada nuevo pendiente de esto — sigue sin haber un botón de "deshacer"
en la propia pestaña, como ya decía la entrada de v2.6.0.

**Versión.** `js/version.js` → `2.6.1`.

---

## 2026-09-02 · Historial K2: se ve el cambio antes de pisar un valor que ya estaba · v2.6.0

**Qué cambió.** Implementa el pedido de Farid que quedó en `SUPERVISION.md` tras la revisión
de v2.5.0: "manda la máquina, pero el cambio se ve". Antes, aplicar en bloque pisaba en
silencio cualquier gramos/horas que ya estuvieran cargados a mano. Ahora `js/impresora.js`
(`emparejar()`) marca cada propuesta con `enBlanco` (el producto no tenía nada) y `cambiaReal`
(ya tenía datos y la diferencia es real: más de 0,5 g o más de 1 minuto — por debajo es
ruido de redondeo y no se avisa). La vista (`js/vistas/impresora.js`, `pintarGrupo()`)
separa cada sección ("por archivo", "por parecido") en tres, nunca mezcladas: **se
completan** (estaban en blanco), **cambian un valor que ya estaba** (con una columna "Tenía"
junto al valor que trae la K2) y un conteo aparte de las que no cambian nada real. El botón
de aplicar-todas dice el desglose ("Aplicar las 11 · 1 cambian, 10 sin cambios"). Al aplicar
algo que sí cambiaba de verdad, el producto guarda `datosAnteriores: {gramos, horas}` con lo
que tenía antes, para poder revertirlo a mano si hizo falta.

**Cómo sé que funciona.** Corrí el código real (no una copia) contra la semilla real y
`../historial-impresion.json`, con un caso a propósito: desajusté `AY-3D-001` a 80 g / 2,6 h
(la K2 dice 75,2 g / 2,515 h — diferencia real) y `AY-3D-004` a 63,4 g / 2,211 h (diferencia
de 0,2 g — por debajo del umbral, a propósito, para probar que NO se marca como cambio).
- La sección "Cambian un valor que ya estaba" aparece con `AY-3D-001` y muestra en la tabla
  **tenía 80 g / 2,6 h · la K2 dice 75,2 g / 2,515 h**.
- `AY-3D-004` (diferencia bajo el umbral) y `AY-3D-002` (ya coincidía) caen en el conteo
  "sin cambios reales", no en la sección de cambios — no eran cambios de verdad.
- El botón de "por archivo" mostró el texto real **"Aplicar las 11 (1 cambian, 10 sin
  cambios)"**.
- Tras aplicar, `AY-3D-001` quedó con los valores reales (75,2 g / 2,515 h) y con
  `datosAnteriores: {gramos: 80, horas: 2.6}` — se puede volver atrás a mano. Los nueve
  productos 3D que estaban en blanco (`AY-3D-003, 005, 010, 011, 012, 017, 018, 019`) no
  quedaron con `datosAnteriores` — correcto, nunca hubo un valor previo que perder.
- Re-corrí también el test de la sesión anterior (v2.5.0) contra el código actual: los mismos
  11 "por archivo", los mismos 154 trabajos, la misma tasa de 12,9% — nada se rompió.
- 28 de 28 verificaciones en total, las dos corridas juntas.

**Lo que NO pude verificar.** Sigue sin haber navegador acá: no vi la tabla nueva pintada de
verdad, solo el HTML que genera el código real. La columna "Tenía" y el texto del botón los
comprobé por contenido del HTML, no visualmente.

**Lo que NO quedó.** Sigue sin haber un botón de "deshacer" en la propia pestaña — el dato
anterior queda guardado en `datosAnteriores` pero hay que ir a Productos a restaurarlo a
mano si hizo falta. No cambié el criterio de "por parecido" (sigue pendiente, ya lo decía la
entrada anterior).

**Versión.** `js/version.js` → `2.6.0`.

---

## 2026-09-02 · Historial de la K2: gramos y horas reales, propuestos no aplicados · v2.5.0

**Qué cambió.** Nueva pestaña "Historial K2" (`js/impresora.js` + `js/vistas/impresora.js`,
especificado por la sesión de Cowork en `SUPERVISION.md`). No es un monitor en vivo: se le
suelta el historial que la impresora ya guardó —de golpe si está al alcance, o el archivo si
no— y la app propone actualizar los gramos y las horas de cada producto con los datos reales
de la propia máquina. Nunca escribe sola: primero muestra la tabla, y solo aplica lo que una
persona confirma. También compara la tasa de fallas real contra la de Ajustes y ofrece
ponerla con un click.

**Cómo sé que funciona.** Corrí el código real (`js/impresora.js` y `js/vistas/impresora.js`,
no una copia) contra `../historial-impresion.json` de verdad y el catálogo real de la
semilla, simulando el evento real de soltar el archivo (no llamé a las funciones internas a mano):
- El resumen da **154 trabajos, 159,8 h impresas, 4,0 kg, 593 g perdidos, 12,9% de fallas**
  — los mismos números que citó Cowork en la especificación, sacados del mismo archivo.
- **11 productos emparejan por archivo exacto** con el historial — el mismo 11 que dijo
  Cowork ("de 100 piezas, solo 11 llegaron al catálogo"). Hay un doceavo (`AY-B2B-001`) que
  empareja **por parecido de nombre**, no por archivo exacto: queda en su propia sección,
  para revisar antes de aplicar, no junto con los de alta confianza.
- Los tres productos que Cowork pidió probar se recuperan exactos: **AY-3D-001 → 75,2 g /
  2,515 h**, **AY-3D-002 → 13,1 g / 0,658 h**, **AY-3D-004 → 63,2 g / 2,21 h** — probado de
  punta a punta: se les borran los datos, se suelta el historial, se aplica, y quedan
  exactos, con `origenDatos: "historial-k2"`.
- Un caso sintético con la forma real de Moonraker (`result.jobs[]`) confirma que agrupa por
  archivo, promedia solo los trabajos `completed`, y cuenta los `cancelled`/`in_progress`
  como material perdido, no como datos de la pieza.
- **El detalle que Cowork avisó que se le había pasado** ("hay que repintar, o los totales
  no aparecen hasta cambiar de vista") — probado explícitamente: después de aplicar, la
  pantalla se repinta sola, sin cambiar de pestaña.
- `usarTasaReal()` pone la tasa real en `DB.params.tasaFalla` sin tocar ningún producto de
  paso — probado con un antes/después de otro producto.

**Lo que NO pude verificar.** Igual que con Personalizados 3D: sin navegador acá, no vi la
zona de soltar el archivo funcionando de verdad, ni el botón "Traer de la impresora" contra
una K2 real (ese camino solo lo puede probar Cowork, que sí llega a la red de la
impresora — se lo dejo pedido). Tampoco probé qué pasa si el JSON que se suelta no es
ninguno de los dos formatos: el código avisa "No reconozco este archivo…" pero no lo vi en
pantalla.

**Lo que NO quedó.**
- No hay forma de deshacer una aplicación desde la propia pestaña (si algo se aplicó mal,
  hay que corregirlo a mano en Productos).
- Los "por parecido" se emparejan por una sola palabra del nombre — funciona para el caso
  real que hay hoy, pero con un catálogo más grande va a dar falsos positivos. Si eso pasa,
  hay que endurecer el criterio, no bajarle la exigencia a "por archivo".

**Necesito una decisión tuya (o de Cowork, que habla con la impresora).**
- Confirmar que "Traer de la impresora" realmente falla como se espera (bloqueo de
  contenido mixto) cuando la app corre por `https`, y que el mensaje en pantalla es el
  correcto — no lo puedo ver desde acá.

**Versión.** v2.5.0

---

## 2026-09-02 · Personalizados 3D: de un preset a un archivo, sin el editor completo · v2.4.0

**Qué cambió.** Se portó el motor de diseño 3D del repo anterior (`d3d-formas.js`,
`d3d-fuentes.js`, `d3d-build.js`, `d3d-3mf.js` — ni una línea reescrita, es el mismo código
que ya generó los 19 diseños de la semilla) y se enganchó a una pestaña nueva,
"Personalizados 3D": elegís uno de los 6 presets (llavero, llavero con imagen, letra con
nombre, letrero, caja de luz, recuerdo de nacimiento), le cambiás el texto, y "Generar"
te da las medidas, los avisos y el archivo — STL por color o 3MF multicolor para el CFS.
Al guardar como producto, los gramos y las horas quedan en 0 a propósito: no se inventan,
se miden imprimiendo o laminando, igual que en Cotizar.

**Lo que NO es todavía:** el editor completo de `design3d.js` (arrastrar, rotar, agregar
capas sueltas, subir una imagen y vectorizarla) no se portó — es 1.100 líneas de UI ligada
a Three.js interactivo, y no tengo cómo probarla sin navegador. Esta pestaña es la mitad
"de un preset a un archivo", que es la que Farid puede usar hoy sin abrir otra herramienta.
El preset "Desde cero" se sacó de la lista a propósito: sin el editor, una placa vacía no
tiene con qué llenarse.

**Cómo sé que funciona.** No hay navegador en este entorno, así que corrí el motor REAL
—no una copia, no un mock— en Node, con la fuente TTF y Three.js bajados del mismo CDN que
usa la app:
- Los 4 módulos portados cargan y registran `D3DFormas`/`D3DFuentes`/`D3DBuild`/`D3D3MF`.
- Los 6 presets compilan sin excepción y dan medidas reales: el llavero publicitario da
  65×28×4,2 mm; la letra con nombre, 102×63×40 mm; la caja de luz, 180×90×22 mm.
- Un nombre con **ñ y tildes** ("Ñañé Muñoz") compila y genera geometría — no es un caso
  aparte, opentype.js lo resuelve igual que cualquier letra.
- Exporté un STL binario real del llavero: la cabecera dice "Ayunka Studio - Diseno 3D", el
  conteo de triángulos del header coincide con los triángulos generados, y el tamaño del
  archivo es exactamente `84 + 50 × triángulos` bytes — la fórmula del formato STL binario.
- Exporté un 3MF real: el ZIP empieza con la firma `0x04034b50` (ZIP válido), 1 objeto
  contenedor, 2 partes de color, 9.852 triángulos.
- La función que decide qué campos de texto mostrar (`camposTexto`) se probó contra 4
  presets distintos: detecta las 2 capas del llavero, la letra base + 1 capa de la letra
  con nombre, cero campos en llavero-foto (es una imagen, no debe pedir texto), y las 3
  capas de texto del recuerdo sin confundirlas con sus 2 figuras (estrella, luna).
- De paso encontré y corregí un bug real que arrastré del repo viejo: usé la clase
  `.btn sm` en el botón de "Agregar línea" de Pedidos (commit `5fb1a57`), y acá la clase
  chica se llama `.chico`, no `.sm` — quedaba sin el tamaño reducido. Corregido.

**Lo que NO pude verificar.** Todo lo anterior corrió en Node, sin DOM. No vi la pestaña
en un navegador real: ni el grid de presets, ni que el botón "Descargar" de verdad
dispare la descarga del navegador, ni cómo se ve en pantalla chica. Es lo primero que
haría antes de imprimir algo basado en esto.

**Lo que NO quedó.**
- El editor completo (arrastrar, rotar, capas sueltas, imagen a 3D) — ver arriba.
- No hay vista previa 3D del diseño antes de descargarlo, solo medidas y avisos en texto.
- "Llavero con imagen" genera un aro vacío: pide que Farid suba la imagen, y esta versión
  todavía no tiene el control para subirla (existe en el motor portado, `trazarImagen`,
  falta engancharlo a un `<input type="file">`).

**Versión.** v2.4.0

---

## 2026-09-02 · Editar las líneas de un pedido · v2.3.0

**Qué cambió.** En Pedidos, la ficha ya deja agregar, cambiar y quitar líneas — antes solo
se veían y no había forma de tocarlas. Cada línea se puede atar a un producto del catálogo
(trae su nombre y precio solos, y se puede editar después) o dejarse libre con descripción y
precio a mano, para cosas como envío o un extra puntual. El total, el costo y el saldo del
pedido se recalculan en vivo mientras se edita, antes de guardar nada.

**Cómo sé que funciona.** Corrí la lógica real del archivo (no una copia) contra un producto
y un cliente de prueba, en Node, sin mockear el motor de costos:
- Elegir un producto de $8.900 y ponerle cantidad 3 → el total sube a $26.700.
- Agregar una línea libre "Envío a domicilio" a $3.000 → el total sube a $29.700.
- Agregar una tercera línea y dejarla sin terminar → el total en pantalla dice **"faltan
  precios"**, no un número inventado — el mismo principio que ya usa el costo de productos,
  ahora también en el total del pedido mientras se edita.
- Al guardar, esa línea sin terminar se descarta sola; las otras dos quedan con sus datos
  exactos (verificado campo por campo).
- Quitar una línea recalcula el total al vuelo, sin dejar huecos en el arreglo.
- Los `.js` del repo pasan `node --check` y el servidor local sirve los 20 archivos que
  toca `index.html` con 200.

**Lo que NO pude verificar.** No hay navegador ni herramienta de captura de pantalla en este
entorno: no lo recorrí clic a clic en pantalla, como pide `COMO-REPORTAR.md`. La lógica está
probada contra el código real, pero falta que alguien la vea funcionar en el navegador — es
lo primero que haría antes de dar esto por cerrado del todo.

**Lo que NO quedó.**
- Las líneas no se pueden reordenar ni duplicar.
- El selector de producto es una lista larga sin buscador — con 36 productos hoy es usable,
  pero no va a escalar mucho más así.

**Nota sobre el commit.** Este cambio quedó empaquetado dentro de `5fb1a57` (otra sesión de
Claude Code trabajando en el mismo repo al mismo tiempo, deshaciendo el pase de diseño), que
no lo mencionó en su propia entrada. El código es exactamente el que se describe acá —
confirmado después del commit, función por función.

**Versión.** v2.3.0 (el código ya está en el commit `5fb1a57`; esta entrada es el reporte
que faltaba, no trae cambios de código nuevos)

---

## 2026-09-02 · Se deshace el pase de diseño · v2.3.0

**Qué cambió.** El diseño de v2.2.0 estaba mal: copié la estética de `tools.kmorra3d.com`
—tipografía condensada en mayúsculas en títulos, menú, botones y etiquetas— cuando Farid me
mandó ese enlace **para que viera sus herramientas, no su web**. Su palabra: «quedó más fea
aún». Tenía razón.

Ahora: sin mayúsculas salvo en etiquetas chicas, pesos más bajos, el menú activo con un fondo
suave en vez de un bloque coral, las etiquetas con relleno tenue en vez de contorno. Se
conservan los cuatro detalles de oficio que sí servían: números de ancho fijo, unidades y `$`
dentro del campo, un color por categoría de costo, y casi cero sombras.

**Cómo sé que funciona.** Recorrí las seis pantallas en un navegador de verdad: cero errores.
La ficha de la Regla de radios muestra el desglose completo con los puntos de color y los
$1.128 / $90 / $71 / $272 / $400 / $350 / $231 alineados en columna. En la tabla de productos,
el chip repetido 14 veces seguidas («faltan las horas de trabajo») ya no está: la nota de
arriba lo dice una vez y las columnas muestran «—».

**Lo que NO quedó.**
- El panel de total pegado al costado sigue sin usarse (las clases están en el CSS).
- No se probó en un teléfono de verdad.

**Versión.** v2.3.0

---

## 2026-09-02 · Nace el repo · v2.2.0

**Qué cambió.** Repo nuevo desde cero, con los datos reales de Ayünka cargados. Ya se puede
ver el catálogo con costos por producto, los filamentos, los clientes, los pedidos con abono
y saldo, la cola que dice si el tiempo alcanza, y **cotizar tirando un 3MF**.

**Cómo sé que funciona.**
- 36 productos cargados, todos con SKU y categoría. 12 con precio, 11 con costo calculable.
- `AY-3D-001 Regla de radios`: costo **$2.543** con el desglose completo (filamento $1.128,
  merma $90, luz $15, amortización $272, preparación $400, empaque $350, fallas $231),
  sugerido $8.900 contra los $8.500 que cobra hoy → «en línea con el cálculo».
- El lector de 3MF, contra `../stl/LIDCAR redondo 5 v5.3mf`: **5 piezas, 54 × 60,03 × 3 mm,
  hueco de 0,229 cm³**. Ese hueco es π × 13,5² × 0,4 — el bolsillo redondo del chip, exacto.
- `portatijeras-corazon-ayunka.3mf` (un 3MF simple, sin metadatos de Creality): 1 pieza,
  78 × 47,7 × 61,49 mm, 125,98 cm³. Los dos coinciden con el cálculo hecho aparte en Python.
- Un producto de bordado sin horas de trabajo **no muestra precio sugerido** y dice «faltan
  las horas de trabajo». Al ponerle 2,5 h y $3.500 de materiales: costo $15.235, sugerido
  $38.800, precio real $25.000 → «36% bajo el cálculo».
- Recorrí las seis pantallas en un navegador de verdad: cero errores en consola.

**Lo que NO quedó.**
- Las líneas de un pedido se ven y se calculan, pero **no se pueden editar**. Es lo primero
  que se choca al usarlo.
- 9 productos 3D sin gramos ni horas: mientras falten, la cola calcula de menos.
- Los 16 textiles entraron todos como `bordado`; hay que separar cuáles son costura (×2).
- No hay conexión con la impresora, ni subida de fotos, ni exportación a Meta/WhatsApp.
- El panel de total pegado al costado está en el CSS pero sin usar.

**Necesito una decisión tuya.**
- Los 16 textiles: ¿cuáles son costura y cuáles bordado? Es criterio tuyo, no técnico.

**Versión.** v2.2.0 · commits `9bae003`..`eaa9619`
