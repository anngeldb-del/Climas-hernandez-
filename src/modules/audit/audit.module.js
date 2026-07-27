/**
 * audit.module.js
 * -----------------------------------------------------------------------
 * Read-only viewer for the append-only audit trail (bitácora de cambios).
 * Available to admin and auditor roles only (enforced by router + rules).
 */

import { getAll } from '../../core/db.service.js';
import { COLLECTIONS } from '../../config/constants.js';
import { renderTable } from '../../components/ui/table.js';
import { orderBy, limit } from '../../core/firebase.init.js';
import { formatDateTime } from '../../core/utils.js';

let container = null;

const ACTION_LABELS = { create: 'Creó', update: 'Actualizó', delete: 'Eliminó' };

async function loadAndRender() {
  const tableEl = container.querySelector('#audit-table');
  tableEl.innerHTML = '<div class="skeleton" style="height:240px"></div>';

  const entries = await getAll(COLLECTIONS.AUDIT_LOG, orderBy('at', 'desc'), limit(200));

  renderTable(tableEl, {
    columns: [
      { key: 'at', label: 'Fecha', render: (e) => formatDateTime(e.at) },
      { key: 'actorName', label: 'Usuario' },
      { key: 'actorRole', label: 'Rol' },
      { key: 'action', label: 'Acción', render: (e) => ACTION_LABELS[e.action] || e.action },
      { key: 'entity', label: 'Módulo' },
      { key: 'entityId', label: 'Registro' }
    ],
    rows: entries,
    emptyMessage: 'Aún no hay actividad registrada.'
  });
}

async function mount(root) {
  container = root;
  container.innerHTML = `
    <div class="page-header"><h1>Bitácora de cambios</h1></div>
    <p class="text-muted">Historial de creación, edición y eliminación en todos los módulos. Este registro no puede modificarse ni borrarse.</p>
    <div class="card"><div id="audit-table"></div></div>
  `;
  await loadAndRender();
}

function unmount() { container = null; }

export default { mount, unmount };
