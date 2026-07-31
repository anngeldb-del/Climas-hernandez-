/**
 * constants.js
 * -----------------------------------------------------------------------
 * Single source of truth for business identity and static domain data.
 * Nothing in this file talks to Firebase or the DOM — it is pure data so
 * every module (UI, PDF export, reports, PWA manifest generation, etc.)
 * can import the same values instead of duplicating strings.
 *
 * IMPORTANT: business data below was taken verbatim from the official
 * service-order paper format supplied by the client. Do not alter it
 * without updating the printed stationery too.
 */

export const BUSINESS = Object.freeze({
  name: 'Hernández Autoclimas',
  shortName: 'Autoclimas Hernández',
  slogan: 'Reparación y Mantenimiento de Clima y Calefacción Automotriz',
  phone: '871 415 5315',
  phoneHref: 'tel:+528714155315',
  whatsappHref: 'https://wa.me/528714155315',
  address: {
    street: 'Av. Victoria No. 1439 Ote.',
    neighborhood: 'Col. Centro',
    city: 'Torreón',
    state: 'Coah.',
    full: 'Av. Victoria No. 1439 Ote., Col. Centro, Torreón, Coah.'
  },
  logo: {
    default: 'assets/logo/logo.png',
    hd: 'assets/logo/logo-hd.png'
  }
});

/** Roles recognized by the security rules and the UI navigation guard. */
export const ROLES = Object.freeze({
  ADMIN: 'admin',
  RECEPCION: 'recepcion',
  TECNICO: 'tecnico',
  AUDITOR: 'auditor'
});

export const ROLE_LABELS = Object.freeze({
  [ROLES.ADMIN]: 'Administrador',
  [ROLES.RECEPCION]: 'Recepción',
  [ROLES.TECNICO]: 'Técnico',
  [ROLES.AUDITOR]: 'Auditor'
});

/**
 * Which roles may reach which modules. Consumed by router.js (client-side
 * gate for UX) AND mirrored in firestore.rules (the real security
 * boundary). Never rely on this map alone for access control.
 */
export const ROLE_PERMISSIONS = Object.freeze({
  [ROLES.ADMIN]: ['*'],
  [ROLES.RECEPCION]: [
    'dashboard', 'clients', 'vehicles', 'service-orders', 'catalog',
    'quotes', 'payments', 'agenda', 'search', 'warranties', 'reports'
  ],
  [ROLES.TECNICO]: ['dashboard', 'service-orders', 'agenda', 'search', 'warranties'],
  [ROLES.AUDITOR]: ['dashboard', 'reports', 'search']
});

/** Service order lifecycle. Order matters — it drives the status stepper UI. */
export const ORDER_STATUS = Object.freeze({
  RECIBIDO: 'recibido',
  DIAGNOSTICO: 'diagnostico',
  ESPERANDO_REFACCIONES: 'esperando_refacciones',
  EN_REPARACION: 'en_reparacion',
  PRUEBAS: 'pruebas',
  LISTO: 'listo',
  ENTREGADO: 'entregado',
  GARANTIA: 'garantia',
  CANCELADO: 'cancelado'
});

export const ORDER_STATUS_META = Object.freeze({
  [ORDER_STATUS.RECIBIDO]: { label: 'Recibido', color: 'info' },
  [ORDER_STATUS.DIAGNOSTICO]: { label: 'Diagnóstico', color: 'info' },
  [ORDER_STATUS.ESPERANDO_REFACCIONES]: { label: 'Esperando refacciones', color: 'warning' },
  [ORDER_STATUS.EN_REPARACION]: { label: 'En reparación', color: 'primary' },
  [ORDER_STATUS.PRUEBAS]: { label: 'Pruebas', color: 'primary' },
  [ORDER_STATUS.LISTO]: { label: 'Listo', color: 'success' },
  [ORDER_STATUS.ENTREGADO]: { label: 'Entregado', color: 'neutral' },
  [ORDER_STATUS.GARANTIA]: { label: 'Garantía', color: 'accent' },
  [ORDER_STATUS.CANCELADO]: { label: 'Cancelado', color: 'danger' }
});

/** Ordered pipeline used by the kanban/stepper view (excludes terminal states). */
export const ORDER_STATUS_FLOW = [
  ORDER_STATUS.RECIBIDO,
  ORDER_STATUS.DIAGNOSTICO,
  ORDER_STATUS.ESPERANDO_REFACCIONES,
  ORDER_STATUS.EN_REPARACION,
  ORDER_STATUS.PRUEBAS,
  ORDER_STATUS.LISTO,
  ORDER_STATUS.ENTREGADO
];

export const FUEL_TYPES = ['Gasolina', 'Diésel', 'Híbrido', 'Eléctrico', 'GLP/GNC'];

/** Seed data for the editable services catalog (first Firestore sync only). */
export const DEFAULT_SERVICE_CATALOG = [
  { name: 'Recarga de gas refrigerante', category: 'clima', defaultPrice: 0 },
  { name: 'Cambio de compresor', category: 'clima', defaultPrice: 0 },
  { name: 'Cambio de condensador', category: 'clima', defaultPrice: 0 },
  { name: 'Cambio de evaporador', category: 'clima', defaultPrice: 0 },
  { name: 'Cambio de mangueras', category: 'clima', defaultPrice: 0 },
  { name: 'Cambio de válvula de expansión', category: 'clima', defaultPrice: 0 },
  { name: 'Cambio de motoventilador', category: 'clima', defaultPrice: 0 },
  { name: 'Limpieza de sistema de clima', category: 'clima', defaultPrice: 0 },
  { name: 'Mantenimiento preventivo', category: 'mantenimiento', defaultPrice: 0 },
  { name: 'Diagnóstico general', category: 'diagnostico', defaultPrice: 0 },
  { name: 'Servicio personalizado', category: 'otro', defaultPrice: 0 }
];

/** Inventory categories used by filters, forms and low-stock alerts. */
export const INVENTORY_CATEGORIES = Object.freeze([
  'refaccion', 'compresor', 'condensador', 'evaporador', 'filtro',
  'gas_refrigerante', 'aceite', 'herramienta', 'otro'
]);

export const INVENTORY_CATEGORY_LABELS = Object.freeze({
  refaccion: 'Refacción',
  compresor: 'Compresor',
  condensador: 'Condensador',
  evaporador: 'Evaporador',
  filtro: 'Filtro',
  gas_refrigerante: 'Gas refrigerante',
  aceite: 'Aceite',
  herramienta: 'Herramienta',
  otro: 'Otro'
});

export const PAYMENT_METHODS = ['Efectivo', 'Tarjeta', 'Transferencia', 'Cheque', 'Otro'];

export const WARRANTY_TYPES = ['Refacción', 'Mano de obra', 'Servicio completo'];

/** Firestore collection names, centralized so a rename touches one file. */
export const COLLECTIONS = Object.freeze({
  CLIENTS: 'clients',
  VEHICLES: 'vehicles',
  SERVICE_ORDERS: 'serviceOrders',
  CATALOG: 'serviceCatalog',
  INVENTORY: 'inventory',
  QUOTES: 'quotes',
  PAYMENTS: 'payments',
  WARRANTIES: 'warranties',
  APPOINTMENTS: 'appointments',
  USERS: 'users',
  AUDIT_LOG: 'auditLog',
  COUNTERS: 'counters'
});
