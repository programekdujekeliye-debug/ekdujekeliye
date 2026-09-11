# 13 — Change Impact Map

| Change | Mandatory inspection surface |
|---|---|
| Event field/status/mode | Event model, policy/service/controller, projections, frontend type/form/display, selector/default logic, public pages, registration, scheduler/dashboard, tests |
| Event date/time/venue | Scheduled jobs, invitations/hash, scanner roster, public/admin UI, exports, archive eligibility |
| Price/currency | Event, public config, order service, embedded payment, ledger, finance, messages/receipts, tests |
| Inquiry ID | Counter, creation/transfer, pass, public lookups, WhatsApp keys, exports, scanner, scripts, tests |
| Registration status | Capacity, payment, pass, communications, filters, feedback, scanner, dashboards |
| Payment status/provider | Gateway/webhook, ledger, registration snapshot, finance, pass, reminders, UI, idempotency |
| QR/pass payload | Model/service/controller, public key, online/offline scanner, local crypto/database, migrations, tests |
| WhatsApp template | Registry, exact Meta contract, variables, scheduler/controller, UI preview/dashboard/timeline, old jobs, tests |
| WhatsApp status | Model enum, worker, webhook monotonic mapping, dashboard/timeline/inbox, retry policy |
| Media key/preset/privacy | Backend/frontend presets, upload, resolver, card renderer, exports, archive, migrations, security tests |
| Admin section | section type, navigation, icon map, app composition, query/route aliases, role/event scope |
| API route/response | route and app mount, auth, controller/service, frontend service/type/callers, compatibility, tests/docs |
| Schema/index | model, migration/index operation, queries/sorts, backup/restore, fixtures, scripts, verification |
| Event transfer | source/target capacity, counter/identity, pass, invitation, payment policy, messages, media, audit/history |

If three or more consumers are affected, record the change path in the pull request/task report rather than relying on memory.

