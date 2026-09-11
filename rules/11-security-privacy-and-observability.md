# 11 — Security, Privacy, and Observability

- Never commit secrets, private/signing keys, `.env`, customer exports, production URI, signed private URLs, or payment/WhatsApp credentials.
- Fail closed when required secrets or environment modes mismatch.
- Least privilege: finance/global/storage/destructive work is super-admin; workers use dedicated secrets.
- New admin APIs do not accept query-token authentication.
- Rate limit public registration, payment, auth, VIP checks, token/media issuance, and webhook abuse paths.
- Sanitize/validate uploads and exported content.
- Return minimum PII from public lookup; mask phone where full value is unnecessary.
- Audit financial adjustments, event transfer/cancellation, broadcast launch, archive cleanup, scanner reset, permanent delete, and global settings.

## Logging

- Carry request/correlation ID across HTTP, jobs, and provider operations.
- Log structured event/action with safe event/inquiry/message/job identifiers, transition, duration, attempt, and provider code.
- Never log passwords, tokens, signatures, database URI, image/base64 buffers, full phone, or raw payment proof.
- `info` is normal lifecycle, `warn` recoverable/provider pressure, `error` failed outcome needing attention.
- Health endpoints show readiness without public database/environment detail.

