/**
 * agenda.module.js
 * -----------------------------------------------------------------------
 * Month-view calendar for deliveries, appointments and reminders. Built
 * with plain CSS grid — no calendar library — since the interaction
 * surface needed (pick a month, click a day, add/remove an event) is
 * small enough that a dependency would cost more than it saves.
 */

import {
  subscribeAppointments, createAppointment, updateAppointment, deleteAppointment,
  getScheduledDeliveries, markDeliveryDone
} from './agenda.service.js';
import { openModal, confirmDialog } from '../../components/ui/modal.js';
import { buildForm, readForm, validateForm } from '../../components/ui/form-builder.js';
import { showToast } from '../../components/ui/toast.js';
import { icon } from '../../components/ui/icons.js';
import { navigate } from '../../core/router.js';
import { escapeHtml, waLink } from '../../core/utils.js';
import { ORDER_STATUS_META } from '../../config/constants.js';

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

const APPT_STATUS_META = {
  pendiente: { label: 'Pendiente', color: 'warning' },
  realizada: { label: 'Realizada', color: 'success' },
  cancelada: { label: 'Cancelada', color: 'danger' }
};

function statusMeta(event) {
  if (event.readOnly) return ORDER_STATUS_META[event.status] || { label: event.status || '—', color: 'neutral' };
  return APPT_STATUS_META[event.status] || APPT_STATUS_META.pendiente;
}

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
        ${dayEvents.slice(0, 3).map((e) => `<div class="badge badge--${TYPE_COLOR[e.type] || 'neutral'}" style="display:block;margin-bottom:2px;white-space:normal;text-align:left">${escapeHtml(e.title || '')}</div>`).join('')}
        ${dayEvents.length > 3 ? `<div class="text-xs text-muted">+${dayEvents.length - 3} más</div>` : ''}
      </div>
    `);
  }

  grid.innerHTML = cells.join('');
  grid.querySelectorAll('[data-date]').forEach((cell) => {
    cell.addEventListener('click', () => openDayModal(cell.dataset.date));
  });
}

/**
 * Large, card-based day view (near-fullscreen on phones — see modal.js's
 * `sheet` option). Every event, manual or order-derived, is shown as its
 * own big-type card with the full set of fields (hora, cliente, vehículo,
 * número de unidad, teléfono, servicio, estado, observaciones, técnico)
 * plus quick actions, instead of the old single-line list.
 */
function openDayModal(isoDate) {
  const body = document.createElement('div');
  body.innerHTML = `
    <div id="day-events" class="section"></div>
    <button class="btn btn--outline btn--full" id="add-event">${icon('plus', { size: 16 })} Agregar evento</button>
  `;
  const modal = openModal({
    title: new Date(`${isoDate}T00:00`).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }),
    body,
    sheet: true,
    maxWidth: '640px'
  });

  function field(label, value) {
    if (!value) return '';
    return `<div class="appt-field"><span class="appt-field__label">${escapeHtml(label)}</span><span class="appt-field__value">${escapeHtml(String(value))}</span></div>`;
  }

  function renderDayList() {
    const listEl = body.querySelector('#day-events');
    const events = eventsOnDay(isoDate).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    if (!events.length) { listEl.innerHTML = '<p class="text-muted text-sm">Sin eventos este día.</p>'; return; }

    listEl.innerHTML = events.map((e) => {
      const meta = statusMeta(e);
      const typeLabel = APPOINTMENT_TYPES.find((t) => t.value === e.type)?.label || e.type;
      return `
      <div class="appt-card" data-id="${e.id}">
        <div class="appt-card__top">
          <span class="badge badge--${TYPE_COLOR[e.type] || 'neutral'}">${typeLabel}</span>
          <span class="badge badge--${meta.color}">${meta.label}</span>
          ${e.time ? `<span class="appt-card__time">${icon('clock', { size: 14 })} ${escapeHtml(e.time)}</span>` : ''}
        </div>
        <h4 class="appt-card__title">${escapeHtml(e.readOnly ? (e.folioLabel || e.title) : e.title)}</h4>
        <div class="appt-card__fields">
          ${field('Cliente', e.clientName)}
          ${field('Vehículo', e.vehicleLabel)}
          ${field('Número de unidad', e.unitNumber)}
          ${field('Teléfono', e.clientPhone)}
          ${field('Servicio', e.serviceRequested)}
          ${field('Técnico asignado', e.technicianName)}
          ${field('Observaciones', e.notes)}
        </div>
        <div class="appt-card__actions">
          ${e.readOnly ? `
            <button class="btn btn--outline btn--sm" data-goto="${e.orderId}">${icon('order', { size: 14 })} Ver orden relacionada</button>
            ${e.status !== 'entregado' ? `<button class="btn btn--outline btn--sm" data-done-order="${e.orderId}">${icon('check', { size: 14 })} Marcar como realizada</button>` : ''}
          ` : `
            <button class="btn btn--outline btn--sm" data-edit="${e.id}">${icon('edit', { size: 14 })} Editar cita</button>
            <button class="btn btn--outline btn--sm" data-danger data-delete="${e.id}">${icon('trash', { size: 14 })} Eliminar</button>
            ${e.status !== 'realizada' ? `<button class="btn btn--outline btn--sm" data-done="${e.id}">${icon('check', { size: 14 })} Marcar como realizada</button>` : ''}
          `}
          ${e.clientPhone ? `
            <a class="btn btn--outline btn--sm" href="${waLink(e.clientPhone, `Hola ${e.clientName || ''}, le contactamos de parte de Hernández Autoclimas respecto a su cita.`)}" target="_blank" rel="noopener">${icon('whatsapp', { size: 14 })} WhatsApp</a>
            <a class="btn btn--outline btn--sm" href="tel:${e.clientPhone.replace(/\s+/g, '')}">${icon('phone', { size: 14 })} Llamar</a>
          ` : ''}
        </div>
      </div>`;
    }).join('');

    listEl.querySelectorAll('[data-goto]').forEach((btn) => btn.addEventListener('click', () => { modal.close(); navigate('service-orders', btn.dataset.goto); }));
    listEl.querySelectorAll('[data-edit]').forEach((btn) => btn.addEventListener('click', () => {
      const ev = appointments.find((a) => a.id === btn.dataset.edit);
      if (ev) openEventForm(isoDate, () => renderDayList(), ev);
    }));
    listEl.querySelectorAll('[data-delete]').forEach((btn) => btn.addEventListener('click', async () => {
      const confirmed = await confirmDialog({ title: 'Eliminar evento', message: '¿Eliminar este evento de la agenda?' });
      if (confirmed) { await deleteAppointment(btn.dataset.delete); renderDayList(); }
    }));
    listEl.querySelectorAll('[data-done]').forEach((btn) => btn.addEventListener('click', async () => {
      await updateAppointment(btn.dataset.done, { status: 'realizada' });
      showToast('Cita marcada como realizada', 'success');
      renderDayList();
    }));
    listEl.querySelectorAll('[data-done-order]').forEach((btn) => btn.addEventListener('click', async () => {
      await markDeliveryDone(btn.dataset.doneOrder);
      showToast('Orden marcada como entregada', 'success');
    }));
  }
  renderDayList();

  body.querySelector('#add-event').addEventListener('click', () => openEventForm(isoDate, () => renderDayList()));
}

function openEventForm(isoDate, onSaved, existing = null) {
  const form = buildForm([
    { name: 'title', label: 'Título / asunto', required: true, value: existing?.title, fullWidth: true },
    { name: 'type', label: 'Tipo', type: 'select', options: APPOINTMENT_TYPES, required: true, value: existing?.type },
    { name: 'time', label: 'Hora', type: 'time', value: existing?.time },
    { name: 'clientName', label: 'Cliente', value: existing?.clientName },
    { name: 'clientPhone', label: 'Teléfono', value: existing?.clientPhone },
    { name: 'vehicleLabel', label: 'Vehículo', value: existing?.vehicleLabel },
    { name: 'unitNumber', label: 'Número de unidad', value: existing?.unitNumber },
    { name: 'technicianName', label: 'Técnico asignado', value: existing?.technicianName },
    { name: 'notes', label: 'Observaciones', type: 'textarea', value: existing?.notes, fullWidth: true }
  ]);
  const footer = document.createElement('div');
  footer.className = 'flex gap-2';
  footer.innerHTML = `<button class="btn btn--outline" id="cancel">Cancelar</button><button class="btn btn--primary" id="save">Guardar</button>`;
  const modal = openModal({ title: existing ? 'Editar evento' : 'Nuevo evento', body: form, footer, maxWidth: '460px' });
  footer.querySelector('#cancel').addEventListener('click', modal.close);
  footer.querySelector('#save').addEventListener('click', async () => {
    if (!validateForm(form)) return;
    if (existing) {
      await updateAppointment(existing.id, readForm(form));
    } else {
      await createAppointment({ ...readForm(form), date: isoDate, status: 'pendiente' });
    }
    showToast(existing ? 'Evento actualizado' : 'Evento agregado', 'success');
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
