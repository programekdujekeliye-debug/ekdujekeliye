# 03 — Frontend and Design System

## Component structure

- `app/**/page.tsx` composes a domain page and owns route parameters only.
- Domain state/components/hooks live under `features/<domain>`.
- Admin API calls use typed services; do not add raw admin fetches inside components.
- Shared UI contains behavior-neutral primitives, not event/payment business rules.
- Cross-feature global context stays limited to auth role, active section, selected event, and the shared event list.

## Visual language

- Background `#FAF9F6`; foreground slate; brand rose `#BE123C`, maroon `#881337`, gold `#D97706`.
- Normal admin accent is rose; super-admin accent is purple.
- Semantic colors: emerald success, amber warning, sky information, red/rose destructive.
- Prefer white cards, slate-200 borders, restrained elevation, `rounded-xl` controls/cards and `rounded-2xl` overlays.
- Extend tokens/primitives before adding page-specific visual conventions.

## Dropdowns

- `LuxurySelect` is the default rich choice control.
- Native `<select>` is allowed when native mobile/accessibility behavior is intentionally better.
- `EventSelectorDropdown` is only the global event workspace switcher.
- Do not create another dropdown implementation.
- Custom dropdowns require label, placeholder, disabled state, selected state, outside-click and Escape close, keyboard arrows/Enter, focus management, ARIA listbox/option, empty result, long-label truncation, search at seven-plus options, max-height scrolling, and viewport collision behavior.
- Event grouping is Upcoming/Active, Date TBA, Completed, plus Global only when the target page supports aggregated reads.

## Notifications

- Use the shared toast provider for transient feedback.
- Replace one loading toast with success/error using the same ID.
- Never show success before server confirmation.
- Field validation is inline; page-load failure is an in-page error state; irreversible action uses an accessible confirmation dialog.
- One action produces one primary feedback message.
- Persistent backend notifications are operational records, not toast replacements.

## Forms, modals, tables

- Visible labels, required/optional indication, units, examples, preserved input on failure, disabled pending submit, client convenience validation plus server authority.
- File fields show type/size, preview, upload progress, replace/remove, and retry.
- Dialogs require title/context, close/Escape, focus trap, initial/return focus, scroll lock, safe backdrop behavior, and clearly separated destructive action.
- Every data surface has loading, refreshing/stale, empty, error, and success states.
- Tables use bounded horizontal scroll, priority columns, or mobile cards; no page-level horizontal overflow.

## Responsive and accessibility

- Validate 320, 360/390, tablet, and desktop widths.
- Touch target is at least 40 px admin and preferably 44 px public.
- Keep mobile form fields at 16 px to prevent iOS zoom.
- Respect safe areas, dynamic viewport height, reduced motion, semantic HTML, visible focus, sufficient contrast, and meaningful accessible names.
- Gujarati and English must both fit; do not rely on color alone.

## Client data

- API is authoritative; component state is a view/edit buffer.
- Cancel/ignore stale responses after event/filter changes.
- Mutations invalidate affected caches.
- Skip the 15-second GET cache for payment status, scanner, worker progress, or correctness-critical live reads.
- Use safe storage wrappers. Do not put new credentials or customer data in local storage.

