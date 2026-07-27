/**
 * audit.service.js
 * -----------------------------------------------------------------------
 * Writes an immutable trail of who-did-what-when ("bitácora de cambios").
 * Firestore rules make auditLog append-only, so this is the only writer
 * that ever needs to exist — db.service.js calls it after every mutation.
 */

import { db, collection, addDoc, serverTimestamp } from './firebase.init.js';
import { COLLECTIONS } from '../config/constants.js';
import { getSession } from './auth.service.js';

/**
 * @param {string} entity     collection name, e.g. "serviceOrders"
 * @param {string} entityId   document id affected
 * @param {'create'|'update'|'delete'} action
 * @param {object} [details]  small, human-readable diff/summary (avoid dumping entire documents)
 */
export async function logAudit(entity, entityId, action, details = {}) {
  const session = getSession();
  try {
    await addDoc(collection(db, COLLECTIONS.AUDIT_LOG), {
      entity,
      entityId,
      action,
      details,
      actorUid: session?.uid ?? 'unknown',
      actorName: session?.displayName ?? 'unknown',
      actorRole: session?.role ?? 'unknown',
      at: serverTimestamp()
    });
  } catch (error) {
    // Never let audit logging break the user-facing operation it's describing.
    console.error('[audit] failed to record entry', entity, entityId, action, error);
  }
}
