/**
 * payments.module.js
 * -----------------------------------------------------------------------
 * Payment history + "register a payment" flow. Can be opened directly
 * against an order via `#/payments?orderId=...` (service-orders detail's
 * "Registrar pago" button uses this).
 */

import { subscribePayments, registerPayment, orderBalance } from './payments.service.js';
import { getAll } from '../../core/db.service.js';
import { COLLECTIONS, PAYMENT_METHODS, ORDER_STATUS } from '../../config/constants.js';
import { renderTable, sortRows } from '../../components/ui/table.js';
import { openModal } from '../../components/ui/modal.js';
import { buildForm, readForm, validateForm } from '../../components/ui/form-builder.js';
import { createSearchSelect } from '../../components/ui/search-select.js';
import { showToast } from '../../components/ui/toast.js';
import { icon } from '../../components/ui/icons.js';
import { formatCurrency, formatDateTime } from '../../core/utils.js';

let unsubscribe = null;
let container = null;
let sortKey = 'createdAt';
let sortDir = 'desc';

const PAYMENT_TYPES = [
  { value: 'anticipo', label: 'Anticipo' },
  { value: 'abono', label: 'Abono' },
  { value: 'pago_total', label: 'Pago total' }
];

function renderList(rows) {
  const el = container.querySelector('#payments-table');
  renderTable(el, {
    columns: [
      { key: 'orderFolio', label: 'Orden' },
      { key: 'clientName', label: 'Cliente' },
      { key: 'amount', label: 'Monto', align: 'right', render: (p) => formatCurrency(p.amount) },
      { key: 'method', label: 'Método' },
      { key: 'type', label: 'Tipo', render: (p) => PAYMENT_TYPES.find((t) => t.value === p.type)?.label || p.type },
      { key: 'createdAt', label: 'Fecha', render: (p) => formatDateTime(p.createdAt) }
    ],
    rows, sortKey, sortDir,
    onSort: (key) => { sortDir = sortKey === key && sortDir === 'asc' ? 'desc' : 'asc'; sortKey = key; renderList(sortRows(rows, sortKey, sortDir)); },
    emptyMessage: 'No se han registrado pagos.'
  });
}

async function openPaymentModal(preselectOrderId) {
  const orders = (await getAll(COLLECTIONS.SERVICE_ORDERS))
    .filter((o) => o.status !== ORDER_STATUS.CANCELADO && orderBalance(o) > 0);

  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="field"><label class="field__label">Orden de servicio *</label><div id="order-picker"></div></div>
    <div id="order-balance" class="text-sm text-muted" style="margin-bottom:12px"></div>
  `;
  const form = buildForm([
    { name: 'amount', label: 'Monto', type: 'number', step: '0.01', required: true },
    { name: 'method', label: 'Método de pago', type: 'select', options: PAYMENT_METHODS.map((m) => ({ value: m, label: m })), required: true },
    { name: 'type', label: 'Tipo de pago', type: 'select', options: PAYMENT_TYPES, required: true },
    { name: 'notes', label: 'Notas', type: 'textarea', fullWidth: true }
  ]);
  wrap.appendChild(form);

  const footer = document.createElement('div');
  footer.className = 'flex gap-2';
  footer.innerHTML = `<button class="btn btn--outline" id="cancel">Cancelar</button><button class="btn btn--primary" id="save">Registrar pago</button>`;

  const modal = openModal({ title: 'Registrar pago', body: wrap, footer, maxWidth: '520px' });
  footer.querySelector('#cancel').addEventListener('click', modal.close);

  let selectedOrder = orders.find((o) => o.id === preselectOrderId) || null;
  const balanceEl = wrap.querySelector('#order-balance');
  const updateBalanceText = () => {
    balanceEl.textContent = selectedOrder ? `Saldo pendiente: ${formatCurrency(orderBalance(selectedOrder))}` : '';
  };

  createSearchSelect(wrap.querySelector('#order-picker'), {
    placeholder: 'Buscar por folio o cliente…',
    initialLabel: selectedOrder ? `${selectedOrder.folioLabel} — ${selectedOrder.clientName}` : '',
    getOptions: () => orders.map((o) => ({ id: o.id, label: `${o.folioLabel} — ${o.clientName}`, sublabel: `Saldo: ${formatCurrency(orderBalance(o))}` })),
    onSelect: (option) => { selectedOrder = orders.find((o) => o.id === option.id); updateBalanceText(); }
  });
  updateBalanceText();

  footer.querySelector('#save').addEventListener('click', async () => {
    if (!selectedOrder) { showToast('Selecciona una orden de servicio', 'warning'); return; }
    if (!validateForm(form)) return;
    const data = readForm(form);
    try {
      await registerPayment({ ...data, orderId: selectedOrder.id });
      showToast('Pago registrado', 'success');
      modal.close();
    } catch (error) {
      console.error('[payments] register failed', error);
      showToast(error.message || 'No se pudo registrar el pago', 'danger');
    }
  });
}

async function mount(root, ctx) {
  container = root;
  container.innerHTML = `
    <div class="page-header">
      <h1>Pagos</h1>
      <button class="btn btn--primary" id="new-payment">${icon('plus', { size: 16 })} Registrar pago</button>
    </div>
    <div class="card"><div id="payments-table"><div class="skeleton" style="height:280px"></div></div></div>
  `;
  container.querySelector('#new-payment').addEventListener('click', () => openPaymentModal());

  unsubscribe = subscribePayments((rows) => renderList(sortRows(rows, sortKey, sortDir)));

  if (ctx.query?.orderId) openPaymentModal(ctx.query.orderId);
}

function unmount() { unsubscribe?.(); unsubscribe = null; container = null; }

export default { mount, unmount };
