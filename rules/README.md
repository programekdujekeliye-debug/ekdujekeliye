# Rules Area — Canonical Index

This directory is the canonical, modular development rule system for Ek Duje Ke Liye. Each file owns one concern. `PROJECT_RULEBOOK.md` is the broad compiled/reference book; where wording conflicts, the more specific file in this directory wins unless current schema/source proves that the documented behavior has changed.

## Required reading order

Every task reads:

1. `00-core-invariants.md`
2. `01-workflow-and-definition-of-done.md`
3. `02-target-architecture-and-naming.md`
4. `13-change-impact-map.md`
5. the domain-specific files affected by the task
6. `14-refactoring-and-migrations.md` for moves, renames, schema work, or compatibility changes

## Rule books by development area

| File | Area | Read when |
|---|---|---|
| `00-core-invariants.md` | Global laws | Always |
| `01-workflow-and-definition-of-done.md` | Work method and completion | Always |
| `02-target-architecture-and-naming.md` | Folder structure and naming | Always |
| `03-frontend-and-design-system.md` | UI, dropdowns, notifications, responsive design | Any frontend/design change |
| `04-backend-and-api.md` | Express, services, contracts, auth | Any backend/API change |
| `05-database-and-data-lifecycle.md` | MongoDB, indexes, migrations, retention | Any persistence/query change |
| `06-events-and-registrations.md` | Event modes, slots, registrations, VIP, transfer | Core event/registration change |
| `07-payments-finance-and-refunds.md` | Razorpay, ledger, finance | Money-related change |
| `08-whatsapp-and-communications.md` | Automatic messages, inbox, broadcasts | WhatsApp change |
| `09-media-uploads-and-archive.md` | Attachments, R2, Cloudinary, Drive, backup | File/media/storage change |
| `10-passes-invitations-and-scanner.md` | QR, pass, card, online/offline scanning | Entry/pass change |
| `11-security-privacy-and-observability.md` | Secrets, PII, access, logging | Security/privacy/ops change |
| `12-testing-and-quality-gates.md` | Test selection and release evidence | Before completion |
| `13-change-impact-map.md` | “Change here, inspect there” | Always |
| `14-refactoring-and-migrations.md` | Safe restructuring phases | Move/rename/refactor/migrate |
| `15-operational-scripts.md` | Production scripts and destructive operations | `backend/scripts` work |
| `16-code-restructure-manifest.md` | Project-specific file split and rename destination | During structural refactor phases |

## Rule precedence

1. User requirement and safety constraints.
2. Current schema and executable business behavior.
3. Nearest `AGENTS.md`.
4. Specific domain rule file here.
5. General rule file here.
6. Older documents and comments.

If current code contradicts a rule, do not silently choose one. Explain the mismatch, determine whether it is intentional compatibility or debt, and update code/tests/rule documentation together.
