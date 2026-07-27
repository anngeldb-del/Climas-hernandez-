/**
 * vehicles.service.js
 * -----------------------------------------------------------------------
 * Firestore access for the vehicles collection, always scoped to a client.
 * Keeps clients.service.js's `vehicleCount` denormalization consistent on
 * create/delete.
 */

import { create, update, remove, getById, getAll, subscribe } from '../../core/db.service.js';
import { where, orderBy } from '../../core/firebase.init.js';
import { COLLECTIONS } from '../../config/constants.js';
import { bumpVehicleCount } from '../clients/clients.service.js';

export function subscribeAllVehicles(onData) {
  return subscribe(COLLECTIONS.VEHICLES, [orderBy('createdAt', 'desc')], onData);
}

export function subscribeVehiclesByClient(clientId, onData) {
  return subscribe(COLLECTIONS.VEHICLES, [where('clientId', '==', clientId)], onData);
}

export function getVehiclesByClient(clientId) {
  return getAll(COLLECTIONS.VEHICLES, where('clientId', '==', clientId));
}

export function getVehicle(id) {
  return getById(COLLECTIONS.VEHICLES, id);
}

export async function createVehicle(clientId, data) {
  const id = await create(COLLECTIONS.VEHICLES, { ...data, clientId, photos: [] });
  await bumpVehicleCount(clientId, 1);
  return id;
}

export function updateVehicle(id, data) {
  return update(COLLECTIONS.VEHICLES, id, data);
}

export async function deleteVehicle(id, clientId) {
  await remove(COLLECTIONS.VEHICLES, id);
  await bumpVehicleCount(clientId, -1);
}

export function vehicleLabel(vehicle) {
  if (!vehicle) return '';
  return [vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(' ');
}
