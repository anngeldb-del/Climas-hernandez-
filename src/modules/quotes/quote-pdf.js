/**
 * quote-pdf.js
 * -----------------------------------------------------------------------
 * Builds a professional, printable PDF for a quote: logo, business data,
 * client/vehicle, itemized concepts, IVA and ISR retention (both
 * optional), total, a WhatsApp confirmation QR code, and the client's
 * signature if one was captured.
 *
 * jsPDF and the QR generator are dynamically imported only when a quote
 * is actually exported, so no other screen pays their download cost.
 * `buildQuotePdfDoc` is the single place the document gets assembled —
 * downloading and emailing/sharing both reuse it instead of building the
 * PDF twice.
 */

import { BUSINESS } from '../../config/constants.js';
import { formatCurrency, formatDate, waLink } from '../../core/utils.js';

let jsPDFCtor = null;
let qrToDataURL = null;

async function ensureLibs() {
  if (!jsPDFCtor) {
    const mod = await import('https://esm.sh/jspdf@2.5.2');
    jsPDFCtor = mod.jsPDF;
  }
  if (!qrToDataURL) {
    const mod = await import('https://esm.sh/qrcode@1.5.3');
    qrToDataURL = (mod.default || mod).toDataURL;
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
 * Assembles the jsPDF document for a quote. Does not save/download —
 * callers decide what to do with the result (save to disk, turn into a
 * Blob/File for sharing, etc).
 * @param {object} quote {folioLabel, createdAt, clientName, clientPhone, vehicleLabel, items, taxEnabled, subtotal, tax, isrEnabled, isrRate, isr, total, signatureUrl}
 */
export async function buildQuotePdfDoc(quote) {
  await ensureLibs();
  const doc = new jsPDFCtor({ unit: 'mm', format: 'letter' });
  const marginX = 15;
  let y = 15;

  try {
    const logoDataUrl = await loadImageAsDataUrl(BUSINESS.logo.hd);
    doc.addImage(logoDataUrl, 'PNG', marginX, y, 22, 22);
  } catch {
    // Logo fetch can fail offline; the PDF is still useful without it.
  }

  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text(BUSINESS.name, marginX + 26, y + 6);
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.text(BUSINESS.slogan, marginX + 26, y + 11);
  doc.text(BUSINESS.address.full, marginX + 26, y + 16);
  doc.text(`Tel: ${BUSINESS.phone}`, marginX + 26, y + 21);

  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text(`Cotización ${quote.folioLabel}`, 150, y + 6);
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.text(formatDate(quote.createdAt), 150, y + 11);

  y += 30;
  doc.setDrawColor(200);
  doc.line(marginX, y, 195, y);
  y += 7;

  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.text('Cliente:', marginX, y);
  doc.setFont(undefined, 'normal');
  doc.text(quote.clientName || '—', marginX + 20, y);
  doc.setFont(undefined, 'bold');
  doc.text('Teléfono:', 120, y);
  doc.setFont(undefined, 'normal');
  doc.text(quote.clientPhone || '—', 140, y);

  y += 6;
  doc.setFont(undefined, 'bold');
  doc.text('Vehículo:', marginX, y);
  doc.setFont(undefined, 'normal');
  doc.text(quote.vehicleLabel || '—', marginX + 20, y);

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
  for (const item of quote.items || []) {
    doc.text(String(item.description || ''), marginX + 2, y);
    doc.text(String(item.quantity ?? ''), 130, y);
    doc.text(formatCurrency(item.unitPrice), 148, y);
    doc.text(formatCurrency((item.quantity || 0) * (item.unitPrice || 0)), 175, y);
    y += 6;
    if (y > 250) { doc.addPage(); y = 20; }
  }

  y += 4;
  doc.line(120, y, 195, y);
  y += 6;
  doc.text('Subtotal:', 148, y);
  doc.text(formatCurrency(quote.subtotal), 175, y);
  if (quote.taxEnabled) {
    y += 6;
    doc.text('IVA (16%):', 148, y);
    doc.text(formatCurrency(quote.tax), 175, y);
  }
  if (quote.isrEnabled) {
    y += 6;
    doc.text(`Retención ISR (${quote.isrRate}%):`, 148, y);
    doc.text(`-${formatCurrency(quote.isr)}`, 175, y);
  }
  y += 7;
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text('TOTAL:', 148, y);
  doc.text(formatCurrency(quote.total), 175, y);

  y += 14;
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.text('Escanea para confirmar por WhatsApp:', marginX, y + 20);
  try {
    const qrDataUrl = await qrToDataURL(
      waLink(BUSINESS.phone, `Hola, quiero confirmar la cotización ${quote.folioLabel}`),
      { margin: 1, width: 200 }
    );
    doc.addImage(qrDataUrl, 'PNG', marginX, y + 22, 24, 24);
  } catch (error) {
    console.warn('[quote-pdf] QR generation failed', error);
  }

  doc.text('Firma de conformidad:', 110, y + 20);
  if (quote.signatureUrl) {
    try {
      const sigDataUrl = await loadImageAsDataUrl(quote.signatureUrl);
      doc.addImage(sigDataUrl, 'PNG', 110, y + 22, 60, 24);
    } catch { /* fall through to blank line below */ }
  } else {
    doc.line(110, y + 40, 190, y + 40);
  }

  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text('Esta cotización tiene una vigencia de 15 días naturales a partir de su fecha de emisión.', marginX, 280);

  return doc;
}

/** Builds the PDF and triggers a browser download. */
export async function generateQuotePdf(quote) {
  const doc = await buildQuotePdfDoc(quote);
  doc.save(`${quote.folioLabel}.pdf`);
}

/** Builds the PDF as a File — used to share/attach it (see quotes.module.js sendQuoteByEmail). */
export async function getQuotePdfFile(quote) {
  const doc = await buildQuotePdfDoc(quote);
  const blob = doc.output('blob');
  return new File([blob], `${quote.folioLabel}.pdf`, { type: 'application/pdf' });
}
