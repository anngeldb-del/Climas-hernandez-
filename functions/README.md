# Cloud Functions — Autoclimas Hernández

Prepared backend functions the admin app calls or can grow into. The app
works fully without deploying these **except** for creating new staff
users from the "Usuarios" screen, which requires `createUserAccount`.

## Setup

```bash
cd functions
npm install
```

## Functions in this folder

| Function | Type | Status |
|---|---|---|
| `createUserAccount` | Callable | Fully implemented — required for the Users screen |
| `onServiceOrderStatusChange` | Firestore trigger | Implemented (aggregate counters); notification TODO |
| `scheduledLowStockCheck` | Scheduled (daily) | Implemented (logs); notification TODO |
| `scheduledFirestoreExport` | Scheduled (daily) | Stub — prefer the Firestore console's built-in Backups feature |

## Deploy

From the project root (not this folder):

```bash
firebase deploy --only functions
```

## Local testing

```bash
npm run serve   # starts the Functions emulator
```

Point the web app at the emulator during development by adding, right
after `initializeApp` in `src/core/firebase.init.js`:

```js
import { connectFunctionsEmulator } from `${CDN}/firebase-functions.js`;
if (DEBUG) connectFunctionsEmulator(functions, 'localhost', 5001);
```
