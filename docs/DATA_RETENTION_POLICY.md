# Data Retention & Pruning Policy

## 1. Non-Deletable Core Business Data

The following critical records are **permanently retained** in MongoDB Atlas:
* **Captured Financial Payments & Ledger** (`Payment` collection & `Submission.payment` sub-document).
* **Master Event Definitions** (`Event` collection).
* **Couple Registrations** (`Registration` collection with name, phone, ticket ID, and attendance timestamp).
* **Audit Logs** (`AuditLog` collection).

---

## 2. Ephemeral & Prunable Operational Data

To keep MongoDB Atlas usage comfortably below **350 MB** (internal safety target):

| Data Type | Retention Period | Action |
| :--- | :--- | :--- |
| **Local Render Database Backups** | 15 Days | Daily automated purge of `.json.gz` files |
| **Raw Webhook Event Logs** | 90 Days | Pruned after idempotency verification window |
| **Old System Notifications** | 30 Days | Read notifications archived or dismissed |
| **Temporary Image Upload Buffers** | Immediate | Erased after memory buffer processing |
| **Completed Background Jobs** | 30 Days | Pruned after successful execution |
