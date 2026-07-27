/**
 * modal.js
 * -----------------------------------------------------------------------
 * Imperative modal dialog builder used by every module for create/edit
 * forms and confirmations. Deliberately framework-free: pass HTML/DOM for
 * the body, get back a controller with .close().
 */

import { icon } from './icons.js';

/**
 * @param {{title: string, body: HTMLElement|string, footer?: HTMLElement|string, maxWidth?: string, onClose?: Function}} options
 */
export function openModal({ title, body, footer, maxWidth = '560px', onClose }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.setProperty('--modal-max-width', maxWidth);
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  const header = document.createElement('div');
  header.className = 'modal__header';
  header.innerHTML = `<h3>${title}</h3>`;
  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn btn--icon btn--ghost';
  closeBtn.setAttribute('aria-label', 'Cerrar');
  closeBtn.innerHTML = icon('close');
  header.appendChild(closeBtn);

  const bodyEl = document.createElement('div');
  bodyEl.className = 'modal__body';
  if (typeof body === 'string') bodyEl.innerHTML = body; else bodyEl.appendChild(body);

  modal.appendChild(header);
  modal.appendChild(bodyEl);

  if (footer) {
    const footerEl = document.createElement('div');
    footerEl.className = 'modal__footer';
    if (typeof footer === 'string') footerEl.innerHTML = footer; else footerEl.appendChild(footer);
    modal.appendChild(footerEl);
  }

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
  document.body.style.overflow = 'hidden';

  function close() {
    backdrop.remove();
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKeydown);
    onClose?.();
  }

  function onKeydown(event) {
    if (event.key === 'Escape') close();
  }

  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) close(); });
  document.addEventListener('keydown', onKeydown);

  return { close, modalEl: modal, bodyEl };
}

/** Convenience wrapper for yes/no confirmations (delete actions, etc.). */
export function confirmDialog({ title = 'Confirmar', message, confirmLabel = 'Confirmar', danger = true }) {
  return new Promise((resolve) => {
    const footer = document.createElement('div');
    footer.className = 'flex gap-2';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn--outline';
    cancelBtn.textContent = 'Cancelar';
    const confirmBtn = document.createElement('button');
    confirmBtn.className = `btn ${danger ? 'btn--danger' : 'btn--primary'}`;
    confirmBtn.textContent = confirmLabel;
    footer.append(cancelBtn, confirmBtn);

    const controller = openModal({
      title,
      body: `<p>${message}</p>`,
      footer,
      maxWidth: '420px',
      onClose: () => resolve(false)
    });

    cancelBtn.addEventListener('click', () => { controller.close(); resolve(false); });
    confirmBtn.addEventListener('click', () => { resolve(true); controller.close(); });
  });
}
