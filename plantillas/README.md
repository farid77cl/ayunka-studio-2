# Plantillas

Cada archivo `<id>.json` de esta carpeta es un producto personalizable (formato
`plantilla/1`). La pantalla **Plantillas** de la app se arma sola desde el JSON: no se
programa una pantalla por producto. Diseño completo:
`docs/superpowers/specs/2026-09-24-plantillas-simples-design.md`.

| Plantilla | Origen | Qué se personaliza |
|---|---|---|
| `mochila-nfc-v3` | `negocio/stl/mochila-nfc/generar_mochila.py --exportar-plantilla` | variante niño/niña/neutra, nombre, teléfono para el QR |

## Qué trae una plantilla

- **`variantes`**: cada una con sus colores por rol, su lista de carretes (`filamentos`) y
  su **perfil** de Creality ya armado para esa cantidad de carretes.
- **`piezas`**: en el orden de los part id del 3MF. La parte FIJA viene como figuras 2D
  (`figs`) con su altura (`z`). `soloSi` / `figsSi` las prenden o cambian según un
  parámetro. El `negative_part` (bolsillo del chip) va **siempre último**.
- **`parametros`**: lo que la usuaria edita. Tipos: `texto` (se ajusta solo a su `zona`,
  con trazo mínimo), `telefono-qr`, `interruptor` (on/off), `color` (de una lista).
- **`instrucciones`**: la ayuda «Después de descargar» que sale bajo el botón.
- **`armazon3mf`**: las cabeceras del 3MF, la pausa y dónde va cada cosa generada.

## Cómo se agrega una plantilla nueva

1. Diseñarla y validarla en Python, con su compuerta 5, como la mochila.
2. Darle un `--exportar-plantilla` que escriba el JSON. El molde es
   `exportar_plantilla()` en `generar_mochila.py`: genera un pedido de muestra con el
   propio script (así el armazón es el de un 3MF que pasó la compuerta), toma de ahí las
   cabeceras, arma el perfil de cada variante y exporta la geometría fija ya simplificada.
3. Sumarla a `catalogo.json`: `{ "id": "<id>", "archivo": "<id>.json", "nombre": "…" }`.
4. Si usa otra fuente, copiarla a `../fuentes/` con su licencia.
5. Correr las pruebas: `node --test "tests/*.test.js"`. El test del catálogo revisa
   **todas** las plantillas (formato, negativo último, perfil por variante, instrucciones).
6. Abrir la app en **Plantillas**, hacer un pedido de prueba, y cortar el 3MF en
   Creality Print para la compuerta 7 (el G-code) antes de venderla.

Si el diseño cambia en Python, se vuelve a exportar el JSON: no se edita a mano.
