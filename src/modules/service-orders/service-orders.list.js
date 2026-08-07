/**
 * service-orders.list.js
 * -----------------------------------------------------------------------
 * The #/service-orders list screen: search, status filter, sortable table.
 * Split out of service-orders.module.js to keep that file to orchestration
 * only — this piece owns its own filter/sort state and only needs the
 * container element and the shared unsub tracker from the caller.
 */

import { subscribeOrders } from './service-orders.service.js';
import { ORDER_STATUS_META } from '../../config/constants.js';
import { renderTable, sortRows } from '../../components/ui/table.js';
import { icon } from '../../components/ui/icons.js';
import { navigate } from '../../core/router.js';
import { debounce, normalizeText, formatDate, formatCurrency, escapeHtml } from '../../core/utils.js';

let container = null;
let allOrders = [];
let searchTerm = '';
let statusFilter = '';
let sortKey = 'createdAt';
let sortDir = 'desc';

function renderList(rows) {
  const listEl = container.querySelector('#orders-table');
  renderTable(listEl, {
    columns: [
      { key: 'folioLabel', label: 'Folio', render: (o) => `
        <span class="flex items-center gap-2">
          ${escapeHtml(o.folioLabel)}
          ${o.pdfSentAt ? `<span title="PDF enviado al cliente" style="color:var(--color-success)">${icon('send', { size: 14 })}</span>` : ''}
        </span>` },
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

export function mountOrdersList(root, unsubTracker) {
  container = root;
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

  unsubTracker.track(subscribeOrders((rows) => { allOrders = rows; applyFilterAndRender(); }));
}
