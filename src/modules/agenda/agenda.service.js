/**
 * agenda.service.js
 * -----------------------------------------------------------------------
 * Appointments/reminders CRUD, plus a helper that merges them with
 * service orders' estimated delivery dates so the calendar shows
 * "scheduled deliveries" without staff having to duplicate that data as
 * a manual appointment.
 */

import { create, update, remove, subscribe, getAll } from '../../core/db.service.js';
import { COLLECTIONS, ORDER_STATUS } from '../../config/constants.js';

export function subscribeAppointments(onData) {
  return subscribe(COLLECTIONS.APPOINTMENTS, [], onData);
}

export function createAppointment(data) {
  return create(COLLECTIONS.APPOINTMENTS, data);
}

export function updateAppointment(id, data) {
  return update(COLLECTIONS.APPOINTMENTS, id, data);
}

export function deleteAppointment(id) {
  return remove(COLLECTIONS.APPOINTMENTS, id);
}

/** Read-only pseudo-events derived from orders with a pending estimated delivery date. */
export async function getScheduledDeliveries() {
  const orders = await getAll(COLLECTIONS.SERVICE_ORDERS);
  return orders
    .filter((o) => o.estimatedDelivery && ![ORDER_STATUS.ENTREGADO, ORDER_STATUS.CANCELADO].includes(o.status))
    .map((o) => ({
      id: `delivery-${o.id}`,
      date: o.estimatedDelivery,
      type: 'entrega',
      title: `Entrega: ${o.folioLabel} — ${o.clientName}`,
      orderId: o.id,
      readOnly: true
    }));
}
