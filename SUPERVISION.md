# Quién escribe el código, y quién supervisa

> Escrito el 2-sep-2026, después de que dos instancias trabajaran sobre el mismo repo al
> mismo tiempo y Farid lo parara: *«hay 2 instancias escribiendo código, detente, ya te dije
> que tú eres supervisor, no escribas código. Harán que se crucen el código entre lo tuyo y
> VS Code»*. Tenía razón. Esto queda escrito para que no vuelva a pasar.

## La regla

**Solo VS Code escribe en este repo.** Una sola mano en el código.

La sesión de Cowork (la del navegador, la que habla con la impresora y con Firebase)
**supervisa**: investiga, verifica desde afuera, mide, revisa, y **especifica**. Si necesita
un cambio, lo describe acá o en la bitácora. No lo escribe.

Por qué importa, más allá de los conflictos de git: dos manos escribiendo producen dos
criterios. La app ya se desordenó una vez por eso.

## Qué hace cada uno

| | VS Code (Claude Code) | Cowork (supervisor) |
|---|---|---|
| Escribir código | **Sí, solo él** | No |
| `git commit` y `push` en este repo | **Sí, solo él** | No |
| Investigar en la web, comparar productos | Puede | **Sí** |
| Hablar con la K2, con Firebase, con el navegador | No | **Sí** |
| Verificar desde afuera que algo quedó cerrado | Puede | **Sí** |
| Escribir la bitácora del negocio (`../sesion-log.md`) | No | **Sí** |
| `BITACORA.md` de este repo | **Sí** | Lee y comenta |
| Decidir el alcance con Farid | — | **Sí** |

Si el supervisor necesita tocar algo del repo, **pide**. Si VS Code necesita que alguien
compruebe algo desde afuera —que las reglas de Firestore estén publicadas de verdad, que la
impresora responda, que un 3MF traiga lo que se cree— **pide**.

## Lo que está pendiente de mi lado, como especificación

Lo siguiente está diseñado y probado en un entorno aparte, contra los datos reales de Farid,
pero **no está en este repo**. Impleméntalo tú.

### La impresora · `js/impresora.js` + `js/vistas/impresora.js`

**La idea la puso Farid y cambia el enfoque:** no es un monitor en vivo. *«Hay información
que se puede recuperar desde ella aunque no esté en línea todo el tiempo.»* La K2 guarda su
propio historial; se va a buscar cuando se pueda y se recupera todo lo que hizo mientras
nadie miraba.

Y ahí está lo que de verdad vale: ese historial trae **los gramos y las horas reales de cada
trabajo**. Son exactamente los dos números que la cotización pide a mano y que no se pueden
deducir de la geometría. **La propia máquina es la fuente de verdad de su costo.**

Qué tiene que hacer:

1. **Traer el historial**, por dos caminos que terminan en lo mismo:
   - `GET http://<ip>:4408/server/history/list?limit=500` si la impresora está al alcance.
   - Soltando un archivo JSON, si no. Acepta el formato crudo de Moonraker **y** el de
     `../historial-impresion.json`, que ya está resumido.
2. **Normalizar los dos formatos** a `{archivo, veces, horasReales, gramosReales}`.
   De Moonraker: `print_duration` en segundos y `filament_used` en milímetros —
   **PLA de 1,75 mm son 2,98 g/m**, esa constante ya está usada en el archivo de Farid.
3. **Emparejar con el catálogo por nombre de archivo.** La raíz se saca quitando `.gcode`,
   el sufijo `_PLA_2h41m34s`, `_gcode_plate_1` y la extensión del modelo. Primero contra
   `archivoOrigen` del producto; si no, por parecido de nombre, marcando cuál fue.
4. **Proponer, no aplicar.** Muestra la tabla y que una persona apruebe. La app no rellena
   datos a espaldas de nadie. Al aplicar, deja constancia en `origenDatos`.
5. **Comparar la tasa de fallas real con la de Ajustes** y ofrecer usar la real de un click.

**Lo que hay que saber, y no es negociable:** una página servida por `https` **no puede**
llamar al `http` de la K2 — el navegador lo bloquea y no hay forma de saltarlo desde el
navegador. Dilo en pantalla en vez de fallar en silencio. La solución de fondo es al revés y
está en `PLAN.md` Fase 3: un agente en la red de la impresora que **empuje** a Firestore.

**Cómo se comprueba que funciona** (yo lo corrí así, con datos reales):

- Con `../historial-impresion.json` los totales tienen que dar **160 h impresas, 154 trabajos,
  4,0 kg, 593 g perdidos y 12,9% de fallas**.
- Aviso esperado: en Ajustes la tasa está en 10% y la real es 12,9%. Esa diferencia se va
  derecho a todos los costos.
- **Prueba del emparejador:** bórrale los gramos y las horas a tres productos que sí tengan
  `archivoOrigen` —`AY-3D-001`, `AY-3D-002`, `AY-3D-004`— y vuelve a importar. Tienen que
  recuperarse exactos: **75,2 g / 2,515 h**, **13,1 g / 0,658 h** y **63,2 g / 2,21 h**,
  los tres marcados «por archivo».
- Ojo con un detalle que a mí se me pasó: al guardar el resumen hay que **repintar** la
  pantalla, o los totales de arriba no aparecen hasta cambiar de vista.

**El dato que justifica todo esto:** en ese historial hay **100 piezas** con gramos y horas
reales. Solo **11** llegaron al catálogo. Las otras 89 llevan un mes ahí sin usarse, y son
las que hacen confiable la cola de producción y las cotizaciones.

## Lo demás sigue igual

`COMO-REPORTAR.md` manda sobre cómo reportar y sobre qué espera Farid. `PLAN.md` tiene las
fases. `BITACORA.md` es tuya: una entrada por sesión, arriba, con el «cómo sé que funciona»
obligatorio.

---

## Revisión del 2-sep · v2.5.0 · APROBADA

Corrí la app real —una copia traída del disco, en un navegador de verdad— y comprobé lo que
había pedido en la especificación. **Pasa todo:**

- Nueve pestañas, **cero errores en consola**.
- El motor de costos no se movió: `AY-3D-001` sigue dando costo **$2.543**, sugerido **$8.900**
  contra los $8.500 que se cobran.
- El historial de la K2 da los números exactos: **154 trabajos, 159,8 h, 4,0 kg, 593 g
  perdidos, 12,9% de fallas** contra el 10% de Ajustes.
- La prueba dura: borré los datos de `AY-3D-001`, `AY-3D-002` y `AY-3D-004`, solté el
  historial, apliqué, y volvieron **exactos** (75,2 g / 2,515 h · 13,1 g / 0,658 h ·
  63,2 g / 2,21 h) con `origenDatos: historial-k2`. La tasa quedó en 12,9%.

**Dos cosas quedaron mejor que la especificación** y así se quedan: separar las coincidencias
por confianza («se pueden actualizar · 11», «parecidas, revisar antes · 1», «sin producto en
el catálogo · 88»), y mostrar esos 88 archivos huérfanos — es todo lo que la impresora hizo y
nunca llegó al catálogo.

### Un cambio pedido · decidido por Farid el 2-sep

Hoy se proponen para actualizar **también los productos que ya tienen gramos y horas**, no
solo los que están en blanco. Con los datos actuales da igual, pero si alguien ajusta un
valor a mano, aplicar se lo sobrescribe sin avisar.

**Farid lo decidió así: manda la máquina, pero el cambio se ve.** Seguir proponiendo todos
—los que están en blanco y los que ya tienen datos— y, cuando el valor vaya a cambiar, que
la fila lo diga con las dos cifras:

> *Regla de radios — tenía 75,2 g / 2,515 h · la impresora dice 79,1 g / 2,64 h*

Detalles de cómo hacerlo:

- Solo se marca como cambio si la diferencia es real: **más de 0,5 g o más de 1 minuto**.
  Si no, es ruido y no vale la pena mostrarlo.
- Las que cambian van agrupadas aparte de las que están en blanco, con su propio contador:
  «se completan · N» y «cambian un valor que ya estaba · N». No mezcladas.
- El botón de aplicar todo dice cuántas de cada tipo lleva.
- Al aplicar, `origenDatos` guarda también qué valor tenía antes, para poder volver atrás.

**El porqué, y es lo que no hay que perder de vista:** cambiar en silencio un dato que una
persona puso a mano es la misma familia de error que se comió tres semanas de trabajo el
1-sep. La máquina puede tener la razón; igual tiene que decir qué está cambiando.

---

## Lo que sigue, en orden

Medido en la semilla al 2-sep, no estimado:

1. **Los 24 precios que faltan.** De 36 productos, 12 tienen precio. Es la tarea de mayor
   retorno del negocio: sin precios no hay catálogo de WhatsApp, y «¿cuánto vale?» es la
   primera pregunta de toda consulta.
2. **Las horas de trabajo de los 16 textiles.** Ninguno tiene `horasMano`, así que ninguno
   se puede costear y la app —bien— se niega a sugerirles precio. Basta con cronometrar uno
   de cada tipo.
3. **Separar bordado de costura.** Los 16 entraron como `bordado` (×2,55); hay que revisar
   cuáles son costura (×2). **Es criterio de Farid, no técnico: pregúntale.**
4. **Los 9 productos 3D sin gramos ni horas.** Los que estaban en el historial ya se
   completaron; para el resto hay que laminar una vez. Mientras falten, la cola calcula de
   menos y su «alcanza / no alcanza» no es confiable.
5. **Fase 2 completa** (`PLAN.md`): publicar la app, cerrar Firestore **y comprobarlo desde
   afuera con el `curl`**, y forzar un conflicto a propósito para ver el diálogo de
   comparación. Si aparece y las cifras cuadran, la parte que causó la pérdida de datos
   queda cerrada de verdad.

El 1 y el 2 son de Farid, no de código: la app ya está lista para recibirlos.

## Cómo pedirme una revisión

Termina, commitea, escribe la entrada en `BITACORA.md` con su «cómo sé que funciona», y
avísale a Farid. Yo traigo una copia, corro las comprobaciones y dejo el resultado acá abajo.
No toco el repo.

---

## Revisión del 2-sep · v2.6.0 · aprobada, con un bug

El cambio pedido está bien hecho y lo comprobé en un navegador de verdad —la parte que la
bitácora decía no haber podido ver—. Reproduje el mismo caso: desajusté `AY-3D-001` a
80 g / 2,6 h (diferencia real) y `AY-3D-004` a 63,4 g / 2,211 h (bajo el umbral). Todo
coincide con lo reportado:

- Secciones: «Piezas que se pueden actualizar · 11», «Parecidas, revisar antes · 1»,
  «Sin producto en el catálogo · 88».
- Subsecciones: **«Cambian un valor que ya estaba · 1»** y **«Se completan · 1»**.
- La fila muestra la columna *Tenía*: **80 g / 2.6 h** junto a **75.2 / 2.515**.
- El botón dice literalmente **«Aplicar las 11 (1 cambian, 10 sin cambios)»**.
- `AY-3D-004`, bajo el umbral, cae en «10 más ya tienen estos mismos datos — sin cambios».
- Cero errores en consola.

### El bug · aplicar dos veces borra el valor original

`datosAnteriores` se sobrescribe en cada aplicación. Al aplicar la fila individual y después
«Aplicar las 11», `AY-3D-001` quedó con:

```
datosAnteriores: { gramos: 75.2, horas: 2.515 }   ← el valor NUEVO, no el que tenía
```

Debería seguir siendo `{ gramos: 80, horas: 2.6 }`. Es fácil de hacer sin querer —dos clicks
seguidos— y **destruye justamente lo que la función existe para proteger.**

**Arreglo:** escribir `datosAnteriores` **solo si el producto no lo tiene ya**, o guardar la
primera versión y no pisarla. Y si el valor entrante es igual al que ya está, no tocar nada.

---

## La identidad de marca · pedido de Farid el 2-sep

*«En algún momento se diseñó la marca de Ayünka y lo necesario. Que la web use esa identidad
de marca.»* Existe y es específica: **`../branding/identidad-de-marca.md`** (rediseño
"Acuarela Silvestre", junio 2026) más `../branding/README.md`. **Léelos antes de tocar el
CSS.** Lo que la app no está cumpliendo hoy:

**1. La tipografía está mal.** La app usa Barlow, que no es de la marca. Según el manual:

| Rol | Fuente | Dónde va en la app |
|---|---|---|
| Marca / logotipo | **Sacramento** | La palabra «Ayünka» del menú |
| Sublínea / handle | **Outfit Bold**, mayúsculas con interletrado | «STUDIO», etiquetas |
| Cuerpo y labels | **Outfit** | Todo el texto de la app |
| Tagline | **Cormorant Garamond Italic** | «Bordamos. Creamos. Siempre con cariño.» |

Todas están en Google Fonts. **Ojo con una contradicción:** `branding/README.md` dice
Poppins, pero es la tabla vieja — el manual del rediseño de junio dice Outfit y es
posterior. **Pregúntale a Farid cuál manda antes de cambiar.** Yo iría con el manual.

**2. Faltan dos colores de la paleta.** La app tiene seis de los ocho:

- **Azul niebla `#9FB6C4`** — secundario frío
- **Mostaza suave `#D2A14E`** — acento pequeño

Los otros seis ya están y coinciden con el manual.

**3. No aparece el logo por ninguna parte.** El menú dice «Ayünka STUDIO» en texto plano.
Los archivos están en `../branding/`: `logo-principal-borda-crea.png` (color),
`logo-mono-borda-crea.svg` (monocromo carbón, vectorial). **Cópialos a `img/` del repo** —
no los enlaces desde fuera, la app tiene que poder abrirse sola. El monocromo en carbón es
el que mejor va en el menú.

**4. Cuida el tono al escribir textos de pantalla.** El manual lo define: cercano, cálido,
primera persona plural («armamos tu pedido»), frases cortas. La app ya está bastante en ese
registro; no la vuelvas fría al tocar el CSS.

**Y lo de siempre, que ya costó una vez:** Ayünka es bordado y costura hecho a mano. Nada de
mayúsculas en títulos, menú ni botones — solo en etiquetas chicas, como dice el manual para
la sublínea.

---

## Investigación · la API de Creality Cloud · 2-sep

Farid mandó `https://www.crealitycloud.com/es/flowslicer/device` y avisó que ahí **sale la K2
aunque esté apagada**. La revisé con su sesión abierta, mirando el tráfico de red.

### Lo que se encontró · corrige lo que dije ayer

**Sí existe una API REST en Creality Cloud.** Lo que dije en
`../.planning/QUE-COMPRAR-QUE-CONSTRUIR.md` —«no tiene API»— es cierto solo para una API
*pública y documentada*. Hay una interna, y la propia página la usa:

```
POST https://www.crealitycloud.com/api/rest/print/cluster/ctl/getAvailableDevices
POST https://www.crealitycloud.com/api/rest/print/cluster/devices/pollState
POST https://www.crealitycloud.com/api/cxy/v2/printer3mf/list
```

Las tres responden 200 desde el navegador. `pollState` es el estado en vivo, `getAvailableDevices`
la lista de impresoras, y `printer3mf/list` los archivos subidos a la nube.

### El obstáculo real, y es el que decide

**No basta con la sesión del navegador.** Llamé a las dos primeras desde la propia página, con
sus cookies, y responden:

```json
{"result":null,"code":4,"msg":"invalid login","reqId":null}
```

La aplicación manda **además un token en una cabecera**. Para que Ayünka Studio use este
camino, algo tendría que guardar ese token: es una credencial, caduca, y hay que renovarla.

Dato técnico secundario: la página es una **app Flutter** dibujada en canvas (canvaskit), no
HTML. Automatizarla por la interfaz no es opción — no hay elementos que leer ni clickear.

### Qué hacer con esto · mi recomendación, la decisión es de Farid

**El agente local sigue siendo el camino principal** (`PLAN.md`, Fase 3). Razón: no depende de
que Creality no cambie nada. Un endpoint interno y sin documentar se puede romper cualquier
martes, y se rompe **en silencio** — que es el peor modo de fallar para algo de lo que
dependen los avisos de producción.

**La API de la nube queda anotada como plan B**, con sus condiciones sobre la mesa:

| | Agente local | API de Creality Cloud |
|---|---|---|
| Funciona si la K2 cambia de red | hay que reconfigurarlo | **sí, es https desde cualquier lado** |
| Depende de terceros | no | **sí, y sin contrato** |
| Necesita guardar una credencial | no | **sí, un token que caduca** |
| Se puede romper sin avisar | no | **sí** |

**Lo que sí confirma esta investigación, y vale por sí solo:** la nube de Creality guarda el
último estado de la impresora aunque esté apagada. Refuerza la idea de Farid —la información
se recupera después, no hay que estar vigilando— y respalda el diseño de la pestaña de
Historial que ya está hecha.

**Si Farid decide ir por la nube:** el token lo administra él, nunca entra al repositorio, y
el código tiene que avisar en pantalla cuando la API responda distinto de lo esperado, en vez
de mostrar datos vacíos como si todo estuviera bien.

---

# Encargo del 2-sep · lo que sigue

Farid pidió dos cosas: que la app **le muestre destacado qué datos faltan**, para irlos
llenando cuando tenga tiempo, y que quede **listo el pendiente de programación**.

---

## 1 · Pantalla «Pendientes» · lo primero a construir

Una pestaña nueva, **la primera del menú**, con el número de pendientes al lado. Es lo que
Farid abre para saber qué le toca hacer sin tener que acordarse.

**Todo se calcula en vivo desde la base. Nada de listas escritas a mano** — si se arregla algo,
desaparece solo. Una lista de pendientes que hay que mantener a mano se abandona en dos
semanas.

### Qué muestra, en este orden

Cada bloque: **qué falta**, **cuántos**, **qué se rompe mientras falte**, y la lista de fichas
en las que hay que hacerlo — cada una clickeable, que abra su ficha directo.

**1. Precios sin poner** — `productos` con `precio` nulo.
> *Sin precio no se puede cargar el catálogo de WhatsApp, y «¿cuánto vale?» es la primera
> pregunta de toda consulta.*
Los que ya tienen el costo completo traen **el sugerido al lado y un botón para aceptarlo de
un click, sin abrir la ficha.** Eso convierte una tarde de trabajo en diez minutos.

**2. Textiles sin horas de trabajo** — `oficio` distinto de `3d` y sin `horasMano`.
> *Sin las horas no se puede costear y la app no sugiere precio: sale «—» en toda la fila.*
Basta cronometrar **uno de cada tipo**, no los dieciséis. Dilo así en pantalla.

**3. Falta separar bordado de costura** — los textiles marcados `bordado` sin confirmar.
> *Van con márgenes distintos: bordado ×2,55 y costura ×2. Si están todos como bordado, los
> de costura salen 27% caros.*
Necesita un campo nuevo, `oficioConfirmado: true`, y en la lista un par de botones —**«es
bordado» / «es costura»**— que lo marquen sin abrir nada. Mientras no esté confirmado, aparece
acá; al confirmarlo, desaparece.

**4. Productos 3D sin gramos ni horas** — `oficio: '3d'` sin `gramos` o sin `horas`.
> *Mientras falten, la cola de producción calcula de menos y su «alcanza / no alcanza» no es
> confiable.*
Con un aviso útil: **«revisa primero Historial K2 — puede que la impresora ya los tenga»**, y
un enlace a esa pestaña. Es el atajo real.

**5. Pedidos abiertos con líneas sin precio** — mientras existan, el total y el saldo del
pedido salen en blanco.

**6. La nube** — solo si aplica: sincronización apagada, o configurada pero **sin subir nunca**.
> *Ese fue exactamente el estado que precedió a la pérdida de datos del 1-sep.*

### Cómo NO hacerlo

- **Nada de barras de progreso ni porcentajes de completitud.** Esto no es un juego; es una
  lista de trabajo. Un «catálogo 67% completo» no le dice a nadie qué hacer.
- **Nada de rojo ni signos de exclamación.** Que falte un precio no es un error: es trabajo
  pendiente. El tono del manual de marca es cálido, no de alarma.
- **Si no falta nada, dilo y ya** — sin confeti. Un «no hay nada pendiente» tranquilo.
- **No la conviertas en un tablero.** Si un bloque no tiene nada, no se muestra.

---

## 2 · Lo que falta programar, en orden

El criterio del orden es **qué desbloquea plata**, no qué es más entretenido.

### A · Ventas y gastos · el hueco más grande

Las colecciones `ventas` y `gastos` existen en la base, están vacías y **no tienen pantalla**.
Hoy la app sabe cuánto cuesta producir y cuánto habría que cobrar, pero **no sabe cuánto se
ganó**. Para algo que quiere ser el ERP del negocio, eso es el agujero de fondo.

Mínimo que sirve: registrar una venta (fecha, cliente, qué productos, cuánto se cobró, cómo se
pagó) y un gasto (fecha, categoría, monto, nota). Y una pantalla que responda **«¿cómo me fue
este mes?»**: vendido, costo real de lo vendido, gastos, y lo que quedó.

Cuidado con lo de siempre: el costo de una venta se congela al momento de venderla
(`costoAlVender`), no se recalcula después. Si sube el filamento, lo que ganaste en agosto
no cambia.

> **Hecho cuando:** Farid registra la entrega de LIDCAR y la app le dice cuánto ganó con ese
> pedido, con el costo real de producirlo.

### B · Que Studio sea la fuente única de precios

No hay exportación a Meta ni a WhatsApp — lo busqué, no existe. Hoy el catálogo se sigue
editando en tres lados, que es **exactamente lo que desordenó la versión anterior**.

El precio se pone en Studio y de ahí **salen** el CSV de Meta y el XLSX de WhatsApp. El
formato del CSV ya existe y hay que respetarlo: `../catalogo/catalogo-meta-importar.csv`
(id, title, description, availability, condition, price, link, image_link, brand).

> **Hecho cuando:** cambiar un precio y regenerar los dos archivos toma un minuto, y nadie
> vuelve a editarlos a mano.

### C · Publicar la app y cerrar la nube de verdad

`PLAN.md` Fase 2, sin saltarse nada:
1. Publicar en un hosting con `https` — GitHub Pages sobre este repo alcanza.
2. Poner el correo real en `firestore.rules` y **publicarlas en la consola**.
3. **Comprobarlo desde afuera con el `curl` del README: tiene que dar 403.**
4. **Forzar un conflicto a propósito** y ver el diálogo de comparación con las dos fechas.

El punto 4 no es opcional: hasta que ese diálogo no se vea funcionando con datos reales, la
parte que se comió tres semanas **no está cerrada, está escrita**.

> **Hecho cuando:** Farid edita un precio en el teléfono, desde la calle, y lo ve en el PC.

### D · La impresora en vivo

Hoy está el pasado (Historial K2), falta el presente. Un agente en la red de la K2 que lea
`ws://<ip>:9999` y **empuje** el estado a Firestore, más el aviso al teléfono cuando entra en
pausa — que es lo que le costó tiempo el 1-sep.

Antes de empezar, lee la investigación de la API de Creality Cloud más arriba: hay un plan B,
pero exige guardar un token y puede romperse sin avisar. **El agente local es el camino.**

### E · Subir fotos

Supabase solo aparece en `config.js`; no está implementado. Las fotos actuales son URLs que
ya existían. Sin esto, un producto nuevo no puede tener foto.

---

## Lo que no hay que hacer todavía

- Facturación electrónica — nunca. SII gratuito hasta que el volumen justifique otra cosa.
- Inventario de filamento por báscula — si hace falta, se adopta **Spoolman**, no se escribe.
- Multiusuario, permisos, roles. Es un operador.

---

## Antes de nada

Hay **dos commits sin subir** a GitHub. El trabajo que solo vive en el PC es el que se pierde.

---

# Revisión del 3-sep · v2.8.0 → v2.12.0 · y la auditoría de 40 sesiones

Corrida sobre una copia del disco, en un navegador de verdad (Chromium, service worker
apagado). Las once vistas pintan sin una sola excepción de JavaScript. Lo que sigue está
separado en dos: **lo que hay que arreglar de lo recién hecho** y **lo que nunca llegó a
este repo**, que es lo que Farid siente que falta y tiene razón.

## Lo que quedó verificado

- **Encargo A · Ventas y gastos — funciona y el costo queda congelado.** Venta de prueba:
  2 × Regla de radios a $8.500 = **$17.000**, costo real **$5.086**, ganancia **$11.914**.
  Se triplicó `precioPLA` después de guardar y el `costoAlVender` **no se movió**
  (5086,0019 antes y después). Es exactamente lo que se pidió.
- **Encargo B · exportaciones — salen archivos de verdad.** CSV de Meta 12.500 bytes con la
  cabecera correcta (`id,title,description,availability,condition,price,link,image_link,brand`)
  y XLSX de WhatsApp 30.327 bytes.
- **Pendientes** existe, es la primera pestaña, cuenta en vivo y no tiene barras de progreso
  ni porcentajes. El botón «Aceptar $X» está bien programado (`pendientes.js:88`).

## Lo que hay que arreglar · en orden

### 1 · Pendientes dice tres veces lo mismo · `js/vistas/pendientes.js`
Marca **67 pendientes** y el trabajo real son **26 productos**. Los mismos 16 textiles
aparecen en el bloque 1 («sin precio»), en el 2 («sin horas») y en el 3 («bordado o
costura»); los mismos 9 productos 3D aparecen en el bloque 1 y en el 4. La pantalla mide
cuatro pantallazos de alto repitiendo los mismos nombres.

Peor: **el bloque 1 no tiene un solo botón «Aceptar»**, porque ninguno de los 24 productos
sin precio tiene sugerido — 15 dicen «faltan las horas de trabajo» y 9 «faltan los gramos y
las horas». O sea el bloque más importante hoy es una copia de los bloques 2 y 4, sin nada
que apretar.

Arreglo: **un producto aparece una sola vez, en el bloque de lo primero que le falta.** El
precio no es un pendiente aparte — es la consecuencia de los otros. Deja el bloque de
precios solo con los que **sí** tienen sugerido (los que se resuelven de un click) y saca de
ahí a los que ya salen más abajo. El contador debe contar productos distintos, no filas.

### 2 · Se puede guardar una venta vacía de $0 · `js/vistas/finanzas.js`
Abrir «Nueva venta», elegir cliente y apretar Guardar **sin agregar ninguna línea** guarda
una venta con `total: 0`, `costoAlVender: 0` y `lineas: []`, sin decir nada. Queda en la
tabla como «LIDCAR · $0 · $0 · $0». Una venta sin líneas no es una venta: no dejar guardar,
y decir por qué.

### 3 · Los modales no se cierran con Escape ni clicando fuera · `js/ui.js`
Se abre «Nuevo gasto», se aprieta **Escape** y el modal sigue ahí; se hace clic en el fondo
oscuro y sigue ahí. El único modo de salir es el botón. Es de tres líneas y se nota todos
los días.

### 4 · El pedido de LIDCAR es invisible para la cola y para las ventas
Las dos líneas del pedido real de `datos/semilla.json` tienen `productoId` ausente, así que
`Costos.horasPedido` devuelve **0** y «Cargar desde un pedido abierto» arma una venta de
**$0**. Hay que enlazar esas dos líneas a `AY-B2B-001` (o a los llaveros que correspondan)
en la semilla, y que la pantalla avise cuando una línea de pedido no apunta a ningún
producto — hoy falla en silencio.

### 5 · Ningún producto tiene rollo asignado · `js/vistas/productos.js`
`filamentoId` está **null en los 36 productos** y el formulario no tiene el campo, aunque
`costos.js:20` sí lo usa si existe. Resultado: todos los costos se calculan con el PLA
genérico. El mismo formulario tampoco tiene el campo de **costo extra** (`extraCosto`), que
`costos.js:83` sí suma: sin él la caja de luz con LED no se puede costear (sesión 18).

### 6 · Nada descuenta stock
`gramosQuedan` del filamento y `stock` del producto solo cambian escribiéndolos a mano.
Vender no descuenta nada. En la app vieja sí se descontaba (`js/app.js:573,576,616,619`).
Falta el libro de movimientos que el MILESTONE pedía en la Fase 1.

### 7 · No hay dónde poner las llaves, así que la nube y las fotos no funcionan
`js/config.js` tiene `firebase.apiKey: ''` y `supabase: { url:'', clave:'' }`. Ajustes tiene
un campo para pegar el JSON de Firebase, pero **no tiene ninguno para Supabase**: la subida
de fotos del encargo E no puede funcionar en ningún equipo. O se agrega el campo en Ajustes,
o los valores públicos van en `config.js` — pero hoy está en tierra de nadie.

## Lo que nunca llegó a este repo

Esto es lo que Farid pidió a lo largo de 40 sesiones y quedó afuera cuando el repo partió de
cero. Del repo viejo (`ayunka-studio/js`, 8.465 líneas) **no se portaron 4.030 líneas** que
el MILESTONE-ERP daba por parte del ERP. Ordenado por lo que él pidió más veces y por lo que
bloquea vender.

1. **El generador de perfiles de impresión — 2.237 líneas, 9 archivos.**
   `PROJECT.md` lo llama textualmente **prioridad 1 de Farid**; `REQUIREMENTS.md` y
   `ROADMAP.md` le dedican seis fases y 22 planes (sesiones 30 a 37). No existe nada:
   ni `perfil.js`, ni `perfil-medidas.js`, ni `perfil-reglas.js`, ni el exportador
   `.creality_printer`. Es el trabajo de más sesiones seguidas de todo el proyecto.
2. **El editor 3D de verdad — `design3d.js`, 1.100 líneas.** Hoy «Personalizados 3D» son
   presets con campos de texto (`disenos3d.js:6-9` lo admite). Falta el lienzo, los ocho
   tiradores, el giro, las 39 figuras, elegir tipografía, grabado y calado, y **abrir los 19
   diseños guardados**: `disenos3d.js:40` solo los cuenta.
3. **La cotización formal al cliente — `pdf.js`, 176 líneas.** La colección `cotizaciones`
   está declarada en `db.js:17` y **ningún archivo la usa**; `abonoPct`,
   `validezCotizacionDias` e `iva` están en la semilla y nadie los lee. `cotizar.js` calcula
   un precio pero no emite nada que se le pueda mandar a un cliente (sesión 9).
4. **Envíos / Chilexpress.** Sesión 13 completa, y sigue en los pendientes del log. No hay
   peso ni medidas por producto, ni dirección ni costo de envío en el pedido.
5. **Los textos de WhatsApp — `whatsapp.js`, 148 líneas.** Bienvenida, ausencia, cinco
   respuestas rápidas y el contador de caracteres (sesión 8).
6. **«Aprobar una impresión y crear el producto» — `impresiones.js`, 244 líneas.** Hoy
   `vistas/impresora.js:123` lista los 88 archivos huérfanos y no deja hacer nada con ellos.
7. **Cotizar al revés y el semáforo de mercado.** Sesión 9: escribir lo que se quiere cobrar
   y ver qué queda y en cuánto sale la hora, más el 🔴🟡🟢 contra los precios chilenos.
8. **Verificador de G-code y armado de bandeja.** `d3d-3mf.js:170` escribe un solo `<item>`
   con transformación identidad: no arma bandejas, y no escribe `negative_part` ni
   `custom_gcode_per_layer` (el lector sí los entiende, `lector3mf.js:154`). Sin eso, un
   redondo puede volver a salir macizo como en la sesión 36.
9. **La velocidad de la máquina de bordar (puntadas/min)** que la sesión 9 agregó para
   calcular la hora efectiva. Hoy `costos.js:75` cobra bordado como horas × $4.000.
10. **Pagos parciales, dirección y fecha de entrega real en el pedido.** Hoy hay un solo
    `abono`; no se puede registrar un segundo.

Fuera del ERP por decisión ya tomada: redes sociales (`rrss.js`, `instagram.js`,
`nuevo-post.js`, 708 líneas). Eso no es deuda.

## Cómo seguir

Primero los seis arreglos de arriba, que son horas, no días — sobre todo el 1, el 2 y el 4,
que se ven cada vez que se abre la app. Después Farid decide qué se rescata del repo viejo y
en qué orden; **el generador de perfiles es la pieza grande y es decisión suya**, no del
código. Ojo: rescatar no es reescribir — esos archivos existen y funcionaban.

Como siempre: entrega, commitea, escribe la entrada en `BITACORA.md` con su «cómo sé que
funciona», y avísale a Farid. Yo traigo una copia, corro las comprobaciones y dejo el
resultado acá abajo. No toco el repo.

---

# Supabase · lo que se hizo el 3-sep y lo que falta programar

## Lo que estaba mal, y ya no

El bucket `archivos` del proyecto `ncuvdpydwnepbysadoux` tenía **una sola política**,
llamada `ayunka archivos`, con comando **ALL** y roles **anon, authenticated**, con
`USING` y `WITH CHECK` iguales a `bucket_id = 'archivos'`. Traducido: **cualquiera con la
clave anónima podía subir, pisar y borrar los 145 archivos** — las 36 fotos del catálogo
entre ellas. Y esa clave es pública por diseño: viaja dentro de la app, a cualquier
navegador que la abra.

Es el mismo error del 1 de septiembre con Firestore, en otra casa: la puerta estaba abierta
y nadie lo había mirado desde afuera.

Se reemplazó por cuatro políticas, ejecutadas en el editor SQL del proyecto:

    drop policy if exists "ayunka archivos" on storage.objects;
    create policy "archivos leer"       ... for select to anon, authenticated using (bucket_id = 'archivos');
    create policy "archivos subir"      ... for insert to authenticated with check (bucket_id = 'archivos');
    create policy "archivos reemplazar" ... for update to authenticated using (...) with check (...);
    create policy "archivos borrar"     ... for delete to authenticated using (bucket_id = 'archivos');

**Comprobado, no supuesto.** `pg_policies` devuelve las cuatro con los roles correctos, y
las **36 fotos del catálogo siguen respondiendo 200** desde fuera, sin ninguna clave — que
es lo que necesitan el catálogo de Meta y el de WhatsApp.

Queda pendiente **de Farid**, y no lo hace nadie más: crear el usuario en
**Authentication → Users → Add user** (hoy el proyecto tiene cero usuarios). Correo y
contraseña los pone él; acá no se manejan contraseñas.

## Lo que hay que programar · `js/supabase.js` y `js/vistas/ajustes.js`

Con las políticas nuevas, `subirFoto` **ya no puede funcionar** como está: manda
`Authorization: Bearer <clave anónima>`, y esa clave ahora es el rol `anon`, que perdió el
permiso de escribir. Hay que iniciar sesión primero y mandar el **token del usuario**.

### 1 · Iniciar sesión antes de subir

    POST {url}/auth/v1/token?grant_type=password
    apikey: {clave anónima}
    Content-Type: application/json
    { "email": correo, "password": clave }
    → { access_token, refresh_token, expires_in }

Y después, en la subida, cambiar el encabezado:

    Authorization: 'Bearer ' + access_token      // no la clave anónima
    apikey: clave anónima                         // este sí se sigue mandando

Guarda el `access_token` en memoria con su hora de vencimiento y renueva cuando falte poco
(`grant_type=refresh_token`). **El `refresh_token` no va a `localStorage`** junto al resto
de la base: si se sincroniza a Firestore, viaja la sesión completa.

### 2 · Dónde viven la URL y la clave
Hoy `js/config.js` las tiene **vacías** y **Ajustes no tiene ningún campo para ponerlas**:
por eso el encargo E está escrito y no funciona en ningún equipo. Sigue el mismo patrón que
ya usa Firebase en Ajustes — un bloque «Fotos y archivos» con URL, clave anónima y bucket,
guardado en `localStorage`, fuera de git. La URL es
`https://ncuvdpydwnepbysadoux.supabase.co` y el bucket es `archivos`.

Reusa el **mismo correo y la misma contraseña** que ya se escriben para la nube: es la misma
persona y el mismo negocio, y dos pares de credenciales distintos se olvidan.

### 3 · Respeta la convención de nombres que ya existe
`nombreSeguro` + `catalogo/<SKU>.<ext>` está **bien** y calza exactamente con lo que hay
subido (`catalogo/AY-3D-001.jpg` … `catalogo/AY-B2B-001.jpg`, 36 de 36 responden 200). No
la cambies: si cambia, las fotos del catálogo de Meta se rompen todas de una vez.

### 4 · Lo que se perdió del `supa.js` viejo
El repo anterior tenía `removeUrl(url)` — borrar una foto desde la app, sacando la ruta de
la URL pública. No se portó. Con las políticas nuevas, borrar exige estar autenticado, que
es justo lo correcto. Vale la pena rescatarlo cuando haya galería de fotos.

### 5 · Cómo sé que funciona
No sirve «el código está escrito». Sirve esto, en este orden:

1. Farid crea el usuario en Supabase y lo escribe en Ajustes.
2. Subir una foto a un producto desde la app y que la URL que devuelve **responda 200**
   en otro navegador, sin sesión.
3. Repetir la subida del mismo producto: debe **reemplazar**, no fallar (necesita la
   política de `update`, por eso está).
4. Con la app **sin sesión iniciada**, intentar subir: debe fallar con
   `new row violates row-level security policy`. Si sube, la puerta sigue abierta.

Escribe el paso 4 en `BITACORA.md` con la respuesta textual. Ese es el paso que el 1-sep no
se hizo, y por eso la base estuvo abierta dos meses.

---

# Revisión del 3-sep · v2.13.0 → v2.15.0

Misma prueba de siempre: copia del disco, navegador de verdad, apretar en vez de leer.
Las once vistas pintan sin una sola excepción.

## Aprobado

- **Pendientes ya no repite.** De **67 a 29**, 28 filas y 28 productos distintos, cero
  repetidos. Y aparecieron los **2 botones «Aceptar»** que antes no existían, porque ahora
  el bloque de precios solo muestra a los que sí tienen sugerido. La cascada funciona: al
  darle horas a un textil, desaparece de «sin horas» y aparece solo entonces en «falta
  separar bordado de costura». Es exactamente el comportamiento que se pidió.
- **La venta vacía no se guarda.** Me equivoqué al reportarlo la primera vez: miré
  `DB.ventas` en crudo, que conserva la baja lógica como toda esta app. Lo que vale es
  `Datos.activos('ventas')`, y ahí sigue en 0, y la pantalla dice «Ventas · 0».
  El aviso es claro y el modal se cierra. Bien resuelto.
- **Escape y clic fuera cierran los modales.** Los dos, comprobados.
- **El pedido de LIDCAR ya existe de verdad.** Las dos líneas apuntan a `AY-B2B-002` y
  `AY-B2B-003`, y `Costos.horasPedido` devuelve **32,45 h** en vez de 0. La cola lo ve.
- **La ficha de producto tiene lo que faltaba:** Rollo, Costo extra, «Qué es ese extra» y
  Stock.
- **Supabase quedó bien escrito.** Inicia sesión con `/auth/v1/token?grant_type=password`,
  manda `apikey` y el `access_token` como Bearer, renueva con el refresh, y la sesión vive
  **solo en memoria** — no entra a `localStorage` ni viaja a Firestore. Reusa el correo y la
  clave de Sincronización. Ajustes tiene por fin URL, clave anónima y bucket. Los rechazos
  se comprobaron: sin correo dice qué falta y dónde; un `.txt` se rechaza por tipo.

## Dos cosas que hay que arreglar

### 1 · El stock se va a negativo sin decir nada · `js/movimientos.js`
Vendí 3 unidades de `AY-3D-002`, que tenía stock 0, y quedó en **−3**. `registrar()` suma el
cambio y no mira el resultado; el movimiento queda anotado como `antes 0 · después −3` y la
app no dice nada.

Para este negocio, stock 0 es lo normal: casi todo se imprime o se cose contra pedido. Un
−3 no es un dato, es una pregunta sin respuesta. Dos salidas razonables, elige:
**(a)** solo descontar stock a los productos que de verdad lo llevan, con una casilla
«llevo stock de este» en la ficha, y no tocar el resto; o **(b)** dejar el negativo pero
mostrarlo con su nombre — «3 por producir» — y que aparezca en Pendientes. Lo que no puede
quedar es un −3 pelado en la ficha.

### 2 · El descuento de filamento no corre para ningún producto real
El código está bien, pero solo descuenta si `prod.filamentoId` existe, y hoy hay **0 de 38
productos con rollo asignado — 0 de los 22 que son 3D**. El campo nuevo trae
«(genérico, según el material)» por defecto, o sea `null`. Resultado: la parte que de verdad
es plata —los gramos que salen del rollo— **no se descuenta nunca**, y no hay forma de
notarlo mirando la pantalla.

Y no se arregla pidiéndole a Farid que abra 22 fichas. Hazlo así: si el producto no tiene
rollo, cae al **rollo por defecto de su material** — el único PLA con saldo, o el que se
elija una vez en Ajustes. Que la ficha sirva para la excepción (este llavero salió del
arcoíris), no para lo normal.

## Un detalle
Cuando la llamada a Supabase falla en la red, el mensaje que llega a la pantalla es
`Failed to fetch`. Envuélvela y di algo que se entienda: «no pude hablar con Supabase —
revisa la URL del proyecto o tu conexión».

## Todavía sin probar contra el servidor real
La subida de fotos no se ha ejecutado nunca contra Supabase: falta que Farid cree el usuario
en Authentication (el proyecto tiene cero) y pegue la clave en Ajustes. Cuando lo haga, la
prueba que cierra el tema sigue siendo la del encargo anterior, y va en `BITACORA.md` con la
respuesta textual: **con la app sin sesión, subir debe fallar con
`new row violates row-level security policy`**. Si sube, la puerta sigue abierta.

---

# Revisión del 3-sep · v2.16.0

## Los dos arreglos, medidos

**El piso del stock: bien resuelto por el lado correcto.** Se eligió la salida (a) —una
casilla «Este producto lleva stock» en la ficha— y funciona: vendí 3 de `AY-3D-002`, que no
la lleva, y su stock **siguió en 0**, sin movimiento y sin ruido. Que la mayoría del
catálogo se haga contra pedido dejó de ser un problema.

**El descuento de filamento: el mecanismo funciona, exacto.** Elegí un rollo por defecto y
vendí 3 unidades de 13,1 g: el rollo pasó de **1000 g a 960,7 g**, que es exactamente
1000 − 39,3. `filamentoDe` cae bien al por defecto, y el selector de Ajustes existe y lista
los rollos con su saldo.

## Pero hay dos cosas abiertas

### 1 · El descuento está apagado y nadie lo dice
`filamentoPorDefecto` solo resuelve solo cuando hay **un** rollo de ese material con saldo.
Hoy hay **seis PLA**, así que devuelve `null`, el selector de Ajustes está en «(automático)»
y **no se descuenta un solo gramo**. Es un clic de Farid, no un bug — pero es exactamente
la forma de falla que llevamos tres días persiguiendo: algo escrito, correcto, y apagado en
silencio.

Que Pendientes lo diga. Un bloque más: **«El filamento no se está descontando»**, con el
porqué en una línea (seis rollos de PLA, ninguno elegido) y el botón que lleva a Ajustes.
Desaparece solo cuando se elija uno, como todos los demás.

### 2 · El stock sigue yendo a negativo, solo que ahora en menos casos
Un producto que **sí** lleva stock aún baja sin piso: puse stock 2, vendí 5, quedó en
**−3**. Y ese −3 no aparece en ninguna parte — Pendientes no lo menciona y la fila de
Productos no muestra el stock. Elegiste la opción (a), así que acá el negativo sí significa
algo real («vendí más de lo que tenía»), pero un número que nadie ve no es un aviso.

O lo muestras con su nombre en Pendientes —«3 por producir»— o no dejas que baje de 0 y
avisas al guardar la venta. Cualquiera de las dos, pero que se vea.

## Supabase

El usuario ya existe: **`farid+ayunka-acceso@gmail.com`**, proveedor Email, el mismo correo
de la sincronización — que es justo lo que el código necesita, porque reusa esas
credenciales. El mensaje de error feo también se arregló: ahora dice «no pude hablar con
Supabase — revisa la URL del proyecto o tu conexión».

Falta el último tramo, y no lo puede hacer nadie desde acá: **pegar la URL y la clave
anónima en Ajustes → Fotos y archivos** (la clave sale de Supabase → Project Settings →
API Keys → `anon` `public`; la URL es `https://ncuvdpydwnepbysadoux.supabase.co` y el
bucket `archivos`). Con eso, las dos pruebas que cierran el tema, textuales en `BITACORA.md`:

1. Subir una foto a un producto y que la URL que devuelve **responda 200 en otro navegador,
   sin sesión**.
2. Con la app **sin las credenciales de acceso puestas**, intentar subir: tiene que fallar.
   Si sube, la puerta sigue abierta.

---

# El botón «Traer de la impresora» no falla: se cuelga · 3-sep

Farid puso la IP, apretó el botón y **no pasó nada**. Reproducido en su propio Chrome, en
`https://farid77cl.github.io/ayunka-studio-2/`, con la K2 encendida y respondiendo:

    document.getElementById('imp-ip').value = '192.168.100.90:4408';
    Vistas.impresora.traerDeIp();
    // 33 segundos después: #imp-resultado sigue vacío. Ni error, ni card, nada.

**Por qué.** El `fetch` a `http://…` desde una página `https` **no rechaza**: se queda
colgado. El navegador intenta subir la llamada a `https`, la K2 no habla `https`, y la
promesa nunca se resuelve. Todo el manejo de error de `traerDeIp()` está en un `catch` que
**nunca se ejecuta**, así que el texto que explica el problema —que está bien escrito, y
dice justo lo que hay que hacer— no se muestra jamás.

Es el peor tipo de falla que puede tener esta app: la que no dice nada. Un error visible se
arregla en dos minutos; un botón mudo cuesta media tarde.

**Tres cosas, en este orden:**

1. **No hagas la llamada si la página va por `https`.** `location.protocol === 'https:'` se
   sabe antes de intentar nada. Muestra el aviso de entrada, junto al botón, con las dos
   salidas reales: soltar el archivo del historial, o abrir la app por `http` en el PC.
2. **Ponle plazo a todo `fetch` que salga a la red local.** `AbortController` con 8 segundos.
   Que colgarse sea un mensaje, no un silencio. Vale para `traerDeIp` y para cualquier
   llamada futura al agente.
3. **Guarda la IP.** El campo `#imp-ip` sale vacío cada vez que se repinta la vista: lo que
   escribió se perdió. Va al `localStorage` como el resto de la configuración.

## De paso, hay historial nuevo y cambia un número importante

Se bajó el historial completo desde Moonraker (`192.168.100.90:4408`) y quedó en
`impresora/historial-impresion.json` — **199 trabajos**, del 16 de junio al 1 de septiembre.
El que tenía la app traía 154.

    trabajos      199        (151 completados, 48 no)
    horas         297,7 h
    material      6,54 kg
    perdido       37,8 h y 797 g  ≈ $11.958 de filamento

**La tasa de fallas ya no es 12,9%.** En crudo da **24,1%**, pero ese número está inflado:
de los 48 no completados, **16 se cancelaron antes de los 10 minutos**, y esos casi siempre
son una decisión —se vio que iba mal, se cambió de idea— no una falla. Contando solo los
que se cayeron después de comprometer tiempo de verdad, la tasa es **16,1%**.

Ajustes tiene **10%**. Pasar a 16% sube todos los costos 3D un **7%**, y eso hoy se está
regalando. Pero la decisión es de Farid, y por eso la pantalla debe mostrar **los dos
números con su explicación**, no proponer uno solo: «24,1% contando todo · 16,1% sin los
cancelados en los primeros 10 minutos». Que elija sabiendo qué está eligiendo.

Los cuatro trabajos que más material se llevaron al fallar, para que se vean con nombre:
`poop_chute` 182 g, `Object_1` 129 g, y **`Borrador de llavero` dos veces, 92 g y 52 g** —
esos dos son del trabajo de LIDCAR y valen como aprendizaje, no como desperdicio.

Detalle menor: **2 trabajos traen fecha anterior a 2020** — el reloj de la K2 estuvo sin
sincronizar. No rompe nada, pero si alguna vez se ordena por fecha, aparecen en 1970.

---

# Personalizados 3D · la pantalla no muestra casi nada de lo que ya sabe hacer

Farid, hoy: *«en el llavero solo puedo cambiar el nombre y el teléfono? qué hay de la forma?
o si quiero importar una imagen? o más copias, y todo lo de la definición y el planchado?»*
Y después: *«lo mismo para la letra con nombre — la idea de esa sección es ayudar a diseñar,
dar opciones»*.

Tiene razón, y la buena noticia es que **casi todo ya está en el navegador**. Lo comprobé en
la app publicada, en consola:

- **`D3DFormas` tiene las 39 figuras cargadas**: rrect, círculo, óvalo, hexágono, triángulo,
  corazón, estrella, flor, nube, luna, gota, hoja, rayo, sol, huella, oso, conejo, globo,
  moño, mariposa, arcoíris, etiqueta, hueso, carrete, botón, lápiz, libro, manzana, mochila,
  regla, pizarra, birrete, campana, bus, cohete, paleta, avión, nota, tijeras.
- **La vectorización de imágenes también está portada**: `trazarImagen`, `mascaraDe`,
  `contornosDeMascara`. El preset **«Llavero con imagen» existe y está en la lista**, pero
  no hay ningún botón para subir la imagen.
- **Cada capa ya tiene** `x, y, z, rot, escalaX, escalaY, altura, modo, prof, fuente, mm,
  align, espaciado, interlinea`. Y la base tiene `figura, params (redondeo), ancho, alto,
  grosor, color, margen`. Más `argolla`, `montaje`, `led`, `bed` a nivel de proyecto.

Y esto es lo que la pantalla muestra hoy para el llavero:

    campos: ["AYÜNKA", "+56 9 8542 1490"]
    selects: []

Dos cajas de texto. Nada más. Para «Letra con nombre», lo mismo: la base es una **L de
90 × 90 × 35 mm en Poppins** y el nombre va en **Pacifico 32 mm en relieve de 1 mm** — y no
se puede tocar ni el tamaño, ni el grosor, ni la tipografía, ni si el nombre va en relieve o
grabado, ni cuán hondo.

**El motor está entero. Lo que falta es la pantalla.** No hay que portar `design3d.js` para
arreglar esto — eso viene después, y es otra conversación.

## Lo que tiene que mostrar la ficha de un personalizado

Ordenado por lo que más se usa. Todo esto ya existe en el proyecto; es exponerlo, no
inventarlo.

**1 · La forma.** Un selector con las 39 figuras, **con su dibujo, no con su nombre** —
«mariposa» en una lista de texto no le sirve a nadie. Cuadrícula de miniaturas, agrupadas.
Para el llavero cambia la base; para el recuerdo, los adornos.

**2 · La medida y el grosor.** Ancho, alto y grosor en mm, con el valor del preset ya
puesto. Que se vea el volumen resultante mientras se mueve — es lo que decide los gramos.

**3 · La tipografía.** El catálogo de fuentes ya está y viene agrupado (palo seco, cursiva…).
Selector con **la palabra escrita en cada tipografía**, no el nombre de la fuente.

**4 · Relieve o grabado, y cuán hondo.** `modo` y `prof` por capa. Es la diferencia entre
que se lea y que no, y hoy está fijo en el código.

**5 · Subir una imagen.** El botón que falta para «Llavero con imagen», y para cualquier
capa. Con los cuatro controles que tenía el editor viejo, que son los que hacen que un logo
salga bien: **umbral, invertir, detalle y «solo la figura mayor»**. Sin eso, un logo con
sombras sale convertido en manchas.

**6 · Cuántas copias, y si caben.** Un campo «copias» y la respuesta antes de generar:
cuántas caben en la bandeja de la K2 y cuánto demora la bandeja completa. Los números de
LIDCAR ya los tenemos medidos (`.planning/CARGA-INICIAL.md`): máximo 20 rectangulares o 15
redondos por bandeja, 19,66 min por llavero. Hoy se genera **una** pieza y el resto se
arma a mano en el laminador.

**7 · La argolla.** `argolla` está en el proyecto y no se ve: si lleva o no, diámetro, y
en qué borde.

**8 · Ver antes de generar.** Ya se carga three.js. Que se vea la pieza girando, y la
bandeja con las copias puestas.

## La definición y el planchado son otra cosa, y esa sí falta de verdad

Lo del planchado (`ironing_type`, `ironing_speed`, `ironing_flow`, `top_surface_speed`,
`top_surface_line_width`) y la altura de capa vive en **`perfil-reglas.js`** del repo
anterior, junto con los otros ocho archivos `perfil-*.js` — **2.237 líneas que no se
portaron**. Es lo que `PROJECT.md` llama prioridad 1 de Farid y lo que ocupó las sesiones
30 a 37.

O sea: el diseño y el perfil de impresión son dos piezas distintas y hoy falta una entera.
Mientras no esté, que la ficha al menos **diga con qué perfil hay que imprimir esto** —
«llavero con texto fino: capa 0,12 y planchado en la cara de arriba»— aunque el perfil
todavía se elija a mano en Creality Print. Un texto no es el generador, pero evita reimprimir.

## Cómo no hacerlo

- **No pongas los 20 controles a la vez.** Lo primero que se ve son la forma, la medida y los
  textos. El resto va detrás de un «Más opciones» que se abre y se queda abierto.
- **Nada de listas de nombres para cosas visuales.** Figuras y tipografías se eligen viéndolas.
- **No inventes gramos ni horas**, igual que en Cotizar: el diseño se guarda como producto
  sin precio hasta que alguien lo mida. Eso ya está bien y no hay que tocarlo.
- **No empieces portando `design3d.js`.** El editor libre (arrastrar, tiradores, girar) es un
  proyecto aparte. Con los ocho puntos de arriba, el 90% de lo que Farid hace todas las
  semanas se resuelve sin editor.

## Los seis presets, uno por uno · comprobado en la app publicada

Para cada uno: lo que la pantalla deja tocar, contra lo que la pieza realmente tiene dentro.

| Preset | En pantalla | Lo que la pieza tiene y no se ve |
|---|---|---|
| **Llavero publicitario** | 2 cajas: `AYÜNKA`, `+56 9 8542 1490` | rrect 65 × 28 × **3 mm**, redondeo 0,18, Poppins 9 y 4,5 mm, relieve 1 mm, **argolla Ø4,5 fijada en x = −26** |
| **Llavero con imagen** | **nada** — dice literal *«Este diseño no tiene texto para cambiar — se genera tal cual»* | círculo 40 × 40 × 3, argolla arriba, y **cero forma de subir la imagen**. Promete «sube un logo y se vuelve 3D» y entrega un disco liso |
| **Letra con nombre** | 2 cajas: `L`, `Lorena` | la letra es de 90 × 90 × **35 mm**; el nombre va en Pacifico **32 mm, relieve 1 mm**. Ni tamaño, ni grosor, ni tipografía, ni relieve/grabado |
| **Letrero con nombre** | 1 caja: `Lorena` | rrect 160 × 60 × 3, Dancing Script 34 mm, y **`montaje` activo** — los agujeros para colgarlo existen y no se pueden mover ni quitar |
| **Caja de luz LED** | 1 caja: `AYÜNKA` | 180 × 90 × 2,4 y **cinco medidas críticas invisibles**: muro 3, alto 18, fondo 2, **holgura 0,3**, cable 6. Si la tira LED no calza, no hay dónde tocarlo |
| **Recuerdo de nacimiento** | 3 cajas: `María`, `27·05·2026`, `3,4 kg · 51 cm` | nube 150 × 105 × 3, y **dos capas de figura —estrella y luna— que no se pueden cambiar, mover ni sacar** |
| **Desde cero** | **no aparece en la lista** | existe en el motor (60 × 30 × 3, sin capas); está filtrado porque sin editor no habría con qué llenarlo |

### Tres cosas que salen de mirarlos juntos

**1 · «Llavero con imagen» está roto, no incompleto.** Es el único que ofrece algo que no
puede cumplir. Mientras no tenga el botón de subir imagen, **sácalo de la lista** — un preset
que miente cuesta más que uno que falta. Ponlo de vuelta el día que suba imágenes.

**2 · Los campos no tienen nombre: se rotulan con su propio valor.** En «Recuerdo de
nacimiento» hay tres cajas que dicen `María`, `27·05·2026` y `3,4 kg · 51 cm`. Si Farid las
borra para escribir las suyas, quedan tres cajas vacías **sin ninguna indicación de cuál es
cuál**. Y la capa **ya tiene un campo `nombre`** que nadie está usando como etiqueta. Eso son
diez minutos y arregla los seis presets de una vez.

**3 · Cada preset esconde justo el número que decide si la pieza sirve.** No es que falten
opciones en general — falta, en cada uno, *la que importa*: el **grosor** en el llavero (3 mm
es lo que hace que se doble o no), los **35 mm** de la letra (lo que decide si se para sola),
la **holgura de 0,3** en la caja de luz (si la tira LED entra), la **posición de la argolla**
(si el texto queda descentrado). Si hay que elegir qué exponer primero, es eso: **una medida
por preset, la que rompe la pieza**, antes que veinte controles genéricos.
