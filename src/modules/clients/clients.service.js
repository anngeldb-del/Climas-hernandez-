/**
 * clients.service.js
 * -----------------------------------------------------------------------
 * Firestore access for the clients collection. Thin wrapper around
 * core/db.service.js with the one piece of domain logic that belongs
 * here: keeping `vehicleCount` on the client document in sync so list
 * views can show it without an extra query per row.
 */

import { create, update, remove, getById, subscribe } from '../../core/db.service.js';
import { db, doc, increment, updateDoc } from '../../core/firebase.init.js';
import { COLLECTIONS } from '../../config/constants.js';

export function subscribeClients(onData) {
  return subscribe(COLLECTIONS.CLIENTS, [], onData);
}

export function getClient(id) {
  return getById(COLLECTIONS.CLIENTS, id);
}

export function createClient(data) {
  return create(COLLECTIONS.CLIENTS, { ...data, vehicleCount: 0 });
}

export function updateClient(id, data) {
  return update(COLLECTIONS.CLIENTS, id, data);
}

export function deleteClient(id) {
  return remove(COLLECTIONS.CLIENTS, id);
}

/** Called by vehicles.service.js whenever a vehicle is added/removed for a client. */
export function bumpVehicleCount(clientId, delta) {
  return updateDoc(doc(db, COLLECTIONS.CLIENTS, clientId), { vehicleCount: increment(delta) });
}
