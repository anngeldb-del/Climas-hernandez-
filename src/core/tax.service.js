/**
 * tax.service.js
 * -----------------------------------------------------------------------
 * Single source of truth for tax/discount math, shared by quotes and
 * service orders so the two never drift apart or duplicate the same
 * arithmetic. Every screen that shows a total (the live form preview,
 * the read-only detail view, the printed ticket, the exported PDF)
 * calls calcularTotales() and renders whatever it returns — nothing
 * recomputes IVA/ISR/descuento on its own.
 *
 * Business rules (standard Mexican CFDI treatment):
 *   - El descuento reduce la base antes de aplicar impuestos.
 *   - El IVA se suma sobre la base ya descontada.
 *   - El ISR es una RETENCIÓN: se resta del total (no se suma), y se
 *     calcula sobre la misma base descontada que el IVA.
 */

/** Clamps a percentage to [0, 100] and coerces empty/invalid input to 0 — used by every rate input in the app. */
export function clampPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

/** Rounds to cents, avoiding the classic 0.1 + 0.2 floating-point drift in totals. */
function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function calcularSubtotal(items) {
  return round2((items || []).reduce((sum, r) => sum + (Number(r.quantity) || 0) * (Number(r.unitPrice) || 0), 0));
}

/**
 * @param {number} base       amount the discount applies to (usually the subtotal)
 * @param {'percent'|'fixed'} type
 * @param {number} value
 */
export function calcularDescuento(base, enabled, type, value) {
  if (!enabled || !value) return 0;
  const amount = type === 'fixed' ? Number(value) : base * (clampPercent(value) / 100);
  return round2(Math.min(Math.max(amount, 0), base));
}

export function calcularIVA(base, enabled, rate) {
  if (!enabled) return 0;
  return round2(base * (clampPercent(rate) / 100));
}

/** ISR is a withholding — calcularTotales() subtracts this from the total, it does not add like IVA. */
export function calcularISR(base, enabled, rate) {
  if (!enabled) return 0;
  return round2(base * (clampPercent(rate) / 100));
}

/**
 * @param {object} input
 * @param {Array}  input.items          [{quantity, unitPrice}, ...] — parts/conceptos
 * @param {number} [input.laborCost]    mano de obra (service orders only; quotes fold labor into items)
 * @param {boolean} [input.discountEnabled]
 * @param {'percent'|'fixed'} [input.discountType]
 * @param {number} [input.discountValue]
 * @param {boolean} input.taxEnabled    aplicar IVA
 * @param {number} input.taxRate       porcentaje de IVA (editable, no fijo a 16)
 * @param {boolean} input.isrEnabled    aplicar retención de ISR
 * @param {number} input.isrRate
 * @returns {{subtotal:number, laborCost:number, discount:number, taxableBase:number, tax:number, isr:number, total:number}}
 */
export function calcularTotales({
  items = [], laborCost = 0,
  discountEnabled = false, discountType = 'percent', discountValue = 0,
  taxEnabled = false, taxRate = 0,
  isrEnabled = false, isrRate = 0
}) {
  const itemsSubtotal = calcularSubtotal(items);
  const subtotal = round2(itemsSubtotal + (Number(laborCost) || 0));
  const discount = calcularDescuento(subtotal, discountEnabled, discountType, discountValue);
  const taxableBase = round2(subtotal - discount);
  const tax = calcularIVA(taxableBase, taxEnabled, taxRate);
  const isr = calcularISR(taxableBase, isrEnabled, isrRate);
  const total = round2(taxableBase + tax - isr);

  return { subtotal, laborCost: Number(laborCost) || 0, discount, taxableBase, tax, isr, total };
}
