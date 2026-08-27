# Ek Duje Ke Liye — V2 Platform Architecture

## 1. Vision & Core Philosophy

Ek Duje Ke Liye is evolving from a single-city couple seminar registration script into an **enterprise-grade, event-centric relationship seminar & ticketing platform**. The platform handles event discovery, couple registration, atomic ticketing, Razorpay payment processing, digital pass rendering, Meta WhatsApp communications, live attendance check-in, and financial analytics.

### Architectural Tenets
1. **Event-Centric Core**: Every business entity (Registrations, Payments, Passes, Attendance, WhatsApp Logs, Media, Staff, Financials) belongs authoritatively to an `eventId`.
2. **Zero-Downtime Migration & Non-Breaking Compatibility**: All existing API routes (`/api/*`) are preserved alongside clean modular domain services.
3. **RAM & Resource Efficiency**: Engineered specifically for constrained server instances (e.g. Render 512MB RAM tier) through lean queries, pagination, stream processing, and selective lazy loading.
4. **Resilient Idempotency & Webhooks**: Financial transactions and Meta WhatsApp events use cryptographic verification and unique event idempotency tables.

---

## 2. System Overview

```
                      ┌───────────────────────────────────────────────┐
                      │             Next.js 16 Client                 │
                      │   (Landing, Events, Checkout, Digital Pass)   │
                      └──────────────────────┬────────────────────────┘
                                             │ HTTPS
                                             ▼
                      ┌───────────────────────────────────────────────┐
                      │              Express REST API                 │
                      │         (Structured Domain Modules)           │
                      └───────┬──────────────┬───────────────┬────────┘
                              │              │               │
            ┌─────────────────┴─┐      ┌─────┴──────┐   ┌────┴─────────────────┐
            ▼                   ▼      ▼            ▼   ▼                      ▼
┌───────────────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────────────┐
│   MongoDB Atlas       │ │  Cloudinary   │ │  Razorpay     │ │ Meta WhatsApp Cloud   │
│ (Events, Submissions, │ │ (Couple & Pass│ │ (Orders &     │ │ (Webhooks & Templates)│
│  Payments, Logs)      │ │     Media)    │ │ Webhooks)     │ │                       │
└───────────────────────┘ └───────────────┘ └───────────────┘ └───────────────────────┘
```

---

## 3. Directory Layout (V2 Target)

```
backend/
├── index.js                      # Legacy bootstrap entry point (forwards to src/server.js)
├── package.json                  # Scripts & dependencies
├── src/
│   ├── app.js                   # Express application setup & middleware pipelines
│   ├── server.js                # Server listener & graceful shutdown handlers
│   ├── config/                  # Centralized configuration & environment loader
│   │   ├── env.js
│   │   ├── database.js
│   │   └── cors.js
│   ├── middleware/              # Cross-cutting HTTP middleware
│   │   ├── auth.js              # RBAC & legacy password verification
│   │   ├── errorHandler.js      # Unified error response formatting
│   │   └── requestLogger.js     # Lightweight structured logger
│   ├── models/                  # Mongoose schemas & domain models
│   │   ├── Event.js             # Mapped to 'program' collection
│   │   ├── Registration.js      # Mapped to 'submission' collection
│   │   ├── Payment.js           # Dedicated financial records
│   │   ├── WebhookEvent.js      # Idempotency log
│   │   ├── WhatsappTemplate.js  # Message templates
│   │   ├── AuditLog.js          # Security & administrative actions
│   │   └── Job.js               # Scheduled async tasks
│   ├── modules/                 # Cohesive domain business modules
│   │   ├── auth/                # Authentication & permission controllers
│   │   ├── events/              # Event management & public discovery
│   │   ├── registrations/       # Couple registration & capacity allocation
│   │   ├── payments/            # Checkout, verification & webhooks
│   │   ├── passes/              # Digital pass generation & verification
│   │   ├── attendance/          # Live gate scan & attendance logging
│   │   ├── whatsapp/            # Cloud API webhook & dispatching
│   │   ├── finance/             # Revenue, refunds & financial reports
│   │   └── admin/               # Administrative tools & dashboard
│   ├── integrations/            # Third-party vendor wrappers
│   │   ├── razorpay/            # Razorpay SDK client & signature checkers
│   │   ├── whatsapp/            # Meta Graph API & Webhook handlers
│   │   ├── cloudinary/          # Cloudinary upload helpers
│   │   └── google-drive/        # Google Drive storage interface skeleton
│   ├── services/                # Cross-module shared services
│   │   └── storage.service.js   # Storage provider abstraction (Cloudinary/Drive)
│   ├── jobs/                    # Asynchronous job handlers (Reminders, Backups)
│   └── utils/                   # Shared helpers & formatters
```

---

## 4. Key Architectural Patterns

1. **Service-Oriented Controllers**:
   `Route Handler -> Controller -> Domain Service -> Data Model / Vendor Integration`.
2. **Unified Storage Provider Pattern**:
   Business logic talks exclusively to `StorageService` (`upload`, `delete`, `getUrl`), allowing seamless future migration from Cloudinary to Google Drive.
3. **Public vs Admin Partitioning**:
   Public routes enforce aggressive projections (omitting sensitive phone numbers, private notes, and internal counters) to maximize performance and protect attendee privacy.
