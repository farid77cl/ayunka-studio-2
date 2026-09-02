# Bitácora de Ayünka Studio

Lo más nuevo arriba. Formato y reglas en `COMO-REPORTAR.md`.

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
