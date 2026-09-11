# 01 — Workflow and Definition of Done

## Before code

Write a compact impact note containing:

- current behavior and requested behavior;
- public/admin/super-admin/worker access class;
- specific-event or global read scope;
- frontend route, feature, component, service, type, and storage impact;
- backend route, controller, service, model, integration, worker, and job impact;
- state transition, money, consent, PII, media, schedule, migration, and compatibility impact;
- target tests and rollback/forward-fix.

Use `rg` to locate all readers/writers. Read the whole target file and the smallest complete caller/callee chain before editing. Check `git status` and preserve unrelated work.

## During code

- Make one cohesive change at a time.
- Keep HTTP translation out of business services and business policy out of UI.
- Add compatibility only for a verified deployed consumer.
- Prefer extraction over adding responsibility to files above 500 lines.
- Add comments for invariants/provider constraints/legacy compatibility, not obvious syntax.
- Add/update tests in the same phase as behavior.

## Completion gate

A task is complete only when:

- behavior and failure states meet acceptance criteria;
- event and role scope are correct;
- backend validation/auth/consent are authoritative;
- idempotency and concurrency are handled;
- model, index, API, frontend type, UI, and documentation agree;
- old stored records and public links still work or have a tested migration;
- loading, empty, error, mobile, keyboard, touch, and long-text UI states are checked;
- focused tests and required lint/build pass;
- configuration, index, migration, worker, and deployment steps are stated;
- diff contains no secrets, customer exports, unrelated edits, or accidental mass formatting.

## Final report format

Report outcome first, then files changed, verification results, migrations/config/deployment actions, compatibility behavior, and remaining risks.

