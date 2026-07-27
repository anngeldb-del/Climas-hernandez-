/**
 * inventory.service.js
 * -----------------------------------------------------------------------
 * Parts/tools stock. `stock <= minStock` is the low-stock rule used both
 * by this module's alert banner and (eventually) a scheduled Cloud
 * Function that could email/WhatsApp a reorder reminder — see
 * functions/index.js.
 */

import { create, update, remove, subscribe } from '../../core/db.service.js';
import { COLLECTIONS } from '../../config/constants.js';

export function subscribeInventory(onData) {
  return subscribe(COLLECTIONS.INVENTORY, [], onData);
}

export function createItem(data) {
  return create(COLLECTIONS.INVENTORY, data);
}

export function updateItem(id, data) {
  return update(COLLECTIONS.INVENTORY, id, data);
}

export function deleteItem(id) {
  return remove(COLLECTIONS.INVENTORY, id);
}

export function isLowStock(item) {
  return Number(item.stock) <= Number(item.minStock ?? 0);
}
