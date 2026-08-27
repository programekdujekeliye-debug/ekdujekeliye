# V2 Architecture Migration Plan

## 1. Migration Goals & Invariants

1. **Zero Regression**: Every currently functioning endpoint must continue serving identical HTTP responses.
2. **Modular Architecture**: Transform monolithic 3,000-line `backend/index.js` into clean, maintainable, domain-focused modules in `backend/src/`.
3. **Graceful Compatibility**: `backend/index.js` acts as an entry point adapter delegating to `backend/src/server.js`.

---

## 2. Phased Execution Steps

### Phase 1: Architecture Documentation (Completed)
- Document V2 Architecture, Database Schemas, RBAC, Storage Strategy, Performance, and Migration steps in `/docs`.

### Phase 2: Configuration & Shared Infrastructure
- Create `backend/src/config/env.js`, `database.js`, and `cors.js`.
- Create `backend/src/middleware/` for authentication, logging, and centralized error handling.
- Create `backend/src/utils/` for ID generation, slug formatting, and crypto helpers.

### Phase 3: Models & Vendor Integrations
- Create domain models in `backend/src/models/` (`Event.js`, `Registration.js`, `Payment.js`, `WebhookEvent.js`, `WhatsappTemplate.js`, `Notification.js`, `AuditLog.js`, `Job.js`).
- Move vendor integrations to `backend/src/integrations/` (`razorpay/`, `whatsapp/`, `cloudinary/`, `google-drive/`).
- Create `StorageService` provider abstraction in `backend/src/services/storage.service.js`.

### Phase 4: Domain Modules
- Implement modules in `backend/src/modules/`:
  - `auth/` (Login, verify, RBAC checks)
  - `events/` (List, details, CRUD, public home aggregation)
  - `registrations/` (Submit couple, manual entry, status, bulk operations, trash, attendance)
  - `payments/` (Create Razorpay order, verify signature, webhook handler, status)
  - `passes/` (Template loader, digital pass data)
  - `whatsapp/` (Webhook verification & event dispatcher, template manager)
  - `finance/` (Revenue metrics, event-level turnover calculation)
  - `admin/` (System stats, database diagnostics, exports)

### Phase 5: Application Assembly & Compatibility Verification
- Build `backend/src/app.js` and `backend/src/server.js`.
- Connect `backend/index.js` to delegate seamlessly to `backend/src/server.js`.
- Run comprehensive unit test suites (`npm test`) and live endpoint validations.
