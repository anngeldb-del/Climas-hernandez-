/**
 * service-orders.module.js
 * -----------------------------------------------------------------------
 * List, creation form, and detail/workflow screen for service orders —
 * the core of the shop's daily operation. Routes:
 *   #/service-orders            list            (service-orders.list.js)
 *   #/service-orders/new        creation form    (service-orders.form.js)
 *   #/service-orders/{id}       detail/workflow  (service-orders.detail.js)
 *   #/service-orders/{id}/edit  edit form        (service-orders.form.js)
 *
 * This file only owns routing between the screens and the state that
 * must survive across them: the shared unsub tracker used by the list
 * screen's live query, cleaned up here in unmount() regardless of which
 * screen was last shown.
 */

import { mountOrdersList } from './service-orders.list.js';
import { mountNewOrderForm, mountEditOrderForm } from './service-orders.form.js';
import { mountOrderDetail } from './service-orders.detail.js';
import { createUnsubTracker } from '../../core/utils.js';

const unsubTracker = createUnsubTracker();

async function mount(root, ctx) {
  unsubTracker.clear();
  const param = ctx.params?.[0];
  if (param === 'new') await mountNewOrderForm(root);
  else if (param && ctx.params?.[1] === 'edit') await mountEditOrderForm(root, param);
  else if (param) await mountOrderDetail(root, param);
  else mountOrdersList(root, unsubTracker);
}

function unmount() {
  unsubTracker.clear();
}

export default { mount, unmount };
