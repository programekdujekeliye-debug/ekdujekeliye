# 06 — Events and Registrations

## Event

- Canonical statuses are model-declared only.
- Centralize `canRegister`, `canPay`, `canSendLifecycle`, `canScan`, and `canArchive` policy from status, dates, capacity, and mode flags.
- Date TBA has no date-based automatic communication.
- Cancelled/completed/archived cannot accept normal public registrations or new future lifecycle jobs.
- `selectedProgramId` is canonical event ID or UI-only `all`; single-event screens reject `all` clearly.
- Event date/time/venue changes invalidate invitation output, reconcile message jobs, refresh scanner data, and update all public/admin surfaces.

## Registration

- Require target event and validated couple/phone/photo/consent inputs required by the flow.
- One normalized active phone per event plus same-couple duplicate detection.
- Backend capacity counts authoritative states and only the configured recent-pending reservation window.
- Atomic event counter/unique inquiry ID is required; client double-click guards are supplemental.
- Status transitions do not silently change payment state.
- Soft delete is normal; permanent purge is exceptional, confirmed, authorized, dependency-aware, and audited.

## Early mode

- Early registration saves the couple without forcing payment and may send one operational acknowledgment.
- Payment enablement starts with a preview and guarded event transition.
- Existing captured payments are untouched.
- One idempotent payment-opening message is queued per eligible early registration.

## VIP

- VIP links are event scoped unless intentionally global, with active/expired/limit validation on the backend.
- Free/manual payment/pass state is explicit and cannot be confused with captured Razorpay.
- Sponsor/category/link attribution remains auditable.

## Transfer

- Transfer is a service operation, not a raw `programId` edit.
- Validate target event/capacity and explicit price-difference policy.
- Preserve previous inquiry ID and append history.
- Reissue/reconcile pass and invitation identity.
- Cancel source-event queued messages and schedule eligible target-event messages.
- Notification is idempotent and traceable.

