/**
 * pwa.service.js
 * -----------------------------------------------------------------------
 * Registers the service worker, captures the "install app" prompt so we
 * can trigger it from a normal button instead of relying on the browser's
 * own (easy to miss) UI, and shows a toast when a new version has been
 * downloaded and is ready to take over.
 */

import { showToast } from '../components/ui/toast.js';

let deferredInstallPrompt = null;

export function initPWA() {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.register('./service-worker.js').then((registration) => {
    registration.addEventListener('updatefound', () => {
      const installingWorker = registration.installing;
      installingWorker?.addEventListener('statechange', () => {
        if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
          showToast('Hay una nueva versión disponible. Toca para actualizar.', 'info', {
            action: { label: 'Actualizar', onClick: () => {
              installingWorker.postMessage('SKIP_WAITING');
              location.reload();
            } }
          });
        }
      });
    });
  }).catch((error) => console.error('[pwa] service worker registration failed', error));

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    document.dispatchEvent(new CustomEvent('pwa:installable'));
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
  });
}

export function canInstall() {
  return Boolean(deferredInstallPrompt);
}

export async function promptInstall() {
  if (!deferredInstallPrompt) return false;
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  return outcome === 'accepted';
}
