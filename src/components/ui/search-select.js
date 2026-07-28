/**
 * search-select.js
 * -----------------------------------------------------------------------
 * Type-to-filter combobox: an <input> that shows a dropdown of matching
 * options as the user types, backed by an in-memory list (clients,
 * vehicles, technicians — none of these lists are large enough to need
 * server-side search). Used by service-orders and quotes to pick a
 * client/vehicle without a giant native <select>.
 */

import { normalizeText, escapeHtml } from '../../core/utils.js';

/**
 * @param {HTMLElement} container
 * @param {{
 *   placeholder?: string,
 *   getOptions: () => Array<{id:string,label:string,sublabel?:string}>,
 *   onSelect: (option) => void,
 *   initialLabel?: string
 * }} config
 */
export function createSearchSelect(container, { placeholder = 'Buscar…', getOptions, onSelect, initialLabel = '' }) {
  container.innerHTML = `
    <div style="position:relative">
      <input class="input" type="text" value="${escapeHtml(initialLabel)}" placeholder="${escapeHtml(placeholder)}" aria-label="${escapeHtml(placeholder)}" autocomplete="off" />
      <div class="card search-select__panel hidden" style="position:absolute;z-index:20;width:100%;margin-top:4px;padding:6px;max-height:260px;overflow-y:auto"></div>
    </div>
  `;
  const input = container.querySelector('input');
  const panel = container.querySelector('.search-select__panel');
  let selected = null;

  function renderPanel(term) {
    const options = getOptions();
    const normalizedTerm = normalizeText(term);
    const filtered = normalizedTerm
      ? options.filter((o) => normalizeText(`${o.label} ${o.sublabel || ''}`).includes(normalizedTerm))
      : options;

    if (!filtered.length) {
      panel.innerHTML = `<div class="text-sm text-muted" style="padding:8px">Sin resultados</div>`;
    } else {
      panel.innerHTML = filtered.slice(0, 50).map((o) => `
        <div class="search-result" data-id="${o.id}">
          <div>
            <div>${escapeHtml(o.label)}</div>
            ${o.sublabel ? `<div class="search-result__meta">${escapeHtml(o.sublabel)}</div>` : ''}
          </div>
        </div>
      `).join('');
      panel.querySelectorAll('[data-id]').forEach((el) => {
        el.addEventListener('mousedown', (event) => {
          event.preventDefault();
          const option = filtered.find((o) => o.id === el.dataset.id);
          selected = option;
          input.value = option.label;
          panel.classList.add('hidden');
          onSelect(option);
        });
      });
    }
    panel.classList.remove('hidden');
  }

  input.addEventListener('focus', () => renderPanel(input.value));
  input.addEventListener('input', () => { selected = null; renderPanel(input.value); });
  input.addEventListener('blur', () => setTimeout(() => panel.classList.add('hidden'), 120));

  return {
    getSelected: () => selected,
    clear: () => { selected = null; input.value = ''; },
    setLabel: (label) => { input.value = label; }
  };
}
