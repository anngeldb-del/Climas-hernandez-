/**
 * counters.service.js
 * -----------------------------------------------------------------------
 * Issues gap-free, consecutive integer folios (service orders, quotes...)
 * using a Firestore transaction so two receptionists creating an order at
 * the same instant never get the same number.
 */

import { db, doc, runTransaction } from './firebase.init.js';
import { COLLECTIONS } from '../config/constants.js';

/**
 * @param {string} counterName e.g. "serviceOrders" or "quotes"
 * @returns {Promise<number>} the newly reserved sequence number
 */
export async function nextSequence(counterName) {
  const counterRef = doc(db, COLLECTIONS.COUNTERS, counterName);

  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(counterRef);
    const current = snap.exists() ? snap.data().value || 0 : 0;
    const next = current + 1;
    transaction.set(counterRef, { value: next }, { merge: true });
    return next;
  });
}

/** Zero-pads a folio number for display, e.g. 42 -> "OS-000042". */
export function formatFolio(prefix, number) {
  return `${prefix}-${String(number).padStart(6, '0')}`;
}
