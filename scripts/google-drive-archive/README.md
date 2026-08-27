# Ek Duje Ke Liye — Google Drive Archive & Backup Worker

This folder contains the complete zero-cost **Google Apps Script** worker responsible for streaming completed event photos from Cloudinary straight into your Google Drive, as well as coordinating daily database backups.

---

## Architecture Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                    Google Cloud Ecosystem                   │
│                                                             │
│   Google Apps Script Worker                                 │
│   (runs every 10–15 mins)                                   │
│           │                                                 │
│     1. Claim Jobs                                           │
│           ▼                                                 │
│   Backend on Render (Lightweight JSON API)                  │
│           │                                                 │
│     2. Return asset URLs                                    │
│           ▼                                                 │
│   Google Apps Script Worker ─── Fetch Asset ───▶ Cloudinary  │
│           │                                     (Direct)    │
│     3. Stream File                                          │
│           ▼                                                 │
│   Google Drive (5TB Storage)                                │
│   Folder: "Ek Duje Ke Liye/Events/{slug}/Couple Photos"     │
│           │                                                 │
│     4. Verify ID & Size                                     │
│           ▼                                                 │
│   Backend Ledger (Mark Status: VERIFIED)                    │
└─────────────────────────────────────────────────────────────┘
```

> [!IMPORTANT]
> **Zero Bandwidth on Render**: Media bytes stream directly between Cloudinary and Google Drive. The Render backend only exchanges small JSON metadata records (< 2KB), keeping memory and CPU footprint near zero.

---

## Setup Instructions

### Step 1: Create the Google Apps Script Project
1. Open [script.google.com](https://script.google.com) logged into your Google Account.
2. Click **New project** (top-left).
3. Rename the project to: `EDKL Drive Archive Worker`.
4. Delete any existing code in the editor, copy the entire contents of [`Code.gs`](file:///d:/WEBSITE%20DEVELOPMENT/ekdujekeliye/scripts/google-drive-archive/Code.gs), and paste it into the editor.
5. Click **Save** (disk icon).

---

### Step 2: Configure Script Properties
1. In the left navigation sidebar of Apps Script, click on **Project Settings** (gear icon ⚙️).
2. Scroll down to **Script Properties** and click **Add script property**.
3. Add the following properties:

| Property | Value | Description |
| :--- | :--- | :--- |
| `BACKEND_URL` | `https://ekdujekeliye.onrender.com` | Your live backend URL |
| `ARCHIVE_WORKER_SECRET` | `edkl_archive_worker_secret_2026` | Matches `ARCHIVE_WORKER_SECRET` in Render |
| `ROOT_FOLDER_NAME` | `Ek Duje Ke Liye` | Name of the root folder in your Drive |

4. Click **Save script properties**.

---

### Step 3: Test Permissions & Connectivity
1. Return to the **Editor** (`< >` icon on the left).
2. In the toolbar function dropdown, select **`setupAndTestConnection`**.
3. Click **Run**.
4. When prompted for authorization, click **Review permissions**, choose your Google account, click **Advanced** -> **Go to EDKL Drive Archive Worker (unsafe)**, and click **Allow**.
5. View the **Execution log**: you should see:
   ```text
   Backend response code: 200
   ✅ SUCCESS: Backend authentication verified and Google Drive folder structure initialized
   ```

---

### Step 4: Schedule Automatic Triggers
1. In the left navigation, click on **Triggers** (alarm clock icon ⏰).
2. Click **Add Trigger** (bottom right):
   - **Function to run**: `runMediaArchiveWorker`
   - **Deployment**: `Head`
   - **Event source**: `Time-driven`
   - **Type of time based trigger**: `Minutes timer`
   - **Minute interval**: `Every 10 minutes` (or 15 minutes)
   - Click **Save**.
3. Click **Add Trigger** again for Daily Backups:
   - **Function to run**: `runDailyBackupSync`
   - **Event source**: `Time-driven`
   - **Type of time based trigger**: `Day timer`
   - **Time of day**: `11pm to midnight`
   - Click **Save**.

---

## Verification & Monitoring
* You can monitor real-time archive progress, completed Drive file counts, and retry failures from your **Super Admin Dashboard** at:
  `/super-admin` → **Storage & Archive**.
