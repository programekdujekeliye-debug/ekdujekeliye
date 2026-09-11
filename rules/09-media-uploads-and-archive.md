# 09 — Media, Uploads, Archive, and Backup

## Upload and attachment

- Prefer short-lived direct-to-R2 upload sessions.
- Bind session to owner/event/purpose/MIME/size/privacy and verify object on completion.
- Validate decoded content, not file extension only.
- Use opaque object keys; no customer phone/name in paths.
- Couple photo and payment proof are private.
- Create shared WebP presets: thumb for lists, normal for detail, large only for print/render.
- UI shows restrictions, preview, progress, replacement/removal, and retry.

## Provider roles

- R2 is authoritative for new media writes.
- Cloudinary is legacy read fallback only while enabled.
- Google Drive is verified historical archive, not the active public media tier.
- Frontend/backend preset names and privacy decisions remain identical.

## Archive

- Use explicit queued/claim/copy/verify/complete state with pause/partial/failure branches.
- Worker uses dedicated auth, event-scoped atomic leases, and bounded batches.
- Verify destination existence, size/checksum, and protected accessibility.
- Preserve operational thumbnail when needed.
- Delete original only after verified durable archive, cleanup preflight, correct environment, super-admin/worker authority, and audit evidence.

## Backup and restore

- Backup includes schema version, timestamp, counts, data, compression, checksum, and manifest.
- Verify Drive sync before local retention purge.
- Restore to test first; verify checksum, counts, relationships, public pass, admin, payment, and communication reads before production maintenance.

