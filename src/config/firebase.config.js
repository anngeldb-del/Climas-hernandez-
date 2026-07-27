/**
 * firebase.config.js
 * -----------------------------------------------------------------------
 * Firebase project credentials.
 *
 * These values are PUBLIC identifiers (not secrets) — Firebase's real
 * security boundary is firestore.rules / storage.rules, not this file.
 * Still, keep this file per-environment so staging/production can point
 * at different projects.
 *
 * HOW TO FILL THIS IN:
 *   1. Go to https://console.firebase.google.com → create/select project.
 *   2. Project settings → General → "Your apps" → Web app (</>) → copy
 *      the firebaseConfig object shown there.
 *   3. Paste the values below.
 *   4. Enable in the console: Authentication (Email/Password),
 *      Firestore Database, Storage, Hosting.
 */
export const firebaseConfig = {
  apiKey: 'REPLACE_WITH_YOUR_API_KEY',
  authDomain: 'REPLACE_WITH_YOUR_PROJECT.firebaseapp.com',
  projectId: 'REPLACE_WITH_YOUR_PROJECT_ID',
  storageBucket: 'REPLACE_WITH_YOUR_PROJECT.appspot.com',
  messagingSenderId: 'REPLACE_WITH_YOUR_SENDER_ID',
  appId: 'REPLACE_WITH_YOUR_APP_ID'
};

/** Toggle verbose console logging across the app (auto-off in production). */
export const DEBUG = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
