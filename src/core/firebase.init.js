/**
 * firebase.init.js — DEMO MODE (in-memory mock, no real Firebase project)
 * -----------------------------------------------------------------------
 * THIS FILE IS FOR PREVIEW/TESTING ONLY. It reimplements the same exports
 * as the real firebase.init.js using a plain in-memory JS object instead
 * of Firestore, so the whole app (every module) runs unmodified against
 * fake sample data. When the real Firebase project is ready, this file
 * gets swapped back for the real one — nothing else in the app changes.
 */

const DEBUG = true;

// ---------------------------------------------------------------------
// In-memory "Firestore"
// ---------------------------------------------------------------------

function ts(date) { return { toDate: () => date, __isTimestamp: true }; }
function daysAgo(n) { return ts(new Date(Date.now() - n * 86400000)); }
function daysFromNow(n) { return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10); }

const store = {
  users: {
    'demo-admin': {
      displayName: 'Admin Demo', email: 'demo@autoclimashernandez.com', role: 'admin', active: true,
      createdAt: daysAgo(120), updatedAt: daysAgo(1)
    },
    'demo-tec-1': {
      displayName: 'Ramiro Ortega', email: 'ramiro@autoclimashernandez.com', role: 'tecnico', active: true,
      createdAt: daysAgo(90), updatedAt: daysAgo(90)
    },
    'demo-tec-2': {
      displayName: 'Jesús Salazar', email: 'jesus@autoclimashernandez.com', role: 'tecnico', active: true,
      createdAt: daysAgo(60), updatedAt: daysAgo(60)
    }
  },
  clients: {
    'cli-1': { name: 'Roberto Villarreal', phone: '871 234 5678', whatsapp: '', email: 'roberto.v@gmail.com', address: 'Calle Morelos 220, Torreón', rfc: '', notes: '', internalNotes: '', vehicleCount: 2, createdAt: daysAgo(200), updatedAt: daysAgo(2) },
    'cli-2': { name: 'María Fernanda López', phone: '871 345 6789', whatsapp: '', email: 'mflopez@hotmail.com', address: 'Blvd. Independencia 900', rfc: '', notes: 'Cliente frecuente, flotilla de reparto', internalNotes: '', vehicleCount: 1, createdAt: daysAgo(150), updatedAt: daysAgo(5) },
    'cli-3': { name: 'Transportes González S.A.', phone: '871 456 7890', whatsapp: '871 111 2233', email: 'admin@transportesgonzalez.mx', address: 'Periférico Raúl López Sánchez km 4', rfc: 'TGO850101ABC', notes: '', internalNotes: 'Pagan con 15 días de crédito', vehicleCount: 1, createdAt: daysAgo(300), updatedAt: daysAgo(10) }
  },
  vehicles: {
    'veh-1': { clientId: 'cli-1', brand: 'Nissan', model: 'Sentra', year: 2019, engine: '1.8L', color: 'Blanco', plates: 'ABC-123-A', vin: '3N1AB7AP1KY123456', mileage: 68000, fuelType: 'Gasolina', notes: '', photos: [], createdAt: daysAgo(200) },
    'veh-2': { clientId: 'cli-1', brand: 'Chevrolet', model: 'Aveo', year: 2021, engine: '1.5L', color: 'Gris', plates: 'XYZ-987-B', vin: '', mileage: 24000, fuelType: 'Gasolina', notes: '', photos: [], createdAt: daysAgo(120) },
    'veh-3': { clientId: 'cli-2', brand: 'Toyota', model: 'Hilux', year: 2020, engine: '2.7L', color: 'Rojo', plates: 'RGC-450-C', vin: '', mileage: 91000, fuelType: 'Gasolina', notes: 'Uso de reparto diario', photos: [], createdAt: daysAgo(150) },
    'veh-4': { clientId: 'cli-3', brand: 'Freightliner', model: 'M2 106', year: 2017, engine: 'Diésel 6.7L', color: 'Blanco', plates: 'TG-04521', vin: '', mileage: 210000, fuelType: 'Diésel', notes: 'Unidad de la flotilla #4', photos: [], createdAt: daysAgo(300) }
  },
  serviceOrders: {
    'ord-1': {
      folioNumber: 1042, folioLabel: 'OS-001042', clientId: 'cli-1', clientName: 'Roberto Villarreal', clientPhone: '871 234 5678',
      vehicleId: 'veh-1', vehicleLabel: 'Nissan Sentra 2019', vehiclePlates: 'ABC-123-A', vehicleColor: 'Blanco', mileage: 68000,
      technicianId: 'demo-tec-1', technicianName: 'Ramiro Ortega', estimatedTime: '2 horas', estimatedDelivery: daysFromNow(1),
      diagnosis: 'Fuga de gas en manguera de descarga.', serviceRequested: 'El aire no enfría.', serviceDone: '',
      partsItems: [{ description: 'Manguera de descarga', quantity: 1, unitPrice: 450 }, { description: 'Gas refrigerante R134a', quantity: 2, unitPrice: 280 }],
      laborCost: 500, total: 1510, amountPaid: 500, status: 'en_reparacion',
      photosBefore: [], photosAfter: [], signatureClientUrl: null, signatureTechnicianUrl: null,
      createdAt: daysAgo(1), updatedAt: daysAgo(0)
    },
    'ord-2': {
      folioNumber: 1041, folioLabel: 'OS-001041', clientId: 'cli-2', clientName: 'María Fernanda López', clientPhone: '871 345 6789',
      vehicleId: 'veh-3', vehicleLabel: 'Toyota Hilux 2020', vehiclePlates: 'RGC-450-C', vehicleColor: 'Rojo', mileage: 91000,
      technicianId: 'demo-tec-2', technicianName: 'Jesús Salazar', estimatedTime: '1 hora', estimatedDelivery: daysFromNow(-1),
      diagnosis: 'Compresor dañado.', serviceRequested: 'Ruido al encender el aire.', serviceDone: 'Cambio de compresor y limpieza de sistema.',
      partsItems: [{ description: 'Compresor', quantity: 1, unitPrice: 3200 }, { description: 'Filtro deshidratador', quantity: 1, unitPrice: 180 }],
      laborCost: 800, total: 4180, amountPaid: 4180, status: 'listo',
      photosBefore: [], photosAfter: [], signatureClientUrl: null, signatureTechnicianUrl: null,
      createdAt: daysAgo(3), updatedAt: daysAgo(0)
    },
    'ord-3': {
      folioNumber: 1040, folioLabel: 'OS-001040', clientId: 'cli-3', clientName: 'Transportes González S.A.', clientPhone: '871 456 7890',
      vehicleId: 'veh-4', vehicleLabel: 'Freightliner M2 106 2017', vehiclePlates: 'TG-04521', vehicleColor: 'Blanco', mileage: 210000,
      technicianId: 'demo-tec-1', technicianName: 'Ramiro Ortega', estimatedTime: '3 horas', estimatedDelivery: daysFromNow(-10),
      diagnosis: 'Servicio de mantenimiento programado.', serviceRequested: 'Mantenimiento preventivo de flotilla.', serviceDone: 'Limpieza general, recarga de gas, revisión de bandas.',
      partsItems: [{ description: 'Gas refrigerante R134a', quantity: 3, unitPrice: 280 }],
      laborCost: 600, total: 1440, amountPaid: 1440, status: 'entregado',
      photosBefore: [], photosAfter: [], signatureClientUrl: null, signatureTechnicianUrl: null,
      createdAt: daysAgo(12), updatedAt: daysAgo(10)
    },
    'ord-4': {
      folioNumber: 1039, folioLabel: 'OS-001039', clientId: 'cli-1', clientName: 'Roberto Villarreal', clientPhone: '871 234 5678',
      vehicleId: 'veh-2', vehicleLabel: 'Chevrolet Aveo 2021', vehiclePlates: 'XYZ-987-B', vehicleColor: 'Gris', mileage: 24000,
      technicianId: null, technicianName: null, estimatedTime: '', estimatedDelivery: null,
      diagnosis: '', serviceRequested: 'Revisión por olor extraño al encender el aire.', serviceDone: '',
      partsItems: [], laborCost: 0, total: 0, amountPaid: 0, status: 'recibido',
      photosBefore: [], photosAfter: [], signatureClientUrl: null, signatureTechnicianUrl: null,
      createdAt: daysAgo(0), updatedAt: daysAgo(0)
    }
  },
  serviceCatalog: {
    'svc-1': { name: 'Recarga de gas refrigerante', category: 'clima', defaultPrice: 550 },
    'svc-2': { name: 'Cambio de compresor', category: 'clima', defaultPrice: 3200 },
    'svc-3': { name: 'Cambio de condensador', category: 'clima', defaultPrice: 2100 },
    'svc-4': { name: 'Diagnóstico general', category: 'diagnostico', defaultPrice: 150 },
    'svc-5': { name: 'Mantenimiento preventivo', category: 'mantenimiento', defaultPrice: 600 }
  },
  inventory: {
    'inv-1': { name: 'Gas refrigerante R134a', category: 'gas_refrigerante', sku: 'GAS-134A', unit: 'kg', stock: 3, minStock: 5, cost: 180 },
    'inv-2': { name: 'Compresor universal', category: 'compresor', sku: 'COMP-U1', unit: 'pza', stock: 2, minStock: 2, cost: 2400 },
    'inv-3': { name: 'Filtro deshidratador', category: 'filtro', sku: 'FIL-D1', unit: 'pza', stock: 14, minStock: 4, cost: 90 },
    'inv-4': { name: 'Manguera de descarga universal', category: 'refaccion', sku: 'MNG-D1', unit: 'pza', stock: 1, minStock: 3, cost: 250 }
  },
  quotes: {
    'quo-1': {
      folioNumber: 88, folioLabel: 'COT-000088', clientId: 'cli-2', clientName: 'María Fernanda López', clientPhone: '871 345 6789',
      vehicleId: 'veh-3', vehicleLabel: 'Toyota Hilux 2020',
      items: [{ description: 'Cambio de condensador', quantity: 1, unitPrice: 2100 }, { description: 'Mano de obra', quantity: 1, unitPrice: 500 }],
      taxEnabled: true, subtotal: 2600, tax: 416, total: 3016, signatureUrl: null, createdAt: daysAgo(2)
    }
  },
  payments: {
    'pay-1': { orderId: 'ord-1', orderFolio: 'OS-001042', clientName: 'Roberto Villarreal', amount: 500, method: 'Efectivo', type: 'anticipo', notes: '', createdAt: daysAgo(1) },
    'pay-2': { orderId: 'ord-2', orderFolio: 'OS-001041', clientName: 'María Fernanda López', amount: 4180, method: 'Transferencia', type: 'pago_total', notes: '', createdAt: daysAgo(0) },
    'pay-3': { orderId: 'ord-3', orderFolio: 'OS-001040', clientName: 'Transportes González S.A.', amount: 1440, method: 'Tarjeta', type: 'pago_total', notes: '', createdAt: daysAgo(10) }
  },
  warranties: {
    'war-1': { clientName: 'Transportes González S.A.', vehicleLabel: 'Freightliner M2 106 2017', orderFolio: 'OS-001040', type: 'Refacción', startDate: daysFromNow(-10), expiresAt: daysFromNow(80), notes: '', evidence: [] }
  },
  appointments: {
    'app-1': { title: 'Entrega programada — flotilla González', type: 'entrega', date: daysFromNow(2), time: '12:00', notes: '', status: 'pendiente' },
    'app-2': { title: 'Cita: revisión de aire — Sra. López', type: 'cita', date: daysFromNow(3), time: '10:30', notes: '', status: 'pendiente' }
  },
  auditLog: {
    'aud-1': { entity: 'serviceOrders', entityId: 'ord-1', action: 'create', details: {}, actorUid: 'demo-admin', actorName: 'Admin Demo', actorRole: 'admin', at: daysAgo(1) },
    'aud-2': { entity: 'payments', entityId: 'pay-2', action: 'create', details: {}, actorUid: 'demo-admin', actorName: 'Admin Demo', actorRole: 'admin', at: daysAgo(0) }
  },
  counters: { serviceOrders: { value: 1042 }, quotes: { value: 88 } }
};

let idCounter = 1000;
const genId = (name) => `${name}-demo-${idCounter++}`;

const listeners = {}; // collectionName -> Set(callback)
function notify(name) {
  (listeners[name] || new Set()).forEach((cb) => cb());
}

// ---------------------------------------------------------------------
// Query constraint helpers (mirror the tiny subset of Firestore used)
// ---------------------------------------------------------------------

function applyConstraints(rows, constraints) {
  let result = rows;
  for (const c of constraints) {
    if (c.type === 'where') {
      result = result.filter((r) => r.data[c.field] === c.value);
    } else if (c.type === 'orderBy') {
      const dir = c.dir === 'desc' ? -1 : 1;
      result = [...result].sort((a, b) => {
        const av = a.data[c.field], bv = b.data[c.field];
        const aTime = av?.toDate ? av.toDate().getTime() : (av instanceof Date ? av.getTime() : av);
        const bTime = bv?.toDate ? bv.toDate().getTime() : (bv instanceof Date ? bv.getTime() : bv);
        return aTime > bTime ? dir : aTime < bTime ? -dir : 0;
      });
    } else if (c.type === 'limit') {
      result = result.slice(0, c.n);
    }
  }
  return result;
}

function collectionRows(name) {
  return Object.entries(store[name] || {}).map(([id, data]) => ({ id, data }));
}

// ---------------------------------------------------------------------
// Public API surface (matches the real firebase.init.js)
// ---------------------------------------------------------------------

const app = { name: 'demo' };
const auth = { currentUser: { uid: 'demo-admin', email: 'demo@autoclimashernandez.com' } };
const db = { __demo: true };
const storage = { __demo: true };
const functions = { __demo: true };

function onAuthStateChanged(_auth, callback) {
  queueMicrotask(() => callback(auth.currentUser));
  return () => {};
}
async function signInWithEmailAndPassword() { return { user: auth.currentUser }; }
async function signOut() { location.reload(); }
async function sendPasswordResetEmail() {}
async function updatePassword() {}
class EmailAuthProvider { static credential() { return {}; } }
async function reauthenticateWithCredential() {}

function collection(_db, name) { return { _name: name }; }
function doc(_db, name, id) { return { _name: name, _id: id || genId(name) }; }
function where(field, _op, value) { return { type: 'where', field, value }; }
function orderBy(field, dir = 'asc') { return { type: 'orderBy', field, dir }; }
function limit(n) { return { type: 'limit', n }; }
function startAfter() { return { type: 'startAfter' }; }
function query(collRef, ...constraints) { return { _name: collRef._name, constraints }; }
function serverTimestamp() { return new Date(); }
function increment(n) { return { __increment: n }; }
class Timestamp {
  static now() { return ts(new Date()); }
  static fromDate(date) { return ts(date); }
}

function resolveIncrements(name, id, data) {
  const existing = store[name][id] || {};
  const merged = { ...existing };
  for (const [key, value] of Object.entries(data)) {
    merged[key] = value && typeof value === 'object' && '__increment' in value
      ? (Number(existing[key]) || 0) + value.__increment
      : value;
  }
  return merged;
}

async function getDoc(ref) {
  const data = store[ref._name]?.[ref._id];
  return { exists: () => Boolean(data), id: ref._id, data: () => ({ ...data }) };
}
async function getDocs(q) {
  const rows = applyConstraints(collectionRows(q._name), q.constraints || []);
  return { docs: rows.map((r) => ({ id: r.id, data: () => ({ ...r.data }) })) };
}
async function addDoc(collRef, data) {
  const id = genId(collRef._name);
  store[collRef._name][id] = { ...data };
  notify(collRef._name);
  return { id };
}
async function setDoc(ref, data, options) {
  store[ref._name][ref._id] = options?.merge
    ? resolveIncrements(ref._name, ref._id, data)
    : { ...data };
  notify(ref._name);
}
async function updateDoc(ref, data) {
  store[ref._name][ref._id] = resolveIncrements(ref._name, ref._id, data);
  notify(ref._name);
}
async function deleteDoc(ref) {
  delete store[ref._name][ref._id];
  notify(ref._name);
}

function onSnapshot(q, onNext, _onError) {
  const fire = () => {
    const rows = applyConstraints(collectionRows(q._name), q.constraints || []);
    onNext({ docs: rows.map((r) => ({ id: r.id, data: () => ({ ...r.data }) })) });
  };
  fire();
  listeners[q._name] = listeners[q._name] || new Set();
  listeners[q._name].add(fire);
  return () => listeners[q._name].delete(fire);
}

async function runTransaction(_db, updateFunction) {
  const tx = {
    get: async (ref) => getDoc(ref),
    set: (ref, data, options) => { store[ref._name][ref._id] = options?.merge ? resolveIncrements(ref._name, ref._id, data) : { ...data }; },
    update: (ref, data) => { store[ref._name][ref._id] = resolveIncrements(ref._name, ref._id, data); }
  };
  const result = await updateFunction(tx);
  Object.keys(listeners).forEach(notify);
  return result;
}

function writeBatch() {
  const ops = [];
  return {
    set: (ref, data) => ops.push(() => { store[ref._name][ref._id] = { ...data }; }),
    update: (ref, data) => ops.push(() => { store[ref._name][ref._id] = resolveIncrements(ref._name, ref._id, data); }),
    delete: (ref) => ops.push(() => { delete store[ref._name][ref._id]; }),
    commit: async () => { ops.forEach((op) => op()); Object.keys(listeners).forEach(notify); }
  };
}

// A tiny placeholder image so photo grids/signature previews have something to show.
const PLACEHOLDER_IMAGE = 'data:image/svg+xml;base64,' + btoa(
  '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#cbd5e1"/><text x="50%" y="50%" font-family="sans-serif" font-size="14" fill="#475569" text-anchor="middle" dy=".3em">Foto demo</text></svg>'
);

function ref(_storage, path) { return { path }; }
async function uploadBytes() {}
async function getDownloadURL() { return PLACEHOLDER_IMAGE; }
async function deleteObject() {}

function httpsCallable(_functions, name) {
  return async (payload) => {
    if (name === 'createUserAccount') {
      const id = genId('users');
      store.users[id] = { ...payload, active: true, createdAt: new Date(), updatedAt: new Date() };
      delete store.users[id].password;
      notify('users');
      return { data: { uid: id } };
    }
    return { data: {} };
  };
}

if (DEBUG) console.info('[firebase.init demo] running in DEMO MODE with in-memory sample data — no real backend connected.');

export {
  app, auth, db, storage, functions, httpsCallable,
  onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail,
  updatePassword, EmailAuthProvider, reauthenticateWithCredential,
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, startAfter, onSnapshot, serverTimestamp,
  runTransaction, writeBatch, Timestamp, increment,
  ref, uploadBytes, getDownloadURL, deleteObject
};
