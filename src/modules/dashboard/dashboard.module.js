/**
 * dashboard.module.js
 * -----------------------------------------------------------------------
 * Landing screen: KPI cards, income/status charts, and a recent-activity
 * feed. Chart.js is dynamically imported only when this module mounts,
 * so no other screen pays for its download weight.
 */

import { subscribeDashboard } from './dashboard.service.js';
import { formatCurrency, formatDateTime } from '../../core/utils.js';
import { ORDER_STATUS_META } from '../../config/constants.js';
import { icon } from '../../components/ui/icons.js';
import { navigate } from '../../core/router.js';

let unsubscribe = null;
let container = null;
let charts = { revenue: null, status: null };
let ChartLib = null;

const CARD_DEFS = [
  { key: 'openOrders', label: 'Órdenes abiertas', icon: 'order', format: (v) => v },
  { key: 'inRepair', label: 'Vehículos en reparación', icon: 'vehicle', format: (v) => v },
  { key: 'finished', label: 'Servicios terminados', icon: 'check', format: (v) => v },
  { key: 'clients', label: 'Clientes registrados', icon: 'clients', format: (v) => v },
  { key: 'deliveredToday', label: 'Entregados hoy', icon: 'agenda', format: (v) => v },
  { key: 'incomeToday', label: 'Ingresos del día', icon: 'payments', format: formatCurrency },
  { key: 'incomeMonth', label: 'Ingresos del mes', icon: 'payments', format: formatCurrency },
  { key: 'totalSales', label: 'Total de ventas (histórico)', icon: 'reports', format: formatCurrency },
  { key: 'pendingBalance', label: 'Pendientes por cobrar', icon: 'warning', format: formatCurrency },
  { key: 'activeWarranties', label: 'Servicios en garantía', icon: 'warranty', format: (v) => v },
  { key: 'delayed', label: 'Servicios retrasados', icon: 'clock', format: (v) => v }
];

/** Rotating light-to-dark blue accent for the stat-card top cap — variety
 * without leaving the brand's blue palette for unrelated hues. */
const STAT_ACCENTS = ['#7dd3fc', '#38bdf8', '#2596d1', '#0d4782', '#093a6b', '#5aa9dd'];

function renderCards(stats) {
  const grid = container.querySelector('#stat-grid');
  grid.innerHTML = CARD_DEFS.map((def, i) => `
    <div class="stat-card" style="--stat-accent:${STAT_ACCENTS[i % STAT_ACCENTS.length]}">
      <div class="stat-card__icon">${icon(def.icon, { size: 22 })}</div>
      <div>
        <div class="stat-card__value">${def.format(stats[def.key] ?? 0)}</div>
        <div class="stat-card__label">${def.label}</div>
      </div>
    </div>
  `).join('');
}

function renderActivity(stats) {
  const list = container.querySelector('#recent-activity');
  if (!stats.recentActivity.length) {
    list.innerHTML = '<div class="empty-state">Sin actividad reciente</div>';
    return;
  }
  list.innerHTML = stats.recentActivity.map((order) => {
    const meta = ORDER_STATUS_META[order.status] || { label: order.status, color: 'neutral' };
    return `
      <div class="activity-row">
        <div>
          <strong>${order.folioLabel || order.id}</strong>
          <div class="text-sm text-muted">${order.clientName || ''} · ${order.vehicleLabel || ''}</div>
        </div>
        <div class="activity-row__meta">
          <span class="badge badge--${meta.color}">${meta.label}</span>
          <div class="text-xs text-muted">${formatDateTime(order.updatedAt)}</div>
        </div>
      </div>`;
  }).join('');
}

async function ensureChartLib() {
  if (!ChartLib) {
    const mod = await import('https://esm.sh/chart.js@4.4.4/auto');
    ChartLib = mod.default || mod.Chart;
  }
  return ChartLib;
}

function chartColor(varName) {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

async function renderCharts(stats) {
  const Chart = await ensureChartLib();
  const gridColor = chartColor('--chart-grid-color');
  const labelColor = chartColor('--chart-label-color');

  charts.revenue?.destroy();
  charts.revenue = new Chart(container.querySelector('#chart-revenue'), {
    type: 'line',
    data: {
      labels: stats.monthlySeries.map((m) => m.label),
      datasets: [{
        label: 'Ingresos',
        data: stats.monthlySeries.map((m) => m.total),
        borderColor: '#2596d1',
        backgroundColor: 'rgba(37,150,209,0.15)',
        fill: true, tension: 0.35, pointRadius: 3
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: labelColor }, grid: { color: gridColor } },
        y: { ticks: { color: labelColor }, grid: { color: gridColor } }
      }
    }
  });

  charts.status?.destroy();
  charts.status = new Chart(container.querySelector('#chart-status'), {
    type: 'doughnut',
    data: {
      labels: stats.statusCounts.map((s) => ORDER_STATUS_META[s.status]?.label || s.status),
      datasets: [{
        data: stats.statusCounts.map((s) => s.count),
        backgroundColor: ['#2596d1', '#0d4782', '#d98c0e', '#1f9d63', '#12b3ac', '#d1403a', '#93a1b5', '#5b6673', '#4aa3e0']
      }]
    },
    options: { plugins: { legend: { position: 'bottom', labels: { color: labelColor, boxWidth: 12 } } } }
  });
}

async function mount(root) {
  container = root;
  container.innerHTML = `
    <div class="page-header">
      <h1>Panel principal</h1>
      <button class="btn btn--primary" id="new-order-cta">+ Nueva orden de servicio</button>
    </div>

    <div class="grid grid--cards section" id="stat-grid">
      ${Array.from({ length: 8 }).map(() => '<div class="skeleton" style="height:84px"></div>').join('')}
    </div>

    <div class="grid grid--2 section">
      <div class="card">
        <div class="card__header"><h3 class="card__title">Ingresos (últimos 6 meses)</h3></div>
        <canvas id="chart-revenue" height="220"></canvas>
      </div>
      <div class="card">
        <div class="card__header"><h3 class="card__title">Servicios por estado</h3></div>
        <canvas id="chart-status" height="220"></canvas>
      </div>
    </div>

    <div class="card">
      <div class="card__header"><h3 class="card__title">Últimas actividades</h3></div>
      <div id="recent-activity"></div>
    </div>
  `;

  container.querySelector('#new-order-cta').addEventListener('click', () => navigate('service-orders', 'new'));

  unsubscribe = subscribeDashboard((stats) => {
    renderCards(stats);
    renderActivity(stats);
    renderCharts(stats);
  });
}

function unmount() {
  unsubscribe?.();
  unsubscribe = null;
  charts.revenue?.destroy();
  charts.status?.destroy();
  charts = { revenue: null, status: null };
}

export default { mount, unmount };
