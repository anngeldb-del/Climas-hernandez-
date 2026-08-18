/**
 * app.js
 * -----------------------------------------------------------------------
 * Application bootstrap. Kept intentionally tiny: its only job is to wire
 * together the pieces that already know how to do their own thing —
 * theme, PWA registration, and swapping between the login screen and the
 * authenticated shell as the session changes.
 *
 * Suspension kill switch: when APP_SUSPENDED is true, everything below the
 * check is skipped — no Firebase, no auth, no shell — so a locked-out
 * client (and their offline-cached copy, once the service worker updates)
 * only ever sees the suspension notice.
 */

import { APP_SUSPENDED, SUSPENSION_CONTACT, BUSINESS } from './config/constants.js';

const root = document.getElementById('app-root');

if (APP_SUSPENDED) {
  root.innerHTML = `
    <div class="auth-screen">
      <div class="auth-card" style="text-align:center">
        <img class="logo" src="${BUSINESS.logo.default}" alt="${BUSINESS.name}" />
        <h2>Aplicación suspendida</h2>
        <p class="text-sm">Este sistema fue suspendido temporalmente por falta de pago.</p>
        <p class="text-sm">Favor de comunicarse con el desarrollador para habilitarla y seguir disfrutando de la app.</p>
        <a class="btn btn--primary btn--full" style="margin-top:20px" href="${SUSPENSION_CONTACT.whatsappHref}" target="_blank" rel="noopener">
          Contactar por WhatsApp
        </a>
        <p class="text-xs text-muted" style="margin-top:16px">${SUSPENSION_CONTACT.name} · ${SUSPENSION_CONTACT.phone} o ${SUSPENSION_CONTACT.altPhone}</p>
      </div>
    </div>
  `;
} else {
  const [
    { onSessionChange },
    { renderShell },
    { renderLoginScreen },
    { initRouter },
    { initPWA },
    { applyTheme, getTheme },
    { initSettings }
  ] = await Promise.all([
    import('./core/auth.service.js'),
    import('./components/shell.js'),
    import('./components/login-screen.js'),
    import('./core/router.js'),
    import('./core/pwa.service.js'),
    import('./core/theme.service.js'),
    import('./core/settings.service.js')
  ]);

  applyTheme(getTheme());
  initPWA();
  initSettings();

  let shellMounted = false;

  onSessionChange((session) => {
    if (session) {
      if (shellMounted) return; // role/profile changes re-resolve the route themselves (see router.js)
      const routeContainer = renderShell(root, session);
      initRouter(routeContainer);
      shellMounted = true;
    } else {
      shellMounted = false;
      renderLoginScreen(root);
    }
  });
}
