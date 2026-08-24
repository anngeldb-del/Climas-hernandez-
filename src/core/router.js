/**
 * router.js
 * -----------------------------------------------------------------------
 * Minimal hash-based SPA router with three jobs:
 *   1. Parse `#/module/segment?query` into { moduleKey, params, query }.
 *   2. Lazy-load the matching module (code-splitting via dynamic import —
 *      the browser only ever downloads the JS for the screen being used).
 *   3. Enforce the role gate from auth.service before mounting, and call
 *      the previous module's `unmount()` so Firestore listeners never pile
 *      up as the user navigates around.
 *
 * A module is any object exported as `default` from `<name>.module.js`
 * with the shape: `{ mount(container, ctx), unmount?() }`.
 */

import { getSession, hasAccess, whenReady, onSessionChange } from './auth.service.js';
import { showToast } from '../components/ui/toast.js';

const routes = {
  dashboard: () => import('../modules/dashboard/dashboard.module.js'),
  clients: () => import('../modules/clients/clients.module.js'),
  vehicles: () => import('../modules/vehicles/vehicles.module.js'),
  'service-orders': () => import('../modules/service-orders/service-orders.module.js'),
  catalog: () => import('../modules/catalog/catalog.module.js'),
  quotes: () => import('../modules/quotes/quotes.module.js'),
  payments: () => import('../modules/payments/payments.module.js'),
  warranties: () => import('../modules/warranties/warranties.module.js'),
  agenda: () => import('../modules/agenda/agenda.module.js'),
  reports: () => import('../modules/reports/reports.module.js'),
  users: () => import('../modules/users/users.module.js'),
  settings: () => import('../modules/settings/settings.module.js')
};

const DEFAULT_ROUTE = 'dashboard';

let container = null;
let activeModule = null;
let activeKey = null;

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, queryString] = raw.split('?');
  const [moduleKey, ...rest] = path.split('/').filter(Boolean);
  const query = Object.fromEntries(new URLSearchParams(queryString || ''));
  return { moduleKey: moduleKey || DEFAULT_ROUTE, params: rest, query };
}

export function navigate(moduleKey, path = '', query = '') {
  const qs = query ? `?${new URLSearchParams(query).toString()}` : '';
  location.hash = `/${moduleKey}${path ? `/${path}` : ''}${qs}`;
}

async function resolveRoute() {
  const { moduleKey, params, query } = parseHash();

  if (!routes[moduleKey]) {
    showToast(`Sección "${moduleKey}" no encontrada`, 'warning');
    navigate(DEFAULT_ROUTE);
    return;
  }

  if (!hasAccess(moduleKey)) {
    showToast('No tienes permiso para acceder a esta sección', 'danger');
    if (activeKey !== DEFAULT_ROUTE) navigate(DEFAULT_ROUTE);
    return;
  }

  container.classList.add('is-loading');
  try {
    const mod = await routes[moduleKey]();

    if (typeof activeModule?.unmount === 'function') {
      activeModule.unmount();
    }
    container.innerHTML = '';

    activeModule = mod.default;
    activeKey = moduleKey;
    document.querySelectorAll('.nav-item[data-route]').forEach((el) => {
      el.classList.toggle('active', el.dataset.route === moduleKey);
    });

    await activeModule.mount(container, { params, query, session: getSession() });
  } catch (error) {
    console.error(`[router] failed to load module "${moduleKey}"`, error);
    container.innerHTML = `
      <div class="empty-state">
        <h3>No se pudo cargar esta sección</h3>
        <p>${error.message || 'Ocurrió un error inesperado.'}</p>
        <button class="btn btn--primary" onclick="location.reload()">Reintentar</button>
      </div>`;
  } finally {
    container.classList.remove('is-loading');
  }
}

export function initRouter(rootElement) {
  container = rootElement;

  window.addEventListener('hashchange', resolveRoute);

  // Re-run the current route whenever the session appears/disappears so a
  // role change or logout immediately re-evaluates access.
  onSessionChange(() => {
    if (getSession()) resolveRoute();
  });

  whenReady().then(() => {
    if (!location.hash) navigate(DEFAULT_ROUTE);
    else resolveRoute();
  });
}
