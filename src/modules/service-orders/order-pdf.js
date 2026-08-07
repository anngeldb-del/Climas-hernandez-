/**
 * order-pdf.js
 * -----------------------------------------------------------------------
 * Builds a professional, printable PDF for a service order: logo, business
 * data, client/vehicle (incl. número de unidad), refacciones/productos,
 * mano de obra, observaciones, fecha, firma del cliente (if captured),
 * total and IVA (if applicable). Mirrors quotes/quote-pdf.js's structure
 * so the two document types stay visually consistent — see that file's
 * header comment for the reasoning behind the dynamic-import + shared
 * "build the doc once" pattern.
 */

import { formatCurrency, formatDate } from '../../core/utils.js';
import { getEffectiveBusiness } from '../../core/settings.service.js';

let jsPDFCtor = null;

async function ensureLibs() {
  if (!jsPDFCtor) {
    const mod = await import('https://esm.sh/jspdf@2.5.2');
    jsPDFCtor = mod.jsPDF;
  }
}

async function loadImageAsDataUrl(path) {
  const response = await fetch(path);
  const blob = await response.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

/**
 * Assembles the jsPDF document for a service order. Does not save/download —
 * callers decide what to do with the result (see generateOrderPdf / getOrderPdfFile below).
 * @param {object} order {folioLabel, createdAt, clientName, clientPhone, vehicleLabel,
 *   unitNumber, serviceRequested, partsItems, laborCost, subtotal, discount, taxEnabled,
 *   taxRate, tax, isrEnabled, isrRate, isr, extraDiscount, total, notes, signatureClientUrl}
 */
export async function buildOrderPdfDoc(order) {
  await ensureLibs();
  const business = getEffectiveBusiness();
  const doc = new jsPDFCtor({ unit: 'mm', format: 'letter' });
  const marginX = 15;
  let y = 15;

  try {
    const logoDataUrl = await loadImageAsDataUrl(business.logoHd);
    doc.addImage(logoDataUrl, 'PNG', marginX, y, 22, 22);
  } catch {
    // Logo fetch can fail offline; the PDF is still useful without it.
  }

  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text(business.name, marginX + 26, y + 6);
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.text(business.slogan, marginX + 26, y + 11);
  doc.text(business.addressFull, marginX + 26, y + 16);
  doc.text(`Tel: ${business.phone}`, marginX + 26, y + 21);

  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text(`Orden de servicio ${order.folioLabel}`, 150, y + 6);
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.text(formatDate(order.createdAt), 150, y + 11);

  y += 30;
  doc.setDrawColor(200);
  doc.line(marginX, y, 195, y);
  y += 7;

  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.text('Cliente:', marginX, y);
  doc.setFont(undefined, 'normal');
  doc.text(order.clientName || '—', marginX + 20, y);
  doc.setFont(undefined, 'bold');
  doc.text('Teléfono:', 120, y);
  doc.setFont(undefined, 'normal');
  doc.text(order.clientPhone || '—', 140, y);

  y += 6;
  doc.setFont(undefined, 'bold');
  doc.text('Vehículo:', marginX, y);
  doc.setFont(undefined, 'normal');
  doc.text(order.vehicleLabel || '—', marginX + 20, y);
  if (order.unitNumber) {
    doc.setFont(undefined, 'bold');
    doc.text('Número de unidad:', 120, y);
    doc.setFont(undefined, 'normal');
    doc.text(String(order.unitNumber), 158, y);
  }

  if (order.serviceRequested) {
    y += 6;
    doc.setFont(undefined, 'bold');
    doc.text('Servicio:', marginX, y);
    doc.setFont(undefined, 'normal');
    const serviceLines = doc.splitTextToSize(String(order.serviceRequested), 160);
    doc.text(serviceLines, marginX + 20, y);
    y += Math.max(0, (serviceLines.length - 1) * 5);
  }

  y += 10;
  doc.setFillColor(238, 241, 244);
  doc.rect(marginX, y, 180, 7, 'F');
  doc.setFont(undefined, 'bold');
  doc.text('Concepto', marginX + 2, y + 5);
  doc.text('Cant.', 130, y + 5);
  doc.text('P. Unitario', 148, y + 5);
  doc.text('Importe', 175, y + 5);
  y += 10;

  doc.setFont(undefined, 'normal');
  for (const item of order.partsItems || []) {
    doc.text(String(item.description || ''), marginX + 2, y);
    doc.text(String(item.quantity ?? ''), 130, y);
    doc.text(formatCurrency(item.unitPrice), 148, y);
    doc.text(formatCurrency((item.quantity || 0) * (item.unitPrice || 0)), 175, y);
    y += 6;
    if (y > 245) { doc.addPage(); y = 20; }
  }
  if (order.laborCost > 0) {
    doc.text('Mano de obra', marginX + 2, y);
    doc.text(formatCurrency(order.laborCost), 175, y);
    y += 6;
  }

  // Labels are right-aligned ending at TOTALS_LABEL_X and values right-aligned
  // ending at TOTALS_VALUE_X — see quote-pdf.js's identical comment for why.
  const TOTALS_LABEL_X = 172;
  const TOTALS_VALUE_X = 195;
  function totalsLine(label, value) {
    doc.text(label, TOTALS_LABEL_X, y, { align: 'right' });
    doc.text(value, TOTALS_VALUE_X, y, { align: 'right' });
  }

  if (y > 240) { doc.addPage(); y = 20; }
  y += 4;
  doc.line(120, y, 195, y);
  y += 6;
  totalsLine('Subtotal:', formatCurrency(order.subtotal));
  if (order.discount > 0) {
    y += 6;
    totalsLine('Descuento:', `-${formatCurrency(order.discount)}`);
  }
  if (order.taxEnabled) {
    y += 6;
    totalsLine(`IVA (${order.taxRate ?? 0}%):`, formatCurrency(order.tax));
  }
  if (order.isrEnabled) {
    y += 6;
    totalsLine(`Retención ISR (${order.isrRate ?? 0}%):`, `-${formatCurrency(order.isr)}`);
  }
  if (order.extraDiscount > 0) {
    y += 6;
    totalsLine('Descuento adicional:', `-${formatCurrency(order.extraDiscount)}`);
  }
  y += 7;
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  totalsLine('TOTAL:', formatCurrency(order.total));

  if (order.notes) {
    y += 12;
    if (y > 255) { doc.addPage(); y = 20; }
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.text('Observaciones:', marginX, y);
    doc.setFont(undefined, 'normal');
    const noteLines = doc.splitTextToSize(String(order.notes), 180);
    doc.text(noteLines, marginX, y + 5);
    y += 5 + noteLines.length * 5;
  }

  if (order.signatureClientUrl) {
    y += 8;
    if (y > 230) { doc.addPage(); y = 20; }
    try {
      doc.addImage(order.signatureClientUrl, 'PNG', marginX, y, 60, 25);
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text('Firma del cliente', marginX, y + 29);
      doc.setTextColor(0);
    } catch (error) {
      console.warn('[order-pdf] signature image failed to embed', error);
    }
  }

  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(`Folio: ${order.folioLabel} · ${business.name}`, marginX, 280);

  return doc;
}

/** Builds the PDF and triggers a browser download. */
export async function generateOrderPdf(order) {
  const doc = await buildOrderPdfDoc(order);
  doc.save(`${order.folioLabel}.pdf`);
}

/** Builds the PDF as a File — used to share/attach it (see service-orders.detail.js). */
export async function getOrderPdfFile(order) {
  const doc = await buildOrderPdfDoc(order);
  const blob = doc.output('blob');
  return new File([blob], `${order.folioLabel}.pdf`, { type: 'application/pdf' });
}
