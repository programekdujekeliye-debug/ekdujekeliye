# 08 — WhatsApp and Communications

## Consent and classification

- Operational messages use operational consent helper and stop after opt-out.
- Marketing requires explicit marketing opt-in; legacy undefined is false.
- STOP/opt-out cancels or blocks pending marketing work.
- Store source and timestamp for consent.

## Template contract

- `templateRegistry.js` is the code registry.
- Meta name, language, category, header, component order, and variables exactly match approval.
- Backend dispatch and UI preview use the same contract.
- Missing/pending/rejected templates become explicit blocked states, not silent fallback messages.
- Preserve/migrate queued jobs when a template version changes.

## Automatic lifecycle

- All event time is IST.
- Unpaid normal registrations receive only eligible idempotent payment reminders.
- Approved registrations can receive T−48h pass reminder.
- Personalized invitation targets T−24h.
- Payment between T−24h and T−2h can use configured cooldown catch-up.
- Inside T−2h invitation is skipped unless an explicit authorized override exists.
- Post-event memories/feedback queues once at next-day midnight IST.
- Event update/cancellation reconciles future jobs.

## Worker

- Automatic idempotency keys are deterministic; do not include `Date.now()`.
- Atomically claim `QUEUED -> SENDING`, with batch limit, lease, stale recovery, attempts, and backoff.
- Revalidate registration, deletion, event, payment/status, consent, recipient, and template immediately before send.
- Delivery webhook updates cannot downgrade a more advanced status.
- Spam/throttle signals slow or stop the batch.
- Retry preserves the failed record and reason.

## Inbox and broadcast

- Normalize/hash/mask phones consistently and link conversations only with confident identity.
- Free text only inside Meta’s service window; otherwise approved template.
- Notes/assignment/status are internal and never sent.
- Broadcast requires audience preview, event scope, consent classification, exclusions, duplicate/invalid counts, template status, test/live mode, and explicit launch.
- Marketing campaigns are super-admin, queued, bounded, auditable, and progress-visible.
- Test mode sends only to configured allowlist and is visibly labeled.

