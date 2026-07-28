/**
 * warranties.module.js
 * -----------------------------------------------------------------------
 * List + create/edit for warranty records, with a detail screen for
 * evidence photos (spec: Fecha, Tipo, Vigencia, Evidencias, Observaciones).
 */

import { subscribeWarranties, getWarranty, createWarranty, updateWarranty, deleteWarranty, isExpired } from './warranties.service.js';
import { WARRANTY_TYPES } from '../../config/constants.js';
import { renderTable, sortRows } from '../../components/ui/table.js';
import { openModal, confirmDialog } from '../../components/ui/modal.js';
import { buildForm, readForm, validateForm } from '../../components/ui/form-builder.js';
import { createPhotoUploader } from '../../components/ui/file-upload.js';
import { showToast } from '../../components/ui/toast.js';
import { icon } from '../../components/ui/icons.js';
import { navigate } from '../../core/router.js';
import { formatDate, createUnsubTracker, escapeHtml } from '../../core/utils.js';

const unsubTracker = createUnsubTracker();
let container = null;

let allWarranties = [];
let sortKey = 'expiresAt';
let sortDir = 'asc';

function warrantyFormFields(w = {}) {
  return [
    { name: 'clientName', label: 'Cliente', required: true, value: w.clientName },
    { name: 'vehicleLabel', label: 'Vehículo', value: w.vehicleLabel },
    { name: 'orderFolio', label: 'Folio de orden relacionada', value: w.orderFolio },
    { name: 'type', label: 'Tipo de garantía', type: 'select', options: WARRANTY_TYPES.map((t) => ({ value: t, label: t })), value: w.type, required: true },
    { name: 'startDate', label: 'Fecha de inicio', type: 'date', value: w.startDate, required: true },
    { name: 'expiresAt', label: 'Vigencia hasta', type: 'date', value: w.expiresAt, required: true },
    { name: 'notes', label: 'Observaciones', type: 'textarea', value: w.notes, fullWidth: true }
  ];
}

function openWarrantyModal(warranty) {
  const form = buildForm(warrantyFormFields(warranty));
  const footer = document.createElement('div');
  footer.className = 'flex gap-2';
  footer.innerHTML = `<button class="btn btn--outline" id="cancel">Cancelar</button>
    <button class="btn btn--primary" id="save">${warranty ? 'Guardar' : 'Crear garantía'}</button>`;
  const modal = openModal({ title: warranty ? 'Editar garantía' : 'Nueva garantía', body: form, footer, maxWidth: '600px' });
  footer.querySelector('#cancel').addEventListener('click', modal.close);
  footer.querySelector('#save').addEventListener('click', async () => {
    if (!validateForm(form)) return;
    const data = readForm(form);
    if (warranty) await updateWarranty(warranty.id, data); else await createWarranty(data);
    showToast('Garantía guardada', 'success');
    modal.close();
  });
}

function renderList(rows) {
  const el = container.querySelector('#warranties-table');
  renderTable(el, {
    columns: [
      { key: 'clientName', label: 'Cliente' },
      { key: 'vehicleLabel', label: 'Vehículo', render: (w) => w.vehicleLabel || '—' },
      { key: 'type', label: 'Tipo' },
      { key: 'startDate', label: 'Inicio', render: (w) => formatDate(w.startDate) },
      { key: 'expiresAt', label: 'Vigencia', render: (w) => `${formatDate(w.expiresAt)} ${isExpired(w) ? '<span class="badge badge--danger">Vencida</span>' : '<span class="badge badge--success">Vigente</span>'}` }
    ],
    rows, sortKey, sortDir,
    onSort: (key) => { sortDir = sortKey === key && sortDir === 'asc' ? 'desc' : 'asc'; sortKey = key; renderList(sortRows(allWarranties, sortKey, sortDir)); },
    onRowClick: (row) => navigate('warranties', row.id),
    emptyMessage: 'Sin garantías registradas.'
  });
}

function mountList() {
  container.innerHTML = `
    <div class="page-header">
      <h1>Garantías</h1>
      <button class="btn btn--primary" id="new-warranty">${icon('plus', { size: 16 })} Nueva garantía</button>
    </div>
    <div class="card"><div id="warranties-table"><div class="skeleton" style="height:280px"></div></div></div>
  `;
  container.querySelector('#new-warranty').addEventListener('click', () => openWarrantyModal());
  unsubTracker.track(subscribeWarranties((rows) => { allWarranties = rows; renderList(sortRows(rows, sortKey, sortDir)); }));
}

async function mountDetail(warrantyId) {
  container.innerHTML = '<div class="skeleton" style="height:360px"></div>';
  const warranty = await getWarranty(warrantyId);
  if (!warranty) { container.innerHTML = '<div class="empty-state">Garantía no encontrada.</div>'; return; }

  container.innerHTML = `
    <div class="page-header">
      <div class="flex items-center gap-3">
        <button class="btn btn--icon btn--ghost" id="back">${icon('chevronRight', { className: 'rotate-180' })}</button>
        <h1 class="mb-0">Garantía — ${escapeHtml(warranty.clientName || '')}</h1>
      </div>
      <div class="flex gap-2">
        <button class="btn btn--outline" id="edit-warranty">${icon('edit', { size: 16 })} Editar</button>
        <button class="btn btn--danger" id="delete-warranty">${icon('trash', { size: 16 })} Eliminar</button>
      </div>
    </div>
    <div class="grid grid--2">
      <div class="card">
        <p class="text-sm"><strong>Vehículo:</strong> ${escapeHtml(warranty.vehicleLabel || '—')}</p>
        <p class="text-sm"><strong>Folio relacionado:</strong> ${escapeHtml(warranty.orderFolio || '—')}</p>
        <p class="text-sm"><strong>Tipo:</strong> ${escapeHtml(warranty.type || '')}</p>
        <p class="text-sm"><strong>Vigente desde:</strong> ${formatDate(warranty.startDate)}</p>
        <p class="text-sm"><strong>Vigente hasta:</strong> ${formatDate(warranty.expiresAt)} ${isExpired(warranty) ? '<span class="badge badge--danger">Vencida</span>' : '<span class="badge badge--success">Vigente</span>'}</p>
        ${warranty.notes ? `<p class="text-sm"><strong>Observaciones:</strong> ${escapeHtml(warranty.notes)}</p>` : ''}
      </div>
      <div class="card" id="evidence-section"></div>
    </div>
  `;

  container.querySelector('#back').addEventListener('click', () => navigate('warranties'));
  container.querySelector('#edit-warranty').addEventListener('click', () => openWarrantyModal(warranty));
  container.querySelector('#delete-warranty').addEventListener('click', async () => {
    const confirmed = await confirmDialog({ title: 'Eliminar garantía', message: '¿Eliminar este registro de garantía?' });
    if (!confirmed) return;
    await deleteWarranty(warrantyId);
    showToast('Garantía eliminada', 'success');
    navigate('warranties');
  });

  createPhotoUploader(container.querySelector('#evidence-section'), {
    folderPath: `warranties/${warrantyId}`,
    initialPhotos: warranty.evidence || [],
    label: 'Evidencias',
    onChange: (photos) => updateWarranty(warrantyId, { evidence: photos })
  });
}

async function mount(root, ctx) {
  container = root;
  unsubTracker.clear();
  const warrantyId = ctx.params?.[0];
  if (warrantyId) await mountDetail(warrantyId);
  else mountList();
}

function unmount() { unsubTracker.clear(); container = null; }

export default { mount, unmount };
