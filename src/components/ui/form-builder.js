/**
 * form-builder.js
 * -----------------------------------------------------------------------
 * Declarative form rendering: describe fields as plain objects, get back
 * a <form> element plus helpers to read/validate its values. Keeps every
 * module's "add/edit X" modal to a short schema instead of hand-rolled
 * markup, and centralizes validation behavior (required, patterns).
 *
 * Field shape:
 *   { name, label, type='text'|'number'|'select'|'textarea'|'date'|'datetime-local'|'checkbox',
 *     required=false, options=[{value,label}], placeholder, hint, value, step, min, max, rows }
 */

import { escapeHtml } from '../../core/utils.js';

export function buildForm(fields, { columns = true } = {}) {
  const form = document.createElement('form');
  form.noValidate = true;
  form.className = columns ? 'grid grid--form' : '';

  for (const field of fields) {
    form.appendChild(renderField(field));
  }

  return form;
}

function renderField(field) {
  const wrap = document.createElement('div');
  wrap.className = 'field';
  if (field.fullWidth) wrap.style.gridColumn = '1 / -1';

  if (field.type === 'checkbox') {
    wrap.innerHTML = `
      <label class="flex items-center gap-2">
        <input type="checkbox" name="${field.name}" ${field.value ? 'checked' : ''} />
        <span>${escapeHtml(field.label)}</span>
      </label>`;
    return wrap;
  }

  const labelHtml = field.label
    ? `<label class="field__label" for="f_${field.name}">${escapeHtml(field.label)}${field.required ? ' *' : ''}</label>`
    : '';

  let controlHtml;
  if (field.type === 'select') {
    const opts = (field.options || []).map((opt) =>
      `<option value="${escapeHtml(opt.value)}" ${String(opt.value) === String(field.value) ? 'selected' : ''}>${escapeHtml(opt.label)}</option>`
    ).join('');
    controlHtml = `<select class="select" id="f_${field.name}" name="${field.name}" ${field.required ? 'required' : ''}>
      ${field.placeholder ? `<option value="">${escapeHtml(field.placeholder)}</option>` : ''}${opts}
    </select>`;
  } else if (field.type === 'textarea') {
    controlHtml = `<textarea class="textarea" id="f_${field.name}" name="${field.name}" rows="${field.rows || 3}" placeholder="${escapeHtml(field.placeholder || '')}" ${field.required ? 'required' : ''}>${escapeHtml(field.value || '')}</textarea>`;
  } else {
    controlHtml = `<input class="input" id="f_${field.name}" name="${field.name}" type="${field.type || 'text'}"
      value="${escapeHtml(field.value ?? '')}" placeholder="${escapeHtml(field.placeholder || '')}"
      ${field.required ? 'required' : ''} ${field.step !== undefined ? `step="${field.step}"` : ''}
      ${field.min !== undefined ? `min="${field.min}"` : ''} ${field.max !== undefined ? `max="${field.max}"` : ''} />`;
  }

  wrap.innerHTML = `${labelHtml}${controlHtml}
    ${field.hint ? `<span class="field__hint">${escapeHtml(field.hint)}</span>` : ''}
    <span class="field__error" hidden></span>`;
  return wrap;
}

/** Reads a form built by buildForm() into a plain object keyed by field name. */
export function readForm(form) {
  const data = {};
  for (const element of form.elements) {
    if (!element.name) continue;
    if (element.type === 'checkbox') data[element.name] = element.checked;
    else if (element.type === 'number') data[element.name] = element.value === '' ? null : Number(element.value);
    else data[element.name] = element.value;
  }
  return data;
}

/** Basic client-side validation mirroring the `required` attribute; returns true if valid. */
export function validateForm(form) {
  let valid = true;
  for (const element of form.elements) {
    if (!element.name) continue;
    const fieldWrap = element.closest('.field');
    const errorEl = fieldWrap?.querySelector('.field__error');
    const isEmpty = element.type === 'checkbox' ? false : !String(element.value ?? '').trim();

    if (element.required && isEmpty) {
      valid = false;
      if (errorEl) { errorEl.textContent = 'Este campo es obligatorio'; errorEl.hidden = false; }
      fieldWrap?.classList.add('has-error');
    } else if (errorEl) {
      errorEl.hidden = true;
      fieldWrap?.classList.remove('has-error');
    }
  }
  return valid;
}
