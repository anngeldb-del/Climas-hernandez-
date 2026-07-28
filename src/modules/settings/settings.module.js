/**
 * settings.module.js
 * -----------------------------------------------------------------------
 * Configuración screen (admin-only, enforced by ROLE_PERMISSIONS + the
 * settings/business Firestore rule): business contact info, logo, and
 * the default IVA/ISR rates + on-by-default toggles that new quotes and
 * orders start from. Persisted via core/settings.service.js (Firestore
 * as source of truth, localStorage as an instant-load cache).
 */

import {
  getCachedSettings, saveSettings, uploadLogo
} from '../../core/settings.service.js';
import { clampPercent } from '../../core/tax.service.js';
import { buildForm, readForm, validateForm } from '../../components/ui/form-builder.js';
import { showToast } from '../../components/ui/toast.js';
import { icon } from '../../components/ui/icons.js';
import { BUSINESS } from '../../config/constants.js';

let container = null;

function businessFormFields(settings) {
  return [
    { name: 'businessName', label: 'Nombre del negocio', required: true, value: settings.businessName, fullWidth: true },
    { name: 'slogan', label: 'Eslogan', value: settings.slogan, fullWidth: true },
    { name: 'address', label: 'Dirección', value: settings.address, fullWidth: true },
    { name: 'phone', label: 'Teléfono', value: settings.phone },
    { name: 'email', label: 'Correo electrónico', type: 'email', value: settings.email, hint: 'Aparece en el ticket impreso si se llena' },
    { name: 'rfc', label: 'RFC', value: settings.rfc, hint: 'Opcional' },
    { name: 'website', label: 'Página web', value: settings.website, hint: 'Opcional' }
  ];
}

function taxFormFields(settings) {
  return [
    { name: 'ivaEnabledByDefault', label: 'Activar IVA por defecto en nuevas cotizaciones y órdenes', type: 'checkbox', value: settings.ivaEnabledByDefault, fullWidth: true },
    { name: 'ivaRate', label: 'Porcentaje de IVA por defecto', type: 'number', step: '0.01', min: 0, max: 100, value: settings.ivaRate },
    { name: 'isrEnabledByDefault', label: 'Activar retención de ISR por defecto', type: 'checkbox', value: settings.isrEnabledByDefault, fullWidth: true },
    { name: 'isrRate', label: 'Porcentaje de ISR por defecto', type: 'number', step: '0.25', min: 0, max: 100, value: settings.isrRate }
  ];
}

async function mount(root) {
  container = root;
  const settings = getCachedSettings();

  container.innerHTML = `
    <div class="page-header"><h1>Configuración</h1></div>

    <div class="card section">
      <div class="card__header"><h3 class="card__title">Logotipo</h3></div>
      <div class="flex items-center gap-4">
        <img id="logo-preview" src="${settings.logoUrl || BUSINESS.logo.default}" alt="Logo"
          style="height:64px;width:auto;border:1px solid var(--color-border);border-radius:8px;padding:4px;background:#fff" />
        <div>
          <input type="file" id="logo-file" accept="image/*" hidden />
          <button type="button" class="btn btn--outline btn--sm" id="logo-upload-btn">${icon('upload', { size: 14 })} Cambiar logotipo</button>
          <p class="field__hint mb-0">Se usará en toda la app, cotizaciones y tickets impresos.</p>
        </div>
      </div>
    </div>

    <div class="card section">
      <div class="card__header"><h3 class="card__title">Datos del negocio</h3></div>
      <div id="business-form-container"></div>
    </div>

    <div class="card section">
      <div class="card__header"><h3 class="card__title">Impuestos por defecto</h3></div>
      <p class="text-sm text-muted">Estos valores solo son el punto de partida al crear una nueva cotización u orden — siempre se pueden activar, desactivar o ajustar caso por caso.</p>
      <div id="tax-form-container"></div>
    </div>

    <div class="flex justify-end gap-2">
      <button type="button" class="btn btn--primary" id="save-settings">Guardar configuración</button>
    </div>
  `;

  const businessForm = buildForm(businessFormFields(settings));
  container.querySelector('#business-form-container').appendChild(businessForm);

  const taxForm = buildForm(taxFormFields(settings));
  container.querySelector('#tax-form-container').appendChild(taxForm);

  container.querySelector('#logo-upload-btn').addEventListener('click', () => container.querySelector('#logo-file').click());
  container.querySelector('#logo-file').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const btn = container.querySelector('#logo-upload-btn');
    btn.disabled = true;
    try {
      const url = await uploadLogo(file);
      container.querySelector('#logo-preview').src = url;
      showToast('Logotipo actualizado', 'success');
    } catch (error) {
      console.error('[settings] logo upload failed', error);
      showToast('No se pudo subir el logotipo', 'danger');
    } finally {
      btn.disabled = false;
    }
  });

  container.querySelector('#save-settings').addEventListener('click', async () => {
    if (!validateForm(businessForm)) return;
    const saveBtn = container.querySelector('#save-settings');
    saveBtn.disabled = true;
    try {
      const businessData = readForm(businessForm);
      const taxData = readForm(taxForm);
      // Defense in depth: clamp again here even though the number inputs
      // already have min/max — a pasted or scripted value could bypass those.
      taxData.ivaRate = clampPercent(taxData.ivaRate);
      taxData.isrRate = clampPercent(taxData.isrRate);
      await saveSettings({ ...businessData, ...taxData });
      showToast('Configuración guardada', 'success');
    } catch (error) {
      console.error('[settings] save failed', error);
      showToast('No se pudo guardar la configuración', 'danger');
    } finally {
      saveBtn.disabled = false;
    }
  });
}

function unmount() { container = null; }

export default { mount, unmount };
