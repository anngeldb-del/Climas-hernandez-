/**
 * order-ticket.print.js
 * -----------------------------------------------------------------------
 * Renders a printable ticket that mirrors the shop's original paper
 * service-order stationery (folio/fecha header, client/vehicle fields,
 * concepts table, total) so the digital order can still produce the
 * same physical handoff document staff and clients already recognize.
 * Opens in a new tab and calls print() — the user can "Save as PDF" from
 * the browser's print dialog with no extra library needed.
 */

import { BUSINESS } from '../../config/constants.js';
import { formatCurrency, formatDate } from '../../core/utils.js';

export function printOrderTicket(order) {
  const rows = (order.partsItems || []).map((r) => `
    <tr>
      <td>${r.description || ''}</td>
      <td style="text-align:center">${r.quantity ?? ''}</td>
      <td style="text-align:right">${formatCurrency(r.unitPrice)}</td>
      <td style="text-align:right">${formatCurrency((r.quantity || 0) * (r.unitPrice || 0))}</td>
    </tr>`).join('');

  const win = window.open('', '_blank', 'width=480,height=720');
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
      .total { text-align:right; font-size:15px; font-weight:bold; margin-top:8px; }
      @media print { .no-print { display:none; } }
    </style>
    </head><body>
      <div class="header">
        <img src="${location.origin}/${BUSINESS.logo.default}" alt="logo" />
        <div>
          <h2>${BUSINESS.name}</h2>
          <p>${BUSINESS.slogan}</p>
          <p>${BUSINESS.address.full} · ${BUSINESS.phone}</p>
        </div>
        <div class="folio-box">
          <strong>${order.folioLabel}</strong>
          ${formatDate(order.createdAt)}
        </div>
      </div>

      <div class="field-row"><strong>Cliente:</strong> ${order.clientName || ''} &nbsp; <strong>Tel:</strong> ${order.clientPhone || ''}</div>
      <div class="field-row"><strong>Vehículo:</strong> ${order.vehicleLabel || ''} &nbsp; <strong>Placas:</strong> ${order.vehiclePlates || ''} &nbsp; <strong>Color:</strong> ${order.vehicleColor || ''}</div>
      <div class="field-row"><strong>Kilometraje:</strong> ${order.mileage || '—'} km</div>
      <div class="field-row"><strong>Observaciones:</strong> ${order.serviceRequested || order.diagnosis || ''}</div>

      <table>
        <thead><tr><th>Concepto</th><th>Cant.</th><th>P. Unitario</th><th>Importe</th></tr></thead>
        <tbody>
          ${rows || '<tr><td colspan="4" style="text-align:center">Sin conceptos</td></tr>'}
          <tr><td colspan="3" style="text-align:right"><strong>Mano de obra</strong></td><td style="text-align:right">${formatCurrency(order.laborCost)}</td></tr>
        </tbody>
      </table>
      <div class="total">TOTAL: ${formatCurrency(order.total)}</div>

      <button class="no-print" onclick="window.print()" style="margin-top:16px;padding:8px 16px">Imprimir</button>
    </body></html>
  `);
  win.document.close();
}
