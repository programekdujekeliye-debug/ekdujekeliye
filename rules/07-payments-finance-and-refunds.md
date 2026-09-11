# 07 — Payments, Finance, and Refunds

- Server resolves event price and currency; client amount is never authoritative.
- Provider amounts use integer minor units.
- Razorpay checkout and webhook signatures are verified; webhook uses exact raw bytes.
- Provider event IDs and payment/order IDs enforce idempotency.
- Repeated capture never duplicates ledger entry, approval, pass, or WhatsApp confirmation.
- Keep dedicated Payment ledger and embedded registration payment snapshot consistent transactionally or through reconciliation.
- Payment status transitions are monotonic unless an explicit refund/failure correction is recorded.
- Refund does not automatically decide registration/pass/attendance policy; define and test the business transition.
- Manual/cash/free/VIP providers remain explicit and auditable.
- Finance APIs/UI are super-admin only.
- Exports escape cells beginning `=`, `+`, `-`, or `@` to prevent formula injection.
- Do not log full gateway payloads, signatures, secrets, or unnecessary PII.
- Non-production must use test keys; startup remains fail-closed on key/mode mismatch.

