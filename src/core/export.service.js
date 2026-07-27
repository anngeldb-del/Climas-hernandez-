/**
 * export.service.js
 * -----------------------------------------------------------------------
 * Generic "export this table" helpers shared by the reports module (and
 * usable by any future one). Deliberately dependency-free for CSV/Excel:
 *
 *   - CSV is just text.
 *   - "Excel" export writes the Excel 2003 XML Spreadsheet format
 *     (SpreadsheetML) by hand — Excel/LibreOffice/Google Sheets all open
 *     it natively as a real spreadsheet with typed cells, so there is no
 *     need to ship a charting-grade library like SheetJS just to produce
 *     a rows-and-columns report.
 *   - PDF reuses jsPDF (already a dependency for quotes) via dynamic
 *     import, so screens that never export a PDF never download it.
 */

import { csvFromRows, downloadBlob } from './utils.js';

export function exportCSV(rows, headers, filename) {
  const csv = csvFromRows(rows, headers);
  downloadBlob(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }), filename.endsWith('.csv') ? filename : `${filename}.csv`);
}

function xmlEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
}

export function exportExcel(rows, headers, filename) {
  const headerRow = `<Row>${headers.map((h) => `<Cell><Data ss:Type="String">${xmlEscape(h)}</Data></Cell>`).join('')}</Row>`;
  const dataRows = rows.map((row) => `<Row>${headers.map((h) => {
    const value = row[h];
    const isNumber = typeof value === 'number';
    return `<Cell><Data ss:Type="${isNumber ? 'Number' : 'String'}">${xmlEscape(value)}</Data></Cell>`;
  }).join('')}</Row>`).join('');

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="Reporte">
    <Table>${headerRow}${dataRows}</Table>
  </Worksheet>
</Workbook>`;

  downloadBlob(new Blob([xml], { type: 'application/vnd.ms-excel' }), filename.endsWith('.xls') ? filename : `${filename}.xls`);
}

export async function exportPDF(rows, headers, filename, title) {
  const { jsPDF } = await import('https://esm.sh/jspdf@2.5.2');
  const doc = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'landscape' });
  const marginX = 12;
  let y = 15;

  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text(title, marginX, y);
  y += 8;

  const colWidth = (270 - marginX * 2) / headers.length;
  doc.setFontSize(9);
  doc.setFillColor(238, 241, 244);
  doc.rect(marginX, y, colWidth * headers.length, 6, 'F');
  doc.setFont(undefined, 'bold');
  headers.forEach((h, i) => doc.text(String(h), marginX + i * colWidth + 1, y + 4));
  y += 8;

  doc.setFont(undefined, 'normal');
  for (const row of rows) {
    headers.forEach((h, i) => doc.text(String(row[h] ?? ''), marginX + i * colWidth + 1, y));
    y += 6;
    if (y > 190) { doc.addPage('letter', 'landscape'); y = 15; }
  }

  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}
