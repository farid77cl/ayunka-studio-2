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

  window.Movimientos = { registrar, historialDe };
})();
