/**
 * vehicles.module.js
 * -----------------------------------------------------------------------
 * Cross-client vehicle list (searchable by plates/brand/model/VIN) and a
 * vehicle detail screen with photos and service history. Creating a
 * vehicle happens from the owning client's detail page (clients.module.js)
 * since a vehicle always needs a client — this module covers browse/edit.
 */

import {
  subscribeAllVehicles, getVehicle, updateVehicle, deleteVehicle, vehicleLabel
} from './vehicles.service.js';
import { getClient } from '../clients/clients.service.js';
import { getAll } from '../../core/db.service.js';
import { where, orderBy } from '../../core/firebase.init.js';
import { COLLECTIONS, FUEL_TYPES, ORDER_STATUS_META } from '../../config/constants.js';
import { openModal, confirmDialog } from '../../components/ui/modal.js';
import { buildForm, readForm, validateForm } from '../../components/ui/form-builder.js';
import { createPhotoUploader } from '../../components/ui/file-upload.js';
import { showToast } from '../../components/ui/toast.js';
import { icon } from '../../components/ui/icons.js';
import { navigate } from '../../core/router.js';
import { debounce, normalizeText, formatDate, escapeHtml } from '../../core/utils.js';

let unsubscribers = [];
let container = null;
function trackUnsub(fn) { unsubscribers.push(fn); return fn; }
function clearUnsubs() { unsubscribers.forEach((fn) => fn()); unsubscribers = []; }

let allVehicles = [];
let searchTerm = '';

function vehicleFormFields(vehicle = {}) {
  return [
    { name: 'brand', label: 'Marca', required: true, value: vehicle.brand },
    { name: 'model', label: 'Modelo', required: true, value: vehicle.model },
    { name: 'year', label: 'Año', type: 'number', value: vehicle.year },
    { name: 'engine', label: 'Motor', value: vehicle.engine },
    { name: 'color', label: 'Color', value: vehicle.color },
    { name: 'plates', label: 'Placas', value: vehicle.plates },
    { name: 'vin', label: 'VIN / Número de serie', value: vehicle.vin },
    { name: 'mileage', label: 'Kilometraje', type: 'number', value: vehicle.mileage },
    { name: 'fuelType', label: 'Combustible', type: 'select', value: vehicle.fuelType, options: FUEL_TYPES.map((f) => ({ value: f, label: f })) },
    { name: 'notes', label: 'Observaciones', type: 'textarea', value: vehicle.notes, fullWidth: true }
  ];
}

function openEditModal(vehicle) {
  const form = buildForm(vehicleFormFields(vehicle));
  const footer = document.createElement('div');
  footer.className = 'flex gap-2';
  footer.innerHTML = `<button class="btn btn--outline" id="cancel">Cancelar</button>
    <button class="btn btn--primary" id="save">Guardar cambios</button>`;
  const modal = openModal({ title: 'Editar vehículo', body: form, footer, maxWidth: '640px' });
  footer.querySelector('#cancel').addEventListener('click', modal.close);
  footer.querySelector('#save').addEventListener('click', async () => {
    if (!validateForm(form)) return;
    await updateVehicle(vehicle.id, readForm(form));
    showToast('Vehículo actualizado', 'success');
    modal.close();
  });
}

/**
 * Groups vehicles by owner so a client with several cars shows them all
 * together under their name, instead of scattered across a flat list
 * sorted by brand — the whole point of browsing vehicles by client.
 */
function renderGrouped(rows) {
  const listEl = container.querySelector('#vehicles-table');
  if (!rows.length) {
    listEl.innerHTML = '<div class="table-empty">No se encontraron vehículos.</div>';
    return;
  }

  const groups = new Map(); // clientId -> { clientName, vehicles: [] }
  for (const v of rows) {
    if (!groups.has(v.clientId)) groups.set(v.clientId, { clientName: v.clientName || 'Sin cliente', vehicles: [] });
    groups.get(v.clientId).vehicles.push(v);
  }
  const sortedGroups = [...groups.entries()].sort((a, b) => a[1].clientName.localeCompare(b[1].clientName, 'es'));

  listEl.innerHTML = sortedGroups.map(([clientId, group]) => `
    <div class="vehicle-group">
      <div class="vehicle-group__header" data-client="${clientId}">
        <strong>${escapeHtml(group.clientName)}</strong>
        <span class="badge badge--primary">${group.vehicles.length} vehículo${group.vehicles.length > 1 ? 's' : ''}</span>
      </div>
      <div class="grid grid--cards">
        ${group.vehicles.map((v) => `
          <div class="card" data-vehicle="${v.id}" style="cursor:pointer">
            <div class="flex items-center gap-2">${icon('vehicle')} <strong>${escapeHtml(vehicleLabel(v))}</strong></div>
            <p class="text-sm mb-0">Placas: ${escapeHtml(v.plates) || '—'} · Color: ${escapeHtml(v.color) || '—'}</p>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');

  listEl.querySelectorAll('[data-vehicle]').forEach((card) => card.addEventListener('click', () => navigate('vehicles', card.dataset.vehicle)));
  listEl.querySelectorAll('.vehicle-group__header[data-client]').forEach((header) => header.addEventListener('click', () => navigate('clients', header.dataset.client)));
}

function applyFilterAndRender() {
  const term = normalizeText(searchTerm);
  const filtered = term
    ? allVehicles.filter((v) => [v.brand, v.model, v.plates, v.vin, v.clientName].some((f) => normalizeText(f).includes(term)))
    : allVehicles;
  renderGrouped(filtered);
}

async function mountList() {
  container.innerHTML = `
    <div class="page-header"><h1>Vehículos</h1></div>
    <div class="card">
      <div class="table-toolbar">
        <input class="input" id="vehicle-search" placeholder="Buscar por marca, modelo, placas o VIN…" style="max-width:340px" />
      </div>
      <div id="vehicles-table"><div class="skeleton" style="height:280px"></div></div>
    </div>
  `;
  container.querySelector('#vehicle-search').addEventListener('input', debounce((e) => {
    searchTerm = e.target.value;
    applyFilterAndRender();
  }, 200));

  trackUnsub(subscribeAllVehicles(async (rows) => {
    // Denormalize the owner's name for display/search without a per-row read on every render.
    const clientCache = new Map();
    for (const v of rows) {
      if (!clientCache.has(v.clientId)) clientCache.set(v.clientId, await getClient(v.clientId));
      v.clientName = clientCache.get(v.clientId)?.name;
    }
    allVehicles = rows;
    applyFilterAndRender();
  }));
}

async function renderHistory(vehicleId) {
  const el = container.querySelector('#vehicle-history');
  const orders = await getAll(COLLECTIONS.SERVICE_ORDERS, where('vehicleId', '==', vehicleId), orderBy('createdAt', 'desc'));
  if (!orders.length) {
    el.innerHTML = '<div class="empty-state">Sin órdenes de servicio previas para este vehículo.</div>';
    return;
  }
  el.innerHTML = orders.map((o) => {
    const meta = ORDER_STATUS_META[o.status] || { label: o.status, color: 'neutral' };
    return `
    <div class="flex items-center justify-between" data-id="${o.id}" data-clickable style="padding:10px 0;border-bottom:1px solid var(--color-border);cursor:pointer">
      <div><strong>${o.folioLabel || o.id}</strong><div class="text-sm text-muted">${formatDate(o.createdAt)} · ${o.serviceRequested || ''}</div></div>
      <span class="badge badge--${meta.color}">${meta.label}</span>
    </div>`;
  }).join('');
  el.querySelectorAll('[data-clickable]').forEach((row) => row.addEventListener('click', () => navigate('service-orders', row.dataset.id)));
}

async function mountDetail(vehicleId) {
  container.innerHTML = '<div class="skeleton" style="height:400px"></div>';
  const vehicle = await getVehicle(vehicleId);
  if (!vehicle) { container.innerHTML = '<div class="empty-state">Vehículo no encontrado.</div>'; return; }
  const client = await getClient(vehicle.clientId);

  container.innerHTML = `
    <div class="page-header">
      <div class="flex items-center gap-3">
        <button class="btn btn--icon btn--ghost" id="back">${icon('chevronRight', { className: 'rotate-180' })}</button>
        <div>
          <h1 class="mb-0">${vehicleLabel(vehicle)}</h1>
          <p class="mb-0 text-sm">Propietario: <a href="#/clients/${vehicle.clientId}">${client?.name || '—'}</a></p>
        </div>
      </div>
      <div class="flex gap-2">
        <button class="btn btn--outline" id="edit-vehicle">${icon('edit', { size: 16 })} Editar</button>
        <button class="btn btn--danger" id="delete-vehicle">${icon('trash', { size: 16 })} Eliminar</button>
      </div>
    </div>

    <div class="grid grid--2 section">
      <div class="card">
        <h3>Datos del vehículo</h3>
        <p class="text-sm"><strong>Motor:</strong> ${vehicle.engine || '—'}</p>
        <p class="text-sm"><strong>Color:</strong> ${vehicle.color || '—'}</p>
        <p class="text-sm"><strong>Placas:</strong> ${vehicle.plates || '—'}</p>
        <p class="text-sm"><strong>VIN:</strong> ${vehicle.vin || '—'}</p>
        <p class="text-sm"><strong>Kilometraje:</strong> ${vehicle.mileage ? `${vehicle.mileage} km` : '—'}</p>
        <p class="text-sm"><strong>Combustible:</strong> ${vehicle.fuelType || '—'}</p>
        ${vehicle.notes ? `<p class="text-sm"><strong>Observaciones:</strong> ${vehicle.notes}</p>` : ''}
      </div>
      <div class="card" id="photo-section"></div>
    </div>

    <div class="card">
      <div class="card__header"><h3 class="card__title">Historial de servicios</h3></div>
      <div id="vehicle-history"><div class="skeleton" style="height:120px"></div></div>
    </div>
  `;

  container.querySelector('#back').addEventListener('click', () => navigate('vehicles'));
  container.querySelector('#edit-vehicle').addEventListener('click', () => openEditModal(vehicle));
  container.querySelector('#delete-vehicle').addEventListener('click', async () => {
    const confirmed = await confirmDialog({ title: 'Eliminar vehículo', message: `¿Eliminar ${vehicleLabel(vehicle)}?` });
    if (!confirmed) return;
    await deleteVehicle(vehicleId, vehicle.clientId);
    showToast('Vehículo eliminado', 'success');
    navigate('clients', vehicle.clientId);
  });

  createPhotoUploader(container.querySelector('#photo-section'), {
    folderPath: `vehicles/${vehicleId}`,
    initialPhotos: vehicle.photos || [],
    label: 'Fotografías del vehículo',
    onChange: (photos) => updateVehicle(vehicleId, { photos })
  });

  renderHistory(vehicleId);
}

async function mount(root, ctx) {
  container = root;
  clearUnsubs();
  const vehicleId = ctx.params?.[0];
  if (vehicleId) await mountDetail(vehicleId);
  else await mountList();
}

function unmount() {
  clearUnsubs();
  container = null;
}

export default { mount, unmount };
