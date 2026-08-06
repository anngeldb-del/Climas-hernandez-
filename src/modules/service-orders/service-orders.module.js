/**
 * service-orders.module.js
 * -----------------------------------------------------------------------
 * List, creation form, and detail/workflow screen for service orders —
 * the core of the shop's daily operation. Routes:
 *   #/service-orders            list            (service-orders.list.js)
 *   #/service-orders/new        creation form    (service-orders.form.js)
 *   #/service-orders/{id}       detail/workflow  (service-orders.detail.js)
 *
 * This file only owns routing between the three screens and the state
 * that must survive across them: the shared unsub tracker and the
 * signature pads created by the detail screen, both cleaned up here in
 * unmount() regardless of which screen was last shown.
 */

import { mountOrdersList } from './service-orders.list.js';
import { mountNewOrderForm, mountEditOrderForm } from './service-orders.form.js';
import { mountOrderDetail } from './service-orders.detail.js';
import { createUnsubTracker } from '../../core/utils.js';

const unsubTracker = createUnsubTracker();
let signaturePads = [];

async function mount(root, ctx) {
  unsubTracker.clear();
  signaturePads = [];
  const param = ctx.params?.[0];
  if (param === 'new') await mountNewOrderForm(root);
  else if (param && ctx.params?.[1] === 'edit') await mountEditOrderForm(root, param);
  else if (param) await mountOrderDetail(root, param, { onSignaturePad: (pad) => signaturePads.push(pad) });
  else mountOrdersList(root, unsubTracker);
}

function unmount() {
  unsubTracker.clear();
  signaturePads.forEach((pad) => pad.destroy());
  signaturePads = [];
}

export default { mount, unmount };
