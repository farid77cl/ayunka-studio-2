/* Ayünka Studio — el libro de movimientos de stock.
 *
 * Revisión del 3-sep de Cowork, punto 6: "Nada descuenta stock. gramosQuedan del filamento
 * y stock del producto solo cambian escribiéndolos a mano. Vender no descuenta nada... Falta
 * el libro de movimientos que el MILESTONE pedía en la Fase 1" — MILESTONE-ERP.md lo dice
 * explícito: "products.stock y filaments.gramsLeft son escalares mutados sin libro."
 *
 * Por eso esto no es "restar un número": cada cambio queda como una FICHA en la colección
 * `movimientos`, con el antes y el después — se puede reconstruir qué pasó, no solo ver el
 * total de hoy.
 */
(function () {
  'use strict';
  const N = v => (typeof v === 'number' && isFinite(v)) ? v : 0;

  /** Cambia `campo` en la ficha `refId` de `coleccion` en `cambio` (puede ser negativo) y
   *  deja constancia en `movimientos`. No llama a Datos.guardar() -- eso lo hace quien
   *  registra varios movimientos seguidos, para no escribir a cada rato. */
  function registrar(coleccion, campo, refId, cambio, motivo) {
    const item = Datos.obtener(coleccion, refId);
    if (!item || !cambio) return null;
    const antes = N(item[campo]);
    const despues = antes + cambio;
    item[campo] = despues;
    Datos.agregar('movimientos', {
      fecha: new Date().toISOString().slice(0, 10),
      coleccion, refId, campo, cambio, antes, despues, motivo: motivo || '', activo: true
    });
    return despues;
  }

  /** Los movimientos de una ficha puntual, más recientes primero. */
  function historialDe(coleccion, refId) {
    return Datos.activos('movimientos')
      .filter(m => m.coleccion === coleccion && m.refId === refId)
      .sort((a, b) => (a.fecha || '') < (b.fecha || '') ? 1 : -1);
  }

  /* Revisión del 3-sep, punto 2: "El descuento de filamento no corre para ningún producto
   * real" -- 0 de 38 productos tenían un rollo elegido a mano, así que la parte que de
   * verdad es plata (los gramos que salen del rollo) nunca se descontaba. Si el producto no
   * tiene `filamentoId`, cae al rollo por defecto de su material: el que se eligió una vez
   * en Ajustes, o -si hay un solo candidato con saldo- ese mismo, sin pedirle nada a nadie.
   * La ficha queda para la EXCEPCIÓN (este llavero salió del arcoíris), no para lo normal. */
  function filamentoPorDefecto(material) {
    const elegido = DB.params.filamentoPorDefecto && DB.params.filamentoPorDefecto[material];
    if (elegido && Datos.obtener('filamentos', elegido)) return elegido;
    const candidatos = Datos.activos('filamentos').filter(f => (f.material || 'PLA') === material && N(f.gramosQuedan) > 0);
    return candidatos.length === 1 ? candidatos[0].id : null;
  }

  /** El filamento que hay que descontar por este producto: el suyo si lo tiene, si no el
   *  por defecto de su material. Puede devolver null (no hay uno solo obvio). */
  function filamentoDe(prod) {
    if (prod.filamentoId && Datos.obtener('filamentos', prod.filamentoId)) return prod.filamentoId;
    return filamentoPorDefecto(prod.material);
  }

  window.Movimientos = { registrar, historialDe, filamentoPorDefecto, filamentoDe };
})();
