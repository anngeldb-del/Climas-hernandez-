/**
 * service-orders.service.js
 * -----------------------------------------------------------------------
 * Firestore access + business rules for service orders: folio issuance,
 * denormalized display fields (clientName/vehicleLabel) so list/dashboard
 * views never need a join, and amountPaid bookkeeping. Tax/discount math
 * lives in core/tax.service.js (shared with quotes) — this file only
 * stores whatever calcularTotales() already computed.
 */

import { create, update, remove, getById, subscribe } from '../../core/db.service.js';
import { orderBy } from '../../core/firebase.init.js';
import { COLLECTIONS, ORDER_STATUS } from '../../config/constants.js';
import { nextSequence, formatFolio } from '../../core/counters.service.js';
import { vehicleLabel } from '../vehicles/vehicles.service.js';

const FOLIO_PREFIX = 'OS';

export function subscribeOrders(onData) {
  return subscribe(COLLECTIONS.SERVICE_ORDERS, [orderBy('createdAt', 'desc')], onData);
}

export function getOrder(id) {
  return getById(COLLECTIONS.SERVICE_ORDERS, id);
}

/**
 * @param {object} data must include clientId, clientName, vehicleId, vehicle (object),
 *   plus whatever core/tax.service.js's calcularTotales() returned (subtotal, discount, tax, isr, total)
 */
export async function createOrder(data) {
  const folioNumber = await nextSequence(COLLECTIONS.SERVICE_ORDERS);
  const folioLabel = formatFolio(FOLIO_PREFIX, folioNumber);

  const payload = {
    ...data,
    folioNumber,
    folioLabel,
    vehicleLabel: vehicleLabel(data.vehicle),
    status: ORDER_STATUS.RECIBIDO,
    partsItems: data.partsItems || [],
    laborCost: data.laborCost || 0,
    discountEnabled: data.discountEnabled || false,
    discountType: data.discountType || 'percent',
    discountValue: data.discountValue || 0,
    discount: data.discount || 0,
    extraDiscount: data.extraDiscount || 0,
    taxEnabled: data.taxEnabled || false,
    taxRate: data.taxRate ?? 0,
    tax: data.tax || 0,
    isrEnabled: data.isrEnabled || false,
    isrRate: data.isrRate ?? 0,
    isr: data.isr || 0,
    subtotal: data.subtotal || 0,
    total: data.total || 0,
    amountPaid: 0
  };
  delete payload.vehicle;

  const id = await create(COLLECTIONS.SERVICE_ORDERS, payload);
  return { id, folioLabel };
}

export function updateOrder(id, data, auditDetails) {
  return update(COLLECTIONS.SERVICE_ORDERS, id, data, { auditDetails });
}

export function setOrderStatus(id, status) {
  return update(COLLECTIONS.SERVICE_ORDERS, id, { status }, { auditDetails: { status } });
}

export function deleteOrder(id) {
  return remove(COLLECTIONS.SERVICE_ORDERS, id);
}
