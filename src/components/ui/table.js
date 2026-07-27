/**
 * table.js
 * -----------------------------------------------------------------------
 * Renders an array of row objects into a sortable, searchable HTML table.
 * Stateless by design: call renderTable() again with new data/sort state
 * to re-render (cheap enough for the row counts this business handles —
 * hundreds, not tens of thousands, of clients/orders).
 *
 * Column shape: { key, label, sortable=true, render?(row) => string, align }
 */

import { escapeHtml, toDate } from '../../core/utils.js';

export function renderTable(container, {
  columns, rows, sortKey, sortDir = 'asc', onSort, onRowClick, emptyMessage = 'Sin resultados'
}) {
  if (!rows.length) {
    container.innerHTML = `<div class="table-empty">${escapeHtml(emptyMessage)}</div>`;
    return;
  }

  const thead = columns.map((col) => {
    const isSorted = col.key === sortKey;
    const arrow = isSorted ? (sortDir === 'asc' ? '▲' : '▼') : '';
    return `<th data-key="${col.key}" style="${col.align ? `text-align:${col.align}` : ''}" ${col.sortable === false ? '' : 'data-sortable'}>
      ${escapeHtml(col.label)} ${arrow}
    </th>`;
  }).join('');

  const tbody = rows.map((row) => {
    const cells = columns.map((col) => {
      const value = col.render ? col.render(row) : escapeHtml(row[col.key] ?? '—');
      return `<td style="${col.align ? `text-align:${col.align}` : ''}">${value}</td>`;
    }).join('');
    return `<tr data-id="${row.id ?? ''}" ${onRowClick ? 'data-clickable' : ''}>${cells}</tr>`;
  }).join('');

  container.innerHTML = `
    <div class="table-wrap">
      <table class="table">
        <thead><tr>${thead}</tr></thead>
        <tbody>${tbody}</tbody>
      </table>
    </div>`;

  if (onSort) {
    container.querySelectorAll('th[data-sortable]').forEach((th) => {
      th.style.cursor = 'pointer';
      th.addEventListener('click', () => onSort(th.dataset.key));
    });
  }

  if (onRowClick) {
    container.querySelectorAll('tbody tr').forEach((tr) => {
      tr.addEventListener('click', () => {
        const row = rows.find((r) => String(r.id) === tr.dataset.id);
        if (row) onRowClick(row);
      });
    });
  }
}

/**
 * Generic in-memory sort helper shared by every list module. Firestore
 * Timestamps (and Dates, and date-like ISO strings) are detected and
 * compared as actual instants — comparing their raw string/object form
 * would sort lexicographically instead of chronologically (e.g. a
 * Timestamp's default toString() breaks badly around magnitude changes
 * in its seconds count).
 */
export function sortRows(rows, key, dir = 'asc') {
  const factor = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a[key], bv = b[key];
    if (av == null) return 1;
    if (bv == null) return -1;

    const aDate = toDate(av);
    const bDate = toDate(bv);
    if (aDate && bDate) return (aDate.getTime() - bDate.getTime()) * factor;

    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * factor;
    return String(av).localeCompare(String(bv), 'es') * factor;
  });
}
