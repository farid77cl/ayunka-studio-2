# `js/vendor/` — lo que no escribimos nosotros

Las dos librerías que necesita **Personalizados 3D** y las 14 tipografías con que escribe.
Todo copiado tal cual, sin modificar una línea.

**Mira primero:** `../d3d-fuentes.js`. Ahí están la lista de tipografías (`FUENTES`) y la
ruta a esta carpeta (`BASE`), que es la única que existe — la vista no vuelve a escribirla.

## Por qué están acá y no en un CDN

Hasta la **v2.19.0** venían de `cdn.jsdelivr.net` y `cdnjs.cloudflare.com` en cada arranque.
El 8 de septiembre de 2026, con los dos CDN inalcanzables, apretar «Generar» dejaba esto en
pantalla:

    No se pudo generar. https://cdn.jsdelivr.net/npm/opentype.js@1.3.4/dist/opentype.min.js

Los TTF sí se guardaban en IndexedDB, pero **opentype.js —el que los interpreta— se pedía
siempre a la red**, y `sw.js` salta a propósito todo lo que no es del mismo origen (para no
cachear Firebase ni Supabase). O sea: el caché de fuentes no servía de nada sin internet.

Y `google/fonts@main` es una **rama que se mueve**: el día que Google renombre un archivo,
esa tipografía queda en 404 sin que nadie lo note hasta que alguien intente usarla.

## Qué hay

| Archivo | Versión | Licencia |
|---|---|---|
| `opentype.min.js` | opentype.js **1.3.4** (`dist/opentype.min.js` del paquete npm) | MIT — `opentype.js-LICENSE.txt` |
| `three.min.js` | three.js **r128** = three@**0.128.0** (`build/three.min.js`) | MIT — `three.js-LICENSE.txt` |
| `fuentes/` | 14 TTF de `google/fonts`, bajados el 8-sep-2026 | OFL 1.1 y Apache 2.0 — cada una con su licencia al lado |

`three.min.js` es **el mismo build** que servía cdnjs para r128: cdnjs publica el
`build/three.min.js` del paquete, sin tocarlo.

**Las tipografías conservan la estructura de carpetas de google/fonts** (`fuentes/ofl/…`,
`fuentes/apache/…`). No es capricho: así cada una queda con su `OFL.txt` o `LICENSE.txt` al
lado —la OFL exige que la licencia acompañe al archivo— y actualizar una es copiar el TTF
encima sin tocar código.

Todas son OFL 1.1 o Apache 2.0, así que **se pueden usar en productos que se venden**. Eso
ya estaba decidido cuando se eligió la lista; acá solo cambió de dónde salen los bytes.

## Las trampas

- **Los nombres con corchetes son a propósito.** `Montserrat[wght].ttf` es una fuente
  variable y así se llama en google/fonts. En el código la ruta va codificada
  (`Montserrat%5Bwght%5D.ttf`) — es como venía del CDN y funciona igual servido de acá. No
  los renombres: `FUENTES` en `../d3d-fuentes.js` los nombra uno por uno.
- **`fuentes/` pesa 3,9 MB y NO se precarga.** `sw.js` deja los TTF fuera de la lista de
  instalación; se cachean solos la primera vez que se usa cada uno. Los dos `.js` sí van
  precargados: sin ellos no se genera nada.
- **Si cambias cualquier archivo de acá, sube la versión** en `../version.js`. El nombre del
  caché del service worker sale de ahí, y sin eso la copia vieja se queda pegada.
- **No editar nada de esta carpeta.** Si una librería necesita un parche, va envuelta en un
  archivo nuestro, no editada acá — o la próxima actualización se lo lleva en silencio.
