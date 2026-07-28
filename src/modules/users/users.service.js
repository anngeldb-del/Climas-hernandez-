/**
 * users.service.js
 * -----------------------------------------------------------------------
 * Firestore + Cloud Functions access for staff accounts. Creating a new
 * login must go through the `createUserAccount` Cloud Function
 * (functions/index.js) rather than the client SDK directly, because
 * createUserWithEmailAndPassword from an already-authenticated session
 * would sign the admin out and sign in as the freshly created user.
 */

import { subscribe, update } from '../../core/db.service.js';
import { functions, httpsCallable } from '../../core/firebase.init.js';
import { COLLECTIONS } from '../../config/constants.js';

export function subscribeUsers(onData) {
  return subscribe(COLLECTIONS.USERS, [], onData);
}

export function updateUser(id, data) {
  return update(COLLECTIONS.USERS, id, data);
}

export function createUserAccount(data) {
  return httpsCallable(functions, 'createUserAccount')(data);
}
