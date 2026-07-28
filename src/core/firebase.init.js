/**
 * firebase.init.js
 * -----------------------------------------------------------------------
 * Boots the Firebase SDK once and exports the ready-to-use service
 * handles (auth, db, storage) that every other module imports. Using the
 * official CDN ESM builds means zero bundler/build step — this app can be
 * deployed to Firebase Hosting by copying the folder as-is.
 *
 * Version pin: bump SDK_VERSION deliberately (test after bumping) rather
 * than tracking "latest", so a Google-side release never breaks
 * production silently.
 */

const SDK_VERSION = '10.12.2';
const CDN = `https://www.gstatic.com/firebasejs/${SDK_VERSION}`;

// All five SDK chunks are fetched concurrently — awaiting them one at a
// time (the original approach) turns a single round trip into a serial
// waterfall of five, which is brutal on a slow or high-latency connection.
const [
  { initializeApp },
  {
    getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut,
    sendPasswordResetEmail, updatePassword, EmailAuthProvider, reauthenticateWithCredential
  },
  {
    initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
    collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
    query, where, orderBy, limit, startAfter, onSnapshot, serverTimestamp,
    runTransaction, writeBatch, Timestamp, increment
  },
  { getStorage, ref, uploadBytes, getDownloadURL, deleteObject },
  { getFunctions, httpsCallable }
] = await Promise.all([
  import(`${CDN}/firebase-app.js`),
  import(`${CDN}/firebase-auth.js`),
  import(`${CDN}/firebase-firestore.js`),
  import(`${CDN}/firebase-storage.js`),
  import(`${CDN}/firebase-functions.js`)
]);

import { firebaseConfig, DEBUG } from '../config/firebase.config.js';

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

// Offline persistence with multi-tab support: the shop floor tablet and the
// front-desk computer can both stay open without Firestore fighting over a
// single-tab lock.
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

const storage = getStorage(app);
const functions = getFunctions(app, 'us-central1');

if (DEBUG) {
  console.info(`[firebase] initialized (SDK ${SDK_VERSION}) — project: ${firebaseConfig.projectId}`);
}

export {
  app, auth, db, storage, functions, httpsCallable,
  // auth
  onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail,
  updatePassword, EmailAuthProvider, reauthenticateWithCredential,
  // firestore
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, startAfter, onSnapshot, serverTimestamp,
  runTransaction, writeBatch, Timestamp, increment,
  // storage
  ref, uploadBytes, getDownloadURL, deleteObject
};
