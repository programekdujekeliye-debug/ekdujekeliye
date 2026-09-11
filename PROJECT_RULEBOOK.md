# Ek Duje Ke Liye — Project Development Rulesbook

**Applies to:** humans, Antigravity 3.8 Flash High, and any other coding assistant working in this repository.  
**Authority:** current source code and schemas override old prose. This rulesbook defines how new changes must be made.  
**Canonical modular rules:** `rules/README.md` and the domain files it links. This document remains the complete combined reference.  
**Read first:** `AGENTS.md`, `rules/README.md`, and `docs/CODEBASE_ANALYSIS.md`; use `docs/CODEBASE_FILE_INVENTORY.md` to locate every affected file.

## 1. Non-negotiable project laws

### R-001 — Preserve the event boundary

Every registration, payment, pass, scan, WhatsApp message, conversation link, VIP link, feedback record, media asset, export, archive job, and report must be scoped to a canonical event wherever the domain requires it. “All events” is a read/reporting scope, never a stored event ID.

### R-002 — Use canonical IDs for new writes

- Store `Event.id` as the event foreign key.
- Use `Event.slug` for public URLs.
- Use Mongo `_id` only for internal database identity.
- Use `inquiryId` as the public registration/pass identity.
- Date, slug, previous inquiry ID, and legacy prefixes may be accepted for reads only where compatibility is already required.
- Never create a new feature that uses the event date as its primary foreign key.

### R-003 — One authoritative business implementation

Business rules belong in a backend domain service. Controllers translate HTTP; route files declare paths/auth; models declare persistence; integrations speak to providers; workers execute jobs; frontend services call APIs; components display/collect data. Do not duplicate eligibility, pricing, schedule, consent, or state-transition logic in multiple layers.

### R-004 — Server owns money, access, and state

The backend must recalculate price, capacity, payment eligibility, event eligibility, consent, and authorization. Never trust a client-submitted amount, role, status, pass validity, event ownership, media key, schedule time, or provider success.

### R-005 — Production side effects must be idempotent

Payments, webhooks, registration creation, pass issuance, WhatsApp sends, archive claims, backups, attendance sync, and migrations need a stable unique key or atomic conditional write. A retry must converge on the same business outcome rather than duplicate it.

### R-006 — No new hardcoded live business data

Event dates, venues, prices, contact information, WhatsApp recipients, template text, media URLs, capacities, and public brand values must come from Event/Setting/configuration. A code fallback is allowed only for safe startup/display compatibility and must not silently override database truth.

### R-007 — India Standard Time is explicit

Business dates and message milestones use `Asia/Kolkata`. Store instants as UTC dates; display event dates as `DD/MM/YYYY`; retain canonical event date input as `YYYY-MM-DD` or `TBD`. Never compare locale-formatted date strings.

### R-008 — Do not casually break compatibility

Existing public links, inquiry IDs, pass links, webhook URLs, Meta template names, R2 keys, and legacy read aliases may be in the wild. Remove or change them only with a migration, a compatibility window, usage verification, rollback plan, and tests.

### R-009 — Protect constrained runtime resources

Assume a 512 MB backend. Bound queries and batches, stream or redirect large media, use projections/lean reads, avoid loading full collections, limit image concurrency, and never route mass Cloudinary-to-Drive transfers through backend memory.

### R-010 — A change is incomplete without impact verification

Use the change-coupling matrix in the analysis. Update contracts, tests, docs, migrations, and all UI consumers together. “The edited file compiles” is not completion.

## 2. Mandatory workflow for Antigravity or a developer

### Before editing

1. Read this rulesbook and `docs/CODEBASE_ANALYSIS.md`.
2. Read `AGENTS.md` files that apply to the target directory. For frontend Next.js work, read the relevant installed Next.js 16 documentation before assuming framework APIs.
3. Check `git status`; preserve unrelated user changes.
4. Find the target behavior through routes, UI callers, services, models, tests, and scripts using `rg`.
5. State the current behavior, desired behavior, affected domains, data migration need, external side effects, and rollback path.
6. For a risky data/payment/message/archive change, create a dry-run or test path before a live mutation path.

### During editing

1. Make the smallest cohesive change.
2. Keep controllers thin and UI components focused.
3. Reuse typed services and design primitives.
4. Preserve explicit auth, consent, idempotency, and event scope.
5. Add comments only for invariants, compatibility, provider constraints, or non-obvious safety—not to narrate obvious code.
6. Do not opportunistically rewrite unrelated legacy code.

### Before finishing

1. Review the diff for secrets, hardcoded production data, unsafe defaults, and unrelated edits.
2. Run the tests mapped to the affected domain.
3. Run frontend lint/build for frontend or shared-contract changes.
4. For schema/index changes, verify migration and rollback on a test database.
5. For UI changes, test desktop, narrow mobile, long text, loading, empty, error, keyboard, and touch behavior.
6. Report changed files, behavior, tests, known limitations, and any required deployment/config/migration step.

## 3. Architecture and file rules

### Backend layering

```text
*.routes.js       path + HTTP verb + middleware only
*.controller.js   parse/validate HTTP input, call service, map response
*.service.js      business rules, transactions, state transitions
models/*.js       schema, indexes, model-local pure helpers
integrations/*    provider-specific request/response/signature behavior
workers/*         bounded execution/claim/retry orchestration
jobs/*            schedule entry and job discovery
utils/*           stateless cross-domain utilities
```

- A new business rule must not be implemented only in a controller.
- An external API call must not be made directly from an unrelated controller when an integration exists.
- Route files must show auth middleware on every non-public route.
- Return after sending a response.
- Use the central error handler for unexpected failures; preserve stable machine-readable error codes for expected domain failures.

### Frontend layering

```text
src/app/**/page.tsx          route entry/composition
src/features/<domain>/       domain UI and hooks
src/components/              genuinely reusable UI
src/services/admin/          typed endpoint wrappers
src/services/apiClient.ts    cross-cutting HTTP/auth/cache behavior
src/types/                   shared frontend contracts
src/utils/                   pure/reusable client utilities
src/constants/               navigation and true constants
```

- Admin components must not invent raw API URLs when a domain API service exists.
- Public pages may use direct fetch for public endpoints but must share response types and URL configuration.
- Do not copy interfaces into multiple pages; add/update the domain type.
- Route components should become composition shells, not multi-thousand-line implementations.

### Size thresholds

- Prefer component/function bodies under 80 lines.
- Review extraction at 250 lines per component/module.
- Do not add a new responsibility to a file already above 500 lines; extract the relevant cohesive area first unless fixing an emergency defect.
- Controllers over 400 lines should be split by capability without changing routes.
- Never create another 1,000-line component or controller.

### Naming

- React components/types/classes: `PascalCase`.
- Functions, variables, hooks: `camelCase`; hooks begin `use`.
- Constants/enums represented as objects: `UPPER_SNAKE_CASE`.
- Backend feature files: `<domain>.controller.js`, `<domain>.service.js`, `<domain>.routes.js`.
- Boolean names begin `is`, `has`, `can`, `should`, or `was`.
- Date instants end `At`; date-only values end `Date`; counts end `Count`; IDs end `Id` except established `inquiryId/passId`.
- Do not introduce “program,” “event,” and “slot” as three different domain objects. `Event` is the model; “event slot” is user-facing language; legacy “program” remains compatibility vocabulary.

### Imports and exports

- Use ES modules on the backend and current TypeScript module syntax on the frontend.
- Keep imports grouped: platform/vendor, repository absolute/relative domains, types/assets.
- Avoid circular imports across services.
- Export the minimum public surface.
- Do not create barrel exports that hide expensive/circular runtime dependencies.

## 4. Event and global-scope rules

### Canonical selection

- `selectedProgramId` stores a canonical event ID or the UI-only value `all`.
- On load, preserve a valid explicit event choice; otherwise choose the nearest operational future event in IST, then active Date TBA, then most recent eligible event.
- Normal admin must never see or mutate events outside assigned scope if role scoping is introduced/enforced.
- A screen requiring one event must reject `all` with a clear event-selection message.
- A screen supporting `all` must make aggregation explicit and must not issue unbounded list queries.

### Event state

- Use only model-declared statuses.
- Derive effective capabilities through centralized helpers such as `canRegister`, `canPay`, `canSendLifecycle`, `canScan`, and `canArchive`; do not scatter boolean combinations.
- Date TBA events cannot schedule date-based communications.
- Cancelled/completed/archived events cannot accept public registration or future lifecycle sends.
- `housefull` must derive from capacity truth or an explicit approved override; do not decrement counters client-side.

### Changing date, time, venue, or cancellation

Any change must:

1. update the event;
2. invalidate affected cached invitation/card output;
3. reconcile queued 48h/24h/post-event messages;
4. update scanner package freshness/version if downloaded data changes;
5. update public/admin presentation;
6. create audit information where available;
7. notify only eligible/consented recipients with idempotent keys.

### Enabling payment after early registration

- Require preview: event, price, recipient count, already-paid/ineligible count, and planned messages.
- Perform a guarded transition, not repeated toggles.
- Set `isPaymentEnabled=true`, `earlyRegistrationMode=false`, and the related communication state consistently.
- Record `paymentOpenedAt` and note/source.
- Queue at most one payment-opening message per eligible registration.
- Never modify already captured payments.

## 5. Registration rules

### Input

- Require event, husband name, wife name, surname, valid Indian phone, and photo where the active flow requires it.
- Trim names; preserve human spelling; never silently transliterate.
- Normalize phone to one canonical comparison form, but format only at display boundaries.
- Validate MIME type, decoded image, pixel/byte limits, and orientation; file extension alone is insufficient.
- Capture operational WhatsApp consent explicitly; marketing consent must be separate and opt-in.

### Duplicate and concurrency behavior

- One active phone per event.
- Same normalized couple identity per event is a second duplicate signal.
- Rejected/deleted records must follow explicit reuse policy.
- Frontend double-click prevention is helpful but not authoritative.
- Backend must use atomic counters/unique indexes and handle duplicate-key retries.
- In-memory locks are only process-local optimization, never the sole correctness guarantee.

### Capacity

- Capacity is calculated on the server within the target event.
- Preserve the current rule for captured, approved, manual/admin-direct, and recent pending registrations until deliberately migrated.
- Abandoned pending checkout reservations expire from capacity consideration after the defined window.
- A transfer validates target capacity and does not corrupt source counts.

### Status transitions

- `pending/inquiry -> approved` only through verified payment, authorized manual/VIP path, or explicit admin action.
- Rejection must preserve reason and must cancel/invalidate future operational work where applicable.
- Soft delete is the default admin delete; permanent delete is an exceptional, explicitly confirmed operation.
- Restore must recheck collisions and dependent-state consistency.
- Do not silently rewrite payment status when editing names, phone, photo, or event.

### Transfer

- Use a service-level transfer operation.
- Preserve prior inquiry identity and append transfer history.
- Regenerate target-event pass/invitation identity as required.
- Cancel/reconcile source-event queued communications and schedule target-event ones.
- Re-evaluate price/payment difference through an explicit policy; never guess.
- Keep transfer notification idempotent.

## 6. Payment and finance rules

- Amount and currency come from the authoritative event on the server.
- Store money as integer minor units during provider calls/calculation; convert to displayed INR at the boundary.
- Never log secrets, signatures, full provider payloads containing sensitive data, or unnecessary customer data.
- Checkout verification requires HMAC/signature validation.
- Webhook verification requires the exact raw request bytes and provider signature.
- Store provider event ID/idempotency record before or atomically with processing.
- A repeated captured event must not issue a second pass or message.
- Update the payment ledger and registration snapshot in one transaction where supported, or with compensating reconciliation.
- Refund status must not imply the registration/pass policy automatically; implement and test the business decision explicitly.
- Finance endpoints and UI are super-admin only.
- CSV exports must protect against spreadsheet formula injection by prefixing cells beginning `=`, `+`, `-`, or `@`.
- Never use production Razorpay keys in non-production; startup guards must remain fail-closed.

## 7. Pass, invitation, and scanner rules

### Pass and QR

- Pass identity is unique per event/registration.
- QR payloads are signed; never trust decoded JSON without signature verification.
- Maintain key IDs and version fields for rotation/migration.
- Do not expose private signing keys to the client; only public verification material may be downloaded.
- Revoked/cancelled passes must fail both online and offline after roster refresh/sync policy is applied.

### Invitation cards

- The current event template is authoritative over stale registration template data.
- Card cache keys/hashes include every visual dependency: event template/version, event details, names, photo/media identity, crop, zoom, offset, rotation.
- Changing any dependency invalidates or versions the rendered card.
- Generate bounded image sizes; do not keep full-resolution buffers longer than required.
- Use the sample image only as a visible fallback, never as proof of a successful upload.

### Scanner

- Scanner always requires a specific event.
- Offline packages are event scoped, versioned, encrypted/authenticated, and time stamped.
- Preserve a unique `(deviceId, scanLocalId)` to make sync idempotent.
- Server is authoritative for first scan, duplicate scan, wrong event, revoked pass, and attendance.
- UI must show distinct success, already scanned, wrong event, invalid signature, revoked, offline queued, and sync conflict states.
- Reset attendance is destructive and requires role protection, event scope, typed confirmation, and audit evidence.

## 8. WhatsApp Center, automatic messages, and inbox rules

### Consent

- Operational messages require operational consent under the model helper and stop after explicit opt-out.
- Marketing messages require `whatsappMarketingOptIn === true`; legacy/undefined is never marketing consent.
- STOP/opt-out webhook handling overrides prior consent and pending marketing sends.
- Store consent source and timestamp; do not infer marketing consent from registration submission.

### Template registry

- `backend/src/integrations/whatsapp/templateRegistry.js` is the code registry for template keys and variables.
- Meta template name, language, header type, category, and variable order must exactly match Meta approval.
- UI preview and backend dispatch must consume the same registry contract.
- A pending/rejected/missing template blocks the job with an explicit status; it must not silently fall back to a different marketing/free-text message.
- Never edit a live template contract without supporting old queued jobs or migrating/cancelling them.

### Lifecycle schedule

- Parse event time in IST.
- Do not schedule date milestones for `TBD`.
- Do not schedule for completed, archived, cancelled, or explicitly excluded legacy events.
- Queue 48-hour reminder only while its future window exists.
- Queue 24-hour personalized invitation; if payment is late but at least two hours remain, use the configured cooldown catch-up.
- Skip invitation within two hours of event start unless an authorized manual action explicitly overrides policy.
- Queue post-event combined memories/feedback once at next-day midnight IST.
- Payment reminder jobs must re-check unpaid/eligible state immediately before send.

### Job and worker state

- Every logical message has a deterministic idempotency key. `Date.now()` is allowed for a deliberate, user-requested new manual send, not for automatic milestones.
- Claim work atomically from `QUEUED` to `SENDING`.
- Use bounded batches, scheduled ordering, lease timestamps, stale lease recovery, max attempts, and backoff.
- Re-check registration existence, deletion, payment/status, event state, consent, recipient, and template immediately before provider dispatch.
- Store provider message ID and map webhook status monotonically; a late `sent` event must not downgrade `read`.
- Rate-limit/spam provider errors stop or slow a batch to protect sender health.
- Manual retry creates a traceable relationship/reason and must not erase the failed record.

### Support inbox

- Normalize/hash/mask phone consistently.
- Link a conversation to registration/event when confidently resolved; retain unlinked guests.
- Free-text replies are allowed only inside the Meta customer-service window; outside it require an approved template.
- Mark read and unread counts consistently; viewing a thread may clear unread only after data is loaded successfully.
- Assignment, status, and internal notes are admin metadata and must never be sent to the customer.
- Internal notes need author/time and must remain visually distinct.
- Mobile layout must preserve conversation list, thread, composer, drawer, and back navigation without horizontal overflow.

### Broadcasts

- Preview audience before send: event scope, count, consent type, exclusions, invalid phones, duplicates, template status, and provider mode.
- Marketing broadcasts are super-admin operations and require explicit marketing consent.
- Freeze an audience/campaign snapshot or stable query definition for auditability.
- Launch is a queued batch, not a synchronous loop in an HTTP request.
- Provide progress, sent/delivered/read/failed counts, pause/stop policy, and per-message logs.
- Test mode can send only to configured allowlisted recipients and must be visibly labeled `MOCK`/test.

## 9. Media, upload, storage, and archive rules

### Uploads

- Prefer direct-to-R2 signed upload sessions for large/private media.
- Upload session binds expected owner/event/purpose/content type/size and expires quickly.
- Completion verifies object existence, metadata, and ownership before saving a reference.
- Keep private couple photos/payment proofs private; public CDN is only for explicitly public assets.
- Use opaque keys, not names or phone numbers, in storage paths.
- Create and use shared presets: thumb for lists, normal for detail, large only for print/render.

### Media resolution

- Keep frontend/backend preset naming aligned.
- R2 is the authoritative new-write provider.
- Cloudinary is a read fallback only while legacy data remains and the fallback switch is enabled.
- Google Drive is historical archive; serve previews through protected/signed mechanisms.
- Never expose bucket credentials, raw private keys, or unrestricted permanent private URLs.

### Archive and cleanup

- Valid archive flow: discovered/waiting -> queued -> copying/archiving -> verifying -> archived/completed, with pause/partial/failure branches.
- Claim by atomic lease and scoped batch.
- Verify destination size/checksum/access before marking complete.
- Preserve an operational thumbnail if the admin UI needs one.
- Original deletion requires verified durable archive, cleanup preflight, correct environment, super-admin/worker authority, and an audit trail.
- Cleanup scripts default to dry-run and require explicit production confirmation.
- Never delete payment ledger, event definition, core registration identity, or audit history as routine media cleanup.

### Backup

- Backup contains schema version, timestamp, per-collection payload/count, checksum, compressed archive, and manifest.
- Keep local snapshots only for the retention window; Drive copies must be verified before local purge.
- Restore to test/staging first, compare checksums/counts/referential integrity, then require an explicit production maintenance plan.

## 10. Database rules

- Models in `backend/src/models` are current schema truth.
- Declare timestamps and explicit collection names consistently.
- Every high-cardinality list/filter/sort must have an index plan.
- `autoIndex` and `autoCreate` are disabled; index declarations require an explicit safe sync/migration operation.
- Unique indexes back application invariants such as inquiry ID, payment ID, message idempotency, provider event ID, pass/event registration, and feedback token.
- Use `.lean()` and projections for read-only dashboards/lists.
- Paginate lists; enforce a maximum page size.
- Avoid regex scans on unbounded collections; normalize searchable fields where growth requires it.
- Use `$setOnInsert`/conditional updates for idempotent creation.
- Use transactions for tightly coupled financial/state writes when supported.
- Schema changes require: backward-compatible read, migration/dry run, new write, index step, verification query, rollback/forward-fix, backup impact, and fixture/test update.
- Never run a production mutation script merely because it imports successfully.

## 11. API rules

- Prefer `/api/<plural-resource>` for public/resource APIs, `/api/admin/...` for admin, `/api/super-admin/...` for super admin, and `/api/internal/...` for worker APIs.
- Define one canonical route. Add an alias only for an existing deployed consumer and document it as legacy.
- Route order must put fixed paths such as `/duplicates` before `/:id`.
- Use correct verbs: GET read, POST create/action, PUT full replace, PATCH partial update, DELETE delete.
- Every endpoint declares its access class: public, token-scoped customer, admin, super-admin, cron, archive worker, or backup worker.
- Do not pass admin credentials in new query parameters. Use Authorization headers; customer links use narrow expiring/signed tokens where possible.
- Validate body, params, query, upload metadata, and enum values at the boundary.
- Stable success envelope for new endpoints: `{ success: true, data, meta? }`; stable error envelope: `{ success: false, error, code, details? }`.
- Never return secrets, raw database connection data, internal storage credentials, full provider payloads, or unnecessary PII.
- List endpoints accept explicit event scope, pagination, filters, and safe sort allowlist.
- Webhooks acknowledge according to provider retry semantics only after idempotency capture.

## 12. Frontend design rules

### Visual tokens

- Public background: warm off-white `#FAF9F6`.
- Brand: rose `#BE123C`, maroon `#881337`, gold `#D97706`.
- Admin neutrals: slate; cards white with slate-200 border.
- Normal admin accent: rose. Super admin accent: purple.
- Success emerald, warning amber, info sky, destructive red/rose.
- Use existing Tailwind spacing/radius vocabulary: compact admin controls, `rounded-xl` controls/cards, `rounded-2xl` overlays, restrained `shadow-xs` to `shadow-xl` based on elevation.

### Responsive behavior

- Design mobile first at 320 px; validate common 360/390 widths and desktop.
- No page-level horizontal scroll.
- Interactive targets minimum 40 px admin/44 px public when practical.
- Keep form text at 16 px on mobile to prevent iOS zoom.
- Respect safe areas and dynamic viewport height.
- Tables need an intentional mobile pattern: scroll container, priority columns, or card rows.
- Drawers/modals lock background scroll and remain keyboard/touch usable.

### Dropdowns

- Use `LuxurySelect` for ordinary rich selection.
- Use native `<select>` only when native mobile behavior/accessibility is specifically preferred.
- Use `EventSelectorDropdown` only for the global event workspace selector.
- Every custom dropdown supports: label, placeholder, disabled, selected state, outside click, Escape, keyboard navigation, focus management, ARIA listbox/option semantics, long labels, empty result, search for seven or more choices, and viewport collision/scroll.
- Never add a fourth dropdown design.
- Event options group Upcoming/Active, Date TBA, Completed, and Global only where global scope is valid.

### Notifications and feedback

- Use the shared toast provider.
- Success toast: completed user action, about 3.5 seconds.
- Error toast: action failed, actionable plain-language message, about 5 seconds.
- Loading toast: only for work longer than roughly 500 ms; replace it with success/error using the same toast ID.
- Do not show a success toast before the server confirms success.
- Avoid multiple toasts for one action.
- Inline validation belongs beside the field; page-level load errors belong in an error state; irreversible actions use a confirmation modal, not only a toast.
- Notifications from `/api/notifications` are persistent operational notices, not substitutes for transient toasts.

### Forms

- Label every field; placeholders are examples, not labels.
- Show required/optional state and units.
- Preserve user input on server error.
- Disable submit while pending and prevent duplicate submit.
- Validate client side for speed and server side for authority.
- Show event scope, price, and mode before a registration/payment/admin mutation.
- File inputs show allowed type/size, preview, replace/remove, upload progress, and failure recovery.

### Modal/drawer rules

- One overlay at a time unless a deliberate nested confirmation is unavoidable.
- Include title, context, close button, Escape, backdrop behavior, initial focus, focus trap, and return focus.
- Destructive primary action sits apart and names the object/action.
- Long forms use a drawer on desktop only if mobile behavior remains full-height and usable.

### Loading, empty, error, and status

- Every data surface defines loading, empty, error, stale/refreshing, and success states.
- Skeletons match final layout; spinners do not replace full-page structure unnecessarily.
- Empty states say why and provide the next valid action.
- Status badges use one label/color mapping per domain; do not color the same status differently across screens.
- Never rely only on color; include icon/text.

### Accessibility and language

- Semantic controls, visible focus, keyboard access, accessible names, correct dialog/listbox/table semantics, sufficient contrast.
- Decorative images have empty alt; meaningful images have useful alt.
- Gujarati and English text must render in the configured font stack and remain readable under long translations.
- Do not mix languages inside one validation message unless the public UX deliberately uses bilingual copy.
- Respect reduced motion for non-essential animation.

## 13. Frontend state and data rules

- Server/API data is authoritative; local state is a view/edit buffer.
- Keep global admin context limited to auth role, active section, event scope, program list, and truly cross-feature state.
- Derive values rather than storing duplicate derived state.
- Cancel or ignore stale async requests when scope changes.
- After mutation, invalidate the appropriate API cache and refresh only affected queries.
- The 15-second GET cache must not be used for scanner results, payment status after checkout, worker progress, or other correctness-critical live reads; set `skipCache` or use explicit no-store behavior.
- Use safe storage wrappers during SSR/hydration.
- Do not store secrets or sensitive customer data in local storage. Existing admin-password storage is legacy and must not be copied into new mechanisms.
- Offline scanner data has a version, event ID, expiry/freshness time, and cleanup policy.

## 14. Security and privacy rules

- Never commit `.env`, keys, passwords, tokens, signed URLs, customer exports, production database URIs, or unmasked provider payloads.
- Fail closed when required production secrets are missing or environments mismatch.
- Separate production/test database, Razorpay, WhatsApp, storage paths, and recipients.
- Keep test WhatsApp allowlist enforced in test mode.
- Apply least privilege: finance/storage/destructive/global configuration are super-admin; worker endpoints use dedicated worker secrets.
- Do not add query-token auth for new admin endpoints.
- Rate limit public registration, payment creation/status, VIP checks, media-token issuance, auth verification, and webhook abuse paths.
- Validate and sanitize uploads; reject executable/polyglot content.
- Escape spreadsheet exports and user-provided HTML/text.
- Mask phones in logs and routine dashboards when full value is unnecessary.
- Public status lookup returns only the minimum couple/pass information needed.
- Audit destructive actions, role changes, financial adjustments, event transfers, scanner resets, archive cleanup, and broadcast launch.
- Retain core financial/event/registration/audit data; prune webhooks/jobs/notifications/temp files only according to retention policy.

## 15. Logging and observability rules

- Use request ID/correlation ID through HTTP, jobs, and provider calls.
- Log structured event names with identifiers, never secrets.
- Include event ID, inquiry/message/job ID, status transition, duration, attempt, and safe provider code.
- Use `info` for normal lifecycle, `warn` for recoverable/provider/rate issues, `error` for failed outcomes requiring attention.
- Do not log full phone, raw payment proof, image buffer/base64, password, token, signature, or database URI.
- Dashboards must distinguish queued, sending, blocked-template, sent, delivered, read, failed, expired, and cancelled.
- Health checks should prove process readiness without revealing environment/database details publicly.

## 16. Operational script rules

Every new or retained mutating script in `backend/scripts/` must:

1. have a header stating purpose, read/write collections/providers, environment, and rollback;
2. default to test database or dry-run;
3. require an explicit `--execute`/confirmation for production mutation;
4. print resolved environment and masked target before work;
5. refuse environment mismatch using the same guards as the app;
6. query a bounded/scoped cohort and print counts/samples;
7. be idempotent or checkpointed;
8. record before/after counts and failures;
9. avoid embedding secrets, database URIs, event IDs, or live phone numbers;
10. have a verification mode/query;
11. never perform broad delete/update with an empty or unresolved filter;
12. be archived or removed after one-off use only after history is preserved safely.

Scratch scripts are not production tools. Promote a needed scratch script into a named, guarded, documented operation before reuse.

## 17. Testing matrix

### Always

- Review diff.
- Run syntax/type/lint appropriate to changed files.
- Test the changed happy path and at least one failure/edge path.

### Frontend changes

- `npm run lint` in `frontend/`.
- `npm run build` in `frontend/`.
- For offline scanner crypto changes, run `node scripts/test_offline_crypto.js`.
- Manually verify 320/390 px and desktop, keyboard, long labels, empty/error/loading.

### Backend domain changes

Run the matching test files directly because the default test command does not currently include every suite.

| Domain | Required focused tests |
|---|---|
| Razorpay/payment/webhook | `test_razorpay.js`, `test_webhook.js`, `test_order_creation.js`, idempotency tests |
| Event selection/modes | `test_event_selection.js`, `test_early_registration_mode.js`, `test_normal_mode_ek06_ek07.js`, lifecycle edge cases |
| WhatsApp | phase A, communication lifecycle/dashboard, worker auth/concurrency, idempotency, relevant E2E |
| Pass/QR | phase B QR signing, registration/payment linkage |
| Scanner | phase C/E scanner, media/offline crypto where coupled |
| Media/archive | media presets/security, archive preflight/controlled tests and scripts in test mode |
| Feedback | feedback admin dashboard and public token behavior |
| Broad lifecycle | isolated E2E plus all directly affected suites |

### Schema/index/migration changes

- Take/verify a test backup.
- Run dry-run migration on test data.
- Compare before/after counts and samples.
- Verify indexes explicitly.
- Run both old-compatible reads and new writes.
- Prove rollback or forward-fix.

### External side effects

- Razorpay uses test keys.
- WhatsApp uses mock/test mode and allowlisted number.
- Storage uses test prefix/bucket.
- Archive/backup uses test root.
- Never call live recipients/providers from an ordinary automated test.

## 18. Definition of done

A change is done only when:

- acceptance behavior is met;
- event and role scopes are correct;
- input/auth/consent/privacy rules are enforced server-side;
- states and error cases are explicit;
- idempotency/concurrency are handled where needed;
- schema/types/API/UI remain aligned;
- migration/backward compatibility is resolved;
- desktop/mobile/accessibility states are checked;
- targeted tests plus lint/build pass;
- operational/deployment/config steps are documented;
- no secrets, hardcoded production data, or unrelated changes entered the diff.

## 19. Change templates

### New event field

Model -> migration/default -> service projections -> controller validation/response -> frontend `Program` type -> event form -> all displays -> public API -> scheduler/export/archive implications -> tests -> docs.

### New admin section

`AdminSection` type -> correct navigation constant -> icon map -> Admin/SuperAdmin app switch -> feature directory -> typed API service -> role protection -> event/global scope -> loading/empty/error -> responsive/accessibility -> tests.

### New WhatsApp automatic message

Business trigger -> consent category -> Meta approved template -> registry/variables -> deterministic idempotency key -> scheduling/catch-up/skip rule -> worker eligibility recheck -> webhook statuses -> dashboard/timeline labels -> retry/cancel behavior -> tests with mock provider.

### New upload

Purpose/owner/event -> privacy class -> session limits -> direct signed upload -> completion verification -> model reference -> preset variants -> protected serving -> archive/retention/cleanup -> UI progress/recovery -> security tests.

### New database field/index

Read compatibility -> default semantics -> write path -> backfill dry run -> index plan -> bounded production operation -> verification -> rollback/forward-fix -> backup/restore -> tests and types.

## 20. Explicit forbidden shortcuts

- Do not edit only the frontend to enforce a business rule.
- Do not send money amounts from the client as truth.
- Do not send WhatsApp inside an unguarded loop directly from a request.
- Do not use `Date.now()` for automatic-message idempotency.
- Do not add event-specific `if (id === 'EK07')` production logic.
- Do not use `all` as a database event ID.
- Do not permanently delete registration/payment/audit data during ordinary cleanup.
- Do not expose private R2/Drive media with permanent public URLs.
- Do not create new legacy API aliases by default.
- Do not add a new dropdown/toast/modal style without extending the shared primitive.
- Do not run production scripts without dry-run, exact cohort, environment guard, backup, and verification.
- Do not treat a successful HTTP response from a provider as captured payment or delivered/read WhatsApp unless the provider contract says so.
- Do not mark work complete when only a subset of affected files/tests was checked.
