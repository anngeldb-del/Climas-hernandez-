/**
 * functions/index.js
 * -----------------------------------------------------------------------
 * Cloud Functions for Autoclimas Hernández. This is the "prepared
 * structure" the spec asks for: everything a growing shop will eventually
 * need (server-side user provisioning, low-stock/notification hooks,
 * a scheduled-backup skeleton) with the one function the client app
 * already calls (`createUserAccount`) fully implemented, and the rest
 * left as clearly-labeled stubs to fill in when those integrations
 * (email/WhatsApp provider, GCS backup bucket) are actually provisioned.
 *
 * Deploy with: firebase deploy --only functions
 * (requires `npm install` inside this folder first — see functions/README.md)
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');

admin.initializeApp();
setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

const db = admin.firestore();

// ---------------------------------------------------------------------
// User provisioning
// ---------------------------------------------------------------------

/**
 * Creates a Firebase Auth user + their /users/{uid} profile document.
 *
 * Why this has to be a Cloud Function: calling
 * createUserWithEmailAndPassword from the client SDK while an admin is
 * already signed in would sign the admin OUT and sign in AS the new
 * user (there is only one active session per client Auth instance).
 * The Admin SDK has no such limitation, so user creation is server-side.
 */
exports.createUserAccount = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');

  const callerProfile = await db.collection('users').doc(callerUid).get();
  if (!callerProfile.exists || callerProfile.data().role !== 'admin') {
    throw new HttpsError('permission-denied', 'Solo un administrador puede crear usuarios.');
  }

  const { displayName, email, password, role } = request.data || {};
  if (!displayName || !email || !password || !role) {
    throw new HttpsError('invalid-argument', 'Faltan campos requeridos.');
  }
  if (password.length < 6) {
    throw new HttpsError('invalid-argument', 'La contraseña debe tener al menos 6 caracteres.');
  }

  const userRecord = await admin.auth().createUser({ email, password, displayName });

  await db.collection('users').doc(userRecord.uid).set({
    displayName,
    email,
    role,
    active: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return { uid: userRecord.uid };
});

// ---------------------------------------------------------------------
// Dashboard aggregate counters (optional scalability upgrade path)
// ---------------------------------------------------------------------

/**
 * Keeps counters/dashboardAggregates in sync with service order status
 * changes. NOT read by the app today (dashboard.module.js reads the live
 * collections directly, which is simpler and plenty fast at this
 * business's scale) — wire it in only if/when the order volume grows
 * large enough that client-side aggregation becomes slow. At that point,
 * swap dashboard.service.js's subscription for a single onSnapshot on
 * this one document.
 */
exports.onServiceOrderStatusChange = onDocumentUpdated('serviceOrders/{orderId}', async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  if (before.status === after.status) return;

  const counterRef = db.collection('counters').doc('dashboardAggregates');
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    const counts = snap.exists ? snap.data() : {};
    counts[before.status] = Math.max(0, (counts[before.status] || 0) - 1);
    counts[after.status] = (counts[after.status] || 0) + 1;
    tx.set(counterRef, counts, { merge: true });
  });

  // TODO: notify the client via WhatsApp/email when status reaches
  // "listo" or "entregado" once a messaging provider (e.g. Twilio,
  // Meta WhatsApp Cloud API, SendGrid) is configured. Keeping this as a
  // clearly-marked extension point rather than guessing credentials.
});

// ---------------------------------------------------------------------
// Scheduled maintenance
// ---------------------------------------------------------------------

/**
 * Daily low-stock sweep. Logs matches today; extend the TODO below once
 * a notification channel is chosen so staff get a proactive heads-up
 * instead of only seeing the in-app alert banner on inventory.module.js.
 */
exports.scheduledLowStockCheck = onSchedule('every day 08:00', async () => {
  const snapshot = await db.collection('inventory').get();
  const lowStock = snapshot.docs
    .map((doc) => doc.data())
    .filter((item) => Number(item.stock) <= Number(item.minStock ?? 0));

  if (lowStock.length === 0) return;

  console.log(`[scheduledLowStockCheck] ${lowStock.length} item(s) below minimum stock:`,
    lowStock.map((i) => `${i.name} (${i.stock}/${i.minStock})`).join(', '));

  // TODO: send an email/WhatsApp digest to the shop owner here.
});

/**
 * Placeholder for a programmatic Firestore export. Firebase's own
 * console (Firestore -> Backups) offers one-click scheduled backups with
 * point-in-time recovery and is the recommended default — enable it
 * there before reaching for this function. This stub exists for teams
 * that need custom export logic (e.g. exporting to a specific bucket
 * with a retention script) beyond what the console backup feature does.
 */
exports.scheduledFirestoreExport = onSchedule('every 24 hours', async () => {
  const projectId = process.env.GCLOUD_PROJECT;
  const bucket = `gs://${projectId}-firestore-backups`; // create this bucket before enabling

  console.log(`[scheduledFirestoreExport] Skipped — configure "${bucket}" and uncomment the export call below.`);

  // const client = new (require('@google-cloud/firestore').v1.FirestoreAdminClient)();
  // const databaseName = client.databasePath(projectId, '(default)');
  // await client.exportDocuments({ name: databaseName, outputUriPrefix: bucket, collectionIds: [] });
});
