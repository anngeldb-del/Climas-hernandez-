/**
 * quotes.module.js
 * -----------------------------------------------------------------------
 * List, creation form and detail screen for quotes. Routes mirror
 * service-orders: #/quotes, #/quotes/new, #/quotes/{id}.
 */

import { subscribeQuotes, getQuote, createQuote, updateQuote, deleteQuote, computeQuoteTotals } from './quotes.service.js';
import { getAll } from '../../core/db.service.js';
import { COLLECTIONS } from '../../config/constants.js';
import { getVehiclesByClient, vehicleLabel } from '../vehicles/vehicles.service.js';
import { renderTable, sortRows } from '../../components/ui/table.js';
import { createSearchSelect } from '../../components/ui/search-select.js';
import { createLineItems } from '../../components/ui/line-items.js';
import { createSignaturePad } from '../../components/ui/signature-pad.js';
import { canvasToFile, uploadPhoto } from '../../core/storage.service.js';
import { confirmDialog } from '../../components/ui/modal.js';
import { showToast } from '../../components/ui/toast.js';
import { icon } from '../../components/ui/icons.js';
import { navigate } from '../../core/router.js';
import { formatCurrency, formatDate } from '../../core/utils.js';
import { generateQuotePdf } from './quote-pdf.js';

let unsubscribers = [];
let container = null;
function trackUnsub(fn) { unsubscribers.push(fn); return fn; }
function clearUnsubs() { unsubscribers.forEach((fn) => fn()); unsubscribers = []; }

let allQuotes = [];
let sortKey = 'createdAt';
let sortDir = 'desc';

function renderList(rows) {
  const el = container.querySelector('#quotes-table');
  renderTable(el, {
    columns: [
      { key: 'folioLabel', label: 'Folio' },
      { key: 'clientName', label: 'Cliente' },
      { key: 'vehicleLabel', label: 'Vehículo' },
      { key: 'total', label: 'Total', align: 'right', render: (q) => formatCurrency(q.total) },
      { key: 'createdAt', label: 'Fecha', render: (q) => formatDate(q.createdAt) }
    ],
    rows, sortKey, sortDir,
    onSort: (key) => { sortDir = sortKey === key && sortDir === 'asc' ? 'desc' : 'asc'; sortKey = key; renderList(sortRows(allQuotes, sortKey, sortDir)); },
    onRowClick: (row) => navigate('quotes', row.id),
    emptyMessage: 'No hay cotizaciones registradas.'
  });
}

function mountList() {
  container.innerHTML = `
    <div class="page-header">
      <h1>Cotizaciones</h1>
      <button class="btn btn--primary" id="new-quote">${icon('plus', { size: 16 })} Nueva cotización</button>
    </div>
    <div class="card"><div id="quotes-table"><div class="skeleton" style="height:280px"></div></div></div>
  `;
  container.querySelector('#new-quote').addEventListener('click', () => navigate('quotes', 'new'));
  trackUnsub(subscribeQuotes((rows) => { allQuotes = rows; renderList(sortRows(rows, sortKey, sortDir)); }));
}

async function mountNewQuote() {
  container.innerHTML = `
    <div class="page-header">
      <div class="flex items-center gap-3">
        <button class="btn btn--icon btn--ghost" id="back">${icon('chevronRight', { className: 'rotate-180' })}</button>
        <h1 class="mb-0">Nueva cotización</h1>
      </div>
    </div>
    <form id="quote-form" class="card">
      <div class="grid grid--form">
        <div class="field"><label class="field__label">Cliente *</label><div id="client-picker"></div></div>
        <div class="field"><label class="field__label">Vehículo</label><div id="vehicle-picker"></div></div>
      </div>

      <h3>Conceptos</h3>
      <div id="quote-lines"></div>

      <div class="field" style="margin-top:16px">
        <label class="flex items-center gap-2"><input type="checkbox" id="tax-enabled" /> Incluir IVA (16%)</label>
      </div>

      <div class="text-right section">
        <p>Subtotal: <strong id="subtotal-display">$0.00</strong></p>
        <p>IVA: <strong id="tax-display">$0.00</strong></p>
        <p style="font-size:1.25rem">Total: <strong id="total-display">$0.00</strong></p>
      </div>

      <div class="flex justify-end gap-2">
        <button type="button" class="btn btn--outline" id="cancel">Cancelar</button>
        <button type="submit" class="btn btn--primary">Guardar cotización</button>
      </div>
    </form>
  `;

  container.querySelector('#back').addEventListener('click', () => navigate('quotes'));
  container.querySelector('#cancel').addEventListener('click', () => navigate('quotes'));

  const clients = await getAll(COLLECTIONS.CLIENTS);
  let selectedClient = null;
  let selectedVehicle = null;
  let clientVehicles = [];

  createSearchSelect(container.querySelector('#client-picker'), {
    placeholder: 'Buscar cliente…',
    getOptions: () => clients.map((c) => ({ id: c.id, label: c.name, sublabel: c.phone })),
    onSelect: async (option) => {
      selectedClient = clients.find((c) => c.id === option.id);
      clientVehicles = await getVehiclesByClient(selectedClient.id);
      createSearchSelect(container.querySelector('#vehicle-picker'), {
        placeholder: 'Buscar vehículo…',
        getOptions: () => clientVehicles.map((v) => ({ id: v.id, label: vehicleLabel(v), sublabel: v.plates })),
        onSelect: (vOption) => { selectedVehicle = clientVehicles.find((v) => v.id === vOption.id); }
      });
    }
  });

  const taxCheckbox = container.querySelector('#tax-enabled');
  function refreshTotals() {
    const { subtotal, tax, total } = computeQuoteTotals(lineItems.getItems(), taxCheckbox.checked);
    container.querySelector('#subtotal-display').textContent = formatCurrency(subtotal);
    container.querySelector('#tax-display').textContent = formatCurrency(tax);
    container.querySelector('#total-display').textContent = formatCurrency(total);
  }
  const lineItems = createLineItems(container.querySelector('#quote-lines'), { onChange: refreshTotals });
  taxCheckbox.addEventListener('change', refreshTotals);
  refreshTotals();

  container.querySelector('#quote-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!selectedClient) { showToast('Selecciona un cliente', 'warning'); return; }
    const items = lineItems.getItems();
    const { subtotal, tax, total } = computeQuoteTotals(items, taxCheckbox.checked);
    try {
      const { id } = await createQuote({
        clientId: selectedClient.id,
        clientName: selectedClient.name,
        clientPhone: selectedClient.phone,
        vehicleId: selectedVehicle?.id || null,
        vehicleLabel: selectedVehicle ? vehicleLabel(selectedVehicle) : '',
        items, taxEnabled: taxCheckbox.checked, subtotal, tax, total
      });
      showToast('Cotización creada', 'success');
      navigate('quotes', id);
    } catch (error) {
      console.error('[quotes] create failed', error);
      showToast('No se pudo crear la cotización', 'danger');
    }
  });
}

async function mountDetail(quoteId) {
  container.innerHTML = '<div class="skeleton" style="height:400px"></div>';
  const quote = await getQuote(quoteId);
  if (!quote) { container.innerHTML = '<div class="empty-state">Cotización no encontrada.</div>'; return; }

  container.innerHTML = `
    <div class="page-header">
      <div class="flex items-center gap-3">
        <button class="btn btn--icon btn--ghost" id="back">${icon('chevronRight', { className: 'rotate-180' })}</button>
        <div><h1 class="mb-0">${quote.folioLabel}</h1><p class="mb-0 text-sm">${quote.clientName} · ${quote.vehicleLabel || 'Sin vehículo'}</p></div>
      </div>
      <div class="flex gap-2">
        <button class="btn btn--outline" id="download-pdf">${icon('download', { size: 16 })} Descargar PDF</button>
        <button class="btn btn--danger" id="delete-quote">${icon('trash', { size: 16 })} Eliminar</button>
      </div>
    </div>

    <div class="grid grid--2">
      <div class="card">
        <h3>Conceptos</h3>
        <table class="table">
          <thead><tr><th>Descripción</th><th>Cant.</th><th>P. Unit.</th><th>Importe</th></tr></thead>
          <tbody>${(quote.items || []).map((i) => `<tr><td>${i.description}</td><td>${i.quantity}</td><td>${formatCurrency(i.unitPrice)}</td><td>${formatCurrency(i.quantity * i.unitPrice)}</td></tr>`).join('')}</tbody>
        </table>
        <p class="text-right">Subtotal: ${formatCurrency(quote.subtotal)}</p>
        ${quote.taxEnabled ? `<p class="text-right">IVA: ${formatCurrency(quote.tax)}</p>` : ''}
        <p class="text-right" style="font-size:1.25rem"><strong>Total: ${formatCurrency(quote.total)}</strong></p>
      </div>
      <div class="card">
        <h3>Firma de conformidad</h3>
        ${quote.signatureUrl
          ? `<img src="${quote.signatureUrl}" alt="Firma" style="max-width:100%;border:1px solid var(--color-border);border-radius:8px" />`
          : `<div id="sig-pad"></div><div class="flex gap-2" style="margin-top:8px"><button class="btn btn--outline btn--sm" id="sig-clear">Limpiar</button><button class="btn btn--primary btn--sm" id="sig-save">Guardar firma</button></div>`}
      </div>
    </div>
  `;

  container.querySelector('#back').addEventListener('click', () => navigate('quotes'));
  container.querySelector('#download-pdf').addEventListener('click', async () => {
    const btn = container.querySelector('#download-pdf');
    btn.disabled = true;
    try { await generateQuotePdf(quote); } finally { btn.disabled = false; }
  });
  container.querySelector('#delete-quote').addEventListener('click', async () => {
    const confirmed = await confirmDialog({ title: 'Eliminar cotización', message: `¿Eliminar ${quote.folioLabel}?` });
    if (!confirmed) return;
    await deleteQuote(quoteId);
    showToast('Cotización eliminada', 'success');
    navigate('quotes');
  });

  if (!quote.signatureUrl) {
    const pad = createSignaturePad(container.querySelector('#sig-pad'));
    container.querySelector('#sig-clear').addEventListener('click', () => pad.clear());
    container.querySelector('#sig-save').addEventListener('click', async () => {
      if (pad.isEmpty()) { showToast('Captura la firma primero', 'warning'); return; }
      const file = await canvasToFile(pad.canvas, `firma-${quoteId}.png`);
      const { url } = await uploadPhoto(`quotes/${quoteId}/signature`, file);
      await updateQuote(quoteId, { signatureUrl: url });
      showToast('Firma guardada', 'success');
      mountDetail(quoteId);
    });
  }
}

async function mount(root, ctx) {
  container = root;
  clearUnsubs();
  const param = ctx.params?.[0];
  if (param === 'new') await mountNewQuote();
  else if (param) await mountDetail(param);
  else mountList();
}

function unmount() { clearUnsubs(); container = null; }

export default { mount, unmount };
