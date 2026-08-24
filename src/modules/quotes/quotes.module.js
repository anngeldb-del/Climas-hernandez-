/**
 * quotes.module.js
 * -----------------------------------------------------------------------
 * List, creation form and detail screen for quotes. Routes mirror
 * service-orders: #/quotes, #/quotes/new, #/quotes/{id}.
 */

import { subscribeQuotes, getQuote, createQuote, deleteQuote } from './quotes.service.js';
import { getAll } from '../../core/db.service.js';
import { COLLECTIONS } from '../../config/constants.js';
import { getVehiclesByClient, vehicleLabel } from '../vehicles/vehicles.service.js';
import { renderTable, sortRows } from '../../components/ui/table.js';
import { createSearchSelect } from '../../components/ui/search-select.js';
import { createLineItems } from '../../components/ui/line-items.js';
import { createTaxSection } from '../../components/ui/tax-section.js';
import { confirmDialog } from '../../components/ui/modal.js';
import { showToast } from '../../components/ui/toast.js';
import { icon } from '../../components/ui/icons.js';
import { navigate } from '../../core/router.js';
import { formatCurrency, formatDate, downloadBlob, waLink, createUnsubTracker, escapeHtml } from '../../core/utils.js';
import { generateQuotePdf, getQuotePdfFile } from './quote-pdf.js';
import { getCachedSettings, getEffectiveBusiness } from '../../core/settings.service.js';
import { calcularTotales } from '../../core/tax.service.js';

const unsubTracker = createUnsubTracker();
let container = null;

let allQuotes = [];
let sortKey = 'createdAt';
let sortDir = 'desc';

/** Shared letterhead so every quote screen (form + detail) carries the same branding as the exported PDF. */
function letterheadHtml() {
  const business = getEffectiveBusiness();
  return `
    <div class="flex items-center gap-3" style="margin-bottom:var(--space-5)">
      <img src="${business.logo}" alt="${business.name}" style="height:48px;width:auto" />
      <div>
        <strong>${business.name}</strong>
        <div class="text-xs text-muted">${business.slogan}</div>
      </div>
    </div>
  `;
}

/** Read-only version of the tax-section's totals block, for the detail view. */
function totalsLinesHtml(quote) {
  return `
    <p>Subtotal: <strong>${formatCurrency(quote.subtotal)}</strong></p>
    ${quote.discount > 0 ? `<p>Descuento: <strong>-${formatCurrency(quote.discount)}</strong></p>` : ''}
    ${quote.taxEnabled ? `<p>IVA (${quote.taxRate ?? 0}%): <strong>${formatCurrency(quote.tax)}</strong></p>` : ''}
    ${quote.isrEnabled ? `<p>Retención ISR (${quote.isrRate ?? 0}%): <strong>-${formatCurrency(quote.isr)}</strong></p>` : ''}
    <p style="font-size:1.25rem">Total: <strong>${formatCurrency(quote.total)}</strong></p>
  `;
}

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
  unsubTracker.track(subscribeQuotes((rows) => { allQuotes = rows; renderList(sortRows(rows, sortKey, sortDir)); }));
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
      ${letterheadHtml()}
      <div class="grid grid--form">
        <div class="field"><label class="field__label">Cliente *</label><div id="client-picker"></div></div>
        <div class="field"><label class="field__label">Vehículo</label><div id="vehicle-picker"></div></div>
      </div>

      <h3>Conceptos</h3>
      <div id="quote-lines"></div>

      <div id="tax-section"></div>

      <div class="field">
        <label class="field__label" for="quote-notes">Notas / Comentarios</label>
        <textarea class="input" id="quote-notes" name="notes" rows="3" placeholder="Observaciones para el cliente (opcional)"></textarea>
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

  const lineItems = createLineItems(container.querySelector('#quote-lines'), { onChange: () => taxSection.refresh() });

  const settings = getCachedSettings();
  const taxSection = createTaxSection(container.querySelector('#tax-section'), {
    getItems: () => lineItems.getItems(),
    defaults: {
      ivaEnabled: settings.ivaEnabledByDefault, ivaRate: settings.ivaRate,
      isrEnabled: settings.isrEnabledByDefault, isrRate: settings.isrRate
    }
  });

  container.querySelector('#quote-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!selectedClient) { showToast('Selecciona un cliente', 'warning'); return; }
    const values = taxSection.getValues();
    const totals = calcularTotales(values);
    try {
      const { id } = await createQuote({
        clientId: selectedClient.id,
        clientName: selectedClient.name,
        clientPhone: selectedClient.phone,
        clientEmail: selectedClient.email || '',
        vehicleId: selectedVehicle?.id || null,
        vehicleLabel: selectedVehicle ? vehicleLabel(selectedVehicle) : '',
        unitNumber: selectedVehicle?.unitNumber || '',
        notes: container.querySelector('#quote-notes').value.trim(),
        items: values.items,
        taxEnabled: values.taxEnabled, taxRate: values.taxRate,
        isrEnabled: values.isrEnabled, isrRate: values.isrRate,
        discountEnabled: values.discountEnabled, discountType: values.discountType, discountValue: values.discountValue,
        ...totals // subtotal, discount, taxableBase, tax, isr, total
      });
      showToast('Cotización creada', 'success');
      navigate('quotes', id);
    } catch (error) {
      console.error('[quotes] create failed', error);
      showToast('No se pudo crear la cotización', 'danger');
    }
  });
}

/** Web Share API (attaches the actual PDF, ideal on phones) with a mailto: fallback for browsers that can't share files. */
async function sendQuoteByEmail(quote) {
  const business = getEffectiveBusiness();
  const file = await getQuotePdfFile(quote);

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: `Cotización ${quote.folioLabel}`,
        text: `Cotización ${quote.folioLabel} de ${business.name} para ${quote.clientName} — ${formatCurrency(quote.total)}.`
      });
      return;
    } catch (error) {
      if (error.name === 'AbortError') return; // user closed the share sheet — not a failure
    }
  }

  // Fallback (mailto: can't attach files): download the PDF and open a pre-filled draft to attach it to manually.
  downloadBlob(file, file.name);

  const subject = encodeURIComponent(`Cotización ${quote.folioLabel} — ${business.name}`);
  const body = encodeURIComponent(
    `Hola ${quote.clientName || ''},\n\nAdjunto la cotización ${quote.folioLabel} por un total de ${formatCurrency(quote.total)}.\n\n` +
    `Saludos,\n${business.name}`
  );
  window.location.href = `mailto:${quote.clientEmail || ''}?subject=${subject}&body=${body}`;
  showToast('Se descargó el PDF — adjúntalo en el correo que se acaba de abrir', 'info');
}

/**
 * WhatsApp's click-to-chat link (wa.me) can't attach a file — only
 * Web Share can, and it opens whichever app the user picks, not
 * WhatsApp specifically. So this downloads the PDF and opens the chat
 * with the client (pre-filled message) ready for them to attach it,
 * which is the same approach the PDF's own confirmation QR code uses.
 */
async function sendQuoteByWhatsApp(quote) {
  const business = getEffectiveBusiness();
  const file = await getQuotePdfFile(quote);
  downloadBlob(file, file.name);

  const message = `Hola ${quote.clientName || ''}, te comparto la cotización ${quote.folioLabel} de ${business.name} ` +
    `por un total de ${formatCurrency(quote.total)}. Adjunto el PDF que se acaba de descargar.`;
  window.open(waLink(quote.clientPhone, message), '_blank');
  showToast('Se descargó el PDF — adjúntalo en la conversación de WhatsApp que se acaba de abrir', 'info');
}

async function mountDetail(quoteId) {
  container.innerHTML = '<div class="skeleton" style="height:400px"></div>';
  const quote = await getQuote(quoteId);
  if (!quote) { container.innerHTML = '<div class="empty-state">Cotización no encontrada.</div>'; return; }

  container.innerHTML = `
    <div class="page-header">
      <div class="flex items-center gap-3">
        <button class="btn btn--icon btn--ghost" id="back">${icon('chevronRight', { className: 'rotate-180' })}</button>
        <div><h1 class="mb-0">${escapeHtml(quote.folioLabel)}</h1><p class="mb-0 text-sm">${escapeHtml(quote.clientName || '')} · ${escapeHtml(quote.vehicleLabel || 'Sin vehículo')}${quote.unitNumber ? ` · Unidad ${escapeHtml(quote.unitNumber)}` : ''}</p></div>
      </div>
      <div class="flex gap-2">
        <button class="btn btn--outline" id="send-whatsapp">${icon('whatsapp', { size: 16 })} Enviar por WhatsApp</button>
        <button class="btn btn--outline" id="send-email">${icon('mail', { size: 16 })} Enviar por correo</button>
        <button class="btn btn--outline" id="download-pdf">${icon('download', { size: 16 })} Descargar PDF</button>
        <button class="btn btn--danger" id="delete-quote">${icon('trash', { size: 16 })} Eliminar</button>
      </div>
    </div>

    <div class="card">
      ${letterheadHtml()}
      <h3>Conceptos</h3>
      <table class="table">
        <thead><tr><th>Descripción</th><th>Cant.</th><th>P. Unit.</th><th>Importe</th></tr></thead>
        <tbody>${(quote.items || []).map((i) => `<tr><td data-label="Descripción">${escapeHtml(i.description || '')}</td><td data-label="Cant.">${Number(i.quantity) || 0}</td><td data-label="P. Unit.">${formatCurrency(i.unitPrice)}</td><td data-label="Importe">${formatCurrency((Number(i.quantity) || 0) * (Number(i.unitPrice) || 0))}</td></tr>`).join('')}</tbody>
      </table>
      <div class="text-right">${totalsLinesHtml(quote)}</div>
      ${quote.notes ? `<h3>Notas / Comentarios</h3><p class="text-sm">${escapeHtml(quote.notes)}</p>` : ''}
    </div>
  `;

  container.querySelector('#back').addEventListener('click', () => navigate('quotes'));
  container.querySelector('#download-pdf').addEventListener('click', async () => {
    const btn = container.querySelector('#download-pdf');
    btn.disabled = true;
    try { await generateQuotePdf(quote); } finally { btn.disabled = false; }
  });
  container.querySelector('#send-email').addEventListener('click', async () => {
    const btn = container.querySelector('#send-email');
    btn.disabled = true;
    try { await sendQuoteByEmail(quote); } catch (error) {
      console.error('[quotes] send by email failed', error);
      showToast('No se pudo enviar/compartir la cotización', 'danger');
    } finally { btn.disabled = false; }
  });
  container.querySelector('#send-whatsapp').addEventListener('click', async () => {
    const btn = container.querySelector('#send-whatsapp');
    btn.disabled = true;
    try { await sendQuoteByWhatsApp(quote); } catch (error) {
      console.error('[quotes] send by WhatsApp failed', error);
      showToast('No se pudo preparar el envío por WhatsApp', 'danger');
    } finally { btn.disabled = false; }
  });
  container.querySelector('#delete-quote').addEventListener('click', async () => {
    const confirmed = await confirmDialog({ title: 'Eliminar cotización', message: `¿Eliminar ${quote.folioLabel}?` });
    if (!confirmed) return;
    await deleteQuote(quoteId);
    showToast('Cotización eliminada', 'success');
    navigate('quotes');
  });
}

async function mount(root, ctx) {
  container = root;
  unsubTracker.clear();
  const param = ctx.params?.[0];
  if (param === 'new') await mountNewQuote();
  else if (param) await mountDetail(param);
  else mountList();
}

function unmount() {
  unsubTracker.clear();
  container = null;
}

export default { mount, unmount };
