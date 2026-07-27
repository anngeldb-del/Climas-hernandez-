/**
 * agenda.module.js
 * -----------------------------------------------------------------------
 * Month-view calendar for deliveries, appointments and reminders. Built
 * with plain CSS grid — no calendar library — since the interaction
 * surface needed (pick a month, click a day, add/remove an event) is
 * small enough that a dependency would cost more than it saves.
 */

import {
  subscribeAppointments, createAppointment, updateAppointment, deleteAppointment, getScheduledDeliveries
} from './agenda.service.js';
import { openModal, confirmDialog } from '../../components/ui/modal.js';
import { buildForm, readForm, validateForm } from '../../components/ui/form-builder.js';
import { showToast } from '../../components/ui/toast.js';
import { icon } from '../../components/ui/icons.js';
import { navigate } from '../../core/router.js';

let unsubscribe = null;
let container = null;
let appointments = [];
let deliveries = [];
let cursor = startOfMonth(new Date());

const APPOINTMENT_TYPES = [
  { value: 'cita', label: 'Cita' },
  { value: 'recordatorio', label: 'Recordatorio' },
  { value: 'entrega', label: 'Entrega' }
];
const TYPE_COLOR = { cita: 'primary', recordatorio: 'warning', entrega: 'success' };

function startOfMonth(date) { return new Date(date.getFullYear(), date.getMonth(), 1); }
function toISODate(date) { return date.toISOString().slice(0, 10); }

function allEvents() {
  return [...appointments, ...deliveries];
}

function eventsOnDay(isoDate) {
  return allEvents().filter((e) => e.date === isoDate);
}

function renderCalendar() {
  const grid = container.querySelector('#calendar-grid');
  const monthLabel = container.querySelector('#month-label');
  monthLabel.textContent = cursor.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });

  const firstWeekday = cursor.getDay();
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const today = toISODate(new Date());

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push('<div class="calendar-cell calendar-cell--empty"></div>');
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(cursor.getFullYear(), cursor.getMonth(), day);
    const iso = toISODate(date);
    const dayEvents = eventsOnDay(iso);
    cells.push(`
      <div class="calendar-cell ${iso === today ? 'calendar-cell--today' : ''}" data-date="${iso}">
        <div class="calendar-cell__num">${day}</div>
        ${dayEvents.slice(0, 3).map((e) => `<div class="badge badge--${TYPE_COLOR[e.type] || 'neutral'}" style="display:block;margin-bottom:2px;white-space:normal;text-align:left">${e.title}</div>`).join('')}
        ${dayEvents.length > 3 ? `<div class="text-xs text-muted">+${dayEvents.length - 3} más</div>` : ''}
      </div>
    `);
  }

  grid.innerHTML = cells.join('');
  grid.querySelectorAll('[data-date]').forEach((cell) => {
    cell.addEventListener('click', () => openDayModal(cell.dataset.date));
  });
}

function openDayModal(isoDate) {
  const dayEvents = eventsOnDay(isoDate);
  const body = document.createElement('div');
  body.innerHTML = `
    <div id="day-events" class="section"></div>
    <button class="btn btn--outline btn--sm" id="add-event">${icon('plus', { size: 14 })} Agregar evento</button>
  `;
  const modal = openModal({ title: new Date(`${isoDate}T00:00`).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }), body, maxWidth: '480px' });

  function renderDayList() {
    const listEl = body.querySelector('#day-events');
    const events = eventsOnDay(isoDate);
    if (!events.length) { listEl.innerHTML = '<p class="text-muted text-sm">Sin eventos este día.</p>'; return; }
    listEl.innerHTML = events.map((e) => `
      <div class="flex items-center justify-between" style="padding:8px 0;border-bottom:1px solid var(--color-border)">
        <div>
          <span class="badge badge--${TYPE_COLOR[e.type] || 'neutral'}">${APPOINTMENT_TYPES.find((t) => t.value === e.type)?.label || e.type}</span>
          <div class="text-sm" style="margin-top:4px">${e.title}${e.time ? ` · ${e.time}` : ''}</div>
        </div>
        ${e.readOnly
          ? `<button class="btn btn--sm btn--ghost" data-goto="${e.orderId}">Ver orden</button>`
          : `<button class="btn btn--icon btn--ghost" data-delete="${e.id}">${icon('trash', { size: 14 })}</button>`}
      </div>
    `).join('');
    listEl.querySelectorAll('[data-goto]').forEach((btn) => btn.addEventListener('click', () => { modal.close(); navigate('service-orders', btn.dataset.goto); }));
    listEl.querySelectorAll('[data-delete]').forEach((btn) => btn.addEventListener('click', async () => {
      const confirmed = await confirmDialog({ title: 'Eliminar evento', message: '¿Eliminar este evento de la agenda?' });
      if (confirmed) { await deleteAppointment(btn.dataset.delete); renderDayList(); }
    }));
  }
  renderDayList();

  body.querySelector('#add-event').addEventListener('click', () => openEventForm(isoDate, () => renderDayList()));
}

function openEventForm(isoDate, onSaved) {
  const form = buildForm([
    { name: 'title', label: 'Título', required: true, value: '', fullWidth: true },
    { name: 'type', label: 'Tipo', type: 'select', options: APPOINTMENT_TYPES, required: true },
    { name: 'time', label: 'Hora', type: 'time' },
    { name: 'notes', label: 'Notas', type: 'textarea', fullWidth: true }
  ]);
  const footer = document.createElement('div');
  footer.className = 'flex gap-2';
  footer.innerHTML = `<button class="btn btn--outline" id="cancel">Cancelar</button><button class="btn btn--primary" id="save">Guardar</button>`;
  const modal = openModal({ title: 'Nuevo evento', body: form, footer, maxWidth: '420px' });
  footer.querySelector('#cancel').addEventListener('click', modal.close);
  footer.querySelector('#save').addEventListener('click', async () => {
    if (!validateForm(form)) return;
    await createAppointment({ ...readForm(form), date: isoDate, status: 'pendiente' });
    showToast('Evento agregado', 'success');
    modal.close();
    onSaved();
  });
}

async function loadDeliveries() {
  deliveries = await getScheduledDeliveries();
  renderCalendar();
}

function changeMonth(delta) {
  cursor = new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1);
  renderCalendar();
}

async function mount(root) {
  container = root;
  container.innerHTML = `
    <div class="page-header">
      <h1>Agenda</h1>
      <div class="flex gap-2 items-center">
        <button class="btn btn--icon btn--outline" id="prev-month">${icon('chevronRight', { className: 'rotate-180' })}</button>
        <strong id="month-label" style="text-transform:capitalize;min-width:160px;text-align:center"></strong>
        <button class="btn btn--icon btn--outline" id="next-month">${icon('chevronRight')}</button>
      </div>
    </div>
    <div class="card">
      <div class="calendar-weekdays">
        ${['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((d) => `<div>${d}</div>`).join('')}
      </div>
      <div class="calendar-grid" id="calendar-grid"></div>
    </div>
  `;

  container.querySelector('#prev-month').addEventListener('click', () => changeMonth(-1));
  container.querySelector('#next-month').addEventListener('click', () => changeMonth(1));

  unsubscribe = subscribeAppointments((rows) => { appointments = rows; renderCalendar(); });
  await loadDeliveries();
}

function unmount() { unsubscribe?.(); unsubscribe = null; container = null; }

export default { mount, unmount };
