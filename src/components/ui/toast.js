/**
 * toast.js
 * -----------------------------------------------------------------------
 * Lightweight, dependency-free toast notifications. A single region is
 * lazily created in the DOM the first time showToast() is called.
 */

let region = null;

function ensureRegion() {
  if (region) return region;
  region = document.createElement('div');
  region.className = 'toast-region';
  region.setAttribute('role', 'status');
  region.setAttribute('aria-live', 'polite');
  document.body.appendChild(region);
  return region;
}

/**
 * @param {string} message
 * @param {'info'|'success'|'warning'|'danger'} variant
 * @param {{duration?: number, action?: {label: string, onClick: Function}}} [options]
 */
export function showToast(message, variant = 'info', options = {}) {
  const { duration = 5000, action } = options;
  const el = document.createElement('div');
  el.className = `toast toast--${variant}`;
  el.innerHTML = `<div>${message}</div>`;

  if (action) {
    const btn = document.createElement('button');
    btn.className = 'btn btn--sm btn--outline';
    btn.style.marginTop = '8px';
    btn.textContent = action.label;
    btn.addEventListener('click', () => { action.onClick(); el.remove(); });
    el.appendChild(btn);
  }

  ensureRegion().appendChild(el);

  if (duration > 0) {
    setTimeout(() => el.remove(), duration);
  }
  return el;
}
