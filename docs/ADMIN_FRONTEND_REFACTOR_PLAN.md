# EK DUJE KE LIYE — ADMIN FRONTEND REFACTOR PLAN

## 1. Executive Summary & Objectives
The current admin client (`frontend/src/app/admin/page.tsx`) contains approximately 5,645 lines of code incorporating authentication, event CRUD, pass canvas template editing, server-paginated registrations, duplicate inquiry resolution, trash bin management, batch PDF/ZIP exports, WhatsApp message templates, payment UPI settings, manual invitee generation, and real-time zero-cost system telemetry.

This document details the step-by-step extraction plan to decompose the monolithic `page.tsx` into a modular domain-driven architecture adhering to the target structure:
```text
Route (/admin/page.tsx)
  ↓
Layout (AdminLayout, AdminSidebar, AdminTopbar)
  ↓
Features (dashboard, events, registrations, finance, whatsapp, settings, resources, integrations, reports)
  ↓
Components & Drawers
  ↓
Hooks & Context (AdminContext, useAdminAuth)
  ↓
API Services (apiClient, eventsApi, registrationsApi, etc.)
  ↓
Backend APIs
```

---

## 2. Monolith Decomposition Map

| Current Block in `page.tsx` | Line Range (Approx.) | Target Destination | Responsibilities & Dependencies | Risk Level |
|---|---|---|---|---|
| Type Definitions & Interfaces | 19–180 | `src/types/` (`event.ts`, `registration.ts`, `finance.ts`, `whatsapp.ts`, `admin.ts`) | Centralized TypeScript contracts | Low |
| Icons & Visual Assets | 6–17 | `src/components/Icons.tsx` | Unified SVG icon suite | Low |
| API Client & HTTP Handlers | 480–1350 | `src/services/apiClient.ts` & `src/services/admin/*.ts` | Centralized fetch client with auth token headers | Low |
| Admin Auth & Login Screen | 3050–3190 | `src/features/admin/auth/` (`AdminLogin.tsx`, `useAdminAuth.ts`) | Password entry, session persistence, role verification | Medium |
| Layout Shell & Navigation | 3215–3340 | `src/components/admin/layout/` (`AdminLayout.tsx`, `AdminSidebar.tsx`, `AdminTopbar.tsx`) | Responsive drawer, active tab indicator, event context switcher | Low |
| Dashboard Overview | 3450–3495 | `src/features/admin/dashboard/DashboardPage.tsx` | Inquiry metrics, latest token ID, database gauge | Low |
| Program / Event Management | 3495–3883 | `src/features/admin/events/` (`EventsPage.tsx`, `EventForm.tsx`, `PassTemplateEditor.tsx`) | Event creation, edit drawer, visual pass heart coordinate alignment | Medium |
| Registrations & Filters | 4615–5285 | `src/features/admin/registrations/` (`RegistrationsPage.tsx`, `RegistrationsTable.tsx`, `RegistrationFilters.tsx`) | Server pagination (50/p), status filter, token search, inline actions | High |
| Duplicate Inquiries Resolver | 5285–5495 | `src/features/admin/registrations/DuplicateSubmissionsView.tsx` | Conflict detection (phone/name matches), bulk trash selection | Medium |
| Trash Bin & Restoration | 1190–1250, 4600–4615 | `src/features/admin/registrations/TrashSubmissionsView.tsx` | Soft-deleted registrations list, single/bulk restore, permanent purge | Low |
| Manual Invitee Registration | 4010–4155 | `src/features/admin/settings/ManualInviteeModal.tsx` | Direct guest entry (`IP-` prefix generation), WhatsApp share link | Low |
| WhatsApp Template Center | 3903–4005, 4158–4364 | `src/features/admin/whatsapp/WhatsAppPage.tsx` | Meta templates (pass delivery, payment request, photo delivery) | Low |
| Payment & UPI Settings | 3886–4010 | `src/features/admin/settings/SettingsPage.tsx`, `PaymentSettings.tsx` | UPI rotation ID list, per-UPI limit, payee details | Low |
| Custom Frame Adjustment & Zip Export | 4365–4600 | `src/features/admin/settings/FrameExportSection.tsx` | Canvas frame overlay export, batch ZIP creation | Medium |
| Batch PDF Badge Exporter | 1700–3050 | `src/features/admin/reports/BatchExportModal.tsx`, `pdfExport.ts` | Dynamic jsPDF / jszip batch coupon rendering | High |
| System Resource Guardrails | 3891–3895 | `src/features/admin/resources/ResourcesPage.tsx` | Live Render RAM, Atlas storage, Cloudinary credits, Gzip backup | Low |
| Integrations Health Center | 3897–3901 | `src/features/admin/integrations/IntegrationsPage.tsx` | Safe vendor status cards (Razorpay, WhatsApp, Google Drive) | Low |
| Route Entry (`page.tsx`) | 1–5645 | `src/app/admin/page.tsx` (< 50 lines) | Thin wrapper delegating to `<AdminApp />` | Low |

---

## 3. Migration Sequence
1. **Types Extraction**: Centralize domain types (`event.ts`, `registration.ts`, `finance.ts`, `whatsapp.ts`, `admin.ts`).
2. **API Client & Services**: Extract `apiClient.ts` and feature APIs in `src/services/admin/`.
3. **Constants & Navigation**: Create `src/constants/adminNavigation.ts`.
4. **Context & Auth Hook**: Create `AdminContext.tsx` and `useAdminAuth.ts`.
5. **Layout Components**: Build `AdminLayout.tsx`, `AdminSidebar.tsx`, `AdminTopbar.tsx`, and `AdminLogin.tsx`.
6. **Feature Modules Extraction**:
   - `dashboard/`
   - `events/` (including `PassTemplateEditor.tsx`)
   - `registrations/` (including `DuplicateSubmissionsView.tsx` & `TrashSubmissionsView.tsx`)
   - `finance/`
   - `whatsapp/`
   - `settings/` (including `ManualInviteeModal.tsx` & `FrameExportSection.tsx`)
   - `resources/`
   - `integrations/`
   - `reports/` (including `BatchExportModal.tsx`)
7. **Assemble `AdminApp.tsx`**: High-level feature switch and context provider.
8. **Replace `admin/page.tsx`**: Reduce to concise ~30-line entry file.
9. **Verification**: Run `npm run build` in `frontend/` and `npm test` in `backend/`.
