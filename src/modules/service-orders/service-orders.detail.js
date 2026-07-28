/**
 * service-orders.detail.js
 * -----------------------------------------------------------------------
 * The #/service-orders/{id} screen: status stepper, info/costs, photos,
 * and signature capture. Split out of service-orders.module.js since it
 * was the largest chunk of that file. Signature pads are handed back to
 * the caller via onSignaturePad so service-orders.module.js can still
 * destroy() them from its own unmount() — see the memory-leak fix in
 * signature-pad.js.
 */

import { getOrder, updateOrder, setOrderStatus } from './service-orders.service.js';
import { ORDER_STATUS, ORDER_STATUS_META, ORDER_STATUS_FLOW } from '../../config/constants.js';
import { createPhotoUploader } from '../../components/ui/file-upload.js';
import { createSignaturePad } from '../../components/ui/signature-pad.js';
import { canvasToFile, uploadPhoto } from '../../core/storage.service.js';
import { showToast } from '../../components/ui/toast.js';
import { icon } from '../../components/ui/icons.js';
import { navigate } from '../../core/router.js';
import { formatDate, formatCurrency, escapeHtml } from '../../core/utils.js';
import { printOrderTicket } from './order-ticket.print.js';

function renderStepper(container, order, onChanged) {
  const el = container.querySelector('#status-stepper');
  const currentIndex = ORDER_STATUS_FLOW.indexOf(order.status);
  el.innerHTML = `
    <div class="stepper">
      ${ORDER_STATUS_FLOW.map((status, i) => `
        <span class="stepper__step ${i < currentIndex ? 'done' : ''} ${i === currentIndex ? 'current' : ''}" data-status="${status}" style="cursor:pointer">
          ${ORDER_STATUS_META[status].label}
        </span>
        ${i < ORDER_STATUS_FLOW.length - 1 ? '<span class="stepper__sep"></span>' : ''}
      `).join('')}
    </div>
    <div class="flex gap-2" style="margin-top:12px">
      <button class="btn btn--sm btn--outline" data-status="${ORDER_STATUS.GARANTIA}">Marcar en garantía</button>
      <button class="btn btn--sm btn--danger" data-status="${ORDER_STATUS.CANCELADO}">Cancelar orden</button>
    </div>
  `;
  el.querySelectorAll('[data-status]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await setOrderStatus(order.id, btn.dataset.status);
      showToast('Estado actualizado', 'success');
      onChanged();
    });
  });
}

export async function mountOrderDetail(container, orderId, { onSignaturePad }) {
  container.innerHTML = '<div class="skeleton" style="height:480px"></div>';
  const order = await getOrder(orderId);
  if (!order) { container.innerHTML = '<div class="empty-state">Orden no encontrada.</div>'; return; }

  const meta = ORDER_STATUS_META[order.status] || { label: order.status, color: 'neutral' };
  const rerender = () => mountOrderDetail(container, orderId, { onSignaturePad });

  container.innerHTML = `
    <div class="page-header">
      <div class="flex items-center gap-3">
        <button class="btn btn--icon btn--ghost" id="back">${icon('chevronRight', { className: 'rotate-180' })}</button>
        <div>
          <h1 class="mb-0">${escapeHtml(order.folioLabel)}</h1>
          <p class="mb-0 text-sm">${escapeHtml(order.clientName || '')} · ${escapeHtml(order.vehicleLabel || '')} · <span class="badge badge--${meta.color}">${meta.label}</span></p>
        </div>
      </div>
      <div class="flex gap-2">
        <button class="btn btn--outline" id="print-btn">${icon('order', { size: 16 })} Imprimir</button>
      </div>
    </div>

    <div class="card section" id="status-stepper"></div>

    <div class="tabs">
      <div class="tab active" data-tab="info">Información</div>
      <div class="tab" data-tab="photos">Fotografías</div>
      <div class="tab" data-tab="signatures">Firmas</div>
    </div>

    <div id="tab-info">
      <div class="grid grid--2">
        <div class="card">
          <h3>Detalles</h3>
          <p class="text-sm"><strong>Kilometraje:</strong> ${Number.isFinite(Number(order.mileage)) && order.mileage != null ? Number(order.mileage) : '—'} km</p>
          <p class="text-sm"><strong>Técnico:</strong> ${escapeHtml(order.technicianName || 'Sin asignar')}</p>
          <p class="text-sm"><strong>Tiempo estimado:</strong> ${escapeHtml(order.estimatedTime || '—')}</p>
          <p class="text-sm"><strong>Entrega estimada:</strong> ${order.estimatedDelivery ? formatDate(order.estimatedDelivery) : '—'}</p>
          <p class="text-sm"><strong>Diagnóstico:</strong> ${escapeHtml(order.diagnosis || '—')}</p>
          <p class="text-sm"><strong>Servicio solicitado:</strong> ${escapeHtml(order.serviceRequested || '—')}</p>
          <p class="text-sm"><strong>Servicio realizado:</strong> ${escapeHtml(order.serviceDone || '—')}</p>
          <p class="text-sm"><strong>Observaciones:</strong> ${escapeHtml(order.notes || '—')}</p>
        </div>
        <div class="card">
          <h3>Costos</h3>
          <table class="table">
            <thead><tr><th>Concepto</th><th>Cant.</th><th>P. Unit.</th><th>Importe</th></tr></thead>
            <tbody>
              ${(order.partsItems || []).map((r) => `<tr><td data-label="Concepto">${escapeHtml(r.description || '')}</td><td data-label="Cant.">${Number(r.quantity) || 0}</td><td data-label="P. Unit.">${formatCurrency(r.unitPrice)}</td><td data-label="Importe">${formatCurrency((Number(r.quantity) || 0) * (Number(r.unitPrice) || 0))}</td></tr>`).join('')}
              <tr><td colspan="3" data-label="" style="text-align:right"><strong>Mano de obra</strong></td><td data-label="Mano de obra">${formatCurrency(order.laborCost)}</td></tr>
            </tbody>
          </table>
          <div class="text-right">
            <p>Subtotal: <strong>${formatCurrency(order.subtotal ?? (order.total || 0))}</strong></p>
            ${order.discount > 0 ? `<p>Descuento: <strong>-${formatCurrency(order.discount)}</strong></p>` : ''}
            ${order.taxEnabled ? `<p>IVA (${order.taxRate ?? 0}%): <strong>${formatCurrency(order.tax)}</strong></p>` : ''}
            ${order.isrEnabled ? `<p>Retención ISR (${order.isrRate ?? 0}%): <strong>-${formatCurrency(order.isr)}</strong></p>` : ''}
            <p style="font-size:1.25rem"><strong>Total: ${formatCurrency(order.total)}</strong></p>
          </div>
          <p class="text-right text-muted">Pagado: ${formatCurrency(order.amountPaid)} · Saldo: ${formatCurrency(Math.max(0, order.total - (order.amountPaid || 0)))}</p>
          <button class="btn btn--outline btn--sm" id="go-payments">Registrar pago</button>
        </div>
      </div>
    </div>

    <div id="tab-photos" class="hidden">
      <div class="grid grid--2">
        <div class="card" id="photos-before"></div>
        <div class="card" id="photos-after"></div>
      </div>
    </div>

    <div id="tab-signatures" class="hidden">
      <div class="grid grid--2">
        <div class="card">
          <h3>Firma del cliente</h3>
          ${order.signatureClientUrl ? `<img src="${order.signatureClientUrl}" alt="Firma cliente" style="max-width:100%;border:1px solid var(--color-border);border-radius:8px" />` : `<div id="sig-client-pad"></div><div class="flex gap-2" style="margin-top:8px"><button class="btn btn--outline btn--sm" id="sig-client-clear">Limpiar</button><button class="btn btn--primary btn--sm" id="sig-client-save">Guardar firma</button></div>`}
        </div>
        <div class="card">
          <h3>Firma del técnico</h3>
          ${order.signatureTechnicianUrl ? `<img src="${order.signatureTechnicianUrl}" alt="Firma técnico" style="max-width:100%;border:1px solid var(--color-border);border-radius:8px" />` : `<div id="sig-tech-pad"></div><div class="flex gap-2" style="margin-top:8px"><button class="btn btn--outline btn--sm" id="sig-tech-clear">Limpiar</button><button class="btn btn--primary btn--sm" id="sig-tech-save">Guardar firma</button></div>`}
        </div>
      </div>
    </div>
  `;

  container.querySelector('#back').addEventListener('click', () => navigate('service-orders'));
  container.querySelector('#print-btn').addEventListener('click', () => printOrderTicket(order));
  container.querySelector('#go-payments').addEventListener('click', () => navigate('payments', '', { orderId: order.id }));

  renderStepper(container, order, rerender);

  container.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => {
    container.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === tab));
    container.querySelectorAll('[id^="tab-"]').forEach((p) => p.classList.toggle('hidden', p.id !== `tab-${tab.dataset.tab}`));
  }));

  createPhotoUploader(container.querySelector('#photos-before'), {
    folderPath: `service-orders/${orderId}/before`, initialPhotos: order.photosBefore || [],
    label: 'Fotografías antes', onChange: (photos) => updateOrder(orderId, { photosBefore: photos })
  });
  createPhotoUploader(container.querySelector('#photos-after'), {
    folderPath: `service-orders/${orderId}/after`, initialPhotos: order.photosAfter || [],
    label: 'Fotografías después', onChange: (photos) => updateOrder(orderId, { photosAfter: photos })
  });

  if (!order.signatureClientUrl) {
    const pad = createSignaturePad(container.querySelector('#sig-client-pad'));
    onSignaturePad(pad);
    container.querySelector('#sig-client-clear').addEventListener('click', () => pad.clear());
    container.querySelector('#sig-client-save').addEventListener('click', async () => {
      if (pad.isEmpty()) { showToast('Solicita al cliente que firme primero', 'warning'); return; }
      const file = await canvasToFile(pad.canvas, `firma-cliente-${orderId}.png`);
      const { url } = await uploadPhoto(`service-orders/${orderId}/signatures`, file);
      await updateOrder(orderId, { signatureClientUrl: url });
      showToast('Firma guardada', 'success');
      rerender();
    });
  }
  if (!order.signatureTechnicianUrl) {
    const pad = createSignaturePad(container.querySelector('#sig-tech-pad'));
    onSignaturePad(pad);
    container.querySelector('#sig-tech-clear').addEventListener('click', () => pad.clear());
    container.querySelector('#sig-tech-save').addEventListener('click', async () => {
      if (pad.isEmpty()) { showToast('Firma del técnico requerida', 'warning'); return; }
      const file = await canvasToFile(pad.canvas, `firma-tecnico-${orderId}.png`);
      const { url } = await uploadPhoto(`service-orders/${orderId}/signatures`, file);
      await updateOrder(orderId, { signatureTechnicianUrl: url });
      showToast('Firma guardada', 'success');
      rerender();
    });
  }
}
