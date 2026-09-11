# 04 — Backend and API

## Layer ownership

- Routes: HTTP verb/path/middleware only.
- Controllers: parse and validate HTTP input, invoke service, map response.
- Services: business policy and state transitions.
- Policies: pure capability/eligibility decisions when shared by routes/workers.
- Repositories: reusable complex queries only; not mandatory wrappers around every model call.
- Integrations: provider request, signature, error, and response mapping.
- Workers/jobs: bounded claim/schedule/retry orchestration.
- Models: persistence shape, indexes, and model-local pure helpers.

## Endpoint conventions

- Canonical resources use `/api/<plural-resource>`.
- Admin, super-admin, and workers use `/api/admin`, `/api/super-admin`, and `/api/internal`.
- One canonical route; aliases only for verified existing callers.
- Fixed paths precede `/:id`.
- Access class is explicit on every route: public, customer-token, admin, super-admin, cron, archive worker, or backup worker.
- New admin endpoints use Authorization headers, not query tokens.
- Validate params/query/body/files/enums at the boundary.
- Paginate lists, cap page size, and allowlist sort fields.

## Contracts

- New success: `{ success: true, data, meta? }`.
- New error: `{ success: false, error, code, details? }`.
- Preserve older response shapes only for compatibility; do not copy inconsistency into new APIs.
- Stable error codes are for programmatic behavior; human messages are display text.
- Never return secrets, database connection names/URIs, unrestricted private-media links, provider credentials, or unnecessary PII.

## Reliability

- Return after sending a response.
- Unexpected errors reach the central error handler with request ID.
- Provider calls have timeout, mapped error, bounded retry, and safe logs.
- Webhook routes preserve exact raw body and provider retry semantics.
- HTTP requests must not synchronously send large broadcasts or perform unbounded archive/media work.
- Graceful shutdown clears intervals/leases safely.

