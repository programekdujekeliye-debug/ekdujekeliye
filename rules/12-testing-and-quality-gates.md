# 12 — Testing and Quality Gates

## Frontend

- Run `npm run lint` and `npm run build` in `frontend`.
- Run offline crypto test for scanner/local security changes.
- Manually verify 320/390 px and desktop; keyboard, touch, long text; loading/empty/error/stale/success.

## Backend focus map

| Area | Required focus |
|---|---|
| Payment | Razorpay, webhook, order creation, idempotency |
| Event/mode | event selection, early mode, normal mode, lifecycle edge cases |
| WhatsApp | phase A, lifecycle, dashboard, worker concurrency/auth, idempotency, E2E |
| Pass/QR | phase B QR signing and payment/registration linkage |
| Scanner | phase C/E, online/offline sync, crypto/security coupling |
| Media/archive | presets, security, archive preflight and test-environment operations |
| Feedback | feedback dashboard and public token behavior |
| Broad change | isolated E2E and every directly affected suite |

The default backend `npm test` currently omits some repository tests. Run matching files directly until the package command is corrected.

## External systems

- Razorpay test keys only.
- WhatsApp mock/test plus allowlist.
- Test database and test storage prefix/bucket/root.
- No ordinary automated test contacts live customers or mutates production.

## Refactor gate

A behavior-preserving move must pass baseline tests before, the same tests after, frontend import/type/build validation, backend import/start validation, and route/API snapshot comparison when relevant.

