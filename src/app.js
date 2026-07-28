/**
 * app.js
 * -----------------------------------------------------------------------
 * Application bootstrap. Kept intentionally tiny: its only job is to wire
 * together the pieces that already know how to do their own thing —
 * theme, PWA registration, and swapping between the login screen and the
 * authenticated shell as the session changes.
 */

import { onSessionChange } from './core/auth.service.js';
import { renderShell } from './components/shell.js';
import { renderLoginScreen } from './components/login-screen.js';
import { initRouter } from './core/router.js';
import { initPWA } from './core/pwa.service.js';
import { applyTheme, getTheme } from './core/theme.service.js';
import { initSettings } from './core/settings.service.js';

applyTheme(getTheme());
initPWA();
initSettings();

const root = document.getElementById('app-root');
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
