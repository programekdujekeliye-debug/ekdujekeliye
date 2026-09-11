# Ek Duje Ke Liye — Codebase and Feature Analysis

**Audit date:** 11 September 2026  
**Purpose:** Evidence-based description of the repository as it exists before new development.  
**Companion documents:** `PROJECT_RULEBOOK.md`, `ANTIGRAVITY.md`, and `docs/CODEBASE_FILE_INVENTORY.md`.

## 1. Audit scope and method

This analysis covers the complete application-owned code surface. A generated inventory indexes every `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`, `.css`, `.gs`, and `.ps1` file while excluding dependencies, build output, backups, CSV exports, and binary media.

| Area | Files | Lines |
|---|---:|---:|
| Frontend routes, features, components, services, shared code, tooling | 112 | 34,722 |
| Backend platform, modules, services, models, integrations, workers, jobs, tests, tooling | 345 | 44,121 |
| Repository and Google Apps scripts | 3 | 1,592 |
| **Audited code total** | **460** | **80,435** |

The 237 files in `backend/scripts/` are operational scripts, not the normal request path. They were indexed because they can affect production data. The production architecture was analyzed from current entry points, route mounts, controllers, services, schemas, frontend feature composition, API clients, tests, and configuration—not inferred only from filenames or older documents.

## 2. Product summary

Ek Duje Ke Liye is a multi-event operations platform for couples seminars. It combines:

- public event discovery and event-specific registration;
- early-registration and normal paid-registration modes;
- Razorpay checkout and payment verification;
- personalized invitation cards and QR passes;
- online and offline gate attendance scanning;
- normal and VIP registration management;
- automated WhatsApp lifecycle communication;
- a two-way WhatsApp support inbox and broadcast center;
- feedback, testimonials, finance, exports, media, archive, backup, resource, and integration administration.

The core business boundary is the **event slot**. Public pages, registrations, payments, passes, attendance, communications, exports, feedback, VIP links, media, and reporting must all resolve to the same canonical event.

## 3. Technology and runtime architecture

### Frontend

- Next.js 16.2.11 App Router
- React 19.2.4
- TypeScript 5
- Tailwind CSS 4 plus `frontend/src/app/globals.css`
- `react-hot-toast` for transient notifications
- browser Canvas, QR generation/decoding, JSZip, local IndexedDB/storage, and Web Crypto for passes, exports, and offline scanning

The frontend primarily renders client components and calls the backend through `NEXT_PUBLIC_API_URL`. `next.config.ts` rewrites `/api/*` to the local backend in development and to the configured API origin in production.

### Backend

- Node.js ES modules
- Express 4.19
- Mongoose 9.8 and MongoDB Atlas
- Razorpay integration
- Meta WhatsApp Cloud API
- Cloudflare R2 for current media, with legacy Cloudinary reads and Google Drive historical archive
- Sharp/Jimp for image work; Tesseract and QR tooling where needed
- in-process one-minute communication worker and optional/guarded scheduled backup operations

The server is deliberately constrained for a roughly 512 MB Render environment: Sharp uses low memory and concurrency, Mongo has a small connection pool, worker batches are bounded, and large media should not be proxied unnecessarily.

### Entry and request path

```text
backend/index.js
  -> backend/src/server.js
      -> environment validation
      -> MongoDB connection
      -> early-event initialization
      -> backup initialization
      -> 60-second communication/payment-reminder loop
      -> backend/src/app.js (Express routes and middleware)
```

```text
frontend/src/app/**/page.tsx
  -> feature/page component
  -> frontend service or direct public fetch
  -> Express route
  -> controller
  -> domain service/integration
  -> Mongoose model / external provider
```

## 4. Access surfaces

### Public application routes

| Route | Responsibility |
|---|---|
| `/` | Landing page, live event discovery, testimonials, brand content |
| `/event/[slug]` | Event detail, registration form, payment handoff |
| `/payment/[inquiryId]` | Resume/check Razorpay payment |
| `/pass/[inquiryId]` | Public pass view and QR presentation |
| `/invitation/[inquiryId]` | Personalized invitation rendering and photo adjustment |
| `/gallery/[inquiryId]` | Couple/event gallery access |
| `/feedback/[token]` | Token-based feedback form |
| `/vip-entry` and `/vip` | VIP link validation and VIP registration |
| `/contact` and legal/policy routes | Support and compliance information |

### Administrative routes

| Route | Responsibility |
|---|---|
| `/admin` | Event operations for admin users |
| `/super-admin` | Global, finance, storage, broadcast, resource, and integration operations |
| `/admin/scanner` | Direct scanner entry |
| `/admin/vip` and `/admin/vip-passes` | VIP operations aliases |

Normal-admin sections are Overview, Gate Scanner, Event Slots, Registrations, VIP Passes, WhatsApp Center, Support Inbox, and Settings. Super-admin adds Finance & Revenue, Couples Feedback, Storage & Archive, Broadcast Campaigns, System Resources, and Integrations.

## 5. Feature inventory by size

“Big,” “medium,” and “micro” indicate change impact, not business importance.

**Count identified in this audit:** 12 big features, 34 medium features, and 35 micro features/behaviors — 81 documented feature surfaces in total. Micro behaviors are grouped when they are inseparable parts of one control or state machine; this is a functional count, not a count of buttons or lines of code.

### 5.1 Big features (12)

1. **Event-slot platform** — creates and edits events; controls date, time, venue, capacity, price, publication, registration, payment, communication, invitation, template, and archive behavior.
2. **Public registration lifecycle** — validates event eligibility and capacity, prevents per-event duplicates, uploads/resizes photos, creates secure customer tokens and event-prefixed inquiry IDs, and chooses early or paid flow.
3. **Payments and financial truth** — creates Razorpay orders, verifies signatures/webhooks, writes embedded and ledger payment state, approves paid registrations, and exposes finance summaries.
4. **Pass and invitation lifecycle** — issues unique passes, signs QR payloads, renders event-branded invitation images, supports image adjustment, and reuses cached cards through version/hash checks.
5. **Gate scanner** — online verification, offline event preparation, encrypted local roster, QR scan, manual attendance, conflict-aware synchronization, and scanner statistics/reset.
6. **Admin registration operations** — search/filter/paginate, edit, approve/reject, attendance, event transfer, duplicate resolution, soft delete, restore, permanent purge, bulk action, and export state.
7. **VIP program** — controlled VIP links, quotas/status, link sharing, VIP intake, sponsor/category metadata, free/manual pass generation, attendance, editing, and export.
8. **WhatsApp lifecycle engine** — consent-aware scheduling, idempotent job records, Meta template validation, atomic worker claiming, status webhooks, retries, event changes/cancellations, and event dashboard.
9. **WhatsApp support and campaigns** — conversation list, thread, free-text service-window replies, template replies, assignment, notes, unread state, phone lookup, audience preview, broadcasts, logs, and test simulation.
10. **Media/storage lifecycle** — direct/private R2 upload, WebP presets, signed view access, legacy Cloudinary fallback, Google Drive archive, verification, thumbnail preservation, and guarded cleanup.
11. **Archive and backup operations** — event archive queue/state machine, external worker claims, checksum/verification, pause/resume/retry, database snapshots, manifests, and Drive synchronization.
12. **Administration intelligence** — event/global dashboards, finance, feedback/testimonials, database/resource telemetry, integration health, notifications, settings, and exports.

### 5.2 Medium features (34)

- homepage event ordering and featured-event logic;
- Date TBA handling and nearest-upcoming event selection in Asia/Kolkata;
- internal versus external registration destinations;
- early registration acknowledgment and later payment enablement;
- payment reminder at 10 minutes and 24 hours for unpaid registrations;
- event capacity using approved/captured/manual and recent pending registrations;
- per-event inquiry counter and `EKnn-*` identity generation;
- phone and couple-name duplicate detection;
- customer status lookup through current or previous inquiry ID;
- registration event transfer, new identity, history, and notification handling;
- current event pass/card template preference over stale registration data;
- card template upload and photo crop/zoom/rotation alignment;
- frame review, batch marking, PDF/ZIP/CSV generation;
- public and private media resolution by preset;
- VIP link activation, usage, limits, expiration, and program scope;
- QR public-key distribution and signed token verification;
- first-scan ownership, repeat-scan detection, offline conflict handling;
- event communication dashboard and per-person timeline;
- 48-hour pass reminder;
- 24-hour personalized invitation;
- late invitation catch-up when payment occurs 2–24 hours before event;
- post-event memories/feedback at midnight IST after the event;
- gallery-ready and event-specific manual broadcasts;
- event-details-updated and event-cancelled communication reconciliation;
- template registry, parameter validation, preview, Meta status synchronization;
- two-way conversation linking to registrations and event slots;
- 24-hour customer-service-window enforcement for free-text WhatsApp replies;
- operational versus marketing WhatsApp consent;
- feedback token, rating, comment, testimonial permission, admin export/reset/delete;
- financial summary by event and global scope;
- public settings and super-admin settings mutation;
- system resource and vendor integration status;
- archive candidates, queueing, claims, leases, verification, cleanup preflight;
- daily/weekly/monthly backup records and Drive sync status.

### 5.3 Micro features and behavioral details (35)

- Gujarati and English validation/error copy;
- brand/support/social values loaded from global settings with fallbacks;
- light-only color scheme and iOS dynamic viewport fixes;
- iOS 16 px form-control font to prevent focus zoom;
- safe-area, touch scrolling, hidden scrollbar, backdrop-filter fallbacks;
- rose/gold/maroon brand tokens and ambient/gradient utilities;
- reusable icon suite;
- reusable searchable `LuxurySelect` with badges and sublabels;
- event selector grouping into Global, Upcoming, Date TBA, and Completed;
- event selector persistence in session storage;
- URL query aliases for initial admin section;
- responsive sidebar drawer and scroll lock;
- admin versus super-admin visual identity;
- toast success/error/loading variants and duration policy;
- API GET in-flight de-duplication and 15-second memory cache;
- cache invalidation after any mutation;
- public cache busting on event/home reads;
- CORS production allowlist and webhook/raw-body exceptions;
- request IDs, structured duration logs, central error JSON;
- startup refusal for wrong database or Razorpay mode;
- secret masking and Indian phone normalization;
- image upload memory limits and WebP thumb/normal/large variants;
- private media signed access and historical preview/download;
- attendance values that include `present`, `absent`, and `unmarked` despite legacy mixed storage;
- soft-delete timestamps and trash restore;
- frame export `NOT_EXPORTED`, `EXPORTED`, and `MODIFIED` states;
- WhatsApp `QUEUED`, `SENDING`, delivery/read/failure, blocked, expired, and cancelled states;
- worker stale-lease recovery and atomic claim;
- Meta throttling/spam-protection pacing;
- phone masking/hashing in messaging records;
- automatic conversation unread clearing when staff views a thread;
- event archive progress counters and last-worker timestamp;
- upload-session TTL expiration;
- immutable-ish audit records and provider webhook idempotency records;
- graceful server shutdown and memory telemetry.

## 6. Canonical domain model

### Event (`program` collection)

An event owns its identity (`id`, `sequenceNumber`, `slug`), content, location, price/currency, capacity, date/time, publication status, registration/payment/communication switches, visual pass configuration, contact/SEO fields, and archive state. Canonical event statuses are:

`upcoming`, `few_seats`, `housefull`, `registration_closed`, `completed`, `archived`, `date_tba`, `cancelled`.

Important distinction: status labels and boolean gates overlap. A safe eligibility decision must consider `status`, `isRegistrationOpen`, `isInquiryClosed`, event start time, capacity, `isPaymentEnabled`, `communicationsEnabled`, and `earlyRegistrationMode`.

### Registration (`submission` collection)

A registration is the couple record and central join point. It contains event snapshot fields, names/phone, WhatsApp consent, photo/media references, status, VIP metadata, embedded payment snapshot, attendance, deletion state, photo alignment, export state, reminders, invitation cache/version, previous identity and transfer history.

Canonical registration status: `inquiry`, `pending`, `approved`, `rejected`.

### Payment (`payments` plus registration.payment)

`payments` is the transaction ledger; `registration.payment` is the operational snapshot used by the registration experience. Gateway verification must keep them consistent and remain idempotent.

Ledger statuses: `created`, `authorized`, `captured`, `failed`, `refunded`.  
Embedded statuses: `created`, `pending`, `captured`, `failed`, `refunded`.

### Pass and scans

Passes are unique per event/registration, have signed QR identity, version, key ID, scan counters, and status: `ACTIVE`, `USED`, `REVOKED`, `CANCELLED`. Scan records preserve mode (`ONLINE` or `OFFLINE_SYNC`), device/local identity, result, and timestamps.

### WhatsApp

`WhatsappMessage` is both the outbox/job record and delivery timeline. Idempotency key is unique. Messages carry event, registration, payment/pass, consent-relevant classification, template, trigger, execution source, provider mode, scheduled time, attempts, lease, and provider status.

`WhatsappConversation` is the support-inbox aggregate with phone identity, registration/event link, open/closed state, unread count, assignment, service window, preview, and notes.

### Storage and archive

Current registrations can point to R2 variants and legacy Cloudinary fallbacks. `MediaArchive` tracks the long-running copy/verification/cleanup state. Google Drive is historical storage, not the normal active-media serving layer.

## 7. Critical end-to-end flows

### 7.1 Normal paid registration

1. Resolve canonical event by ID/slug/date compatibility.
2. Reject missing/closed/started/full event.
3. Normalize the phone and enforce one phone per event.
4. Detect the same couple; update a pending record rather than multiplying it where applicable.
5. Atomically obtain the event-specific inquiry sequence and create `EKnn-*` identity.
6. Transform the couple photo and upload private media variants.
7. Save a pending Razorpay registration with a customer token.
8. Frontend starts Razorpay checkout.
9. Backend creates the order using server-side event price.
10. Checkout signature and/or webhook is verified from raw authoritative data.
11. Payment ledger and registration snapshot become captured; registration becomes approved.
12. Pass is ensured; confirmation and lifecycle communications are queued idempotently.

### 7.2 Early registration to payment-open transition

1. Event has payment disabled, early mode enabled, or communications disabled.
2. Registration is saved pending without forcing checkout.
3. One operational “registration received” template may be sent.
4. Admin previews enabling payment and affected recipients.
5. Enabling payment turns off early mode, records opening metadata, and queues payment-open messages/reminders.
6. Existing early registrations retain identity and move through normal captured/approved/pass lifecycle after payment.

### 7.3 Communication schedule

- Unpaid normal registrations: reminder jobs at roughly +10 minutes and +24 hours, guarded by captured/approved state and idempotency.
- Approved registrations more than 48 hours before the event: 48-hour pass reminder is queued.
- Personalized invitation: T−24 hours.
- Payment between T−24h and T−2h: invitation catch-up after a default 10-minute cooldown.
- Payment less than two hours before start: personalized invitation is skipped to avoid noise.
- Post-event combined memories/feedback: midnight IST on the day following the event.
- Event detail changes: applicable pending jobs are reconciled/rescheduled.
- Cancellation: future messages are cancelled and a cancellation communication can be queued.

### 7.4 Event transfer

A transfer is not a simple `programId` edit. It must validate the target event, obtain the target event sequence, create a new inquiry identity where required, preserve `previousInquiryId` and `transferHistory`, invalidate/rebuild event-branded assets, reconcile passes/communications, and notify according to the target event state.

### 7.5 Offline scanner

The scanner downloads a scoped roster/public-key package, stores it locally with offline security controls, verifies signed QR data, records local scan identity, works without network, and later synchronizes. Server sync remains authoritative and must detect duplicate/replayed/conflicting scans.

### 7.6 Archive

An event is selected, assets are queued, an authenticated worker atomically claims bounded batches, external storage copies assets, the worker reports verification/failure, progress rolls up to the event, and original cleanup is permitted only after preflight and verified durable copies. Pause/resume/retry never bypass verification.

## 8. Design system as implemented

The visual language is a warm luxury-event interface:

- page background `#FAF9F6`;
- primary brand rose `#BE123C` and maroon `#881337`;
- accent gold `#D97706`;
- slate/stones for admin content and borders;
- white cards, subtle tinted surfaces, 12–16 px radii, thin borders, restrained shadows;
- bold compact admin typography; larger editorial public typography;
- rose identity for normal operations and purple identity for super admin;
- emerald success, amber warning, red/rose destructive/error, sky informational.

The project currently has three select patterns: browser `<select>` styled globally, `LuxurySelect`, and the specialized `EventSelectorDropdown`. This is functional but risks drift. New work should use `LuxurySelect` for ordinary choices and reserve `EventSelectorDropdown` for the global event workspace.

Toast behavior is centralized visually, but call sites still decide copy and may use native `confirm`. New rules should standardize feedback and destructive confirmation behavior.

## 9. Change-coupling map

| If this changes | Also inspect/update |
|---|---|
| Event field/status/mode | Event model, service/controller, frontend type, Events UI, event selector/default logic, public home/event page, registration eligibility, WhatsApp scheduler/dashboard, tests |
| Event date/time | All scheduled messages, invitation cache/hash, scanner package, public pages, exports, dashboard labels, archive eligibility |
| Event price/currency | Event model/UI, public config, order creation, embedded payment, ledger, finance, receipt/message templates, tests |
| Inquiry ID format | Counter, registration creation/transfer, pass, public lookup routes, exports, WhatsApp keys, scripts, scanner, tests |
| Registration status | Capacity counts, payment flow, pass eligibility, communications, admin filters, feedback/scanner eligibility, dashboards |
| Payment status/provider | Payment service/webhook, registration snapshot, finance, pass issuance, reminders, UI status, idempotency tests |
| Pass or QR payload | Pass model/service/controller, public key, scanner online/offline logic, local DB/crypto, migration and phase-B/C tests |
| WhatsApp template | Registry definition, exact Meta name/language/category, variables, scheduler/controller, preview UI, dashboard labels, tests |
| WhatsApp status | Model enum, worker transitions, webhook mapping, dashboard/timeline/inbox, retry policy, tests |
| Media path/preset | Backend and frontend media preset maps, uploader, private resolver, card renderer, exports, archive, migrations, security tests |
| Admin section | Admin section type, navigation constants, icon map, app switch, direct route/query aliases, access role |
| API endpoint | Route file, app mount/legacy alias decision, controller/service, frontend API service, callers, auth, tests, documentation |
| Schema/index | Model, explicit index migration/sync, affected queries/sorts, backups/restores, test fixtures, operations scripts |
| Event transfer | Registration, counter, pass, invitation, WhatsApp, media/card identity, audit/history, source/target capacity |

## 10. Risks and technical debt observed

1. **Oversized production files.** Several controllers/pages exceed 1,300 lines; WhatsApp controller exceeds 2,600. This raises regression and merge risk.
2. **Documentation drift.** Earlier architecture/schema documents omit newer R2, VIP, feedback, conversation, invitation, early-mode, and archive fields. Current models are authoritative.
3. **Route alias multiplication.** `app.js` deliberately mounts multiple legacy paths. New endpoints should get one canonical path and aliases only for proven compatibility needs.
4. **Status and mode overlap.** Event eligibility is represented by status plus several booleans. Central policy helpers are needed to avoid contradictory UI/backend decisions.
5. **Mixed identifiers.** Some lookups accept ID, slug, date, Mongo `_id`, current inquiry ID, or previous inquiry ID. Compatibility is useful but new writes must use canonical IDs.
6. **Auth is password-token based.** Admin credentials can be read from browser storage and query tokens are accepted. Do not expand this pattern; a future hardened session migration is advisable.
7. **Public environment diagnostic.** `/api/system/environment` exposes mode/database-name metadata without auth. Treat as a hardening candidate.
8. **Public route auth review.** Some event listing aliases are intentionally public while admin-looking mounts reuse the same router. Every new route must explicitly declare its access class.
9. **Test command gap.** The repository contains 18 backend test files, but the default `npm test` chain runs only a subset. High-risk changes must run relevant omitted suites explicitly until the package script is corrected.
10. **Two communication implementations.** `communicationScheduler.service.js` is the active one-minute server path, while `whatsappCommunicationWorker.js` contains overlapping lifecycle logic. Avoid adding a third source of truth.
11. **Design primitives are incomplete.** Select and toast are shared, but modal, confirmation, form field, table, status badge, and empty/error states are repeated.
12. **Operational script volume.** The 237 backend scripts include production audits, mutations, migrations, retries, cleanup, and scratch utilities. They need preflight/dry-run/idempotency conventions and an archive policy.
13. **Configuration examples drift.** The backend example omits some current mode variables and uses an allowed-origin domain inconsistent with current canonical `.in` URLs.
14. **Mongo auto-index is disabled.** Schema index declarations do not create indexes at runtime. Index changes require a reviewed explicit production operation.
15. **In-process scheduling.** A single instance can work with atomic message claims, but multiple instances and restarts demand careful idempotency, leases, and external scheduling strategy.

## 11. Existing verification assets

Backend tests cover Razorpay, webhooks, order creation, event selection, WhatsApp phases, QR signing, scanner, communications, idempotency, worker concurrency/auth, dashboards, early mode, media security/presets, feedback, lifecycle edge cases, normal event mode, and isolated E2E behavior. Frontend has lint/build scripts and an offline-crypto test script.

This is a strong base, but verification must be selected by affected domain rather than assuming `npm test` currently invokes every test file.

## 12. Recommended development order

For any change: start from a user-visible behavior, identify the canonical event/registration/payment/pass/message/storage records involved, trace all readers and writers using the coupling table, change backend contracts first when necessary, update typed frontend services and UI, add migration/compatibility logic only if existing data requires it, run targeted tests plus build/lint, and document new invariants in the rulesbook.
