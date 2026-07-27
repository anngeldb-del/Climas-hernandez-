/**
 * service-orders.module.js
 * -----------------------------------------------------------------------
 * List, creation form, and detail/workflow screen for service orders —
 * the core of the shop's daily operation. Routes:
 *   #/service-orders            list
 *   #/service-orders/new        creation form
 *   #/service-orders/{id}       detail (status, photos, signatures, print)
 */

import {
  subscribeOrders, getOrder, createOrder, updateOrder, setOrderStatus, computeTotal
} from './service-orders.service.js';
import { getAll } from '../../core/db.service.js';
import { where } from '../../core/firebase.init.js';
import { createClient } from '../clients/clients.service.js';
import { createVehicle, getVehiclesByClient, vehicleLabel } from '../vehicles/vehicles.service.js';
import {
  COLLECTIONS, ORDER_STATUS, ORDER_STATUS_META, ORDER_STATUS_FLOW, ROLES
} from '../../config/constants.js';
import { renderTable, sortRows } from '../../components/ui/table.js';
import { buildForm, readForm, validateForm } from '../../components/ui/form-builder.js';
import { createSearchSelect } from '../../components/ui/search-select.js';
import { createLineItems } from '../../components/ui/line-items.js';
import { createPhotoUploader } from '../../components/ui/file-upload.js';
import { createSignaturePad } from '../../components/ui/signature-pad.js';
import { canvasToFile, uploadPhoto } from '../../core/storage.service.js';
import { openModal } from '../../components/ui/modal.js';
import { showToast } from '../../components/ui/toast.js';
import { icon } from '../../components/ui/icons.js';
import { navigate } from '../../core/router.js';
import { debounce, normalizeText, formatDate, formatCurrency } from '../../core/utils.js';
import { printOrderTicket } from './order-ticket.print.js';

let unsubscribers = [];
let container = null;
function trackUnsub(fn) { unsubscribers.push(fn); return fn; }
function clearUnsubs() { unsubscribers.forEach((fn) => fn()); unsubscribers = []; }

// ---------------------------------------------------------------------
// List view
// ---------------------------------------------------------------------

let allOrders = [];
let searchTerm = '';
let statusFilter = '';
let sortKey = 'createdAt';
let sortDir = 'desc';

function renderList(rows) {
  const listEl = container.querySelector('#orders-table');
  renderTable(listEl, {
    columns: [
      { key: 'folioLabel', label: 'Folio' },
      { key: 'clientName', label: 'Cliente' },
      { key: 'vehicleLabel', label: 'Vehículo' },
      { key: 'status', label: 'Estado', render: (o) => {
        const meta = ORDER_STATUS_META[o.status] || { label: o.status, color: 'neutral' };
        return `<span class="badge badge--${meta.color}">${meta.label}</span>`;
      } },
      { key: 'total', label: 'Total', align: 'right', render: (o) => formatCurrency(o.total) },
      { key: 'balance', label: 'Saldo', align: 'right', sortable: false, render: (o) => formatCurrency(Math.max(0, (o.total || 0) - (o.amountPaid || 0))) },
      { key: 'createdAt', label: 'Fecha', render: (o) => formatDate(o.createdAt) }
    ],
    rows, sortKey, sortDir,
    onSort: (key) => { sortDir = sortKey === key && sortDir === 'asc' ? 'desc' : 'asc'; sortKey = key; applyFilterAndRender(); },
    onRowClick: (row) => navigate('service-orders', row.id),
    emptyMessage: 'No hay órdenes de servicio.'
  });
}

function applyFilterAndRender() {
  const term = normalizeText(searchTerm);
  let filtered = allOrders;
  if (statusFilter) filtered = filtered.filter((o) => o.status === statusFilter);
  if (term) filtered = filtered.filter((o) => [o.folioLabel, o.clientName, o.vehicleLabel, o.vehiclePlates].some((f) => normalizeText(f).includes(term)));
  renderList(sortRows(filtered, sortKey, sortDir));
}

function mountList() {
  container.innerHTML = `
    <div class="page-header">
      <h1>Órdenes de servicio</h1>
      <button class="btn btn--primary" id="new-order">${icon('plus', { size: 16 })} Nueva orden</button>
    </div>
    <div class="card">
      <div class="table-toolbar">
        <input class="input" id="order-search" placeholder="Buscar por folio, cliente, placas…" style="max-width:300px" />
        <select class="select" id="status-filter" style="max-width:220px">
          <option value="">Todos los estados</option>
          ${Object.entries(ORDER_STATUS_META).map(([value, meta]) => `<option value="${value}">${meta.label}</option>`).join('')}
        </select>
      </div>
      <div id="orders-table"><div class="skeleton" style="height:320px"></div></div>
    </div>
  `;

  container.querySelector('#new-order').addEventListener('click', () => navigate('service-orders', 'new'));
  container.querySelector('#order-search').addEventListener('input', debounce((e) => { searchTerm = e.target.value; applyFilterAndRender(); }, 200));
  container.querySelector('#status-filter').addEventListener('change', (e) => { statusFilter = e.target.value; applyFilterAndRender(); });

  trackUnsub(subscribeOrders((rows) => { allOrders = rows; applyFilterAndRender(); }));
}

// ---------------------------------------------------------------------
// New order form
// ---------------------------------------------------------------------

async function mountNewOrder() {
  container.innerHTML = `
    <div class="page-header">
      <div class="flex items-center gap-3">
        <button class="btn btn--icon btn--ghost" id="back">${icon('chevronRight', { className: 'rotate-180' })}</button>
        <h1 class="mb-0">Nueva orden de servicio</h1>
      </div>
    </div>
    <form id="order-form" class="card">
      <div class="grid grid--form">
        <div class="field">
          <label class="field__label">Cliente *</label>
          <div id="client-picker"></div>
        </div>
        <div class="field">
          <label class="field__label">Vehículo *</label>
          <div id="vehicle-picker"></div>
        </div>
      </div>

      <div id="quick-add-client" class="alert hidden">
        Cliente no encontrado. <button type="button" class="btn btn--sm btn--outline" id="quick-add-client-btn">+ Crear cliente rápido</button>
      </div>
      <div id="quick-add-vehicle" class="alert hidden">
        Selecciona primero un cliente, o <button type="button" class="btn btn--sm btn--outline" id="quick-add-vehicle-btn">+ agregar vehículo nuevo</button>
      </div>

      <div class="grid grid--form">
        <div class="field"><label class="field__label">Kilometraje actual</label><input class="input" type="number" id="mileage" /></div>
      </div>
      <div class="field"><label class="field__label">Diagnóstico / servicio solicitado</label><textarea class="textarea" id="serviceRequested" placeholder="¿Qué reporta el cliente?"></textarea></div>

      <h3>Refacciones</h3>
      <div id="parts-lines"></div>

      <div class="grid grid--form section">
        <div class="field"><label class="field__label">Mano de obra</label><input class="input" type="number" min="0" step="0.01" id="laborCost" value="0" /></div>
        <div class="field"><label class="field__label">Total</label><input class="input" id="total-display" disabled /></div>
      </div>

      <details class="collapsible">
        <summary>Más detalles (opcional)</summary>
        <div class="collapsible__body grid grid--form">
          <div class="field"><label class="field__label">Técnico responsable</label><select class="select" id="technician"><option value="">Sin asignar</option></select></div>
          <div class="field"><label class="field__label">Tiempo estimado</label><input class="input" id="estimatedTime" placeholder="Ej. 2 horas" /></div>
          <div class="field"><label class="field__label">Fecha de entrega estimada</label><input class="input" type="date" id="estimatedDelivery" /></div>
          <div class="field"><label class="field__label">Diagnóstico técnico</label><textarea class="textarea" id="diagnosis"></textarea></div>
        </div>
      </details>

      <div class="flex justify-end gap-2">
        <button type="button" class="btn btn--outline" id="cancel">Cancelar</button>
        <button type="submit" class="btn btn--primary">Crear orden</button>
      </div>
    </form>
  `;

  container.querySelector('#back').addEventListener('click', () => navigate('service-orders'));
  container.querySelector('#cancel').addEventListener('click', () => navigate('service-orders'));

  const [clients, technicians] = await Promise.all([
    getAll(COLLECTIONS.CLIENTS),
    getAll(COLLECTIONS.USERS, where('role', '==', ROLES.TECNICO))
  ]);

  const techSelect = container.querySelector('#technician');
  techSelect.innerHTML += technicians.map((t) => `<option value="${t.id}">${t.displayName}</option>`).join('');

  let selectedClient = null;
  let selectedVehicle = null;

  const clientPicker = createSearchSelect(container.querySelector('#client-picker'), {
    placeholder: 'Buscar cliente por nombre o teléfono…',
    getOptions: () => clients.map((c) => ({ id: c.id, label: c.name, sublabel: c.phone })),
    onSelect: async (option) => {
      selectedClient = clients.find((c) => c.id === option.id);
      selectedVehicle = null;
      container.querySelector('#quick-add-client').classList.add('hidden');
      await loadVehiclesForClient(selectedClient.id);
    }
  });
  container.querySelector('#client-picker input').addEventListener('input', (e) => {
    container.querySelector('#quick-add-client').classList.toggle('hidden', !e.target.value);
  });
  container.querySelector('#quick-add-client-btn').addEventListener('click', () => {
    const name = container.querySelector('#client-picker input').value.trim();
    openQuickClientModal(name, async (newClient) => {
      clients.push(newClient);
      selectedClient = newClient;
      clientPicker.setLabel(newClient.name);
      container.querySelector('#quick-add-client').classList.add('hidden');
      await loadVehiclesForClient(newClient.id);
    });
  });

  let vehiclePicker = null;
  let clientVehicles = [];

  async function loadVehiclesForClient(clientId) {
    clientVehicles = await getVehiclesByClient(clientId);
    vehiclePicker = createSearchSelect(container.querySelector('#vehicle-picker'), {
      placeholder: 'Buscar vehículo del cliente…',
      getOptions: () => clientVehicles.map((v) => ({ id: v.id, label: vehicleLabel(v), sublabel: v.plates })),
      onSelect: (option) => { selectedVehicle = clientVehicles.find((v) => v.id === option.id); }
    });
    container.querySelector('#quick-add-vehicle').classList.remove('hidden');
    container.querySelector('#quick-add-vehicle').innerHTML =
      `<button type="button" class="btn btn--sm btn--outline" id="quick-add-vehicle-btn">+ Agregar vehículo nuevo</button>`;
    container.querySelector('#quick-add-vehicle-btn').addEventListener('click', () => {
      openQuickVehicleModal(clientId, async (newVehicle) => {
        clientVehicles.push(newVehicle);
        selectedVehicle = newVehicle;
        vehiclePicker.setLabel(vehicleLabel(newVehicle));
      });
    });
  }

  const linesEl = container.querySelector('#parts-lines');
  const laborInput = container.querySelector('#laborCost');
  const totalDisplay = container.querySelector('#total-display');
  const lineItems = createLineItems(linesEl, {
    onChange: (_items, partsTotal) => { totalDisplay.value = formatCurrency(partsTotal + (Number(laborInput.value) || 0)); }
  });
  laborInput.addEventListener('input', () => {
    totalDisplay.value = formatCurrency(lineItems.getTotal() + (Number(laborInput.value) || 0));
  });
  totalDisplay.value = formatCurrency(0);

  container.querySelector('#order-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!selectedClient || !selectedVehicle) {
      showToast('Selecciona un cliente y un vehículo antes de continuar', 'warning');
      return;
    }
    const submitBtn = event.target.querySelector('button[type=submit]');
    submitBtn.disabled = true;
    try {
      const partsItems = lineItems.getItems();
      const laborCost = Number(laborInput.value) || 0;
      const { id } = await createOrder({
        clientId: selectedClient.id,
        clientName: selectedClient.name,
        clientPhone: selectedClient.phone,
        vehicleId: selectedVehicle.id,
        vehicle: selectedVehicle,
        vehiclePlates: selectedVehicle.plates,
        vehicleColor: selectedVehicle.color,
        mileage: Number(container.querySelector('#mileage').value) || selectedVehicle.mileage || null,
        technicianId: techSelect.value || null,
        technicianName: technicians.find((t) => t.id === techSelect.value)?.displayName || null,
        estimatedTime: container.querySelector('#estimatedTime').value,
        estimatedDelivery: container.querySelector('#estimatedDelivery').value || null,
        diagnosis: container.querySelector('#diagnosis').value,
        serviceRequested: container.querySelector('#serviceRequested').value,
        serviceDone: '', // filled in later, once the technician has actually done the work
        partsItems,
        laborCost,
        total: computeTotal(partsItems, laborCost)
      });
      showToast('Orden creada correctamente', 'success');
      navigate('service-orders', id);
    } catch (error) {
      console.error('[service-orders] create failed', error);
      showToast('No se pudo crear la orden', 'danger');
    } finally {
      submitBtn.disabled = false;
    }
  });
}

function openQuickClientModal(prefillName, onCreated) {
  const form = buildForm([
    { name: 'name', label: 'Nombre', required: true, value: prefillName, fullWidth: true },
    { name: 'phone', label: 'Teléfono', required: true }
  ]);
  const footer = document.createElement('div');
  footer.className = 'flex gap-2';
  footer.innerHTML = `<button class="btn btn--outline" id="cancel">Cancelar</button><button class="btn btn--primary" id="save">Crear</button>`;
  const modal = openModal({ title: 'Cliente rápido', body: form, footer, maxWidth: '420px' });
  footer.querySelector('#cancel').addEventListener('click', modal.close);
  footer.querySelector('#save').addEventListener('click', async () => {
    if (!validateForm(form)) return;
    const data = readForm(form);
    const id = await createClient(data);
    onCreated({ id, ...data, vehicleCount: 0 });
    modal.close();
  });
}

function openQuickVehicleModal(clientId, onCreated) {
  const form = buildForm([
    { name: 'brand', label: 'Marca', required: true },
    { name: 'model', label: 'Modelo', required: true },
    { name: 'plates', label: 'Placas' },
    { name: 'color', label: 'Color' }
  ]);
  const footer = document.createElement('div');
  footer.className = 'flex gap-2';
  footer.innerHTML = `<button class="btn btn--outline" id="cancel">Cancelar</button><button class="btn btn--primary" id="save">Agregar</button>`;
  const modal = openModal({ title: 'Vehículo rápido', body: form, footer, maxWidth: '420px' });
  footer.querySelector('#cancel').addEventListener('click', modal.close);
  footer.querySelector('#save').addEventListener('click', async () => {
    if (!validateForm(form)) return;
    const data = readForm(form);
    const id = await createVehicle(clientId, data);
    onCreated({ id, ...data, clientId, photos: [] });
    modal.close();
  });
}

// ---------------------------------------------------------------------
// Detail view
// ---------------------------------------------------------------------

function renderStepper(order) {
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
      mountDetail(order.id);
    });
  });
}

async function mountDetail(orderId) {
  container.innerHTML = '<div class="skeleton" style="height:480px"></div>';
  const order = await getOrder(orderId);
  if (!order) { container.innerHTML = '<div class="empty-state">Orden no encontrada.</div>'; return; }

  const meta = ORDER_STATUS_META[order.status] || { label: order.status, color: 'neutral' };

  container.innerHTML = `
    <div class="page-header">
      <div class="flex items-center gap-3">
        <button class="btn btn--icon btn--ghost" id="back">${icon('chevronRight', { className: 'rotate-180' })}</button>
        <div>
          <h1 class="mb-0">${order.folioLabel}</h1>
          <p class="mb-0 text-sm">${order.clientName} · ${order.vehicleLabel} · <span class="badge badge--${meta.color}">${meta.label}</span></p>
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
          <p class="text-sm"><strong>Kilometraje:</strong> ${order.mileage ?? '—'} km</p>
          <p class="text-sm"><strong>Técnico:</strong> ${order.technicianName || 'Sin asignar'}</p>
          <p class="text-sm"><strong>Tiempo estimado:</strong> ${order.estimatedTime || '—'}</p>
          <p class="text-sm"><strong>Entrega estimada:</strong> ${order.estimatedDelivery ? formatDate(order.estimatedDelivery) : '—'}</p>
          <p class="text-sm"><strong>Diagnóstico:</strong> ${order.diagnosis || '—'}</p>
          <p class="text-sm"><strong>Servicio solicitado:</strong> ${order.serviceRequested || '—'}</p>
          <p class="text-sm"><strong>Servicio realizado:</strong> ${order.serviceDone || '—'}</p>
        </div>
        <div class="card">
          <h3>Costos</h3>
          <table class="table">
            <thead><tr><th>Concepto</th><th>Cant.</th><th>P. Unit.</th><th>Importe</th></tr></thead>
            <tbody>
              ${(order.partsItems || []).map((r) => `<tr><td>${r.description}</td><td>${r.quantity}</td><td>${formatCurrency(r.unitPrice)}</td><td>${formatCurrency(r.quantity * r.unitPrice)}</td></tr>`).join('')}
              <tr><td colspan="3" style="text-align:right"><strong>Mano de obra</strong></td><td>${formatCurrency(order.laborCost)}</td></tr>
            </tbody>
          </table>
          <p class="text-right"><strong>Total: ${formatCurrency(order.total)}</strong></p>
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

  renderStepper(order);

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
    container.querySelector('#sig-client-clear').addEventListener('click', () => pad.clear());
    container.querySelector('#sig-client-save').addEventListener('click', async () => {
      if (pad.isEmpty()) { showToast('Solicita al cliente que firme primero', 'warning'); return; }
      const file = await canvasToFile(pad.canvas, `firma-cliente-${orderId}.png`);
      const { url } = await uploadPhoto(`service-orders/${orderId}/signatures`, file);
      await updateOrder(orderId, { signatureClientUrl: url });
      showToast('Firma guardada', 'success');
      mountDetail(orderId);
    });
  }
  if (!order.signatureTechnicianUrl) {
    const pad = createSignaturePad(container.querySelector('#sig-tech-pad'));
    container.querySelector('#sig-tech-clear').addEventListener('click', () => pad.clear());
    container.querySelector('#sig-tech-save').addEventListener('click', async () => {
      if (pad.isEmpty()) { showToast('Firma del técnico requerida', 'warning'); return; }
      const file = await canvasToFile(pad.canvas, `firma-tecnico-${orderId}.png`);
      const { url } = await uploadPhoto(`service-orders/${orderId}/signatures`, file);
      await updateOrder(orderId, { signatureTechnicianUrl: url });
      showToast('Firma guardada', 'success');
      mountDetail(orderId);
    });
  }
}

// ---------------------------------------------------------------------

async function mount(root, ctx) {
  container = root;
  clearUnsubs();
  const param = ctx.params?.[0];
  if (param === 'new') await mountNewOrder();
  else if (param) await mountDetail(param);
  else mountList();
}

function unmount() {
  clearUnsubs();
  container = null;
}

export default { mount, unmount };
