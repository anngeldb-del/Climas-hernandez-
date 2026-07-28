/**
 * tax-section.js
 * -----------------------------------------------------------------------
 * IVA + ISR + descuento control block, shared by quotes and service
 * orders (they need the exact same fields — this is the single place
 * that markup and its recalculation-on-input wiring live, instead of
 * being duplicated in both modules).
 *
 * Rendering only — the actual math is core/tax.service.js's
 * calcularTotales(); this component just collects the form inputs,
 * calls it, and shows the result.
 */

import { calcularTotales, clampPercent } from '../../core/tax.service.js';
import { formatCurrency } from '../../core/utils.js';

/**
 * @param {HTMLElement} container
 * @param {{
 *   getItems: () => Array<{quantity:number, unitPrice:number}>,
 *   getLaborCost?: () => number,
 *   defaults?: { ivaEnabled?, ivaRate?, isrEnabled?, isrRate?, discountEnabled?, discountType?, discountValue? },
 *   onChange?: (result: object) => void
 * }} options
 * @returns {{ refresh: Function, getValues: () => object }}
 */
export function createTaxSection(container, { getItems, getLaborCost = () => 0, defaults = {}, onChange } = {}) {
  const {
    ivaEnabled = false, ivaRate = 16,
    isrEnabled = false, isrRate = 1.25,
    discountEnabled = false, discountType = 'percent', discountValue = 0
  } = defaults;

  container.innerHTML = `
    <details class="collapsible" ${ivaEnabled || isrEnabled || discountEnabled ? 'open' : ''}>
      <summary>Impuestos y descuento (opcional)</summary>
      <div class="collapsible__body">
        <div class="grid grid--form">
          <div class="field">
            <label class="flex items-center gap-2"><input type="checkbox" id="tax-enabled" ${ivaEnabled ? 'checked' : ''} /> Incluir IVA</label>
          </div>
          <div class="field" id="tax-rate-field" style="${ivaEnabled ? '' : 'display:none'}">
            <label class="field__label" for="tax-rate">Porcentaje de IVA</label>
            <input class="input" type="number" id="tax-rate" min="0" max="100" step="0.01" value="${ivaRate}" />
          </div>
          <div class="field">
            <label class="flex items-center gap-2"><input type="checkbox" id="isr-enabled" ${isrEnabled ? 'checked' : ''} /> Aplicar retención de ISR</label>
          </div>
          <div class="field" id="isr-rate-field" style="${isrEnabled ? '' : 'display:none'}">
            <label class="field__label" for="isr-rate">Porcentaje de retención</label>
            <input class="input" type="number" id="isr-rate" min="0" max="100" step="0.25" value="${isrRate}" />
          </div>
        </div>
        <div class="grid grid--form" style="margin-top:var(--space-3)">
          <div class="field">
            <label class="flex items-center gap-2"><input type="checkbox" id="discount-enabled" ${discountEnabled ? 'checked' : ''} /> Aplicar descuento</label>
          </div>
          <div class="field" id="discount-type-field" style="${discountEnabled ? '' : 'display:none'}">
            <label class="field__label" for="discount-type">Tipo de descuento</label>
            <select class="select" id="discount-type">
              <option value="percent" ${discountType === 'percent' ? 'selected' : ''}>Porcentaje (%)</option>
              <option value="fixed" ${discountType === 'fixed' ? 'selected' : ''}>Monto fijo ($)</option>
            </select>
          </div>
          <div class="field" id="discount-value-field" style="${discountEnabled ? '' : 'display:none'}">
            <label class="field__label" for="discount-value">Valor del descuento</label>
            <input class="input" type="number" id="discount-value" min="0" step="0.01" value="${discountValue}" />
          </div>
        </div>
      </div>
    </details>
    <div class="text-right section" id="totals-preview"></div>
  `;

  const els = {
    taxEnabled: container.querySelector('#tax-enabled'),
    taxRateField: container.querySelector('#tax-rate-field'),
    taxRate: container.querySelector('#tax-rate'),
    isrEnabled: container.querySelector('#isr-enabled'),
    isrRateField: container.querySelector('#isr-rate-field'),
    isrRate: container.querySelector('#isr-rate'),
    discountEnabled: container.querySelector('#discount-enabled'),
    discountTypeField: container.querySelector('#discount-type-field'),
    discountType: container.querySelector('#discount-type'),
    discountValueField: container.querySelector('#discount-value-field'),
    discountValue: container.querySelector('#discount-value'),
    totalsPreview: container.querySelector('#totals-preview')
  };

  function currentInputs() {
    return {
      items: getItems(),
      laborCost: Number(getLaborCost()) || 0,
      taxEnabled: els.taxEnabled.checked,
      taxRate: clampPercent(els.taxRate.value),
      isrEnabled: els.isrEnabled.checked,
      isrRate: clampPercent(els.isrRate.value),
      discountEnabled: els.discountEnabled.checked,
      discountType: els.discountType.value,
      discountValue: Math.max(0, Number(els.discountValue.value) || 0)
    };
  }

  function refresh() {
    const inputs = currentInputs();
    const totals = calcularTotales(inputs);
    els.totalsPreview.innerHTML = `
      <p>Subtotal: <strong>${formatCurrency(totals.subtotal)}</strong></p>
      ${totals.discount > 0 ? `<p>Descuento: <strong>-${formatCurrency(totals.discount)}</strong></p>` : ''}
      ${inputs.taxEnabled ? `<p>IVA (${inputs.taxRate}%): <strong>${formatCurrency(totals.tax)}</strong></p>` : ''}
      ${inputs.isrEnabled ? `<p>Retención ISR (${inputs.isrRate}%): <strong>-${formatCurrency(totals.isr)}</strong></p>` : ''}
      <p style="font-size:1.25rem">Total: <strong>${formatCurrency(totals.total)}</strong></p>
    `;
    onChange?.({ ...inputs, ...totals });
    return totals;
  }

  els.taxEnabled.addEventListener('change', () => { els.taxRateField.style.display = els.taxEnabled.checked ? '' : 'none'; refresh(); });
  els.taxRate.addEventListener('input', refresh);
  els.isrEnabled.addEventListener('change', () => { els.isrRateField.style.display = els.isrEnabled.checked ? '' : 'none'; refresh(); });
  els.isrRate.addEventListener('input', refresh);
  els.discountEnabled.addEventListener('change', () => {
    const show = els.discountEnabled.checked;
    els.discountTypeField.style.display = show ? '' : 'none';
    els.discountValueField.style.display = show ? '' : 'none';
    refresh();
  });
  els.discountType.addEventListener('change', refresh);
  els.discountValue.addEventListener('input', refresh);

  refresh();

  return { refresh, getValues: currentInputs };
}
