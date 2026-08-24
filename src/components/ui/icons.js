/**
 * icons.js
 * -----------------------------------------------------------------------
 * Tiny inline-SVG icon set (stroke-based, 24x24 viewBox) so the app needs
 * no icon font or external library. Add new glyphs by dropping another
 * path string into ICON_PATHS — `icon()` handles sizing/color/markup.
 */

const ICON_PATHS = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  clients: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 20c0-3.6 2.9-6 5.5-6s5.5 2.4 5.5 6"/><circle cx="17.5" cy="8.5" r="2.4"/><path d="M15 14.3c2.6.3 5 2.3 5 5.7"/>',
  vehicle: '<path d="M4 16V11l1.8-4.6A2 2 0 0 1 7.7 5h8.6a2 2 0 0 1 1.9 1.4L20 11v5"/><path d="M4 16h16v2.5a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1V17H7.5v1.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><circle cx="7.5" cy="16" r="1.4"/><circle cx="16.5" cy="16" r="1.4"/>',
  order: '<path d="M7 3h8l4 4v14H7z"/><path d="M15 3v4h4"/><path d="M9.5 12h5M9.5 15.5h5M9.5 8.5h2"/>',
  catalog: '<path d="M5 4h14v16l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M8.5 9h7M8.5 12.5h7"/>',
  quote: '<path d="M6 3h9l5 5v13H6z"/><path d="M15 3v5h5"/><path d="M9 13h6M9 16.5h6"/>',
  payments: '<rect x="2.5" y="5.5" width="19" height="13" rx="2"/><path d="M2.5 10h19"/><path d="M6 14.5h4"/>',
  warranty: '<path d="M12 3 5 6v6c0 4.2 2.9 7.4 7 9 4.1-1.6 7-4.8 7-9V6z"/><path d="m9.2 12 2 2 3.6-4"/>',
  agenda: '<rect x="3.5" y="4.5" width="17" height="16" rx="2"/><path d="M3.5 9.5h17"/><path d="M8 3v3M16 3v3"/><path d="M8 13.5h.01M12 13.5h.01M16 13.5h.01M8 17h.01M12 17h.01"/>',
  reports: '<path d="M4 20V10M10 20V4M16 20v-7M20.5 20H3.5"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.3-4.3"/>',
  users: '<circle cx="8.5" cy="8" r="3"/><path d="M3 19c0-3 2.5-5.2 5.5-5.2S14 16 14 19"/><circle cx="17" cy="8.5" r="2.4"/><path d="M14.8 14c2.3.4 4.2 2.2 4.2 5"/>',
  audit: '<path d="M4 5.5h13.5A2.5 2.5 0 0 1 20 8v11H6.5A2.5 2.5 0 0 1 4 16.5z"/><path d="M8 10h8M8 13.5h8"/>',
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4 6.8 6.8 0 0 0 20 14.5z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="m15.2 4.8 4 4L8 20H4v-4z"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.8a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V7M7 7l1 12.3a1 1 0 0 0 1 .9h6a1 1 0 0 0 1-.9L17 7"/>',
  close: '<path d="m5 5 14 14M19 5 5 19"/>',
  check: '<path d="m4.5 12.5 5 5 10-11"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  chevronRight: '<path d="m9 6 6 6-6 6"/>',
  whatsapp: '<path d="M7 17.3 4.5 19l1-3.3A7.5 7.5 0 1 1 11.9 19a7.4 7.4 0 0 1-3.4-.8z"/><path d="M9 9.6c0 3 2.5 5.5 5.5 5.5.5 0 .9-.5.9-1.1l-.2-1-2-.7-.8 1a5.6 5.6 0 0 1-2.6-2.6l1-.8-.7-2-1-.2c-.6 0-1.1.4-1.1.9z"/>',
  send: '<path d="M21 3 3 10.5l7 2.5M21 3l-6.5 18-4.5-7.5M21 3 10 13"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 6.5 8 6.5 8-6.5"/>',
  phone: '<path d="M6 3.5 9 4l1 4-2 1.5a11 11 0 0 0 5.5 5.5l1.5-2 4 1 .5 3a2 2 0 0 1-2 2.2A16 16 0 0 1 3.8 5.5 2 2 0 0 1 6 3.5z"/>',
  upload: '<path d="M12 15V4M8 8l4-4 4 4"/><path d="M4 16v2.5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V16"/>',
  download: '<path d="M12 4v11M8 11l4 4 4-4"/><path d="M4 16v2.5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V16"/>',
  filter: '<path d="M3.5 5h17L14 13v6l-4 2v-8z"/>',
  bell: '<path d="M6 10a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 14 6 10z"/><path d="M9.5 18.5a2.5 2.5 0 0 0 5 0"/>',
  logout: '<path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3"/><path d="M14 8l4 4-4 4M18 12H8"/>',
  menu: '<path d="M4 6.5h16M4 12h16M4 17.5h16"/>',
  warning: '<path d="M12 3.5 22 20H2z"/><path d="M12 10v4.5M12 17.5h.01"/>',
  camera: '<path d="M4 8h3l2-2.5h6L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 10.5v6M12 7.5h.01"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.4-2-3.4-2.3.9a7.6 7.6 0 0 0-2.6-1.5L14 2.5h-4l-.5 2.6a7.6 7.6 0 0 0-2.6 1.5l-2.3-.9-2 3.4 2 1.4a7.6 7.6 0 0 0 0 3l-2 1.4 2 3.4 2.3-.9c.75.65 1.63 1.16 2.6 1.5l.5 2.6h4l.5-2.6a7.6 7.6 0 0 0 2.6-1.5l2.3.9 2-3.4z"/>'
};

export function icon(name, { size = 20, className = '' } = {}) {
  const path = ICON_PATHS[name];
  if (!path) {
    console.warn(`[icons] unknown icon "${name}"`);
    return '';
  }
  return `<svg class="${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}
