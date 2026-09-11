# Ek Duje Ke Liye Repository Instructions

These instructions apply to the entire repository.

Before analysis or editing, read `rules/README.md` and every rule file it marks as required for the affected area. Read `docs/CODEBASE_ANALYSIS.md` for current behavior and `docs/CODEBASE_FILE_INVENTORY.md` for file coverage. `ANTIGRAVITY.md` provides the short AI entry workflow.

Non-negotiable invariants:

- Event is the root business boundary; `all` is UI/reporting scope only.
- Backend owns authorization, price, capacity, state transitions, consent, and provider verification.
- Payments, webhooks, passes, messages, scans, archives, backups, and migrations are idempotent.
- Production and test databases, payment keys, WhatsApp recipients, and storage paths remain separated and fail closed.
- Do not add hardcoded event-specific business data, live recipients, secrets, or new legacy aliases.
- Preserve public inquiry/pass/invitation links and stored identities unless a tested migration is included.
- Never mass-move or mass-rename application files without completing the phase gate in `rules/14-refactoring-and-migrations.md`.
- Preserve unrelated working-tree changes.

For frontend work, also follow `frontend/AGENTS.md`, including its requirement to consult the installed Next.js documentation before using framework APIs.

