/**
 * users.module.js
 * -----------------------------------------------------------------------
 * Admin-only screen to manage staff accounts: roles, active flag, and
 * creating new logins. Firestore profile edits (role/active) work with
 * just the client SDK; actually *creating* a new Firebase Auth user must
 * go through the `createUserAccount` Cloud Function (functions/index.js)
 * because the client SDK would otherwise sign the admin out and sign in
 * as the freshly created user — a well-known limitation of doing
 * createUserWithEmailAndPassword from an already-authenticated session.
 */

import { subscribeUsers, updateUser, createUserAccount } from './users.service.js';
import { ROLES, ROLE_LABELS } from '../../config/constants.js';
import { renderTable } from '../../components/ui/table.js';
import { openModal } from '../../components/ui/modal.js';
import { buildForm, readForm, validateForm } from '../../components/ui/form-builder.js';
import { showToast } from '../../components/ui/toast.js';
import { formatDateTime } from '../../core/utils.js';

let unsubscribe = null;
let users = [];
let container = null;

function roleOptions() {
  return Object.values(ROLES).map((r) => ({ value: r, label: ROLE_LABELS[r] }));
}

function renderList() {
  const listEl = container.querySelector('#users-table');
  renderTable(listEl, {
    columns: [
      { key: 'displayName', label: 'Nombre' },
      { key: 'email', label: 'Correo' },
      { key: 'role', label: 'Rol', render: (u) => `<span class="badge badge--primary">${ROLE_LABELS[u.role] || u.role}</span>` },
      { key: 'active', label: 'Estado', render: (u) => u.active
        ? '<span class="badge badge--success">Activo</span>'
        : '<span class="badge badge--neutral">Inactivo</span>' },
      { key: 'createdAt', label: 'Alta', render: (u) => formatDateTime(u.createdAt) }
    ],
    rows: users,
    onRowClick: openEditModal,
    emptyMessage: 'Aún no hay usuarios registrados.'
  });
}

function openEditModal(user) {
  const form = buildForm([
    { name: 'displayName', label: 'Nombre', value: user.displayName, required: true },
    { name: 'role', label: 'Rol', type: 'select', options: roleOptions(), value: user.role, required: true },
    { name: 'active', label: 'Cuenta activa', type: 'checkbox', value: user.active }
  ]);

  const footer = document.createElement('div');
  footer.className = 'flex gap-2';
  footer.innerHTML = `<button class="btn btn--outline" id="cancel">Cancelar</button>
    <button class="btn btn--primary" id="save">Guardar</button>`;

  const modal = openModal({ title: `Editar: ${user.email}`, body: form, footer });
  footer.querySelector('#cancel').addEventListener('click', modal.close);
  footer.querySelector('#save').addEventListener('click', async () => {
    if (!validateForm(form)) return;
    const data = readForm(form);
    await updateUser(user.id, data);
    showToast('Usuario actualizado', 'success');
    modal.close();
  });
}

function openCreateModal() {
  const form = buildForm([
    { name: 'displayName', label: 'Nombre completo', required: true, fullWidth: true },
    { name: 'email', label: 'Correo electrónico', type: 'email', required: true },
    { name: 'password', label: 'Contraseña temporal', type: 'password', required: true, hint: 'Mínimo 6 caracteres' },
    { name: 'role', label: 'Rol', type: 'select', options: roleOptions(), required: true }
  ]);

  const footer = document.createElement('div');
  footer.className = 'flex gap-2';
  footer.innerHTML = `<button class="btn btn--outline" id="cancel">Cancelar</button>
    <button class="btn btn--primary" id="save">Crear usuario</button>`;

  const modal = openModal({ title: 'Nuevo usuario', body: form, footer });
  footer.querySelector('#cancel').addEventListener('click', modal.close);
  footer.querySelector('#save').addEventListener('click', async () => {
    if (!validateForm(form)) return;
    const data = readForm(form);
    const saveBtn = footer.querySelector('#save');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Creando…';
    try {
      await createUserAccount(data);
      showToast('Usuario creado correctamente', 'success');
      modal.close();
    } catch (error) {
      console.error('[users] createUserAccount failed', error);
      showToast(
        'No se pudo crear el usuario. Verifica que las Cloud Functions estén desplegadas (ver functions/README).',
        'danger'
      );
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Crear usuario';
    }
  });
}

async function mount(root) {
  container = root;
  container.innerHTML = `
    <div class="page-header">
      <h1>Usuarios y roles</h1>
      <button class="btn btn--primary" id="new-user">+ Nuevo usuario</button>
    </div>
    <div class="card"><div id="users-table"></div></div>
  `;
  container.querySelector('#new-user').addEventListener('click', openCreateModal);

  unsubscribe = subscribeUsers((data) => {
    users = data;
    renderList();
  });
}

function unmount() {
  unsubscribe?.();
  unsubscribe = null;
}

export default { mount, unmount };
