/**
 * login-screen.js
 * -----------------------------------------------------------------------
 * Pre-authentication screen. Rendered by app.js whenever there is no
 * active session; swapped out for the app shell once auth.service reports
 * a signed-in, active user.
 */

import { login } from '../core/auth.service.js';
import { auth, sendPasswordResetEmail } from '../core/firebase.init.js';
import { showToast } from './ui/toast.js';
import { getEffectiveBusiness } from '../core/settings.service.js';

const AUTH_ERROR_MESSAGES = {
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/invalid-email': 'El correo no es válido.',
  'auth/user-disabled': 'Esta cuenta está deshabilitada.',
  'auth/too-many-requests': 'Demasiados intentos. Intenta de nuevo más tarde.'
};

export function renderLoginScreen(root) {
  const business = getEffectiveBusiness();
  root.innerHTML = `
    <div class="auth-screen">
      <form class="auth-card" id="login-form" novalidate>
        <img class="logo" src="${business.logo}" alt="${business.name}" />
        <h2>${business.name}</h2>
        <p class="text-sm">${business.slogan}</p>

        <div class="field text-left" style="text-align:left">
          <label class="field__label" for="login-email">Correo electrónico</label>
          <input class="input" id="login-email" name="email" type="email" required autocomplete="username" />
        </div>
        <div class="field" style="text-align:left">
          <label class="field__label" for="login-password">Contraseña</label>
          <input class="input" id="login-password" name="password" type="password" required autocomplete="current-password" />
        </div>

        <button type="submit" class="btn btn--primary btn--full" id="login-submit">Iniciar sesión</button>
        <button type="button" class="btn btn--ghost btn--full" id="forgot-password" style="margin-top:8px">
          ¿Olvidaste tu contraseña?
        </button>

        <p class="text-xs text-muted" style="margin-top:24px">${business.addressFull} · ${business.phone}</p>
      </form>
    </div>
  `;

  const form = document.getElementById('login-form');
  const submitBtn = document.getElementById('login-submit');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = form.email.value.trim();
    const password = form.password.value;
    if (!email || !password) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Ingresando…';
    try {
      await login(email, password);
    } catch (error) {
      showToast(AUTH_ERROR_MESSAGES[error.code] || 'No se pudo iniciar sesión.', 'danger');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Iniciar sesión';
    }
  });

  document.getElementById('forgot-password').addEventListener('click', async () => {
    const email = form.email.value.trim();
    if (!email) {
      showToast('Escribe tu correo arriba y vuelve a tocar este botón.', 'info');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      showToast('Te enviamos un correo para restablecer tu contraseña.', 'success');
    } catch {
      showToast('No se pudo enviar el correo de recuperación.', 'danger');
    }
  });
}
