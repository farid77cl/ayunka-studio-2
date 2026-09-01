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
