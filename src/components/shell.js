/**
 * shell.js
 * -----------------------------------------------------------------------
 * Builds the authenticated app chrome: sidebar navigation (filtered by
 * the signed-in user's role), topbar (global search trigger, theme
 * toggle, install button, user menu) and the <main> mount point the
 * router renders modules into.
 */

import { icon } from './ui/icons.js';
import { BUSINESS, ROLE_LABELS } from '../config/constants.js';
import { hasAccess, logout } from '../core/auth.service.js';
import { navigate } from '../core/router.js';
import { getTheme, toggleTheme } from '../core/theme.service.js';
import { canInstall, promptInstall } from '../core/pwa.service.js';
import { openGlobalSearch } from '../modules/search/search.module.js';

const NAV_SECTIONS = [
  {
    title: 'General',
    items: [
      { key: 'dashboard', label: 'Panel principal', icon: 'dashboard' },
      { key: 'agenda', label: 'Agenda', icon: 'agenda' }
    ]
  },
  {
    title: 'Taller',
    items: [
      { key: 'service-orders', label: 'Órdenes de servicio', icon: 'order' },
      { key: 'clients', label: 'Clientes', icon: 'clients' },
      { key: 'vehicles', label: 'Vehículos', icon: 'vehicle' },
      { key: 'warranties', label: 'Garantías', icon: 'warranty' }
    ]
  },
  {
    title: 'Negocio',
    items: [
      { key: 'quotes', label: 'Cotizaciones', icon: 'quote' },
      { key: 'payments', label: 'Pagos', icon: 'payments' },
      { key: 'catalog', label: 'Catálogo de servicios', icon: 'catalog' },
      { key: 'inventory', label: 'Inventario', icon: 'inventory' },
      { key: 'reports', label: 'Reportes', icon: 'reports' }
    ]
  },
  {
    title: 'Sistema',
    items: [
      { key: 'users', label: 'Usuarios', icon: 'users' },
      { key: 'audit', label: 'Bitácora', icon: 'audit' }
    ]
  }
];

export function renderShell(root, session) {
  const initials = (session.displayName || session.email || '?')
    .split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  root.innerHTML = `
    <div id="app-shell">
      <aside class="sidebar">
        <div class="sidebar__brand">
          <img src="${BUSINESS.logo.default}" alt="${BUSINESS.name}" />
          <div class="sidebar__brand-text">${BUSINESS.name}<small>${ROLE_LABELS[session.role] || session.role}</small></div>
        </div>
        <nav class="sidebar__nav">
          ${NAV_SECTIONS.map((section) => renderSection(section)).join('')}
        </nav>
      </aside>

      <header class="topbar">
        <button class="btn btn--icon btn--ghost" id="btn-toggle-sidebar" aria-label="Menú" style="display:none">
          ${icon('menu')}
        </button>
        <button class="btn btn--outline topbar__search" id="btn-global-search">
          ${icon('search', { size: 16 })} <span>Buscar cliente, vehículo, folio, placas…</span>
        </button>
        <div class="topbar__actions">
          <button class="btn btn--icon btn--ghost hidden" id="btn-install" title="Instalar aplicación">${icon('download')}</button>
          <button class="theme-toggle" id="btn-theme" title="Cambiar tema" aria-label="Cambiar tema"></button>
          <div class="avatar" title="${session.displayName}">${initials}</div>
          <button class="btn btn--icon btn--ghost" id="btn-logout" title="Cerrar sesión">${icon('logout')}</button>
        </div>
      </header>

      <main class="main" id="route-container"></main>
    </div>
  `;

  document.querySelectorAll('.nav-item[data-route]').forEach((el) => {
    el.addEventListener('click', () => navigate(el.dataset.route));
  });

  const themeBtn = document.getElementById('btn-theme');
  const paintThemeIcon = () => { themeBtn.innerHTML = icon(getTheme() === 'dark' ? 'sun' : 'moon'); };
  paintThemeIcon();
  themeBtn.addEventListener('click', () => { toggleTheme(); paintThemeIcon(); });

  document.getElementById('btn-global-search').addEventListener('click', openGlobalSearch);
  document.getElementById('btn-logout').addEventListener('click', logout);

  const installBtn = document.getElementById('btn-install');
  if (canInstall()) installBtn.classList.remove('hidden');
  document.addEventListener('pwa:installable', () => installBtn.classList.remove('hidden'));
  installBtn.addEventListener('click', async () => {
    const accepted = await promptInstall();
    if (accepted) installBtn.classList.add('hidden');
  });

  // Keyboard shortcut: Ctrl/Cmd+K opens global search from anywhere in the app.
  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      openGlobalSearch();
    }
  });

  return document.getElementById('route-container');
}

function renderSection(section) {
  const visibleItems = section.items.filter((item) => hasAccess(item.key));
  if (!visibleItems.length) return '';
  return `
    <div class="sidebar__section-title">${section.title}</div>
    ${visibleItems.map((item) => `
      <div class="nav-item" data-route="${item.key}">
        <span class="nav-item__icon">${icon(item.icon)}</span>
        <span class="nav-item__label">${item.label}</span>
      </div>
    `).join('')}
  `;
}
