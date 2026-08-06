/**
 * search.module.js
 * -----------------------------------------------------------------------
 * Global command-palette-style search (Ctrl/Cmd+K or the topbar button).
 * Not a routed module — it's a modal any screen can summon. Indexes
 * clients, vehicles, service orders and the catalog into one flat,
 * in-memory list refreshed each time it opens (see dashboard service's
 * scalability note: fine for this business's data volume).
 */

import { getAll } from '../../core/db.service.js';
import { COLLECTIONS, ORDER_STATUS_META } from '../../config/constants.js';
import { openModal } from '../../components/ui/modal.js';
import { icon } from '../../components/ui/icons.js';
import { navigate } from '../../core/router.js';
import { normalizeText, escapeHtml } from '../../core/utils.js';

async function buildIndex() {
  const [clients, vehicles, orders, catalog] = await Promise.all([
    getAll(COLLECTIONS.CLIENTS), getAll(COLLECTIONS.VEHICLES), getAll(COLLECTIONS.SERVICE_ORDERS),
    getAll(COLLECTIONS.CATALOG)
  ]);

  const entries = [];
  for (const c of clients) entries.push({
    type: 'clients', icon: 'clients', title: c.name, subtitle: c.phone || c.email || 'Cliente',
    search: `${c.name} ${c.phone || ''} ${c.email || ''} ${c.whatsapp || ''}`, route: ['clients', c.id]
  });
  for (const v of vehicles) entries.push({
    type: 'vehicles', icon: 'vehicle', title: `${v.brand || ''} ${v.model || ''}`.trim(), subtitle: v.plates || v.vin || 'Vehículo',
    search: `${v.brand} ${v.model} ${v.plates} ${v.vin} ${v.unitNumber || ''}`, route: ['vehicles', v.id]
  });
  for (const o of orders) entries.push({
    type: 'service-orders', icon: 'order', title: o.folioLabel, subtitle: `${o.clientName || ''} · ${ORDER_STATUS_META[o.status]?.label || o.status}`,
    search: `${o.folioLabel} ${o.clientName} ${o.vehiclePlates} ${o.vehicleLabel} ${o.unitNumber || ''}`, route: ['service-orders', o.id]
  });
  for (const s of catalog) entries.push({
    type: 'catalog', icon: 'catalog', title: s.name, subtitle: 'Servicio del catálogo',
    search: s.name, route: ['catalog']
  });

  return entries;
}

export async function openGlobalSearch() {
  const body = document.createElement('div');
  body.innerHTML = `
    <input class="input" id="global-search-input" placeholder="Cliente, vehículo, placas, folio, teléfono, refacción…" autocomplete="off" />
    <div class="search-results section" id="global-search-results" style="margin-top:12px"></div>
  `;
  const modal = openModal({ title: 'Búsqueda global', body, maxWidth: '600px' });

  const input = body.querySelector('#global-search-input');
  const resultsEl = body.querySelector('#global-search-results');
  resultsEl.innerHTML = '<div class="skeleton" style="height:120px"></div>';

  const index = await buildIndex();
  input.focus();

  function render(term) {
    const normalized = normalizeText(term);
    const matches = normalized
      ? index.filter((entry) => normalizeText(entry.search).includes(normalized)).slice(0, 30)
      : index.slice(0, 12);

    if (!matches.length) {
      resultsEl.innerHTML = '<div class="empty-state">Sin resultados</div>';
      return;
    }
    resultsEl.innerHTML = matches.map((entry, i) => `
      <div class="search-result" data-index="${i}">
        <span class="nav-item__icon">${icon(entry.icon)}</span>
        <div>
          <div>${escapeHtml(entry.title)}</div>
          <div class="search-result__meta">${escapeHtml(entry.subtitle)}</div>
        </div>
      </div>
    `).join('');
    resultsEl.querySelectorAll('[data-index]').forEach((el) => {
      el.addEventListener('click', () => {
        const entry = matches[Number(el.dataset.index)];
        modal.close();
        navigate(entry.route[0], entry.route[1] || '');
      });
    });
  }

  render('');
  input.addEventListener('input', () => render(input.value));
}
