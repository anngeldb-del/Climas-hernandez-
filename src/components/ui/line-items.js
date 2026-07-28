/**
 * line-items.js
 * -----------------------------------------------------------------------
 * Repeating "description / qty / unit price / subtotal" rows, used by
 * service orders (refacciones) and quotes (conceptos). Framework-free:
 * renders into a container, keeps its own state, and reports back via
 * onChange(rows, total) so the parent just reads the latest total.
 *
 * Implementation note: typing in a row's inputs updates state + only that
 * row's subtotal/grand-total text directly (not a full re-render) so the
 * input never loses focus/cursor position mid-keystroke. Full re-render
 * only happens on add/remove, where that's not a concern.
 */

import { icon } from './icons.js';
import { formatCurrency, escapeHtml } from '../../core/utils.js';

function positive(n) {
  return Math.max(0, Number(n) || 0);
}

export function createLineItems(container, { rows = [], onChange } = {}) {
  let items = rows.length ? rows.map((r) => ({ ...r })) : [];

  const subtotal = (row) => positive(row.quantity) * positive(row.unitPrice);
  const total = () => items.reduce((sum, row) => sum + subtotal(row), 0);

  function updateTotals() {
    container.querySelectorAll('tr[data-row]').forEach((tr) => {
      const row = items[Number(tr.dataset.row)];
      tr.querySelector('[data-subtotal]').textContent = formatCurrency(subtotal(row));
    });
    container.querySelector('#line-items-total').textContent = formatCurrency(total());
  }

  function render() {
    container.innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead><tr>
            <th>Descripción</th><th style="width:90px">Cant.</th><th style="width:130px">Precio unit.</th>
            <th style="width:120px">Importe</th><th style="width:44px"></th>
          </tr></thead>
          <tbody>
            ${items.map((row, i) => `
              <tr data-row="${i}">
                <td data-label="Descripción"><input class="input" data-field="description" value="${escapeHtml(row.description || '')}" placeholder="Refacción o concepto" /></td>
                <td data-label="Cant."><input class="input" type="number" min="0" step="1" data-field="quantity" value="${row.quantity ?? 1}" /></td>
                <td data-label="Precio unit."><input class="input" type="number" min="0" step="0.01" data-field="unitPrice" value="${row.unitPrice ?? 0}" /></td>
                <td data-label="Importe" data-subtotal>${formatCurrency(subtotal(row))}</td>
                <td data-label=""><button type="button" class="btn btn--icon btn--ghost" data-remove>${icon('trash', { size: 14 })}</button></td>
              </tr>
            `).join('') || `<tr><td colspan="5" class="table-empty">Sin conceptos agregados</td></tr>`}
          </tbody>
        </table>
      </div>
      <div class="flex justify-between items-center" style="margin-top:8px">
        <button type="button" class="btn btn--outline btn--sm" id="add-row">${icon('plus', { size: 14 })} Agregar concepto</button>
        <strong>Total conceptos: <span id="line-items-total">${formatCurrency(total())}</span></strong>
      </div>
    `;

    container.querySelectorAll('tr[data-row]').forEach((tr) => {
      const index = Number(tr.dataset.row);
      tr.querySelectorAll('input[data-field]').forEach((input) => {
        input.addEventListener('input', () => {
          const field = input.dataset.field;
          items[index][field] = field === 'description' ? input.value : positive(input.value);
          updateTotals();
          onChange?.(items, total());
        });
      });
      tr.querySelector('[data-remove]').addEventListener('click', () => {
        items.splice(index, 1);
        render();
        onChange?.(items, total());
      });
    });

    container.querySelector('#add-row').addEventListener('click', () => {
      items.push({ description: '', quantity: 1, unitPrice: 0 });
      render();
      onChange?.(items, total());
    });
  }

  render();

  return { getItems: () => items, getTotal: total };
}
