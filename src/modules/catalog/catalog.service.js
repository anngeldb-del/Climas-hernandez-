/**
 * catalog.service.js
 * -----------------------------------------------------------------------
 * Editable catalog of services offered (recarga de gas, cambio de
 * compresor, etc.). Seeds itself from DEFAULT_SERVICE_CATALOG exactly
 * once — if the collection is already populated (or the shop deleted
 * everything on purpose) it never re-seeds.
 */

import { create, update, remove, subscribe, getAll } from '../../core/db.service.js';
import { COLLECTIONS, DEFAULT_SERVICE_CATALOG } from '../../config/constants.js';

export function subscribeCatalog(onData) {
  return subscribe(COLLECTIONS.CATALOG, [], onData);
}

export async function seedCatalogIfEmpty() {
  const existing = await getAll(COLLECTIONS.CATALOG);
  if (existing.length > 0) return;
  await Promise.all(DEFAULT_SERVICE_CATALOG.map((service) => create(COLLECTIONS.CATALOG, service)));
}

export function createService(data) {
  return create(COLLECTIONS.CATALOG, data);
}

export function updateService(id, data) {
  return update(COLLECTIONS.CATALOG, id, data);
}

export function deleteService(id) {
  return remove(COLLECTIONS.CATALOG, id);
}
