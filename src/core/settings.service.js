/**
 * settings.service.js
 * -----------------------------------------------------------------------
 * Business-wide configurable settings: default IVA/ISR rates + whether
 * they're on by default, business contact info, and a custom logo
 * override. Firestore (settings/business) is the source of truth — this
 * is a shared multi-device business app, so a rate change made by the
 * admin on one computer must show up for recepción on another. Every
 * write also lands in localStorage as an instant-load cache (read
 * synchronously before Firestore's first snapshot arrives, and used as
 * an offline fallback) — the spec asked for localStorage persistence,
 * and this gets that benefit without making it the source of truth.
 */

import { db, doc, setDoc, onSnapshot, storage, ref, uploadBytes, getDownloadURL } from './firebase.init.js';
import { BUSINESS } from '../config/constants.js';
import { compressImage } from './utils.js';

const SETTINGS_DOC_ID = 'business';
const CACHE_KEY = 'autoclimas.settings.cache';

export const TAX_DEFAULTS = Object.freeze({
  ivaRate: 16,
  ivaEnabledByDefault: false,
  isrRate: 1.25,
  isrEnabledByDefault: false
});

const FALLBACK_SETTINGS = Object.freeze({
  businessName: BUSINESS.name,
  slogan: BUSINESS.slogan,
  address: BUSINESS.address.full,
  phone: BUSINESS.phone,
  email: '',
  rfc: '',
  website: '',
  logoUrl: '',
  ...TAX_DEFAULTS
});

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // Storage full/disabled (private browsing) — settings still work via Firestore, just without the instant-load cache.
  }
}

/** Seeded synchronously at import time so the very first render (before Firestore resolves) already has sensible values. */
let current = { ...FALLBACK_SETTINGS, ...readCache() };

/** Synchronous read for code that can't await (e.g. seeding a form's default field values). */
export function getCachedSettings() {
  return current;
}

let unsubscribeFirestore = null;

/** Call once at app boot (see app.js) to start syncing with Firestore. */
export function initSettings() {
  if (unsubscribeFirestore) return;
  unsubscribeFirestore = onSnapshot(
    doc(db, 'settings', SETTINGS_DOC_ID),
    (snap) => {
      current = { ...FALLBACK_SETTINGS, ...(snap.exists() ? snap.data() : {}) };
      writeCache(current);
    },
    (error) => {
      // Offline or no permission yet (e.g. settings doc doesn't exist and rules
      // reject the read) — keep serving the cached/fallback values, don't crash.
      console.warn('[settings] falling back to cached settings', error);
    }
  );
}

export async function saveSettings(partial) {
  await setDoc(doc(db, 'settings', SETTINGS_DOC_ID), partial, { merge: true });
  // onSnapshot will also fire from our own write, but updating optimistically
  // keeps the Configuración screen feeling instant instead of waiting a round trip.
  current = { ...current, ...partial };
  writeCache(current);
}

/** Uploads a new logo to Storage and saves its URL as the active logo override. */
export async function uploadLogo(file) {
  const compressed = await compressImage(file, 800);
  const path = `settings/logo-${Date.now()}-${compressed.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, compressed);
  const url = await getDownloadURL(storageRef);
  await saveSettings({ logoUrl: url });
  return url;
}

/**
 * Merges the static BUSINESS constant (the original, always-valid
 * fallback) with any admin-configured overrides. UI code should read
 * business info through this instead of importing BUSINESS directly,
 * so a Configuración change is reflected everywhere without further
 * plumbing.
 */
export function getEffectiveBusiness() {
  return {
    name: current.businessName || BUSINESS.name,
    slogan: current.slogan || BUSINESS.slogan,
    phone: current.phone || BUSINESS.phone,
    email: current.email || '',
    rfc: current.rfc || '',
    website: current.website || '',
    addressFull: current.address || BUSINESS.address.full,
    logo: current.logoUrl || BUSINESS.logo.default,
    logoHd: current.logoUrl || BUSINESS.logo.hd
  };
}
