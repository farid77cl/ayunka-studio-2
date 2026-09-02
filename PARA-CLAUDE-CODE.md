# Para Claude Code · dónde quedó esto y qué sigue

> Escrito el 1-sep-2026, al entregar el repo. Lee el `README.md` primero: ahí están las ocho
> decisiones de diseño y **por qué** existe cada una. No son preferencias de estilo, son
> respuestas a errores concretos que costaron datos el mismo día en que se escribió esto.

## Qué es esto

Repo **nuevo**, no un rediseño del anterior. `ayunka-studio` (el viejo) sigue existiendo y no
se tocó. Este vive en `negocio/ayunka-studio-2/` y es **su propio repo git** — `negocio` lo
tiene en su `.gitignore` a propósito, para que no se repita el lío de repos anidados
rastreando los mismos archivos dos veces.

Vanilla JS, sin compilador ni dependencias. `python3 -m http.server 8765` y listo.

## Lo que NO hay que romper

Cinco cosas se hicieron así por una razón. Si una te estorba, lee primero el README:

1. **`js/nube.js` nunca resuelve un conflicto solo.** Si te ves escribiendo
   `if (a > b) subir; else bajar;`, para. Ese `else` se comió tres semanas de trabajo el
   1-sep. El diálogo de comparación está en `js/app.js → preguntarConflicto`.
2. **Un documento por ficha en Firestore.** No volver a meter la base entera en un solo
   documento: con dos dispositivos, el último que graba pisa al otro.
3. **`sw.js` pide el código por red primero.** No lo cambies a caché-primero por
   rendimiento. La versión anterior sirvió código viejo durante horas por eso.
4. **`js/version.js` es el único lugar donde vive la versión.** Súbela en cada cambio de
   `js/` o `css/`. Se muestra abajo a la izquierda para poder verificarla en tres segundos.
5. **Un cálculo incompleto devuelve `completo:false` y `falta`, no un número.** No pongas
   ceros por defecto para que "se vea algo": una alarma falsa enseña a ignorar las alarmas.

## Lo que falta, en orden de valor

1. **Editar las líneas de un pedido.** Hoy se ven y se calculan pero no hay pantalla para
   agregar o quitar una. Es lo que más se nota al usarlo.
2. **Poner los 24 precios que faltan.** El sugerido ya sale calculado cuando el costo está
   completo; es un click desde la ficha. Probablemente la tarea de mayor retorno del negocio.
3. **Separar bordado de costura.** Los 15 productos textiles entraron todos como `bordado`
   (margen ×2,55). Hay que revisar cuáles son costura, que va ×2. El campo es `oficio`.
4. **Cargar gramos y horas de los 3D que no los traen.** Sin eso la cola de producción
   calcula de menos y el "alcanza / no alcanza" no es confiable.
5. **El agente de la impresora.** No al revés: una página `https` no puede llamar al `http`
   de la K2. Un proceso en la misma red lee `ws://<ip>:9999` —sin root, da capa, progreso,
   temperaturas y control— y **empuja** el estado a Firestore. La app lo lee como cualquier
   otra ficha. Detalle y fuentes en `../.planning/QUE-COMPRAR-QUE-CONSTRUIR.md`.
6. **Cotizar desde un 3MF.** Un 3MF de proyecto **no trae peso ni tiempo**: hay que laminarlo.
   OrcaSlicer en modo CLI (`--slice 0 --export-slicedata`) devuelve `slice_info.config` con
   gramos y segundos. Creality Print es un derivado de OrcaSlicer, así que los perfiles de la
   K2 sirven.
7. **Subir fotos.** Las que hay apuntan a las URL de Supabase que ya existían.

## Antes de conectar la nube

`firestore.rules` trae `CAMBIAR@ejemplo.com`. Hay que poner el correo real, **publicar las
reglas en la consola** —cambiar el archivo no publica nada— y comprobarlo desde afuera:

```bash
curl "https://firestore.googleapis.com/v1/projects/TU-PROYECTO/databases/(default)/documents/negocios/ayunka"
```

Tiene que responder **403**. Si responde 200, está abierta. Esto no es paranoia: el 1-sep el
archivo decía que la base estaba cerrada y llevaba semanas abierta a cualquiera.

## Detalles de la entrega

- La rama quedó como `master`. Si la quieres `main`: `git branch -M main`.
- Quedó `ayunka-studio-2.zip` en `negocio/`: es la copia con que se transfirió, se puede borrar.
- En `.git/` hay archivos `*.lock.viejo`: sobras de que este entorno no puede borrar en tu
  disco. Son inofensivos y se pueden borrar.
- Falta el `remote`. Cuando crees el repo en GitHub:
  `git remote add origin https://github.com/farid77cl/ayunka-studio-2.git && git push -u origin main`

## Contexto que no está en este repo

En `../.planning/` quedaron, del mismo día:

- `INCIDENTE-2026-09-01-sync.md` — cómo se perdieron tres semanas y qué se cambió por eso.
- `DONDE-ESTA-LA-DATA.md` — el inventario de todas las copias del catálogo y cuál manda.
- `QUE-COMPRAR-QUE-CONSTRUIR.md` — qué producto ya existe, cuánto cuesta y qué vale construir.
- `CARGA-INICIAL.md` — los datos reales de LIDCAR y Briones. **No inventar números: están ahí.**
- `SEGURIDAD.md` — qué está abierto y en qué orden se cierra.

---

## Actualización · v2.2.0 (2-sep, madrugada)

Se agregaron dos cosas que Farid había pedido y no estaban.

### 1. Cotizar desde un 3MF · `js/lector3mf.js` + `js/vistas/cotizar.js`

**Verificado contra los archivos reales de `../stl/`**, no contra un ejemplo:
`LIDCAR redondo 5 v5.3mf` → 5 piezas, **54 × 60,03 × 3 mm**, hueco de **0,229 cm³**.
Ese hueco es π × 13,5² × 0,4 — el bolsillo redondo del chip, exacto.

**No estima gramos ni tiempo, y es a propósito.** Se midió contra los 11 productos de
Ayünka que tienen datos de G-code real: el caudal va de **14 a 43 g/h** según la forma
—un fidget de pared delgada tarda el triple por gramo que una repisa maciza— y un modelo
lineal se equivoca **42% en promedio y hasta 154%**. Un presupuesto con ese error no es un
presupuesto. Se piden los dos números de la bandeja (una laminada en Creality Print) y la
app hace el resto. **Si alguien "mejora" esto agregando una estimación automática, está
reintroduciendo el problema.**

Dos trampas del formato 3MF que ya costaron caro y están documentadas en el código:

1. **`model_settings.config` numera las partes DESDE 1 DENTRO DE CADA OBJETO.** Con 5
   llaveros hay 150 partes y cinco veces la id 1. Mapear `id → subtipo` a secas hacía que
   el volumen saliera **negativo** (−4,32 cm³).
2. **Capturar `objectid` y `transform` en una sola expresión regular con grupo opcional
   falla en silencio**: se perdía la transformación y el llavero medía 54 × 54 × 26 en vez
   de 54 × 60 × 3. Los atributos se sacan de la etiqueta uno por uno.
3. Y la caja del objeto hay que llevarla al sistema de la bandeja transformando las **ocho**
   esquinas, no dos: con dos, una rotación de 90° da medidas absurdas.

### 2. Pase de diseño

Farid dijo que la app estaba fea y mandó `tools.kmorra3d.com` como referencia. Se analizaron
sus 14 páginas. **Se tomaron las técnicas, no la paleta** — copiarles el naranja oscuro sería
cambiar la marca de Ayünka por la de otro. Lo que sí se copió:

- Los **números en tipografía condensada** (Barlow Condensed), grandes y en el color de marca.
- **Unidades y `$` dentro del campo**, y sin las flechitas del input numérico. Es lo que más
  saca el olor a planilla. Está en `A.campo(..., {unidad:'g'})` y `{signo:'$'}`.
- **Un color fijo por categoría de costo**, repetido en el punto y la barra. Vive en el mapa
  `COLOR` de `js/costos.js` — si agregas un concepto nuevo, dale su color ahí.
- **Casi cero sombras**: la separación es borde de 1px más un fondo un escalón distinto.
- **Tablas sin bordes verticales ni cebra**, y el desglose de costos como filas flex.

Hay tema claro y oscuro (`data-tema` en el `<html>`, botón abajo a la izquierda), y la
**versión se muestra en pantalla** para poder verificarla de un vistazo.

**Lo que falta del diseño, y es lo que conviene hacer en VS Code con el navegador al lado:**

- El **panel de total pegado al costado** (`.con-panel` + `.panel-pegado` + `.total-caja` ya
  están en el CSS, sin usar). Va en la ficha de producto y en Cotizar: cargas datos a la
  izquierda y el precio te sigue a la derecha. Es lo que más se nota.
- En la tabla de productos, el chip "faltan las horas de trabajo" se repite en 15 filas
  seguidas y hace ruido. Mejor una sola nota arriba y un punto discreto en la fila.
- Las **barras de proporción** en el desglose (la clase `.barra` está lista): que cada
  categoría muestre qué porcentaje del costo se lleva.
- Revisar en pantalla chica: está resuelto pero no probado en un teléfono de verdad.
