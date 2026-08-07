/**
 * order-ticket.print.js
 * -----------------------------------------------------------------------
 * Renders a printable ticket that mirrors the shop's original paper
 * service-order stationery (folio/fecha header, client/vehicle fields,
 * concepts table, totals) so the digital order can still produce the
 * same physical handoff document staff and clients already recognize —
 * now with the full business letterhead (email/RFC/sitio web when
 * configured) and the IVA/ISR/descuento breakdown. Opens in a new tab
 * and calls print() — the user can "Save as PDF" from the browser's
 * print dialog with no extra library needed.
 */

import { formatCurrency, formatDate } from '../../core/utils.js';
import { getEffectiveBusiness } from '../../core/settings.service.js';
import { ORDER_STATUS_META } from '../../config/constants.js';

export function printOrderTicket(order) {
  const business = getEffectiveBusiness();

  const rows = (order.partsItems || []).map((r) => `
    <tr>
      <td>${r.description || ''}</td>
      <td style="text-align:center">${r.quantity ?? ''}</td>
      <td style="text-align:right">${formatCurrency(r.unitPrice)}</td>
      <td style="text-align:right">${formatCurrency((r.quantity || 0) * (r.unitPrice || 0))}</td>
    </tr>`).join('');

  const contactLines = [
    business.addressFull,
    [business.phone && `Tel: ${business.phone}`, business.email].filter(Boolean).join(' · '),
    [business.rfc && `RFC: ${business.rfc}`, business.website].filter(Boolean).join(' · ')
  ].filter((line) => line && line.trim()).map((line) => `<p>${line}</p>`).join('');

  const statusLabel = ORDER_STATUS_META[order.status]?.label || order.status;

  const win = window.open('', '_blank', 'width=480,height=720');
  // win starts as a blank document (no URL of its own — see the
  // about:blank tab title after opening), so a relative logoHd path has
  // nothing to resolve against and 404s. new URL(path, location.href)
  // resolves it against *this* page's real address instead — correctly
  // rebuilding "https://<host>/<repo-subpath>/assets/logo-hd.png" (not
  // just location.origin + path, which drops the GitHub Pages repo
  // subpath entirely). If logoHd is already an absolute URL (a custom
  // logo uploaded in Configuración, stored as a full Firebase Storage
  // URL), the same call just returns it unchanged.
  const logoUrl = new URL(business.logoHd, location.href).href;
  win.document.write(`
    <!DOCTYPE html>
    <html lang="es-MX"><head><meta charset="UTF-8" />
    <title>${order.folioLabel}</title>
    <style>
      body { font-family: Arial, sans-serif; color:#111; padding: 16px; }
      .header { display:flex; align-items:center; gap:12px; border-bottom:2px solid #111; padding-bottom:8px; }
      .header img { height:56px; }
      .header h2 { margin:0; font-size:16px; }
      .header p { margin:2px 0; font-size:11px; }
      .folio-box { margin-left:auto; text-align:right; font-size:12px; }
      .folio-box strong { display:block; font-size:14px; }
      table { width:100%; border-collapse:collapse; margin-top:12px; font-size:12px; }
      th, td { border:1px solid #999; padding:4px 6px; }
      th { background:#eee; }
      .field-row { font-size:12px; margin:4px 0; }
      .totals { margin-top:8px; font-size:13px; }
      .totals p { margin: 2px 0; text-align: right; }
      .total { text-align:right; font-size:16px; font-weight:bold; margin-top:6px; }
      @media print { .no-print { display:none; } }
    </style>
    </head><body>
      <div class="header">
        <img src="${logoUrl}" alt="logo" />
        <div>
          <h2>${business.name}</h2>
          <p>${business.slogan}</p>
          ${contactLines}
        </div>
        <div class="folio-box">
          <strong>${order.folioLabel}</strong>
          ${formatDate(order.createdAt)}
          <div>${statusLabel}</div>
        </div>
      </div>

      <div class="field-row"><strong>Cliente:</strong> ${order.clientName || ''} &nbsp; <strong>Tel:</strong> ${order.clientPhone || ''}</div>
      <div class="field-row"><strong>Vehículo:</strong> ${order.vehicleLabel || ''} &nbsp; <strong>Placas:</strong> ${order.vehiclePlates || ''} &nbsp; <strong>Color:</strong> ${order.vehicleColor || ''}${order.unitNumber ? ` &nbsp; <strong>Número de unidad:</strong> ${order.unitNumber}` : ''}</div>
      <div class="field-row"><strong>Kilometraje:</strong> ${order.mileage || '—'} km</div>
      <div class="field-row"><strong>Servicio solicitado:</strong> ${order.serviceRequested || '—'}</div>
      ${order.diagnosis ? `<div class="field-row"><strong>Diagnóstico:</strong> ${order.diagnosis}</div>` : ''}
      ${order.serviceDone ? `<div class="field-row"><strong>Servicio realizado:</strong> ${order.serviceDone}</div>` : ''}
      <div class="field-row"><strong>Observaciones:</strong> ${order.notes || '—'}</div>

      <table>
        <thead><tr><th>Concepto</th><th>Cant.</th><th>P. Unitario</th><th>Importe</th></tr></thead>
        <tbody>
          ${rows || '<tr><td colspan="4" style="text-align:center">Sin conceptos</td></tr>'}
          <tr><td colspan="3" style="text-align:right"><strong>Mano de obra</strong></td><td style="text-align:right">${formatCurrency(order.laborCost)}</td></tr>
        </tbody>
      </table>

      <div class="totals">
        <p>Subtotal: <strong>${formatCurrency(order.subtotal ?? order.total)}</strong></p>
        ${order.discount > 0 ? `<p>Descuento: <strong>-${formatCurrency(order.discount)}</strong></p>` : ''}
        ${order.taxEnabled ? `<p>IVA (${order.taxRate ?? 0}%): <strong>${formatCurrency(order.tax)}</strong></p>` : ''}
        ${order.isrEnabled ? `<p>Retención ISR (${order.isrRate ?? 0}%): <strong>-${formatCurrency(order.isr)}</strong></p>` : ''}
        ${order.extraDiscount > 0 ? `<p>Descuento adicional: <strong>-${formatCurrency(order.extraDiscount)}</strong></p>` : ''}
      </div>
      <div class="total">TOTAL: ${formatCurrency(order.total)}</div>

      <button class="no-print" onclick="window.print()" style="margin-top:16px;padding:8px 16px">Imprimir</button>
    </body></html>
  `);
  win.document.close();
}
