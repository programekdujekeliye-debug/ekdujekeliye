# 02 — Target Architecture and Naming

## Target repository layout

```text
/
├── AGENTS.md
├── ANTIGRAVITY.md
├── PROJECT_RULEBOOK.md
├── rules/                         # canonical modular rule books
├── docs/                          # architecture, runbooks, generated inventory
├── scripts/                       # repository-wide safe tooling
├── frontend/
│   ├── src/app/                   # thin Next.js route entries
│   ├── src/features/<domain>/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── types/
│   │   └── <Domain>Page.tsx
│   ├── src/components/ui/         # primitives only
│   ├── src/components/layout/     # cross-domain shells
│   ├── src/services/              # shared HTTP/client infrastructure
│   ├── src/lib/                   # pure platform helpers
│   ├── src/types/                 # true cross-domain contracts
│   └── src/styles/                # tokens and shared styles
└── backend/
    ├── src/app.js
    ├── src/server.js
    ├── src/config/
    ├── src/middleware/
    ├── src/platform/              # logging, errors, time, IDs
    ├── src/modules/<domain>/
    │   ├── <domain>.routes.js
    │   ├── <domain>.controller.js
    │   ├── <domain>.service.js
    │   ├── <domain>.policy.js
    │   ├── <domain>.validation.js
    │   └── <domain>.repository.js # only when query complexity warrants
    ├── src/models/
    ├── src/integrations/<provider>/
    ├── src/jobs/
    ├── src/workers/
    ├── tests/unit/
    ├── tests/integration/
    ├── tests/e2e/
    └── scripts/{audit,migrate,repair,seed,verify}/
```

This is the destination, not permission for a mass move. Follow `14-refactoring-and-migrations.md`.

## Naming rules

- Directories: lowercase kebab-case except established framework dynamic segments such as `[inquiryId]`.
- React components/classes/types: PascalCase.
- Hooks/functions/variables: camelCase; hooks begin `use`.
- Constants/state maps: UPPER_SNAKE_CASE.
- Backend files: `<domain>.<role>.js` such as `payment.service.js`.
- Frontend page containers: `<Domain>Page.tsx`; reusable elements name the UI responsibility, not vague terms such as `Box`, `Thing`, or `Common`.
- Tests: `<domain>.<behavior>.test.js`, grouped by unit/integration/e2e in the target structure.
- Operations scripts: `<verb>-<scope>-<purpose>.js`, for example `verify-event-archive.js`; no `scratch_*`, `final_*`, or date-only names in maintained tooling.
- Boolean: `is/has/can/should/was`; instant: `*At`; date-only: `*Date`; count: `*Count`; identifier: `*Id`.
- “Event” is the code-domain name. “Event slot” is UI language. “Program” is legacy compatibility only; do not create a third model.
- Use `registration`, not `submission`, in new application code except the established collection/model compatibility alias.

## Size and dependency boundaries

- Function review threshold: 80 lines.
- Component/module extraction threshold: 250 lines.
- No new responsibility in a file over 500 lines.
- No new file over 1,000 lines.
- Route entries are thin composition files.
- Domain modules may import platform/shared code and integrations through services; unrelated domains must not reach into each other’s controllers.
- Avoid barrel exports when they hide runtime cycles.

## Canonical versus legacy

Maintain a clear distinction in comments/docs:

- `canonical`: path/name used by new code;
- `legacy alias`: supported read/route kept for deployed compatibility;
- `migration-only`: temporary adapter with removal condition;
- `deprecated`: no new callers, telemetry/removal date documented.

