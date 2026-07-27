/**
 * catalog.module.js
 * -----------------------------------------------------------------------
 * Editable services catalog. Seeded once from the business's known
 * service list (recarga de gas, cambio de compresor, etc.) and fully
 * editable afterwards — staff can rename, reprice or add custom services
 * without touching code.
 */

import { subscribeCatalog, seedCatalogIfEmpty, createService, updateService, deleteService } from './catalog.service.js';
import { renderTable } from '../../components/ui/table.js';
import { openModal, confirmDialog } from '../../components/ui/modal.js';
import { buildForm, readForm, validateForm } from '../../components/ui/form-builder.js';
import { showToast } from '../../components/ui/toast.js';
import { icon } from '../../components/ui/icons.js';
import { formatCurrency } from '../../core/utils.js';

let unsubscribe = null;
let container = null;

const CATEGORY_OPTIONS = [
  { value: 'clima', label: 'Clima' },
  { value: 'mantenimiento', label: 'Mantenimiento' },
  { value: 'diagnostico', label: 'Diagnóstico' },
  { value: 'otro', label: 'Otro' }
];

function openServiceModal(service) {
  const form = buildForm([
    { name: 'name', label: 'Nombre del servicio', required: true, value: service?.name, fullWidth: true },
    { name: 'category', label: 'Categoría', type: 'select', options: CATEGORY_OPTIONS, value: service?.category },
    { name: 'defaultPrice', label: 'Precio sugerido', type: 'number', step: '0.01', value: service?.defaultPrice ?? 0 }
  ]);
  const footer = document.createElement('div');
  footer.className = 'flex gap-2';
  footer.innerHTML = `<button class="btn btn--outline" id="cancel">Cancelar</button>
    <button class="btn btn--primary" id="save">${service ? 'Guardar' : 'Agregar'}</button>`;
  const modal = openModal({ title: service ? 'Editar servicio' : 'Nuevo servicio', body: form, footer, maxWidth: '480px' });
  footer.querySelector('#cancel').addEventListener('click', modal.close);
  footer.querySelector('#save').addEventListener('click', async () => {
    if (!validateForm(form)) return;
    const data = readForm(form);
    if (service) await updateService(service.id, data); else await createService(data);
    showToast('Catálogo actualizado', 'success');
    modal.close();
  });
}

function renderList(rows) {
  const el = container.querySelector('#catalog-table');
  renderTable(el, {
    columns: [
      { key: 'name', label: 'Servicio' },
      { key: 'category', label: 'Categoría', render: (s) => CATEGORY_OPTIONS.find((c) => c.value === s.category)?.label || s.category || '—' },
      { key: 'defaultPrice', label: 'Precio sugerido', align: 'right', render: (s) => formatCurrency(s.defaultPrice) },
      { key: 'actions', label: '', sortable: false, align: 'right', render: (s) => `
        <button class="btn btn--icon btn--ghost" data-edit="${s.id}">${icon('edit', { size: 14 })}</button>
        <button class="btn btn--icon btn--ghost" data-delete="${s.id}">${icon('trash', { size: 14 })}</button>
      ` }
    ],
    rows,
    emptyMessage: 'Sin servicios en el catálogo.'
  });

  el.querySelectorAll('[data-edit]').forEach((btn) => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    openServiceModal(rows.find((r) => r.id === btn.dataset.edit));
  }));
  el.querySelectorAll('[data-delete]').forEach((btn) => btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const confirmed = await confirmDialog({ title: 'Eliminar servicio', message: '¿Eliminar este servicio del catálogo?' });
    if (confirmed) { await deleteService(btn.dataset.delete); showToast('Servicio eliminado', 'success'); }
  }));
}

async function mount(root) {
  container = root;
  container.innerHTML = `
    <div class="page-header">
      <h1>Catálogo de servicios</h1>
      <button class="btn btn--primary" id="new-service">${icon('plus', { size: 16 })} Nuevo servicio</button>
    </div>
    <div class="card"><div id="catalog-table"><div class="skeleton" style="height:280px"></div></div></div>
  `;
  container.querySelector('#new-service').addEventListener('click', () => openServiceModal());

  await seedCatalogIfEmpty();
  unsubscribe = subscribeCatalog(renderList);
}

function unmount() {
  unsubscribe?.();
  unsubscribe = null;
  container = null;
}

export default { mount, unmount };
