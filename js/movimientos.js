/* Ayünka Studio — el libro de movimientos, genérico para cualquier colección/campo.
 * Cada cambio queda como una FICHA con el antes y el después -- se puede reconstruir
 * qué pasó, no solo ver el total de hoy. */
(function () {
  'use strict';
  const N = v => (typeof v === 'number' && isFinite(v)) ? v : 0;

  function registrar(coleccion, campo, refId, cambio, motivo) {
    const item = Datos.obtener(coleccion, refId);
    if (!item || !cambio) return null;
    const antes = N(item[campo]);
    const despues = antes + cambio;
    item[campo] = despues;
    Datos.agregar('movimientos', {
      fecha: new Date().toISOString().slice(0, 10),
      coleccion, campo, refId, cambio, antes, despues, motivo: motivo || '', activo: true
    });
    return despues;
  }

  function historialDe(coleccion, refId) {
    return Datos.activos('movimientos')
      .filter(m => m.coleccion === coleccion && m.refId === refId)
      .sort((a, b) => (a.fecha || '') < (b.fecha || '') ? 1 : -1);
  }

  window.Movimientos = { registrar, historialDe };
})();
