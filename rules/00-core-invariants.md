# 00 — Core Invariants

Rules in this file are mandatory for every change.

1. **Event boundary:** every domain record is event-scoped when applicable. Never persist `all` as an event ID.
2. **Canonical identity:** new writes use `Event.id`; public event URLs use `Event.slug`; public couple identity uses `inquiryId`; Mongo `_id` remains internal.
3. **Backend authority:** client values never decide price, role, capacity, paid state, pass validity, consent eligibility, event ownership, provider success, or storage access.
4. **One source of truth:** business policy belongs in a backend service/helper used by every route and worker. Do not reimplement it in controllers or UI.
5. **Idempotency:** retrying any payment, webhook, pass issue, message, scan sync, archive, backup, or migration must converge without duplicating the business action.
6. **IST business time:** event calculations use `Asia/Kolkata`; stored instants are UTC; date-only event values remain `YYYY-MM-DD` or `TBD`.
7. **Compatibility:** deployed public URLs, inquiry IDs, Meta template contracts, QR formats, and storage keys are stable interfaces.
8. **Environment separation:** test and production databases, Razorpay keys, WhatsApp destinations, R2 paths, Cloudinary prefixes, and Drive roots never cross.
9. **No live data in source:** do not hardcode real event dates, prices, venues, phone lists, recipients, database URIs, credentials, or customer information.
10. **Bounded runtime:** assume a 512 MB backend. Paginate, project, stream/redirect media, bound concurrency, and avoid full-collection memory loads.
11. **Consent:** operational and marketing WhatsApp consent are distinct. Marketing always requires explicit true opt-in.
12. **Durability before deletion:** media or data is not deleted until the required durable copy, verification, authorization, and audit evidence exist.
13. **Preserve user work:** inspect the working tree before editing; never overwrite unrelated changes.
14. **Evidence before completion:** affected tests, build/lint, migrations, compatibility, and deployment actions are part of the change.

