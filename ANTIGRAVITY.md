# Antigravity Development Entry — Ek Duje Ke Liye

You are developing the Ek Duje Ke Liye event operations platform. Before changing code, read these files in order:

1. `AGENTS.md` — repository-wide non-negotiable instructions.
2. `rules/README.md` — canonical rule index and required domain-specific reading.
3. `docs/CODEBASE_ANALYSIS.md` — current architecture, features, flows, coupling, and known debt.
4. `docs/CODEBASE_FILE_INVENTORY.md` — complete code-file audit and location index.
5. `PROJECT_RULEBOOK.md` — complete combined reference book.
6. The nearest additional `AGENTS.md`. For frontend work, follow `frontend/AGENTS.md` and read the installed Next.js 16 guide relevant to the change.

## Mandatory operating instruction

Do not immediately code from the request. First produce a short impact analysis containing:

- current behavior and desired behavior;
- exact event/global scope;
- affected frontend routes/features/services/types;
- affected backend routes/controllers/services/models/integrations/workers;
- state, database/index/migration, auth, consent, payment, media, and WhatsApp effects;
- compatibility and rollback needs;
- tests to run.

Then implement the smallest cohesive change. Current models/source override older documentation. Preserve unrelated changes. Never expose or invent secrets. Never run a live payment, WhatsApp, deletion, archive cleanup, database migration, or production mutation without explicit scope, safety gates, dry-run/test evidence, and authorization.

## Project mental model

The event is the root boundary. Registration is the central couple record. Payment authorizes approval. Approval ensures a pass. Event timing schedules communications. Scanner writes attendance. Attendance enables post-event feedback. Media moves from active private R2 to verified historical Drive archive. Admin uses one selected event context; `all` is read-only reporting scope.

When changing one link in that chain, trace and update every downstream consumer using `rules/13-change-impact-map.md`. Moves, renames, controller splits, and schema migrations must follow `rules/14-refactoring-and-migrations.md`.

## Response contract

At completion report:

- outcome and user-visible behavior;
- files changed;
- migrations/config/deployment actions;
- tests run and results;
- remaining risks or intentionally deferred work.
