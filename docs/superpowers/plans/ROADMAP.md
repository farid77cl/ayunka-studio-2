# Ayünka Studio — reescritura completa, hoja de ruta

> Escrito el 13-sep-2026. Reemplaza cualquier plan anterior de `ayunka-studio-2` — esa
> carpeta se borró y este repo parte de cero. Las funciones que siguen abajo salen del
> inventario completo hecho el 12/13-sep sobre las dos versiones anteriores (la app vieja
> en `negocio/ayunka-studio/` y la versión 2 ya borrada) — **no se inventa alcance nuevo**,
> se reconstruye lo que ya se sabía que hacía falta.

**Valor central:** que Farid produzca y venda sin pelear con el software.

## Por qué cada fase existe y en qué orden

El orden no es arbitrario: cada fase depende de que la anterior exista.

| Fase | Qué entrega | Por qué en ese orden |
|---|---|---|
| **0** | Modelo de datos + sincronización + sistema visual | Todo lo demás escribe y lee de acá |
| **1** | Las 9 vistas núcleo del negocio | Sin esto no hay con qué cotizar ni cobrar |
| **2** | Generador 3D + bolsillo NFC + bandejas + verificador de G-code | El producto físico que hoy se vende |
| **3** | Generador de perfiles de impresión | Prioridad 1 de Farid — **ya existe construido y probado en la app vieja**, se porta |
| **4** | Cotización formal en PDF | Existe en la app vieja (`pdf.js`), se porta y se conecta al cliente nuevo |
| **5** | WhatsApp automatizado | Existe en la app vieja (`whatsapp.js`), se porta y se conecta a pedidos/cotizaciones |
| **6** | Conexión en vivo con la impresora | Investigado (WebSocket `ws://<ip>:9999`, sin root), nunca implementado en ninguna versión |
| **7** | Envíos reales + bandejas mezclando pedidos de clientes distintos | Envíos bloqueado en una clave de Chilexpress; lo de mezclar pedidos no existe en ninguna versión |

---

## Fase 0 · Fundación

**Modelo de datos** (`js/db.js`): colecciones con id estable con fecha, migraciones que
corren siempre (disco y nube), nada se borra de verdad (`activo:false`). Colecciones:
`productos, filamentos, clientes, pedidos, ventas, gastos, bandejas, cotizaciones,
disenos3d, movimientos, pagos*` (*pagos vive como movimientos sobre pedidos, no colección
aparte — ya se probó que funciona así).

**Sincronización** (`js/nube.js`): Firestore, un documento por ficha, la nube nunca gana
en silencio, respaldo a disco antes de la primera sincronización, diff antes de subir.

**Sistema visual** (`css/app.css`, `js/ui.js`): paleta "Acuarela Silvestre", tipografía
Outfit + Sacramento para el logo, componentes: tarjeta, tarjeta de aviso, tabla, chip,
etiqueta, campo, formulario, desglose de costos con color fijo por concepto, dato.

**Hecho cuando:** se puede crear un producto, un cliente y un pedido desde la consola del
navegador, sincronizar entre dos pestañas simuladas, y las pantallas base (login/config de
nube) se ven con el sistema visual.

---

## Fase 1 · Las 9 vistas núcleo

Cada una con lo que ya se sabe que tiene que hacer (de la v1, la v2 borrada, o ambas):

- **Productos** — costo/precio por oficio (3D, bordado, costura con márgenes ×3,5/×2,55/×2), ficha con foto, filamento asociado, stock, exportar catálogo CSV para Meta Commerce.
- **Clientes** — CRM liviano, cuánto debe cada uno, se crean solos al cotizar.
- **Filamentos** — inventario de rollos, gramos que quedan, costo por gramo, stock bajo.
- **Pedidos** — clienteId, líneas editables, estado, abono/saldo con **historial de pagos parciales** (no un solo campo), dirección/peso/costo de envío, fecha de entrega real.
- **Cotizar** — desde una bandeja laminada (gramos/horas reales, no estimados), **se guarda ligada a un cliente**, genera documento (ver Fase 4 para el PDF formal), **se convierte en pedido con un click**, se manda por WhatsApp (ver Fase 5 para la versión completa).
- **Cola** — horas comprometidas vs. ventana real de la K2 (8:00-21:00, no iniciar piezas de 6h después de las 10:00), contra la fecha de entrega de cada pedido.
- **Ventas y gastos** — registra, congela el costo al vender, resultado del mes.
- **Ajustes** — parámetros de costo, márgenes por oficio, rollo de filamento por defecto, tasa de fallas (medida real de la K2, no un supuesto), credenciales de sincronización y de fotos.
- **Pendientes** — calcula en vivo qué falta (precios, horas, datos 3D, filamento sin descontar, stock negativo, nube apagada), con botón de un click cuando corresponde.

**Hecho cuando:** se puede armar un pedido completo de punta a punta -- cliente, líneas,
abono, envío -- sin tocar un Excel, y Pendientes no muestra nada que ya esté resuelto.

---

## Fase 2 · El generador 3D

Presets (llavero, letra con nombre, letrero, caja de luz, recuerdo), 39 figuras, tipografía
real, vectorizar imagen, argolla/montaje. **Bolsillo NFC** (círculo de 27mm, z 0,80-1,20,
`negative_part` + pausa) con **verificación automática leyendo el 3MF de vuelta**.
**Bandejas con varias copias** de la misma pieza (grilla que evita la torre de purga).
**Verificador de G-code** (compuerta 7): perfil correcto, pausa presente, bolsillo vacío,
puente cerrado -- centro de la pieza detectado solo desde el propio G-code, nunca a mano.

Estas cuatro cosas ya se construyeron y verificaron contra G-code real hoy (12-sep, antes
de borrar la carpeta) -- el código se reescribe, pero **los algoritmos y los números ya
están probados** (27mm de diámetro no 27×27 cuadrado, z=0,80 es el piso sólido no el hueco,
el punto MEDIO de cada trazo no el de llegada, radio de búsqueda ~10mm no el tamaño de la
pieza entera). No hay que volver a descubrir esto con prueba y error.

**Hecho cuando:** se genera un llavero con bolsillo NFC, se descarga el 3MF, y
`verificarNFC` confirma que el negative_part y la pausa quedaron bien -- mismo criterio
que hoy, verificado contra `stl/RUDY Automotriz 19 - una placa_PLA_53m39s.gcode` (repo
`negocio`) como caso conocido-bueno y `LIDCAR redondo 15 v4 - SIN BOLSILLO...gcode` como
caso conocido-malo.

---

## Fase 3 · Generador de perfiles de impresión

**Ya existe, completo y con pruebas, en `negocio/ayunka-studio/js/perfil*.js`** (2.237
líneas, 9 archivos) -- prioridad 1 de Farid. Se porta la LÓGICA (motor de reglas, lectura
de 3MF en Worker, medición de geometría, veredicto de imprimibilidad, exportación del
bundle `.creality_printer`), adaptada al modelo de datos nuevo -- no se reinventa el
diseño, que ya está resuelto y documentado en `negocio/.planning/phases/01` a `/06`.

Piezas concretas a portar:
- `perfil.js` (600L) -- orquestador y UI de la pestaña
- `perfil-reglas.js` (575L) -- motor de reglas: metas de taller (resolución, terminación
  de pared, resistencia, rapidez) + material → ajustes de proceso reales
- `perfil-medidas.js` (374L) -- mide geometría del 3MF (grosor de pared, zonas finas)
- `perfil-export.js` (201L) -- arma el bundle `.creality_printer` byte a byte
- `perfil-geometria.js` (122L), `perfil-imprimibilidad.js` (99L), `perfil-descarga.js`
  (166L), `perfil-worker.js` (54L), `perfil-impresora-k2.js` (46L, trae el perfil real de
  la K2 de Farid embebido -- **nunca transcribir a mano**, tiene su propio contrato)

Las pruebas de referencia ya existen en `negocio/ayunka-studio/pruebas/*.cjs` (formato
`.cjs`, corren con Node) -- sirven para verificar que el puerto no rompió el
comportamiento, comparando salida contra salida.

**Hecho cuando:** se sube un 3MF, se eligen metas de taller y material, y se descarga un
`.creality_printer` que Creality Print abre sin error -- verificado igual que la v1: con
el lector `zipfile` de Python, no solo con el propio lector escrito acá.

---

## Fase 4 · Cotización formal en PDF

**Ya existe en `negocio/ayunka-studio/js/pdf.js`** (176 líneas): logo, condiciones de
pago (abono %), plazo estimado. Se porta y se conecta a `cotizaciones` del modelo nuevo
(hoy el documento de la Fase 1 es HTML para imprimir con Ctrl+P -- esto lo reemplaza por
un PDF real generado en el navegador).

**Hecho cuando:** desde una cotización guardada sale un PDF descargable con los datos
reales del pedido, no una plantilla de ejemplo.

---

## Fase 5 · WhatsApp automatizado

**Ya existe en `negocio/ayunka-studio/js/whatsapp.js`** (148 líneas): mensajes de
bienvenida/ausencia, textos rápidos parametrizables (plazo, envío, retiro), tope de 200
caracteres, sin API de WhatsApp (copiar/pegar o `wa.me`). Se porta y se conecta a los
datos reales del cliente/pedido/cotización nuevos, sumado al mensaje de cotización que ya
se probó hoy (wa.me con el texto armado desde la ficha).

**Hecho cuando:** hay un mensaje armado y listo para copiar o abrir en WhatsApp para cada
momento del flujo: cotización enviada, pedido confirmado, pedido listo para retiro/envío.

---

## Fase 6 · La impresora en vivo ✅ 2026-09-13

Investigado el 1-sep (`negocio/.planning/QUE-COMPRAR-QUE-CONSTRUIR.md`), nunca
implementado: WebSocket `ws://<ip>:9999` de la K2 (firmware de fábrica, **sin root**),
handshake `wsslicer` -- da estado, progreso, capa actual/total, temperaturas, CFS, y
permite pausar/reanudar/detener. Referencia de protocolo: proyecto de Home Assistant
`3dg1luk43/ha_creality_ws` (Python, legible). Un agente chico empuja el estado a
Firestore cada pocos segundos; la app lo lee como cualquier otra ficha, nunca llama a la
K2 directo (una página `https` no puede hablarle a un `http`/`ws` de la LAN).

**Hecho cuando:** Farid ve en qué capa va la impresora desde el teléfono, en la calle.

Hecho: vista **Historial K2** (`js/vistas/impresoravista.js` + `js/impresora.js`) que
empareja piezas del historial con productos del catálogo por `archivoOrigen`, propone
gramos/horas reales (nunca aplica sola, siempre hay un click de por medio), permite crear
un producto desde una pieza huérfana, y muestra arriba el estado en vivo leyendo
`Nube.leerImpresoraViva()`. El agente (`agente/k2-puente.js`, Node.js, corre aparte de la
PWA en la misma red que la K2) se escribió con lo investigado pero **no se pudo probar
contra una K2 real** -- el `README.md` de `agente/` lo deja explícito arriba de todo y
trae un modo `--debug` para capturar los mensajes reales antes de confiar en el parseo.

---

## Fase 7 · Envíos reales y bandejas mezclando pedidos ✅ 2026-09-13 (envíos sigue bloqueado)

**Envíos:** costo real vía Chilexpress -- bloqueado en la cuenta/clave de
`developers.wschilexpress.com`. Los campos (dirección, peso, costo manual) ya están desde
hoy en el modelo de Pedidos; esto solo agrega el cálculo automático cuando exista la clave.
**Sigue bloqueado** -- nada nuevo que programar hasta que Farid consiga la clave.

**Bandejas mezclando pedidos:** hoy (y en la v1) una bandeja es piezas del MISMO producto.
Nadie resuelve "estos 4 pedidos de 3 clientes caben en una placa de la K2" -- según la
propia investigación de mercado del 1-sep, es el cuello de botella real del negocio con
una sola máquina, y ningún producto del mercado lo hace. Es la pieza más nueva de esta
hoja de ruta, sin nada que portar.

**Hecho cuando:** se pueden elegir N pedidos abiertos y la app arma una bandeja que los
mezcla, dentro de 260×260 y evitando la torre de purga.

Hecho: vista **Bandejas mixtas** (`js/bandejas.js` + `js/vistas/bandejasvista.js`).
Requirió una decisión de modelo de datos que no tenía respuesta obvia en el código
existente -- se le preguntó a Farid cómo representar el tamaño físico de cada pieza, y
eligió agregar ancho/largo (mm) opcionales al producto en vez de un conteo aproximado
"piezas por bandeja" o prescindir de la geometría. El empaquetado es por filas (shelf
packing), no un slicer: suficiente para decidir qué entra junto, dejando explícito en la
UI que la placa real se arma después en el slicer.

---

## Qué NO se reescribe

- El repo de GitHub `farid77cl/ayunka-studio-2` con el historial de hoy (12-sep) queda
  como archivo -- no se toca ni se borra, es la referencia de "qué ya se probó que
  funciona" para las Fases 0-2.
- `negocio/ayunka-studio/` (la app v1) no se toca -- es la fuente de donde se porta
  Perfiles, PDF y WhatsApp. Se lee, no se edita.
- Los diseños 3D guardados y los datos reales (semilla: productos, filamentos, clientes,
  pedido de LIDCAR) se migran tal cual al modelo nuevo cuando llegue el momento -- son
  datos del negocio, no código a reescribir.
