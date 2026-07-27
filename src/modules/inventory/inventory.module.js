/**
 * inventory.module.js
 * -----------------------------------------------------------------------
 * Parts/compressors/gas/tools stock control with automatic low-stock
 * alerts (spec: "Existencias, Stock mínimo, Alertas automáticas").
 */

import { subscribeInventory, createItem, updateItem, deleteItem, isLowStock } from './inventory.service.js';
import { renderTable, sortRows } from '../../components/ui/table.js';
import { openModal, confirmDialog } from '../../components/ui/modal.js';
import { buildForm, readForm, validateForm } from '../../components/ui/form-builder.js';
import { showToast } from '../../components/ui/toast.js';
import { icon } from '../../components/ui/icons.js';
import { INVENTORY_CATEGORIES, INVENTORY_CATEGORY_LABELS } from '../../config/constants.js';
import { debounce, normalizeText, formatCurrency } from '../../core/utils.js';

let unsubscribe = null;
let container = null;
let allItems = [];
let searchTerm = '';
let categoryFilter = '';
let sortKey = 'name';
let sortDir = 'asc';

const CATEGORY_OPTIONS = INVENTORY_CATEGORIES.map((c) => ({ value: c, label: INVENTORY_CATEGORY_LABELS[c] }));

function openItemModal(item) {
  const form = buildForm([
    { name: 'name', label: 'Nombre', required: true, value: item?.name, fullWidth: true },
    { name: 'category', label: 'Categoría', type: 'select', options: CATEGORY_OPTIONS, value: item?.category, required: true },
    { name: 'sku', label: 'Código / SKU', value: item?.sku },
    { name: 'unit', label: 'Unidad', value: item?.unit || 'pza', placeholder: 'pza, kg, lt…' },
    { name: 'stock', label: 'Existencias', type: 'number', value: item?.stock ?? 0, required: true },
    { name: 'minStock', label: 'Stock mínimo', type: 'number', value: item?.minStock ?? 1, required: true },
    { name: 'cost', label: 'Costo unitario', type: 'number', step: '0.01', value: item?.cost ?? 0 }
  ]);
  const footer = document.createElement('div');
  footer.className = 'flex gap-2';
  footer.innerHTML = `<button class="btn btn--outline" id="cancel">Cancelar</button>
    <button class="btn btn--primary" id="save">${item ? 'Guardar' : 'Agregar'}</button>`;
  const modal = openModal({ title: item ? 'Editar artículo' : 'Nuevo artículo', body: form, footer, maxWidth: '560px' });
  footer.querySelector('#cancel').addEventListener('click', modal.close);
  footer.querySelector('#save').addEventListener('click', async () => {
    if (!validateForm(form)) return;
    const data = readForm(form);
    if (item) await updateItem(item.id, data); else await createItem(data);
    showToast('Inventario actualizado', 'success');
    modal.close();
  });
}

function renderAlerts(lowStockItems) {
  const el = container.querySelector('#stock-alerts');
  if (!lowStockItems.length) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <div class="alert alert--danger section">
      ${icon('warning', { size: 18 })}
      <div>
        <strong>${lowStockItems.length} artículo(s) con stock bajo:</strong>
        ${lowStockItems.map((i) => i.name).join(', ')}
      </div>
    </div>`;
}

function renderList(rows) {
  const el = container.querySelector('#inventory-table');
  renderTable(el, {
    columns: [
      { key: 'name', label: 'Nombre' },
      { key: 'category', label: 'Categoría', render: (i) => INVENTORY_CATEGORY_LABELS[i.category] || i.category },
      { key: 'sku', label: 'Código', render: (i) => i.sku || '—' },
      { key: 'stock', label: 'Existencias', align: 'center', render: (i) => `
        ${i.stock} ${i.unit || ''} ${isLowStock(i) ? `<span class="badge badge--danger">Bajo</span>` : ''}
      ` },
      { key: 'minStock', label: 'Mínimo', align: 'center' },
      { key: 'cost', label: 'Costo', align: 'right', render: (i) => formatCurrency(i.cost) },
      { key: 'actions', label: '', sortable: false, align: 'right', render: (i) => `
        <button class="btn btn--icon btn--ghost" data-edit="${i.id}">${icon('edit', { size: 14 })}</button>
        <button class="btn btn--icon btn--ghost" data-delete="${i.id}">${icon('trash', { size: 14 })}</button>
      ` }
    ],
    rows, sortKey, sortDir,
    onSort: (key) => { sortDir = sortKey === key && sortDir === 'asc' ? 'desc' : 'asc'; sortKey = key; applyFilterAndRender(); },
    emptyMessage: 'Sin artículos en el inventario.'
  });

  el.querySelectorAll('[data-edit]').forEach((btn) => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    openItemModal(allItems.find((r) => r.id === btn.dataset.edit));
  }));
  el.querySelectorAll('[data-delete]').forEach((btn) => btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const confirmed = await confirmDialog({ title: 'Eliminar artículo', message: '¿Eliminar este artículo del inventario?' });
    if (confirmed) { await deleteItem(btn.dataset.delete); showToast('Artículo eliminado', 'success'); }
  }));
}

function applyFilterAndRender() {
  const term = normalizeText(searchTerm);
  let filtered = allItems;
  if (categoryFilter) filtered = filtered.filter((i) => i.category === categoryFilter);
  if (term) filtered = filtered.filter((i) => [i.name, i.sku].some((f) => normalizeText(f).includes(term)));
  renderAlerts(allItems.filter(isLowStock));
  renderList(sortRows(filtered, sortKey, sortDir));
}

async function mount(root) {
  container = root;
  container.innerHTML = `
    <div class="page-header">
      <h1>Inventario</h1>
      <button class="btn btn--primary" id="new-item">${icon('plus', { size: 16 })} Nuevo artículo</button>
    </div>
    <div id="stock-alerts"></div>
    <div class="card">
      <div class="table-toolbar">
        <input class="input" id="inv-search" placeholder="Buscar por nombre o código…" style="max-width:280px" />
        <select class="select" id="inv-category" style="max-width:220px">
          <option value="">Todas las categorías</option>
          ${CATEGORY_OPTIONS.map((c) => `<option value="${c.value}">${c.label}</option>`).join('')}
        </select>
      </div>
      <div id="inventory-table"><div class="skeleton" style="height:280px"></div></div>
    </div>
  `;
  container.querySelector('#new-item').addEventListener('click', () => openItemModal());
  container.querySelector('#inv-search').addEventListener('input', debounce((e) => { searchTerm = e.target.value; applyFilterAndRender(); }, 200));
  container.querySelector('#inv-category').addEventListener('change', (e) => { categoryFilter = e.target.value; applyFilterAndRender(); });

  unsubscribe = subscribeInventory((rows) => { allItems = rows; applyFilterAndRender(); });
}

function unmount() {
  unsubscribe?.();
  unsubscribe = null;
  container = null;
}

export default { mount, unmount };
