/**
 * file-upload.js
 * -----------------------------------------------------------------------
 * Drag-and-drop / tap-to-browse photo uploader used by vehicles, service
 * orders (before/after) and warranties (evidence). Wraps
 * core/storage.service.js and keeps an in-memory list of
 * `{path, url, name}` objects that the caller persists to the parent
 * document on save.
 */

import { icon } from './icons.js';
import { uploadPhotos, deletePhoto } from '../../core/storage.service.js';
import { showToast } from './toast.js';
import { fileListToArray } from '../../core/utils.js';

/**
 * @param {HTMLElement} container
 * @param {{ folderPath: string, initialPhotos?: Array, label?: string, onChange?: (photos: Array) => void }} options
 */
export function createPhotoUploader(container, { folderPath, initialPhotos = [], label = 'Fotografías', onChange }) {
  let photos = [...initialPhotos];

  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="field__label">${label}</div>
    <div class="dropzone">
      ${icon('camera', { size: 28 })}
      <p class="text-sm mt-0 mb-0">Arrastra fotos aquí o toca para elegir</p>
      <input type="file" accept="image/*" multiple capture="environment" hidden />
    </div>
    <div class="photo-grid"></div>
  `;
  container.appendChild(wrap);

  const dropzone = wrap.querySelector('.dropzone');
  const input = wrap.querySelector('input[type=file]');
  const grid = wrap.querySelector('.photo-grid');

  function renderGrid() {
    grid.innerHTML = photos.map((p, i) => `
      <div class="photo-grid__item" data-index="${i}">
        <img src="${p.url}" alt="Foto ${i + 1}" loading="lazy" />
        <button type="button" class="photo-grid__remove" aria-label="Eliminar foto">${icon('close', { size: 12 })}</button>
      </div>`).join('');

    grid.querySelectorAll('.photo-grid__remove').forEach((btn) => {
      btn.addEventListener('click', async (event) => {
        const item = event.target.closest('.photo-grid__item');
        const index = Number(item.dataset.index);
        const [removed] = photos.splice(index, 1);
        renderGrid();
        onChange?.(photos);
        if (removed?.path) await deletePhoto(removed.path);
      });
    });
  }

  async function handleFiles(fileList) {
    const files = fileListToArray(fileList).filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    dropzone.classList.add('is-uploading');
    try {
      const uploaded = await uploadPhotos(folderPath, files);
      photos = [...photos, ...uploaded];
      renderGrid();
      onChange?.(photos);
    } catch (error) {
      console.error('[file-upload] upload failed', error);
      showToast('No se pudieron subir una o más fotos', 'danger');
    } finally {
      dropzone.classList.remove('is-uploading');
    }
  }

  dropzone.addEventListener('click', () => input.click());
  input.addEventListener('change', (e) => handleFiles(e.target.files));
  ['dragenter', 'dragover'].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove('dragover'); }));
  dropzone.addEventListener('drop', (e) => handleFiles(e.dataTransfer.files));

  renderGrid();

  return { getPhotos: () => photos };
}
