/* Vista: Pendientes. Calcula en vivo qué falta, nunca a mano. Primera pantalla. */
(function () {
  function pintar() {
    const productos = Datos.activos('productos');
    const sinPrecio = productos.filter(p => typeof p.precio !== 'number');
    const incompletos = productos.filter(p => Costos.queFalta(p).length);
    const stockNegativo = productos.filter(p => p.llevaStock && (p.stock || 0) < 0);
    const filamentosBajos = Datos.activos('filamentos').filter(f => (f.gramosQuedan || 0) < 200);

    let h = `<div class="cabecera"><h1>Pendientes</h1></div>`;

    if (incompletos.length) h += `<div class="tarjeta aviso">
      <b>${incompletos.length} productos no se pueden costear todavía</b> — les falta un dato
      real (gramos, horas de máquina, u horas de trabajo a mano).
      <button class="btn chico" style="margin-top:8px" onclick="location.hash='#/productos'">Ir a Productos</button></div>`;

    if (sinPrecio.length) h += `<div class="tarjeta">
      <b>${sinPrecio.length} de ${productos.length} productos no tienen precio de venta.</b>
      Los que ya tienen el costo completo traen un sugerido calculado con el margen.
      <button class="btn chico" style="margin-top:8px" onclick="location.hash='#/productos'">Ir a Productos</button></div>`;

    if (filamentosBajos.length) h += `<div class="tarjeta aviso">
      <b>${filamentosBajos.length} rollo(s) de filamento bajo 200g.</b>
      <button class="btn chico" style="margin-top:8px" onclick="location.hash='#/filamentos'">Ir a Filamentos</button></div>`;

    if (stockNegativo.length) h += `<div class="tarjeta aviso">
      <b>${stockNegativo.length} producto(s) con stock negativo.</b></div>`;

    if (!Nube.encendida()) h += `<div class="tarjeta aviso">
      <b>La sincronización está apagada — este equipo es la única copia.</b>
      <button class="btn chico" style="margin-top:8px" onclick="location.hash='#/ajustes'">Ir a Ajustes</button></div>`;

    if (!incompletos.length && !sinPrecio.length && !filamentosBajos.length && !stockNegativo.length && Nube.encendida()) {
      h += `<div class="tarjeta"><div class="vacio"><b>Todo al día</b>No hay pendientes que la app pueda ver.</div></div>`;
    }

    A.$('#contenido').innerHTML = h;
  }

  window.Vistas = window.Vistas || {};
  Vistas.pendientes = { pintar };
})();
