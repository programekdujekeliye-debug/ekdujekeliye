# 16 — Code Restructure Manifest

This is the project-specific destination map. It is executed in the phase order from `14-refactoring-and-migrations.md`, not as one mass patch.

## Frontend target moves and extractions

| Current file/area | Target structure |
|---|---|
| `src/app/page.tsx` | thin route plus `features/public-home/PublicHomePage.tsx`, `components/*`, `hooks/usePublicHome.ts` |
| `src/app/event/[slug]/page.tsx` | thin route plus `features/event-registration/EventRegistrationPage.tsx`, registration/payment hooks and components |
| `features/admin/events/EventsPage.tsx` | page container, `components/EventList`, `EventFormDrawer`, `EventModePanel`, `PassTemplateEditor`, `hooks/useEvents` |
| `features/admin/registrations/RegistrationsPage.tsx` | page container, filters/table/action bar, `hooks/useRegistrations`, `hooks/useRegistrationSelection` |
| `features/admin/vip/VipPassesPage.tsx` | `features/admin/vip-passes/` with links, registrations, form drawers, export helpers, hooks |
| `features/admin/scanner/ScannerPage.tsx` | page container, camera/decoder/result/offline-sync/stat components and `hooks/useScanner*` |
| `features/admin/whatsapp/WhatsAppPage.tsx` | `whatsapp-center/` with lifecycle dashboard, timeline, message test, retry, post-event, and event-scope components/hooks |
| `features/admin/whatsapp/inbox/*` | move to sibling `whatsapp-inbox/`; keep center and inbox as separate domains |
| `features/admin/reports/BatchExportModal.tsx` | `reports/batch-export/` renderer, data mapper, controls, progress, modal |
| `features/admin/reports/FrameReviewExportModal.tsx` | `reports/frame-export/` canvas renderer, alignment editor, batch/export services, modal |
| `features/super-admin/storage/StoragePage.tsx` | storage dashboard, archive table/actions, backup panel, hooks |
| `features/super-admin/feedback/FeedbackDashboardPage.tsx` | dashboard cards, filters/table, testimonial actions, export |
| `components/Icons.tsx` | keep one public icon index but split implementations by navigation/action/status if bundle/build analysis justifies it |
| `components/admin/layout/*` | target `components/layout/admin/*`; no domain business logic |
| `services/admin/*.ts` | move into corresponding feature `services/` when used by one domain; retain `services/apiClient.ts` shared |
| `types/*.ts` | domain-only types move beside feature; cross-domain API/domain types remain shared |

Temporary compatibility re-export files may remain at old import paths for one phase. New imports must use the target path.

## Backend target splits

### WhatsApp

```text
modules/whatsapp/
├── whatsapp.routes.js
├── webhook/whatsapp-webhook.controller.js
├── templates/whatsapp-template.controller.js
├── lifecycle/communication-dashboard.controller.js
├── lifecycle/communication-admin.controller.js
├── broadcasts/whatsapp-broadcast.controller.js
├── conversations/whatsapp-conversation.controller.js
├── conversations/whatsapp-conversation.service.js
├── policies/whatsapp-consent.policy.js
└── validation/whatsapp.validation.js
```

Keep Meta provider behavior under `integrations/whatsapp`. Keep automatic scheduling under one canonical scheduler service; retire overlapping worker behavior only after parity tests.

### Registrations

```text
modules/registrations/
├── registration.routes.js
├── public-registration.controller.js
├── admin-registration.controller.js
├── registration-bulk.controller.js
├── registration-transfer.controller.js
├── vip-registration.controller.js
├── registration.service.js
├── registration-transfer.service.js
├── registration.policy.js
└── registration.validation.js
```

The `submission` collection and `Submission` model alias remain compatibility boundaries; new code vocabulary uses Registration.

### Archive

```text
modules/archive/
├── archive.routes.js
├── archive-worker.controller.js
├── archive-admin.controller.js
├── archive-cleanup.controller.js
├── archive.service.js
├── archive-claim.service.js
├── archive-verification.service.js
└── archive.policy.js
```

### Events, payments, scanner, media

- Events: extract eligibility/mode policy, lifecycle update service, asset/template service, and validation.
- Payments: preserve thin controller; isolate reconciliation and registration-approval orchestration from provider integration.
- Scanner: separate online scan, offline package/sync, manual attendance, statistics/reset, and scanner policy.
- Media: separate upload-session, private serving, signed view-token, historical archive access, and variant generation.

## Model naming boundary

Do not rename Mongo collections during structural phases. Keep:

- `Event` -> collection `program`;
- `Registration` -> collection `submission`;
- current collection names for payments, passes, scans, messages, conversations, feedback, VIP links, uploads, archives, backups, jobs, settings, notifications, audits, and webhook events.

Any collection rename is a separate data migration with dual-read/dual-write or maintenance strategy.

## Operations scripts target

Classify every retained `backend/scripts` file:

```text
scripts/
├── audit/       # read-only reports
├── verify/      # pass/fail invariant checks
├── migrate/     # versioned forward data changes
├── repair/      # bounded recovery with dry run
├── seed/        # test/dev fixtures by default
└── archived/    # historical one-off scripts, not executable runbook tools
```

Before moving a script, check package scripts, runbooks, deployment commands, imports, and operator usage. Rename by purpose; preserve a small compatibility wrapper only when an external runbook still calls the old path.

## Recommended execution batches

1. Shared frontend UI primitives and status maps.
2. Low-coupling super-admin feedback/storage extraction.
3. Reports and canvas export extraction.
4. Events and registrations frontend extraction.
5. VIP frontend extraction.
6. WhatsApp Center and Inbox separation.
7. Scanner extraction after current concurrent scanner work settles.
8. Backend archive controller split.
9. Backend WhatsApp controller split.
10. Backend registration controller split after current registration work settles.
11. Canonical route/service/type cleanup with compatibility adapters.
12. Test tree and operations script classification.
13. Optional schema/state consolidation as separate migrations.

Each batch gets its own baseline, verification, diff review, and rollback point.

