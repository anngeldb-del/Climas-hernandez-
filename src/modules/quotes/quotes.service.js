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

export function subscribeQuotes(onData) {
  return subscribe(COLLECTIONS.QUOTES, [], onData);
}

export function getQuote(id) {
  return getById(COLLECTIONS.QUOTES, id);
}

export function computeQuoteTotals(items, taxEnabled) {
  const subtotal = (items || []).reduce((sum, r) => sum + (Number(r.quantity) || 0) * (Number(r.unitPrice) || 0), 0);
  const tax = taxEnabled ? subtotal * IVA_RATE : 0;
  return { subtotal, tax, total: subtotal + tax };
}

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
