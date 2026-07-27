/**
 * clients.module.js
 * -----------------------------------------------------------------------
 * Client list + client detail (info, vehicles, service history) in one
 * module, switched by the presence of a route param (`#/clients/{id}`).
 */

import { subscribeClients, createClient, updateClient, deleteClient, getClient } from './clients.service.js';
import {
  subscribeVehiclesByClient, createVehicle, vehicleLabel
} from '../vehicles/vehicles.service.js';
import { getAll } from '../../core/db.service.js';
import { where, orderBy } from '../../core/firebase.init.js';
import { COLLECTIONS, ORDER_STATUS_META, FUEL_TYPES } from '../../config/constants.js';
import { renderTable, sortRows } from '../../components/ui/table.js';
import { openModal, confirmDialog } from '../../components/ui/modal.js';
import { buildForm, readForm, validateForm } from '../../components/ui/form-builder.js';
import { showToast } from '../../components/ui/toast.js';
import { icon } from '../../components/ui/icons.js';
import { navigate } from '../../core/router.js';
import { debounce, normalizeText, waLink, formatDate } from '../../core/utils.js';

let unsubscribers = [];
let container = null;

function trackUnsub(fn) { unsubscribers.push(fn); return fn; }
function clearUnsubs() { unsubscribers.forEach((fn) => fn()); unsubscribers = []; }

// ---------------------------------------------------------------------
// List view
// ---------------------------------------------------------------------

let allClients = [];
let searchTerm = '';
let sortKey = 'name';
let sortDir = 'asc';

function clientFormFields(client = {}) {
  return [
    { name: 'name', label: 'Nombre completo', required: true, value: client.name, fullWidth: true },
    { name: 'phone', label: 'Teléfono', required: true, value: client.phone },
    { name: 'whatsapp', label: 'WhatsApp (si es diferente)', value: client.whatsapp, placeholder: 'Igual al teléfono' },
    { name: 'email', label: 'Correo electrónico', type: 'email', value: client.email },
    { name: 'rfc', label: 'RFC (opcional)', value: client.rfc },
    { name: 'address', label: 'Dirección', value: client.address, fullWidth: true },
    { name: 'notes', label: 'Observaciones', type: 'textarea', value: client.notes, fullWidth: true },
    { name: 'internalNotes', label: 'Notas internas (no visibles al cliente)', type: 'textarea', value: client.internalNotes, fullWidth: true }
  ];
}

function openClientModal(client) {
  const form = buildForm(clientFormFields(client));
  const footer = document.createElement('div');
  footer.className = 'flex gap-2';
  footer.innerHTML = `<button class="btn btn--outline" id="cancel">Cancelar</button>
    <button class="btn btn--primary" id="save">${client ? 'Guardar cambios' : 'Crear cliente'}</button>`;

  const modal = openModal({ title: client ? 'Editar cliente' : 'Nuevo cliente', body: form, footer, maxWidth: '640px' });
  footer.querySelector('#cancel').addEventListener('click', modal.close);
  footer.querySelector('#save').addEventListener('click', async () => {
    if (!validateForm(form)) return;
    const data = readForm(form);
    try {
      if (client) await updateClient(client.id, data);
      else await createClient(data);
      showToast(client ? 'Cliente actualizado' : 'Cliente creado', 'success');
      modal.close();
    } catch (error) {
      console.error('[clients] save failed', error);
      showToast('No se pudo guardar el cliente', 'danger');
    }
  });
}

function renderClientsList(rows) {
  const listEl = container.querySelector('#clients-table');
  renderTable(listEl, {
    columns: [
      { key: 'name', label: 'Nombre' },
      {
        key: 'phone', label: 'Teléfono', render: (c) => c.phone ? `
        <a href="tel:${c.phone}" class="btn btn--sm btn--ghost" onclick="event.stopPropagation()">${icon('phone', { size: 14 })} ${c.phone}</a>
        <a href="${waLink(c.whatsapp || c.phone)}" target="_blank" rel="noopener" class="btn btn--sm btn--ghost" onclick="event.stopPropagation()">${icon('whatsapp', { size: 14 })}</a>
      ` : '—'
      },
      { key: 'email', label: 'Correo', render: (c) => c.email || '—' },
      { key: 'vehicleCount', label: 'Vehículos', align: 'center', render: (c) => c.vehicleCount || 0 }
    ],
    rows,
    sortKey, sortDir,
    onSort: (key) => {
      sortDir = sortKey === key && sortDir === 'asc' ? 'desc' : 'asc';
      sortKey = key;
      applyFilterAndRender();
    },
    onRowClick: (row) => navigate('clients', row.id),
    emptyMessage: 'No se encontraron clientes.'
  });
}

function applyFilterAndRender() {
  const term = normalizeText(searchTerm);
  const filtered = term
    ? allClients.filter((c) => [c.name, c.phone, c.email, c.whatsapp].some((v) => normalizeText(v).includes(term)))
    : allClients;
  renderClientsList(sortRows(filtered, sortKey, sortDir));
}

function mountList() {
  container.innerHTML = `
    <div class="page-header">
      <h1>Clientes</h1>
      <button class="btn btn--primary" id="new-client">${icon('plus', { size: 16 })} Nuevo cliente</button>
    </div>
    <div class="card">
      <div class="table-toolbar">
        <input class="input" id="client-search" placeholder="Buscar por nombre, teléfono o correo…" style="max-width:320px" />
      </div>
      <div id="clients-table"><div class="skeleton" style="height:280px"></div></div>
    </div>
  `;

  container.querySelector('#new-client').addEventListener('click', () => openClientModal());
  container.querySelector('#client-search').addEventListener('input', debounce((e) => {
    searchTerm = e.target.value;
    applyFilterAndRender();
  }, 200));

  trackUnsub(subscribeClients((rows) => { allClients = rows; applyFilterAndRender(); }));
}

// ---------------------------------------------------------------------
// Detail view
// ---------------------------------------------------------------------

function vehicleFormFields() {
  return [
    { name: 'brand', label: 'Marca', required: true },
    { name: 'model', label: 'Modelo', required: true },
    { name: 'year', label: 'Año', type: 'number' },
    { name: 'engine', label: 'Motor' },
    { name: 'color', label: 'Color' },
    { name: 'plates', label: 'Placas' },
    { name: 'vin', label: 'VIN / Número de serie' },
    { name: 'mileage', label: 'Kilometraje', type: 'number' },
    { name: 'fuelType', label: 'Combustible', type: 'select', options: FUEL_TYPES.map((f) => ({ value: f, label: f })) },
    { name: 'notes', label: 'Observaciones', type: 'textarea', fullWidth: true }
  ];
}

function openAddVehicleModal(clientId) {
  const form = buildForm(vehicleFormFields());
  const footer = document.createElement('div');
  footer.className = 'flex gap-2';
  footer.innerHTML = `<button class="btn btn--outline" id="cancel">Cancelar</button>
    <button class="btn btn--primary" id="save">Agregar vehículo</button>`;
  const modal = openModal({ title: 'Nuevo vehículo', body: form, footer, maxWidth: '640px' });
  footer.querySelector('#cancel').addEventListener('click', modal.close);
  footer.querySelector('#save').addEventListener('click', async () => {
    if (!validateForm(form)) return;
    try {
      await createVehicle(clientId, readForm(form));
      showToast('Vehículo agregado', 'success');
      modal.close();
    } catch (error) {
      console.error('[clients] add vehicle failed', error);
      showToast('No se pudo agregar el vehículo', 'danger');
    }
  });
}

function renderVehiclesTab(clientId) {
  const el = container.querySelector('#tab-vehicles');
  el.innerHTML = `
    <div class="flex justify-end" style="margin-bottom:12px">
      <button class="btn btn--outline btn--sm" id="add-vehicle">${icon('plus', { size: 14 })} Agregar vehículo</button>
    </div>
    <div class="grid grid--cards" id="vehicles-grid"><div class="skeleton" style="height:120px"></div></div>
  `;
  el.querySelector('#add-vehicle').addEventListener('click', () => openAddVehicleModal(clientId));

  trackUnsub(subscribeVehiclesByClient(clientId, (vehicles) => {
    const grid = el.querySelector('#vehicles-grid');
    if (!vehicles.length) {
      grid.innerHTML = '<div class="empty-state">Este cliente aún no tiene vehículos registrados.</div>';
      return;
    }
    grid.innerHTML = vehicles.map((v) => `
      <div class="card" data-clickable data-id="${v.id}" style="cursor:pointer">
        <div class="flex items-center gap-2">${icon('vehicle')} <strong>${vehicleLabel(v)}</strong></div>
        <p class="text-sm">Placas: ${v.plates || '—'} · Color: ${v.color || '—'}</p>
      </div>
    `).join('');
    grid.querySelectorAll('[data-clickable]').forEach((card) => {
      card.addEventListener('click', () => navigate('vehicles', card.dataset.id));
    });
  }));
}

async function renderHistoryTab(clientId) {
  const el = container.querySelector('#tab-history');
  el.innerHTML = '<div class="skeleton" style="height:200px"></div>';
  try {
    const orders = await getAll(COLLECTIONS.SERVICE_ORDERS, where('clientId', '==', clientId), orderBy('createdAt', 'desc'));
    if (!orders.length) {
      el.innerHTML = '<div class="empty-state">Este cliente no tiene órdenes de servicio previas.</div>';
      return;
    }
    el.innerHTML = orders.map((o) => {
      const meta = ORDER_STATUS_META[o.status] || { label: o.status, color: 'neutral' };
      return `
      <div class="flex items-center justify-between" data-id="${o.id}" data-clickable style="padding:10px 0;border-bottom:1px solid var(--color-border);cursor:pointer">
        <div><strong>${o.folioLabel || o.id}</strong><div class="text-sm text-muted">${o.vehicleLabel || ''} · ${formatDate(o.createdAt)}</div></div>
        <span class="badge badge--${meta.color}">${meta.label}</span>
      </div>`;
    }).join('');
    el.querySelectorAll('[data-clickable]').forEach((row) => {
      row.addEventListener('click', () => navigate('service-orders', row.dataset.id));
    });
  } catch (error) {
    console.error('[clients] history load failed', error);
    el.innerHTML = '<div class="empty-state">No se pudo cargar el historial.</div>';
  }
}

function switchTab(tabName) {
  container.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tabName));
  container.querySelectorAll('[id^="tab-"]').forEach((panel) => panel.classList.toggle('hidden', panel.id !== `tab-${tabName}`));
}

async function mountDetail(clientId) {
  container.innerHTML = '<div class="skeleton" style="height:400px"></div>';
  const client = await getClient(clientId);
  if (!client) {
    container.innerHTML = '<div class="empty-state">Cliente no encontrado.</div>';
    return;
  }

  container.innerHTML = `
    <div class="page-header">
      <div class="flex items-center gap-3">
        <button class="btn btn--icon btn--ghost" id="back">${icon('chevronRight', { className: 'rotate-180' })}</button>
        <div>
          <h1 class="mb-0">${client.name}</h1>
          <p class="mb-0 text-sm">${client.phone || ''} ${client.email ? '· ' + client.email : ''}</p>
        </div>
      </div>
      <div class="flex gap-2">
        <button class="btn btn--outline" id="edit-client">${icon('edit', { size: 16 })} Editar</button>
        <button class="btn btn--danger" id="delete-client">${icon('trash', { size: 16 })} Eliminar</button>
      </div>
    </div>

    ${client.notes ? `<div class="card section"><strong>Observaciones:</strong> ${client.notes}</div>` : ''}

    <div class="tabs">
      <div class="tab active" data-tab="vehicles">Vehículos</div>
      <div class="tab" data-tab="history">Historial de servicios</div>
    </div>
    <div id="tab-vehicles"></div>
    <div id="tab-history" class="hidden"></div>
  `;

  container.querySelector('#back').addEventListener('click', () => navigate('clients'));
  container.querySelector('#edit-client').addEventListener('click', () => openClientModal(client));
  container.querySelector('#delete-client').addEventListener('click', async () => {
    const confirmed = await confirmDialog({
      title: 'Eliminar cliente',
      message: `¿Eliminar a "${client.name}"? Esta acción no se puede deshacer.`
    });
    if (!confirmed) return;
    await deleteClient(clientId);
    showToast('Cliente eliminado', 'success');
    navigate('clients');
  });

  container.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => switchTab(tab.dataset.tab)));

  renderVehiclesTab(clientId);
  renderHistoryTab(clientId);
}

// ---------------------------------------------------------------------

async function mount(root, ctx) {
  container = root;
  clearUnsubs();
  const clientId = ctx.params?.[0];
  if (clientId) await mountDetail(clientId);
  else mountList();
}

function unmount() {
  clearUnsubs();
  container = null;
}

export default { mount, unmount };
