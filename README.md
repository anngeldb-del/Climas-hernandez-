# Autoclimas Hernández — Sistema de Administración

Aplicación web (PWA) para administrar el taller **Hernández Autoclimas**
— reparación y mantenimiento de clima y calefacción automotriz, Av.
Victoria No. 1439 Ote., Col. Centro, Torreón, Coah. · 871 415 5315.

Construida con HTML5, CSS3 y JavaScript ES2025 puro (módulos nativos,
sin *bundler*), sobre Firebase (Authentication, Firestore, Storage,
Hosting, Cloud Functions). El logotipo e identidad visual fueron
extraídos directamente del formato de orden de servicio oficial del
negocio y se conservan como identidad de la app.

## Índice

- [Arquitectura](#arquitectura)
- [Puesta en marcha](#puesta-en-marcha)
- [Roles y permisos](#roles-y-permisos)
- [Módulos](#módulos)
- [PWA](#pwa)
- [Escalabilidad](#escalabilidad)
- [Seguridad](#seguridad)

## Arquitectura

```
index.html                 Cascarón de la app (login o shell autenticado)
manifest.webmanifest        Metadatos de instalación PWA
service-worker.js           Cache offline (app shell + runtime)
firebase.json / *.rules     Configuración e infraestructura de Firebase
functions/                  Cloud Functions (creación de usuarios, tareas programadas)
styles/                     Design tokens, tema claro/oscuro, layout, componentes
src/
  config/                   Datos del negocio y constantes de dominio (única fuente de verdad)
  core/                     Firebase, autenticación, router, acceso a datos, utilidades
  components/               UI reutilizable (modal, toast, tablas, formularios, firma, fotos…)
  modules/                  Un directorio por módulo de negocio (ver tabla abajo)
```

No hay paso de compilación: el proyecto se sirve tal cual desde
Firebase Hosting. Cada módulo se carga bajo demanda (`import()` dinámico
vía el router en `src/core/router.js`), así que el navegador nunca
descarga código de pantallas que el usuario no visita.

## Puesta en marcha

1. **Crear el proyecto Firebase**: [console.firebase.google.com](https://console.firebase.google.com) →
   crear proyecto → activar **Authentication** (Correo/contraseña),
   **Firestore Database**, **Storage** y **Hosting**.
2. **Configurar credenciales**: copia el objeto `firebaseConfig` de
   *Configuración del proyecto → Tus apps → Web* y pégalo en
   `src/config/firebase.config.js`.
3. **Publicar reglas e índices**:
   ```bash
   npm install -g firebase-tools   # si no lo tienes
   firebase login
   firebase use --add               # selecciona tu proyecto
   firebase deploy --only firestore:rules,firestore:indexes,storage
   ```
4. **Crear el primer usuario administrador** (después de esto, el resto
   de usuarios se crean desde la app en *Usuarios*):
   - Firebase Console → Authentication → *Add user* (correo + contraseña).
   - Firestore → crea manualmente el documento `users/{uid}` (usa el UID
     que Authentication generó) con:
     ```json
     { "displayName": "Tu nombre", "email": "tu@correo.com", "role": "admin", "active": true }
     ```
5. **Desplegar Cloud Functions** (necesario para crear usuarios desde la
   app — ver `functions/README.md`):
   ```bash
   cd functions && npm install && cd ..
   firebase deploy --only functions
   ```
6. **Publicar el sitio**:
   ```bash
   firebase deploy --only hosting
   ```
7. Abre la URL de Hosting, inicia sesión con el usuario administrador
   creado en el paso 4, y desde *Usuarios* crea al resto del equipo
   (recepción, técnicos, auditor).

### Desarrollo local

Sirve la carpeta con cualquier servidor estático (necesitas HTTPS o
`localhost` para que el Service Worker y la cámara funcionen):

```bash
npx serve .
# o
firebase emulators:start --only hosting
```

## Roles y permisos

| Rol | Acceso |
|---|---|
| **Administrador** | Todo el sistema, incluida la gestión de usuarios y la bitácora |
| **Recepción** | Clientes, vehículos, órdenes, cotizaciones, pagos, catálogo, agenda, reportes |
| **Técnico** | Panel, órdenes de servicio (actualizar diagnóstico/estado/fotos), agenda, garantías |
| **Auditor** | Solo lectura: panel, reportes y bitácora de cambios |

El control real de acceso vive en `firestore.rules` / `storage.rules`
(el router y la barra lateral solo ocultan lo que el rol no debería ver
para una mejor experiencia — la seguridad no depende de eso).

## Módulos

Panel principal · Clientes · Vehículos · Órdenes de servicio (folio
consecutivo, estados, fotos antes/después, firmas, impuestos) ·
Catálogo de servicios ·
Cotizaciones (IVA/ISR/descuento editables, PDF con logo, envío por
WhatsApp/correo, QR de confirmación y firma) · Pagos (anticipos, abonos,
saldo) · Garantías · Agenda (entregas, citas, recordatorios) · Reportes
(CSV, Excel, PDF) · Búsqueda global (Ctrl/Cmd+K) · Usuarios y roles ·
Bitácora de cambios (auditoría, solo lectura, no editable) ·
Configuración (datos del negocio, logotipo, tasas de IVA/ISR por
defecto — solo administrador).

**Impuestos y totales**: toda la aritmética de IVA/ISR/descuento vive en
un solo lugar (`src/core/tax.service.js`, funciones `calcularIVA`,
`calcularISR`, `calcularDescuento`, `calcularTotales`) y el control de
formulario correspondiente en `src/components/ui/tax-section.js` —
tanto cotizaciones como órdenes de servicio reutilizan ambos en vez de
tener su propia copia. El IVA es editable (no fijo a 16%) y el ISR es
una retención que se resta del total, no se suma.

## PWA

La app es instalable (botón en la barra superior o el prompt nativo del
navegador) y funciona sin conexión gracias a:

- **Firestore offline persistence** (multi-pestaña) para los datos.
- **Service Worker** con *stale-while-revalidate* para el shell y los
  módulos ya visitados — ver `service-worker.js`.

## Escalabilidad

El panel principal y los reportes agregan datos del lado del cliente
leyendo las colecciones completas — sencillo, correcto y más que
suficiente para el volumen de un taller (cientos/miles de documentos).
Si el negocio crece lo suficiente para que eso se sienta lento, el
camino ya está preparado sin rediseñar nada: activa el disparador
`onServiceOrderStatusChange` en `functions/index.js` (mantiene
`counters/dashboardAggregates` actualizado) y cambia
`dashboard.service.js` para leer ese único documento en vez de las
colecciones completas.

La estructura modular (`src/modules/<nombre>/<nombre>.service.js` +
`.module.js`) permite agregar nuevas secciones (facturación electrónica,
más reportes, integraciones) sin tocar el resto del sistema — solo se
registra la nueva ruta en `src/core/router.js`.

## Seguridad

- Autenticación por correo/contraseña + perfil de rol en Firestore.
- Reglas de Firestore/Storage por rol (ver arriba) — la única fuente de
  verdad para permisos.
- Bitácora de cambios de solo-anexado (`auditLog`): cualquier
  creación/edición/eliminación queda registrada con usuario, rol y hora;
  nadie puede modificarla ni borrarla, ni siquiera un administrador.
- Copias de seguridad: activa *Firestore → Backups* en la consola de
  Firebase (recomendado) o extiende `scheduledFirestoreExport` en
  `functions/index.js` para un flujo de exportación personalizado.
