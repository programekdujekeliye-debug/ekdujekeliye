# Role-Based Access Control (RBAC) Architecture

## 1. Overview

Ek Duje Ke Liye transitions from a monolithic administrative password to a scoped, granular Role-Based Access Control system.

---

## 2. Defined Roles & Permissions

| Role | Description | Scope | Permissions |
| :--- | :--- | :--- | :--- |
| **SUPER_ADMIN** | Overall system owner (Manish Vaghasiya / Lead Admin) | Global | Full administrative access, user creation, financial audits, bulk deletions, system settings |
| **EVENT_ADMIN** | Organizer for specific event batches | Assigned Events (`assignedEventIds`) | Event configuration, registration approval, slot management, badge template editing |
| **FINANCE** | Accountant / Financial Auditor | Global / Assigned Events | Read-only access to payments, revenue reconciliation, invoice & settlement reports |
| **GATE_STAFF** | On-site reception & verification crew | Assigned Event (Day of Event) | Live QR scanning, check-in verification, attendance marking |
| **SUPPORT** | Customer service representative | Global | Lookup registration status, resend digital pass link via WhatsApp, update misspelled names |
| **CONTENT_MANAGER**| Website editor | Public pages | Landing page content, FAQs, gallery, seminar highlights |

---

## 3. Backward-Compatible Authentication Adapter

To ensure zero downtime during transition:
1. **Legacy Password Auth**: Continues supporting `Authorization: Bearer <ADMIN_PASSWORD>` or `<SUPER_ADMIN_PASSWORD>`.
2. **Session / Token Auth**: Resolves tokens into an authenticated identity with `{ role, permissions, assignedEventIds }`.
3. **Event Scoping Middleware**: Ensures that `EVENT_ADMIN` and `GATE_STAFF` cannot view or mutate registrations belonging to other event IDs.
