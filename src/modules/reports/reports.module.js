/**
 * reports.module.js
 * -----------------------------------------------------------------------
 * Ad-hoc reporting: pick a report type + date range/filters, see an
 * aggregated table, export it to CSV/Excel/PDF. Aggregation happens
 * client-side (see dashboard.service.js's scalability note — same
 * reasoning applies here).
 */

import { getAll } from '../../core/db.service.js';
import { COLLECTIONS } from '../../config/constants.js';
import { renderTable } from '../../components/ui/table.js';
import { exportCSV, exportExcel, exportPDF } from '../../core/export.service.js';
import { formatCurrency, formatDate, toDate } from '../../core/utils.js';

let container = null;
let currentRows = [];
let currentHeaders = [];
let currentFilename = 'reporte';
let currentTitle = 'Reporte';

const REPORT_TYPES = [
  { value: 'income', label: 'Ingresos por período' },
  { value: 'orders', label: 'Órdenes de servicio' },
  { value: 'technician', label: 'Órdenes por técnico' }
];

function defaultRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function inRange(date, startISO, endISO) {
  const d = toDate(date);
  if (!d) return false;
  return d >= new Date(`${startISO}T00:00`) && d <= new Date(`${endISO}T23:59:59`);
}

async function runReport(type, { start, end }) {
  const resultEl = container.querySelector('#report-result');
  resultEl.innerHTML = '<div class="skeleton" style="height:280px"></div>';

  if (type === 'income') {
    const payments = (await getAll(COLLECTIONS.PAYMENTS)).filter((p) => inRange(p.createdAt, start, end));
    currentHeaders = ['Fecha', 'Folio', 'Cliente', 'Método', 'Tipo', 'Monto'];
    currentRows = payments.map((p) => ({
      Fecha: formatDate(p.createdAt), Folio: p.orderFolio, Cliente: p.clientName,
      Método: p.method, Tipo: p.type, Monto: p.amount
    }));
    currentTitle = `Ingresos ${start} a ${end}`;
    currentFilename = 'ingresos';
    renderReportTable(currentRows, currentHeaders, `Total del período: ${formatCurrency(payments.reduce((s, p) => s + (p.amount || 0), 0))}`);
    return;
  }

  if (type === 'orders' || type === 'technician') {
    const orders = (await getAll(COLLECTIONS.SERVICE_ORDERS)).filter((o) => inRange(o.createdAt, start, end));
    currentHeaders = ['Folio', 'Cliente', 'Vehículo', 'Técnico', 'Estado', 'Total', 'Fecha'];
    currentRows = orders.map((o) => ({
      Folio: o.folioLabel, Cliente: o.clientName, Vehículo: o.vehicleLabel,
      Técnico: o.technicianName || 'Sin asignar', Estado: o.status, Total: o.total || 0, Fecha: formatDate(o.createdAt)
    }));
    currentTitle = `Órdenes de servicio ${start} a ${end}`;
    currentFilename = 'ordenes';
    renderReportTable(currentRows, currentHeaders, `${orders.length} órdenes · Total facturado: ${formatCurrency(orders.reduce((s, o) => s + (o.total || 0), 0))}`);
    return;
  }
}

function renderReportTable(rows, headers, summary) {
  const resultEl = container.querySelector('#report-result');
  const tableRows = rows.map((r, i) => ({ id: String(i), ...r }));
  resultEl.innerHTML = `<p class="font-bold">${summary}</p><div id="report-table"></div>`;
  renderTable(resultEl.querySelector('#report-table'), {
    columns: headers.map((h) => ({ key: h, label: h })),
    rows: tableRows,
    emptyMessage: 'Sin resultados para los filtros seleccionados.'
  });
}

async function mount(root) {
  container = root;
  const range = defaultRange();

  container.innerHTML = `
    <div class="page-header"><h1>Reportes</h1></div>
    <div class="card section">
      <div class="grid grid--form">
        <div class="field">
          <label class="field__label" for="report-type">Tipo de reporte</label>
          <select class="select" id="report-type">${REPORT_TYPES.map((t) => `<option value="${t.value}">${t.label}</option>`).join('')}</select>
        </div>
        <div class="field"><label class="field__label" for="range-start">Desde</label><input class="input" type="date" id="range-start" value="${range.start}" /></div>
        <div class="field"><label class="field__label" for="range-end">Hasta</label><input class="input" type="date" id="range-end" value="${range.end}" /></div>
        <div class="field" style="align-self:end">
          <button class="btn btn--primary btn--full" id="run-report">Generar</button>
        </div>
      </div>
      <div class="flex gap-2">
        <button class="btn btn--outline btn--sm" id="export-csv">CSV</button>
        <button class="btn btn--outline btn--sm" id="export-excel">Excel</button>
        <button class="btn btn--outline btn--sm" id="export-pdf">PDF</button>
      </div>
    </div>
    <div class="card" id="report-result"><div class="empty-state">Selecciona un tipo de reporte y presiona "Generar".</div></div>
  `;

  const typeSelect = container.querySelector('#report-type');
  const startInput = container.querySelector('#range-start');
  const endInput = container.querySelector('#range-end');

  container.querySelector('#run-report').addEventListener('click', () =>
    runReport(typeSelect.value, { start: startInput.value, end: endInput.value }));

  container.querySelector('#export-csv').addEventListener('click', () => {
    if (!currentRows.length) return;
    exportCSV(currentRows, currentHeaders, currentFilename);
  });
  container.querySelector('#export-excel').addEventListener('click', () => {
    if (!currentRows.length) return;
    exportExcel(currentRows, currentHeaders, currentFilename);
  });
  container.querySelector('#export-pdf').addEventListener('click', () => {
    if (!currentRows.length) return;
    exportPDF(currentRows, currentHeaders, currentFilename, currentTitle);
  });

  await runReport(typeSelect.value, range);
}

function unmount() { container = null; currentRows = []; }

export default { mount, unmount };
