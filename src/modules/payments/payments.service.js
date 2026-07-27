/**
 * payments.service.js
 * -----------------------------------------------------------------------
 * Registers payments against a service order and keeps the order's
 * `amountPaid` in sync atomically via Firestore's increment() sentinel —
 * two receptionists registering a payment for the same order at once
 * never clobber each other's amount.
 */

import { create, subscribe, update } from '../../core/db.service.js';
import { increment } from '../../core/firebase.init.js';
import { COLLECTIONS } from '../../config/constants.js';
import { getOrder } from '../service-orders/service-orders.service.js';

export function subscribePayments(onData) {
  return subscribe(COLLECTIONS.PAYMENTS, [], onData);
}

/**
 * @param {{orderId, amount, method, type, notes}} data
 */
export async function registerPayment(data) {
  const order = await getOrder(data.orderId);
  if (!order) throw new Error('La orden de servicio no existe');

  await create(COLLECTIONS.PAYMENTS, {
    ...data,
    orderFolio: order.folioLabel,
    clientName: order.clientName
  });

  await update(COLLECTIONS.SERVICE_ORDERS, data.orderId, { amountPaid: increment(Number(data.amount)) });
}

export function orderBalance(order) {
  return Math.max(0, (order.total || 0) - (order.amountPaid || 0));
}
