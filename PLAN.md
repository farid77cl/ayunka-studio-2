# Plan de Ayünka Studio 2

> Escrito el 1-sep-2026 al entregar el repo. **Este documento reemplaza a
> `../.planning/MILESTONE-ERP.md`**, que planificaba arreglar la app anterior y ya no
> aplica: se partió de cero.
>
> Los números de abajo salieron de contar la semilla, no de estimar.

**Valor central:** que Farid produzca y venda sin pelear con el software.

---

## Dónde está hoy

| | |
|---|---|
| Productos cargados | **36**, todos con SKU y categoría |
| Con precio de venta | **12** · faltan **24** |
| Con costo calculable | **11** (los 3D con gramos y horas de G-code real) |
| Textiles | **16**, todos entraron como `bordado` |
| 3D sin gramos ni horas | **9** |
| Filamentos, clientes, pedidos | 6 · 2 · 1 (LIDCAR) |

Funciona: catálogo, costos de los dos oficios, filamentos, clientes, pedidos con abono y
saldo, y la cola que dice si el tiempo alcanza. No funciona todavía: editar líneas de pedido,
la impresora, cotizar desde 3MF y subir fotos.

---

## Fase 1 · Que se pueda usar de verdad · esta semana

Es la fase que convierte esto de "una app bonita" en la herramienta con la que se cotiza.

**1.1 Editar las líneas de un pedido.** Hoy se ven y se calculan, pero no hay pantalla para
agregar, cambiar o quitar una. Es lo primero que se choca al usarlo. Una línea es
`{productoId, descripcion, cantidad, precioUnit}`; el selector de producto debería traer el
precio y dejar cambiarlo.

**1.2 Completar los 9 productos 3D sin gramos ni horas.** `AY-3D-003`, `005`, `010`, `011`,
`012`, `017`, `018`, `019` y `AY-B2B-001`. Los números salen de laminar el STL o de un G-code
existente. **Mientras falten, la cola de producción calcula de menos y su "alcanza / no
alcanza" no es confiable** — que es peor que no tenerlo.

**1.3 Separar bordado de costura.** Los 16 textiles entraron todos como `bordado` (×2,55).
Hay que revisar uno por uno cuáles son costura (×2). El campo es `oficio`. Es una decisión de
Farid, no técnica.

**1.4 Poner las horas de trabajo de los textiles.** Sin ellas su costo es solo empaque y
fallas, y la app —correctamente— se niega a sugerir precio. Basta con cronometrar uno de cada
tipo.

**1.5 Poner los 24 precios.** Cuando 1.2 a 1.4 estén, cada ficha trae el sugerido y se acepta
con un click. **Esta es la tarea de mayor retorno del negocio entero:** sin precios no hay
catálogo de WhatsApp, y sin catálogo la respuesta a "¿cuánto vale?" —la primera pregunta de
toda consulta— sigue dependiendo de que Farid conteste a mano.

> **Hecho cuando:** se puede armar un pedido nuevo completo, con sus líneas y precios, y la
> cola dice cuántos días toma. Sin tocar un Excel.

---

## Fase 2 · Que viva fuera del PC

**2.1 Publicar la app.** GitHub Pages sobre este repo. Queda con `https`, se instala en el
teléfono, y se acaba el problema de que los datos vivan presos en un origen `file://`.

**2.2 Cerrar Firestore y comprobarlo.** Poner el correo real en `firestore.rules`,
**publicarlas en la consola**, y verificar desde afuera que devuelve **403**. El comando está
en el `README.md`. Cambiar el archivo no publica nada — esto ya costó caro una vez.

**2.3 Conectar la sincronización y probar el conflicto a propósito.** Configurar en el PC,
subir, configurar en el teléfono, y forzar una discrepancia para ver el diálogo de comparación.
Si aparece y las cifras cuadran, la parte que se comió tres semanas está cerrada.

**2.4 Respaldo semanal.** Un aviso para descargar el `.json` y guardarlo fuera de la casa.
Nada automático todavía: lo importante es que exista una copia que no dependa de un navegador.

> **Hecho cuando:** Farid edita un precio en el teléfono desde la calle y lo ve en el PC.

---

## Fase 3 · La impresora, sin que la app la llame

El patrón es al revés del intuitivo y no es negociable: una página `https` **no puede** llamar
al `http` de la K2, y desde fuera de la casa no hay ruta.

**3.1 El agente.** Un proceso chico en la misma red que la impresora lee
`ws://<ip>:9999` —sin root: da capa actual y total, progreso, tiempo restante, temperaturas y
el CFS— y **empuja** el estado a Firestore cada pocos segundos. Sale hacia afuera: no hay que
abrir puertos.

**3.2 Órdenes al revés.** La app escribe en una colección de pendientes y el agente la vacía:
pausar, reanudar, cancelar.

**3.3 El aviso de la pausa del chip.** Es lo que hoy vive en una ventana de PowerShell. Cuando
el estado pasa a `paused`, aviso al teléfono. La regla medida: **leer el `;TIME_ELAPSED` que
va antes del `PAUSE` en el G-code, no contar capas** — contar capas da mal.

> **Ojo:** el DietPi (`192.168.1.200`) y la K2 (`192.168.100.90`) están en redes distintas.
> Mientras no se junten, el agente tiene que correr en el PC, que es justo lo que se quería
> evitar. Juntar las redes es configuración, no compra.

> **Hecho cuando:** desde el teléfono, en la calle, se ve en qué capa va la impresora.

---

## Fase 4 · Cotizar desde un 3MF

Es lo que convierte el B2B en producto en vez de un favor artesanal.

**4.1 Laminar sin abrir nada.** Un 3MF de proyecto **no trae peso ni tiempo**: eso vive en
`slice_info.config`, que solo existe en un archivo ya laminado. OrcaSlicer en modo CLI
(`--slice 0 --load-settings --export-slicedata`) lo devuelve. Creality Print es un derivado de
OrcaSlicer, así que los perfiles de la K2 sirven.

**4.2 De los gramos y las horas al precio.** Ya está: es el mismo motor de costos de la
Fase 1, con el margen del oficio 3D.

**4.3 Tramos por cantidad.** El costo fijo por bandeja pesa distinto según cuántas piezas
entran. Está medido: **la primera capa se lleva ~30% del tiempo** y la última ~17%.

**4.4 La receta de llaveros NFC.** Ya está escrita y verificada en la skill
`llavero-nfc-desde-3mf`, con las medidas, la pausa y las trampas del formato 3MF. No hay que
redescubrirla: costó un día entero.

> **Hecho cuando:** llega un logo por WhatsApp y sale una cotización con plazo, sin abrir
> Creality Print a mano.

---

## Fase 4-bis · Rescatar el diseñador 3D · lo más grande que falta

Los 7 SKUs de «Personalizados 3D» —letra con nombre, tag de mascota, marco de foto, letrero,
llavero de cubos, topper de lápiz, caja de luz— se hacen con un generador que **ya existe en
el repo anterior**: `design3d.js`, `d3d-formas.js`, `d3d-fuentes.js`, `d3d-build.js` y
`d3d-3mf.js`. Los 19 diseños guardados en la semilla salieron de ahí el 12 de agosto.

**Se porta, no se reescribe.** Costó días y funciona. Lo que hay que hacer es engancharlo al
modelo de datos nuevo (la colección `disenos3d` ya está y con los datos adentro) y a la
cotización: de un nombre a un STL, y de ahí al costo y al precio sin salir de la app.

Es lo que convierte «personalizado» de un trabajo a mano en un producto que se vende solo.

> **Hecho cuando:** un cliente pide un llavero con un nombre y sale el archivo, el precio y
> el plazo sin abrir otra herramienta.

---

## Fase 5 · Que Studio sea la fuente única

Hoy el catálogo y los precios se editan en tres lugares distintos: la app, el CSV de Meta y el
XLSX de WhatsApp. **Mientras eso no se cierre, cualquier orden se vuelve a desordenar solo.**

El precio se pone en Studio y de ahí **salen** —exportados, no editados a mano— el CSV para
Meta y el XLSX para WhatsApp. Los otros dos dejan de tocarse.

> **Hecho cuando:** cambiar un precio en Studio y regenerar los dos archivos toma un minuto.

---

## Fuera de alcance, a propósito

- **Facturación electrónica.** No se construye nunca. Empezar con la facturación gratuita del
  SII y evaluar un servicio cuando el volumen lo justifique.
- **Inventario de filamento con báscula o NFC.** Si algún día se necesita, **Spoolman** es
  gratis, autoalojable y se integra con Moonraker. Adoptarlo, no escribirlo.
- **Granja de impresión.** Con una máquina no aplica. Si llega una segunda, **Printago** da un
  slot gratis para siempre con API documentada.
- **El diseñador 3D de la versión anterior.** Los 19 diseños están guardados en la semilla,
  pero la pantalla para editarlos no se portó. Si se echa de menos, se rescata del repo viejo;
  no se reescribe.

---

## El orden, en una línea

**1.5 antes que todo lo demás** — sin precios, lo otro es infraestructura sin negocio. Después
la Fase 2, que es lo que hace que sirva desde el teléfono. La 3 y la 4 son las que dan tiempo
y plata nuevos; la 5 es la que evita que el desorden vuelva.
