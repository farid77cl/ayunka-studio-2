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
