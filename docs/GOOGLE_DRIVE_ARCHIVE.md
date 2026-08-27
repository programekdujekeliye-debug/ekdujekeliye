# Google Drive Archive Architecture & State Machine

## 1. Objectives & Principles

* **Free 5TB Capacity**: Utilize existing Google Workspace / 5TB Drive storage for long-term historical event photo archiving.
* **No Render Bandwidth Proxying**: Media transfers between Cloudinary and Google Drive must **never** pipe gigabytes of photo data through Render's constrained 512MB RAM server.
* **Google-Side Worker Execution**: Transfers are orchestrated by a Google Apps Script / Cloud Function or direct serverless worker that fetches directly from Cloudinary CDN and streams directly into Google Drive.

---

## 2. Directory Hierarchy

```
Google Drive (Ek Duje Ke Liye Root)/
├── Database Backups/
│   ├── Daily/
│   ├── Weekly/
│   └── Monthly/
│
└── Events/
    └── {eventSlug}/
        ├── registrations/
        ├── payments/
        ├── attendance/
        ├── couple-photos/
        ├── gallery/
        ├── passes/
        ├── exports/
        └── reports/
```

---

## 3. Media Archival State Machine

Every couple photo and seminar asset tracks lifecycle state:

```
[ ACTIVE ]
    │
    ▼ (Event Completed + 7-Day Grace Period)
[ QUEUED_FOR_ARCHIVE ]
    │
    ▼ (Worker Dispatches Batch)
[ COPYING ]
    │
    ▼ (Written to Google Drive)
[ COPIED ]
    │
    ▼ (SHA-256 Checksum & Size Verified)
[ VERIFIED ]
    │
    ▼ (Drive File ID Updated in MongoDB)
[ CLOUDINARY_DELETE_PENDING ]
    │
    ▼ (Purged from Cloudinary Operational Media)
[ ARCHIVED ]
```

* **Failure Guard**: If any step fails, status becomes `FAILED` with retry backoff. Assets are **never** deleted from Cloudinary until status is `VERIFIED` and confirmed in MongoDB.

---

## 4. Grace Period Configuration

* **Default**: `archiveAfterDays = 7`
* **Purpose**: Prevents premature archival immediately upon event completion, giving organizers time for pass adjustments, customer support inquiries, and report generations.
