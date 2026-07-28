/**
 * quotes.service.js
 * -----------------------------------------------------------------------
 * Firestore access for quotes. Tax/discount math lives in
 * core/tax.service.js (calcularTotales) — shared with service orders so
 * the two never compute a total differently; this file only owns CRUD
 * and folio issuance.
 */

import { create, update, remove, getById, subscribe } from '../../core/db.service.js';
import { COLLECTIONS } from '../../config/constants.js';
import { nextSequence, formatFolio } from '../../core/counters.service.js';

const FOLIO_PREFIX = 'COT';

export function subscribeQuotes(onData) {
  return subscribe(COLLECTIONS.QUOTES, [], onData);
}

export function getQuote(id) {
  return getById(COLLECTIONS.QUOTES, id);
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
