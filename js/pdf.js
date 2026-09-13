/* Ayünka Studio — cotización PDF profesional con marca Ayünka. Portado de
 * negocio/ayunka-studio/js/pdf.js (genQuotePDF), adaptado al modelo de `cotizaciones`
 * nuevo (una línea, no un array de items) -- misma paleta "Acuarela Silvestre" en RGB. */
(function () {
  const CLP = n => '$' + Math.round(+n || 0).toLocaleString('es-CL');

  async function genQuotePDF(cot, cliente) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const W = doc.internal.pageSize.getWidth(), M = 46;
    const CR = [236, 230, 218], PZ = [95, 124, 142], CB = [47, 58, 64], CO = [203, 90, 82];

    doc.setFillColor(...CR); doc.rect(0, 0, W, 112, 'F');
    doc.setTextColor(...CB); doc.setFont('helvetica', 'bold'); doc.setFontSize(22); doc.text('Ayünka', M, 58);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text('COTIZACIÓN', W - M, 52, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...PZ);
    doc.text('N° ' + cot.id, W - M, 70, { align: 'right' }); doc.text(A.fecha(cot.fecha), W - M, 84, { align: 'right' });

    let y = 142; doc.setTextColor(...CB);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text('Para:', M, y);
    doc.setFont('helvetica', 'normal'); doc.text((cliente && cliente.nombre) || 'Cliente', M + 32, y);
    let cy = y + 14;
    if (cliente && cliente.contacto) { doc.text(cliente.contacto, M + 32, cy); cy += 14; }
    doc.setFont('helvetica', 'bold'); doc.text('Ayünka Borda Crea', W - M, y, { align: 'right' }); doc.setFont('helvetica', 'normal');
    let by = y + 14; doc.text('@ayunka.borda.crea', W - M, by, { align: 'right' }); by += 14;
    doc.text('+56 9 8542 1490', W - M, by, { align: 'right' }); by += 14;

    y = Math.max(cy, by) + 14; const cX = [M, W - M - 200, W - M - 105, W - M];
    doc.setFillColor(...PZ); doc.rect(M - 6, y - 14, W - 2 * M + 12, 22, 'F'); doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
    doc.text('DETALLE', cX[0], y); doc.text('CANT.', cX[1], y, { align: 'right' }); doc.text('UNITARIO', cX[2], y, { align: 'right' }); doc.text('SUBTOTAL', cX[3], y, { align: 'right' });
    y += 22; doc.setTextColor(...CB); doc.setFont('helvetica', 'normal'); doc.setFontSize(10);

    const nombreItem = (cot.archivoOrigen || 'Pieza personalizada').replace(/\.3mf$/i, '');
    doc.text(String(nombreItem).slice(0, 52), cX[0], y); doc.text(String(cot.cantidad), cX[1], y, { align: 'right' });
    doc.text(CLP(cot.precioUnit), cX[2], y, { align: 'right' }); doc.text(CLP(cot.total), cX[3], y, { align: 'right' });
    doc.setDrawColor(225, 219, 205); doc.line(M - 6, y + 7, W - M + 6, y + 7); y += 24;
    y += 8;

    doc.setFillColor(...CO); doc.rect(W - M - 200, y - 15, 200, 28, 'F'); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text('TOTAL', W - M - 120, y + 3, { align: 'right' }); doc.text(CLP(cot.total), W - M - 8, y + 3, { align: 'right' }); doc.setTextColor(...CB); y += 44;

    const abonoPct = DB.params.abonoPct != null ? DB.params.abonoPct : 0.5;
    const abono = Math.round(cot.total * abonoPct / 100) * 100, saldo = cot.total - abono;
    doc.setDrawColor(...PZ); doc.setFillColor(246, 242, 233); doc.roundedRect(M, y - 2, W - 2 * M, 86, 6, 6, 'FD');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.text('Condiciones', M + 14, y + 16);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.8);
    doc.text('• Forma de pago: ' + Math.round(abonoPct * 100) + '% de abono para iniciar (' + CLP(abono) + '), saldo de ' + CLP(saldo) + ' contra entrega.', M + 14, y + 32);
    doc.text('• Entrega estimada: ' + A.fecha(cot.entrega) + (cot.llevaPausa ? ' (lleva pausa para chip NFC).' : '.'), M + 14, y + 48);
    doc.text('• Los pedidos grandes pueden requerir más días; el plazo se confirma al encargar.', M + 14, y + 64);
    doc.text('• Cotización válida hasta el ' + A.fecha(cot.validoHasta) + '.', M + 14, y + 80);
    y += 104;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...PZ);
    doc.text('Ayünka Borda Crea', M, 812); doc.text('Bordamos. Creamos. Siempre con cariño.', W - M, 812, { align: 'right' });
    doc.save('Cotizacion-' + cot.id + '.pdf');
  }

  window.PDF = { genQuotePDF };
})();
