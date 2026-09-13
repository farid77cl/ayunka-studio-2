# Fase 1 · Vistas núcleo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Las 9 vistas núcleo del negocio sobre la Fase 0 ya lista, más el motor de costos
que todas comparten. Al final se puede armar un pedido completo de punta a punta sin
tocar un Excel.

**Spec:** `docs/superpowers/plans/ROADMAP.md` (Fase 1).

**Orden de tareas** (cada una depende de la anterior): Costos → Ajustes → Clientes →
Filamentos → Productos → Pedidos → Cotizar → Cola → Ventas y gastos → Pendientes.

## Global Constraints (heredadas de la Fase 0, no se repiten)

Sin build, sin dependencias nuevas, comentarios en español explicando el porqué,
verificación real con Playwright por tarea, commit por tarea. Cada vista se registra en
`window.Vistas.<id> = { pintar, ... }` y se agrega a `App.NAV` en `js/app.js`.

---

### Task 1: `js/costos.js` — el motor de costos de los dos oficios

**Files:** Create `js/costos.js`. Modify `index.html` (agregar `<script src="js/costos.js">`
antes de `js/app.js`).

**Interfaces:**
- Consumes: `DB.params` (con `kwh, manoObraHora, amortizacionAnios, precioMaquina,
  mermaPct, tasaFalla, margenes: {3d, bordado, costura}, capacidadDiaH`).
- Produces: `window.Costos = { calcular(producto), calcularPedido(pedido),
  horasPedido(pedido), margen(producto, params), queFalta(producto) }`. Todas las demás
  tareas de esta fase llaman a estas cinco funciones -- los nombres no cambian.

- [ ] **Step 1:** Escribir `calcular(producto)` → `{ costo, sugerido, precio, completo,
lineas: [{concepto, monto, nota, color}], alerta }`. Oficio `3d`: filamento (gramos ×
precio/g del rollo o genérico del material) + merma% + electricidad (horas × kWh × precio)
+ amortización (horas × precioMaquina / (amortizacionAnios × 365 × 24)) + mano de obra
(postMin) + extraCosto. Oficios `bordado`/`costura`: horas de trabajo × manoObraHora +
materiales + extraCosto. `completo` es `false` si falta un dato (gramos/horas nulos) --
en ese caso `costo`/`sugerido` son `null`, nunca un número inventado.
- [ ] **Step 2:** Escribir `margen(producto, params)` → factor según oficio (3D ×3,5,
bordado ×2,55, costura ×2, cada uno leído de `params.margenes` con ese default).
- [ ] **Step 3:** Escribir `calcularPedido(pedido)` → suma costo/total de las líneas
(usa `calcular` sobre el producto de cada línea si tiene `productoId`, si no usa
`precioUnit` directo), `abonado: N(pedido.abono)`, `saldo: total - abonado`.
- [ ] **Step 4:** Escribir `horasPedido(pedido)` y `queFalta(producto)` (lista en
castellano de qué dato falta para poder costear).
- [ ] **Step 5: Verificar con datos falsos**

```python
r = page.evaluate("""() => {
    DB.params = { kwh: 202, manoObraHora: 4000, amortizacionAnios: 3, precioMaquina: 900000,
                  mermaPct: 0.08, tasaFalla: 0.129, margenes: {'3d':3.5,bordado:2.55,costura:2}, capacidadDiaH: 13 };
    Datos.agregar('filamentos', { id:'f1', material:'PLA', gramosQuedan: 900, precioKg: 15000, activo:true });
    const p3d = { oficio:'3d', material:'PLA', gramos:20, horas:0.5, filamentoId:'f1', postMin:5, extraCosto:0, colores:1, activo:true };
    const c1 = Costos.calcular(p3d);
    const pBordado = { oficio:'bordado', horasTrabajo: 1.5, extraCosto: 500, activo:true };
    const c2 = Costos.calcular(pBordado);
    return { completo3d: c1.completo, costo3d: c1.costo, sugerido3d: c1.sugerido, completoBordado: c2.completo, costoBordado: c2.costo };
}""")
```

Esperado: `completo3d` y `completoBordado` en `True`, `costo3d` > 0, `sugerido3d` ≈
`costo3d × 3.5`, `costoBordado` incluye `1.5 × 4000 + 500 = 6500`.

- [ ] **Step 6: Commit** `feat: js/costos.js -- motor de costos 3D/bordado/costura`

---

### Task 2: Vista Ajustes

**Files:** Create `js/vistas/ajustes.js`. Modify `index.html`, `js/app.js` (`NAV.push({id:'ajustes', label:'Ajustes'})`).

**Interfaces:** Lee/escribe `DB.params` directo. Formulario con `A.campo` para cada
parámetro de `Task 1`, más un bloque de sincronización (correo/clave → `Nube.guardarCfg` +
`Nube.conectar`) y un botón "Descargar respaldo" (`Datos.descargarRespaldo`).

- [ ] **Step 1:** `pintar()` arma el formulario, con un botón "Guardar" que lee todos los
campos, hace `Object.assign(DB.params, {...})` y `Datos.guardar('ajustes')`.
- [ ] **Step 2:** Sección de nube: dos campos (correo, clave) + botón "Conectar" que llama
`Nube.guardarCfg(AYUNKA_CFG.firebase, AYUNKA_CFG.espacio, correo, clave)` y después
`Nube.conectar(...)`.
- [ ] **Step 3:** Registrar en `Vistas.ajustes` y en `App.NAV`.
- [ ] **Step 4: Verificar** -- cambiar un parámetro, guardar, releer `DB.params` y
confirmar que el valor persistió tanto en memoria como en `localStorage`.
- [ ] **Step 5: Commit** `feat: vista Ajustes -- parametros de costeo y conexion a la nube`

---

### Task 3: Vista Clientes

**Files:** Create `js/vistas/clientes.js`. Modify `index.html`, `js/app.js`.

**Interfaces:** Ficha `{id, nombre, tipo, contacto, notas, activo}`. `Datos.agregar` /
`Datos.obtener` / `Datos.activos('clientes')`.

- [ ] **Step 1:** `pintar()` -- tabla con nombre y notas, botón "Nuevo cliente" (crea con
nombre "Cliente nuevo" y abre el modal de edición).
- [ ] **Step 2:** `abrir(id)` -- modal con `A.campo` para nombre/contacto, `A.selector` para
tipo (persona/empresa), textarea de notas.
- [ ] **Step 3: Verificar** -- crear un cliente, editarlo, confirmar que `Datos.obtener`
devuelve los cambios.
- [ ] **Step 4: Commit** `feat: vista Clientes -- CRM liviano`

---

### Task 4: Vista Filamentos

**Files:** Create `js/vistas/filamentos.js`. Modify `index.html`, `js/app.js`.

**Interfaces:** Ficha `{id, material, marca, color, hex, precioKg, gramosQuedan, activo}`.

- [ ] **Step 1:** `pintar()` -- tabla con material/marca/color (swatch con `f.hex`), gramos
que quedan, costo por gramo calculado (`precioKg/1000`), chip "bajo stock" si
`gramosQuedan < 200`.
- [ ] **Step 2:** `abrir(id)` -- modal de edición con los campos de arriba.
- [ ] **Step 3: Verificar** -- crear un rollo, confirmar que el costo por gramo calculado
es correcto.
- [ ] **Step 4: Commit** `feat: vista Filamentos -- inventario de rollos`

---

### Task 5: Vista Productos

**Files:** Create `js/vistas/productos.js`. Modify `index.html`, `js/app.js`.

**Interfaces:** Ficha `{id, sku, nombre, categoria, oficio, material, gramos, horas,
horasTrabajo, colores, postMin, precio, stock, llevaStock, filamentoId, foto,
descripcion, extraCosto, activo}`. Usa `Costos.calcular`.

- [ ] **Step 1:** `pintar()` -- tabla agrupada por categoría (como la Fase 1 anterior:
oficio con etiqueta de color, costo, sugerido, precio, chip de alerta), buscador, botón
"Nuevo producto".
- [ ] **Step 2:** `abrir(id)` -- modal con todos los campos, selector de filamento
(`opcionesFilamento()` a partir de `Datos.activos('filamentos')`), botón "Usar sugerido"
que copia `Costos.calcular(p).sugerido` al campo precio.
- [ ] **Step 3:** `exportarCatalogoMeta()` -- CSV con columnas `id,title,description,
availability,condition,price,link,image_link,brand`, solo productos con `precio` numérico
(mismo código probado el 12-sep, se reconstruye igual).
- [ ] **Step 4: Verificar** -- crear un producto 3D completo, confirmar costo/sugerido
correctos; exportar el CSV y confirmar columnas y que el precio trae "CLP".
- [ ] **Step 5: Commit** `feat: vista Productos -- catalogo con costeo y exportador Meta CSV`

---

### Task 6: Vista Pedidos

**Files:** Create `js/vistas/pedidos.js`. Modify `index.html`, `js/app.js`.

**Interfaces:** Ficha `{id, clienteId, estado, fecha, entrega, abono, direccion, pesoKg,
costoEnvio, notas, lineas:[{productoId,descripcion,cantidad,precioUnit}], activo}`.
Necesita `js/movimientos.js` (ledger genérico, se crea en este task porque solo lo usa
Pedidos por ahora): `Movimientos.registrar(coleccion, campo, refId, cambio, motivo)` y
`Movimientos.historialDe(coleccion, refId)`, igual al ya probado el 12-sep.

- [ ] **Step 1:** Crear `js/movimientos.js` (ledger genérico, ~30 líneas, igual al de hoy).
- [ ] **Step 2:** `pintar()` -- tabla con cliente, entrega, estado, total/abono/saldo,
horas comprometidas, botón "+ Pago" por fila (`event.stopPropagation()` para no abrir el
modal grande) y botón "Nuevo pedido".
- [ ] **Step 3:** `abrir(id)` -- modal con cliente/estado/fecha/entrega/abono/dirección/
peso/envío, líneas editables (selector de producto o línea libre), totales en vivo
(incluye envío en el total, como se probó hoy).
- [ ] **Step 4:** `registrarPago(id)` -- modal chico (monto, método) que llama
`Movimientos.registrar('pedidos','abono',id,monto,motivo)` y muestra el historial.
- [ ] **Step 5: Verificar** -- crear un pedido con una línea, registrar un pago parcial,
confirmar que el saldo baja y el historial queda.
- [ ] **Step 6: Commit** `feat: vista Pedidos + js/movimientos.js -- pagos parciales, envio, lineas editables`

---

### Task 7: Vista Cotizar

**Files:** Create `js/vistas/cotizar.js`. Modify `index.html`, `js/app.js`.

**Interfaces:** Ficha en `cotizaciones`: `{id, clienteId, fecha, validoHasta, archivoOrigen,
cantidad, piezasPorBandeja, bandejas, precioUnit, costoUnit, total, horasTotal, entrega,
lineas, llevaPausa, estado, pedidoId, activo}`. Necesita `js/lector3mf.js` (lector de 3MF
para sacar piezas/pausas/nombre del archivo -- se porta igual al de hoy) para leer la
bandeja soltada.

- [ ] **Step 1:** Crear `js/lector3mf.js` (igual al probado hoy: cuenta piezas, detecta
pausa, saca tiempo del nombre del archivo si viene en formato `_PLA_4h54m53s`).
- [ ] **Step 2:** `pintar()` -- zona de soltar 3MF + lista de cotizaciones recientes.
- [ ] **Step 3:** `calcular()` -- gramos/horas de la bandeja → precio por pieza (usa
`Costos.calcular` con una ficha de mentira), tabla de tramos por cantidad, desglose.
- [ ] **Step 4:** `guardarCotizacion()`, `verCotizacion()` (documento HTML imprimible),
`convertirEnPedido()`, `enviarPorWhatsapp()` -- las cuatro ya probadas hoy, mismo diseño.
- [ ] **Step 5: Verificar** -- subir un 3MF real (`negocio/stl/RUDY Automotriz 1 - prueba
v4.3mf`), calcular, guardar cotización, convertir en pedido, confirmar que el pedido
nuevo tiene la línea correcta.
- [ ] **Step 6: Commit** `feat: vista Cotizar + js/lector3mf.js -- cotizar, guardar, convertir en pedido, WhatsApp`

---

### Task 8: Vista Cola

**Files:** Create `js/vistas/cola.js`. Modify `index.html`, `js/app.js`.

**Interfaces:** Solo lectura sobre `pedidos`/`productos`. Usa `Costos.horasPedido`.

- [ ] **Step 1:** `pintar()` -- por cada pedido abierto, horas comprometidas vs. capacidad
diaria (`DB.params.capacidadDiaH`), aviso si no alcanza para la fecha de entrega
(ventana 8:00-21:00, no iniciar piezas de 6h+ después de las 10:00 -- regla ya medida,
no se reinventa).
- [ ] **Step 2: Verificar** -- con un pedido de horas altas y entrega mañana, confirmar
que aparece el aviso de "no alcanza".
- [ ] **Step 3: Commit** `feat: vista Cola -- horas comprometidas contra la ventana real de la K2`

---

### Task 9: Vista Ventas y gastos

**Files:** Create `js/vistas/finanzas.js`. Modify `index.html`, `js/app.js`.

**Interfaces:** Fichas en `ventas` `{id,fecha,clienteId,pedidoId,items,costoAlVender,
metodoPago,activo}` y `gastos` `{id,fecha,concepto,monto,categoria,activo}`.

- [ ] **Step 1:** `pintar()` -- selector de mes, tabla de ventas y de gastos, total del
mes, utilidad.
- [ ] **Step 2:** Registrar venta -- congela `costoAlVender` en el momento (no recalcula
después si el producto cambia de costo).
- [ ] **Step 3: Verificar** -- registrar una venta y un gasto del mes actual, confirmar
que el total del mes los suma.
- [ ] **Step 4: Commit** `feat: vista Ventas y gastos -- costo congelado al vender`

---

### Task 10: Vista Pendientes

**Files:** Create `js/vistas/pendientes.js`. Modify `index.html`, `js/app.js` (esta va
PRIMERA en `NAV`, es la pantalla de entrada).

**Interfaces:** Solo lectura sobre todas las colecciones -- corre `Costos.queFalta` y
chequeos directos (precio nulo, `llevaStock` sin `filamentoId` por defecto en Ajustes,
`gramosQuedan` negativo, `Nube.encendida()===false`).

- [ ] **Step 1:** `pintar()` -- una tarjeta por tipo de pendiente, con el conteo y un botón
de un click cuando la solución es directa (ir a la ficha).
- [ ] **Step 2: Verificar** -- con un producto sin precio y la nube apagada, confirmar que
ambos avisos aparecen.
- [ ] **Step 3: Commit** `feat: vista Pendientes -- que calcula en vivo, primera pantalla`

---

### Task 11: cierre de la Fase 1

- [ ] Regresión de las 9+1 vistas navegando cada una, sin errores de consola.
- [ ] Confirmar que `App.NAV` tiene el orden correcto (Pendientes primera).
- [ ] Avisar que la Fase 1 está lista y pasar a planificar la Fase 2 (generador 3D).
