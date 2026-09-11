# 10 — Passes, Invitations, and Scanner

## Pass and QR

- One pass per event/registration enforced by unique index.
- QR is signed and versioned; decoded JSON without signature is untrusted.
- Client receives verification public key only; private key never leaves protected backend/config.
- Key rotation uses `keyId`, compatibility window, roster refresh, and tests.
- Revoked/cancelled/wrong-event passes fail online and under documented offline freshness behavior.

## Invitation

- Current event template overrides stale registration template fields.
- Render hash/version includes template, event details, couple names, media identity, crop, zoom, offsets, and rotation.
- Any dependency change invalidates/version-bumps the cached image.
- Image operations are bounded for the 512 MB runtime.
- Sample image is display fallback only, not successful-upload evidence.

## Scanner

- Scanner requires one selected event.
- Offline package includes event ID, version/freshness, public verification material, and protected local roster.
- `(deviceId, scanLocalId)` makes sync idempotent.
- Server owns first scan, duplicate, wrong event, revocation, and attendance outcome.
- UI distinguishes success, already scanned, invalid signature, wrong event, revoked, offline queued, sync conflict, and server error.
- Attendance reset requires high privilege, exact event scope, typed confirmation, and audit evidence.

