/**
 * dashboard.service.js
 * -----------------------------------------------------------------------
 * Computes dashboard metrics from live Firestore subscriptions.
 *
 * Scalability note: this reads the full serviceOrders/payments/clients
 * collections client-side and aggregates in memory, which is simple and
 * correct for the order-of-hundreds-to-low-thousands-of-documents this
 * single-location shop will have for years. If/when volume grows enough
 * that this becomes slow, promote the aggregation to a Cloud Function
 * that maintains a single `counters/dashboard` document on every order/
 * payment write (see functions/index.js for the prepared trigger stubs)
 * and have this module read that one document instead — no UI changes
 * needed, only the data source swaps.
 */

import { subscribe } from '../../core/db.service.js';
import { COLLECTIONS, ORDER_STATUS } from '../../config/constants.js';
import { toDate } from '../../core/utils.js';

function isSameDay(date, reference) {
  return date && date.toDateString() === reference.toDateString();
}

function isSameMonth(date, reference) {
  return date && date.getFullYear() === reference.getFullYear() && date.getMonth() === reference.getMonth();
}

/**
 * Subscribes to every collection the dashboard needs and calls `onUpdate`
 * with a fresh stats object whenever any of them changes. Returns a single
 * function that unsubscribes from all of them.
 */
export function subscribeDashboard(onUpdate) {
  const state = { orders: [], clients: [], payments: [], warranties: [] };

  const recompute = () => onUpdate(computeStats(state));

  const unsubs = [
    subscribe(COLLECTIONS.SERVICE_ORDERS, [], (rows) => { state.orders = rows; recompute(); }),
    subscribe(COLLECTIONS.CLIENTS, [], (rows) => { state.clients = rows; recompute(); }),
    subscribe(COLLECTIONS.PAYMENTS, [], (rows) => { state.payments = rows; recompute(); }),
    subscribe(COLLECTIONS.WARRANTIES, [], (rows) => { state.warranties = rows; recompute(); })
  ];

  return () => unsubs.forEach((fn) => fn());
}

function computeStats({ orders, clients, payments, warranties }) {
  const now = new Date();

  const openOrders = orders.filter((o) => ![ORDER_STATUS.ENTREGADO, ORDER_STATUS.CANCELADO].includes(o.status));
  const inRepair = orders.filter((o) => o.status === ORDER_STATUS.EN_REPARACION);
  const finished = orders.filter((o) => o.status === ORDER_STATUS.LISTO);
  const deliveredToday = orders.filter((o) => o.status === ORDER_STATUS.ENTREGADO && isSameDay(toDate(o.updatedAt), now));
  const delayed = orders.filter((o) =>
    ![ORDER_STATUS.ENTREGADO, ORDER_STATUS.CANCELADO].includes(o.status) &&
    o.estimatedDelivery && toDate(o.estimatedDelivery) < now
  );

  const incomeToday = payments.filter((p) => isSameDay(toDate(p.createdAt), now)).reduce((sum, p) => sum + (p.amount || 0), 0);
  const incomeMonth = payments.filter((p) => isSameMonth(toDate(p.createdAt), now)).reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalSales = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

  const pendingBalance = orders
    .filter((o) => ![ORDER_STATUS.CANCELADO].includes(o.status))
    .reduce((sum, o) => sum + Math.max(0, (o.total || 0) - (o.amountPaid || 0)), 0);

  const activeWarranties = warranties.filter((w) => w.expiresAt && toDate(w.expiresAt) >= now);

  // Last 6 months income series, oldest first — feeds the revenue chart.
  const monthlySeries = Array.from({ length: 6 }, (_, i) => {
    const ref = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const total = payments
      .filter((p) => isSameMonth(toDate(p.createdAt), ref))
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    return { label: ref.toLocaleDateString('es-MX', { month: 'short' }), total };
  });

  const statusCounts = Object.values(ORDER_STATUS).map((status) => ({
    status,
    count: orders.filter((o) => o.status === status).length
  })).filter((s) => s.count > 0);

  const recentActivity = [...orders]
    .sort((a, b) => (toDate(b.updatedAt)?.getTime() || 0) - (toDate(a.updatedAt)?.getTime() || 0))
    .slice(0, 8);

  return {
    openOrders: openOrders.length,
    inRepair: inRepair.length,
    finished: finished.length,
    clients: clients.length,
    deliveredToday: deliveredToday.length,
    incomeToday, incomeMonth, totalSales, pendingBalance,
    activeWarranties: activeWarranties.length,
    delayed: delayed.length,
    monthlySeries, statusCounts, recentActivity
  };
}
