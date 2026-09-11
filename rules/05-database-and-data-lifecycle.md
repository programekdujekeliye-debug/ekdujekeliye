# 05 — Database and Data Lifecycle

- Current files under `backend/src/models` are schema truth.
- Use explicit collection names, timestamps, enums, and defaults.
- New writes use canonical IDs; compatibility reads may resolve legacy ID/slug/date only in one shared resolver.
- High-cardinality filter/sort/query paths need matching indexes and `.lean()`/projection for read-only results.
- All lists paginate with a maximum limit.
- `autoIndex` and `autoCreate` remain off in production; schema index declarations require an explicit reviewed index operation.
- Unique indexes back core invariants: inquiry ID, payment ID, provider event ID, message idempotency, pass/event registration, feedback token, and other one-per-domain records.
- Use atomic conditional updates and `$setOnInsert` for claims/idempotent creation.
- Use transactions for coupled financial or identity transitions when the deployment supports them; otherwise implement reconciliation/forward-fix.
- Never silently change enum meaning. Add backward-compatible reads and migrate stored values.

## Schema change gate

Every schema/index change includes:

1. old-record read behavior;
2. default/new-write behavior;
3. dry-run backfill with exact cohort;
4. explicit index build/removal plan;
5. before/after count and sample verification;
6. rollback or forward-fix;
7. backup/restore compatibility;
8. frontend types and fixtures;
9. targeted tests.

## Retention

- Permanently retain core event definitions, registration identity, captured financial ledger, and audit records.
- Soft delete registrations by default.
- Prune webhook/job/notification/temp data only under documented retention windows and after correctness/audit needs expire.
- Media cleanup is governed by verified archive rules, not database size pressure alone.

