/**
 * quotes.service.js
 * -----------------------------------------------------------------------
 * Firestore access for quotes plus the tax/total math shared by the form
 * and the PDF export so they can never disagree.
 */

import { create, update, remove, getById, subscribe } from '../../core/db.service.js';
import { COLLECTIONS } from '../../config/constants.js';
import { nextSequence, formatFolio } from '../../core/counters.service.js';

const FOLIO_PREFIX = 'COT';
const IVA_RATE = 0.16;
/** Retención de ISR: unlike IVA (fixed 16%), the rate varies by scenario,
 * so it's an editable per-quote field — this is only the default it
 * starts at (1.25%, this business's applicable rate). */
const DEFAULT_ISR_RATE = 1.25;

export function subscribeQuotes(onData) {
  return subscribe(COLLECTIONS.QUOTES, [], onData);
}

export function getQuote(id) {
  return getById(COLLECTIONS.QUOTES, id);
}

/**
 * IVA is added on top of the subtotal; ISR is a *retención* (withholding)
 * subtracted from it — mirroring how a real Mexican CFDI itemizes both.
 * @param {Array} items
 * @param {boolean} taxEnabled   apply 16% IVA
 * @param {boolean} isrEnabled   apply ISR withholding
 * @param {number} isrRate       withholding percentage, e.g. 10 for 10%
 */
export function computeQuoteTotals(items, taxEnabled, isrEnabled = false, isrRate = DEFAULT_ISR_RATE) {
  const subtotal = (items || []).reduce((sum, r) => sum + (Number(r.quantity) || 0) * (Number(r.unitPrice) || 0), 0);
  const tax = taxEnabled ? subtotal * IVA_RATE : 0;
  const isr = isrEnabled ? subtotal * (Number(isrRate) / 100) : 0;
  return { subtotal, tax, isr, total: subtotal + tax - isr };
}

export { DEFAULT_ISR_RATE };

export async function createQuote(data) {
  const folioNumber = await nextSequence(COLLECTIONS.QUOTES);
  const folioLabel = formatFolio(FOLIO_PREFIX, folioNumber);
  const id = await create(COLLECTIONS.QUOTES, { ...data, folioNumber, folioLabel, signatureUrl: null });
  return { id, folioLabel };
}

export function updateQuote(id, data) {
  return update(COLLECTIONS.QUOTES, id, data);
}

export function deleteQuote(id) {
  return remove(COLLECTIONS.QUOTES, id);
}

export { IVA_RATE };
