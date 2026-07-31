/**
 * shell.js
 * -----------------------------------------------------------------------
 * Builds the authenticated app chrome: sidebar navigation (filtered by
 * the signed-in user's role), topbar (global search trigger, theme
 * toggle, install button, user menu) and the <main> mount point the
 * router renders modules into.
 */

import { icon } from './ui/icons.js';
import { ROLE_LABELS } from '../config/constants.js';
import { hasAccess, logout } from '../core/auth.service.js';
import { navigate } from '../core/router.js';
import { getTheme, toggleTheme } from '../core/theme.service.js';
import { canInstall, promptInstall, isManualInstallOnly } from '../core/pwa.service.js';
import { openGlobalSearch } from '../modules/search/search.module.js';
import { openModal } from './ui/modal.js';
import { getEffectiveBusiness } from '../core/settings.service.js';

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
      { key: 'clients', label: 'Clientes', icon: 'clients' },
      { key: 'vehicles', label: 'Vehículos', icon: 'vehicle' },
      { key: 'service-orders', label: 'Órdenes', icon: 'order' },
      { key: 'warranties', label: 'Garantías', icon: 'warranty' }
    ]
  },
  {
    title: 'Negocio',
    items: [
      { key: 'quotes', label: 'Cotizaciones', icon: 'quote' },
      { key: 'payments', label: 'Pagos', icon: 'payments' },
      { key: 'catalog', label: 'Catálogo', icon: 'catalog' },
      { key: 'inventory', label: 'Inventario', icon: 'inventory' },
      { key: 'reports', label: 'Reportes', icon: 'reports' }
    ]
  },
  {
    title: 'Sistema',
    items: [
      { key: 'users', label: 'Usuarios', icon: 'users' },
      { key: 'settings', label: 'Configuración', icon: 'settings' }
    ]
  }
];

export function renderShell(root, session) {
  const initials = (session.displayName || session.email || '?')
    .split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const business = getEffectiveBusiness();

  root.innerHTML = `
    <div id="app-shell">
      <div class="sidebar-backdrop" id="sidebar-backdrop"></div>
      <aside class="sidebar">
        <div class="sidebar__brand">
          <img src="${business.logo}" alt="${business.name}" />
          <div class="sidebar__brand-text">${business.name}<small>${ROLE_LABELS[session.role] || session.role}</small></div>
          <button class="btn btn--icon btn--ghost sidebar__close" id="btn-close-sidebar" aria-label="Cerrar menú">
            ${icon('close', { size: 18 })}
          </button>
        </div>
        <nav class="sidebar__nav">
          ${NAV_SECTIONS.map((section) => renderSection(section)).join('')}
        </nav>
      </aside>

      <header class="topbar">
        <button class="btn btn--icon btn--ghost" id="btn-toggle-sidebar" aria-label="Abrir menú">
          ${icon('menu')}
        </button>
        <button class="btn btn--outline topbar__search" id="btn-global-search">
          ${icon('search', { size: 16 })} <span class="topbar__search-label">Buscar cliente, vehículo, folio, placas…</span>
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

  const sidebarEl = document.querySelector('.sidebar');
  const backdropEl = document.getElementById('sidebar-backdrop');

  function openSidebar() {
    sidebarEl.classList.add('sidebar--open');
    backdropEl.classList.add('sidebar-backdrop--visible');
  }
  function closeSidebar() {
    sidebarEl.classList.remove('sidebar--open');
    backdropEl.classList.remove('sidebar-backdrop--visible');
  }

  document.getElementById('btn-toggle-sidebar').addEventListener('click', openSidebar);
  document.getElementById('btn-close-sidebar').addEventListener('click', closeSidebar);
  backdropEl.addEventListener('click', closeSidebar);

  document.querySelectorAll('.nav-item[data-route]').forEach((el) => {
    el.addEventListener('click', () => { navigate(el.dataset.route); closeSidebar(); });
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
    if (isManualInstallOnly()) {
      openModal({
        title: 'Instalar en iPhone/iPad',
        body: '<p>Toca el botón <strong>Compartir</strong> en la barra de Safari (el cuadro con una flecha hacia arriba) y luego <strong>"Agregar a pantalla de inicio"</strong>.</p>',
        maxWidth: '360px'
      });
      return;
    }
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
