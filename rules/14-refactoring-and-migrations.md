# 14 — Refactoring and Migrations

## Why restructuring is phased

This repository serves live public links, captures money, creates QR passes, sends scheduled messages, and contains active concurrent edits. A mass rename would create hidden import, deployment, script, webhook, and operational failures. “Perfect structure” is achieved through verified phases.

## Phase sequence

### Phase 0 — Baseline

- Cleanly separate unrelated working changes.
- Inventory imports/exports/routes/scripts.
- Run current focused tests and frontend build/lint.
- Record canonical APIs and public links.

### Phase 1 — Shared primitives and policy helpers

- Centralize event identity resolver, effective event capability policy, status maps, API responses, confirmations, form fields, modal, badges, and table states.
- No file moves that change public imports yet.

### Phase 2 — Frontend domain extraction

- Make `app/page.tsx` files thin.
- Split files over 500 lines by cohesive feature component/hook/service/type.
- Start with low-coupling UI, then registrations/events/VIP/reports, then scanner/WhatsApp.
- Keep temporary re-export adapters only with removal issue/condition.

### Phase 3 — Backend controller extraction

- Split oversized controllers into capability controllers/services/policies while keeping canonical routes unchanged.
- Suggested WhatsApp capabilities: templates, lifecycle dashboard, broadcasts, conversations, webhooks, admin testing.
- Suggested registration capabilities: public intake/status, admin CRUD, bulk operations, transfer, VIP/manual intake, media redirects.

### Phase 4 — Canonical names and aliases

- New code uses Event/Registration vocabulary.
- Retain Program/Submission model aliases only at persistence/compatibility boundary.
- Mark every duplicate HTTP path canonical or legacy; update frontend to canonical; remove alias only after usage verification.

### Phase 5 — Tests and scripts

- Reorganize tests into unit/integration/e2e without changing coverage.
- Classify scripts into audit/migrate/repair/seed/verify.
- Replace scratch/date/final naming with purpose names or archive/remove after verification.

### Phase 6 — Schema/data cleanup

- Consolidate overlapping state/mode fields only through backward-compatible migration.
- Create explicit index operations and reconciliation tools.
- Remove adapters after stored data and callers are verified.

## File move gate

For every batch:

1. Maximum one domain or ten low-coupling files.
2. Baseline is green before move.
3. Use version-control-aware moves; do not combine behavioral redesign and mass rename.
4. Update all imports, dynamic references, scripts, docs, tests, and deployment entry paths.
5. Run `rg` for old path/name.
6. Run focused tests plus build/import/start checks.
7. Review diff for accidental line-ending/format churn.
8. Commit/report the phase independently with rollback point.

## Forbidden refactor actions

- No 459-file rename in one patch.
- No route/path/template/storage-key rename without compatibility.
- No schema enum cleanup without migration.
- No refactor of files containing unrelated active edits until reconciled.
- No deletion of legacy adapter based only on repository search; verify deployed/external callers.

