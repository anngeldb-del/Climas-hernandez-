/**
 * db.service.js
 * -----------------------------------------------------------------------
 * Generic Firestore CRUD helper. Every module talks to Firestore through
 * these functions instead of importing collection/doc/etc. directly —
 * that's what gives us one place that (a) stamps createdAt/updatedAt,
 * (b) writes the audit trail, and (c) keeps query code consistent.
 *
 * This is intentionally collection-agnostic: feature-specific queries
 * (e.g. "orders for this client") live in each module's own *.service.js
 * and build on top of `queryCollection`.
 */

import {
  db, collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, onSnapshot, serverTimestamp
} from './firebase.init.js';
import { logAudit } from './audit.service.js';

export function docRef(collectionName, id) {
  return doc(db, collectionName, id);
}

export async function getById(collectionName, id) {
  const snap = await getDoc(docRef(collectionName, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getAll(collectionName, ...queryConstraints) {
  const q = query(collection(db, collectionName), ...queryConstraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Subscribes to a live query. Returns the unsubscribe function — callers
 * (modules) MUST store and invoke it from their `unmount()` or the
 * listener leaks for the lifetime of the tab.
 */
export function subscribe(collectionName, queryConstraints, onData, onError) {
  const q = query(collection(db, collectionName), ...queryConstraints);
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (error) => {
      console.error(`[db] subscription error on "${collectionName}"`, error);
      onError?.(error);
    }
  );
}

export async function create(collectionName, data, { auditDetails } = {}) {
  const payload = { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  const ref = await addDoc(collection(db, collectionName), payload);
  await logAudit(collectionName, ref.id, 'create', auditDetails ?? { fields: Object.keys(data) });
  return ref.id;
}

export async function update(collectionName, id, data, { auditDetails } = {}) {
  const payload = { ...data, updatedAt: serverTimestamp() };
  await updateDoc(docRef(collectionName, id), payload);
  await logAudit(collectionName, id, 'update', auditDetails ?? { fields: Object.keys(data) });
}

export async function remove(collectionName, id, { auditDetails } = {}) {
  await deleteDoc(docRef(collectionName, id));
  await logAudit(collectionName, id, 'delete', auditDetails ?? {});
}
