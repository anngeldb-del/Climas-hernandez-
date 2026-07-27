/**
 * warranties.service.js
 * -----------------------------------------------------------------------
 * Firestore access for warranty records. A warranty usually originates
 * from a completed service order (orderId is optional but recommended so
 * the order's parts/labor context stays one click away).
 */

import { create, update, remove, getById, subscribe } from '../../core/db.service.js';
import { COLLECTIONS } from '../../config/constants.js';
import { toDate } from '../../core/utils.js';

export function subscribeWarranties(onData) {
  return subscribe(COLLECTIONS.WARRANTIES, [], onData);
}

export function getWarranty(id) {
  return getById(COLLECTIONS.WARRANTIES, id);
}

export function createWarranty(data) {
  return create(COLLECTIONS.WARRANTIES, { ...data, evidence: [] });
}

export function updateWarranty(id, data) {
  return update(COLLECTIONS.WARRANTIES, id, data);
}

export function deleteWarranty(id) {
  return remove(COLLECTIONS.WARRANTIES, id);
}

export function isExpired(warranty) {
  return warranty.expiresAt ? toDate(warranty.expiresAt) < new Date() : false;
}
