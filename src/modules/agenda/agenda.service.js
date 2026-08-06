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
import { setOrderStatus } from '../service-orders/service-orders.service.js';

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

/**
 * Read-only pseudo-events derived from orders with a pending estimated
 * delivery date. Carries the full set of denormalized order fields (not
 * just a title) so the calendar's day view can show client/vehicle/unit/
 * phone/service/status/observations/technician without an extra read per
 * card — see agenda.module.js's openDayModal.
 */
export async function getScheduledDeliveries() {
  const orders = await getAll(COLLECTIONS.SERVICE_ORDERS);
  return orders
    .filter((o) => o.estimatedDelivery && ![ORDER_STATUS.ENTREGADO, ORDER_STATUS.CANCELADO].includes(o.status))
    .map((o) => ({
      id: `delivery-${o.id}`,
      date: o.estimatedDelivery,
      time: o.estimatedTime || '',
      type: 'entrega',
      title: `Entrega: ${o.folioLabel} — ${o.clientName}`,
      clientName: o.clientName,
      clientPhone: o.clientPhone,
      vehicleLabel: o.vehicleLabel,
      unitNumber: o.unitNumber || '',
      serviceRequested: o.serviceRequested,
      status: o.status,
      notes: o.notes,
      technicianName: o.technicianName,
      orderId: o.id,
      folioLabel: o.folioLabel,
      readOnly: true
    }));
}

/** Marks the order behind a "delivery" pseudo-event as delivered — the calendar's
 *  "Marcar como realizada" quick action for entrega-type events. */
export function markDeliveryDone(orderId) {
  return setOrderStatus(orderId, ORDER_STATUS.ENTREGADO);
}
