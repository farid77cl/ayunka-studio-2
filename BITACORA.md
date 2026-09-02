# Bitácora de Ayünka Studio

Lo más nuevo arriba. Formato y reglas en `COMO-REPORTAR.md`.

---

## 2026-09-02 · Cuatro de los siete arreglos de la revisión del 3-sep · v2.13.0

**Qué cambió.** `SUPERVISION.md` trajo una auditoría nueva ("Revisión del 3-sep · v2.8.0 →
v2.12.0") con 7 problemas reales encontrados en un navegador de verdad. Esta entrada cierra
los 4 primeros — los que Cowork marcó como más urgentes ("sobre todo el 1, el 2 y el 4").
Los otros 3 (filamento/costo extra en la ficha, libro de movimientos de stock, dónde poner
las llaves de Supabase) quedan para la próxima entrada.

**1 · Pendientes ya no triplica el mismo producto.** El bug real: los mismos 16 textiles
salían en "sin precio", "sin horas" y "sin confirmar" a la vez (67 pendientes contra 26
productos de verdad), y el bloque de precios no tenía un solo botón "Aceptar" porque
ninguno de los 24 "sin precio" tenía costo completo. `js/vistas/pendientes.js` ahora
clasifica cada producto en un solo bloque, con prioridad de lo más fundamental a lo más
superficial: 3D sin datos → textil sin horas → bordado sin confirmar → sin precio (este
último, solo si el costo ya está completo — así que siempre tiene sugerido).

**2 · Ya no se puede guardar una venta sin líneas.** `js/vistas/finanzas.js`: si se guarda
sin agregar ninguna línea, avisa "Una venta necesita al menos una línea" y no la deja
activa — si era un borrador recién creado, lo descarta (`activo:false`) en vez de dejarlo
como una fila fantasma de $0. Si se intenta vaciar una venta que YA tenía datos reales,
tampoco se pierden: el aviso bloquea el guardado y los datos anteriores quedan intactos.

**3 · Los modales cierran con Escape y con clic afuera.** `js/ui.js`, en `A.preguntar()`:
Escape y un clic en el fondo oscuro cierran igual que el botón "Cancelar" (`valor: null`,
que todas las pantallas ya tratan como "no se hizo nada"). El listener de teclado se saca
del `document` al cerrar, para no acumularlos si se abren muchos modales seguidos.

**4 · El pedido de LIDCAR ya no es invisible.** Sus dos líneas (`ped-2026-001`) no tenían
`productoId`, así que `horasPedido`/`calcularPedido` daban 0 en silencio. Investigué los
archivos reales en `../stl/` para no inventar números:
- **Rectangular** (`AY-B2B-002`, nuevo): `LIDCAR rectangular 20 - vectorial v4_PLA_6h29m.gcode`
  trae 20 objetos reales (confirmado contando `EXCLUDE_OBJECT_DEFINE`) y
  `filament used [g] = 112.70, 11.80` → **6,2 g por unidad**. Las horas (**0,328 h** =
  19,66 min) son las que ya calculó `CARGA-INICIAL.md` con el g-code de la bandeja de 15
  (`294,9 min / 15`) — esa cifra SÍ está en el documento, la usé tal cual.
- **Redondo** (`AY-B2B-003`, nuevo): `LIDCAR redondo_PLA_4h49m.gcode` trae 15 objetos reales
  (mismo método) y `filament used [g] = 80.71, 8.61` → **6,0 g por unidad**. Las horas
  (**0,321 h** = 289 min / 15) **no están en `CARGA-INICIAL.md`** — las derivé yo del
  mismo archivo real con la misma fórmula que el documento usó para el rectangular (tiempo
  del nombre del archivo ÷ piezas de la bandeja). Lo dejé escrito en la descripción del
  producto y acá: **alguien debería confirmarlo**, el documento dice explícitamente "si
  falta un número, preguntar" y este lo derivé en vez de encontrarlo ya escrito.
- Las dos líneas del pedido ya apuntan a estos productos (`productoId`).
- Además, `js/vistas/pedidos.js` (en el modal de edición) y `js/vistas/cola.js` ahora avisan
  cuando una línea de CUALQUIER pedido no tiene producto vinculado — antes fallaba en
  silencio, es justo lo que le pasó a LIDCAR.

**Cómo sé que funciona.** Corrí el código real contra la semilla real (ya con los 38
productos):
- **Deduplicación:** la suma de los 4 bloques de productos (27) coincide exacto con la
  unión calculada de forma independiente (27) — ningún id se repite entre bloques. El
  bloque "Precios sin poner" tiene 2 filas y **las 2 traen su botón Aceptar** (antes: 24
  filas, 0 botones). `AY-B2B-002`/`003` caen en ese bloque, no en "3D sin datos".
- **Venta vacía:** guardar sin líneas deja la venta con `activo:false`, no aparece ninguna
  venta en $0 en la lista. Vaciar una venta que tenía `total:5000` y una línea real, e
  intentar guardar, la deja intacta (`total:5000`, 1 línea) — no se pierde nada.
- **Modal real, de punta a punta** (primera vez en la sesión que se corre `A.preguntar()`
  sin stubearlo — armé un DOM falso con `addEventListener`/`dispatchEvent` reales): Escape
  resuelve con `valor:null` y saca el modal; una tecla distinta no hace nada; un clic en el
  fondo (`target === fondo`) cierra igual que Cancelar; un clic dentro del modal no cierra
  nada; el listener de `keydown` se agrega al abrir y se saca al cerrar, sin acumularse.
- **LIDCAR real:** `horasPedido(pedido)` pasó de 0 a **32,45 h** (50×0,328 + 50×0,321,
  exacto); `calcularPedido(pedido).costo` pasó de 0 a **$98.246,56**. El aviso de "línea sin
  vincular" aparece en un pedido de prueba con una línea libre, y NO aparece en uno con
  todas sus líneas vinculadas — y Cola también lo muestra.
- 13 + 8 + 9 = **30 verificaciones nuevas**, todas en verde. Re-corrí las 8 suites
  anteriores de la sesión (169 verificaciones más): dos tenían números viejos ya obsoletos
  por este mismo cambio (el pedido de LIDCAR ya no da costo $0, que es justo lo que se
  arregló) — los corregí para que reflejen la realidad nueva, y quedaron en verde. El resto,
  sin tocar.

**Lo que NO pude verificar.** Todo lo visual, como siempre. Y en particular: **las horas
del llavero redondo (0,321 h) no están en `CARGA-INICIAL.md`** — las derivé yo del g-code
real con el mismo método que el documento usó para el rectangular, pero el documento mismo
dice que si falta un número hay que preguntar, no derivarlo. Que alguien lo confirme antes
de cotizar con ese número en serio.

**Lo que NO quedó.**
- Los otros 3 arreglos de la revisión del 3-sep (filamento/costo extra en la ficha del
  producto, el libro de movimientos de stock, dónde configurar las llaves de Supabase) —
  siguen pendientes, ya identificados y sin tocar todavía.
- No hay forma de "deshacer" haber descartado una venta vacía por error (queda con
  `activo:false`, recuperable a mano desde la base, pero no desde la interfaz).

**Versión.** `js/version.js` → `2.13.0`.

---

## 2026-09-02 · Subir fotos a Supabase, ya verificado · v2.12.0 (encargo E)

**Qué cambió.** Termina lo que quedó a medias en el commit de respaldo de más abajo. Punto
E del "Encargo del 2-sep": Supabase solo existía como campo vacío en `config.js`, sin forma
de usarlo. Ahora la ficha de un producto (`js/vistas/productos.js`) tiene una sección de
foto arriba del formulario: vista previa, botón "Subir foto"/"Cambiar foto", y sube el
archivo de una vez —no espera a que se guarde el resto del formulario, para no perder la
subida si alguien cancela después—. `js/supabase.js` es la lógica: habla con la REST de
Storage de Supabase sin SDK (la clave es la "anon key", pública, protegida por Row Level
Security — ya lo decía el comentario de `config.js`), valida que sea JPEG/PNG/WEBP y de
menos de 8 MB, y sube a `catalogo/<SKU>.<ext>` — la misma carpeta y convención de nombre
(SKU en mayúsculas) que ya usan las 36 fotos reales que trae la semilla.

**Cómo sé que funciona.** Corrí el código real, interceptando `fetch` para probar las
funciones exportadas de verdad (no una reconstrucción a mano de la llamada):
- `configurado()` da `false` con la config vacía real de hoy, `true` con una completa.
- Rechaza un PDF ("solo se aceptan fotos JPEG, PNG o WEBP") y una foto de 20 MB ("pesa más
  de 8 MB") — antes de intentar subir nada.
- La subida real manda `POST` a la ruta exacta de Storage, con la anon key como `Bearer`,
  `x-upsert:true` (para poder reemplazar una foto ya subida) y el `Content-Type` real del
  archivo.
- La URL pública que devuelve coincide **carácter por carácter** con el formato de las
  fotos reales que ya existen en la semilla: probé subiendo con el SKU real de
  `AY-BOR-001` (que ya tenía esa foto puesta a mano) y dio la URL **idéntica** — prueba de
  que el nombre de archivo es determinístico y compatible con lo que ya hay.
- Cuando Supabase responde un error (probé un 400 simulado), lo propaga tal cual, con el
  mensaje real.
- Integración con `productos.js`: `_subirFoto()` deja `p.foto` con la URL real, repinta la
  vista previa sin reabrir el modal, y el estado dice "Foto subida". Sin Supabase
  configurado avisa claro y no rompe nada; con un archivo inválido tampoco deja una
  excepción sin capturar.
- `index.html` y `sw.js` cargan y precachean `supabase.js` en el lugar correcto.
- 21 de 21 verificaciones. Re-corrí las 7 suites anteriores de la sesión (169 verificaciones
  más) — todas en verde, nada se rompió.

**Lo que NO pude verificar.** Contra un Supabase real: no tengo la anon key ni el proyecto
real desde este entorno, así que nunca se subió una foto de verdad al bucket. Es lo mismo
que ya pasó con el agente de la K2 — necesita que alguien con el proyecto real lo pruebe.

**Lo que NO quedó.**
- No hay forma de borrar una foto ya subida desde la app (solo reemplazarla subiendo otra
  con el mismo SKU).
- No se recorta ni redimensiona la imagen antes de subir — sube el archivo tal cual lo
  eligió, del tamaño que sea (hasta 8 MB).

**Versión.** `js/version.js` → `2.12.0`.

---

## 2026-09-02 · Subir fotos a Supabase — SIN TERMINAR, respaldo de emergencia (encargo E)

**Qué es esto.** Farid pidió parar para apagar el PC y respaldar. Esto es exactamente eso:
un commit de lo que hay escrito, **sin la verificación de siempre en esta bitácora**. No lo
tomes como una entrada de "cómo sé que funciona" — no corrí los tests todavía.

**Qué hay escrito.** `js/supabase.js` (subir un archivo a Supabase Storage por REST, sin
SDK, valida tipo JPEG/PNG/WEBP y tamaño máximo 8 MB, devuelve la URL pública) y su
integración en `js/vistas/productos.js` (sección de foto en la ficha del producto, con
vista previa y botón para subir/cambiar). Registrado en `index.html` y `sw.js`.

**Lo que falta, tal cual quedó:**
- Correr la verificación real contra el código (ya escrita en el scratchpad de la sesión,
  no corrida).
- Confirmar que no rompió nada de lo demás.
- Subir la versión en `js/version.js` (sigue en `2.11.0`, sin cambiar).
- Probarlo de verdad contra un Supabase real — igual que con el agente de la K2, esto no
  se puede probar sin credenciales reales.

**Cuando retome la sesión, esto es lo primero que hay que terminar antes de darlo por
hecho.**

---

## 2026-09-02 · La impresora en vivo: el agente que empuja a Firestore · v2.11.0 (encargo D)

**Qué cambió.** Punto D del "Encargo del 2-sep": hasta ahora la app solo sabía el *pasado*
de la K2 (Historial K2). Esto agrega el *presente*, con dos piezas:

1. **`../impresora/agente-k2.js`** (fuera de este repo, en `negocio/impresora/` — es un
   proceso aparte que corre en la red de la impresora, no parte de la app web). Consulta la
   K2 cada 5 s por el **mismo camino que ya prueba `monitor-k2.ps1` en producción**
   (Moonraker HTTP, `192.168.100.90:4408`), y empuja el estado a Firestore
   (`negocios/<espacio>/impresora/k2`) por su API REST, sin SDK ni npm — mismo estilo que
   ya usa `nube.js` para hablar con Firebase. **Decisión que tomé y dejo escrita:** el
   `PLAN.md` original pedía `ws://<ip>:9999`, un protocolo que no está documentado en
   ningún lado de este proyecto ni lo pude probar. Usé el camino que SÍ está probado contra
   la impresora real en vez de escribir código a ciegas contra uno que no.
2. **En este repo**: `js/nube.js` agrega `leerImpresoraViva()` (lee ese documento con la
   sesión ya conectada, nunca escribe desde la app), y `js/vistas/pendientes.js` muestra un
   aviso cálido —no rojo, misma tarjeta `.aviso` que el resto de la app— cuando la K2 está
   en pausa: **"La K2 está en pausa — toca meter los chips"**, con el archivo y hace cuánto.

**A propósito NO hice** (lo dejo escrito para que quede la decisión, no solo el hueco):
mandar comandos a la impresora (pausar/reanudar/cancelar, `PLAN.md` 3.2) — es un riesgo real
sobre una máquina física que no puedo probar desde acá; y una notificación push de verdad al
teléfono — necesita elegir un mecanismo (FCM/WhatsApp/SMS) que no me corresponde decidir
sola. Lo que sí queda: el dato en Firestore, listo para cualquiera de los dos el día que se
decidan.

**Cómo sé que funciona.** No tengo red hacia la K2 (`192.168.100.90`) ni un proyecto de
Firebase real desde este entorno, así que no pude probar el agente contra los de verdad.
Lo que sí hice, de punta a punta, con servidores HTTP locales que imitan la forma EXACTA de
cada API real (no funciones simuladas — pedidos y respuestas HTTP reales, interceptando
`fetch` para probar las funciones exportadas de verdad):
- `consultarK2()` contra un Moonraker falso con la forma real de `monitor-k2.ps1`: toma
  `virtual_sdcard.layer/layer_count` (no `print_stats.info.current_layer`, que en esta
  máquina viene `null`), calcula el avance y los minutos igual que el script de PowerShell,
  y lanza un error real (no se cuelga) cuando no hay nadie respondiendo.
- `entrarFirebase()` real llama al endpoint real de Identity Toolkit con la `apiKey` en la
  URL y manda `email`/`password`/`returnSecureToken` como pide la API.
- `escribirDocumento()` real arma la URL de Firestore con el `projectId` y la ruta exactos,
  manda `PATCH` (reemplaza el documento entero) con el `idToken` como `Bearer`, y codifica
  los valores en `fields.*.stringValue/booleanValue/integerValue` tal como exige la REST de
  Firestore.
- La codificación de valores (`aValorFirestore`) se probó para entero, decimal, boolean,
  null y string.
- `leerCredenciales()` avisa claro si falta el archivo, y lee bien uno válido.
- 32 de 32 verificaciones del agente.
- Del lado de la app: con `Nube.encendida()` en falso, no intenta leer nada. Con una sesión
  simulada y `leerImpresoraViva()` devolviendo `pausado:true`, aparece el aviso con el
  archivo real y "hace 3 min". Con `pausado:false` no aparece nada. Si `leerImpresoraViva()`
  falla (sin red), Pendientes no se rompe. 34 de 34 verificaciones de Pendientes (incluye
  las de antes, todas siguen pasando).
- Re-corrí las 5 suites anteriores de esta sesión (impresora v2.5–2.6.1, finanzas, catálogo,
  marca) — 84 verificaciones más, todas siguen en verde.

**Lo que NO pude verificar.** Todo lo que de verdad importa acá: que el agente hable con la
K2 real, que Firestore reciba y guarde el documento de verdad, y que el aviso aparezca en un
navegador real cuando la impresora esté realmente en pausa. Es exactamente lo que le pido a
Cowork o a Farid que confirmen antes de dejar el agente corriendo solo.

**Lo que NO quedó.**
- Comandos remotos (pausar/reanudar/cancelar) — decisión deliberada, no descuido (ver
  arriba).
- Notificación push real al teléfono — necesita una decisión de infraestructura.
- El agente no se reinicia solo si se cae (por ejemplo, si Windows se reinicia). Igual que
  `monitor-k2.ps1`, hay que dejarlo corriendo a mano.

**Necesito una decisión tuya (o de Cowork).** Confirmar el camino elegido (Moonraker HTTP en
vez de `ws://9999`) sirve, y decidir cómo se avisa al teléfono de verdad si con la pestaña
abierta no alcanza.

**Versión.** `js/version.js` → `2.11.0`.

---

## 2026-09-02 · Publicar y cerrar la nube — hasta donde llega el código (encargo C)

**Qué cambié.** Nada de código en esta entrada — es un reporte de estado de las 4 partes de
`PLAN.md` Fase 2, tal como pide el encargo, para que quede escrito qué se puede hacer desde
acá y qué no.

**1. Publicar en `https` — HECHO y verificado de verdad, no solo "debería andar".**
`https://farid77cl.github.io/ayunka-studio-2/` responde **200** y sirve la app real (lo
comprobé con un `curl` real a la URL, no lo supuse). Esto ya estaba hecho desde antes de
este encargo — activé GitHub Pages cuando el repo pasó a público. El único detalle: el
`curl` a `js/version.js` todavía muestra `2.9.0`, no la `2.10.0` de la última subida —
GitHub Pages tarda un poco en rehacer el sitio después de cada push; no es un error, hay
que darle un minuto.

**2, 3 y 4 — no los puedo hacer yo, y no es un límite de código.** Necesitan cosas que no
tengo desde acá:
- **Poner el correo real en `firestore.rules`**: ese correo se crea en Firebase
  Authentication → Users, y hoy el archivo tiene el `CAMBIAR@ejemplo.com` de plantilla. No
  lo puedo adivinar ni inventar uno — hace falta que alguien con acceso a la consola de
  Firebase lo diga.
- **Publicarlas en la consola**: cambiar el archivo en este repo no cambia nada en
  Firebase — hay que entrar a Firestore → Reglas → Publicar. Yo no tengo esa consola.
- **Comprobar con el `curl` que da 403**: solo tiene sentido después del punto anterior, y
  contra un proyecto de Firebase real.
- **Forzar un conflicto a propósito con datos reales**: necesita dos sesiones de verdad
  (el navegador, no puedo abrirlo yo) sincronizando contra el mismo proyecto.

Esto es exactamente lo que `SUPERVISION.md` ya reparte así: "Hablar con... Firebase" es de
Cowork, no mío. Lo dejo pedido acá en vez de simular que lo hice.

**Cómo sé que funciona (lo que sí hice).** `curl -s -o /dev/null -w "%{http_code}"` contra
la URL de GitHub Pages dio **200**, y el `curl` al `index.html` trajo el HTML real de la
app (el `<title>Ayünka Studio</title>` real, no una página de error de GitHub).

**Lo que NO pude verificar.** Todo el punto 2, 3 y 4 — necesitan la consola de Firebase, que
no tengo desde este entorno.

**Necesito una decisión/acción de Cowork o de Farid.** El correo de acceso real para
`firestore.rules`, y que alguien con la consola de Firebase publique las reglas y corra el
`curl` de comprobación. Cuando esté, aviso.

**Versión.** Sin cambio — no hubo código nuevo en esta entrada.

---

## 2026-09-02 · Studio como fuente única de precios — exporta CSV y XLSX · v2.10.0 (encargo B)

**Qué cambió.** Punto B del "Encargo del 2-sep": el precio se editaba en tres lados (Studio,
el CSV de Meta, el XLSX de WhatsApp), justo el desorden que ya pasó una vez. Nuevo
`js/catalogo.js` (lógica pura) más dos botones en Ajustes → "Catálogo para publicar":

- **CSV para Meta Commerce Manager**, con el formato EXACTO que ya usa
  `../catalogo/catalogo-meta-importar.csv` — `id,title,description,availability,condition,
  price,link,image_link,brand`, con BOM al inicio, precio como `"25000 CLP"` y **vacío
  cuando el producto no tiene precio** (nunca se inventa uno).
- **XLSX para la planilla de WhatsApp**, escrito a mano sin librería — reutiliza el mismo
  `zip()`/`crc32()` que `D3D3MF` ya usa para el 3MF (mismo formato de fondo: OOXML es un ZIP
  de XML). Dos hojas: "Catálogo" (SKU, categoría, producto, descripción, PRECIO (CLP)
  destacado en amarillo, imagen) y "Instrucciones" (las dos formas de cargarlo, tomadas de
  `catalogo/README.md`). A propósito **no tiene columna de "cargado"**: si el archivo se
  regenera entero cada vez, una marca manual ahí se pierde igual — mejor no tentar a
  editarlo a mano, que es justo lo que este punto quiere evitar.

**Cómo sé que funciona.** Corrí el código real contra los 36 productos reales de la
semilla, y para el XLSX fui un paso más allá: en vez de solo revisar que el ZIP "se viera
bien", lo abrí con **SheetJS de verdad** (traído de cdnjs, no simulado) — la misma clase de
prueba que ya se usó para el 3MF con Three.js real:
- El CSV generado tiene la cabecera carácter por carácter igual a la real, una fila por
  cada uno de los 36 productos, el precio de `AY-BOR-001` sale `"25000 CLP"`, el link de
  Instagram y la marca "Ayünka" están en cada fila.
- Un producto sin precio (hay 24 en la semilla real) sale con el campo `price` **vacío**,
  no en cero.
- Una descripción real con coma (la de `AY-BOR-001`) salió correctamente entre comillas —
  si no, el CSV se rompe en Excel/Meta.
- **SheetJS abrió el XLSX de verdad**: ve las dos hojas en el orden correcto, la cabecera
  de la hoja "Catálogo" es la esperada, cuenta las 36 filas, encuentra `AY-BOR-001` con el
  precio como **número real 25000** (no texto), y el producto sin precio sale con la celda
  vacía también ahí. La hoja de instrucciones trae el camino de Meta Commerce Manager y la
  advertencia de no editar el archivo a mano.
- 23 de 23 verificaciones.

**Lo que NO pude verificar.** Que Excel o Google Sheets de verdad lo abran sin quejarse
(SheeetJS es tolerante y puede leer cosas que Excel rechazaría) — es el hueco más
importante que le pido a Cowork que cierre, abriéndolo en un Excel o Sheets real. Tampoco
vi el resaltado amarillo de la columna de precio de forma visual, solo confirmé que el
estilo se aplicó a la celda correcta.

**Lo que NO quedó.**
- No hay botón para "regenerar y avisar si algo se ve raro" — simplemente genera de nuevo
  con los datos actuales; si Farid quiere comparar contra la versión anterior, tiene que
  mirar los dos archivos él mismo.
- El XLSX no ajusta el ancho de columna a lo que tiene adentro — Excel las va a mostrar
  angostas hasta que alguien las estire. No estaba pedido y es puramente cosmético.
- La columna "link" del CSV usa `DB.params.negocio.ig` si parece una URL completa, si no
  usa el link fijo de Instagram — no lo pude probar con un valor real puesto en Ajustes
  porque nadie lo ha configurado todavía en la semilla.

**Versión.** `js/version.js` → `2.10.0`.

---

## 2026-09-02 · Ventas y gastos — el agujero de fondo · v2.9.0 (encargo A)

**Qué cambió.** Nueva pestaña `js/vistas/finanzas.js`, punto A del "Encargo del 2-sep": las
colecciones `ventas` y `gastos` ya existían en la base pero no tenían pantalla, así que la
app sabía cuánto costaba producir y cuánto habría que cobrar, pero no cuánto se ganó de
verdad. Ahora responde **"¿cómo me fue este mes?"** con un selector de mes:

- **Registrar una venta**: cliente, fecha, cómo se pagó, y líneas editables (mismo patrón
  que los pedidos: producto o línea libre, cantidad, precio). Se puede **cargar desde un
  pedido abierto** — trae sus líneas y, si se marca la casilla, deja ese pedido como
  "entregado" al guardar.
- **Registrar un gasto**: fecha, categoría, monto, nota.
- **La regla dura, la que no se relaja**: el costo de cada línea (`costoUnitAlVender`) se
  congela con `Costos.calcular()` **en el momento de la venta** y se guarda tal cual. Si
  después sube el precio del filamento o cambian los gramos de un producto, la venta ya
  guardada **no se recalcula** — lo que se ganó en agosto no cambia.
- El resumen del mes: vendido, costo real de lo vendido, gastos, y lo que quedó
  (vendido − costo − gastos).

**Cómo sé que funciona.** Corrí el código real contra la semilla real, con `A.preguntar`
reemplazado por un stub que deja leer/resolver el modal a mano (el mismo límite que ya
tienen todos los modales de esta app en este entorno: no hay navegador para probar el árbol
de nodos, así que se prueba la lógica real de leer/guardar, no el dibujo):
- **El caso del "hecho cuando" del encargo, con el pedido real de LIDCAR** (`ped-2026-001`):
  lo cargué con "cargar desde un pedido", le puse precio a sus dos líneas (venían en blanco
  — dato real: **ninguna de las dos líneas de LIDCAR tiene un producto del catálogo
  vinculado todavía**, así que su costo da $0 hasta que alguien las vincule; lo dejo escrito
  abajo, no es un error de este código), guardé la venta con la casilla marcada, y **el
  pedido de LIDCAR pasó a "entregado"**.
- **La prueba dura de la regla de congelamiento**, con un producto real (`AY-3D-001`, costo
  real $2.543): armé una venta con una línea de ese producto, guardé, y **después** le subí
  500 g al producto (el costo actual subió a $11.453) — la venta ya guardada **siguió en
  $2.543**, sin recalcularse.
- Una venta libre sin producto (línea de texto a $5.000): el total sale del precio tipeado
  a mano, y el costo queda en $0 — no inventa un costo para algo que no está en el
  catálogo.
- Un gasto real ($12.000, categoría material) quedó guardado con sus datos.
- El resumen de setiembre-2026 sumó **3 ventas ($73.500 vendido, $2.543 de costo real) y
  1 gasto ($12.000)**, exactos, calculados por mí desde la base real y comparados contra lo
  que pintó la pantalla.
- Una venta puesta a propósito en enero-2026 **no apareció** en el resumen de setiembre, y
  **sí apareció** al cambiar el selector de mes a enero — el filtro por mes funciona.
- 27 de 27 verificaciones.

**Lo que NO pude verificar.** Todo lo visual — el modal de "nueva venta" con el selector de
pedido, el editor de líneas, los botones. Sin navegador acá, se probó la lógica de guardado
de punta a punta, no el dibujo. Es lo que le pido a Cowork.

**Lo que NO quedó.**
- **El pedido de LIDCAR no tiene sus líneas vinculadas a productos del catálogo** —son
  texto libre ("Llavero NFC rectangular…", "Llavero NFC redondo…") sin `productoId`. Hoy,
  registrar su venta da un costo real de $0 aunque se le ponga precio, porque no hay de
  dónde sacar el costo. Si esos llaveros ya existen como producto en el catálogo, hay que
  vincular esas líneas a mano (en Pedidos) para que la venta muestre la ganancia real —
  esto no es algo que el código pueda inventar.
- No hay edición ni borrado de una venta o gasto ya guardado desde una lista — se abre el
  mismo modal y se pisa por encima; no hay "deshacer".
- No hay gráfico ni comparación mes contra mes, solo el mes elegido. No estaba pedido.

**Versión.** `js/version.js` → `2.9.0`.

---

## 2026-09-02 · Pantalla «Pendientes» — la primera del menú · v2.8.0

**Qué cambió.** Nueva pestaña `js/vistas/pendientes.js`, primera del menú y pantalla por
defecto al abrir la app (antes era Productos), tal como pidió Farid en el «Encargo del
2-sep» de `SUPERVISION.md`: lo que abre para saber qué le toca hacer sin acordarse. Todo se
calcula **en vivo** desde la base — nada de listas escritas a mano — y cada bloque solo
aparece si tiene algo. Los seis bloques, en el orden pedido:

1. **Precios sin poner** — con el sugerido al lado y un botón "Aceptar" que lo pone sin
   abrir la ficha.
2. **Textiles sin horas de trabajo**.
3. **Falta separar bordado de costura** — campo nuevo `oficioConfirmado`, con botones
   "Es bordado" / "Es costura" que confirman sin abrir nada.
4. **Productos 3D sin gramos ni horas** — con un botón directo a Historial K2.
5. **Pedidos abiertos con líneas sin precio**.
6. **La nube** — agrega `Nube.visto()` en `js/nube.js` (expone si este equipo alguna vez
   terminó un ciclo de sincronización completo) para distinguir "apagada" de "configurada
   pero nunca sincronizó", con un botón a Ajustes o a "Sincronizar ahora" según el caso.

Cada fila de producto/pedido es clickeable y abre su ficha real (`Vistas.productos.abrir` /
`Vistas.pedidos.abrir`, los mismos modales que ya existían). Sin barras de progreso, sin
porcentajes de completitud, sin rojo ni signos de exclamación — siguiendo la regla explícita
del encargo de que un dato pendiente no es un error.

**Cómo sé que funciona.** Corrí el código real contra la semilla real (no una copia), con
`Vistas.productos`/`Vistas.pedidos`/`App` reemplazados por espías para comprobar que los
llaman con el id correcto, sin necesitar el navegador para eso:
- Los seis bloques dieron los números reales de la semilla: **24 precios sin poner, 16
  textiles sin horas, 16 sin confirmar bordado/costura, 9 productos 3D sin datos, 1 pedido
  con líneas sin precio**, y el bloque de la nube apareció como "apagada" (sin
  configuración en el sandbox) — total **67**, y la cabecera lo mostró igual.
- **"Aceptar" un sugerido:** en la semilla real los 24 sin precio también tienen el costo
  incompleto (comprobado explícitamente — no es un bug, es coherente: son los mismos que
  aparecen en los otros bloques). Completé `horasMano` a propósito en uno para darle un
  costo completo sin tocar el precio, y comprobé el camino completo: el conteo bajó de 67 a
  66 al completarse el dato, `aceptarSugerido()` puso el precio sugerido real ($17.800), y
  el conteo bajó a 65.
- **Confirmar oficio:** confirmé un producto como bordado (queda `oficio:'bordado'`,
  `oficioConfirmado:true`) y otro como costura (`oficio` cambia a `'costura'`,
  `oficioConfirmado:true`) — los dos desaparecieron del bloque 3 y el conteo bajó
  exactamente en 2, sin arrastrar cambios en ningún otro bloque.
- **La nube:** simulé que SÍ está configurada pero nunca terminó un ciclo
  (`Nube.configurado()` true, `Nube.visto()` false) — el mensaje cambia al de "nunca
  sincronizó" y aparece "Sincronizar ahora", que llama a `App.conectarNube()`. Con
  `visto()` en true, el bloque desaparece.
- 27 de 27 verificaciones. Re-corrí también los tests de v2.5.0/v2.6.1 (10/10 y 6/6) para
  confirmar que agregar `Nube.visto()` no rompió nada de lo que ya usaba `nube.js`.

**Lo que NO pude verificar.** Todo lo visual: cómo se ve la pantalla, si el orden de lectura
es cómodo, si los botones "Aceptar"/"Es bordado"/"Es costura" quedan claros al lado del
nombre del producto sin abrir nada. Es exactamente lo que le pido a Cowork que mire.

**Lo que NO quedó.**
- No hay una forma de "posponer" o silenciar un pendiente sin resolverlo — cada vez que se
  abre la pestaña se ven todos. No estaba pedido y no lo agregué sin que se pida.
- El bloque de la nube usa `Nube.visto()`, que es un estado **por equipo** (vive en el
  `localStorage` de ese navegador), no un estado real de "la nube tiene una copia". Si
  alguien sincronizó una vez en el teléfono, el PC lo va a seguir marcando "nunca
  sincronizó" hasta que sincronice él también — es correcto para lo que pide el encargo
  ("este equipo"), pero vale la pena que quede escrito.

**Versión.** `js/version.js` → `2.8.0`.

---

## 2026-09-02 · La app usa la identidad de marca de verdad · v2.7.0

**Qué cambió.** Cowork pidió (`SUPERVISION.md`) que la app use `../branding/identidad-de-marca.md`
(rediseño "Acuarela Silvestre", jun-2026) en vez de quedarse con lo que había antes de que
ese manual existiera. Leí el manual y `branding/README.md` completos antes de tocar nada.
Tres cosas:

1. **Tipografía.** `branding/README.md` decía Poppins; el manual (posterior) dice Outfit.
   Le pregunté a Farid cuál manda — **eligió el manual** — y corregí `branding/README.md`
   para que ya no contradiga (de paso completé ahí la tabla de colores, que también le
   faltaban azul niebla y mostaza, el mismo hueco que tenía la app). La app cambió
   `index.html`/`css/app.css`: ya no carga Barlow, carga Outfit (cuerpo, `--texto-fuente` y
   `--num-fuente`) y Sacramento, solo para el logotipo "Ayünka" del menú
   (`--fuente-logo`, nueva clase `.marca-nombre`). La sublínea "STUDIO" pasó a Outfit Bold
   (antes 500, ahora 700, ya tenía el interletrado que pide el manual). **No agregué el
   lema** ("Bordamos. Creamos. Siempre con cariño.") en Cormorant Garamond Italic — no hay
   ningún lugar en la app hoy donde ese texto exista; dejo la fuente sin cargar hasta que
   haga falta un sitio real para mostrarlo, en vez de inventar una sección nueva.
2. **Los dos colores que faltaban.** `--niebla: #9FB6C4` y `--mostaza: #D2A14E` en
   `css/app.css` — la paleta ya tiene las 8. Les di un uso real (no quedan declarados y
   sin usar, como ya le pasaba a `--rosa` en este mismo archivo): un hilo de 3px bajo el
   nombre del menú, degradado coral→niebla→mostaza, el mismo trío de colores que el manual
   describe para el ramillete del logo (§5).
3. **El logo.** No aparecía por ningún lado — el menú decía "Ayünka STUDIO" en texto plano.
   Copié `logo-mono-borda-crea.svg` (monocromo carbón) a `img/` del repo —no lo enlacé desde
   `../branding/`, la app tiene que poder abrirse sola— y lo puse arriba del nombre en el
   menú lateral (`.marca-logo`, 36×36px).

No toqué ningún texto de pantalla (el manual pide cuidar el tono, pero no cambié ninguna
frase en esta pasada) ni ninguna mayúscula fuera de la sublínea, que es justo donde el
manual las permite.

**Cómo sé que funciona.** Sin navegador acá, no pude ver el resultado pintado — lo que sí
comprobé contra los archivos reales:
- El SVG copiado a `img/` abre y cierra como `<svg>...</svg>` válido, 200.677 bytes, mismo
  contenido que `../branding/logo-mono-borda-crea.svg`.
- `css/app.css` sigue con las llaves balanceadas (141 reglas) después de los cambios — un
  error de sintaxis ahí rompe toda la hoja de estilos, no solo una regla.
- `index.html` ya no carga Barlow en ningún lado, y sí carga Outfit y Sacramento desde
  Google Fonts. `--texto-fuente` y `--fuente-logo` apuntan a las fuentes correctas.
- Las clases que usa el HTML nuevo (`.marca-logo`, `.marca-nombre`) existen en `app.css`, y
  `--niebla`/`--mostaza` están con el hex exacto del manual.
- `index.html` referencia el logo como `./img/logo-mono-borda-crea.svg` (local), no como
  `../branding/...` — se puede abrir sola.
- 8 de 8 verificaciones sobre los archivos reales.

**Lo que NO pude verificar.** Todo lo visual de verdad: si Sacramento dibuja bien la "ü" de
"Ayünka" (los caracteres con diéresis a veces fallan en fuentes script decorativas), si el
tamaño del logo (36px) se ve bien al lado del nombre, si el degradado de 3px se nota o es
demasiado sutil, y si el conjunto se sigue sintiendo "cálido y tranquilo, no técnico" como
pide el propio `app.css`. Esto es exactamente lo que le pido a Cowork que mire en el
navegador.

**Lo que NO quedó.**
- El lema de la marca no aparece en ningún lado de la app (ver punto 1).
- No revisé si hay mayúsculas fuera de lugar en el resto de la app (fuera de lo que toqué
  en el menú) — el manual lo pide, pero no era parte de este pedido y tocar texto de otras
  pantallas sin que se pida es más cambio del que corresponde a esta pasada.
- `--rosa` (`#E39B96`) sigue declarado y sin usar en `css/app.css`, igual que antes de este
  cambio — no es parte de lo que pidió Cowork esta vez.

**Necesito que Cowork lo verifique en un navegador de verdad**, en particular la "ü" en
Sacramento y que el conjunto no se sienta frío ni técnico.

**Versión.** `js/version.js` → `2.7.0`.

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
