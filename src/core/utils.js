/**
 * utils.js
 * -----------------------------------------------------------------------
 * Small, dependency-free helper functions shared across modules. Nothing
 * here touches Firebase or the DOM structure of a specific feature — if a
 * helper is specific to one module, it belongs in that module instead.
 */

const currencyFormatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const dateFormatter = new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
const dateTimeFormatter = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
});

export function formatCurrency(amount) {
  return currencyFormatter.format(Number(amount) || 0);
}

/** Accepts a Date, a Firestore Timestamp (has .toDate()), or an ISO string. */
export function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDate(value) {
  const date = toDate(value);
  return date ? dateFormatter.format(date) : '—';
}

export function formatDateTime(value) {
  const date = toDate(value);
  return date ? dateTimeFormatter.format(date) : '—';
}

export function daysBetween(a, b = new Date()) {
  const dateA = toDate(a);
  if (!dateA) return null;
  return Math.floor((dateA.getTime() - toDate(b).getTime()) / 86_400_000);
}

/** Debounces rapid calls (search inputs, resize handlers, etc.). */
export function debounce(fn, wait = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

/** Strips accents/case so "PEÑA" matches a search for "pena". */
export function normalizeText(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim();
}

export function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

/** Builds a `class="a b c"` value from an object/array, skipping falsy keys. */
export function classNames(...items) {
  const out = [];
  for (const item of items) {
    if (!item) continue;
    if (typeof item === 'string') out.push(item);
    else if (Array.isArray(item)) out.push(...item.filter(Boolean));
    else out.push(...Object.entries(item).filter(([, v]) => v).map(([k]) => k));
  }
  return out.join(' ');
}

export function digitsOnly(value) {
  return String(value ?? '').replace(/\D/g, '');
}

export function waLink(phone, message = '') {
  const digits = digitsOnly(phone);
  const withCountry = digits.length === 10 ? `52${digits}` : digits;
  const text = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${withCountry}${text}`;
}

/** Generates a short, human-typeable id for client-side-only temp keys (e.g. new photo rows before upload). */
export function tempId() {
  return `tmp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Clamp helper used by pagination and stock-level bars. */
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** Reads multiple <input type="file"> selections as an array of Files. */
export function fileListToArray(fileList) {
  return Array.from(fileList || []);
}

/** Resizes/compresses an image File client-side before upload to Storage, capping the longest side. */
export async function compressImage(file, maxDimension = 1600, quality = 0.82) {
  if (!file.type.startsWith('image/')) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.\w+$/, '.webp'), { type: 'image/webp' });
}

/** Turns a FormData-like plain object into Firestore-safe data (drops undefined, trims strings). */
export function sanitizeFormData(data) {
  const clean = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    clean[key] = typeof value === 'string' ? value.trim() : value;
  }
  return clean;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function csvFromRows(rows, headers) {
  const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const lines = [headers.map(escape).join(',')];
  for (const row of rows) lines.push(headers.map((h) => escape(row[h])).join(','));
  return lines.join('\r\n');
}
