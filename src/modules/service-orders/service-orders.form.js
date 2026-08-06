/**
 * service-orders.form.js
 * -----------------------------------------------------------------------
 * The #/service-orders/new creation form: client/vehicle pickers (with
 * quick-add fallbacks), parts line items, tax section, and submit. Split
 * out of service-orders.module.js — this is the single largest, most
 * self-contained piece of that file and doesn't need to share state with
 * the list or detail screens.
 */

import { createOrder, getOrder, updateOrder } from './service-orders.service.js';
import { getAll } from '../../core/db.service.js';
import { where } from '../../core/firebase.init.js';
import { createClient } from '../clients/clients.service.js';
import { createVehicle, getVehiclesByClient, vehicleLabel } from '../vehicles/vehicles.service.js';
import { COLLECTIONS, ROLES } from '../../config/constants.js';
import { buildForm, readForm, validateForm } from '../../components/ui/form-builder.js';
import { createSearchSelect } from '../../components/ui/search-select.js';
import { createLineItems } from '../../components/ui/line-items.js';
import { createTaxSection } from '../../components/ui/tax-section.js';
import { openModal } from '../../components/ui/modal.js';
import { showToast } from '../../components/ui/toast.js';
import { icon } from '../../components/ui/icons.js';
import { navigate } from '../../core/router.js';
import { getCachedSettings } from '../../core/settings.service.js';
import { calcularTotales } from '../../core/tax.service.js';

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
    { name: 'color', label: 'Color' },
    { name: 'unitNumber', label: 'Número de unidad', placeholder: 'Ej. U-15, Unidad 08, CAM-22' }
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

export async function mountNewOrderForm(container) {
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
        <div class="field"><label class="field__label" for="mileage">Kilometraje actual</label><input class="input" type="number" id="mileage" /></div>
      </div>
      <div class="field"><label class="field__label" for="serviceRequested">Diagnóstico / servicio solicitado</label><textarea class="textarea" id="serviceRequested" placeholder="¿Qué reporta el cliente?"></textarea></div>

      <h3>Refacciones</h3>
      <div id="parts-lines"></div>

      <div class="grid grid--form">
        <div class="field"><label class="field__label" for="laborCost">Mano de obra</label><input class="input" type="number" min="0" step="0.01" id="laborCost" value="0" /></div>
      </div>

      <div id="tax-section"></div>

      <details class="collapsible">
        <summary>Más detalles (opcional)</summary>
        <div class="collapsible__body grid grid--form">
          <div class="field"><label class="field__label" for="technician">Técnico responsable</label><select class="select" id="technician"><option value="">Sin asignar</option></select></div>
          <div class="field"><label class="field__label" for="estimatedTime">Tiempo estimado</label><input class="input" id="estimatedTime" placeholder="Ej. 2 horas" /></div>
          <div class="field"><label class="field__label" for="estimatedDelivery">Fecha de entrega estimada</label><input class="input" type="date" id="estimatedDelivery" /></div>
          <div class="field"><label class="field__label" for="diagnosis">Diagnóstico técnico</label><textarea class="textarea" id="diagnosis"></textarea></div>
          <div class="field"><label class="field__label" for="notes">Observaciones</label><textarea class="textarea" id="notes" placeholder="Notas adicionales para el ticket impreso"></textarea></div>
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
  const lineItems = createLineItems(linesEl, { onChange: () => taxSection.refresh() });
  laborInput.addEventListener('input', () => taxSection.refresh());

  const settings = getCachedSettings();
  const taxSection = createTaxSection(container.querySelector('#tax-section'), {
    getItems: () => lineItems.getItems(),
    getLaborCost: () => Number(laborInput.value) || 0,
    defaults: {
      ivaEnabled: settings.ivaEnabledByDefault, ivaRate: settings.ivaRate,
      isrEnabled: settings.isrEnabledByDefault, isrRate: settings.isrRate
    }
  });

  container.querySelector('#order-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!selectedClient || !selectedVehicle) {
      showToast('Selecciona un cliente y un vehículo antes de continuar', 'warning');
      return;
    }
    const submitBtn = event.target.querySelector('button[type=submit]');
    submitBtn.disabled = true;
    try {
      const values = taxSection.getValues();
      const totals = calcularTotales(values);
      const { id } = await createOrder({
        clientId: selectedClient.id,
        clientName: selectedClient.name,
        clientPhone: selectedClient.phone,
        vehicleId: selectedVehicle.id,
        vehicle: selectedVehicle,
        vehiclePlates: selectedVehicle.plates,
        vehicleColor: selectedVehicle.color,
        unitNumber: selectedVehicle.unitNumber || '',
        mileage: Number(container.querySelector('#mileage').value) || selectedVehicle.mileage || null,
        technicianId: techSelect.value || null,
        technicianName: technicians.find((t) => t.id === techSelect.value)?.displayName || null,
        estimatedTime: container.querySelector('#estimatedTime').value,
        estimatedDelivery: container.querySelector('#estimatedDelivery').value || null,
        diagnosis: container.querySelector('#diagnosis').value,
        notes: container.querySelector('#notes').value,
        serviceRequested: container.querySelector('#serviceRequested').value,
        serviceDone: '', // filled in later, once the technician has actually done the work
        partsItems: values.items,
        laborCost: values.laborCost,
        taxEnabled: values.taxEnabled, taxRate: values.taxRate,
        isrEnabled: values.isrEnabled, isrRate: values.isrRate,
        discountEnabled: values.discountEnabled, discountType: values.discountType, discountValue: values.discountValue,
        ...totals // subtotal, discount, taxableBase, tax, isr, total
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

/**
 * The #/service-orders/{id}/edit screen. Client and vehicle stay fixed
 * (an order is always tied to the vehicle it was opened for — changing
 * that belongs to creating a new order), but everything else — parts,
 * labor, technician, dates, notes, taxes and the discount — is editable,
 * including the new "descuento adicional" field: a second, independent
 * discount applied directly to the already-taxed total (e.g. a manual
 * markdown negotiated at pickup), on top of the pre-tax discount already
 * offered by the tax section.
 */
export async function mountEditOrderForm(container, orderId) {
  container.innerHTML = '<div class="skeleton" style="height:480px"></div>';
  const order = await getOrder(orderId);
  if (!order) { container.innerHTML = '<div class="empty-state">Orden no encontrada.</div>'; return; }

  const technicians = await getAll(COLLECTIONS.USERS, where('role', '==', ROLES.TECNICO));

  container.innerHTML = `
    <div class="page-header">
      <div class="flex items-center gap-3">
        <button class="btn btn--icon btn--ghost" id="back">${icon('chevronRight', { className: 'rotate-180' })}</button>
        <h1 class="mb-0">Editar orden ${escapeHtmlLite(order.folioLabel)}</h1>
      </div>
    </div>
    <form id="order-edit-form" class="card">
      <div class="grid grid--form">
        <div class="field"><label class="field__label">Cliente</label><input class="input" value="${escapeHtmlLite(order.clientName || '')}" disabled /></div>
        <div class="field"><label class="field__label">Vehículo</label><input class="input" value="${escapeHtmlLite(order.vehicleLabel || '')}${order.unitNumber ? ' · Unidad ' + escapeHtmlLite(order.unitNumber) : ''}" disabled /></div>
      </div>

      <div class="grid grid--form">
        <div class="field"><label class="field__label" for="mileage">Kilometraje actual</label><input class="input" type="number" id="mileage" value="${order.mileage ?? ''}" /></div>
      </div>
      <div class="field"><label class="field__label" for="serviceRequested">Diagnóstico / servicio solicitado</label><textarea class="textarea" id="serviceRequested">${escapeHtmlLite(order.serviceRequested || '')}</textarea></div>

      <h3>Refacciones</h3>
      <div id="parts-lines"></div>

      <div class="grid grid--form">
        <div class="field"><label class="field__label" for="laborCost">Mano de obra</label><input class="input" type="number" min="0" step="0.01" id="laborCost" value="${order.laborCost || 0}" /></div>
      </div>

      <div id="tax-section"></div>

      <div class="grid grid--form" style="margin-top:var(--space-3)">
        <div class="field">
          <label class="field__label" for="extraDiscount">Descuento adicional (monto fijo)</label>
          <input class="input" type="number" min="0" step="0.01" id="extraDiscount" value="${order.extraDiscount || 0}" />
          <span class="field__hint">Se aplica directamente sobre el total ya calculado (después de IVA/ISR) — úsalo para una rebaja adicional acordada con el cliente.</span>
        </div>
      </div>
      <div class="text-right section" id="final-total-preview"></div>

      <details class="collapsible">
        <summary>Más detalles (opcional)</summary>
        <div class="collapsible__body grid grid--form">
          <div class="field"><label class="field__label" for="technician">Técnico responsable</label><select class="select" id="technician"><option value="">Sin asignar</option></select></div>
          <div class="field"><label class="field__label" for="estimatedTime">Tiempo estimado</label><input class="input" id="estimatedTime" value="${escapeHtmlLite(order.estimatedTime || '')}" placeholder="Ej. 2 horas" /></div>
          <div class="field"><label class="field__label" for="estimatedDelivery">Fecha de entrega estimada</label><input class="input" type="date" id="estimatedDelivery" value="${order.estimatedDelivery || ''}" /></div>
          <div class="field"><label class="field__label" for="diagnosis">Diagnóstico técnico</label><textarea class="textarea" id="diagnosis">${escapeHtmlLite(order.diagnosis || '')}</textarea></div>
          <div class="field"><label class="field__label" for="serviceDone">Servicio realizado</label><textarea class="textarea" id="serviceDone">${escapeHtmlLite(order.serviceDone || '')}</textarea></div>
          <div class="field"><label class="field__label" for="notes">Observaciones</label><textarea class="textarea" id="notes">${escapeHtmlLite(order.notes || '')}</textarea></div>
        </div>
      </details>

      <div class="flex justify-end gap-2">
        <button type="button" class="btn btn--outline" id="cancel">Cancelar</button>
        <button type="submit" class="btn btn--primary">Guardar cambios</button>
      </div>
    </form>
  `;

  container.querySelector('#back').addEventListener('click', () => navigate('service-orders', orderId));
  container.querySelector('#cancel').addEventListener('click', () => navigate('service-orders', orderId));

  const techSelect = container.querySelector('#technician');
  techSelect.innerHTML += technicians.map((t) => `<option value="${t.id}" ${t.id === order.technicianId ? 'selected' : ''}>${t.displayName}</option>`).join('');

  const linesEl = container.querySelector('#parts-lines');
  const laborInput = container.querySelector('#laborCost');
  const extraDiscountInput = container.querySelector('#extraDiscount');
  const lineItems = createLineItems(linesEl, { rows: order.partsItems || [], onChange: () => refreshFinalTotal() });
  laborInput.addEventListener('input', () => refreshFinalTotal());
  extraDiscountInput.addEventListener('input', () => refreshFinalTotal());

  const taxSection = createTaxSection(container.querySelector('#tax-section'), {
    getItems: () => lineItems.getItems(),
    getLaborCost: () => Number(laborInput.value) || 0,
    defaults: {
      ivaEnabled: order.taxEnabled, ivaRate: order.taxRate ?? 16,
      isrEnabled: order.isrEnabled, isrRate: order.isrRate ?? 1.25,
      discountEnabled: order.discountEnabled, discountType: order.discountType || 'percent', discountValue: order.discountValue || 0
    },
    onChange: () => refreshFinalTotal()
  });

  function computeFinalTotals() {
    const values = taxSection.getValues();
    const baseTotals = calcularTotales(values);
    const extraDiscount = Math.max(0, Number(extraDiscountInput.value) || 0);
    const finalTotal = Math.max(0, Math.round((baseTotals.total - extraDiscount) * 100) / 100);
    return { values, baseTotals, extraDiscount, finalTotal };
  }

  function refreshFinalTotal() {
    const { extraDiscount, baseTotals, finalTotal } = computeFinalTotals();
    const preview = container.querySelector('#final-total-preview');
    if (!extraDiscount) { preview.innerHTML = ''; return; }
    preview.innerHTML = `
      <p>Total antes de descuento adicional: <strong>${formatCurrencyLite(baseTotals.total)}</strong></p>
      <p>Descuento adicional: <strong>-${formatCurrencyLite(extraDiscount)}</strong></p>
      <p style="font-size:1.25rem">Total final: <strong>${formatCurrencyLite(finalTotal)}</strong></p>
    `;
  }
  refreshFinalTotal();

  container.querySelector('#order-edit-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitBtn = event.target.querySelector('button[type=submit]');
    submitBtn.disabled = true;
    try {
      const { values, baseTotals, extraDiscount, finalTotal } = computeFinalTotals();
      await updateOrder(orderId, {
        mileage: Number(container.querySelector('#mileage').value) || null,
        technicianId: techSelect.value || null,
        technicianName: technicians.find((t) => t.id === techSelect.value)?.displayName || null,
        estimatedTime: container.querySelector('#estimatedTime').value,
        estimatedDelivery: container.querySelector('#estimatedDelivery').value || null,
        diagnosis: container.querySelector('#diagnosis').value,
        serviceDone: container.querySelector('#serviceDone').value,
        notes: container.querySelector('#notes').value,
        serviceRequested: container.querySelector('#serviceRequested').value,
        partsItems: values.items,
        laborCost: values.laborCost,
        taxEnabled: values.taxEnabled, taxRate: values.taxRate,
        isrEnabled: values.isrEnabled, isrRate: values.isrRate,
        discountEnabled: values.discountEnabled, discountType: values.discountType, discountValue: values.discountValue,
        subtotal: baseTotals.subtotal, taxableBase: baseTotals.taxableBase, tax: baseTotals.tax, isr: baseTotals.isr,
        discount: baseTotals.discount,
        extraDiscount,
        total: finalTotal
      }, { note: 'Orden editada', extraDiscount });
      showToast('Orden actualizada', 'success');
      navigate('service-orders', orderId);
    } catch (error) {
      console.error('[service-orders] update failed', error);
      showToast('No se pudo actualizar la orden', 'danger');
    } finally {
      submitBtn.disabled = false;
    }
  });
}

// Small local helpers so this file doesn't need to import formatCurrency/escapeHtml
// just for the two read-only lines above (kept name-distinct from core/utils.js's
// versions in case this file is ever bundled differently).
function escapeHtmlLite(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const currencyFormatterLite = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
function formatCurrencyLite(n) { return currencyFormatterLite.format(Number(n) || 0); }
