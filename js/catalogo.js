/* Ayünka Studio — el catálogo para publicar.
 *
 * Encargo del 2-sep, punto B: "Que Studio sea la fuente única de precios". Hoy el precio
 * se edita en tres lados (la app, el CSV de Meta, el XLSX de WhatsApp) y esa es exactamente
 * la clase de desorden que ya pasó una vez. De acá en adelante el precio se pone en Studio
 * y de él SALEN los dos archivos — nunca se editan a mano.
 *
 * El CSV respeta el formato que ya usa Meta Commerce Manager (SUPERVISION.md, y el que
 * vive en ../catalogo/catalogo-meta-importar.csv):
 *   id,title,description,availability,condition,price,link,image_link,brand
 *
 * El XLSX se escribe a mano, sin librería — reutiliza el mismo zip()/crc32() que
 * D3D3MF ya usa para el 3MF (misma familia de formato: OOXML es un ZIP de XML).
 */
(function () {
  'use strict';
  const esc = window.A.esc;
  const IG_POR_DEFECTO = 'https://www.instagram.com/ayunka.borda.crea/';

  function linkInstagram() {
    const ig = (DB.params.negocio || {}).ig || '';
    return /^https?:\/\//i.test(ig) ? ig : IG_POR_DEFECTO;
  }

  /* ---------- CSV para Meta Commerce Manager ---------- */

  function campoCSV(v) {
    const s = (v == null) ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function generarCSV(productos) {
    const cab = ['id', 'title', 'description', 'availability', 'condition', 'price', 'link', 'image_link', 'brand'];
    const link = linkInstagram();
    const filas = productos.map(p => [
      p.sku || p.id, p.nombre || '', p.descripcion || '', 'in stock', 'new',
      (typeof p.precio === 'number') ? Math.round(p.precio) + ' CLP' : '',
      link, p.foto || '', 'Ayünka'
    ].map(campoCSV).join(','));
    // BOM al inicio: sin él, Excel y el importador de Meta muestran mal los acentos.
    return '﻿' + [cab.join(','), ...filas].join('\r\n') + '\r\n';
  }

  /* ---------- XLSX para la planilla de WhatsApp ---------- */

  function colLetra(n) {
    let s = '';
    n++;
    while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
    return s;
  }

  function celdaTexto(col, fila, texto, estilo) {
    return `<c r="${col}${fila}" t="inlineStr"${estilo ? ` s="${estilo}"` : ''}><is><t xml:space="preserve">${esc(texto)}</t></is></c>`;
  }
  function celdaNumero(col, fila, num, estilo) {
    return (typeof num === 'number' && isFinite(num))
      ? `<c r="${col}${fila}" t="n"${estilo ? ` s="${estilo}"` : ''}><v>${num}</v></c>` : '';
  }

  function hojaCatalogo(productos, categorias) {
    const CATS = ['SKU', 'Categoría', 'Producto', 'Descripción', 'PRECIO (CLP)', 'Imagen (URL)'];
    let filas = 1;
    let xml = `<row r="1">${CATS.map((t, i) => celdaTexto(colLetra(i), 1, t, i === 4 ? 2 : 1)).join('')}</row>\n`;
    productos.forEach(p => {
      filas++;
      const cat = (categorias && categorias[p.categoria]) || p.categoria || '';
      xml += `<row r="${filas}">` +
        celdaTexto('A', filas, p.sku || p.id) +
        celdaTexto('B', filas, cat) +
        celdaTexto('C', filas, p.nombre || '') +
        celdaTexto('D', filas, p.descripcion || '') +
        (typeof p.precio === 'number' ? celdaNumero('E', filas, Math.round(p.precio), 3) : `<c r="E${filas}" s="3"/>`) +
        celdaTexto('F', filas, p.foto || '') +
        `</row>\n`;
    });
    return { xml, filas };
  }

  function hojaInstrucciones() {
    const LINEAS = [
      'Cómo cargar este catálogo',
      '',
      'Opción A — desde el celular (simple):',
      'WhatsApp Business → Configuración → Herramientas para la empresa → Catálogo → Agregar artículo.',
      'Descarga la imagen desde la URL de esta planilla, y copia nombre / precio / descripción.',
      '',
      'Opción B — importar de una:',
      'business.facebook.com/commerce → crear catálogo → Fuentes de datos → Subir archivo →',
      'usa el CSV que Ayünka Studio genera junto con este XLSX, no este archivo.',
      '',
      'Este archivo se genera solo desde Ayünka Studio (Ajustes → Catálogo para publicar).',
      'No lo edites a mano: la próxima vez que lo regeneres, se pisa entero.',
      'Si un precio está en blanco es porque todavía no está puesto en Studio — ponlo ahí,',
      'no acá.'
    ];
    let xml = '';
    LINEAS.forEach((linea, i) => { xml += `<row r="${i + 1}">${celdaTexto('A', i + 1, linea, i === 0 ? 1 : 0)}</row>\n`; });
    return xml;
  }

  const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/><bgColor indexed="64"/></patternFill></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="4">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
    <xf numFmtId="0" fontId="0" fillId="2" borderId="0" xfId="0" applyFill="1"/>
  </cellXfs>
</styleSheet>`;

  function generarXLSX(productos, categorias) {
    const enc = new TextEncoder();
    const cat = hojaCatalogo(productos, categorias);
    const instr = hojaInstrucciones();

    const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Catálogo" sheetId="1" r:id="rId1"/><sheet name="Instrucciones" sheetId="2" r:id="rId2"/></sheets>
</workbook>`;
    const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
    const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;
    const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
    const sheet1 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>\n${cat.xml}</sheetData></worksheet>`;
    const sheet2 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>\n${instr}</sheetData></worksheet>`;

    const datos = window.D3D3MF.zip([
      { nombre: '[Content_Types].xml', datos: enc.encode(contentTypes) },
      { nombre: '_rels/.rels', datos: enc.encode(rootRels) },
      { nombre: 'xl/workbook.xml', datos: enc.encode(workbook) },
      { nombre: 'xl/_rels/workbook.xml.rels', datos: enc.encode(workbookRels) },
      { nombre: 'xl/styles.xml', datos: enc.encode(STYLES) },
      { nombre: 'xl/worksheets/sheet1.xml', datos: enc.encode(sheet1) },
      { nombre: 'xl/worksheets/sheet2.xml', datos: enc.encode(sheet2) }
    ]);
    return { nombre: 'catalogo-whatsapp-ayunka.xlsx', datos, filas: cat.filas - 1 };
  }

  window.Catalogo = { generarCSV, generarXLSX, linkInstagram, colLetra };
})();
