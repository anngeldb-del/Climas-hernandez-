/**
 * auth.service.js
 * -----------------------------------------------------------------------
 * Wraps Firebase Authentication + the /users/{uid} profile document (role,
 * display name, active flag) into a single reactive "current session"
 * object the rest of the app can subscribe to. Keeping role lookup here
 * (instead of scattered across modules) means there is exactly one place
 * that decides "who is this and what can they do".
 */

import { auth, db, onAuthStateChanged, signInWithEmailAndPassword, signOut, doc, getDoc } from './firebase.init.js';
import { ROLE_PERMISSIONS } from '../config/constants.js';

/** @type {{uid: string, email: string, role: string, displayName: string, active: boolean} | null} */
let currentSession = null;
let ready = false;
const listeners = new Set();

function notify() {
  for (const listener of listeners) listener(currentSession);
}

/** Subscribe to session changes; returns an unsubscribe function. Fires immediately if auth already resolved. */
export function onSessionChange(listener) {
  listeners.add(listener);
  if (ready) listener(currentSession);
  return () => listeners.delete(listener);
}

/** Resolves once the initial auth state (and profile fetch) has settled. */
export function whenReady() {
  if (ready) return Promise.resolve(currentSession);
  return new Promise((resolve) => {
    const unsubscribe = onSessionChange((session) => {
      if (ready) { unsubscribe(); resolve(session); }
    });
  });
}

export function getSession() {
  return currentSession;
}

export async function login(email, password) {
  await signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function logout() {
  await signOut(auth);
}

export function hasAccess(moduleKey) {
  if (!currentSession) return false;
  const allowed = ROLE_PERMISSIONS[currentSession.role] || [];
  return allowed.includes('*') || allowed.includes(moduleKey);
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentSession = null;
    ready = true;
    notify();
    return;
  }

  try {
    const profileSnap = await getDoc(doc(db, 'users', user.uid));
    const profile = profileSnap.exists() ? profileSnap.data() : null;

    if (!profile || profile.active === false) {
      // Authenticated with Firebase but no active business profile —
      // treat as logged out rather than granting a role-less session.
      await signOut(auth);
      currentSession = null;
    } else {
      currentSession = {
        uid: user.uid,
        email: user.email,
        role: profile.role,
        displayName: profile.displayName || user.email,
        active: profile.active
      };
    }
  } catch (error) {
    console.error('[auth] failed to load user profile', error);
    currentSession = null;
  }

  ready = true;
  notify();
});
